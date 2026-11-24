// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BUILT_IN_POLICY_PRESETS,
  deletePolicyPreset,
  detectPolicyContradictions,
  ensureDefaultPolicyPresets,
  getPolicyPreset,
  listPolicyPresets,
  savePolicyPreset,
  validatePolicyPreset,
} from '../../src/core/policies';
import {
  buildAuthorProfileSnapshot,
  deleteAuthorProfile,
  getAuthorProfile,
  inferSnsPlatformFromUrl,
  listAuthorProfiles,
  migrateLegacyCreatorProfileIfNeeded,
  sanitizeProfileUrl,
  saveAuthorProfile,
  setDefaultAuthorProfile,
  trySanitizeProfileUrl,
} from '../../src/core/profiles';
import { openChmDatabase, saveCreatorProfileDefaults } from '../../src/core/storage/keyStore';
import { InMemoryIdbBackend, createInMemoryIndexedDb } from '../helpers/inMemoryIndexedDb';

describe('Policy Presets & Multi-Profile Management', () => {
  const originalIdb = globalThis.indexedDB;

  beforeEach(async () => {
    const backend = new InMemoryIdbBackend();
    const idb = createInMemoryIndexedDb(backend);
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      writable: true,
      value: idb.factory,
    });
    const db = await openChmDatabase();
    db.close();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      writable: true,
      value: originalIdb,
    });
  });

  it('validates policy presets and detects all semantic contradictions', () => {
    const emptyName = validatePolicyPreset({
      name: '   ',
      licenseId: 'ARR',
      commercialUse: 'disallow',
      redistribution: 'disallow',
      aiTraining: 'disallow',
    });
    expect(emptyName.valid).toBe(false);
    expect(emptyName.errors.length).toBeGreaterThan(0);

    const cc0Warn = detectPolicyContradictions({
      licenseId: 'CC0-1.0',
      commercialUse: 'disallow',
      redistribution: 'allow',
      aiTraining: 'disallow',
    });
    expect(cc0Warn.some((w) => w.code === 'cc0-with-restriction')).toBe(true);
    expect(cc0Warn.some((w) => w.code === 'non-binding-disclosure')).toBe(true);

    const arrWarn = detectPolicyContradictions({
      licenseId: 'ARR',
      commercialUse: 'allow',
      redistribution: 'disallow',
      aiTraining: 'disallow',
    });
    expect(arrWarn.some((w) => w.code === 'arr-with-commercial-allow')).toBe(true);

    const ndWarn = detectPolicyContradictions({
      licenseId: 'CC-BY-ND-4.0',
      commercialUse: 'allow',
      redistribution: 'allow',
      aiTraining: 'unspecified',
      allowsDerivatives: 'allow',
    });
    expect(ndWarn.some((w) => w.code === 'nd-with-derivatives-allow')).toBe(true);

    const ncWarn = detectPolicyContradictions({
      licenseId: 'CC-BY-NC-4.0',
      commercialUse: 'allow',
      redistribution: 'allow',
      aiTraining: 'disallow',
    });
    expect(ncWarn.some((w) => w.code === 'nc-with-commercial-allow')).toBe(true);
  });

  it('seeds built-in policy presets, toggles defaults, increments version on edit, and tombstones on delete', async () => {
    const seeded = await ensureDefaultPolicyPresets();
    expect(seeded.length).toBe(BUILT_IN_POLICY_PRESETS.length);
    expect(seeded.some((p) => p.isDefault)).toBe(true);

    const custom = await savePolicyPreset({
      name: 'Commission Client License',
      licenseId: 'ARR',
      commercialUse: 'disallow',
      redistribution: 'disallow',
      aiTraining: 'disallow',
      allowsDerivatives: 'disallow',
      allowsModifications: 'disallow',
      requiresAttribution: true,
      customNote: 'Personal display only.',
      isDefault: true,
    });
    expect(custom.version).toBe(1);
    expect(custom.isDefault).toBe(true);

    const allAfterCustom = await listPolicyPresets();
    expect(allAfterCustom.filter((p) => p.isDefault)).toHaveLength(1);
    expect(allAfterCustom[0].id).toBe(custom.id);

    const updated = await savePolicyPreset({
      id: custom.id,
      name: custom.name,
      licenseId: 'ARR',
      commercialUse: 'disallow',
      redistribution: 'disallow',
      aiTraining: 'disallow',
      allowsDerivatives: 'disallow',
      allowsModifications: 'disallow',
      requiresAttribution: true,
      customNote: 'Updated commission terms.',
      isDefault: true,
    });
    expect(updated.version).toBe(2);

    await deletePolicyPreset(custom.id);
    expect(await getPolicyPreset(custom.id)).toBeUndefined();
  });

  it('manages multiple author profiles, sanitizes dangerous URLs, migrates v6 legacy profile, and preserves immutable snapshots', async () => {
    expect(() => sanitizeProfileUrl('javascript:alert(1)')).toThrow();
    expect(() => sanitizeProfileUrl('data:text/html,xss')).toThrow();
    expect(() => sanitizeProfileUrl('https://user:pass@example.com')).toThrow();
    expect(trySanitizeProfileUrl('example.com/artist')).toBe('https://example.com/artist');
    expect(inferSnsPlatformFromUrl('https://bsky.app/profile/yomi.bsky.social')).toBe('bluesky');
    expect(inferSnsPlatformFromUrl('https://skeb.jp/@yomi')).toBe('skeb');

    const p1 = await saveAuthorProfile({
      profileName: 'Main Commercial Pen Name',
      displayName: 'Yomi Studio',
      website: 'https://certified-handmade.com',
      snsLinks: [
        { url: 'https://x.com/yomi_art', platform: 'x', label: '@yomi_art' },
        { url: 'https://www.pixiv.net/users/42', platform: 'pixiv' },
      ],
      portfolioLinks: [{ url: 'https://vgen.co/yomi', label: 'Commissions' }],
      isDefault: true,
    });

    const p2 = await saveAuthorProfile({
      profileName: 'Sketch Alt Persona',
      displayName: 'Yomi Sketches',
      website: 'https://sketches.example.com',
      snsLinks: [{ url: 'https://bsky.app/profile/yomisketch.bsky.social', platform: 'bluesky' }],
      isDefault: false,
    });

    const list1 = await listAuthorProfiles();
    expect(list1.map((p) => p.id)).toEqual([p1.id, p2.id]);

    // Snapshot captured at signing time
    const snapshot = buildAuthorProfileSnapshot(p1);
    expect(snapshot.displayName).toBe('Yomi Studio');
    expect(snapshot.snsLinks).toHaveLength(2);

    // Edit & delete p1 -> previously captured snapshot remains immutable!
    await saveAuthorProfile({
      id: p1.id,
      profileName: p1.profileName,
      displayName: 'Renamed Brand',
      website: 'https://newbrand.example.com',
      snsLinks: [],
      isDefault: true,
    });
    expect(snapshot.displayName).toBe('Yomi Studio');
    expect(snapshot.website).toBe('https://certified-handmade.com/');
    expect(snapshot.snsLinks).toHaveLength(2);

    await setDefaultAuthorProfile(p2.id);
    const updatedP2 = await getAuthorProfile(p2.id);
    expect(updatedP2?.isDefault).toBe(true);

    await deleteAuthorProfile(p1.id);
    expect(await getAuthorProfile(p1.id)).toBeUndefined();
    expect(snapshot.displayName).toBe('Yomi Studio');
  });

  it('migrates legacy v6 creatorProfile default record non-destructively when no v2 profiles exist', async () => {
    await saveCreatorProfileDefaults({
      displayName: 'Legacy Artist',
      website: 'https://legacy.example.com',
      links: [{ label: 'Pixiv', url: 'https://www.pixiv.net/users/999' }],
    });

    const migrated = await migrateLegacyCreatorProfileIfNeeded();
    expect(migrated).toBeDefined();
    expect(migrated?.schemaVersion).toBe(2);
    expect(migrated?.displayName).toBe('Legacy Artist');
    expect(migrated?.snsLinks[0]?.platform).toBe('pixiv');
  });
});

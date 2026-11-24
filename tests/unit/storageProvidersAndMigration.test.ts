// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSignedArtworkPng } from '../../src/core/manifest/signArtwork';
import { savePolicyPreset } from '../../src/core/policies';
import { saveAuthorProfile } from '../../src/core/profiles';
import {
  CHM_DB_VERSION,
  STORE_AUTHOR_KEYS,
  STORE_CREATOR_PROFILES,
  STORE_POLICY_PRESETS,
  STORE_PROOF_VAULT,
  STORE_STORAGE_STATE,
  STORE_VAULT_TOMBSTONES,
  createAuthorKey,
  openChmDatabase,
} from '../../src/core/storage/keyStore';
import {
  IndexedDbStorageProvider,
  PortableFileStorageProvider,
  StorageProviderRegistry,
} from '../../src/core/storage/providers';
import { loadVaultSettings, saveProofToVault, saveVaultSettings } from '../../src/core/vault';
import { InMemoryIdbBackend, createInMemoryIndexedDb } from '../helpers/inMemoryIndexedDb';

function makeMinimalRaster(w = 64, h = 64) {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = (i * 11) & 0xff;
    data[i * 4 + 1] = (i * 17) & 0xff;
    data[i * 4 + 2] = (i * 29) & 0xff;
    data[i * 4 + 3] = 255;
  }
  return { width: w, height: h, data };
}

describe('Pluggable Storage Providers & IndexedDB v6 -> v7 Migration', () => {
  const originalIdb = globalThis.indexedDB;
  let setBackend: (b: InMemoryIdbBackend) => void;

  beforeEach(async () => {
    const backend = new InMemoryIdbBackend();
    const idb = createInMemoryIndexedDb(backend);
    setBackend = idb.setBackend;
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

  it('upgrades a simulated v6 database to v7 preserving legacy records and adding new stores', async () => {
    const legacyBackend = new InMemoryIdbBackend();
    legacyBackend.version = 6;
    legacyBackend.stores.set(STORE_AUTHOR_KEYS, {
      keyPath: 'id',
      rows: new Map([['k1', { id: 'k1', label: 'Legacy Key' }]]),
    });
    legacyBackend.stores.set(STORE_PROOF_VAULT, {
      keyPath: 'id',
      rows: new Map([['p1', { id: 'p1', artworkTitle: 'Legacy Painting' }]]),
    });
    legacyBackend.stores.set(STORE_CREATOR_PROFILES, {
      keyPath: 'id',
      rows: new Map([['default', { id: 'default', displayName: 'Legacy Creator' }]]),
    });
    setBackend(legacyBackend);

    const db = await openChmDatabase();
    try {
      expect(legacyBackend.version).toBe(CHM_DB_VERSION);
      expect(db.objectStoreNames.contains(STORE_POLICY_PRESETS)).toBe(true);
      expect(db.objectStoreNames.contains(STORE_STORAGE_STATE)).toBe(true);
      expect(db.objectStoreNames.contains(STORE_VAULT_TOMBSTONES)).toBe(true);
      expect(legacyBackend.stores.get(STORE_AUTHOR_KEYS)?.rows.get('k1')).toBeTruthy();
      expect(legacyBackend.stores.get(STORE_PROOF_VAULT)?.rows.get('p1')).toBeTruthy();
      expect(legacyBackend.stores.get(STORE_CREATOR_PROFILES)?.rows.get('default')).toBeTruthy();
    } finally {
      db.close();
    }
  });

  it('exports and imports encrypted .chmvault.json snapshots with profiles, policy presets, settings, and proofs', async () => {
    const idbProvider = new IndexedDbStorageProvider();
    const portableProvider = new PortableFileStorageProvider();
    const registry = new StorageProviderRegistry([idbProvider, portableProvider]);
    expect(registry.list()).toHaveLength(2);
    expect(registry.get('indexeddb')).toBe(idbProvider);

    const { record: key } = await createAuthorKey({ label: 'Studio Key' });
    const signed = await createSignedArtworkPng({
      artworkRaster: makeMinimalRaster(),
      authorKey: key,
      license: {
        licenseId: 'ARR',
        commercialUse: 'disallow',
        redistribution: 'disallow',
        aiTraining: 'disallow',
      },
      burnOptions: {
        placement: 'bottom-right',
        theme: 'dark-slate',
        marginPx: 8,
      },
      artworkTitle: 'Cloudless Sunset',
      authorName: 'Mina',
    });

    await saveProofToVault({
      proofInput: signed.proofBytes,
      creationMethod: 'hand-drawn-no-ai',
    });
    const profile = await saveAuthorProfile({
      profileName: 'Illustration Brand',
      displayName: 'Mina Illust',
      website: 'https://mina.example.com',
      isDefault: true,
    });
    const preset = await savePolicyPreset({
      name: 'Strict No-AI',
      licenseId: 'ARR',
      commercialUse: 'disallow',
      redistribution: 'disallow',
      aiTraining: 'disallow',
      isDefault: true,
    });
    await saveVaultSettings({ preferredQrMode: 'visible' });

    const idbStatus = await idbProvider.getStatus();
    expect(idbStatus.active).toBe(true);
    expect(idbStatus.detail).toContain('1 local proofs');

    const encrypted = await portableProvider.exportEncryptedSnapshot('vault-portable-pass-2026');
    expect(encrypted.proofCount).toBe(1);

    // Switch to clean device IDB
    setBackend(new InMemoryIdbBackend());
    const freshDb = await openChmDatabase();
    freshDb.close();

    // Wrong passphrase must fail
    await expect(
      portableProvider.importEncryptedSnapshot(encrypted, 'wrong-passphrase-123'),
    ).rejects.toThrow();

    // Correct passphrase restores everything
    const imported = await portableProvider.importEncryptedSnapshot(
      JSON.stringify(encrypted),
      'vault-portable-pass-2026',
    );
    expect(imported.importedProofs).toBe(1);
    expect(imported.importedProfiles).toBe(1);
    expect(imported.importedPresets).toBe(1);
    expect(imported.restoredSettings).toBe(true);

    const restoredSettings = await loadVaultSettings();
    expect(restoredSettings.preferredQrMode).toBe('visible');
    expect(profile.id).toBeTruthy();
    expect(preset.id).toBeTruthy();
  });
});

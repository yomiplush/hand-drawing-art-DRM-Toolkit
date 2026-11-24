import { base64UrlEncode, bytesToHex, sha256Sync } from '../crypto/sha256';
import type { CreatorProfileLink, PolicySignal } from '../manifest/types';
import type { VaultTombstoneRecord } from '../policies/policyStore';
import {
  type CreatorProfileDefaultsRecord,
  STORE_CREATOR_PROFILES,
  STORE_VAULT_TOMBSTONES,
  runChmTransaction,
  withChmStore,
} from '../storage/keyStore';
import {
  type AuthorProfile,
  type AuthorProfileInput,
  type AuthorProfilePublicSnapshot,
  type AuthorSnsLink,
  SNS_PLATFORM_PRESETS,
  type SnsPlatformId,
} from './types';

const utf8Encoder = new TextEncoder();
const VALID_PLATFORMS = new Set<SnsPlatformId>(SNS_PLATFORM_PRESETS.map((p) => p.id));
const VALID_AI_SIGNALS = new Set<PolicySignal>(['unspecified', 'allow', 'disallow']);
export const MAX_PROFILE_LINKS = 12;

function hasControlChars(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

export function sanitizeProfileUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error('URL cannot be empty');
  }
  if (trimmed.length > 512) {
    throw new Error('URL exceeds maximum 512 characters');
  }
  if (hasControlChars(trimmed)) {
    throw new Error('URL contains disallowed control characters');
  }
  let candidate = trimmed;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(`Invalid URL: ${trimmed}`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only http:// and https:// URLs are permitted');
  }
  if (parsed.username || parsed.password) {
    throw new Error('URLs must not include embedded credentials');
  }
  return parsed.toString();
}

export function trySanitizeProfileUrl(rawUrl: string | undefined): string | undefined {
  if (!rawUrl || !rawUrl.trim()) return undefined;
  try {
    return sanitizeProfileUrl(rawUrl);
  } catch {
    return undefined;
  }
}

export function inferSnsPlatformFromUrl(url: string): SnsPlatformId {
  const lower = url.toLowerCase();
  if (lower.includes('x.com/') || lower.includes('twitter.com/')) return 'x';
  if (lower.includes('bsky.app/')) return 'bluesky';
  if (lower.includes('pixiv.net/')) return 'pixiv';
  if (lower.includes('skeb.jp/')) return 'skeb';
  if (lower.includes('booth.pm/')) return 'booth';
  if (lower.includes('vgen.co/')) return 'vgen';
  if (lower.includes('mastodon')) return 'mastodon';
  if (lower.includes('misskey')) return 'misskey';
  if (lower.includes('njump.me/') || lower.includes('snort.social/') || lower.includes('primal.net/')) {
    return 'nostr';
  }
  if (lower.includes('furaffinity.net/')) return 'furaffinity';
  if (lower.includes('deviantart.com/')) return 'deviantart';
  if (lower.includes('tumblr.com')) return 'tumblr';
  if (lower.includes('instagram.com/')) return 'instagram';
  if (lower.includes('youtube.com/') || lower.includes('youtu.be/')) return 'youtube';
  if (lower.includes('github.com/')) return 'github';
  return 'custom';
}

function normalizeSnsLinks(links: AuthorSnsLink[] | undefined): AuthorSnsLink[] {
  if (!Array.isArray(links)) return [];
  const seen = new Set<string>();
  const out: AuthorSnsLink[] = [];
  for (const item of links) {
    if (!item || typeof item.url !== 'string' || !item.url.trim()) continue;
    const cleanUrl = sanitizeProfileUrl(item.url);
    const dedupKey = cleanUrl.toLowerCase();
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    const platform =
      item.platform && VALID_PLATFORMS.has(item.platform)
        ? item.platform
        : inferSnsPlatformFromUrl(cleanUrl);
    const cleanLabel = item.label?.trim().slice(0, 32) || undefined;
    out.push({
      url: cleanUrl,
      platform,
      ...(cleanLabel ? { label: cleanLabel } : {}),
    });
    if (out.length >= MAX_PROFILE_LINKS) break;
  }
  return out;
}

function normalizePortfolioLinks(links: CreatorProfileLink[] | undefined): CreatorProfileLink[] {
  if (!Array.isArray(links)) return [];
  const seen = new Set<string>();
  const out: CreatorProfileLink[] = [];
  for (const item of links) {
    if (!item || typeof item.url !== 'string' || !item.url.trim()) continue;
    const cleanUrl = sanitizeProfileUrl(item.url);
    const dedupKey = cleanUrl.toLowerCase();
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    const cleanLabel = item.label?.trim().slice(0, 32) || undefined;
    out.push({
      url: cleanUrl,
      ...(cleanLabel ? { label: cleanLabel } : {}),
    });
    if (out.length >= MAX_PROFILE_LINKS) break;
  }
  return out;
}

function computeProfileHash(profile: Omit<AuthorProfile, 'version' | 'contentHash' | 'createdAt' | 'updatedAt'>): string {
  const canonical = JSON.stringify({
    id: profile.id,
    profileName: profile.profileName,
    displayName: profile.displayName,
    website: profile.website,
    snsLinks: profile.snsLinks,
    portfolioLinks: profile.portfolioLinks,
    publicNote: profile.publicNote,
    defaultLicenseId: profile.defaultLicenseId,
    defaultPolicyPresetId: profile.defaultPolicyPresetId,
    defaultAiTraining: profile.defaultAiTraining,
    isDefault: profile.isDefault,
  });
  return bytesToHex(sha256Sync(utf8Encoder.encode(canonical)));
}

function generateProfileId(): string {
  const bytes = new Uint8Array(10);
  globalThis.crypto.getRandomValues(bytes);
  return `profile-${base64UrlEncode(bytes)}`;
}

export function buildAuthorProfileRecord(
  input: AuthorProfileInput,
  existing?: AuthorProfile,
): AuthorProfile {
  const displayName = input.displayName.trim().slice(0, 48);
  if (!displayName) {
    throw new Error('Author display name is required');
  }
  if (hasControlChars(displayName)) {
    throw new Error('Author display name contains disallowed control characters');
  }
  const profileName = (input.profileName || displayName).trim().slice(0, 64);
  if (hasControlChars(profileName)) {
    throw new Error('Profile label contains disallowed control characters');
  }
  const website = input.website?.trim() ? sanitizeProfileUrl(input.website) : undefined;
  const snsLinks = normalizeSnsLinks(input.snsLinks);
  const portfolioLinks = normalizePortfolioLinks(input.portfolioLinks);
  const publicNote = input.publicNote?.trim() ? input.publicNote.trim().slice(0, 240) : undefined;
  const defaultAiTraining =
    input.defaultAiTraining && VALID_AI_SIGNALS.has(input.defaultAiTraining)
      ? input.defaultAiTraining
      : undefined;

  const id = input.id?.trim() || existing?.id || generateProfileId();
  if (id === 'default') {
    throw new Error('Reserved legacy profile ID cannot be used for v2 profiles');
  }

  const base = {
    id,
    schemaVersion: 2 as const,
    profileName,
    displayName,
    ...(website ? { website } : {}),
    snsLinks,
    portfolioLinks,
    ...(publicNote ? { publicNote } : {}),
    ...(input.defaultLicenseId ? { defaultLicenseId: input.defaultLicenseId } : {}),
    ...(input.defaultPolicyPresetId?.trim()
      ? { defaultPolicyPresetId: input.defaultPolicyPresetId.trim().slice(0, 64) }
      : {}),
    ...(defaultAiTraining ? { defaultAiTraining } : {}),
    isDefault: Boolean(input.isDefault),
  };

  const contentHash = computeProfileHash(base);
  const now = new Date().toISOString();
  const version = existing
    ? existing.contentHash === contentHash
      ? existing.version
      : existing.version + 1
    : 1;

  return {
    ...base,
    version,
    contentHash,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function buildAuthorProfileSnapshot(profile: {
  id?: string;
  displayName: string;
  website?: string;
  snsLinks?: AuthorSnsLink[];
  portfolioLinks?: CreatorProfileLink[];
  publicNote?: string;
}): AuthorProfilePublicSnapshot {
  const displayName = profile.displayName.trim().slice(0, 48);
  return {
    ...(profile.id ? { profileId: profile.id } : {}),
    displayName,
    ...(profile.website ? { website: trySanitizeProfileUrl(profile.website) } : {}),
    snsLinks: (profile.snsLinks ?? [])
      .map((l) => {
        const cleanUrl = trySanitizeProfileUrl(l.url);
        if (!cleanUrl) return null;
        const entry: AuthorSnsLink = {
          url: cleanUrl,
          platform: l.platform ?? inferSnsPlatformFromUrl(cleanUrl),
          ...(l.label?.trim() ? { label: l.label.trim().slice(0, 32) } : {}),
        };
        return entry;
      })
      .filter((x): x is AuthorSnsLink => x !== null),
    portfolioLinks: (profile.portfolioLinks ?? [])
      .map((l) => {
        const cleanUrl = trySanitizeProfileUrl(l.url);
        if (!cleanUrl) return null;
        return {
          url: cleanUrl,
          ...(l.label?.trim() ? { label: l.label.trim().slice(0, 32) } : {}),
        };
      })
      .filter((x): x is CreatorProfileLink => x !== null),
    ...(profile.publicNote?.trim() ? { publicNote: profile.publicNote.trim().slice(0, 240) } : {}),
    capturedAt: new Date().toISOString(),
  };
}

function isV2AuthorProfile(row: unknown): row is AuthorProfile {
  return (
    Boolean(row) &&
    typeof row === 'object' &&
    (row as AuthorProfile).schemaVersion === 2 &&
    typeof (row as AuthorProfile).id === 'string' &&
    (row as AuthorProfile).id !== 'default'
  );
}

export async function listAuthorProfiles(): Promise<AuthorProfile[]> {
  try {
    const rows = await withChmStore<unknown[]>(STORE_CREATOR_PROFILES, 'readonly', (s) =>
      s.getAll(),
    );
    return (rows ?? [])
      .filter(isV2AuthorProfile)
      .sort((a, b) => {
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        return a.profileName.localeCompare(b.profileName);
      });
  } catch {
    return [];
  }
}

export async function getAuthorProfile(id: string): Promise<AuthorProfile | undefined> {
  try {
    const row = await withChmStore<unknown>(STORE_CREATOR_PROFILES, 'readonly', (s) => s.get(id));
    return isV2AuthorProfile(row) ? row : undefined;
  } catch {
    return undefined;
  }
}

export async function saveAuthorProfile(input: AuthorProfileInput): Promise<AuthorProfile> {
  const existing = input.id ? await getAuthorProfile(input.id) : undefined;
  const all = await listAuthorProfiles();
  const isDefault = input.isDefault ?? (all.length === 0 || existing?.isDefault === true);
  const record = buildAuthorProfileRecord({ ...input, isDefault }, existing);

  await runChmTransaction([STORE_CREATOR_PROFILES, STORE_VAULT_TOMBSTONES], 'readwrite', (tx) => {
    const store = tx.objectStore(STORE_CREATOR_PROFILES);
    const tombStore = tx.objectStore(STORE_VAULT_TOMBSTONES);
    if (record.isDefault) {
      for (const other of all) {
        if (other.id !== record.id && other.isDefault) {
          store.put({
            ...other,
            isDefault: false,
            version: other.version + 1,
            updatedAt: record.updatedAt,
          });
        }
      }
    }
    store.put(record);
    tombStore.delete(`profile:${record.id}`);
  });

  return record;
}

export async function setDefaultAuthorProfile(id: string): Promise<AuthorProfile | undefined> {
  const target = await getAuthorProfile(id);
  if (!target) return undefined;
  return saveAuthorProfile({
    id: target.id,
    profileName: target.profileName,
    displayName: target.displayName,
    website: target.website,
    snsLinks: target.snsLinks,
    portfolioLinks: target.portfolioLinks,
    publicNote: target.publicNote,
    defaultLicenseId: target.defaultLicenseId,
    defaultPolicyPresetId: target.defaultPolicyPresetId,
    defaultAiTraining: target.defaultAiTraining,
    isDefault: true,
  });
}

export async function deleteAuthorProfile(id: string): Promise<void> {
  const existing = await getAuthorProfile(id);
  const deletedAt = new Date().toISOString();
  await runChmTransaction([STORE_CREATOR_PROFILES, STORE_VAULT_TOMBSTONES], 'readwrite', (tx) => {
    tx.objectStore(STORE_CREATOR_PROFILES).delete(id);
    const tombstone: VaultTombstoneRecord = {
      id: `profile:${id}`,
      entityType: 'profile',
      entityId: id,
      deletedAt,
      version: (existing?.version ?? 0) + 1,
    };
    tx.objectStore(STORE_VAULT_TOMBSTONES).put(tombstone);
  });
}

export async function upsertAuthorProfilesBatch(profiles: AuthorProfile[]): Promise<void> {
  if (profiles.length === 0) return;
  await runChmTransaction([STORE_CREATOR_PROFILES], 'readwrite', (tx) => {
    const store = tx.objectStore(STORE_CREATOR_PROFILES);
    for (const p of profiles) {
      if (isV2AuthorProfile(p)) {
        store.put(p);
      }
    }
  });
}

/**
 * Safely migrates a legacy v6 `'default'` creatorProfile record (if present) into a v2
 * AuthorProfile without deleting or mutating the legacy record.
 */
export async function migrateLegacyCreatorProfileIfNeeded(): Promise<AuthorProfile | undefined> {
  const existing = await listAuthorProfiles();
  if (existing.length > 0) {
    return existing.find((p) => p.isDefault) ?? existing[0];
  }
  try {
    const legacy = await withChmStore<CreatorProfileDefaultsRecord | undefined>(
      STORE_CREATOR_PROFILES,
      'readonly',
      (s) => s.get('default'),
    );
    if (
      !legacy ||
      (!legacy.displayName?.trim() && !legacy.website?.trim() && !(legacy.links && legacy.links.length > 0))
    ) {
      return undefined;
    }

    const snsLinks: AuthorSnsLink[] = [];
    for (const link of legacy.links ?? []) {
      const clean = trySanitizeProfileUrl(link.url);
      if (!clean) continue;
      snsLinks.push({
        url: clean,
        platform: inferSnsPlatformFromUrl(clean),
        ...(link.label?.trim() ? { label: link.label.trim().slice(0, 32) } : {}),
      });
    }

    return await saveAuthorProfile({
      id: 'profile-default',
      profileName: legacy.displayName?.trim() || 'Default Profile',
      displayName: legacy.displayName?.trim() || 'Artist',
      website: trySanitizeProfileUrl(legacy.website),
      snsLinks,
      isDefault: true,
    });
  } catch {
    return undefined;
  }
}

import {
  GALLERY_DECK_CATALOG_VERSION,
  createEmptyCatalog,
} from '../../types/gallerydeck';
import type {
  GalleryArtworkItem,
  GalleryDeckArchive,
  GalleryDeckCatalog,
  GalleryProvenanceStatus,
  GalleryQrMode,
} from '../../types/gallerydeck';

const VALID_PROVENANCE_STATUSES = new Set<GalleryProvenanceStatus>([
  'unverified',
  'signed',
  'invalid',
]);

const VALID_QR_MODES = new Set<GalleryQrMode>(['none', 'outer-border', 'in-image-mask']);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeString(value: unknown, maxLen = 256): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value.trim().slice(0, maxLen);
}

function sanitizeStringArray(value: unknown, maxItems = 32): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim().slice(0, 64);
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= maxItems) break;
  }
  return out;
}

export function validateArtworkItem(raw: unknown): GalleryArtworkItem | null {
  if (!isPlainRecord(raw)) return null;
  const id = sanitizeString(raw.id, 128);
  const title = sanitizeString(raw.title, 160);
  if (!id || !title) return null;

  const createdAt = typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now();
  const importedAt = typeof raw.importedAt === 'number' && Number.isFinite(raw.importedAt) ? raw.importedAt : createdAt;
  const updatedAt = typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? raw.updatedAt : importedAt;
  const width = typeof raw.width === 'number' && raw.width > 0 ? Math.round(raw.width) : 1;
  const height = typeof raw.height === 'number' && raw.height > 0 ? Math.round(raw.height) : 1;
  const fileSizeBytes = typeof raw.fileSizeBytes === 'number' && raw.fileSizeBytes >= 0 ? Math.round(raw.fileSizeBytes) : 0;
  const mimeType = sanitizeString(raw.mimeType, 64) || 'image/png';
  const thumbnailDataUrl =
    typeof raw.thumbnailDataUrl === 'string' && raw.thumbnailDataUrl.startsWith('data:image/')
      ? raw.thumbnailDataUrl
      : '';

  const provenanceStatus: GalleryProvenanceStatus =
    typeof raw.provenanceStatus === 'string' &&
    VALID_PROVENANCE_STATUSES.has(raw.provenanceStatus as GalleryProvenanceStatus)
      ? (raw.provenanceStatus as GalleryProvenanceStatus)
      : 'unverified';

  const qrMode: GalleryQrMode =
    typeof raw.qrMode === 'string' && VALID_QR_MODES.has(raw.qrMode as GalleryQrMode)
      ? (raw.qrMode as GalleryQrMode)
      : 'none';

  return {
    id,
    title,
    authorName: sanitizeString(raw.authorName, 96),
    createdAt,
    importedAt,
    updatedAt,
    width,
    height,
    mimeType,
    fileSizeBytes,
    thumbnailDataUrl,
    blobRef: sanitizeString(raw.blobRef, 160),
    provenanceStatus,
    qrMode,
    publicKeyFingerprint: sanitizeString(raw.publicKeyFingerprint, 128),
    artworkSha256Hex: sanitizeString(raw.artworkSha256Hex, 128),
    licenseId: sanitizeString(raw.licenseId, 32) as GalleryArtworkItem['licenseId'],
    tags: sanitizeStringArray(raw.tags, 24),
    collections: sanitizeStringArray(raw.collections, 16),
    proofToken: typeof raw.proofToken === 'string' ? raw.proofToken.slice(0, 8192) : undefined,
    proofUrl: typeof raw.proofUrl === 'string' ? raw.proofUrl.slice(0, 8192) : undefined,
    verifiedAt: typeof raw.verifiedAt === 'number' && Number.isFinite(raw.verifiedAt) ? raw.verifiedAt : undefined,
    verificationSummary: sanitizeString(raw.verificationSummary, 240),
    deleted: raw.deleted === true ? true : undefined,
  };
}

export function validateCatalog(raw: unknown): GalleryDeckCatalog {
  if (!isPlainRecord(raw)) {
    throw new Error('Invalid GalleryDeck catalog format');
  }
  if (raw.version !== GALLERY_DECK_CATALOG_VERSION) {
    throw new Error(`Unsupported GalleryDeck catalog version: ${String(raw.version)}`);
  }

  const base = createEmptyCatalog(sanitizeString(raw.deviceId, 64) || 'local-deck');
  const updatedAt =
    typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt)
      ? raw.updatedAt
      : Date.now();
  const collections = sanitizeStringArray(raw.collections, 32);
  const itemsRaw = Array.isArray(raw.items) ? raw.items : [];
  const items: GalleryArtworkItem[] = [];
  const seenIds = new Set<string>();

  for (const entry of itemsRaw) {
    const validated = validateArtworkItem(entry);
    if (!validated || seenIds.has(validated.id)) continue;
    seenIds.add(validated.id);
    items.push(validated);
  }

  return {
    version: GALLERY_DECK_CATALOG_VERSION,
    updatedAt,
    deviceId: base.deviceId,
    collections: collections.length > 0 ? collections : base.collections,
    items,
  };
}

/**
 * Deterministic timestamp-based merge between local and remote catalogs.
 * Newest `updatedAt` wins per artwork ID; local `blobRef` is preserved if remote lacks one.
 */
export function mergeCatalogs(
  local: GalleryDeckCatalog,
  remote: GalleryDeckCatalog,
): GalleryDeckCatalog {
  const mergedMap = new Map<string, GalleryArtworkItem>();

  for (const item of local.items) {
    mergedMap.set(item.id, item);
  }

  for (const remoteItem of remote.items) {
    const existing = mergedMap.get(remoteItem.id);
    if (!existing) {
      mergedMap.set(remoteItem.id, remoteItem);
      continue;
    }

    if (remoteItem.updatedAt > existing.updatedAt) {
      mergedMap.set(remoteItem.id, {
        ...remoteItem,
        blobRef: remoteItem.blobRef ?? existing.blobRef,
        thumbnailDataUrl: remoteItem.thumbnailDataUrl || existing.thumbnailDataUrl,
      });
    } else if (existing.updatedAt === remoteItem.updatedAt) {
      // Tie-breaker: prefer signed provenance over unverified
      if (remoteItem.provenanceStatus === 'signed' && existing.provenanceStatus !== 'signed') {
        mergedMap.set(remoteItem.id, {
          ...remoteItem,
          blobRef: remoteItem.blobRef ?? existing.blobRef,
          thumbnailDataUrl: remoteItem.thumbnailDataUrl || existing.thumbnailDataUrl,
        });
      }
    }
  }

  const collectionSet = new Set<string>([...local.collections, ...remote.collections]);
  const items = Array.from(mergedMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);

  return {
    version: GALLERY_DECK_CATALOG_VERSION,
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
    deviceId: local.deviceId,
    collections: Array.from(collectionSet),
    items,
  };
}

export function serializeChdeckArchive(
  catalog: GalleryDeckCatalog,
  assets?: Record<string, { mimeType: string; base64: string }>,
): string {
  const archive: GalleryDeckArchive = {
    format: 'chdeck-v1',
    exportedAt: Date.now(),
    catalog,
    ...(assets && Object.keys(assets).length > 0 ? { assets } : {}),
  };
  return JSON.stringify(archive, null, 2);
}

export function parseChdeckArchive(rawJson: string): GalleryDeckArchive {
  const parsed = JSON.parse(rawJson) as unknown;
  if (!isPlainRecord(parsed)) {
    throw new Error('Invalid .chdeck archive file');
  }
  // Support importing either a full .chdeck archive or a plain gallerydeck-catalog.json
  if (parsed.format === 'chdeck-v1' && parsed.catalog) {
    const catalog = validateCatalog(parsed.catalog);
    const assets: Record<string, { mimeType: string; base64: string }> = {};
    if (isPlainRecord(parsed.assets)) {
      for (const [key, val] of Object.entries(parsed.assets)) {
        if (
          isPlainRecord(val) &&
          typeof val.mimeType === 'string' &&
          typeof val.base64 === 'string'
        ) {
          assets[key] = { mimeType: val.mimeType, base64: val.base64 };
        }
      }
    }
    return {
      format: 'chdeck-v1',
      exportedAt: typeof parsed.exportedAt === 'number' ? parsed.exportedAt : Date.now(),
      catalog,
      assets,
    };
  }

  const catalog = validateCatalog(parsed);
  return {
    format: 'chdeck-v1',
    exportedAt: Date.now(),
    catalog,
  };
}

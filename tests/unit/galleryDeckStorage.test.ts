import { describe, expect, it } from 'vitest';
import {
  IndexedDbGalleryAdapter,
  mergeCatalogs,
  parseChdeckArchive,
  sanitizeCatalogForCloudSync,
  serializeChdeckArchive,
  syncGalleryAdapters,
  validateCatalog,
} from '../../src/services/galleryStorage';
import type { StorageAdapter } from '../../src/services/galleryStorage';
import { createEmptyCatalog } from '../../src/types/gallerydeck';
import type { GalleryArtworkItem, GalleryDeckCatalog } from '../../src/types/gallerydeck';

function makeItem(overrides: Partial<GalleryArtworkItem> = {}): GalleryArtworkItem {
  const now = 1_700_000_000_000;
  return {
    id: overrides.id ?? 'art-1',
    title: overrides.title ?? 'Sunset Sketch',
    createdAt: overrides.createdAt ?? now,
    importedAt: overrides.importedAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    width: overrides.width ?? 640,
    height: overrides.height ?? 480,
    mimeType: overrides.mimeType ?? 'image/png',
    fileSizeBytes: overrides.fileSizeBytes ?? 12345,
    thumbnailDataUrl: overrides.thumbnailDataUrl ?? 'data:image/png;base64,iVBORw0KGgo=',
    blobRef: overrides.blobRef,
    provenanceStatus: overrides.provenanceStatus ?? 'unverified',
    qrMode: overrides.qrMode ?? 'none',
    publicKeyFingerprint: overrides.publicKeyFingerprint,
    artworkSha256Hex: overrides.artworkSha256Hex,
    licenseId: overrides.licenseId,
    tags: overrides.tags ?? ['sketch'],
    collections: overrides.collections ?? ['Favorites'],
    proofToken: overrides.proofToken,
    proofUrl: overrides.proofUrl,
    deleted: overrides.deleted,
  };
}

describe('GalleryDeck catalog serialization & merge', () => {
  it('validates and round-trips a .chdeck archive with assets', () => {
    const catalog: GalleryDeckCatalog = {
      ...createEmptyCatalog('deck-a'),
      items: [
        makeItem({
          id: 'art-1',
          provenanceStatus: 'signed',
          qrMode: 'outer-border',
          licenseId: 'CC-BY-4.0',
          publicKeyFingerprint: 'ABCD-1234',
        }),
      ],
    };

    const json = serializeChdeckArchive(catalog, {
      'art-1': { mimeType: 'image/png', base64: 'AQID' },
    });
    const parsed = parseChdeckArchive(json);

    expect(parsed.format).toBe('chdeck-v1');
    expect(parsed.catalog.version).toBe(1);
    expect(parsed.catalog.items).toHaveLength(1);
    expect(parsed.catalog.items[0].provenanceStatus).toBe('signed');
    expect(parsed.catalog.items[0].licenseId).toBe('CC-BY-4.0');
    expect(parsed.assets?.['art-1']?.base64).toBe('AQID');
  });

  it('rejects unsupported catalog versions', () => {
    expect(() => validateCatalog({ version: 99, items: [] })).toThrow(
      /Unsupported GalleryDeck catalog version/,
    );
  });

  it('resolves conflicts by newest updatedAt while preserving local blobRef', () => {
    const local: GalleryDeckCatalog = {
      ...createEmptyCatalog('deck-local'),
      updatedAt: 1000,
      collections: ['Favorites'],
      items: [
        makeItem({
          id: 'art-1',
          title: 'Old Title',
          updatedAt: 1000,
          blobRef: 'blob:art-1',
          provenanceStatus: 'unverified',
        }),
        makeItem({
          id: 'art-local-only',
          title: 'Local Only',
          updatedAt: 1200,
        }),
      ],
    };

    const remote: GalleryDeckCatalog = {
      ...createEmptyCatalog('deck-remote'),
      updatedAt: 2000,
      collections: ['Commissions'],
      items: [
        makeItem({
          id: 'art-1',
          title: 'Certified Title',
          updatedAt: 2000,
          provenanceStatus: 'signed',
          qrMode: 'outer-border',
          licenseId: 'ARR',
        }),
        makeItem({
          id: 'art-remote-only',
          title: 'Remote Only',
          updatedAt: 1800,
        }),
      ],
    };

    const merged = mergeCatalogs(local, remote);
    expect(merged.updatedAt).toBe(2000);
    expect(merged.collections).toEqual(expect.arrayContaining(['Favorites', 'Commissions']));
    expect(merged.items).toHaveLength(3);

    const art1 = merged.items.find((i) => i.id === 'art-1');
    expect(art1?.title).toBe('Certified Title');
    expect(art1?.provenanceStatus).toBe('signed');
    expect(art1?.blobRef).toBe('blob:art-1');
  });

  it('syncs across multiple storage adapters and tolerates partial adapter failure', async () => {
    const idb = new IndexedDbGalleryAdapter();
    let savedFsCatalog: GalleryDeckCatalog | null = null;

    const mockFsAdapter: StorageAdapter = {
      tier: 'filesystem',
      isAvailable: () => true,
      loadCatalog: async () => ({
        ...createEmptyCatalog('fs-device'),
        updatedAt: 3000,
        items: [makeItem({ id: 'from-fs', title: 'From Disk', updatedAt: 3000 })],
      }),
      saveCatalog: async (cat) => {
        savedFsCatalog = cat;
      },
    };

    const failingDriveAdapter: StorageAdapter = {
      tier: 'gdrive',
      isAvailable: () => true,
      loadCatalog: async () => {
        throw new Error('Network offline');
      },
      saveCatalog: async () => {
        throw new Error('Network offline');
      },
    };

    const local: GalleryDeckCatalog = {
      ...createEmptyCatalog('local'),
      updatedAt: 2500,
      items: [makeItem({ id: 'from-local', title: 'From Local', updatedAt: 2500 })],
    };

    const result = await syncGalleryAdapters(local, [idb, mockFsAdapter, failingDriveAdapter]);
    expect(result.catalog.items.map((i) => i.id)).toEqual(['from-fs', 'from-local']);
    expect(result.syncedTiers).toEqual(['indexeddb', 'filesystem']);
    expect(result.errors.some((e) => e.tier === 'gdrive')).toBe(true);
    expect(savedFsCatalog).not.toBeNull();
  });

  it('strips all artwork thumbnails and blobRefs before Google Drive cloud sync', () => {
    const catalog: GalleryDeckCatalog = {
      ...createEmptyCatalog('local'),
      items: [
        makeItem({
          id: 'art-secret',
          title: 'Private Sketch',
          thumbnailDataUrl: 'data:image/png;base64,SECRET_PIXELS',
          blobRef: 'blob:art-secret',
          provenanceStatus: 'signed',
          proofUrl: 'https://certified-handmade.com/verify#proof=abc',
        }),
      ],
    };

    const cloudSafe = sanitizeCatalogForCloudSync(catalog);
    expect(cloudSafe.items[0].thumbnailDataUrl).toBe('');
    expect(cloudSafe.items[0].blobRef).toBeUndefined();
    expect(cloudSafe.items[0].title).toBe('Private Sketch');
    expect(cloudSafe.items[0].proofUrl).toBe('https://certified-handmade.com/verify#proof=abc');
  });
});

import { createEmptyCatalog } from '../../types/gallerydeck';
import type {
  GalleryDeckCatalog,
  StorageAdapter,
} from '../../types/gallerydeck';
import { mergeCatalogs } from './catalogMerge';
import { IndexedDbGalleryAdapter } from './indexedDbAdapter';

export {
  mergeCatalogs,
  parseChdeckArchive,
  serializeChdeckArchive,
  validateArtworkItem,
  validateCatalog,
} from './catalogMerge';
export {
  FileSystemGalleryAdapter,
  isFileSystemAccessSupported,
} from './fileSystemAdapter';
export {
  GoogleDriveGalleryAdapter,
  sanitizeCatalogForCloudSync,
} from './googleDriveAdapter';
export { IndexedDbGalleryAdapter } from './indexedDbAdapter';

export interface GallerySyncResult {
  catalog: GalleryDeckCatalog;
  syncedTiers: Array<'indexeddb' | 'filesystem' | 'gdrive'>;
  errors: Array<{ tier: 'indexeddb' | 'filesystem' | 'gdrive'; message: string }>;
}

/**
 * Coordinates multi-tier synchronization across IndexedDB, Local Directory (File System Access API),
 * and Google Drive, with deterministic `updatedAt` conflict resolution.
 */
export async function syncGalleryAdapters(
  localCatalog: GalleryDeckCatalog,
  adapters: StorageAdapter[],
): Promise<GallerySyncResult> {
  let merged = localCatalog;
  const syncedTiers: Array<'indexeddb' | 'filesystem' | 'gdrive'> = [];
  const errors: Array<{ tier: 'indexeddb' | 'filesystem' | 'gdrive'; message: string }> = [];

  for (const adapter of adapters) {
    if (!adapter.isAvailable()) continue;
    try {
      const remote = await adapter.loadCatalog();
      if (remote) {
        merged = mergeCatalogs(merged, remote);
      }
    } catch (err) {
      errors.push({
        tier: adapter.tier,
        message: err instanceof Error ? err.message : 'Failed to load remote catalog',
      });
    }
  }

  for (const adapter of adapters) {
    if (!adapter.isAvailable()) continue;
    try {
      await adapter.saveCatalog(merged);
      syncedTiers.push(adapter.tier);
    } catch (err) {
      errors.push({
        tier: adapter.tier,
        message: err instanceof Error ? err.message : 'Failed to save catalog',
      });
    }
  }

  return { catalog: merged, syncedTiers, errors };
}

export async function loadInitialCatalog(
  idbAdapter: IndexedDbGalleryAdapter,
): Promise<GalleryDeckCatalog> {
  const existing = await idbAdapter.loadCatalog();
  if (existing) return existing;
  const empty = createEmptyCatalog();
  await idbAdapter.saveCatalog(empty);
  return empty;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export { type StorageAdapter };

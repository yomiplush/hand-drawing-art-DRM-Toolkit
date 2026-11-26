import type { LicenseId } from '../core/manifest/types';

export const GALLERY_DECK_CATALOG_VERSION = 1 as const;
export const GALLERY_DECK_CATALOG_FILENAME = 'gallerydeck-catalog.json' as const;
export const GALLERY_DECK_ARCHIVE_EXTENSION = '.chdeck' as const;

export type GalleryProvenanceStatus = 'unverified' | 'signed' | 'invalid';
export type GalleryQrMode = 'none' | 'outer-border' | 'in-image-mask';
export type GalleryFilterTab = 'all' | 'recent' | 'verified' | 'unverified' | 'collections';
export type GallerySyncTier = 'indexeddb' | 'filesystem' | 'gdrive';
export type GallerySyncState = 'idle' | 'syncing' | 'synced' | 'error' | 'disconnected';

export interface GalleryArtworkItem {
  id: string;
  title: string;
  authorName?: string;
  createdAt: number;
  importedAt: number;
  updatedAt: number;
  width: number;
  height: number;
  mimeType: string;
  fileSizeBytes: number;
  /** Lightweight data URL thumbnail for instant Steam Deck rendering and portable catalog sync. */
  thumbnailDataUrl: string;
  /** Key referencing full-resolution binary asset in local IndexedDB blob store. */
  blobRef?: string;
  /** Relative filename inside the user's fixed local artwork folder for instant cache-eviction recovery. */
  localFileName?: string;
  provenanceStatus: GalleryProvenanceStatus;
  qrMode: GalleryQrMode;
  publicKeyFingerprint?: string;
  artworkSha256Hex?: string;
  licenseId?: LicenseId;
  tags: string[];
  collections: string[];
  proofToken?: string;
  proofUrl?: string;
  verifiedAt?: number;
  verificationSummary?: string;
  /** Soft tombstone for timestamp-based multi-tier merge. */
  deleted?: boolean;
}

export interface GalleryDeckCatalog {
  version: typeof GALLERY_DECK_CATALOG_VERSION;
  updatedAt: number;
  deviceId: string;
  /** Remembered name of the user's fixed local artwork folder (metadata only). */
  localFolderName?: string;
  collections: string[];
  items: GalleryArtworkItem[];
}

export interface GalleryDeckArchive {
  format: 'chdeck-v1';
  exportedAt: number;
  catalog: GalleryDeckCatalog;
  /** Optional base64-encoded full-resolution blobs keyed by item.id for portable archive restore. */
  assets?: Record<string, { mimeType: string; base64: string }>;
}

export interface StorageAdapter {
  readonly tier: GallerySyncTier;
  isAvailable(): boolean;
  loadCatalog(): Promise<GalleryDeckCatalog | null>;
  saveCatalog(catalog: GalleryDeckCatalog): Promise<void>;
}

export interface SyncTierStatus {
  tier: GallerySyncTier;
  state: GallerySyncState;
  label?: string;
  lastSyncedAt: number | null;
  error?: string | null;
}

export function createEmptyCatalog(deviceId = 'local-deck'): GalleryDeckCatalog {
  return {
    version: GALLERY_DECK_CATALOG_VERSION,
    updatedAt: Date.now(),
    deviceId,
    collections: ['Favorites', 'Portfolio', 'Commissions'],
    items: [],
  };
}

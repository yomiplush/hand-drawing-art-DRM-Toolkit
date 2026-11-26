import type { LicenseId } from '../core/manifest/types';

export const GALLERY_DECK_CATALOG_VERSION = 1 as const;
export const GALLERY_DECK_CATALOG_FILENAME = 'gallerydeck-catalog.json' as const;
export const GALLERY_DECK_ARCHIVE_EXTENSION = '.chdeck' as const;
export const GALLERY_DECK_VAULT_EXTENSION = '.gdvault' as const;
export const GALLERY_DECK_MANIFEST_ENC_FILENAME = 'manifest.enc' as const;
export const GALLERY_DECK_OFFLINE_VIEWER_FILENAME = 'gallerydeck-offline-viewer.html' as const;

export type GalleryProvenanceStatus = 'unverified' | 'signed' | 'invalid';
export type GalleryQrMode = 'none' | 'outer-border' | 'in-image-mask';
export type GalleryFilterTab = 'all' | 'recent' | 'verified' | 'unverified' | 'collections';
export type GallerySyncTier = 'indexeddb' | 'filesystem' | 'gdrive';
export type GallerySyncState = 'idle' | 'syncing' | 'synced' | 'error' | 'disconnected';

export interface GalleryArtworkItem {
  id: string;
  title: string;
  description?: string;
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

export interface EncryptedVaultManifestEntry {
  id: string;
  title: string;
  folder: string;
  authorName?: string;
  width: number;
  height: number;
  mimeType: string;
  fileSizeBytes: number;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  collections: string[];
  thumbFile: string;
  imgFile: string;
  provenanceStatus?: GalleryProvenanceStatus;
  licenseId?: LicenseId;
  publicKeyFingerprint?: string;
}

export interface EncryptedVaultManifest {
  version: 1;
  createdAt: number;
  vaultName: string;
  folders: string[];
  items: EncryptedVaultManifestEntry[];
}

export interface DecryptedVaultSession {
  manifest: EncryptedVaultManifest;
  /** On-demand full-resolution decryptor; caller MUST revoke the returned ObjectURL on close. */
  decryptFullImage: (itemId: string) => Promise<{ blobUrl: string; mimeType: string }>;
  /** Revokes all thumbnail ObjectURLs held by this session. */
  dispose: () => void;
  /** Map of itemId -> thumbnail ObjectURL (or data URL). */
  thumbnailUrls: Record<string, string>;
}

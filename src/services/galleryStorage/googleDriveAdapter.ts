import {
  CHM_APP_PROPERTY_VALUE,
  DRIVE_APPDATA_SPACE,
  GoogleDriveClient,
} from '../../core/google/driveApi';
import type { InMemoryGoogleAuthManager } from '../../core/google/gisAuth';
import {
  GALLERY_DECK_CATALOG_FILENAME,
} from '../../types/gallerydeck';
import type { GalleryDeckCatalog, StorageAdapter } from '../../types/gallerydeck';
import { validateCatalog } from './catalogMerge';

const GALLERY_DECK_DRIVE_ROLE = 'gallerydeck-catalog';
const GALLERY_DECK_ENCRYPTED_BUNDLE_ROLE = 'gallerydeck-encrypted-bundle';
const GALLERY_DECK_ENCRYPTED_BUNDLE_FILENAME = 'gallerydeck-encrypted-bundle.gdvault';

/**
 * Strips all artwork pixel/thumbnail data and local blob references before cloud sync.
 * Only cryptographic provenance metadata (hashes, signatures, licenses, titles, tags)
 * is ever uploaded to Google Drive—never illustration images.
 */
export function sanitizeCatalogForCloudSync(catalog: GalleryDeckCatalog): GalleryDeckCatalog {
  return {
    ...catalog,
    items: catalog.items.map((item) => ({
      ...item,
      thumbnailDataUrl: '',
      blobRef: undefined,
    })),
  };
}

export class GoogleDriveGalleryAdapter implements StorageAdapter {
  readonly tier = 'gdrive' as const;
  private readonly authManager: InMemoryGoogleAuthManager;
  private readonly driveClient: GoogleDriveClient;
  private cachedFolderId: string | undefined;
  private cachedFileId: string | undefined;
  private cachedEncryptedBundleFileId: string | undefined;

  constructor(authManager: InMemoryGoogleAuthManager, driveClient = new GoogleDriveClient()) {
    this.authManager = authManager;
    this.driveClient = driveClient;
  }

  isAvailable(): boolean {
    const state = this.authManager.getState();
    return state.connected && state.hasDriveFileScope;
  }

  private getAccessToken(): string {
    return this.authManager.getAccessTokenOrThrow();
  }

  private async ensureRootFolder(accessToken: string): Promise<string> {
    const { folder } = await this.driveClient.ensureVaultRootFolder({
      accessToken,
      knownFolderId: this.cachedFolderId,
    });
    this.cachedFolderId = folder.id;
    return folder.id;
  }

  async loadCatalog(): Promise<GalleryDeckCatalog | null> {
    if (!this.isAvailable()) return null;
    const accessToken = this.getAccessToken();
    const folderId = await this.ensureRootFolder(accessToken);

    const files = await this.driveClient.listAppFiles({
      accessToken,
      spaces: DRIVE_APPDATA_SPACE,
      query: `'${folderId.replace(/'/g, "\\'")}' in parents and trashed=false and appProperties has { key='chmApp' and value='${CHM_APP_PROPERTY_VALUE}' } and appProperties has { key='chmRole' and value='${GALLERY_DECK_DRIVE_ROLE}' }`,
      pageSize: 5,
    });

    if (files.length === 0) {
      return null;
    }

    this.cachedFileId = files[0].id;
    const raw = await this.driveClient.downloadJsonFile<unknown>({
      accessToken,
      fileId: files[0].id,
    });
    return validateCatalog(raw);
  }

  async saveCatalog(catalog: GalleryDeckCatalog): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Google Drive is not connected');
    }
    const accessToken = this.getAccessToken();
    const folderId = await this.ensureRootFolder(accessToken);

    const cloudSafeCatalog = sanitizeCatalogForCloudSync(catalog);

    const saved = await this.driveClient.upsertJsonFile({
      accessToken,
      folderId,
      existingFileId: this.cachedFileId,
      opaqueFileName: GALLERY_DECK_CATALOG_FILENAME,
      appProperties: {
        chmRole: GALLERY_DECK_DRIVE_ROLE,
        chmSchema: '1',
      },
      jsonPayload: cloudSafeCatalog,
    });
    this.cachedFileId = saved.id;
  }

  /**
   * Uploads an end-to-end AES-256-GCM encrypted `.gdvault` bundle containing
   * all illustration images, thumbnails, and provenance metadata to Google Drive.
   */
  async saveEncryptedBundle(bundleBlob: Blob): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Google Drive is not connected');
    }
    const accessToken = this.getAccessToken();
    const folderId = await this.ensureRootFolder(accessToken);

    if (!this.cachedEncryptedBundleFileId) {
      const existing = await this.driveClient.listAppFiles({
        accessToken,
        spaces: DRIVE_APPDATA_SPACE,
        query: `'${folderId.replace(/'/g, "\\'")}' in parents and trashed=false and appProperties has { key='chmApp' and value='${CHM_APP_PROPERTY_VALUE}' } and appProperties has { key='chmRole' and value='${GALLERY_DECK_ENCRYPTED_BUNDLE_ROLE}' }`,
        pageSize: 5,
      });
      if (existing.length > 0) {
        this.cachedEncryptedBundleFileId = existing[0].id;
      }
    }

    const saved = await this.driveClient.upsertBinaryFile({
      accessToken,
      folderId,
      existingFileId: this.cachedEncryptedBundleFileId,
      opaqueFileName: GALLERY_DECK_ENCRYPTED_BUNDLE_FILENAME,
      mimeType: 'application/octet-stream',
      appProperties: {
        chmRole: GALLERY_DECK_ENCRYPTED_BUNDLE_ROLE,
        chmSchema: '1',
      },
      binaryPayload: bundleBlob,
    });
    this.cachedEncryptedBundleFileId = saved.id;
  }

  /**
   * Downloads the encrypted `.gdvault` bundle from Google Drive (if present)
   * so the user can decrypt and restore all artworks in Web or Standalone Edition.
   */
  async loadEncryptedBundle(): Promise<Blob | null> {
    if (!this.isAvailable()) {
      throw new Error('Google Drive is not connected');
    }
    const accessToken = this.getAccessToken();
    const folderId = await this.ensureRootFolder(accessToken);

    const files = await this.driveClient.listAppFiles({
      accessToken,
      spaces: DRIVE_APPDATA_SPACE,
      query: `'${folderId.replace(/'/g, "\\'")}' in parents and trashed=false and appProperties has { key='chmApp' and value='${CHM_APP_PROPERTY_VALUE}' } and appProperties has { key='chmRole' and value='${GALLERY_DECK_ENCRYPTED_BUNDLE_ROLE}' }`,
      pageSize: 5,
    });

    if (files.length === 0) {
      return null;
    }

    this.cachedEncryptedBundleFileId = files[0].id;
    return await this.driveClient.downloadBinaryFile({
      accessToken,
      fileId: files[0].id,
    });
  }
}

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

export class GoogleDriveGalleryAdapter implements StorageAdapter {
  readonly tier = 'gdrive' as const;
  private readonly authManager: InMemoryGoogleAuthManager;
  private readonly driveClient: GoogleDriveClient;
  private cachedFolderId: string | undefined;
  private cachedFileId: string | undefined;

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

    const saved = await this.driveClient.upsertJsonFile({
      accessToken,
      folderId,
      existingFileId: this.cachedFileId,
      opaqueFileName: GALLERY_DECK_CATALOG_FILENAME,
      appProperties: {
        chmRole: GALLERY_DECK_DRIVE_ROLE,
        chmSchema: '1',
      },
      jsonPayload: catalog,
    });
    this.cachedFileId = saved.id;
  }
}

import {
  GALLERY_DECK_CATALOG_FILENAME,
} from '../../types/gallerydeck';
import type { GalleryDeckCatalog, StorageAdapter } from '../../types/gallerydeck';
import { validateCatalog } from './catalogMerge';

export interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: 'read' | 'readwrite';
  }) => Promise<FileSystemDirectoryHandle>;
}

export function isFileSystemAccessSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function'
  );
}

export class FileSystemGalleryAdapter implements StorageAdapter {
  readonly tier = 'filesystem' as const;
  private dirHandle: FileSystemDirectoryHandle | null = null;

  isAvailable(): boolean {
    return isFileSystemAccessSupported();
  }

  isLinked(): boolean {
    return this.dirHandle !== null;
  }

  getDirectoryName(): string | null {
    return this.dirHandle?.name ?? null;
  }

  setDirectoryHandle(handle: FileSystemDirectoryHandle | null): void {
    this.dirHandle = handle;
  }

  async linkDirectory(): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('File System Access API is not supported in this browser. Use .chdeck export/import instead.');
    }
    const picker = (window as DirectoryPickerWindow).showDirectoryPicker!;
    const handle = await picker({ id: 'certified-handmade-gallerydeck', mode: 'readwrite' });
    this.dirHandle = handle;
    return handle.name;
  }

  disconnect(): void {
    this.dirHandle = null;
  }

  async loadCatalog(): Promise<GalleryDeckCatalog | null> {
    if (!this.dirHandle) return null;
    try {
      const fileHandle = await this.dirHandle.getFileHandle(GALLERY_DECK_CATALOG_FILENAME);
      const file = await fileHandle.getFile();
      const text = await file.text();
      return validateCatalog(JSON.parse(text));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotFoundError') {
        return null;
      }
      throw err;
    }
  }

  async saveCatalog(catalog: GalleryDeckCatalog): Promise<void> {
    if (!this.dirHandle) {
      throw new Error('No local directory linked');
    }
    const fileHandle = await this.dirHandle.getFileHandle(GALLERY_DECK_CATALOG_FILENAME, {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(catalog, null, 2));
    await writable.close();
  }
}

import type { GalleryDeckCatalog, StorageAdapter } from '../../types/gallerydeck';
import { validateCatalog } from './catalogMerge';

const DB_NAME = 'certified-handmade-gallerydeck';
const DB_VERSION = 1;
const STORE_CATALOG = 'catalog';
const STORE_BLOBS = 'blobs';
const CATALOG_KEY = 'main';

export interface StoredGalleryBlob {
  key: string;
  mimeType: string;
  bytes: Uint8Array;
  updatedAt: number;
}

export class IndexedDbGalleryAdapter implements StorageAdapter {
  readonly tier = 'indexeddb' as const;
  private memoryCatalog: GalleryDeckCatalog | null = null;
  private memoryBlobs = new Map<string, StoredGalleryBlob>();

  private hasIndexedDb(): boolean {
    return typeof indexedDB !== 'undefined';
  }

  isAvailable(): boolean {
    return true;
  }

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_CATALOG)) {
          db.createObjectStore(STORE_CATALOG);
        }
        if (!db.objectStoreNames.contains(STORE_BLOBS)) {
          db.createObjectStore(STORE_BLOBS, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('Failed to open GalleryDeck IndexedDB'));
    });
  }

  async loadCatalog(): Promise<GalleryDeckCatalog | null> {
    if (!this.hasIndexedDb()) {
      return this.memoryCatalog;
    }
    try {
      const db = await this.openDb();
      return await new Promise<GalleryDeckCatalog | null>((resolve, reject) => {
        const tx = db.transaction(STORE_CATALOG, 'readonly');
        const store = tx.objectStore(STORE_CATALOG);
        const req = store.get(CATALOG_KEY);
        req.onsuccess = () => {
          db.close();
          if (!req.result) {
            resolve(null);
            return;
          }
          try {
            resolve(validateCatalog(req.result));
          } catch {
            resolve(null);
          }
        };
        req.onerror = () => {
          db.close();
          reject(req.error ?? new Error('Failed to read GalleryDeck catalog'));
        };
      });
    } catch {
      return this.memoryCatalog;
    }
  }

  async saveCatalog(catalog: GalleryDeckCatalog): Promise<void> {
    this.memoryCatalog = catalog;
    if (!this.hasIndexedDb()) return;
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_CATALOG, 'readwrite');
      const store = tx.objectStore(STORE_CATALOG);
      store.put(catalog, CATALOG_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error('Failed to save GalleryDeck catalog'));
      };
    });
  }

  async saveBlob(key: string, bytes: Uint8Array, mimeType: string): Promise<void> {
    const record: StoredGalleryBlob = {
      key,
      mimeType,
      bytes,
      updatedAt: Date.now(),
    };
    this.memoryBlobs.set(key, record);
    if (!this.hasIndexedDb()) return;
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_BLOBS, 'readwrite');
      tx.objectStore(STORE_BLOBS).put(record);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error('Failed to save GalleryDeck blob'));
      };
    });
  }

  async loadBlob(key: string): Promise<StoredGalleryBlob | null> {
    const cached = this.memoryBlobs.get(key);
    if (!this.hasIndexedDb()) {
      return cached ?? null;
    }
    try {
      const db = await this.openDb();
      return await new Promise<StoredGalleryBlob | null>((resolve, reject) => {
        const tx = db.transaction(STORE_BLOBS, 'readonly');
        const req = tx.objectStore(STORE_BLOBS).get(key);
        req.onsuccess = () => {
          db.close();
          const result = req.result as StoredGalleryBlob | undefined;
          if (result) {
            this.memoryBlobs.set(key, result);
            resolve(result);
          } else {
            resolve(cached ?? null);
          }
        };
        req.onerror = () => {
          db.close();
          reject(req.error ?? new Error('Failed to load GalleryDeck blob'));
        };
      });
    } catch {
      return cached ?? null;
    }
  }

  async deleteBlob(key: string): Promise<void> {
    this.memoryBlobs.delete(key);
    if (!this.hasIndexedDb()) return;
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_BLOBS, 'readwrite');
      tx.objectStore(STORE_BLOBS).delete(key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error('Failed to delete GalleryDeck blob'));
      };
    });
  }
}

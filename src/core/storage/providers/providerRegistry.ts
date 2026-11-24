import { GoogleDriveStorageProvider } from '../../google/googleDriveProvider';
import { IndexedDbStorageProvider } from './indexedDbProvider';
import { PortableFileStorageProvider } from './portableFileProvider';
import type { StorageProvider, StorageProviderId, StorageProviderStatus } from './types';

export class StorageProviderRegistry {
  private readonly providers = new Map<StorageProviderId, StorageProvider>();

  constructor(initialProviders?: StorageProvider[]) {
    const defaults: StorageProvider[] = initialProviders ?? [
      new IndexedDbStorageProvider(),
      new PortableFileStorageProvider(),
      new GoogleDriveStorageProvider(),
    ];
    for (const p of defaults) {
      this.register(p);
    }
  }

  register(provider: StorageProvider): void {
    this.providers.set(provider.id, provider);
  }

  unregister(id: StorageProviderId): void {
    this.providers.delete(id);
  }

  get(id: StorageProviderId): StorageProvider | undefined {
    return this.providers.get(id);
  }

  list(): StorageProvider[] {
    return Array.from(this.providers.values());
  }

  async listStatuses(): Promise<StorageProviderStatus[]> {
    return Promise.all(this.list().map((p) => p.getStatus()));
  }
}

export const defaultStorageRegistry = new StorageProviderRegistry();

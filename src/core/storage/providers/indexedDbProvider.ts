import { computeVaultStats } from '../../vault/vaultStore';
import {
  exportEncryptedVaultBackup,
  exportVaultBackupBundle,
  importVaultBackupJson,
} from '../../vault/vaultBackup';
import type { EncryptedVaultBackupV1, VaultBackupBundleV1 } from '../../vault/types';
import type {
  StorageProvider,
  StorageProviderCapabilities,
  StorageProviderStatus,
  VaultSnapshotImportResult,
} from './types';

export class IndexedDbStorageProvider implements StorageProvider {
  readonly id = 'indexeddb' as const;
  readonly kind = 'local' as const;
  readonly label = 'Local Browser Storage (IndexedDB)';
  readonly capabilities: StorageProviderCapabilities = {
    supportsIncrementalSync: false,
    supportsOffline: true,
    requiresNetwork: false,
    supportsPassphraseEncryption: true,
    supportsAccountSwitch: false,
  };

  async getStatus(): Promise<StorageProviderStatus> {
    const available = typeof indexedDB !== 'undefined';
    let detail = 'IndexedDB unavailable in current runtime';
    if (available) {
      const stats = await computeVaultStats();
      detail = `${stats.totalProofs} local proofs (~${Math.ceil(stats.estimatedTotalBytes / 1024)} KiB)`;
    }
    return {
      id: this.id,
      kind: this.kind,
      label: this.label,
      available,
      connected: available,
      active: available,
      pendingOperations: 0,
      conflictCount: 0,
      detail,
    };
  }

  async exportSnapshot(): Promise<VaultBackupBundleV1> {
    return exportVaultBackupBundle();
  }

  async importSnapshot(bundle: VaultBackupBundleV1): Promise<VaultSnapshotImportResult> {
    return importVaultBackupJson({ rawJson: bundle });
  }

  async exportEncryptedSnapshot(passphrase: string): Promise<EncryptedVaultBackupV1> {
    return exportEncryptedVaultBackup({ passphrase });
  }

  async importEncryptedSnapshot(
    encrypted: EncryptedVaultBackupV1 | string,
    passphrase: string,
  ): Promise<VaultSnapshotImportResult> {
    return importVaultBackupJson({
      rawJson: encrypted,
      passphraseIfEncrypted: passphrase,
    });
  }
}

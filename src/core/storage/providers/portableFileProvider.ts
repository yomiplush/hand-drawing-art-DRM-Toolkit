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

export const PORTABLE_VAULT_FILE_EXTENSION = '.chmvault.json';

export class PortableFileStorageProvider implements StorageProvider {
  readonly id = 'portable-file' as const;
  readonly kind = 'file' as const;
  readonly label = 'Portable Encrypted File (.chmvault.json)';
  readonly capabilities: StorageProviderCapabilities = {
    supportsIncrementalSync: false,
    supportsOffline: true,
    requiresNetwork: false,
    supportsPassphraseEncryption: true,
    supportsAccountSwitch: false,
  };

  async getStatus(): Promise<StorageProviderStatus> {
    return {
      id: this.id,
      kind: this.kind,
      label: this.label,
      available: true,
      connected: true,
      active: true,
      pendingOperations: 0,
      conflictCount: 0,
      detail: 'Export/import AES-256-GCM encrypted vault files locally on any OS or standalone app.',
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

  async exportEncryptedFileBlob(passphrase: string): Promise<Blob> {
    const encrypted = await this.exportEncryptedSnapshot(passphrase);
    return new Blob([JSON.stringify(encrypted, null, 2)], { type: 'application/json' });
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

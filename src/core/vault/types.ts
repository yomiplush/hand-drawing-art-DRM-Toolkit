export const CHM_VAULT_SCHEMA_VERSION = 1 as const;
export const CHM_VAULT_BACKUP_FORMAT = 'certified-handmade-vault-backup' as const;
export const CHM_VAULT_ENCRYPTED_BACKUP_FORMAT = 'certified-handmade-vault-encrypted-backup' as const;
export const CHM_VAULT_SYNC_PROTOCOL_ID = 'CHM-VAULT-v1' as const;

export interface VaultProofRecord {
  /** Deterministic SHA-256 hex digest of the canonical proof bytes. */
  id: string;
  schemaVersion: typeof CHM_VAULT_SCHEMA_VERSION;
  protocolVersion: 1 | 2;
  artworkIdHex: string;
  authorPublicKeyBase64Url: string;
  authorFingerprintHex: string;
  authorFingerprintShort: string;
  authorName?: string;
  artworkTitle?: string;
  creationMethod?: string;
  licenseId: string;
  commercialUse: string;
  redistribution: string;
  aiTraining: string;
  imageSha256Hex: string;
  issuedAt: number;
  /** Compact Base64URL-encoded signed CBOR proof envelope (CHM1 / CHM2). Never contains pixels or keys. */
  proofBase64Url: string;
  /** Optional opt-in flags for selective decentralized relay synchronization */
  syncSelected: boolean;
  publicIndexOptIn: boolean;
  lastSyncedAt?: string;
  lastSyncedEventId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VaultQueryOptions {
  query?: string;
  licenseId?: string;
  authorFingerprintHex?: string;
  syncSelectedOnly?: boolean;
  offset?: number;
  limit?: number;
}

export interface VaultQueryResult {
  items: VaultProofRecord[];
  totalCount: number;
  estimatedBytes: number;
}

export interface VaultStats {
  totalProofs: number;
  syncSelectedCount: number;
  estimatedTotalBytes: number;
  avgBytesPerProof: number;
}

export interface VaultPublicProfileSnapshot {
  displayName?: string;
  website?: string;
  links?: Array<{ label?: string; url: string }>;
  updatedAt?: string;
}

export interface VaultTrustedArtistEntry {
  publicKeyBase64Url: string;
  fingerprintHex: string;
  label: string;
  verificationState?: 'confirmed' | 'unconfirmed';
  addedAt: string;
}

export interface VaultBackupBundleV1 {
  format: typeof CHM_VAULT_BACKUP_FORMAT;
  version: typeof CHM_VAULT_SCHEMA_VERSION;
  exportedAt: string;
  /** Strictly non-secret: private keys, passphrases, and raw artwork pixels are never included. */
  containsPrivateKeys: false;
  profile?: VaultPublicProfileSnapshot;
  trustedArtists: VaultTrustedArtistEntry[];
  proofs: Array<{
    proofBase64Url: string;
    syncSelected?: boolean;
    creationMethod?: string;
    createdAt?: string;
  }>;
}

export interface EncryptedVaultBackupV1 {
  format: typeof CHM_VAULT_ENCRYPTED_BACKUP_FORMAT;
  version: typeof CHM_VAULT_SCHEMA_VERSION;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  cipher: 'AES-256-GCM';
  salt: string;
  iv: string;
  exportedAt: string;
  proofCount: number;
  ciphertext: string;
}

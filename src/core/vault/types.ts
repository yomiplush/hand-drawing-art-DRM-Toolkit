import type { AuthorProfile, AuthorProfilePublicSnapshot } from '../profiles/types';
import type { PolicyPreset } from '../policies/types';
import type { CreationEnvironmentData, EvidenceCategory, PolicySignal } from '../manifest/types';

export const CHM_VAULT_SCHEMA_VERSION = 2 as const;
export const CHM_VAULT_SCHEMA_VERSION_V1 = 1 as const;
export const CHM_VAULT_BACKUP_FORMAT = 'certified-handmade-vault-backup' as const;
export const CHM_VAULT_ENCRYPTED_BACKUP_FORMAT = 'certified-handmade-vault-encrypted-backup' as const;
export const CHM_VAULT_SYNC_PROTOCOL_ID = 'CHM-VAULT-v1' as const;

export interface VaultEvidenceHashSummary {
  sha256Hex: string;
  byteLength: number;
  label?: string;
  category?: EvidenceCategory;
  mimeType?: string;
}

export interface VaultProofDetailsSnapshot {
  description?: string;
  creationMethod?: string;
  creationEnvironment?: CreationEnvironmentData;
  policyPresetId?: string;
  allowsDerivatives?: PolicySignal;
  allowsModifications?: PolicySignal;
  requiresAttribution?: boolean;
  customNote?: string;
  authorProfileSnapshot?: AuthorProfilePublicSnapshot;
  evidenceHashes?: VaultEvidenceHashSummary[];
}

export interface VaultProofRecord {
  /** Deterministic SHA-256 hex digest of the canonical proof bytes. */
  id: string;
  schemaVersion: 1 | 2;
  protocolVersion: 1 | 2 | 3;
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
  /** Compact Base64URL-encoded signed proof envelope (CHM1 / CHM2 / CHM3). Never contains pixels or keys. */
  proofBase64Url: string;
  /** Optional rich public details captured at signing time (never pixels or private keys). */
  detailsSnapshot?: VaultProofDetailsSnapshot;
  /** Legacy flag retained only for safe migration; Nostr vault sync is disabled. */
  syncSelected: boolean;
  /** Legacy flag retained only for safe migration; Nostr public proof index publishing is disabled. */
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

export interface VaultSettingsSnapshot {
  verifyBaseUrl?: string;
  preferredQrMode?: 'outer' | 'masked';
  preferredLocale?: string;
  activeAuthorProfileId?: string;
  activePolicyPresetId?: string;
  updatedAt: string;
  version: number;
}

export interface VaultBackupBundleV1 {
  format: typeof CHM_VAULT_BACKUP_FORMAT;
  version: 1 | 2;
  exportedAt: string;
  /** Strictly non-secret: private keys, passphrases, and raw artwork pixels are never included. */
  containsPrivateKeys: false;
  profile?: VaultPublicProfileSnapshot;
  authorProfiles?: AuthorProfile[];
  policyPresets?: PolicyPreset[];
  settings?: VaultSettingsSnapshot;
  trustedArtists: VaultTrustedArtistEntry[];
  proofs: Array<{
    proofBase64Url: string;
    syncSelected?: boolean;
    creationMethod?: string;
    detailsSnapshot?: VaultProofDetailsSnapshot;
    createdAt?: string;
  }>;
}

export interface EncryptedVaultBackupV1 {
  format: typeof CHM_VAULT_ENCRYPTED_BACKUP_FORMAT;
  version: 1 | 2;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  cipher: 'AES-256-GCM';
  salt: string;
  iv: string;
  exportedAt: string;
  proofCount: number;
  ciphertext: string;
}

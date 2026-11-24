import {
  DEFAULT_PBKDF2_ITERATIONS,
  MIN_PASSPHRASE_LENGTH,
} from '../crypto/keyBackup';
import { base64UrlDecode, base64UrlEncode } from '../crypto/sha256';
import {
  addTrustedKey,
  loadCreatorProfileDefaults,
  listTrustedKeys,
  saveCreatorProfileDefaults,
} from '../storage/keyStore';
import {
  CHM_VAULT_BACKUP_FORMAT,
  CHM_VAULT_ENCRYPTED_BACKUP_FORMAT,
  CHM_VAULT_SCHEMA_VERSION,
  type EncryptedVaultBackupV1,
  type VaultBackupBundleV1,
  type VaultProofRecord,
} from './types';
import {
  listAllVaultProofs,
  saveVaultProofBatch,
  verifyAndBuildVaultProofRecord,
} from './vaultStore';

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();

function buildVaultBackupAad(proofCount: number): Uint8Array<ArrayBuffer> {
  const encoded = utf8Encoder.encode(`CHM-VAULT-ENCRYPTED-v1:${proofCount}`);
  const out = new Uint8Array(new ArrayBuffer(encoded.byteLength));
  out.set(encoded);
  return out;
}

function toArrayBufferView(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  out.set(bytes);
  return out;
}

async function deriveVaultAesKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
  usage: KeyUsage[],
): Promise<CryptoKey> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto SubtleCrypto API is required for encrypted vault backups');
  }
  const baseKey = await subtle.importKey(
    'raw',
    toArrayBufferView(utf8Encoder.encode(passphrase)),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBufferView(salt),
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    usage,
  );
}

export async function exportVaultBackupBundle(params?: {
  includeProfile?: boolean;
  includeTrustedArtists?: boolean;
}): Promise<VaultBackupBundleV1> {
  const [proofs, profile, trusted] = await Promise.all([
    listAllVaultProofs(),
    params?.includeProfile !== false ? loadCreatorProfileDefaults() : Promise.resolve(undefined),
    params?.includeTrustedArtists !== false ? listTrustedKeys() : Promise.resolve([]),
  ]);

  return {
    format: CHM_VAULT_BACKUP_FORMAT,
    version: CHM_VAULT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    containsPrivateKeys: false,
    profile: profile
      ? {
          displayName: profile.displayName,
          website: profile.website,
          links: profile.links,
          updatedAt: profile.updatedAt,
        }
      : undefined,
    trustedArtists: trusted.map((t) => ({
      publicKeyBase64Url: t.publicKeyBase64Url,
      fingerprintHex: t.fingerprintHex,
      label: t.label,
      verificationState: t.verificationState,
      addedAt: t.addedAt,
    })),
    proofs: proofs.map((p) => ({
      proofBase64Url: p.proofBase64Url,
      syncSelected: p.syncSelected,
      creationMethod: p.creationMethod,
      createdAt: p.createdAt,
    })),
  };
}

export async function exportEncryptedVaultBackup(params: {
  passphrase: string;
  iterations?: number;
}): Promise<EncryptedVaultBackupV1> {
  if (params.passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(`Vault backup passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters`);
  }
  const iterations = params.iterations ?? DEFAULT_PBKDF2_ITERATIONS;
  const bundle = await exportVaultBackupBundle();
  const plaintext = utf8Encoder.encode(JSON.stringify(bundle));
  const salt = new Uint8Array(16);
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(salt);
  globalThis.crypto.getRandomValues(iv);

  const key = await deriveVaultAesKey(params.passphrase, salt, iterations, ['encrypt']);
  const aad = buildVaultBackupAad(bundle.proofs.length);
  const ciphertextBuf = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBufferView(iv), additionalData: aad },
    key,
    toArrayBufferView(plaintext),
  );

  return {
    format: CHM_VAULT_ENCRYPTED_BACKUP_FORMAT,
    version: CHM_VAULT_SCHEMA_VERSION,
    kdf: 'PBKDF2-SHA256',
    iterations,
    cipher: 'AES-256-GCM',
    salt: base64UrlEncode(salt),
    iv: base64UrlEncode(iv),
    exportedAt: bundle.exportedAt,
    proofCount: bundle.proofs.length,
    ciphertext: base64UrlEncode(new Uint8Array(ciphertextBuf)),
  };
}

export async function importVaultBackupJson(params: {
  rawJson: string | unknown;
  passphraseIfEncrypted?: string;
}): Promise<{
  importedProofs: number;
  rejectedProofs: number;
  importedTrustedArtists: number;
  restoredProfile: boolean;
}> {
  const rawObj =
    typeof params.rawJson === 'string'
      ? (JSON.parse(params.rawJson) as unknown)
      : params.rawJson;

  if (!rawObj || typeof rawObj !== 'object' || Array.isArray(rawObj)) {
    throw new Error('Vault backup must be a valid JSON object');
  }

  let bundle: VaultBackupBundleV1;
  const candidate = rawObj as Record<string, unknown>;

  if (candidate.format === CHM_VAULT_ENCRYPTED_BACKUP_FORMAT) {
    if (!params.passphraseIfEncrypted) {
      throw new Error('Passphrase is required to decrypt an encrypted vault backup');
    }
    if (
      typeof candidate.salt !== 'string' ||
      typeof candidate.iv !== 'string' ||
      typeof candidate.ciphertext !== 'string' ||
      typeof candidate.iterations !== 'number' ||
      typeof candidate.proofCount !== 'number'
    ) {
      throw new Error('Malformed encrypted vault backup metadata');
    }
    const salt = base64UrlDecode(candidate.salt);
    const iv = base64UrlDecode(candidate.iv);
    const ciphertext = base64UrlDecode(candidate.ciphertext);
    const key = await deriveVaultAesKey(
      params.passphraseIfEncrypted,
      salt,
      candidate.iterations,
      ['decrypt'],
    );
    const aad = buildVaultBackupAad(candidate.proofCount);
    const plainBuf = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBufferView(iv), additionalData: aad },
      key,
      toArrayBufferView(ciphertext),
    );
    bundle = JSON.parse(utf8Decoder.decode(new Uint8Array(plainBuf))) as VaultBackupBundleV1;
  } else {
    bundle = rawObj as VaultBackupBundleV1;
  }

  if (
    !bundle ||
    bundle.format !== CHM_VAULT_BACKUP_FORMAT ||
    bundle.version !== CHM_VAULT_SCHEMA_VERSION ||
    !Array.isArray(bundle.proofs)
  ) {
    throw new Error('Unsupported or malformed CHM Vault backup bundle');
  }

  let restoredProfile = false;
  if (bundle.profile && typeof bundle.profile === 'object') {
    await saveCreatorProfileDefaults({
      displayName: bundle.profile.displayName,
      website: bundle.profile.website,
      links: bundle.profile.links,
    });
    restoredProfile = true;
  }

  let importedTrustedArtists = 0;
  if (Array.isArray(bundle.trustedArtists)) {
    for (const artist of bundle.trustedArtists) {
      if (!artist || typeof artist.publicKeyBase64Url !== 'string' || !artist.label) continue;
      try {
        await addTrustedKey({
          publicKeyInput: artist.publicKeyBase64Url,
          label: artist.label,
          verificationState: artist.verificationState ?? 'unconfirmed',
        });
        importedTrustedArtists++;
      } catch {
        // Ignore invalid trusted artist entry
      }
    }
  }

  const verifiedRecords: VaultProofRecord[] = [];
  let rejectedProofs = 0;
  for (const entry of bundle.proofs) {
    if (!entry || typeof entry.proofBase64Url !== 'string') {
      rejectedProofs++;
      continue;
    }
    try {
      const rec = await verifyAndBuildVaultProofRecord({
        proofInput: base64UrlDecode(entry.proofBase64Url),
        creationMethod: entry.creationMethod,
        syncSelected: entry.syncSelected === true,
        createdAt: entry.createdAt,
      });
      verifiedRecords.push(rec);
    } catch {
      rejectedProofs++;
    }
  }

  await saveVaultProofBatch(verifiedRecords);

  return {
    importedProofs: verifiedRecords.length,
    rejectedProofs,
    importedTrustedArtists,
    restoredProfile,
  };
}

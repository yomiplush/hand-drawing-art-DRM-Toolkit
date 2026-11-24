import { computePublicKeyFingerprint, verifyEd25519Signature } from '../crypto/ed25519';
import { base64UrlDecode, base64UrlEncode, bytesToHex, sha256, sha256Sync } from '../crypto/sha256';
import { buildSigningMessage, decodeSignedProofEnvelope } from '../manifest/cborCodec';
import { extractProofBytesFromInput } from '../manifest/proofUrl';
import type { VaultTombstoneRecord } from '../policies/policyStore';
import {
  STORE_PROOF_VAULT,
  STORE_VAULT_TOMBSTONES,
  runChmTransaction,
  withChmStore,
} from '../storage/keyStore';
import {
  CHM_VAULT_SCHEMA_VERSION,
  type VaultProofDetailsSnapshot,
  type VaultProofRecord,
  type VaultQueryOptions,
  type VaultQueryResult,
  type VaultStats,
} from './types';

const utf8Encoder = new TextEncoder();

export async function verifyAndBuildVaultProofRecord(params: {
  proofInput: string | Uint8Array;
  creationMethod?: string;
  detailsSnapshot?: VaultProofDetailsSnapshot;
  syncSelected?: boolean;
  publicIndexOptIn?: boolean;
  createdAt?: string;
}): Promise<VaultProofRecord> {
  const proofBytes =
    params.proofInput instanceof Uint8Array
      ? params.proofInput
      : extractProofBytesFromInput(params.proofInput);

  const decoded = decodeSignedProofEnvelope(proofBytes);
  const signingMsg = buildSigningMessage(decoded.payloadBytes, decoded.version);
  const sigValid = await verifyEd25519Signature(
    decoded.manifest.publicKey,
    signingMsg,
    decoded.signature,
  );
  if (!sigValid) {
    throw new Error('Cannot store proof in vault: Ed25519 signature verification failed');
  }

  const proofDigest = await sha256(proofBytes);
  const id = bytesToHex(proofDigest);
  const fp = await computePublicKeyFingerprint(decoded.manifest.publicKey);
  const now = new Date().toISOString();

  const protocolVersion: 1 | 2 | 3 =
    decoded.version === 3 ? 3 : decoded.version === 2 ? 2 : 1;

  return {
    id,
    schemaVersion: CHM_VAULT_SCHEMA_VERSION,
    protocolVersion,
    artworkIdHex: decoded.manifest.artworkIdHex,
    authorPublicKeyBase64Url: base64UrlEncode(decoded.manifest.publicKey),
    authorFingerprintHex: fp.fullHex,
    authorFingerprintShort: fp.shortDisplay,
    authorName: decoded.manifest.authorName,
    artworkTitle: decoded.manifest.artworkTitle,
    creationMethod: (params.creationMethod ?? decoded.manifest.creationMethod)?.slice(0, 64),
    licenseId: decoded.manifest.license.licenseId,
    commercialUse: decoded.manifest.license.commercialUse,
    redistribution: decoded.manifest.license.redistribution,
    aiTraining: decoded.manifest.license.aiTraining,
    imageSha256Hex: bytesToHex(decoded.manifest.sha256),
    issuedAt: decoded.manifest.issuedAt,
    proofBase64Url: base64UrlEncode(proofBytes),
    ...(params.detailsSnapshot ? { detailsSnapshot: params.detailsSnapshot } : {}),
    syncSelected: params.syncSelected === true,
    publicIndexOptIn: params.publicIndexOptIn === true,
    createdAt: params.createdAt ?? now,
    updatedAt: now,
  };
}

/**
 * Synchronous record builder for high-volume batch operations where signature has
 * already been verified or is being created locally.
 */
export function buildCompactVaultRecordFromDecodedProof(params: {
  proofBytes: Uint8Array;
  authorFingerprintHex: string;
  authorFingerprintShort: string;
  creationMethod?: string;
  detailsSnapshot?: VaultProofDetailsSnapshot;
  syncSelected?: boolean;
  publicIndexOptIn?: boolean;
}): VaultProofRecord {
  const decoded = decodeSignedProofEnvelope(params.proofBytes);
  const id = bytesToHex(sha256Sync(params.proofBytes));
  const now = new Date().toISOString();
  const protocolVersion: 1 | 2 | 3 =
    decoded.version === 3 ? 3 : decoded.version === 2 ? 2 : 1;
  return {
    id,
    schemaVersion: CHM_VAULT_SCHEMA_VERSION,
    protocolVersion,
    artworkIdHex: decoded.manifest.artworkIdHex,
    authorPublicKeyBase64Url: base64UrlEncode(decoded.manifest.publicKey),
    authorFingerprintHex: params.authorFingerprintHex,
    authorFingerprintShort: params.authorFingerprintShort,
    authorName: decoded.manifest.authorName,
    artworkTitle: decoded.manifest.artworkTitle,
    creationMethod: (params.creationMethod ?? decoded.manifest.creationMethod)?.slice(0, 64),
    licenseId: decoded.manifest.license.licenseId,
    commercialUse: decoded.manifest.license.commercialUse,
    redistribution: decoded.manifest.license.redistribution,
    aiTraining: decoded.manifest.license.aiTraining,
    imageSha256Hex: bytesToHex(decoded.manifest.sha256),
    issuedAt: decoded.manifest.issuedAt,
    proofBase64Url: base64UrlEncode(params.proofBytes),
    ...(params.detailsSnapshot ? { detailsSnapshot: params.detailsSnapshot } : {}),
    syncSelected: params.syncSelected === true,
    publicIndexOptIn: params.publicIndexOptIn === true,
    createdAt: now,
    updatedAt: now,
  };
}

export async function saveProofToVault(params: {
  proofInput: string | Uint8Array;
  creationMethod?: string;
  detailsSnapshot?: VaultProofDetailsSnapshot;
  syncSelected?: boolean;
  publicIndexOptIn?: boolean;
}): Promise<VaultProofRecord> {
  const next = await verifyAndBuildVaultProofRecord(params);
  const existing = await getVaultProof(next.id);
  const merged: VaultProofRecord = existing
    ? {
        ...existing,
        ...next,
        detailsSnapshot: params.detailsSnapshot ?? existing.detailsSnapshot,
        syncSelected: params.syncSelected ?? existing.syncSelected,
        publicIndexOptIn: params.publicIndexOptIn ?? existing.publicIndexOptIn,
        lastSyncedAt: existing.lastSyncedAt,
        lastSyncedEventId: existing.lastSyncedEventId,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      }
    : next;
  await runChmTransaction([STORE_PROOF_VAULT, STORE_VAULT_TOMBSTONES], 'readwrite', (tx) => {
    tx.objectStore(STORE_PROOF_VAULT).put(merged);
    tx.objectStore(STORE_VAULT_TOMBSTONES).delete(`proof:${merged.id}`);
  });
  return merged;
}

export async function saveVaultProofBatch(records: VaultProofRecord[]): Promise<number> {
  if (records.length === 0) return 0;
  await runChmTransaction([STORE_PROOF_VAULT], 'readwrite', (tx) => {
    const store = tx.objectStore(STORE_PROOF_VAULT);
    for (const rec of records) {
      store.put(rec);
    }
  });
  return records.length;
}

export async function getVaultProof(id: string): Promise<VaultProofRecord | undefined> {
  try {
    const raw = await withChmStore<VaultProofRecord | undefined>(STORE_PROOF_VAULT, 'readonly', (s) =>
      s.get(id),
    );
    return raw && typeof raw.id === 'string' ? raw : undefined;
  } catch {
    return undefined;
  }
}

export async function listAllVaultProofs(): Promise<VaultProofRecord[]> {
  try {
    const rows = await withChmStore<VaultProofRecord[]>(STORE_PROOF_VAULT, 'readonly', (s) =>
      s.getAll(),
    );
    return (rows ?? [])
      .filter((r) => r && typeof r.id === 'string' && typeof r.proofBase64Url === 'string')
      .sort((a, b) => b.issuedAt - a.issuedAt || b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export function estimateVaultRecordBytes(record: VaultProofRecord): number {
  return utf8Encoder.encode(JSON.stringify(record)).byteLength;
}

export async function queryVaultProofs(options?: VaultQueryOptions): Promise<VaultQueryResult> {
  const all = await listAllVaultProofs();
  const q = options?.query?.trim().toLowerCase() ?? '';
  const licenseFilter = options?.licenseId?.trim();
  const fpFilter = options?.authorFingerprintHex?.trim().toLowerCase();
  const syncOnly = options?.syncSelectedOnly === true;

  const filtered = all.filter((item) => {
    if (syncOnly && !item.syncSelected) return false;
    if (licenseFilter && item.licenseId !== licenseFilter) return false;
    if (fpFilter && item.authorFingerprintHex.toLowerCase() !== fpFilter) return false;
    if (q) {
      const hay = [
        item.artworkTitle ?? '',
        item.authorName ?? '',
        item.artworkIdHex,
        item.authorFingerprintShort,
        item.authorFingerprintHex,
        item.imageSha256Hex,
        item.licenseId,
        item.id,
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  let estimatedBytes = 0;
  for (const item of filtered) {
    estimatedBytes += estimateVaultRecordBytes(item);
  }

  const offset = Math.max(0, options?.offset ?? 0);
  const limit = Math.max(1, Math.min(500, options?.limit ?? 100));
  return {
    items: filtered.slice(offset, offset + limit),
    totalCount: filtered.length,
    estimatedBytes,
  };
}

export async function computeVaultStats(): Promise<VaultStats> {
  const all = await listAllVaultProofs();
  let estimatedTotalBytes = 0;
  let syncSelectedCount = 0;
  for (const item of all) {
    estimatedTotalBytes += estimateVaultRecordBytes(item);
    if (item.syncSelected) syncSelectedCount++;
  }
  return {
    totalProofs: all.length,
    syncSelectedCount,
    estimatedTotalBytes,
    avgBytesPerProof: all.length > 0 ? Math.round(estimatedTotalBytes / all.length) : 0,
  };
}

export async function setVaultProofSyncSelected(id: string, syncSelected: boolean): Promise<void> {
  await runChmTransaction([STORE_PROOF_VAULT], 'readwrite', (tx) => {
    const store = tx.objectStore(STORE_PROOF_VAULT);
    const req = store.get(id);
    req.onsuccess = () => {
      const existing = req.result as VaultProofRecord | undefined;
      if (!existing) return;
      store.put({
        ...existing,
        syncSelected,
        updatedAt: new Date().toISOString(),
      } satisfies VaultProofRecord);
    };
  });
}

export async function markVaultProofsSynced(
  ids: string[],
  eventId?: string,
): Promise<void> {
  if (ids.length === 0) return;
  const now = new Date().toISOString();
  await runChmTransaction([STORE_PROOF_VAULT], 'readwrite', (tx) => {
    const store = tx.objectStore(STORE_PROOF_VAULT);
    for (const id of ids) {
      const req = store.get(id);
      req.onsuccess = () => {
        const existing = req.result as VaultProofRecord | undefined;
        if (!existing) return;
        store.put({
          ...existing,
          lastSyncedAt: now,
          lastSyncedEventId: eventId ?? existing.lastSyncedEventId,
          updatedAt: now,
        } satisfies VaultProofRecord);
      };
    }
  });
}

export async function deleteVaultProof(id: string): Promise<void> {
  const deletedAt = new Date().toISOString();
  await runChmTransaction([STORE_PROOF_VAULT, STORE_VAULT_TOMBSTONES], 'readwrite', (tx) => {
    tx.objectStore(STORE_PROOF_VAULT).delete(id);
    const tombstone: VaultTombstoneRecord = {
      id: `proof:${id}`,
      entityType: 'proof',
      entityId: id,
      deletedAt,
      version: 1,
    };
    tx.objectStore(STORE_VAULT_TOMBSTONES).put(tombstone);
  });
}

export async function clearVaultProofs(): Promise<void> {
  const all = await listAllVaultProofs();
  if (all.length === 0) return;
  await runChmTransaction([STORE_PROOF_VAULT], 'readwrite', (tx) => {
    const store = tx.objectStore(STORE_PROOF_VAULT);
    for (const item of all) {
      store.delete(item.id);
    }
  });
}

export function decodeVaultProofBytes(record: VaultProofRecord): Uint8Array {
  return base64UrlDecode(record.proofBase64Url);
}

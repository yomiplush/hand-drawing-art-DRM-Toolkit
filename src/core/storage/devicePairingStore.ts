import {
  assertStrictEd25519PublicKey,
  base64UrlDecode,
  base64UrlEncode,
  computePublicKeyFingerprintSync,
  createSignedDeviceRegistrySnapshot,
  createSignedDeviceRevocationNotice,
  createSignedEnrollmentCertificate,
  createSignedPairingRequest,
  decodeAndVerifyDeviceRegistryInput,
  decodeAndVerifyDeviceRevocationBytes,
  decodeAndVerifyEnrollmentCertificateBytes,
  decodeAndVerifyPairingRequestBytes,
  encodeDeviceRevocationUrl,
  encodeEnrollmentCertificateUrl,
  encodePairingRequestUrl,
  parsePairingQrInput,
  reconcileRegistrySnapshotImport,
  serializeDeviceRegistryJson,
  verifyEnrollmentCertificateBinding,
} from '@yomiplush/chm-exchange/core';
import type {
  DeviceLocalVerificationStatus,
  DevicePermission,
  DeviceRevocationReason,
  HostDeviceIdentity,
  PairedDeviceRegistryEntry,
  SignedDeviceRegistrySnapshot,
  SignedDeviceRevocationNotice,
  SignedEnrollmentCertificate,
  SignedPairingRequest,
  VerifiedPairingBindingResult,
  VerifiedRegistryReconciliationResult,
} from '@yomiplush/chm-exchange/core';
import {
  generateEd25519KeyMaterial,
  isValidStrictEd25519PublicKey,
  signWithCryptoKey,
  signWithSeed,
} from '../crypto/ed25519';
import { decryptKeyBackup, encryptKeyBackup } from '../crypto/keyBackup';
import type { EncryptedKeyBackup } from '../crypto/keyBackup';
import {
  STORE_DEVICE_IDENTITIES,
  STORE_DEVICE_REVOCATIONS,
  STORE_PAIRED_DEVICES,
  STORE_PAIRING_SESSIONS,
  STORE_USED_PAIRING_NONCES,
  addTrustedKey,
  getAuthorKey,
  idbReqToPromise,
  listAuthorKeys,
  listTrustedKeys,
  runChmTransaction,
  signWithAuthorKey,
  withChmStore,
} from './keyStore';

export interface DeviceIdentityRecord {
  deviceIdHex: string;
  deviceIdBytes: Uint8Array;
  deviceName: string;
  publicKey: Uint8Array;
  publicKeyBase64Url: string;
  fingerprintHex: string;
  fingerprintShort: string;
  storageMode: 'webcrypto-non-extractable' | 'noble-encrypted-seed';
  webCryptoPrivateKey?: CryptoKey;
  encryptedBackup?: EncryptedKeyBackup;
  revokedLocally?: boolean;
  createdAt: string;
}

export type PairingSessionStatus = 'pending' | 'completed' | 'cancelled' | 'expired';

export interface PairingSessionRecord {
  requestIdHex: string;
  nonceHex: string;
  deviceIdHex: string;
  devicePublicKeyBase64Url: string;
  deviceName: string;
  requestEnvelopeBytes: Uint8Array;
  requestToken: string;
  requestHashHex: string;
  qrUrl: string;
  issuedAt: number;
  expiresAt: number;
  status: PairingSessionStatus;
  createdAt: string;
  completedAt?: string;
}

export interface UsedPairingNonceRecord {
  key: string; // "req:<requestIdHex>" or "nonce:<nonceHex>"
  kind: 'request-id' | 'nonce';
  consumedAt: number;
  reason: 'completed' | 'approved' | 'cancelled' | 'expired';
}

export interface PairedDeviceRecord extends PairedDeviceRegistryEntry {
  key: string; // `${ownerFingerprintHex}:${deviceIdHex}`
  ownerConfirmedTrust: boolean;
  updatedAt: string;
}

export interface DeviceRevocationRecord {
  key: string; // `${ownerFingerprintHex}:${deviceIdHex}`
  ownerFingerprintHex: string;
  ownerPublicKeyBase64Url: string;
  deviceIdHex: string;
  devicePublicKeyBase64Url: string;
  sequence: number;
  revokedAt: number;
  reason: DeviceRevocationReason;
  note?: string;
  token: string;
  importedAt: string;
}

export interface StorageCorruptionWarning {
  store: string;
  recordKey: string;
  reason: string;
}

export interface DevicePairingLoadResult {
  localDevice: DeviceIdentityRecord | null;
  pendingSessions: PairingSessionRecord[];
  pairedDevices: PairedDeviceRecord[];
  revocations: DeviceRevocationRecord[];
  corruptionWarnings: StorageCorruptionWarning[];
}

export interface PairingRequestInspection {
  request: SignedPairingRequest;
  alreadyConsumed: boolean;
  expired: boolean;
  deviceRevoked: boolean;
  alreadyRegisteredUnderOwner: boolean;
}

export interface EnrollmentCertificateInspection {
  certificate: SignedEnrollmentCertificate;
  session: PairingSessionRecord;
  verification: VerifiedPairingBindingResult;
  requiresOwnerTrustConfirmation: boolean;
  deviceRevoked: boolean;
  alreadyRegistered: boolean;
}

function generateUuidV4Bytes(): { bytes: Uint8Array; hex: string } {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return {
    bytes,
    hex: `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`,
  };
}

function sanitizeLocalDeviceName(raw: string): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = raw.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '').trim();
  const encoder = new TextEncoder();
  let out = cleaned || 'My Device';
  while (encoder.encode(out).length > 64) {
    out = out.slice(0, -1);
  }
  return out || 'My Device';
}

function isValidDeviceIdentityRecord(raw: unknown): raw is DeviceIdentityRecord {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const r = raw as Partial<DeviceIdentityRecord>;
  if (
    typeof r.deviceIdHex !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(r.deviceIdHex) ||
    !(r.deviceIdBytes instanceof Uint8Array) ||
    r.deviceIdBytes.length !== 16 ||
    typeof r.deviceName !== 'string' ||
    r.deviceName.trim().length === 0 ||
    !(r.publicKey instanceof Uint8Array) ||
    r.publicKey.length !== 32 ||
    !isValidStrictEd25519PublicKey(r.publicKey) ||
    typeof r.publicKeyBase64Url !== 'string' ||
    base64UrlEncode(r.publicKey) !== r.publicKeyBase64Url ||
    typeof r.fingerprintHex !== 'string' ||
    typeof r.fingerprintShort !== 'string' ||
    typeof r.createdAt !== 'string'
  ) {
    return false;
  }
  try {
    const fp = computePublicKeyFingerprintSync(r.publicKey);
    if (fp.fullHex !== r.fingerprintHex || fp.shortDisplay !== r.fingerprintShort) {
      return false;
    }
  } catch {
    return false;
  }
  if (r.storageMode === 'webcrypto-non-extractable') {
    return Boolean(r.webCryptoPrivateKey);
  }
  if (r.storageMode === 'noble-encrypted-seed') {
    return Boolean(r.encryptedBackup && typeof r.encryptedBackup === 'object');
  }
  return false;
}

function isValidPairingSessionRecord(raw: unknown): raw is PairingSessionRecord {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const s = raw as Partial<PairingSessionRecord>;
  if (
    typeof s.requestIdHex !== 'string' ||
    typeof s.nonceHex !== 'string' ||
    typeof s.deviceIdHex !== 'string' ||
    typeof s.devicePublicKeyBase64Url !== 'string' ||
    typeof s.deviceName !== 'string' ||
    !(s.requestEnvelopeBytes instanceof Uint8Array) ||
    typeof s.requestToken !== 'string' ||
    typeof s.requestHashHex !== 'string' ||
    typeof s.issuedAt !== 'number' ||
    typeof s.expiresAt !== 'number' ||
    (s.status !== 'pending' &&
      s.status !== 'completed' &&
      s.status !== 'cancelled' &&
      s.status !== 'expired')
  ) {
    return false;
  }
  try {
    const verified = decodeAndVerifyPairingRequestBytes(s.requestEnvelopeBytes);
    return (
      verified.payload.requestIdHex === s.requestIdHex &&
      verified.payload.nonceHex === s.nonceHex &&
      verified.payload.deviceIdHex === s.deviceIdHex &&
      verified.payload.devicePublicKeyBase64Url === s.devicePublicKeyBase64Url &&
      verified.requestHashHex === s.requestHashHex
    );
  } catch {
    return false;
  }
}

function isValidDeviceRevocationRecord(raw: unknown): raw is DeviceRevocationRecord {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const rec = raw as Partial<DeviceRevocationRecord>;
  if (
    typeof rec.key !== 'string' ||
    typeof rec.ownerFingerprintHex !== 'string' ||
    typeof rec.deviceIdHex !== 'string' ||
    typeof rec.devicePublicKeyBase64Url !== 'string' ||
    typeof rec.token !== 'string' ||
    typeof rec.sequence !== 'number'
  ) {
    return false;
  }
  try {
    const parsed = parsePairingQrInput(rec.token);
    if (parsed.kind !== 'device-revocation') return false;
    const rev = parsed.revocation;
    return (
      rec.key === `${rev.payload.ownerFingerprintHex}:${rev.payload.deviceIdHex}` &&
      rec.ownerFingerprintHex === rev.payload.ownerFingerprintHex &&
      rec.deviceIdHex === rev.payload.deviceIdHex &&
      rec.devicePublicKeyBase64Url === rev.payload.devicePublicKeyBase64Url &&
      rec.sequence === rev.payload.sequence
    );
  } catch {
    return false;
  }
}

function isValidPairedDeviceRecord(raw: unknown): raw is PairedDeviceRecord {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const rec = raw as Partial<PairedDeviceRecord>;
  if (
    typeof rec.key !== 'string' ||
    typeof rec.ownerFingerprintHex !== 'string' ||
    typeof rec.ownerFingerprintShort !== 'string' ||
    typeof rec.ownerPublicKeyBase64Url !== 'string' ||
    typeof rec.ownerDisplayName !== 'string' ||
    typeof rec.deviceIdHex !== 'string' ||
    typeof rec.devicePublicKeyBase64Url !== 'string' ||
    typeof rec.deviceFingerprintHex !== 'string' ||
    typeof rec.deviceFingerprintShort !== 'string' ||
    typeof rec.deviceName !== 'string' ||
    !Array.isArray(rec.permissions) ||
    typeof rec.issuedAt !== 'number' ||
    typeof rec.localVerificationStatus !== 'string'
  ) {
    return false;
  }
  if (rec.key !== `${rec.ownerFingerprintHex}:${rec.deviceIdHex}`) {
    return false;
  }
  try {
    const ownerPk = assertStrictEd25519PublicKey(rec.ownerPublicKeyBase64Url, 'ownerPublicKey');
    const devicePk = assertStrictEd25519PublicKey(rec.devicePublicKeyBase64Url, 'devicePublicKey');
    const ownerFp = computePublicKeyFingerprintSync(ownerPk);
    const deviceFp = computePublicKeyFingerprintSync(devicePk);
    if (
      ownerFp.fullHex !== rec.ownerFingerprintHex ||
      ownerFp.shortDisplay !== rec.ownerFingerprintShort ||
      deviceFp.fullHex !== rec.deviceFingerprintHex ||
      deviceFp.shortDisplay !== rec.deviceFingerprintShort
    ) {
      return false;
    }

    if (typeof rec.enrollmentToken === 'string' && rec.enrollmentToken.length > 0) {
      const parsed = parsePairingQrInput(rec.enrollmentToken);
      if (parsed.kind !== 'enrollment-certificate') return false;
      const c = parsed.certificate.payload;
      if (
        c.ownerFingerprintHex !== rec.ownerFingerprintHex ||
        c.ownerPublicKeyBase64Url !== rec.ownerPublicKeyBase64Url ||
        c.deviceIdHex !== rec.deviceIdHex ||
        c.devicePublicKeyBase64Url !== rec.devicePublicKeyBase64Url
      ) {
        return false;
      }
    } else if (rec.localVerificationStatus !== 'revoked') {
      return false;
    }

    if (rec.revocationNoticeToken) {
      const parsedRev = parsePairingQrInput(rec.revocationNoticeToken);
      if (parsedRev.kind !== 'device-revocation') return false;
      if (
        rec.localVerificationStatus !== 'revoked' &&
        rec.localVerificationStatus !== 'conflict-revoked'
      ) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export function toPublicHostDeviceIdentity(record: DeviceIdentityRecord): HostDeviceIdentity {
  return {
    deviceIdHex: record.deviceIdHex,
    deviceName: record.deviceName,
    publicKeyBase64Url: record.publicKeyBase64Url,
    fingerprintHex: record.fingerprintHex,
    fingerprintShort: record.fingerprintShort,
    storageMode: record.storageMode,
    createdAt: record.createdAt,
  };
}

export async function getAllTrustedOwnerKeysSet(): Promise<Set<string>> {
  const [authors, trusted] = await Promise.all([listAuthorKeys(), listTrustedKeys()]);
  const set = new Set<string>();
  for (const a of authors) {
    set.add(a.publicKeyBase64Url);
  }
  for (const t of trusted) {
    if (t.verificationState !== 'unconfirmed') {
      set.add(t.publicKeyBase64Url);
    }
  }
  return set;
}

export async function signWithLocalDeviceIdentity(
  device: DeviceIdentityRecord,
  message: Uint8Array,
  passphraseIfEncrypted?: string,
): Promise<Uint8Array> {
  if (device.revokedLocally) {
    throw new Error('This device key has been revoked and cannot sign new pairing requests.');
  }
  if (device.storageMode === 'webcrypto-non-extractable' && device.webCryptoPrivateKey) {
    return signWithCryptoKey(device.webCryptoPrivateKey, message);
  }
  if (!device.encryptedBackup) {
    throw new Error('No local device signing key available');
  }
  if (!passphraseIfEncrypted) {
    throw new Error('Passphrase required to unlock encrypted device key');
  }
  const decrypted = await decryptKeyBackup(device.encryptedBackup, passphraseIfEncrypted);
  try {
    return signWithSeed(decrypted.seed32, message);
  } finally {
    decrypted.seed32.fill(0);
  }
}

export async function getLocalDeviceIdentity(): Promise<{
  device: DeviceIdentityRecord | null;
  corruptionWarnings: StorageCorruptionWarning[];
}> {
  const warnings: StorageCorruptionWarning[] = [];
  let rows: unknown[];
  try {
    rows = await withChmStore<unknown[]>(STORE_DEVICE_IDENTITIES, 'readonly', (s) => s.getAll());
  } catch {
    return { device: null, corruptionWarnings: warnings };
  }

  const valid: DeviceIdentityRecord[] = [];
  for (const row of rows ?? []) {
    if (isValidDeviceIdentityRecord(row)) {
      valid.push(row);
    } else {
      const maybeKey =
        row && typeof row === 'object' && 'deviceIdHex' in row
          ? String((row as { deviceIdHex: unknown }).deviceIdHex)
          : 'unknown';
      warnings.push({
        store: STORE_DEVICE_IDENTITIES,
        recordKey: maybeKey,
        reason: 'Corrupt or tampered device identity record detected in IndexedDB.',
      });
    }
  }

  if (valid.length === 0) {
    return { device: null, corruptionWarnings: warnings };
  }

  valid.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const active = valid.find((d) => !d.revokedLocally) ?? valid[0];

  const revocations = await loadRevocationRecords();
  const isRevoked = revocations.records.some(
    (r) =>
      r.devicePublicKeyBase64Url === active.publicKeyBase64Url ||
      r.deviceIdHex === active.deviceIdHex,
  );
  if (isRevoked && !active.revokedLocally) {
    active.revokedLocally = true;
    await withChmStore(STORE_DEVICE_IDENTITIES, 'readwrite', (s) => s.put(active)).catch(() => {});
  }

  return { device: active, corruptionWarnings: warnings };
}

export async function createOrReplaceLocalDeviceIdentity(params: {
  deviceName: string;
  backupPassphrase?: string;
  forceNew?: boolean;
}): Promise<DeviceIdentityRecord> {
  if (!params.forceNew) {
    const existing = await getLocalDeviceIdentity();
    if (existing.device && !existing.device.revokedLocally) {
      const sanitized = sanitizeLocalDeviceName(params.deviceName);
      if (sanitized !== existing.device.deviceName) {
        const updated: DeviceIdentityRecord = { ...existing.device, deviceName: sanitized };
        await withChmStore(STORE_DEVICE_IDENTITIES, 'readwrite', (s) => s.put(updated));
        return updated;
      }
      return existing.device;
    }
    if (existing.device?.revokedLocally) {
      throw new Error(
        'Current device key has been revoked. Reset or generate a new Device Identity explicitly.',
      );
    }
  }

  const deviceName = sanitizeLocalDeviceName(params.deviceName);
  const material = await generateEd25519KeyMaterial();
  try {
    if (material.storageMode === 'noble-encrypted-seed' && !params.backupPassphrase) {
      throw new Error(
        'This browser requires a passphrase for fallback encrypted device key storage (Web Crypto Ed25519 unavailable).',
      );
    }

    let encryptedBackup: EncryptedKeyBackup | undefined;
    if (params.backupPassphrase && params.backupPassphrase.length > 0) {
      encryptedBackup = await encryptKeyBackup({
        seed32: material.seed32,
        publicKey32: material.publicKey,
        passphrase: params.backupPassphrase,
        label: deviceName,
      });
    }

    const { bytes: deviceIdBytes, hex: deviceIdHex } = generateUuidV4Bytes();
    const fp = computePublicKeyFingerprintSync(material.publicKey);
    const record: DeviceIdentityRecord = {
      deviceIdHex,
      deviceIdBytes,
      deviceName,
      publicKey: material.publicKey,
      publicKeyBase64Url: base64UrlEncode(material.publicKey),
      fingerprintHex: fp.fullHex,
      fingerprintShort: fp.shortDisplay,
      storageMode: material.storageMode,
      webCryptoPrivateKey: material.webCryptoPrivateKey,
      encryptedBackup,
      revokedLocally: false,
      createdAt: new Date().toISOString(),
    };

    await withChmStore(STORE_DEVICE_IDENTITIES, 'readwrite', (s) => s.put(record));
    return record;
  } finally {
    material.wipeSeed();
  }
}

async function loadRevocationRecords(): Promise<{
  records: DeviceRevocationRecord[];
  warnings: StorageCorruptionWarning[];
}> {
  const warnings: StorageCorruptionWarning[] = [];
  let rows: unknown[];
  try {
    rows = await withChmStore<unknown[]>(STORE_DEVICE_REVOCATIONS, 'readonly', (s) => s.getAll());
  } catch {
    return { records: [], warnings };
  }
  const records: DeviceRevocationRecord[] = [];
  for (const row of rows ?? []) {
    if (isValidDeviceRevocationRecord(row)) {
      records.push(row);
    } else {
      warnings.push({
        store: STORE_DEVICE_REVOCATIONS,
        recordKey:
          row && typeof row === 'object' && 'key' in row
            ? String((row as { key: unknown }).key)
            : 'unknown',
        reason: 'Corrupt revocation notice entry detected in IndexedDB and quarantined.',
      });
    }
  }
  return { records, warnings };
}

async function loadUsedNonceSet(): Promise<Set<string>> {
  try {
    const rows = await withChmStore<UsedPairingNonceRecord[]>(
      STORE_USED_PAIRING_NONCES,
      'readonly',
      (s) => s.getAll(),
    );
    return new Set((rows ?? []).map((r) => r.key));
  } catch {
    return new Set();
  }
}

export async function loadDevicePairingState(): Promise<DevicePairingLoadResult> {
  const warnings: StorageCorruptionWarning[] = [];
  const [{ device, corruptionWarnings: devWarn }, revRes] = await Promise.all([
    getLocalDeviceIdentity(),
    loadRevocationRecords(),
  ]);
  warnings.push(...devWarn, ...revRes.warnings);

  const [rawSessions, rawPaired, trustedOwnerKeys] = await Promise.all([
    withChmStore<unknown[]>(STORE_PAIRING_SESSIONS, 'readonly', (s) => s.getAll()).catch(() => []),
    withChmStore<unknown[]>(STORE_PAIRED_DEVICES, 'readonly', (s) => s.getAll()).catch(() => []),
    getAllTrustedOwnerKeysSet(),
  ]);

  const nowUnix = Math.floor(Date.now() / 1000);
  const pendingSessions: PairingSessionRecord[] = [];
  for (const row of rawSessions ?? []) {
    if (!isValidPairingSessionRecord(row)) {
      warnings.push({
        store: STORE_PAIRING_SESSIONS,
        recordKey:
          row && typeof row === 'object' && 'requestIdHex' in row
            ? String((row as { requestIdHex: unknown }).requestIdHex)
            : 'unknown',
        reason: 'Corrupt pairing session record detected in IndexedDB and ignored.',
      });
      continue;
    }
    if (row.status === 'pending') {
      if (row.expiresAt < nowUnix) {
        row.status = 'expired';
      } else {
        pendingSessions.push(row);
      }
    }
  }
  pendingSessions.sort((a, b) => b.issuedAt - a.issuedAt);

  const revByKey = new Map<string, DeviceRevocationRecord>();
  const revByDevicePub = new Set<string>();
  for (const rev of revRes.records) {
    revByKey.set(rev.key, rev);
    revByDevicePub.add(rev.devicePublicKeyBase64Url);
  }

  const pairedDevices: PairedDeviceRecord[] = [];
  for (const row of rawPaired ?? []) {
    if (!isValidPairedDeviceRecord(row)) {
      warnings.push({
        store: STORE_PAIRED_DEVICES,
        recordKey:
          row && typeof row === 'object' && 'key' in row
            ? String((row as { key: unknown }).key)
            : 'unknown',
        reason: 'Corrupt or tampered paired-device record detected in IndexedDB; trust withheld.',
      });
      continue;
    }

    const revMatch = revByKey.get(row.key);
    const ownerTrusted =
      row.ownerConfirmedTrust || trustedOwnerKeys.has(row.ownerPublicKeyBase64Url);

    let effectiveStatus: DeviceLocalVerificationStatus = row.localVerificationStatus;
    if (effectiveStatus !== 'conflict-revoked') {
      if (revMatch || revByDevicePub.has(row.devicePublicKeyBase64Url)) {
        effectiveStatus = 'revoked';
      } else if (ownerTrusted) {
        effectiveStatus = 'active-trusted';
      } else {
        effectiveStatus = 'active-unverified-owner';
      }
    }

    pairedDevices.push({
      ...row,
      revocationNoticeToken: revMatch?.token ?? row.revocationNoticeToken,
      revokedAt: revMatch?.revokedAt ?? row.revokedAt,
      revocationReason: revMatch?.reason ?? row.revocationReason,
      revocationSequence: revMatch?.sequence ?? row.revocationSequence,
      localVerificationStatus: effectiveStatus,
    });
  }
  pairedDevices.sort((a, b) => b.issuedAt - a.issuedAt);

  return {
    localDevice: device,
    pendingSessions,
    pairedDevices,
    revocations: revRes.records,
    corruptionWarnings: warnings,
  };
}

export async function clearCorruptDevicePairingRecord(
  store: string,
  recordKey: string,
): Promise<void> {
  const allowed = new Set([
    STORE_DEVICE_IDENTITIES,
    STORE_PAIRING_SESSIONS,
    STORE_PAIRED_DEVICES,
    STORE_DEVICE_REVOCATIONS,
  ]);
  if (!allowed.has(store)) {
    throw new Error('Unsupported store for cleanup');
  }
  await withChmStore(store, 'readwrite', (s) => s.delete(recordKey));
}

export async function startDevicePairingRequestSession(params: {
  deviceName: string;
  devicePassphrase?: string;
  ownerPublicKey?: string;
  ownerFingerprintHex?: string;
  baseUrl?: string;
  ttlSeconds?: number;
  permissions?: DevicePermission[];
}): Promise<{
  session: PairingSessionRecord;
  request: SignedPairingRequest;
  qrUrl: string;
}> {
  const existing = await getLocalDeviceIdentity();
  if (existing.device?.revokedLocally) {
    throw new Error(
      'This device key has been revoked locally. Generate a new Device Identity before pairing again.',
    );
  }

  const device = await createOrReplaceLocalDeviceIdentity({
    deviceName: params.deviceName,
    backupPassphrase: params.devicePassphrase,
  });

  if (device.revokedLocally) {
    throw new Error('Revoked device identity cannot create pairing requests.');
  }

  const request = await createSignedPairingRequest({
    deviceId: device.deviceIdBytes,
    devicePublicKey: device.publicKey,
    deviceDisplayName: params.deviceName.trim() || device.deviceName,
    signWithDeviceKey: (msg) => signWithLocalDeviceIdentity(device, msg, params.devicePassphrase),
    ownerPublicKey: params.ownerPublicKey,
    ownerFingerprintHex: params.ownerFingerprintHex,
    ttlSeconds: params.ttlSeconds,
    permissions: params.permissions ?? ['device-identity'],
  });

  const baseUrl =
    params.baseUrl ??
    (typeof window !== 'undefined'
      ? `${window.location.origin}/devices`
      : 'https://certified-handmade.com/devices');
  const qrUrl = encodePairingRequestUrl(request, baseUrl);

  const session: PairingSessionRecord = {
    requestIdHex: request.payload.requestIdHex,
    nonceHex: request.payload.nonceHex,
    deviceIdHex: request.payload.deviceIdHex,
    devicePublicKeyBase64Url: request.payload.devicePublicKeyBase64Url,
    deviceName: request.payload.deviceDisplayName,
    requestEnvelopeBytes: request.envelopeBytes,
    requestToken: request.token,
    requestHashHex: request.requestHashHex,
    qrUrl,
    issuedAt: request.payload.issuedAt,
    expiresAt: request.payload.expiresAt,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  await withChmStore(STORE_PAIRING_SESSIONS, 'readwrite', (s) => s.put(session));
  return { session, request, qrUrl };
}

export async function cancelPairingSession(requestIdHex: string): Promise<void> {
  const existing = await withChmStore<unknown>(STORE_PAIRING_SESSIONS, 'readonly', (s) =>
    s.get(requestIdHex),
  );
  if (!isValidPairingSessionRecord(existing)) {
    return;
  }
  const nowUnix = Math.floor(Date.now() / 1000);
  await runChmTransaction([STORE_PAIRING_SESSIONS, STORE_USED_PAIRING_NONCES], 'readwrite', (tx) => {
    const sessStore = tx.objectStore(STORE_PAIRING_SESSIONS);
    const nonceStore = tx.objectStore(STORE_USED_PAIRING_NONCES);
    sessStore.put({ ...existing, status: 'cancelled' satisfies PairingSessionStatus });
    nonceStore.put({
      key: `req:${existing.requestIdHex}`,
      kind: 'request-id',
      consumedAt: nowUnix,
      reason: 'cancelled',
    } satisfies UsedPairingNonceRecord);
    nonceStore.put({
      key: `nonce:${existing.nonceHex}`,
      kind: 'nonce',
      consumedAt: nowUnix,
      reason: 'cancelled',
    } satisfies UsedPairingNonceRecord);
  });
}

export async function inspectPairingRequestForApproval(params: {
  rawInput: string | Uint8Array;
  ownerPublicKeyBase64Url?: string;
  ownerFingerprintHex?: string;
  nowUnix?: number;
}): Promise<PairingRequestInspection> {
  const parsed = parsePairingQrInput(params.rawInput);
  if (parsed.kind !== 'pairing-request') {
    throw new Error('Expected a CHM-DEVICE-PAIRING-v1 Pairing Request QR or token.');
  }
  const request = parsed.request;
  const nowUnix = params.nowUnix ?? Math.floor(Date.now() / 1000);

  const [usedNonces, state] = await Promise.all([loadUsedNonceSet(), loadDevicePairingState()]);
  const alreadyConsumed =
    usedNonces.has(`req:${request.payload.requestIdHex}`) ||
    usedNonces.has(`nonce:${request.payload.nonceHex}`);
  const expired = nowUnix > request.payload.expiresAt;

  const deviceRevoked = state.revocations.some(
    (r) =>
      r.devicePublicKeyBase64Url === request.payload.devicePublicKeyBase64Url ||
      (params.ownerFingerprintHex
        ? r.ownerFingerprintHex === params.ownerFingerprintHex &&
          r.deviceIdHex === request.payload.deviceIdHex
        : false),
  );

  const alreadyRegisteredUnderOwner = state.pairedDevices.some(
    (d) =>
      (!params.ownerFingerprintHex || d.ownerFingerprintHex === params.ownerFingerprintHex) &&
      (d.devicePublicKeyBase64Url === request.payload.devicePublicKeyBase64Url ||
        d.deviceIdHex === request.payload.deviceIdHex) &&
      d.localVerificationStatus !== 'revoked' &&
      d.localVerificationStatus !== 'conflict-revoked',
  );

  if (
    params.ownerPublicKeyBase64Url &&
    request.payload.ownerTarget.kind === 'pinned-public-key' &&
    base64UrlEncode(request.payload.ownerTarget.ownerPublicKey) !== params.ownerPublicKeyBase64Url
  ) {
    throw new Error('This pairing request is pinned to a different CHM Owner Identity.');
  }

  return {
    request,
    alreadyConsumed,
    expired,
    deviceRevoked,
    alreadyRegisteredUnderOwner,
  };
}

export async function approvePairingRequestAsOwner(params: {
  rawRequestInput: string | Uint8Array;
  authorKeyId: string;
  passphrase?: string;
  baseUrl?: string;
  nowUnix?: number;
}): Promise<{
  certificate: SignedEnrollmentCertificate;
  qrUrl: string;
  pairedDevice: PairedDeviceRecord;
}> {
  const ownerKey = await getAuthorKey(params.authorKeyId);
  if (!ownerKey) {
    throw new Error('Selected Owner CHM Identity was not found on this device.');
  }

  const inspection = await inspectPairingRequestForApproval({
    rawInput: params.rawRequestInput,
    ownerPublicKeyBase64Url: ownerKey.publicKeyBase64Url,
    ownerFingerprintHex: ownerKey.fingerprintHex,
    nowUnix: params.nowUnix,
  });

  if (inspection.alreadyConsumed) {
    throw new Error('Replay blocked: this pairing request ID or nonce has already been used.');
  }
  if (inspection.expired) {
    throw new Error('This pairing request has expired. Generate a fresh QR code on the new device.');
  }
  if (inspection.deviceRevoked) {
    throw new Error('This device key has been revoked and cannot be re-enrolled.');
  }
  if (inspection.alreadyRegisteredUnderOwner) {
    throw new Error('Double-registration blocked: this device is already registered under this CHM Identity.');
  }

  const nowUnix = params.nowUnix ?? Math.floor(Date.now() / 1000);
  const certificate = await createSignedEnrollmentCertificate({
    request: inspection.request,
    ownerPublicKey: ownerKey.publicKey,
    ownerDisplayName: ownerKey.label,
    signWithOwnerKey: (msg) => signWithAuthorKey(ownerKey, msg, params.passphrase),
    grantedPermissions: ['device-identity'],
    nowUnix,
  });

  const baseUrl =
    params.baseUrl ??
    (typeof window !== 'undefined'
      ? `${window.location.origin}/devices`
      : 'https://certified-handmade.com/devices');
  const qrUrl = encodeEnrollmentCertificateUrl(certificate, baseUrl);

  const key = `${certificate.payload.ownerFingerprintHex}:${certificate.payload.deviceIdHex}`;
  const pairedDevice: PairedDeviceRecord = {
    key,
    ownerFingerprintHex: certificate.payload.ownerFingerprintHex,
    ownerFingerprintShort: certificate.payload.ownerFingerprintShort,
    ownerPublicKeyBase64Url: certificate.payload.ownerPublicKeyBase64Url,
    ownerDisplayName: certificate.payload.ownerDisplayName,
    deviceIdHex: certificate.payload.deviceIdHex,
    devicePublicKeyBase64Url: certificate.payload.devicePublicKeyBase64Url,
    deviceFingerprintHex: certificate.payload.deviceFingerprintHex,
    deviceFingerprintShort: certificate.payload.deviceFingerprintShort,
    deviceName: certificate.payload.deviceDisplayName,
    permissions: [...certificate.payload.permissions],
    issuedAt: certificate.payload.issuedAt,
    enrollmentToken: certificate.token,
    localVerificationStatus: 'active-trusted',
    ownerConfirmedTrust: true,
    updatedAt: new Date().toISOString(),
  };

  await runChmTransaction(
    [STORE_USED_PAIRING_NONCES, STORE_PAIRED_DEVICES],
    'readwrite',
    async (tx) => {
      const nonceStore = tx.objectStore(STORE_USED_PAIRING_NONCES);
      const devStore = tx.objectStore(STORE_PAIRED_DEVICES);

      const existingReq = await idbReqToPromise(
        nonceStore.get(`req:${certificate.payload.requestIdHex}`),
      );
      const existingNonce = await idbReqToPromise(
        nonceStore.get(`nonce:${certificate.payload.nonceHex}`),
      );
      if (existingReq || existingNonce) {
        throw new Error('Replay blocked: pairing request or nonce was already consumed.');
      }

      const existingDevice = await idbReqToPromise(devStore.get(key));
      if (
        existingDevice &&
        (existingDevice.localVerificationStatus === 'revoked' ||
          existingDevice.localVerificationStatus === 'conflict-revoked')
      ) {
        throw new Error('Device entry is revoked locally and cannot be re-activated.');
      }

      nonceStore.put({
        key: `req:${certificate.payload.requestIdHex}`,
        kind: 'request-id',
        consumedAt: nowUnix,
        reason: 'approved',
      } satisfies UsedPairingNonceRecord);
      nonceStore.put({
        key: `nonce:${certificate.payload.nonceHex}`,
        kind: 'nonce',
        consumedAt: nowUnix,
        reason: 'approved',
      } satisfies UsedPairingNonceRecord);
      devStore.put(pairedDevice);
    },
  );

  return { certificate, qrUrl, pairedDevice };
}

export async function inspectEnrollmentCertificateForDevice(params: {
  rawCertificateInput: string | Uint8Array;
  nowUnix?: number;
}): Promise<EnrollmentCertificateInspection> {
  const parsed = parsePairingQrInput(params.rawCertificateInput);
  if (parsed.kind !== 'enrollment-certificate') {
    throw new Error('Expected a CHM-DEVICE-PAIRING-v1 Enrollment Certificate QR or token.');
  }
  const cert = parsed.certificate;

  const [{ device }, rawSession, usedNonces, state, trustedOwnerKeys] = await Promise.all([
    getLocalDeviceIdentity(),
    withChmStore<unknown>(STORE_PAIRING_SESSIONS, 'readonly', (s) =>
      s.get(cert.payload.requestIdHex),
    ),
    loadUsedNonceSet(),
    loadDevicePairingState(),
    getAllTrustedOwnerKeysSet(),
  ]);

  if (!device) {
    throw new Error('No local Device Identity exists yet. Generate a pairing QR in Step 1 first.');
  }
  if (device.revokedLocally) {
    throw new Error('This device key has been revoked and cannot accept enrollment certificates.');
  }
  if (!isValidPairingSessionRecord(rawSession)) {
    throw new Error('No valid pending pairing session matches this enrollment certificate.');
  }
  if (rawSession.status !== 'pending') {
    throw new Error(
      `This pairing session is already ${rawSession.status} and cannot be reused (replay blocked).`,
    );
  }

  const expectedReq = decodeAndVerifyPairingRequestBytes(rawSession.requestEnvelopeBytes);
  const nowUnix = params.nowUnix ?? Math.floor(Date.now() / 1000);

  const verification = verifyEnrollmentCertificateBinding({
    certificate: cert,
    expectedRequest: expectedReq,
    expectedDevicePublicKey: device.publicKey,
    trustedOwnerPublicKeys: Array.from(trustedOwnerKeys),
    nowUnix,
    isReplayConsumed: (info) =>
      usedNonces.has(`req:${info.requestIdHex}`) || usedNonces.has(`nonce:${info.nonceHex}`),
  });

  const deviceRevoked = state.revocations.some(
    (r) =>
      r.devicePublicKeyBase64Url === cert.payload.devicePublicKeyBase64Url ||
      (r.ownerFingerprintHex === cert.payload.ownerFingerprintHex &&
        r.deviceIdHex === cert.payload.deviceIdHex),
  );

  const alreadyRegistered = state.pairedDevices.some(
    (d) =>
      d.ownerFingerprintHex === cert.payload.ownerFingerprintHex &&
      (d.deviceIdHex === cert.payload.deviceIdHex ||
        d.devicePublicKeyBase64Url === cert.payload.devicePublicKeyBase64Url),
  );

  return {
    certificate: cert,
    session: rawSession,
    verification,
    requiresOwnerTrustConfirmation: verification.checks.ownerTrustStatus === 'unverified',
    deviceRevoked,
    alreadyRegistered,
  };
}

export async function completeDevicePairingWithCertificate(params: {
  rawCertificateInput: string | Uint8Array;
  confirmOwnerTrust?: boolean;
  nowUnix?: number;
}): Promise<{
  pairedDevice: PairedDeviceRecord;
  verification: VerifiedPairingBindingResult;
}> {
  const inspection = await inspectEnrollmentCertificateForDevice({
    rawCertificateInput: params.rawCertificateInput,
    nowUnix: params.nowUnix,
  });

  if (!inspection.verification.valid) {
    throw new Error(inspection.verification.errors.join(' '));
  }
  if (inspection.deviceRevoked) {
    throw new Error('Device key is already revoked locally and cannot complete pairing.');
  }
  if (inspection.alreadyRegistered) {
    throw new Error('Double-registration blocked: this device is already enrolled with this Owner ID.');
  }

  const cert = inspection.certificate;
  const nowUnix = params.nowUnix ?? Math.floor(Date.now() / 1000);

  const alreadyTrusted = inspection.verification.checks.ownerTrustStatus === 'trusted';
  const ownerTrustedAfterAction = alreadyTrusted || Boolean(params.confirmOwnerTrust);

  if (!alreadyTrusted && params.confirmOwnerTrust) {
    await addTrustedKey({
      publicKeyInput: cert.payload.ownerPublicKeyBase64Url,
      label: cert.payload.ownerDisplayName,
      note: `Confirmed during CHM-DEVICE-PAIRING-v1 (${cert.payload.deviceDisplayName})`,
      verificationState: 'confirmed',
    });
  }

  const key = `${cert.payload.ownerFingerprintHex}:${cert.payload.deviceIdHex}`;
  const pairedDevice: PairedDeviceRecord = {
    key,
    ownerFingerprintHex: cert.payload.ownerFingerprintHex,
    ownerFingerprintShort: cert.payload.ownerFingerprintShort,
    ownerPublicKeyBase64Url: cert.payload.ownerPublicKeyBase64Url,
    ownerDisplayName: cert.payload.ownerDisplayName,
    deviceIdHex: cert.payload.deviceIdHex,
    devicePublicKeyBase64Url: cert.payload.devicePublicKeyBase64Url,
    deviceFingerprintHex: cert.payload.deviceFingerprintHex,
    deviceFingerprintShort: cert.payload.deviceFingerprintShort,
    deviceName: cert.payload.deviceDisplayName,
    permissions: [...cert.payload.permissions],
    issuedAt: cert.payload.issuedAt,
    enrollmentToken: cert.token,
    localVerificationStatus: ownerTrustedAfterAction
      ? 'active-trusted'
      : 'active-unverified-owner',
    ownerConfirmedTrust: ownerTrustedAfterAction,
    updatedAt: new Date().toISOString(),
  };

  await runChmTransaction(
    [STORE_PAIRING_SESSIONS, STORE_USED_PAIRING_NONCES, STORE_PAIRED_DEVICES],
    'readwrite',
    async (tx) => {
      const sessStore = tx.objectStore(STORE_PAIRING_SESSIONS);
      const nonceStore = tx.objectStore(STORE_USED_PAIRING_NONCES);
      const devStore = tx.objectStore(STORE_PAIRED_DEVICES);

      const latestSess = await idbReqToPromise(sessStore.get(inspection.session.requestIdHex));
      if (!latestSess || latestSess.status !== 'pending') {
        throw new Error('Pairing session is no longer pending.');
      }

      const existingReq = await idbReqToPromise(nonceStore.get(`req:${cert.payload.requestIdHex}`));
      const existingNonce = await idbReqToPromise(nonceStore.get(`nonce:${cert.payload.nonceHex}`));
      if (existingReq || existingNonce) {
        throw new Error('Replay blocked: pairing request or nonce already consumed.');
      }

      sessStore.put({
        ...inspection.session,
        status: 'completed' satisfies PairingSessionStatus,
        completedAt: new Date().toISOString(),
      } satisfies PairingSessionRecord);
      nonceStore.put({
        key: `req:${cert.payload.requestIdHex}`,
        kind: 'request-id',
        consumedAt: nowUnix,
        reason: 'completed',
      } satisfies UsedPairingNonceRecord);
      nonceStore.put({
        key: `nonce:${cert.payload.nonceHex}`,
        kind: 'nonce',
        consumedAt: nowUnix,
        reason: 'completed',
      } satisfies UsedPairingNonceRecord);
      devStore.put(pairedDevice);
    },
  );

  return { pairedDevice, verification: inspection.verification };
}

export async function confirmPairedOwnerTrust(pairedDeviceKey: string): Promise<PairedDeviceRecord> {
  const raw = await withChmStore<unknown>(STORE_PAIRED_DEVICES, 'readonly', (s) =>
    s.get(pairedDeviceKey),
  );
  if (!isValidPairedDeviceRecord(raw)) {
    throw new Error('Paired device record is missing or corrupt.');
  }
  await addTrustedKey({
    publicKeyInput: raw.ownerPublicKeyBase64Url,
    label: raw.ownerDisplayName,
    note: `Confirmed owner fingerprint for ${raw.deviceName}`,
    verificationState: 'confirmed',
  });
  const updated: PairedDeviceRecord = {
    ...raw,
    ownerConfirmedTrust: true,
    localVerificationStatus:
      raw.localVerificationStatus === 'revoked' || raw.localVerificationStatus === 'conflict-revoked'
        ? raw.localVerificationStatus
        : 'active-trusted',
    updatedAt: new Date().toISOString(),
  };
  await withChmStore(STORE_PAIRED_DEVICES, 'readwrite', (s) => s.put(updated));
  return updated;
}

export async function revokePairedDevice(params: {
  authorKeyId: string;
  deviceIdHex: string;
  reason: DeviceRevocationReason;
  note?: string;
  passphrase?: string;
  baseUrl?: string;
}): Promise<{
  revocation: SignedDeviceRevocationNotice;
  qrUrl: string;
}> {
  const ownerKey = await getAuthorKey(params.authorKeyId);
  if (!ownerKey) {
    throw new Error('Owner CHM Identity was not found on this device.');
  }

  const key = `${ownerKey.fingerprintHex}:${params.deviceIdHex}`;
  const state = await loadDevicePairingState();
  const target = state.pairedDevices.find((d) => d.key === key);
  if (!target) {
    throw new Error('Target paired device was not found in the local registry.');
  }

  const existingRev = state.revocations.find((r) => r.key === key);
  const nextSeq = Math.max(existingRev?.sequence ?? 0, target.revocationSequence ?? 0) + 1;
  const deviceIdBytes = hexUuidToBytes(target.deviceIdHex);

  const revocation = await createSignedDeviceRevocationNotice({
    ownerPublicKey: ownerKey.publicKey,
    signWithOwnerKey: (msg) => signWithAuthorKey(ownerKey, msg, params.passphrase),
    deviceId: deviceIdBytes,
    devicePublicKey: target.devicePublicKeyBase64Url,
    reason: params.reason,
    sequence: nextSeq,
    note: params.note,
  });

  const baseUrl =
    params.baseUrl ??
    (typeof window !== 'undefined'
      ? `${window.location.origin}/devices`
      : 'https://certified-handmade.com/devices');
  const qrUrl = encodeDeviceRevocationUrl(revocation, baseUrl);

  await persistVerifiedRevocationNotice(revocation);
  return { revocation, qrUrl };
}

export async function importDeviceRevocationNotice(
  rawInput: string | Uint8Array,
): Promise<SignedDeviceRevocationNotice> {
  const parsed = parsePairingQrInput(rawInput);
  if (parsed.kind !== 'device-revocation') {
    throw new Error('Input is not a valid CHM-DEVICE-PAIRING-v1 Device Revocation Notice.');
  }
  await persistVerifiedRevocationNotice(parsed.revocation);
  return parsed.revocation;
}

async function persistVerifiedRevocationNotice(
  revocation: SignedDeviceRevocationNotice,
): Promise<void> {
  const p = revocation.payload;
  const key = `${p.ownerFingerprintHex}:${p.deviceIdHex}`;

  await runChmTransaction(
    [STORE_DEVICE_REVOCATIONS, STORE_PAIRED_DEVICES, STORE_DEVICE_IDENTITIES],
    'readwrite',
    async (tx) => {
      const revStore = tx.objectStore(STORE_DEVICE_REVOCATIONS);
      const devStore = tx.objectStore(STORE_PAIRED_DEVICES);
      const idStore = tx.objectStore(STORE_DEVICE_IDENTITIES);

      const existingRev = (await idbReqToPromise(revStore.get(key))) as
        | DeviceRevocationRecord
        | undefined;
      if (!existingRev || p.sequence >= existingRev.sequence) {
        revStore.put({
          key,
          ownerFingerprintHex: p.ownerFingerprintHex,
          ownerPublicKeyBase64Url: p.ownerPublicKeyBase64Url,
          deviceIdHex: p.deviceIdHex,
          devicePublicKeyBase64Url: p.devicePublicKeyBase64Url,
          sequence: p.sequence,
          revokedAt: p.revokedAt,
          reason: p.reason,
          note: p.note,
          token: revocation.token,
          importedAt: new Date().toISOString(),
        } satisfies DeviceRevocationRecord);
      }

      const existingEntry = (await idbReqToPromise(devStore.get(key))) as
        | PairedDeviceRecord
        | undefined;
      if (existingEntry) {
        const pubChanged = existingEntry.devicePublicKeyBase64Url !== p.devicePublicKeyBase64Url;
        devStore.put({
          ...existingEntry,
          revocationNoticeToken: revocation.token,
          revokedAt: p.revokedAt,
          revocationReason: p.reason,
          revocationSequence: Math.max(p.sequence, existingEntry.revocationSequence ?? 0),
          localVerificationStatus: pubChanged ? 'conflict-revoked' : 'revoked',
          updatedAt: new Date().toISOString(),
        } satisfies PairedDeviceRecord);
      } else {
        devStore.put({
          key,
          ownerFingerprintHex: p.ownerFingerprintHex,
          ownerFingerprintShort: p.ownerFingerprintShort,
          ownerPublicKeyBase64Url: p.ownerPublicKeyBase64Url,
          ownerDisplayName: p.ownerFingerprintShort,
          deviceIdHex: p.deviceIdHex,
          devicePublicKeyBase64Url: p.devicePublicKeyBase64Url,
          deviceFingerprintHex: p.deviceFingerprintHex,
          deviceFingerprintShort: p.deviceFingerprintShort,
          deviceName: `Revoked Device (${p.deviceFingerprintShort})`,
          permissions: ['device-identity'],
          issuedAt: p.revokedAt,
          enrollmentToken: '',
          revocationNoticeToken: revocation.token,
          revokedAt: p.revokedAt,
          revocationReason: p.reason,
          revocationSequence: p.sequence,
          localVerificationStatus: 'revoked',
          ownerConfirmedTrust: false,
          updatedAt: new Date().toISOString(),
        } satisfies PairedDeviceRecord);
      }

      const localIdentities = (await idbReqToPromise(idStore.getAll())) as DeviceIdentityRecord[];
      for (const local of localIdentities ?? []) {
        if (
          local.publicKeyBase64Url === p.devicePublicKeyBase64Url ||
          local.deviceIdHex === p.deviceIdHex
        ) {
          idStore.put({ ...local, revokedLocally: true } satisfies DeviceIdentityRecord);
        }
      }
    },
  );
}

export async function exportSignedDeviceRegistry(params: {
  authorKeyId: string;
  passphrase?: string;
  sequence?: number;
}): Promise<{
  snapshot: SignedDeviceRegistrySnapshot;
  jsonString: string;
  cborBytes: Uint8Array;
}> {
  const ownerKey = await getAuthorKey(params.authorKeyId);
  if (!ownerKey) {
    throw new Error('Selected Owner CHM Identity was not found.');
  }

  const state = await loadDevicePairingState();
  const certs: SignedEnrollmentCertificate[] = [];
  for (const d of state.pairedDevices) {
    if (d.ownerFingerprintHex === ownerKey.fingerprintHex && d.enrollmentToken) {
      const parsed = parsePairingQrInput(d.enrollmentToken);
      if (parsed.kind === 'enrollment-certificate') {
        certs.push(parsed.certificate);
      }
    }
  }

  const revs: SignedDeviceRevocationNotice[] = [];
  for (const r of state.revocations) {
    if (r.ownerFingerprintHex === ownerKey.fingerprintHex) {
      const parsed = parsePairingQrInput(r.token);
      if (parsed.kind === 'device-revocation') {
        revs.push(parsed.revocation);
      }
    }
  }

  const maxSeq = revs.reduce((acc, r) => Math.max(acc, r.payload.sequence), 0);
  const snapshot = await createSignedDeviceRegistrySnapshot({
    ownerPublicKey: ownerKey.publicKey,
    ownerDisplayName: ownerKey.label,
    signWithOwnerKey: (msg) => signWithAuthorKey(ownerKey, msg, params.passphrase),
    certificates: certs,
    revocations: revs,
    sequence: params.sequence ?? Math.max(1, maxSeq + 1),
  });

  return {
    snapshot,
    jsonString: serializeDeviceRegistryJson(snapshot, true),
    cborBytes: snapshot.envelopeBytes,
  };
}

export async function importSignedDeviceRegistry(
  input: string | Uint8Array,
): Promise<VerifiedRegistryReconciliationResult> {
  const [state, trustedOwnerKeys] = await Promise.all([
    loadDevicePairingState(),
    getAllTrustedOwnerKeysSet(),
  ]);

  const reconciled = reconcileRegistrySnapshotImport({
    input,
    existingEntries: state.pairedDevices,
    trustedOwnerPublicKeys: Array.from(trustedOwnerKeys),
  });

  for (const rev of reconciled.snapshot.payload.revocations) {
    await persistVerifiedRevocationNotice(rev);
  }

  const existingMap = new Map(state.pairedDevices.map((e) => [e.key, e]));
  await runChmTransaction([STORE_PAIRED_DEVICES], 'readwrite', (tx) => {
    const devStore = tx.objectStore(STORE_PAIRED_DEVICES);
    for (const entry of reconciled.entries) {
      const key = `${entry.ownerFingerprintHex}:${entry.deviceIdHex}`;
      const prev = existingMap.get(key);
      const isLocallyRevoked =
        prev?.localVerificationStatus === 'revoked' ||
        prev?.localVerificationStatus === 'conflict-revoked' ||
        Boolean(prev?.revocationNoticeToken);

      const ownerConfirmed =
        prev?.ownerConfirmedTrust ?? (reconciled.ownerTrustStatus === 'trusted');
      let nextStatus = entry.localVerificationStatus;
      if (isLocallyRevoked && nextStatus !== 'conflict-revoked') {
        nextStatus = 'revoked';
      }

      devStore.put({
        ...entry,
        key,
        ownerConfirmedTrust: ownerConfirmed,
        localVerificationStatus: nextStatus,
        updatedAt: new Date().toISOString(),
      } satisfies PairedDeviceRecord);
    }
  });

  const decodedRevs = reconciled.snapshot.payload.revocations;
  if (decodedRevs.length > 0) {
    await runChmTransaction([STORE_DEVICE_IDENTITIES], 'readwrite', async (tx) => {
      const idStore = tx.objectStore(STORE_DEVICE_IDENTITIES);
      const locals = (await idbReqToPromise(idStore.getAll())) as DeviceIdentityRecord[];
      for (const local of locals ?? []) {
        const hit = decodedRevs.some(
          (r) =>
            r.payload.devicePublicKeyBase64Url === local.publicKeyBase64Url ||
            r.payload.deviceIdHex === local.deviceIdHex,
        );
        if (hit) {
          idStore.put({ ...local, revokedLocally: true } satisfies DeviceIdentityRecord);
        }
      }
    });
  }

  return reconciled;
}

function hexUuidToBytes(uuidHex: string): Uint8Array {
  const clean = uuidHex.replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(clean)) {
    throw new Error('Invalid UUID hex string');
  }
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export {
  base64UrlDecode,
  decodeAndVerifyDeviceRegistryInput,
  decodeAndVerifyDeviceRevocationBytes,
  decodeAndVerifyEnrollmentCertificateBytes,
};

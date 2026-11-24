import {
  assertAllowedIntegerMapKeys,
  assertExactBytes,
  assertSafeIntegerInRange,
  assertStrictEd25519PublicKey,
  base64UrlDecode,
  base64UrlEncode,
  buildDomainSeparatedMessage,
  computePublicKeyFingerprintSync,
  decodeAndVerifyDeviceRegistryInput,
  decodeAndVerifyDeviceRevocationBytes,
  decodeAndVerifyEnrollmentCertificateBytes,
  decodeCanonicalCbor,
  encodeCanonicalCbor,
  formatUuidHex,
  verifyStrictEd25519Signature,
} from '@yomiplush/chm-exchange/core';
import type {
  SignedDeviceRegistrySnapshot,
  SignedDeviceRevocationNotice,
  SignedEnrollmentCertificate,
} from '@yomiplush/chm-exchange/core';
import {
  bytesToHex,
  constantTimeEqual,
  hexToBytes,
  sha256Sync,
} from '../crypto/sha256';
import {
  assertValidNostrPubkeyHex,
  deriveNostrPublicKeyHex,
  encodeNpub,
  signSchnorrDigestHex,
  verifySchnorrDigestHex,
} from '../nostr/secp256k1';
import type { DeviceRevocationRecord, PairedDeviceRecord } from '../storage/devicePairingStore';
import type { SyncOpKind, VerifiedPeerBinding } from './types';

export const CHM_SYNC_PROTOCOL_ID = 'CHM-SYNC-v1';
export const SYNC_BINDING_TOKEN_PREFIX = 'chm-sync-bind:';
export const MAX_BINDING_CBOR_BYTES = 2048;
export const MAX_SYNC_OP_CBOR_BYTES = 65536;
export const MAX_SYNC_RUMOR_JSON_CHARS = 65536;
export const MAX_SYNC_BUNDLE_ITEMS = 64;
export const SYNC_CLOCK_SKEW_SECONDS = 300;

export const ZERO_HASH_HEX_32 = '0'.repeat(64);
export const ZERO_HASH_BYTES_32 = new Uint8Array(32);

const SYNC_BIND_DOMAIN_PREFIX = new TextEncoder().encode('CHM-SYNC-v1:BIND\0');
const SYNC_BIND_NOSTR_POP_PREFIX = new TextEncoder().encode('CHM-SYNC-v1:NOSTR-POP\0');
const SYNC_OP_DOMAIN_PREFIX = new TextEncoder().encode('CHM-SYNC-v1:OP\0');

const BIND_ALLOWED_KEYS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
const OP_ALLOWED_KEYS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

const SYNC_ENVELOPE_KIND = {
  BINDING_ATTESTATION: 1,
  SIGNED_OPERATION: 2,
} as const;

const SYNC_OP_CODE_MAP: Record<SyncOpKind, number> = {
  'enroll-device': 1,
  'revoke-device': 2,
  'authorize-sync-device': 3,
  checkpoint: 4,
};

const CODE_TO_SYNC_OP_MAP: Record<number, SyncOpKind> = {
  1: 'enroll-device',
  2: 'revoke-device',
  3: 'authorize-sync-device',
  4: 'checkpoint',
};

export interface DecodedBindingAttestation {
  bindingIdHex: string;
  ownerPublicKey: Uint8Array;
  ownerPublicKeyBase64Url: string;
  ownerFingerprintHex: string;
  deviceIdBytes: Uint8Array;
  deviceIdHex: string;
  devicePublicKey: Uint8Array;
  devicePublicKeyBase64Url: string;
  nostrPubkeyHex: string;
  npub: string;
  signerRole: 'owner' | 'paired-device';
  issuedAt: number;
  expiresAt: number;
  nonceHex: string;
  payloadBytes: Uint8Array;
  envelopeBytes: Uint8Array;
  bindingHashHex: string;
  token: string;
}

export interface DecodedSyncOperation {
  opIdHex: string;
  ownerPublicKey: Uint8Array;
  ownerPublicKeyBase64Url: string;
  ownerFingerprintHex: string;
  ownerFingerprintShort: string;
  sequence: number;
  prevOpHashHex: string;
  opKind: SyncOpKind;
  issuedAt: number;
  enrollmentCertificate?: SignedEnrollmentCertificate;
  revocationNotice?: SignedDeviceRevocationNotice;
  bindingAttestation?: DecodedBindingAttestation;
  registrySnapshot?: SignedDeviceRegistrySnapshot;
  payloadBytes: Uint8Array;
  envelopeBytes: Uint8Array;
  opHashHex: string;
}

export const MAX_VAULT_PROOFS_PER_BUNDLE = 24;

export interface SyncVaultProofWireItem {
  proofBase64Url: string;
  creationMethod?: string;
  createdAt?: string;
}

export interface SyncVaultProfileWireSnapshot {
  displayName?: string;
  website?: string;
  links?: Array<{ label?: string; url: string }>;
  updatedAt?: string;
}

export interface SyncTrustedArtistWireEntry {
  publicKeyBase64Url: string;
  label: string;
  verificationState?: 'confirmed' | 'unconfirmed';
}

export interface SyncRumorWirePayload {
  protocol: typeof CHM_SYNC_PROTOCOL_ID;
  payloadKind: 'sync-bundle';
  opsBase64Url: string[];
  bindingsBase64Url: string[];
  vaultProofs?: SyncVaultProofWireItem[];
  profileSnapshot?: SyncVaultProfileWireSnapshot;
  trustedArtists?: SyncTrustedArtistWireEntry[];
}

function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  globalThis.crypto.getRandomValues(out);
  return out;
}

function randomUuidBytes(): Uint8Array {
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  return b;
}

export async function createSignedBindingAttestation(params: {
  ownerPublicKey: Uint8Array;
  deviceIdBytes: Uint8Array;
  devicePublicKey: Uint8Array;
  signerRole: 'owner' | 'paired-device';
  signWithChmKey: (message: Uint8Array) => Promise<Uint8Array> | Uint8Array;
  nostrSecretKey: Uint8Array;
  issuedAt?: number;
  expiresAt?: number;
}): Promise<DecodedBindingAttestation> {
  const ownerPub = assertStrictEd25519PublicKey(params.ownerPublicKey, 'ownerPublicKey');
  const devicePub = assertStrictEd25519PublicKey(params.devicePublicKey, 'devicePublicKey');
  const deviceIdBytes = assertExactBytes(params.deviceIdBytes, 16, 'deviceIdBytes');
  const bindingIdBytes = randomUuidBytes();
  const nonceBytes = randomBytes(32);

  const nostrPubkeyHex = deriveNostrPublicKeyHex(params.nostrSecretKey);
  const nostrPubkeyBytes = hexToBytes(nostrPubkeyHex);

  if (constantTimeEqual(nostrPubkeyBytes, ownerPub) || constantTimeEqual(nostrPubkeyBytes, devicePub)) {
    throw new Error('Key separation violation: Nostr pubkey cannot match CHM Ed25519 pubkey');
  }

  const issuedAt = params.issuedAt ?? Math.floor(Date.now() / 1000);
  const expiresAt = params.expiresAt ?? 0;

  const map = new Map<number, unknown>([
    [0, CHM_SYNC_PROTOCOL_ID],
    [1, SYNC_ENVELOPE_KIND.BINDING_ATTESTATION],
    [2, bindingIdBytes],
    [3, ownerPub],
    [4, deviceIdBytes],
    [5, devicePub],
    [6, nostrPubkeyBytes],
    [7, params.signerRole === 'owner' ? 1 : 2],
    [8, issuedAt],
    [9, expiresAt],
    [10, nonceBytes],
  ]);

  const payloadBytes = encodeCanonicalCbor(map);
  const chmDigestMsg = buildDomainSeparatedMessage(SYNC_BIND_DOMAIN_PREFIX, payloadBytes);
  const chmSig = await params.signWithChmKey(chmDigestMsg);
  const chmSigBytes = assertExactBytes(chmSig, 64, 'chmSignature');

  const signerPubForVerify = params.signerRole === 'owner' ? ownerPub : devicePub;
  if (!verifyStrictEd25519Signature(signerPubForVerify, chmDigestMsg, chmSigBytes)) {
    throw new Error('Produced CHM binding signature failed self-verification');
  }

  const popDigest = sha256Sync(buildDomainSeparatedMessage(SYNC_BIND_NOSTR_POP_PREFIX, payloadBytes));
  const nostrSigHex = signSchnorrDigestHex(popDigest, params.nostrSecretKey);
  const nostrSigBytes = hexToBytes(nostrSigHex);

  const envelopeBytes = encodeCanonicalCbor([payloadBytes, chmSigBytes, nostrSigBytes]);
  if (envelopeBytes.byteLength > MAX_BINDING_CBOR_BYTES) {
    throw new Error(`Binding attestation exceeds ${MAX_BINDING_CBOR_BYTES} bytes`);
  }

  return decodeAndVerifyBindingAttestation(envelopeBytes, { nowUnix: issuedAt });
}

export function parseBindingAttestationInput(rawInput: string | Uint8Array): DecodedBindingAttestation {
  if (rawInput instanceof Uint8Array) {
    return decodeAndVerifyBindingAttestation(rawInput);
  }
  if (typeof rawInput !== 'string') {
    throw new Error('Binding input must be a string or Uint8Array');
  }
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new Error('Binding input is empty');
  }

  // Extract from URL fragment `#sync-bind=<b64u>` or direct `chm-sync-bind:<b64u>` token
  const hashIdx = trimmed.indexOf('#');
  if (hashIdx >= 0) {
    const fragment = trimmed.slice(hashIdx + 1);
    const params = new URLSearchParams(fragment);
    const val = params.get('sync-bind');
    if (val) {
      return decodeAndVerifyBindingAttestation(base64UrlDecode(val.trim()));
    }
  }

  if (trimmed.startsWith(SYNC_BINDING_TOKEN_PREFIX)) {
    const b64 = trimmed.slice(SYNC_BINDING_TOKEN_PREFIX.length).trim();
    return decodeAndVerifyBindingAttestation(base64UrlDecode(b64));
  }

  throw new Error('Unrecognized CHM-SYNC-v1 Peer Binding input');
}

export function extractSyncBindFromPairingUrl(rawInput: string): DecodedBindingAttestation | null {
  if (typeof rawInput !== 'string') return null;
  const hashIdx = rawInput.indexOf('#');
  if (hashIdx < 0) return null;
  const params = new URLSearchParams(rawInput.slice(hashIdx + 1));
  const val = params.get('sync-bind');
  if (!val) return null;
  return decodeAndVerifyBindingAttestation(base64UrlDecode(val.trim()));
}

export function decodeAndVerifyBindingAttestation(
  envelopeBytes: Uint8Array,
  options?: { nowUnix?: number },
): DecodedBindingAttestation {
  if (!(envelopeBytes instanceof Uint8Array) || envelopeBytes.byteLength === 0) {
    throw new Error('Empty binding attestation bytes');
  }
  if (envelopeBytes.byteLength > MAX_BINDING_CBOR_BYTES) {
    throw new Error(`Binding attestation exceeds ${MAX_BINDING_CBOR_BYTES} bytes`);
  }

  const outer = decodeCanonicalCbor(envelopeBytes, 'BindingAttestation');
  if (!Array.isArray(outer) || outer.length !== 3) {
    throw new Error('Malformed binding attestation outer envelope');
  }
  const [rawPayloadBytes, rawChmSig, rawNostrSig] = outer;
  if (!(rawPayloadBytes instanceof Uint8Array)) {
    throw new Error('Binding payload must be byte string');
  }
  const chmSigBytes = assertExactBytes(rawChmSig, 64, 'chmSignature');
  const nostrSigBytes = assertExactBytes(rawNostrSig, 64, 'nostrSignature');

  const decodedPayload = decodeCanonicalCbor(rawPayloadBytes, 'BindingAttestationPayload');
  const map = assertAllowedIntegerMapKeys(decodedPayload, BIND_ALLOWED_KEYS, 'BindingAttestation');

  if (map.get(0) !== CHM_SYNC_PROTOCOL_ID) {
    throw new Error('Unsupported sync binding protocol');
  }
  if (map.get(1) !== SYNC_ENVELOPE_KIND.BINDING_ATTESTATION) {
    throw new Error('Unexpected sync envelope kind for binding');
  }
  const bindingIdBytes = assertExactBytes(map.get(2), 16, 'bindingId');
  const ownerPub = assertStrictEd25519PublicKey(
    assertExactBytes(map.get(3), 32, 'ownerPublicKey'),
    'ownerPublicKey',
  );
  const deviceIdBytes = assertExactBytes(map.get(4), 16, 'deviceId');
  const devicePub = assertStrictEd25519PublicKey(
    assertExactBytes(map.get(5), 32, 'devicePublicKey'),
    'devicePublicKey',
  );
  const nostrPubBytes = assertExactBytes(map.get(6), 32, 'nostrPublicKey');
  const nostrPubkeyHex = assertValidNostrPubkeyHex(bytesToHex(nostrPubBytes), 'nostrPublicKey');

  if (constantTimeEqual(nostrPubBytes, ownerPub) || constantTimeEqual(nostrPubBytes, devicePub)) {
    throw new Error('Key separation violation: Nostr pubkey matches CHM Ed25519 key');
  }

  const roleCode = assertSafeIntegerInRange(map.get(7), 1, 2, 'signerRole');
  const signerRole: 'owner' | 'paired-device' = roleCode === 1 ? 'owner' : 'paired-device';
  const issuedAt = assertSafeIntegerInRange(map.get(8), 1, Number.MAX_SAFE_INTEGER, 'issuedAt');
  const expiresAt = assertSafeIntegerInRange(map.get(9), 0, Number.MAX_SAFE_INTEGER, 'expiresAt');
  assertExactBytes(map.get(10), 32, 'nonce');

  const nowUnix = options?.nowUnix ?? Math.floor(Date.now() / 1000);
  if (expiresAt > 0 && nowUnix > expiresAt + SYNC_CLOCK_SKEW_SECONDS) {
    throw new Error('CHM-Nostr binding attestation has expired');
  }

  const chmDigestMsg = buildDomainSeparatedMessage(SYNC_BIND_DOMAIN_PREFIX, rawPayloadBytes);
  const expectedSignerPub = signerRole === 'owner' ? ownerPub : devicePub;
  if (!verifyStrictEd25519Signature(expectedSignerPub, chmDigestMsg, chmSigBytes)) {
    throw new Error('Invalid CHM Ed25519 signature on binding attestation');
  }

  const popDigest = sha256Sync(buildDomainSeparatedMessage(SYNC_BIND_NOSTR_POP_PREFIX, rawPayloadBytes));
  if (!verifySchnorrDigestHex(popDigest, bytesToHex(nostrSigBytes), nostrPubkeyHex)) {
    throw new Error('Invalid Nostr Schnorr Proof-of-Possession on binding attestation');
  }

  const ownerFp = computePublicKeyFingerprintSync(ownerPub);
  return {
    bindingIdHex: formatUuidHex(bindingIdBytes),
    ownerPublicKey: ownerPub,
    ownerPublicKeyBase64Url: base64UrlEncode(ownerPub),
    ownerFingerprintHex: ownerFp.fullHex,
    deviceIdBytes,
    deviceIdHex: formatUuidHex(deviceIdBytes),
    devicePublicKey: devicePub,
    devicePublicKeyBase64Url: base64UrlEncode(devicePub),
    nostrPubkeyHex,
    npub: encodeNpub(nostrPubkeyHex),
    signerRole,
    issuedAt,
    expiresAt,
    nonceHex: bytesToHex(map.get(10) as Uint8Array),
    payloadBytes: rawPayloadBytes,
    envelopeBytes,
    bindingHashHex: bytesToHex(sha256Sync(rawPayloadBytes)),
    token: `${SYNC_BINDING_TOKEN_PREFIX}${base64UrlEncode(envelopeBytes)}`,
  };
}

export async function createSignedSyncOperation(params: {
  ownerPublicKey: Uint8Array;
  signWithOwnerKey: (message: Uint8Array) => Promise<Uint8Array> | Uint8Array;
  sequence: number;
  prevOpHashBytes?: Uint8Array;
  opKind: SyncOpKind;
  issuedAt?: number;
  enrollmentCertBytes?: Uint8Array;
  revocationBytes?: Uint8Array;
  bindingBytes?: Uint8Array;
  registrySnapshotBytes?: Uint8Array;
}): Promise<DecodedSyncOperation> {
  const ownerPub = assertStrictEd25519PublicKey(params.ownerPublicKey, 'ownerPublicKey');
  const opIdBytes = randomUuidBytes();
  const sequence = assertSafeIntegerInRange(params.sequence, 1, Number.MAX_SAFE_INTEGER, 'sequence');
  const prevOpHashBytes = params.prevOpHashBytes
    ? assertExactBytes(params.prevOpHashBytes, 32, 'prevOpHashBytes')
    : ZERO_HASH_BYTES_32;
  const opCode = SYNC_OP_CODE_MAP[params.opKind];
  const issuedAt = params.issuedAt ?? Math.floor(Date.now() / 1000);

  const map = new Map<number, unknown>([
    [0, CHM_SYNC_PROTOCOL_ID],
    [1, SYNC_ENVELOPE_KIND.SIGNED_OPERATION],
    [2, opIdBytes],
    [3, ownerPub],
    [4, sequence],
    [5, prevOpHashBytes],
    [6, opCode],
    [7, issuedAt],
  ]);

  if (params.enrollmentCertBytes) {
    map.set(8, params.enrollmentCertBytes);
  }
  if (params.revocationBytes) {
    map.set(9, params.revocationBytes);
  }
  if (params.bindingBytes) {
    map.set(10, params.bindingBytes);
  }
  if (params.registrySnapshotBytes) {
    map.set(11, params.registrySnapshotBytes);
  }

  const payloadBytes = encodeCanonicalCbor(map);
  const signingMsg = buildDomainSeparatedMessage(SYNC_OP_DOMAIN_PREFIX, payloadBytes);
  const sig = assertExactBytes(await params.signWithOwnerKey(signingMsg), 64, 'ownerSignature');
  if (!verifyStrictEd25519Signature(ownerPub, signingMsg, sig)) {
    throw new Error('Produced Owner CHM sync operation signature failed self-verification');
  }

  const envelopeBytes = encodeCanonicalCbor([payloadBytes, sig]);
  if (envelopeBytes.byteLength > MAX_SYNC_OP_CBOR_BYTES) {
    throw new Error(`Sync operation exceeds ${MAX_SYNC_OP_CBOR_BYTES} bytes`);
  }

  return decodeAndVerifySyncOperation(envelopeBytes);
}

export function decodeAndVerifySyncOperation(
  envelopeBytes: Uint8Array,
  options?: { nowUnix?: number },
): DecodedSyncOperation {
  if (!(envelopeBytes instanceof Uint8Array) || envelopeBytes.byteLength === 0) {
    throw new Error('Empty sync operation bytes');
  }
  if (envelopeBytes.byteLength > MAX_SYNC_OP_CBOR_BYTES) {
    throw new Error(`Sync operation exceeds ${MAX_SYNC_OP_CBOR_BYTES} bytes`);
  }

  const outer = decodeCanonicalCbor(envelopeBytes, 'SignedSyncOperation');
  if (!Array.isArray(outer) || outer.length !== 2) {
    throw new Error('Malformed sync operation outer envelope');
  }
  const [rawPayloadBytes, rawSig] = outer;
  if (!(rawPayloadBytes instanceof Uint8Array)) {
    throw new Error('Sync operation payload must be byte string');
  }
  const sigBytes = assertExactBytes(rawSig, 64, 'ownerSignature');

  const decodedPayload = decodeCanonicalCbor(rawPayloadBytes, 'SignedSyncOperationPayload');
  const map = assertAllowedIntegerMapKeys(decodedPayload, OP_ALLOWED_KEYS, 'SignedSyncOperation');

  if (map.get(0) !== CHM_SYNC_PROTOCOL_ID) {
    throw new Error('Unsupported sync operation protocol');
  }
  if (map.get(1) !== SYNC_ENVELOPE_KIND.SIGNED_OPERATION) {
    throw new Error('Unexpected sync envelope kind for operation');
  }

  const opIdBytes = assertExactBytes(map.get(2), 16, 'opId');
  const ownerPub = assertStrictEd25519PublicKey(
    assertExactBytes(map.get(3), 32, 'ownerPublicKey'),
    'ownerPublicKey',
  );
  const sequence = assertSafeIntegerInRange(map.get(4), 1, Number.MAX_SAFE_INTEGER, 'sequence');
  const prevOpHashBytes = assertExactBytes(map.get(5), 32, 'prevOpHash');
  const opCode = assertSafeIntegerInRange(map.get(6), 1, 4, 'opKind');
  const opKind = CODE_TO_SYNC_OP_MAP[opCode];
  if (!opKind) {
    throw new Error(`Unsupported sync operation code: ${opCode}`);
  }
  const issuedAt = assertSafeIntegerInRange(map.get(7), 1, Number.MAX_SAFE_INTEGER, 'issuedAt');

  const signingMsg = buildDomainSeparatedMessage(SYNC_OP_DOMAIN_PREFIX, rawPayloadBytes);
  if (!verifyStrictEd25519Signature(ownerPub, signingMsg, sigBytes)) {
    throw new Error('Invalid Owner Ed25519 signature on sync operation (authority denied)');
  }

  const ownerPublicKeyBase64Url = base64UrlEncode(ownerPub);
  const ownerFp = computePublicKeyFingerprintSync(ownerPub);

  let enrollmentCertificate: SignedEnrollmentCertificate | undefined;
  const rawCert = map.get(8);
  if (rawCert !== undefined) {
    if (!(rawCert instanceof Uint8Array)) {
      throw new Error('Invalid enrollmentCertificate field in sync operation');
    }
    enrollmentCertificate = decodeAndVerifyEnrollmentCertificateBytes(rawCert);
    if (enrollmentCertificate.payload.ownerPublicKeyBase64Url !== ownerPublicKeyBase64Url) {
      throw new Error('Sync operation authority mismatch: certificate owner differs from op owner');
    }
  }

  let revocationNotice: SignedDeviceRevocationNotice | undefined;
  const rawRev = map.get(9);
  if (rawRev !== undefined) {
    if (!(rawRev instanceof Uint8Array)) {
      throw new Error('Invalid revocationNotice field in sync operation');
    }
    revocationNotice = decodeAndVerifyDeviceRevocationBytes(rawRev);
    if (revocationNotice.payload.ownerPublicKeyBase64Url !== ownerPublicKeyBase64Url) {
      throw new Error('Sync operation authority mismatch: revocation owner differs from op owner');
    }
  }

  let bindingAttestation: DecodedBindingAttestation | undefined;
  const rawBind = map.get(10);
  if (rawBind !== undefined) {
    if (!(rawBind instanceof Uint8Array)) {
      throw new Error('Invalid bindingAttestation field in sync operation');
    }
    bindingAttestation = decodeAndVerifyBindingAttestation(rawBind, { nowUnix: options?.nowUnix });
    if (bindingAttestation.ownerPublicKeyBase64Url !== ownerPublicKeyBase64Url) {
      throw new Error('Sync operation authority mismatch: binding owner differs from op owner');
    }
  }

  let registrySnapshot: SignedDeviceRegistrySnapshot | undefined;
  const rawReg = map.get(11);
  if (rawReg !== undefined) {
    if (!(rawReg instanceof Uint8Array)) {
      throw new Error('Invalid registrySnapshot field in sync operation');
    }
    registrySnapshot = decodeAndVerifyDeviceRegistryInput(rawReg);
    if (registrySnapshot.payload.ownerPublicKeyBase64Url !== ownerPublicKeyBase64Url) {
      throw new Error('Sync operation authority mismatch: snapshot owner differs from op owner');
    }
  }

  if (opKind === 'enroll-device' && !enrollmentCertificate) {
    throw new Error('enroll-device operation requires an embedded Enrollment Certificate');
  }
  if (opKind === 'revoke-device' && !revocationNotice) {
    throw new Error('revoke-device operation requires an embedded Device Revocation Notice');
  }
  if (opKind === 'authorize-sync-device' && !bindingAttestation) {
    throw new Error('authorize-sync-device operation requires an embedded Binding Attestation');
  }
  if (opKind === 'checkpoint' && !registrySnapshot) {
    throw new Error('checkpoint operation requires an embedded Registry Snapshot');
  }

  return {
    opIdHex: formatUuidHex(opIdBytes),
    ownerPublicKey: ownerPub,
    ownerPublicKeyBase64Url,
    ownerFingerprintHex: ownerFp.fullHex,
    ownerFingerprintShort: ownerFp.shortDisplay,
    sequence,
    prevOpHashHex: bytesToHex(prevOpHashBytes),
    opKind,
    issuedAt,
    enrollmentCertificate,
    revocationNotice,
    bindingAttestation,
    registrySnapshot,
    payloadBytes: rawPayloadBytes,
    envelopeBytes,
    opHashHex: bytesToHex(sha256Sync(rawPayloadBytes)),
  };
}

export function encodeSyncRumorPayload(params: {
  ops: DecodedSyncOperation[];
  bindings?: DecodedBindingAttestation[];
  vaultProofs?: SyncVaultProofWireItem[];
  profileSnapshot?: SyncVaultProfileWireSnapshot;
  trustedArtists?: SyncTrustedArtistWireEntry[];
}): string {
  const vaultProofsCount = params.vaultProofs?.length ?? 0;
  const trustedCount = params.trustedArtists?.length ?? 0;
  const hasMetadata = Boolean(params.profileSnapshot) || trustedCount > 0;
  if (
    params.ops.length + (params.bindings?.length ?? 0) + vaultProofsCount === 0 &&
    !hasMetadata
  ) {
    throw new Error('Sync bundle item count out of bounds');
  }
  if (
    params.ops.length > MAX_SYNC_BUNDLE_ITEMS ||
    (params.bindings?.length ?? 0) > MAX_SYNC_BUNDLE_ITEMS ||
    vaultProofsCount > MAX_VAULT_PROOFS_PER_BUNDLE ||
    trustedCount > MAX_SYNC_BUNDLE_ITEMS
  ) {
    throw new Error('Sync bundle item count out of bounds');
  }
  const payload: SyncRumorWirePayload = {
    protocol: CHM_SYNC_PROTOCOL_ID,
    payloadKind: 'sync-bundle',
    opsBase64Url: params.ops.map((o) => base64UrlEncode(o.envelopeBytes)),
    bindingsBase64Url: (params.bindings ?? []).map((b) => base64UrlEncode(b.envelopeBytes)),
    ...(vaultProofsCount > 0 ? { vaultProofs: params.vaultProofs } : {}),
    ...(params.profileSnapshot ? { profileSnapshot: params.profileSnapshot } : {}),
    ...(trustedCount > 0 ? { trustedArtists: params.trustedArtists } : {}),
  };
  const encoded = JSON.stringify(payload);
  if (encoded.length > MAX_SYNC_RUMOR_JSON_CHARS) {
    throw new Error(`Sync rumor exceeds ${MAX_SYNC_RUMOR_JSON_CHARS} characters`);
  }
  return encoded;
}

export function decodeAndVerifySyncRumorPayload(
  rawContent: string,
  options?: { nowUnix?: number },
): {
  ops: DecodedSyncOperation[];
  bindings: DecodedBindingAttestation[];
  vaultProofs: SyncVaultProofWireItem[];
  profileSnapshot?: SyncVaultProfileWireSnapshot;
  trustedArtists: SyncTrustedArtistWireEntry[];
} {
  if (typeof rawContent !== 'string' || rawContent.length === 0) {
    throw new Error('Empty sync rumor content');
  }
  if (rawContent.length > MAX_SYNC_RUMOR_JSON_CHARS) {
    throw new Error('Sync rumor content exceeds maximum allowed size');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error('Malformed JSON in CHM sync rumor content');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('CHM sync rumor content must be an object');
  }
  if (
    Object.prototype.hasOwnProperty.call(parsed, '__proto__') ||
    Object.prototype.hasOwnProperty.call(parsed, 'constructor') ||
    Object.prototype.hasOwnProperty.call(parsed, 'prototype')
  ) {
    throw new Error('Forbidden prototype property in CHM sync rumor content');
  }
  const obj = parsed as Partial<SyncRumorWirePayload>;
  if (obj.protocol !== CHM_SYNC_PROTOCOL_ID || obj.payloadKind !== 'sync-bundle') {
    throw new Error('Unrecognized CHM sync rumor protocol or payloadKind');
  }
  if (!Array.isArray(obj.opsBase64Url) || !Array.isArray(obj.bindingsBase64Url)) {
    throw new Error('CHM sync rumor missing opsBase64Url or bindingsBase64Url arrays');
  }
  if (
    obj.opsBase64Url.length > MAX_SYNC_BUNDLE_ITEMS ||
    obj.bindingsBase64Url.length > MAX_SYNC_BUNDLE_ITEMS
  ) {
    throw new Error('CHM sync rumor exceeds maximum bundle item count');
  }

  const ops: DecodedSyncOperation[] = [];
  for (const b64 of obj.opsBase64Url) {
    if (typeof b64 !== 'string') throw new Error('Invalid op entry in sync bundle');
    const bytes = base64UrlDecode(b64);
    ops.push(decodeAndVerifySyncOperation(bytes, options));
  }

  const bindings: DecodedBindingAttestation[] = [];
  for (const b64 of obj.bindingsBase64Url) {
    if (typeof b64 !== 'string') throw new Error('Invalid binding entry in sync bundle');
    const bytes = base64UrlDecode(b64);
    bindings.push(decodeAndVerifyBindingAttestation(bytes, options));
  }

  const vaultProofs: SyncVaultProofWireItem[] = [];
  if (obj.vaultProofs !== undefined) {
    if (!Array.isArray(obj.vaultProofs) || obj.vaultProofs.length > MAX_VAULT_PROOFS_PER_BUNDLE) {
      throw new Error('CHM sync rumor vaultProofs field is invalid or exceeds bounds');
    }
    for (const item of obj.vaultProofs) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      if (typeof item.proofBase64Url !== 'string' || !item.proofBase64Url || item.proofBase64Url.length > 8192) {
        continue;
      }
      vaultProofs.push({
        proofBase64Url: item.proofBase64Url,
        creationMethod:
          typeof item.creationMethod === 'string' ? item.creationMethod.slice(0, 64) : undefined,
        createdAt: typeof item.createdAt === 'string' ? item.createdAt.slice(0, 64) : undefined,
      });
    }
  }

  let profileSnapshot: SyncVaultProfileWireSnapshot | undefined;
  if (obj.profileSnapshot && typeof obj.profileSnapshot === 'object' && !Array.isArray(obj.profileSnapshot)) {
    const rawP = obj.profileSnapshot;
    const links = Array.isArray(rawP.links)
      ? rawP.links
          .filter(
            (l): l is { label?: string; url: string } =>
              Boolean(l) && typeof l.url === 'string',
          )
          .slice(0, 8)
          .map((l) => ({
            label: typeof l.label === 'string' ? l.label.slice(0, 64) : undefined,
            url: l.url.slice(0, 256),
          }))
      : undefined;
    profileSnapshot = {
      displayName: typeof rawP.displayName === 'string' ? rawP.displayName.slice(0, 80) : undefined,
      website: typeof rawP.website === 'string' ? rawP.website.slice(0, 256) : undefined,
      links,
      updatedAt: typeof rawP.updatedAt === 'string' ? rawP.updatedAt.slice(0, 64) : undefined,
    };
  }

  const trustedArtists: SyncTrustedArtistWireEntry[] = [];
  if (Array.isArray(obj.trustedArtists)) {
    for (const entry of obj.trustedArtists.slice(0, MAX_SYNC_BUNDLE_ITEMS)) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      if (typeof entry.publicKeyBase64Url !== 'string' || typeof entry.label !== 'string') continue;
      trustedArtists.push({
        publicKeyBase64Url: entry.publicKeyBase64Url.slice(0, 128),
        label: entry.label.slice(0, 80),
        verificationState:
          entry.verificationState === 'confirmed' || entry.verificationState === 'unconfirmed'
            ? entry.verificationState
            : undefined,
      });
    }
  }

  return { ops, bindings, vaultProofs, profileSnapshot, trustedArtists };
}

export function bindingToRecord(b: DecodedBindingAttestation): VerifiedPeerBinding {
  return {
    key: `${b.ownerFingerprintHex}:${b.deviceIdHex}:${b.nostrPubkeyHex}`,
    bindingIdHex: b.bindingIdHex,
    ownerFingerprintHex: b.ownerFingerprintHex,
    ownerPublicKeyBase64Url: b.ownerPublicKeyBase64Url,
    deviceIdHex: b.deviceIdHex,
    devicePublicKeyBase64Url: b.devicePublicKeyBase64Url,
    nostrPubkeyHex: b.nostrPubkeyHex,
    npub: b.npub,
    signerRole: b.signerRole,
    issuedAt: b.issuedAt,
    expiresAt: b.expiresAt,
    bindingCborBase64Url: base64UrlEncode(b.envelopeBytes),
    updatedAt: new Date().toISOString(),
  };
}

export interface DeterministicResolutionResult {
  pairedDevices: PairedDeviceRecord[];
  revocations: DeviceRevocationRecord[];
  activeBindings: VerifiedPeerBinding[];
  orderedOps: DecodedSyncOperation[];
  missingSequences: number[];
  hasCausalGap: boolean;
  detectedChainForks: string[];
}

export function resolveDeterministicSyncState(params: {
  ownerFingerprintHex: string;
  existingPairedDevices: PairedDeviceRecord[];
  existingRevocations: DeviceRevocationRecord[];
  existingBindings: VerifiedPeerBinding[];
  operations: DecodedSyncOperation[];
  candidateBindings?: DecodedBindingAttestation[];
  trustedOwnerKeys: ReadonlySet<string>;
  nowIso?: string;
}): DeterministicResolutionResult {
  const nowIso = params.nowIso ?? new Date().toISOString();

  const seenHashes = new Set<string>();
  const ownerOps: DecodedSyncOperation[] = [];
  for (const op of params.operations) {
    if (op.ownerFingerprintHex !== params.ownerFingerprintHex) continue;
    if (seenHashes.has(op.opHashHex)) continue;
    seenHashes.add(op.opHashHex);
    ownerOps.push(op);
  }
  ownerOps.sort((a, b) => a.sequence - b.sequence || a.opHashHex.localeCompare(b.opHashHex));

  const seqSet = new Set<number>();
  let maxSeq = 0;
  for (const op of ownerOps) {
    seqSet.add(op.sequence);
    if (op.sequence > maxSeq) maxSeq = op.sequence;
  }
  const missingSequences: number[] = [];
  for (let s = 1; s <= maxSeq; s++) {
    if (!seqSet.has(s)) missingSequences.push(s);
  }

  const detectedChainForks: string[] = [];
  const bySeq = new Map<number, DecodedSyncOperation[]>();
  for (const op of ownerOps) {
    const arr = bySeq.get(op.sequence) ?? [];
    arr.push(op);
    bySeq.set(op.sequence, arr);
  }
  for (const [seq, list] of bySeq.entries()) {
    if (list.length > 1) {
      detectedChainForks.push(`Multiple operations share sequence #${seq}`);
    }
    if (seq > 1) {
      const parents = bySeq.get(seq - 1);
      if (parents && parents.length === 1) {
        const expectedPrev = parents[0].opHashHex;
        for (const op of list) {
          if (op.prevOpHashHex !== ZERO_HASH_HEX_32 && op.prevOpHashHex !== expectedPrev) {
            detectedChainForks.push(
              `Causal parent hash mismatch at sequence #${seq} (${op.opIdHex.slice(0, 8)})`,
            );
          }
        }
      }
    }
  }

  const revByKey = new Map<string, DeviceRevocationRecord>();
  const revokedDevicePubs = new Set<string>();
  for (const r of params.existingRevocations) {
    if (r.ownerFingerprintHex !== params.ownerFingerprintHex) continue;
    revByKey.set(r.key, r);
    revokedDevicePubs.add(r.devicePublicKeyBase64Url);
  }

  const recordRevocation = (rev: SignedDeviceRevocationNotice) => {
    const p = rev.payload;
    if (p.ownerFingerprintHex !== params.ownerFingerprintHex) return;
    const key = `${p.ownerFingerprintHex}:${p.deviceIdHex}`;
    const prev = revByKey.get(key);
    if (!prev || p.sequence >= prev.sequence) {
      revByKey.set(key, {
        key,
        ownerFingerprintHex: p.ownerFingerprintHex,
        ownerPublicKeyBase64Url: p.ownerPublicKeyBase64Url,
        deviceIdHex: p.deviceIdHex,
        devicePublicKeyBase64Url: p.devicePublicKeyBase64Url,
        sequence: p.sequence,
        revokedAt: p.revokedAt,
        reason: p.reason,
        note: p.note,
        token: rev.token,
        importedAt: nowIso,
        dismissedFromList: prev?.dismissedFromList ? true : undefined,
      });
    }
    revokedDevicePubs.add(p.devicePublicKeyBase64Url);
  };

  for (const op of ownerOps) {
    if (op.revocationNotice) {
      recordRevocation(op.revocationNotice);
    }
    if (op.registrySnapshot) {
      for (const r of op.registrySnapshot.payload.revocations) {
        recordRevocation(r);
      }
    }
  }

  const deviceMap = new Map<string, PairedDeviceRecord>();
  for (const existing of params.existingPairedDevices) {
    if (existing.ownerFingerprintHex === params.ownerFingerprintHex) {
      deviceMap.set(existing.key, { ...existing });
    }
  }

  const applyCert = (cert: SignedEnrollmentCertificate) => {
    const c = cert.payload;
    if (c.ownerFingerprintHex !== params.ownerFingerprintHex) return;
    const key = `${c.ownerFingerprintHex}:${c.deviceIdHex}`;
    const existing = deviceMap.get(key);
    const rev = revByKey.get(key);
    const ownerTrusted =
      Boolean(existing?.ownerConfirmedTrust) || params.trustedOwnerKeys.has(c.ownerPublicKeyBase64Url);

    if (existing && existing.devicePublicKeyBase64Url !== c.devicePublicKeyBase64Url) {
      deviceMap.set(key, {
        ...existing,
        localVerificationStatus: 'conflict-revoked',
        updatedAt: nowIso,
      });
      return;
    }

    const isRevoked =
      Boolean(rev) ||
      revokedDevicePubs.has(c.devicePublicKeyBase64Url) ||
      existing?.localVerificationStatus === 'revoked' ||
      existing?.localVerificationStatus === 'conflict-revoked';

    if (isRevoked) {
      deviceMap.set(key, {
        ownerFingerprintHex: c.ownerFingerprintHex,
        ownerFingerprintShort: c.ownerFingerprintShort,
        ownerPublicKeyBase64Url: c.ownerPublicKeyBase64Url,
        ownerDisplayName: c.ownerDisplayName,
        deviceIdHex: c.deviceIdHex,
        devicePublicKeyBase64Url: existing?.devicePublicKeyBase64Url ?? c.devicePublicKeyBase64Url,
        deviceFingerprintHex: existing?.deviceFingerprintHex ?? c.deviceFingerprintHex,
        deviceFingerprintShort: existing?.deviceFingerprintShort ?? c.deviceFingerprintShort,
        deviceName: existing?.deviceName ?? c.deviceDisplayName,
        permissions: [...c.permissions],
        issuedAt: existing?.issuedAt ?? c.issuedAt,
        enrollmentToken: existing?.enrollmentToken ?? cert.token,
        revocationNoticeToken: rev?.token ?? existing?.revocationNoticeToken,
        revokedAt: rev?.revokedAt ?? existing?.revokedAt,
        revocationReason: rev?.reason ?? existing?.revocationReason,
        revocationSequence: rev?.sequence ?? existing?.revocationSequence,
        key,
        ownerConfirmedTrust: ownerTrusted,
        localVerificationStatus:
          existing?.localVerificationStatus === 'conflict-revoked' ? 'conflict-revoked' : 'revoked',
        updatedAt: nowIso,
      });
      return;
    }

    if (!existing) {
      deviceMap.set(key, {
        key,
        ownerFingerprintHex: c.ownerFingerprintHex,
        ownerFingerprintShort: c.ownerFingerprintShort,
        ownerPublicKeyBase64Url: c.ownerPublicKeyBase64Url,
        ownerDisplayName: c.ownerDisplayName,
        deviceIdHex: c.deviceIdHex,
        devicePublicKeyBase64Url: c.devicePublicKeyBase64Url,
        deviceFingerprintHex: c.deviceFingerprintHex,
        deviceFingerprintShort: c.deviceFingerprintShort,
        deviceName: c.deviceDisplayName,
        permissions: [...c.permissions],
        issuedAt: c.issuedAt,
        enrollmentToken: cert.token,
        ownerConfirmedTrust: ownerTrusted,
        localVerificationStatus: ownerTrusted ? 'active-trusted' : 'active-unverified-owner',
        updatedAt: nowIso,
      });
    } else if (existing.localVerificationStatus === 'active-unverified-owner' && ownerTrusted) {
      deviceMap.set(key, {
        ...existing,
        ownerConfirmedTrust: true,
        localVerificationStatus: 'active-trusted',
        updatedAt: nowIso,
      });
    }
  };

  for (const op of ownerOps) {
    if (op.enrollmentCertificate) {
      applyCert(op.enrollmentCertificate);
    }
    if (op.registrySnapshot) {
      for (const c of op.registrySnapshot.payload.certificates) {
        applyCert(c);
      }
    }
  }

  for (const [key, rev] of revByKey.entries()) {
    const existing = deviceMap.get(key);
    if (existing) {
      const pubChanged = existing.devicePublicKeyBase64Url !== rev.devicePublicKeyBase64Url;
      deviceMap.set(key, {
        ...existing,
        revocationNoticeToken: rev.token,
        revokedAt: rev.revokedAt,
        revocationReason: rev.reason,
        revocationSequence: Math.max(rev.sequence, existing.revocationSequence ?? 0),
        localVerificationStatus: pubChanged ? 'conflict-revoked' : 'revoked',
        updatedAt: nowIso,
      });
    } else {
      const devPubBytes = base64UrlDecode(rev.devicePublicKeyBase64Url);
      const devFp = computePublicKeyFingerprintSync(devPubBytes);
      const ownerPubBytes = base64UrlDecode(rev.ownerPublicKeyBase64Url);
      const ownerFp = computePublicKeyFingerprintSync(ownerPubBytes);
      deviceMap.set(key, {
        key,
        ownerFingerprintHex: rev.ownerFingerprintHex,
        ownerFingerprintShort: ownerFp.shortDisplay,
        ownerPublicKeyBase64Url: rev.ownerPublicKeyBase64Url,
        ownerDisplayName: ownerFp.shortDisplay,
        deviceIdHex: rev.deviceIdHex,
        devicePublicKeyBase64Url: rev.devicePublicKeyBase64Url,
        deviceFingerprintHex: devFp.fullHex,
        deviceFingerprintShort: devFp.shortDisplay,
        deviceName: `Revoked Device (${devFp.shortDisplay})`,
        permissions: ['device-identity'],
        issuedAt: rev.revokedAt,
        enrollmentToken: '',
        revocationNoticeToken: rev.token,
        revokedAt: rev.revokedAt,
        revocationReason: rev.reason,
        revocationSequence: rev.sequence,
        localVerificationStatus: 'revoked',
        ownerConfirmedTrust: false,
        updatedAt: nowIso,
      });
    }
  }

  const bindingMap = new Map<string, VerifiedPeerBinding>();
  const ingestBinding = (b: VerifiedPeerBinding) => {
    if (b.ownerFingerprintHex !== params.ownerFingerprintHex) return;
    const devKey = `${b.ownerFingerprintHex}:${b.deviceIdHex}`;
    const devEntry = deviceMap.get(devKey);
    const revEntry = revByKey.get(devKey);
    if (
      revEntry ||
      revokedDevicePubs.has(b.devicePublicKeyBase64Url) ||
      devEntry?.localVerificationStatus === 'revoked' ||
      devEntry?.localVerificationStatus === 'conflict-revoked'
    ) {
      return;
    }
    if (devEntry && devEntry.devicePublicKeyBase64Url !== b.devicePublicKeyBase64Url) {
      return;
    }
    if (b.signerRole === 'paired-device' && !devEntry) {
      return;
    }

    const prev = bindingMap.get(devKey);
    if (
      !prev ||
      b.issuedAt > prev.issuedAt ||
      (b.issuedAt === prev.issuedAt && b.nostrPubkeyHex > prev.nostrPubkeyHex)
    ) {
      bindingMap.set(devKey, b);
    }
  };

  for (const b of params.existingBindings) {
    ingestBinding(b);
  }
  for (const op of ownerOps) {
    if (op.bindingAttestation) {
      ingestBinding(bindingToRecord(op.bindingAttestation));
    }
  }
  for (const b of params.candidateBindings ?? []) {
    ingestBinding(bindingToRecord(b));
  }

  const pairedDevices = Array.from(deviceMap.values()).sort(
    (a, b) => b.issuedAt - a.issuedAt || b.updatedAt.localeCompare(a.updatedAt),
  );
  const revocations = Array.from(revByKey.values()).sort((a, b) => b.sequence - a.sequence);
  const activeBindings = Array.from(bindingMap.values()).sort((a, b) =>
    a.deviceIdHex.localeCompare(b.deviceIdHex),
  );

  return {
    pairedDevices,
    revocations,
    activeBindings,
    orderedOps: ownerOps,
    missingSequences,
    hasCausalGap: missingSequences.length > 0 || detectedChainForks.length > 0,
    detectedChainForks,
  };
}

export function selectActiveSyncRecipients(params: {
  ownerFingerprintHex: string;
  bindings: VerifiedPeerBinding[];
  pairedDevices: PairedDeviceRecord[];
  revocations: DeviceRevocationRecord[];
  excludeDeviceIdHex?: string;
}): Array<{ deviceIdHex: string; nostrPubkeyHex: string }> {
  const revokedDeviceIds = new Set<string>();
  const revokedPubs = new Set<string>();
  for (const r of params.revocations) {
    if (r.ownerFingerprintHex === params.ownerFingerprintHex) {
      revokedDeviceIds.add(r.deviceIdHex);
      revokedPubs.add(r.devicePublicKeyBase64Url);
    }
  }
  const devById = new Map<string, PairedDeviceRecord>();
  for (const d of params.pairedDevices) {
    if (d.ownerFingerprintHex === params.ownerFingerprintHex) {
      devById.set(d.deviceIdHex, d);
      if (
        d.localVerificationStatus === 'revoked' ||
        d.localVerificationStatus === 'conflict-revoked'
      ) {
        revokedDeviceIds.add(d.deviceIdHex);
        revokedPubs.add(d.devicePublicKeyBase64Url);
      }
    }
  }

  const recipients = new Map<string, { deviceIdHex: string; nostrPubkeyHex: string }>();
  for (const b of params.bindings) {
    if (b.ownerFingerprintHex !== params.ownerFingerprintHex) continue;
    if (params.excludeDeviceIdHex && b.deviceIdHex === params.excludeDeviceIdHex) continue;
    if (revokedDeviceIds.has(b.deviceIdHex) || revokedPubs.has(b.devicePublicKeyBase64Url)) {
      continue;
    }
    const dev = devById.get(b.deviceIdHex);
    if (dev && dev.devicePublicKeyBase64Url !== b.devicePublicKeyBase64Url) {
      continue;
    }
    if (!recipients.has(b.nostrPubkeyHex)) {
      recipients.set(b.nostrPubkeyHex, {
        deviceIdHex: b.deviceIdHex,
        nostrPubkeyHex: b.nostrPubkeyHex,
      });
    }
  }
  return Array.from(recipients.values());
}

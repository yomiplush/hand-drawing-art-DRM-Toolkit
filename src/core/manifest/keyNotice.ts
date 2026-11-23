import { decode as cborDecode, encode as cborEncode, rfc8949EncodeOptions } from 'cborg';
import type { DecodeOptions } from 'cborg';
import { computePublicKeyFingerprint, verifyEd25519Signature } from '../crypto/ed25519';
import { base64UrlDecode, base64UrlEncode, constantTimeEqual } from '../crypto/sha256';
import { formatUuidHex, generateArtworkId, sanitizeAndValidateText } from './cborCodec';

export const KEY_NOTICE_DOMAIN_PREFIX = new Uint8Array([
  0x43, 0x48, 0x4d, 0x2d, 0x4e, 0x4f, 0x54, 0x49, 0x43, 0x45, 0x31, 0x00,
]); // "CHM-NOTICE1\0"

export const KEY_NOTICE_FORMAT = 'certified-handmade-key-notice' as const;
export const KEY_NOTICE_VERSION = 1 as const;
export const MAX_NOTICE_NOTE_UTF8_BYTES = 160;
export const MAX_NOTICE_BYTES = 2048;
export const MAX_NOTICE_INPUT_CHARS = 16_384;

export type KeyNoticeType = 'revocation' | 'rotation';
export type KeyNoticeReason = 'key-compromise' | 'key-superseded' | 'retired' | 'other';

const TYPE_TO_CODE: Record<KeyNoticeType, number> = {
  revocation: 1,
  rotation: 2,
};

const CODE_TO_TYPE: Record<number, KeyNoticeType> = {
  1: 'revocation',
  2: 'rotation',
};

const REASON_TO_CODE: Record<KeyNoticeReason, number> = {
  'key-compromise': 1,
  'key-superseded': 2,
  retired: 3,
  other: 4,
};

const CODE_TO_REASON: Record<number, KeyNoticeReason> = {
  1: 'key-compromise',
  2: 'key-superseded',
  3: 'retired',
  4: 'other',
};

const STRICT_DECODE_OPTIONS: DecodeOptions = {
  allowIndefinite: false,
  allowUndefined: false,
  coerceUndefinedToNull: false,
  allowInfinity: false,
  allowNaN: false,
  allowBigInt: false,
  strict: true,
  useMaps: true,
  rejectDuplicateMapKeys: true,
  rejectInvalidUtf8: true,
};

export interface UnsignedKeyNotice {
  version: typeof KEY_NOTICE_VERSION;
  noticeId: Uint8Array;
  noticeType: KeyNoticeType;
  subjectPublicKey: Uint8Array;
  replacementPublicKey?: Uint8Array;
  noticeIssuedAt: number;
  reason: KeyNoticeReason;
  note?: string;
}

export interface SignedKeyNotice extends UnsignedKeyNotice {
  noticeIdHex: string;
  subjectSignature: Uint8Array;
  replacementSignature?: Uint8Array;
}

export interface PortableKeyNoticeBundle {
  format: typeof KEY_NOTICE_FORMAT;
  version: typeof KEY_NOTICE_VERSION;
  noticeType: KeyNoticeType;
  noticeId: string;
  subjectPublicKey: string;
  subjectFingerprint: string;
  replacementPublicKey?: string;
  replacementFingerprint?: string;
  reason: KeyNoticeReason;
  noticeIssuedAt: string;
  noticeBase64Url: string;
  token: string;
  createdAt: string;
}

export interface VerifiedKeyNoticeResult {
  valid: boolean;
  notice: SignedKeyNotice;
  noticeBytes: Uint8Array;
  token: string;
  subjectPublicKeyBase64Url: string;
  subjectFingerprintHex: string;
  subjectFingerprintShort: string;
  replacementPublicKeyBase64Url?: string;
  replacementFingerprintHex?: string;
  replacementFingerprintShort?: string;
  noticeIssuedAt: number;
  verifiedAt: number;
  errors: string[];
}

export function encodeUnsignedKeyNoticePayload(notice: UnsignedKeyNotice): Uint8Array {
  if (notice.version !== KEY_NOTICE_VERSION) {
    throw new Error(`Unsupported key notice version: ${String(notice.version)}`);
  }
  if (notice.noticeId.length !== 16) {
    throw new Error('noticeId must be 16 bytes');
  }
  if (notice.subjectPublicKey.length !== 32) {
    throw new Error('subjectPublicKey must be 32 bytes');
  }
  if (notice.noticeType === 'rotation') {
    if (!notice.replacementPublicKey || notice.replacementPublicKey.length !== 32) {
      throw new Error('Rotation notice requires a 32-byte replacementPublicKey');
    }
    if (constantTimeEqual(notice.subjectPublicKey, notice.replacementPublicKey)) {
      throw new Error('replacementPublicKey must differ from subjectPublicKey');
    }
  } else if (notice.replacementPublicKey !== undefined) {
    throw new Error('Revocation notice must not specify replacementPublicKey');
  }
  if (!Number.isSafeInteger(notice.noticeIssuedAt) || notice.noticeIssuedAt < 0) {
    throw new Error('noticeIssuedAt must be a non-negative integer Unix timestamp');
  }

  const note = sanitizeAndValidateText(notice.note, MAX_NOTICE_NOTE_UTF8_BYTES, 'notice.note');

  const map = new Map<number, unknown>();
  map.set(1, new Uint8Array(notice.noticeId));
  map.set(2, TYPE_TO_CODE[notice.noticeType]);
  map.set(3, new Uint8Array(notice.subjectPublicKey));
  if (notice.replacementPublicKey) {
    map.set(4, new Uint8Array(notice.replacementPublicKey));
  }
  map.set(5, notice.noticeIssuedAt);
  map.set(6, REASON_TO_CODE[notice.reason]);
  if (note !== undefined) {
    map.set(7, note);
  }
  return cborEncode(map, rfc8949EncodeOptions);
}

export function buildKeyNoticeSigningMessage(payloadBytes: Uint8Array): Uint8Array {
  const msg = new Uint8Array(KEY_NOTICE_DOMAIN_PREFIX.length + payloadBytes.length);
  msg.set(KEY_NOTICE_DOMAIN_PREFIX, 0);
  msg.set(payloadBytes, KEY_NOTICE_DOMAIN_PREFIX.length);
  return msg;
}

export function encodeSignedKeyNoticeEnvelope(params: {
  payloadBytes: Uint8Array;
  noticeType: KeyNoticeType;
  subjectSignature: Uint8Array;
  replacementSignature?: Uint8Array;
}): Uint8Array {
  if (params.subjectSignature.length !== 64) {
    throw new Error('subjectSignature must be 64 bytes');
  }
  const envelope: unknown[] = [KEY_NOTICE_VERSION, params.payloadBytes, params.subjectSignature];
  if (params.noticeType === 'rotation') {
    if (!params.replacementSignature || params.replacementSignature.length !== 64) {
      throw new Error('Rotation notice requires 64-byte replacementSignature');
    }
    envelope.push(params.replacementSignature);
  } else if (params.replacementSignature !== undefined) {
    throw new Error('Revocation notice must not include replacementSignature');
  }
  const encoded = cborEncode(envelope, rfc8949EncodeOptions);
  if (encoded.length > MAX_NOTICE_BYTES) {
    throw new Error(`Encoded key notice (${encoded.length} bytes) exceeds ${MAX_NOTICE_BYTES}`);
  }
  return encoded;
}

export function decodeSignedKeyNoticeEnvelope(noticeBytes: Uint8Array): {
  payloadBytes: Uint8Array;
  notice: SignedKeyNotice;
} {
  if (!(noticeBytes instanceof Uint8Array) || noticeBytes.length === 0) {
    throw new Error('Key notice bytes must be non-empty');
  }
  if (noticeBytes.length > MAX_NOTICE_BYTES) {
    throw new Error(`Key notice exceeds maximum size (${MAX_NOTICE_BYTES} bytes)`);
  }
  const outer = cborDecode(noticeBytes, STRICT_DECODE_OPTIONS);
  if (!Array.isArray(outer) || (outer.length !== 3 && outer.length !== 4)) {
    throw new Error('Key notice envelope must be a 3 or 4-element CBOR array');
  }
  const [version, payloadBytes, subjectSignature, replacementSignature] = outer;
  if (version !== KEY_NOTICE_VERSION) {
    throw new Error(`Unsupported key notice version: ${String(version)}`);
  }
  if (!(payloadBytes instanceof Uint8Array) || payloadBytes.length === 0) {
    throw new Error('Key notice payload must be a non-empty byte string');
  }
  if (!(subjectSignature instanceof Uint8Array) || subjectSignature.length !== 64) {
    throw new Error('subjectSignature must be 64 bytes');
  }

  const reEncodedOuter = cborEncode(outer, rfc8949EncodeOptions);
  if (!constantTimeEqual(reEncodedOuter, noticeBytes)) {
    throw new Error('Key notice envelope is not canonically CBOR-encoded');
  }

  const decodedPayload = cborDecode(payloadBytes, STRICT_DECODE_OPTIONS);
  if (!(decodedPayload instanceof Map)) {
    throw new Error('Key notice payload must be a CBOR map');
  }

  const allowedKeys = new Set([1, 2, 3, 4, 5, 6, 7]);
  for (const key of decodedPayload.keys()) {
    if (typeof key !== 'number' || !allowedKeys.has(key)) {
      throw new Error(`Unknown key notice field: ${String(key)}`);
    }
  }

  const noticeId = decodedPayload.get(1);
  const typeCode = decodedPayload.get(2);
  const subjectPublicKey = decodedPayload.get(3);
  const replacementRaw = decodedPayload.get(4);
  const noticeIssuedAt = decodedPayload.get(5);
  const reasonCode = decodedPayload.get(6);
  const noteRaw = decodedPayload.get(7);

  if (!(noticeId instanceof Uint8Array) || noticeId.length !== 16) {
    throw new Error('noticeId must be 16 bytes');
  }
  const noticeType = typeof typeCode === 'number' ? CODE_TO_TYPE[typeCode] : undefined;
  if (!noticeType) {
    throw new Error('Unknown key notice type code');
  }
  if (!(subjectPublicKey instanceof Uint8Array) || subjectPublicKey.length !== 32) {
    throw new Error('subjectPublicKey must be 32 bytes');
  }

  let replacementPublicKey: Uint8Array | undefined;
  if (noticeType === 'rotation') {
    if (outer.length !== 4 || !(replacementSignature instanceof Uint8Array) || replacementSignature.length !== 64) {
      throw new Error('Rotation notice must contain a 64-byte replacementSignature');
    }
    if (!(replacementRaw instanceof Uint8Array) || replacementRaw.length !== 32) {
      throw new Error('Rotation notice must contain a 32-byte replacementPublicKey');
    }
    replacementPublicKey = replacementRaw;
    if (constantTimeEqual(subjectPublicKey, replacementPublicKey)) {
      throw new Error('Rotation notice replacementPublicKey must differ from subjectPublicKey');
    }
  } else {
    if (outer.length !== 3 || decodedPayload.has(4)) {
      throw new Error('Revocation notice must not contain replacement key or second signature');
    }
  }

  if (
    typeof noticeIssuedAt !== 'number' ||
    !Number.isSafeInteger(noticeIssuedAt) ||
    noticeIssuedAt < 0
  ) {
    throw new Error('noticeIssuedAt must be a non-negative integer Unix timestamp');
  }
  const reason = typeof reasonCode === 'number' ? CODE_TO_REASON[reasonCode] : undefined;
  if (!reason) {
    throw new Error('Unknown key notice reason code');
  }

  let note: string | undefined;
  if (decodedPayload.has(7)) {
    if (typeof noteRaw !== 'string') {
      throw new Error('notice.note must be a string');
    }
    note = sanitizeAndValidateText(noteRaw, MAX_NOTICE_NOTE_UTF8_BYTES, 'notice.note');
    if (note === undefined) {
      throw new Error('notice.note cannot be empty when present');
    }
  }

  const unsigned: UnsignedKeyNotice = {
    version: KEY_NOTICE_VERSION,
    noticeId,
    noticeType,
    subjectPublicKey,
    replacementPublicKey,
    noticeIssuedAt,
    reason,
    note,
  };
  const reEncodedPayload = encodeUnsignedKeyNoticePayload(unsigned);
  if (!constantTimeEqual(reEncodedPayload, payloadBytes)) {
    throw new Error('Key notice payload is not canonically CBOR-encoded');
  }

  return {
    payloadBytes,
    notice: {
      ...unsigned,
      noticeIdHex: formatUuidHex(noticeId),
      subjectSignature,
      replacementSignature: replacementSignature instanceof Uint8Array ? replacementSignature : undefined,
    },
  };
}

export function extractKeyNoticeBytesFromInput(rawInput: string): Uint8Array {
  if (typeof rawInput !== 'string') {
    throw new Error('Key notice input must be a string');
  }
  const trimmed = rawInput.trim();
  if (!trimmed || trimmed.length > MAX_NOTICE_INPUT_CHARS) {
    throw new Error('Key notice input is empty or exceeds maximum length');
  }

  let token = trimmed;
  if (trimmed.startsWith('{')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error('Malformed JSON key notice bundle');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Invalid JSON key notice bundle');
    }
    const obj = parsed as Record<string, unknown>;
    if (obj.format !== KEY_NOTICE_FORMAT || obj.version !== KEY_NOTICE_VERSION) {
      throw new Error('Unsupported key notice bundle format or version');
    }
    if (typeof obj.noticeBase64Url === 'string' && obj.noticeBase64Url.length > 0) {
      token = obj.noticeBase64Url.trim();
    } else if (typeof obj.token === 'string' && obj.token.length > 0) {
      token = obj.token.trim();
    } else {
      throw new Error('Key notice bundle is missing noticeBase64Url');
    }
  }

  if (token.startsWith('chm-notice:')) {
    token = token.slice('chm-notice:'.length);
  }
  const noticeBytes = base64UrlDecode(token);
  if (noticeBytes.length === 0 || noticeBytes.length > MAX_NOTICE_BYTES) {
    throw new Error('Key notice payload bytes out of bounds');
  }
  return noticeBytes;
}

export async function createSignedKeyNotice(params: {
  noticeType: KeyNoticeType;
  subjectPublicKey: Uint8Array;
  signWithSubjectKey: (message: Uint8Array) => Promise<Uint8Array>;
  replacementPublicKey?: Uint8Array;
  signWithReplacementKey?: (message: Uint8Array) => Promise<Uint8Array>;
  reason: KeyNoticeReason;
  note?: string;
  noticeIssuedAt?: number;
}): Promise<{
  noticeBytes: Uint8Array;
  token: string;
  bundle: PortableKeyNoticeBundle;
  notice: SignedKeyNotice;
}> {
  const noticeId = generateArtworkId();
  const noticeIssuedAt = params.noticeIssuedAt ?? Math.floor(Date.now() / 1000);
  const unsigned: UnsignedKeyNotice = {
    version: KEY_NOTICE_VERSION,
    noticeId,
    noticeType: params.noticeType,
    subjectPublicKey: params.subjectPublicKey,
    replacementPublicKey: params.replacementPublicKey,
    noticeIssuedAt,
    reason: params.reason,
    note: params.note,
  };
  const payloadBytes = encodeUnsignedKeyNoticePayload(unsigned);
  const signingMsg = buildKeyNoticeSigningMessage(payloadBytes);
  const subjectSignature = await params.signWithSubjectKey(signingMsg);

  let replacementSignature: Uint8Array | undefined;
  if (params.noticeType === 'rotation') {
    if (!params.signWithReplacementKey) {
      throw new Error('Rotation notice requires signing with replacement key as well');
    }
    replacementSignature = await params.signWithReplacementKey(signingMsg);
  }

  const noticeBytes = encodeSignedKeyNoticeEnvelope({
    payloadBytes,
    noticeType: params.noticeType,
    subjectSignature,
    replacementSignature,
  });
  const noticeBase64Url = base64UrlEncode(noticeBytes);
  const token = `chm-notice:${noticeBase64Url}`;
  const noticeIdHex = formatUuidHex(noticeId);
  const subjectFp = await computePublicKeyFingerprint(params.subjectPublicKey);
  const replacementFp = params.replacementPublicKey
    ? await computePublicKeyFingerprint(params.replacementPublicKey)
    : undefined;

  return {
    noticeBytes,
    token,
    notice: {
      ...unsigned,
      noticeIdHex,
      subjectSignature,
      replacementSignature,
    },
    bundle: {
      format: KEY_NOTICE_FORMAT,
      version: KEY_NOTICE_VERSION,
      noticeType: params.noticeType,
      noticeId: noticeIdHex,
      subjectPublicKey: base64UrlEncode(params.subjectPublicKey),
      subjectFingerprint: subjectFp.fullHex,
      replacementPublicKey: params.replacementPublicKey
        ? base64UrlEncode(params.replacementPublicKey)
        : undefined,
      replacementFingerprint: replacementFp?.fullHex,
      reason: params.reason,
      noticeIssuedAt: new Date(noticeIssuedAt * 1000).toISOString(),
      noticeBase64Url,
      token,
      createdAt: new Date().toISOString(),
    },
  };
}

export async function verifyKeyNoticeInput(
  rawInput: string,
  verifiedAt = Math.floor(Date.now() / 1000),
): Promise<VerifiedKeyNoticeResult> {
  const noticeBytes = extractKeyNoticeBytesFromInput(rawInput);
  const { payloadBytes, notice } = decodeSignedKeyNoticeEnvelope(noticeBytes);
  const signingMsg = buildKeyNoticeSigningMessage(payloadBytes);

  const errors: string[] = [];
  const subjectSigOk = await verifyEd25519Signature(
    notice.subjectPublicKey,
    signingMsg,
    notice.subjectSignature,
  );
  if (!subjectSigOk) {
    errors.push('Subject key Ed25519 signature verification failed for this notice.');
  }

  if (notice.noticeType === 'rotation') {
    if (!notice.replacementPublicKey || !notice.replacementSignature) {
      errors.push('Rotation notice is missing replacement key or signature.');
    } else {
      const replacementSigOk = await verifyEd25519Signature(
        notice.replacementPublicKey,
        signingMsg,
        notice.replacementSignature,
      );
      if (!replacementSigOk) {
        errors.push('Replacement key Ed25519 signature verification failed for this rotation notice.');
      }
    }
  }

  const subjectFp = await computePublicKeyFingerprint(notice.subjectPublicKey);
  const replacementFp = notice.replacementPublicKey
    ? await computePublicKeyFingerprint(notice.replacementPublicKey)
    : undefined;

  return {
    valid: errors.length === 0,
    notice,
    noticeBytes,
    token: `chm-notice:${base64UrlEncode(noticeBytes)}`,
    subjectPublicKeyBase64Url: base64UrlEncode(notice.subjectPublicKey),
    subjectFingerprintHex: subjectFp.fullHex,
    subjectFingerprintShort: subjectFp.shortDisplay,
    replacementPublicKeyBase64Url: notice.replacementPublicKey
      ? base64UrlEncode(notice.replacementPublicKey)
      : undefined,
    replacementFingerprintHex: replacementFp?.fullHex,
    replacementFingerprintShort: replacementFp?.shortDisplay,
    noticeIssuedAt: notice.noticeIssuedAt,
    verifiedAt,
    errors,
  };
}

import { decode as cborDecode, encode as cborEncode, rfc8949EncodeOptions } from 'cborg';
import type { DecodeOptions } from 'cborg';
import { computePublicKeyFingerprint, verifyEd25519Signature } from './ed25519';
import { base64UrlDecode, base64UrlEncode, constantTimeEqual } from './sha256';

export const CHALLENGE_DOMAIN_PREFIX = new Uint8Array([
  0x43, 0x48, 0x4d, 0x2d, 0x43, 0x48, 0x41, 0x4c, 0x4c, 0x45, 0x4e, 0x47, 0x45, 0x31, 0x00,
]); // "CHM-CHALLENGE1\0"

export const CHALLENGE_FORMAT = 'certified-handmade-key-challenge' as const;
export const CHALLENGE_RESPONSE_FORMAT = 'certified-handmade-key-challenge-response' as const;
export const CHALLENGE_VERSION = 1 as const;
export const MAX_CHALLENGE_NOTE_UTF8_BYTES = 96;
export const MAX_CHALLENGE_BYTES = 1024;
export const MAX_CHALLENGE_INPUT_CHARS = 8192;

const STRICT_CBOR_DECODE: DecodeOptions = {
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

const textEncoder = new TextEncoder();

function formatUuidHex(bytes16: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes16.length; i++) {
    hex += bytes16[i].toString(16).padStart(2, '0');
  }
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function sanitizeNote(note?: string): string | undefined {
  if (note === undefined) return undefined;
  const trimmed = note.trim();
  if (!trimmed) return undefined;
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) {
      throw new Error('Challenge note contains disallowed control characters');
    }
  }
  if (textEncoder.encode(trimmed).length > MAX_CHALLENGE_NOTE_UTF8_BYTES) {
    throw new Error(`Challenge note exceeds ${MAX_CHALLENGE_NOTE_UTF8_BYTES} UTF-8 bytes`);
  }
  return trimmed;
}

export interface KeyChallengePayload {
  challengeId: Uint8Array;
  challengeIdHex: string;
  targetPublicKey: Uint8Array;
  nonce: Uint8Array;
  issuedAt: number;
  note?: string;
}

export interface KeyChallengeBundle {
  format: typeof CHALLENGE_FORMAT;
  version: typeof CHALLENGE_VERSION;
  challengeId: string;
  targetPublicKey: string;
  targetFingerprintShort: string;
  issuedAt: number;
  note?: string;
  token: string;
}

export interface KeyChallengeResponseBundle {
  format: typeof CHALLENGE_RESPONSE_FORMAT;
  version: typeof CHALLENGE_VERSION;
  challengeId: string;
  targetPublicKey: string;
  targetFingerprintShort: string;
  issuedAt: number;
  note?: string;
  token: string;
}

export interface VerifiedChallengeResult {
  valid: boolean;
  challengeIdHex: string;
  targetPublicKeyBase64Url: string;
  targetFingerprintHex: string;
  targetFingerprintShort: string;
  challengeIssuedAt: number;
  verifiedAt: number;
  note?: string;
  provesKeyPossessionOnly: true;
  provesRealWorldIdentity: false;
  error?: string;
}

export function encodeChallengePayload(params: {
  challengeId: Uint8Array;
  targetPublicKey: Uint8Array;
  nonce: Uint8Array;
  issuedAt: number;
  note?: string;
}): Uint8Array {
  if (params.challengeId.length !== 16) {
    throw new Error('challengeId must be 16 bytes');
  }
  if (params.targetPublicKey.length !== 32) {
    throw new Error('targetPublicKey must be 32 bytes');
  }
  if (params.nonce.length !== 32) {
    throw new Error('nonce must be 32 bytes');
  }
  if (!Number.isSafeInteger(params.issuedAt) || params.issuedAt < 0) {
    throw new Error('issuedAt must be a non-negative integer timestamp');
  }
  const cleanNote = sanitizeNote(params.note);
  const m = new Map<number, unknown>();
  m.set(1, new Uint8Array(params.challengeId));
  m.set(2, new Uint8Array(params.targetPublicKey));
  m.set(3, new Uint8Array(params.nonce));
  m.set(4, params.issuedAt);
  if (cleanNote !== undefined) {
    m.set(5, cleanNote);
  }
  return cborEncode(m, rfc8949EncodeOptions);
}

export function buildChallengeSigningMessage(payloadBytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(CHALLENGE_DOMAIN_PREFIX.length + payloadBytes.length);
  out.set(CHALLENGE_DOMAIN_PREFIX, 0);
  out.set(payloadBytes, CHALLENGE_DOMAIN_PREFIX.length);
  return out;
}

function decodeChallengePayloadBytes(payloadBytes: Uint8Array): KeyChallengePayload {
  const raw = cborDecode(payloadBytes, STRICT_CBOR_DECODE);
  if (!(raw instanceof Map)) {
    throw new Error('Challenge payload must be a CBOR map');
  }
  for (const k of raw.keys()) {
    if (typeof k !== 'number' || ![1, 2, 3, 4, 5].includes(k)) {
      throw new Error(`Invalid challenge payload key: ${String(k)}`);
    }
  }
  const challengeId = raw.get(1);
  const targetPublicKey = raw.get(2);
  const nonce = raw.get(3);
  const issuedAt = raw.get(4);
  const noteRaw = raw.get(5);

  if (!(challengeId instanceof Uint8Array) || challengeId.length !== 16) {
    throw new Error('challengeId must be 16 bytes');
  }
  if (!(targetPublicKey instanceof Uint8Array) || targetPublicKey.length !== 32) {
    throw new Error('targetPublicKey must be 32 bytes');
  }
  if (!(nonce instanceof Uint8Array) || nonce.length !== 32) {
    throw new Error('nonce must be 32 bytes');
  }
  if (typeof issuedAt !== 'number' || !Number.isSafeInteger(issuedAt) || issuedAt < 0) {
    throw new Error('issuedAt must be a non-negative integer');
  }
  let note: string | undefined;
  if (raw.has(5)) {
    if (typeof noteRaw !== 'string') {
      throw new Error('Challenge note must be a string');
    }
    note = sanitizeNote(noteRaw);
    if (note === undefined) {
      throw new Error('Challenge note cannot be empty when present');
    }
  }

  const reEncoded = encodeChallengePayload({
    challengeId,
    targetPublicKey,
    nonce,
    issuedAt,
    note,
  });
  if (!constantTimeEqual(reEncoded, payloadBytes)) {
    throw new Error('Challenge payload is not canonically CBOR-encoded');
  }

  return {
    challengeId,
    challengeIdHex: formatUuidHex(challengeId),
    targetPublicKey,
    nonce,
    issuedAt,
    note,
  };
}

export async function createKeyChallenge(params: {
  targetPublicKey32: Uint8Array;
  note?: string;
  issuedAt?: number;
}): Promise<{
  payload: KeyChallengePayload;
  payloadBytes: Uint8Array;
  challengeToken: string;
  bundle: KeyChallengeBundle;
}> {
  if (params.targetPublicKey32.length !== 32) {
    throw new Error('Target Ed25519 public key must be 32 bytes');
  }
  const challengeId = new Uint8Array(16);
  const nonce = new Uint8Array(32);
  globalThis.crypto.getRandomValues(challengeId);
  challengeId[6] = (challengeId[6] & 0x0f) | 0x40;
  challengeId[8] = (challengeId[8] & 0x3f) | 0x80;
  globalThis.crypto.getRandomValues(nonce);

  const issuedAt = params.issuedAt ?? Math.floor(Date.now() / 1000);
  const cleanNote = sanitizeNote(params.note);
  const payloadBytes = encodeChallengePayload({
    challengeId,
    targetPublicKey: params.targetPublicKey32,
    nonce,
    issuedAt,
    note: cleanNote,
  });
  const envelope = cborEncode([CHALLENGE_VERSION, payloadBytes], rfc8949EncodeOptions);
  if (envelope.length > MAX_CHALLENGE_BYTES) {
    throw new Error('Challenge payload exceeds maximum byte limit');
  }
  const token = `chm-challenge:${base64UrlEncode(envelope)}`;
  const fp = await computePublicKeyFingerprint(params.targetPublicKey32);
  const payload: KeyChallengePayload = {
    challengeId,
    challengeIdHex: formatUuidHex(challengeId),
    targetPublicKey: new Uint8Array(params.targetPublicKey32),
    nonce,
    issuedAt,
    note: cleanNote,
  };

  return {
    payload,
    payloadBytes,
    challengeToken: token,
    bundle: {
      format: CHALLENGE_FORMAT,
      version: CHALLENGE_VERSION,
      challengeId: payload.challengeIdHex,
      targetPublicKey: base64UrlEncode(params.targetPublicKey32),
      targetFingerprintShort: fp.shortDisplay,
      issuedAt,
      note: cleanNote,
      token,
    },
  };
}

export function parseKeyChallengeInput(rawInput: string): {
  payloadBytes: Uint8Array;
  payload: KeyChallengePayload;
} {
  if (typeof rawInput !== 'string') {
    throw new Error('Challenge input must be a string');
  }
  const trimmed = rawInput.trim();
  if (!trimmed || trimmed.length > MAX_CHALLENGE_INPUT_CHARS) {
    throw new Error('Challenge input is empty or exceeds size limit');
  }

  let token = trimmed;
  if (trimmed.startsWith('{')) {
    let obj: unknown;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      throw new Error('Malformed JSON challenge bundle');
    }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      throw new Error('Invalid JSON challenge bundle');
    }
    const rec = obj as Record<string, unknown>;
    if (rec.format !== CHALLENGE_FORMAT || rec.version !== CHALLENGE_VERSION || typeof rec.token !== 'string') {
      throw new Error('Unsupported key challenge JSON format');
    }
    token = rec.token.trim();
  }

  if (token.startsWith('chm-challenge:')) {
    token = token.slice('chm-challenge:'.length);
  }
  const rawBytes = base64UrlDecode(token);
  if (rawBytes.length === 0 || rawBytes.length > MAX_CHALLENGE_BYTES) {
    throw new Error('Challenge bytes out of bounds');
  }
  const decoded = cborDecode(rawBytes, STRICT_CBOR_DECODE);
  if (!Array.isArray(decoded) || decoded.length !== 2) {
    throw new Error('Challenge envelope must be a 2-element CBOR array');
  }
  const [version, payloadBytes] = decoded;
  if (version !== CHALLENGE_VERSION || !(payloadBytes instanceof Uint8Array)) {
    throw new Error('Unsupported challenge envelope version or payload');
  }
  const reEncoded = cborEncode([version, payloadBytes], rfc8949EncodeOptions);
  if (!constantTimeEqual(reEncoded, rawBytes)) {
    throw new Error('Challenge envelope is not canonically CBOR-encoded');
  }
  const payload = decodeChallengePayloadBytes(payloadBytes);
  return { payloadBytes, payload };
}

export async function signKeyChallenge(params: {
  challengeInput: string;
  signerPublicKey32: Uint8Array;
  signFn: (message: Uint8Array) => Promise<Uint8Array>;
}): Promise<{
  responseToken: string;
  bundle: KeyChallengeResponseBundle;
  payload: KeyChallengePayload;
}> {
  const { payloadBytes, payload } = parseKeyChallengeInput(params.challengeInput);
  if (!constantTimeEqual(payload.targetPublicKey, params.signerPublicKey32)) {
    throw new Error('Challenge target public key does not match the selected signing key');
  }
  const signingMsg = buildChallengeSigningMessage(payloadBytes);
  const sig64 = await params.signFn(signingMsg);
  if (sig64.length !== 64) {
    throw new Error('Challenge signature must be 64 bytes');
  }
  const envelope = cborEncode([CHALLENGE_VERSION, payloadBytes, sig64], rfc8949EncodeOptions);
  if (envelope.length > MAX_CHALLENGE_BYTES) {
    throw new Error('Signed challenge response exceeds maximum byte limit');
  }
  const responseToken = `chm-response:${base64UrlEncode(envelope)}`;
  const fp = await computePublicKeyFingerprint(payload.targetPublicKey);
  return {
    responseToken,
    payload,
    bundle: {
      format: CHALLENGE_RESPONSE_FORMAT,
      version: CHALLENGE_VERSION,
      challengeId: payload.challengeIdHex,
      targetPublicKey: base64UrlEncode(payload.targetPublicKey),
      targetFingerprintShort: fp.shortDisplay,
      issuedAt: payload.issuedAt,
      note: payload.note,
      token: responseToken,
    },
  };
}

export function parseKeyChallengeResponseInput(rawInput: string): {
  payloadBytes: Uint8Array;
  payload: KeyChallengePayload;
  signature: Uint8Array;
} {
  if (typeof rawInput !== 'string') {
    throw new Error('Challenge response input must be a string');
  }
  const trimmed = rawInput.trim();
  if (!trimmed || trimmed.length > MAX_CHALLENGE_INPUT_CHARS) {
    throw new Error('Challenge response input is empty or exceeds size limit');
  }

  let token = trimmed;
  if (trimmed.startsWith('{')) {
    let obj: unknown;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      throw new Error('Malformed JSON challenge response bundle');
    }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      throw new Error('Invalid JSON challenge response bundle');
    }
    const rec = obj as Record<string, unknown>;
    if (
      rec.format !== CHALLENGE_RESPONSE_FORMAT ||
      rec.version !== CHALLENGE_VERSION ||
      typeof rec.token !== 'string'
    ) {
      throw new Error('Unsupported challenge response JSON format');
    }
    token = rec.token.trim();
  }

  if (token.startsWith('chm-response:')) {
    token = token.slice('chm-response:'.length);
  }
  const rawBytes = base64UrlDecode(token);
  if (rawBytes.length === 0 || rawBytes.length > MAX_CHALLENGE_BYTES) {
    throw new Error('Challenge response bytes out of bounds');
  }
  const decoded = cborDecode(rawBytes, STRICT_CBOR_DECODE);
  if (!Array.isArray(decoded) || decoded.length !== 3) {
    throw new Error('Challenge response envelope must be a 3-element CBOR array');
  }
  const [version, payloadBytes, signature] = decoded;
  if (
    version !== CHALLENGE_VERSION ||
    !(payloadBytes instanceof Uint8Array) ||
    !(signature instanceof Uint8Array) ||
    signature.length !== 64
  ) {
    throw new Error('Malformed challenge response envelope');
  }
  const reEncoded = cborEncode([version, payloadBytes, signature], rfc8949EncodeOptions);
  if (!constantTimeEqual(reEncoded, rawBytes)) {
    throw new Error('Challenge response envelope is not canonically CBOR-encoded');
  }
  const payload = decodeChallengePayloadBytes(payloadBytes);
  return { payloadBytes, payload, signature };
}

export async function verifyKeyChallengeResponse(params: {
  challengeInput: string;
  responseInput: string;
  verifiedAt?: number;
}): Promise<VerifiedChallengeResult> {
  const verifiedAt = params.verifiedAt ?? Math.floor(Date.now() / 1000);
  const { payloadBytes: expectedBytes, payload: expectedPayload } = parseKeyChallengeInput(
    params.challengeInput,
  );
  const fp = await computePublicKeyFingerprint(expectedPayload.targetPublicKey);

  try {
    const { payloadBytes: actualBytes, signature } = parseKeyChallengeResponseInput(
      params.responseInput,
    );
    if (!constantTimeEqual(expectedBytes, actualBytes)) {
      return {
        valid: false,
        challengeIdHex: expectedPayload.challengeIdHex,
        targetPublicKeyBase64Url: base64UrlEncode(expectedPayload.targetPublicKey),
        targetFingerprintHex: fp.fullHex,
        targetFingerprintShort: fp.shortDisplay,
        challengeIssuedAt: expectedPayload.issuedAt,
        verifiedAt,
        note: expectedPayload.note,
        provesKeyPossessionOnly: true,
        provesRealWorldIdentity: false,
        error: 'Challenge response nonce, target key, or metadata does not match the expected challenge.',
      };
    }

    const signingMsg = buildChallengeSigningMessage(actualBytes);
    const sigOk = await verifyEd25519Signature(expectedPayload.targetPublicKey, signingMsg, signature);
    return {
      valid: sigOk,
      challengeIdHex: expectedPayload.challengeIdHex,
      targetPublicKeyBase64Url: base64UrlEncode(expectedPayload.targetPublicKey),
      targetFingerprintHex: fp.fullHex,
      targetFingerprintShort: fp.shortDisplay,
      challengeIssuedAt: expectedPayload.issuedAt,
      verifiedAt,
      note: expectedPayload.note,
      provesKeyPossessionOnly: true,
      provesRealWorldIdentity: false,
      error: sigOk ? undefined : 'Ed25519 signature verification failed for challenge response.',
    };
  } catch (err) {
    return {
      valid: false,
      challengeIdHex: expectedPayload.challengeIdHex,
      targetPublicKeyBase64Url: base64UrlEncode(expectedPayload.targetPublicKey),
      targetFingerprintHex: fp.fullHex,
      targetFingerprintShort: fp.shortDisplay,
      challengeIssuedAt: expectedPayload.issuedAt,
      verifiedAt,
      note: expectedPayload.note,
      provesKeyPossessionOnly: true,
      provesRealWorldIdentity: false,
      error: err instanceof Error ? err.message : 'Invalid challenge response',
    };
  }
}

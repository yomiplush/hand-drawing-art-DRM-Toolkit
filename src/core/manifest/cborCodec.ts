import { decode as cborDecode, encode as cborEncode, rfc8949EncodeOptions } from 'cborg';
import type { DecodeOptions } from 'cborg';
import { bytesToHex, constantTimeEqual } from '../crypto/sha256';
import {
  DOMAIN_SEPARATION_PREFIX,
  LICENSE_DEFINITIONS,
  MAX_ATTRIBUTION_UTF8_BYTES,
  MAX_AUTHOR_UTF8_BYTES,
  MAX_OUTPUT_DIMENSION,
  MAX_PROOF_BYTES,
  MAX_TITLE_UTF8_BYTES,
  PROTOCOL_VERSION,
  PROTOCOL_VERSION_MASKED,
  getLicenseByCode,
  getLicenseById,
} from './types';
import type {
  ArtworkRegion,
  LicenseDeclaration,
  PolicySignal,
  SignedManifest,
  UnsignedManifest,
} from './types';

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

const POLICY_TO_CODE: Record<PolicySignal, number> = {
  unspecified: 0,
  allow: 1,
  disallow: 2,
};

const CODE_TO_POLICY: Record<number, PolicySignal> = {
  0: 'unspecified',
  1: 'allow',
  2: 'disallow',
};

const textEncoder = new TextEncoder();

export function utf8ByteLength(str: string): number {
  return textEncoder.encode(str).length;
}

export function sanitizeAndValidateText(
  value: string | undefined,
  maxBytes: number,
  fieldName: string,
): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) {
      throw new Error(`${fieldName} contains disallowed control characters`);
    }
  }
  if (utf8ByteLength(trimmed) > maxBytes) {
    throw new Error(`${fieldName} exceeds maximum ${maxBytes} UTF-8 bytes`);
  }
  return trimmed;
}

export function generateArtworkId(): Uint8Array {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  // Set RFC 4122 UUID v4 version & variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytes;
}

export function formatUuidHex(bytes16: Uint8Array): string {
  if (bytes16.length !== 16) {
    throw new Error('Artwork ID must be 16 bytes');
  }
  const hex = bytesToHex(bytes16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function validateRegion(region: ArtworkRegion, label = 'Artwork region'): void {
  const [x, y, w, h] = region;
  if (
    !Number.isSafeInteger(x) ||
    !Number.isSafeInteger(y) ||
    !Number.isSafeInteger(w) ||
    !Number.isSafeInteger(h)
  ) {
    throw new Error(`${label} coordinates must be integers`);
  }
  if (x < 0 || y < 0 || w < 1 || h < 1) {
    throw new Error(`${label} coordinates must be non-negative with positive dimensions`);
  }
  if (x + w > MAX_OUTPUT_DIMENSION || y + h > MAX_OUTPUT_DIMENSION) {
    throw new Error(`${label} exceeds maximum allowed dimensions`);
  }
}

function validateQrMask(qrMask: ArtworkRegion, region: ArtworkRegion): void {
  validateRegion(qrMask, 'qrMask');
  const [mx, my, mw, mh] = qrMask;
  if (mw < 21 || mh < 21) {
    throw new Error('qrMask dimensions must be at least 21x21 px');
  }
  if (mx + mw > region[2] || my + mh > region[3]) {
    throw new Error('qrMask must fit inside artwork region bounds');
  }
}

function encodeLicenseTuple(license: LicenseDeclaration): unknown[] {
  const def = getLicenseById(license.licenseId);
  const attribution = sanitizeAndValidateText(
    license.attributionName,
    MAX_ATTRIBUTION_UTF8_BYTES,
    'attributionName',
  );
  const tuple: unknown[] = [
    def.code,
    POLICY_TO_CODE[license.commercialUse],
    POLICY_TO_CODE[license.redistribution],
    POLICY_TO_CODE[license.aiTraining],
  ];
  if (attribution !== undefined) {
    tuple.push(attribution);
  }
  return tuple;
}

export function encodeUnsignedPayload(manifest: UnsignedManifest): Uint8Array {
  if (manifest.version !== PROTOCOL_VERSION && manifest.version !== PROTOCOL_VERSION_MASKED) {
    throw new Error(`Unsupported protocol version: ${manifest.version}`);
  }
  if (manifest.version === PROTOCOL_VERSION && manifest.qrMask !== undefined) {
    throw new Error('qrMask requires protocol version 2');
  }
  if (manifest.artworkId.length !== 16) {
    throw new Error('artworkId must be 16 bytes');
  }
  if (manifest.publicKey.length !== 32) {
    throw new Error('publicKey must be 32 bytes');
  }
  if (manifest.sha256.length !== 32) {
    throw new Error('sha256 must be 32 bytes');
  }
  validateRegion(manifest.region);
  if (manifest.qrMask !== undefined) {
    validateQrMask(manifest.qrMask, manifest.region);
  }
  if (!Number.isSafeInteger(manifest.issuedAt) || manifest.issuedAt < 0) {
    throw new Error('issuedAt must be a non-negative integer Unix timestamp');
  }

  const authorName = sanitizeAndValidateText(
    manifest.authorName,
    MAX_AUTHOR_UTF8_BYTES,
    'authorName',
  );
  const artworkTitle = sanitizeAndValidateText(
    manifest.artworkTitle,
    MAX_TITLE_UTF8_BYTES,
    'artworkTitle',
  );

  const payloadMap = new Map<number, unknown>();
  payloadMap.set(1, new Uint8Array(manifest.artworkId));
  payloadMap.set(2, new Uint8Array(manifest.publicKey));
  payloadMap.set(3, new Uint8Array(manifest.sha256));
  payloadMap.set(4, [
    manifest.region[0],
    manifest.region[1],
    manifest.region[2],
    manifest.region[3],
  ]);
  payloadMap.set(5, manifest.issuedAt);
  payloadMap.set(6, encodeLicenseTuple(manifest.license));
  if (authorName !== undefined) {
    payloadMap.set(7, authorName);
  }
  if (artworkTitle !== undefined) {
    payloadMap.set(8, artworkTitle);
  }
  if (manifest.qrMask !== undefined) {
    payloadMap.set(9, [
      manifest.qrMask[0],
      manifest.qrMask[1],
      manifest.qrMask[2],
      manifest.qrMask[3],
    ]);
  }

  return cborEncode(payloadMap, rfc8949EncodeOptions);
}

export function buildSigningMessage(payloadBytes: Uint8Array): Uint8Array {
  const message = new Uint8Array(DOMAIN_SEPARATION_PREFIX.length + payloadBytes.length);
  message.set(DOMAIN_SEPARATION_PREFIX, 0);
  message.set(payloadBytes, DOMAIN_SEPARATION_PREFIX.length);
  return message;
}

export function encodeSignedProofEnvelope(
  payloadBytes: Uint8Array,
  signature64: Uint8Array,
  version: typeof PROTOCOL_VERSION | typeof PROTOCOL_VERSION_MASKED = PROTOCOL_VERSION,
): Uint8Array {
  if (signature64.length !== 64) {
    throw new Error('Ed25519 signature must be 64 bytes');
  }
  const envelope = [version, payloadBytes, signature64];
  const encoded = cborEncode(envelope, rfc8949EncodeOptions);
  if (encoded.length > MAX_PROOF_BYTES) {
    throw new Error(`Encoded proof (${encoded.length} bytes) exceeds maximum (${MAX_PROOF_BYTES} bytes)`);
  }
  return encoded;
}

export class UnsupportedProtocolVersionError extends Error {
  readonly version: number;
  constructor(version: number) {
    super(`Unsupported protocol version: ${version}`);
    this.name = 'UnsupportedProtocolVersionError';
    this.version = version;
  }
}

export interface DecodedProofEnvelope {
  version: number;
  payloadBytes: Uint8Array;
  signature: Uint8Array;
  manifest: SignedManifest;
}

function assertUint8Array(val: unknown, expectedLen: number, label: string): Uint8Array {
  if (!(val instanceof Uint8Array) || val.length !== expectedLen) {
    throw new Error(`${label} must be a ${expectedLen}-byte byte string`);
  }
  return val;
}

export function decodeSignedProofEnvelope(proofBytes: Uint8Array): DecodedProofEnvelope {
  if (!(proofBytes instanceof Uint8Array) || proofBytes.length === 0) {
    throw new Error('Proof bytes must be non-empty');
  }
  if (proofBytes.length > MAX_PROOF_BYTES) {
    throw new Error(`Proof payload exceeds maximum size (${MAX_PROOF_BYTES} bytes)`);
  }

  const decodedOuter = cborDecode(proofBytes, STRICT_DECODE_OPTIONS);
  if (!Array.isArray(decodedOuter) || decodedOuter.length !== 3) {
    throw new Error('Proof envelope must be a 3-element CBOR array');
  }

  const [version, payloadBytes, signature] = decodedOuter;
  if (typeof version !== 'number' || !Number.isSafeInteger(version)) {
    throw new Error('Proof version must be an integer');
  }
  if (version !== PROTOCOL_VERSION && version !== PROTOCOL_VERSION_MASKED) {
    throw new UnsupportedProtocolVersionError(version);
  }
  if (!(payloadBytes instanceof Uint8Array) || payloadBytes.length === 0) {
    throw new Error('Proof payload must be a non-empty byte string');
  }
  if (!(signature instanceof Uint8Array) || signature.length !== 64) {
    throw new Error('Proof signature must be a 64-byte byte string');
  }

  // Canonical outer envelope check (anti-malleability)
  const reEncodedOuter = cborEncode([version, payloadBytes, signature], rfc8949EncodeOptions);
  if (!constantTimeEqual(reEncodedOuter, proofBytes)) {
    throw new Error('Proof envelope is not canonically CBOR-encoded');
  }

  const decodedPayload = cborDecode(payloadBytes, STRICT_DECODE_OPTIONS);
  if (!(decodedPayload instanceof Map)) {
    throw new Error('Manifest payload must be a CBOR map');
  }

  const allowedKeys =
    version === PROTOCOL_VERSION_MASKED
      ? new Set([1, 2, 3, 4, 5, 6, 7, 8, 9])
      : new Set([1, 2, 3, 4, 5, 6, 7, 8]);
  for (const key of decodedPayload.keys()) {
    if (typeof key !== 'number' || !allowedKeys.has(key)) {
      throw new Error(`Unknown or invalid manifest key: ${String(key)}`);
    }
  }

  const artworkId = assertUint8Array(decodedPayload.get(1), 16, 'artworkId');
  const publicKey = assertUint8Array(decodedPayload.get(2), 32, 'publicKey');
  const sha256 = assertUint8Array(decodedPayload.get(3), 32, 'sha256');

  const rawRegion = decodedPayload.get(4);
  if (!Array.isArray(rawRegion) || rawRegion.length !== 4) {
    throw new Error('region must be a 4-element array');
  }
  const region: ArtworkRegion = [
    rawRegion[0] as number,
    rawRegion[1] as number,
    rawRegion[2] as number,
    rawRegion[3] as number,
  ];
  validateRegion(region);

  const issuedAt = decodedPayload.get(5);
  if (typeof issuedAt !== 'number' || !Number.isSafeInteger(issuedAt) || issuedAt < 0) {
    throw new Error('issuedAt must be a non-negative integer');
  }

  const rawLic = decodedPayload.get(6);
  if (!Array.isArray(rawLic) || (rawLic.length !== 4 && rawLic.length !== 5)) {
    throw new Error('license must be a 4 or 5-element array');
  }
  const [licCode, commCode, redistCode, aiCode, rawAttrib] = rawLic;
  const licDef = typeof licCode === 'number' ? getLicenseByCode(licCode) : undefined;
  if (!licDef || !LICENSE_DEFINITIONS.some((l) => l.code === licCode)) {
    throw new Error('Unknown license code');
  }
  const commercialUse = CODE_TO_POLICY[commCode as number];
  const redistribution = CODE_TO_POLICY[redistCode as number];
  const aiTraining = CODE_TO_POLICY[aiCode as number];
  if (!commercialUse || !redistribution || !aiTraining) {
    throw new Error('Invalid policy signal code');
  }

  let attributionName: string | undefined;
  if (rawLic.length === 5) {
    if (typeof rawAttrib !== 'string') {
      throw new Error('attributionName must be a string');
    }
    attributionName = sanitizeAndValidateText(
      rawAttrib,
      MAX_ATTRIBUTION_UTF8_BYTES,
      'attributionName',
    );
    if (attributionName === undefined) {
      throw new Error('attributionName cannot be empty when present');
    }
  }

  let authorName: string | undefined;
  if (decodedPayload.has(7)) {
    const rawAuthor = decodedPayload.get(7);
    if (typeof rawAuthor !== 'string') {
      throw new Error('authorName must be a string');
    }
    authorName = sanitizeAndValidateText(rawAuthor, MAX_AUTHOR_UTF8_BYTES, 'authorName');
    if (authorName === undefined) {
      throw new Error('authorName cannot be empty when present');
    }
  }

  let artworkTitle: string | undefined;
  if (decodedPayload.has(8)) {
    const rawTitle = decodedPayload.get(8);
    if (typeof rawTitle !== 'string') {
      throw new Error('artworkTitle must be a string');
    }
    artworkTitle = sanitizeAndValidateText(rawTitle, MAX_TITLE_UTF8_BYTES, 'artworkTitle');
    if (artworkTitle === undefined) {
      throw new Error('artworkTitle cannot be empty when present');
    }
  }

  let qrMask: ArtworkRegion | undefined;
  if (decodedPayload.has(9)) {
    const rawMask = decodedPayload.get(9);
    if (!Array.isArray(rawMask) || rawMask.length !== 4) {
      throw new Error('qrMask must be a 4-element array');
    }
    qrMask = [
      rawMask[0] as number,
      rawMask[1] as number,
      rawMask[2] as number,
      rawMask[3] as number,
    ];
    validateQrMask(qrMask, region);
  }

  const unsignedManifest: UnsignedManifest = {
    version: version === PROTOCOL_VERSION_MASKED ? PROTOCOL_VERSION_MASKED : PROTOCOL_VERSION,
    artworkId,
    publicKey,
    sha256,
    region,
    qrMask,
    issuedAt,
    license: {
      licenseId: licDef.id,
      attributionName,
      commercialUse,
      redistribution,
      aiTraining,
    },
    authorName,
    artworkTitle,
  };

  // Canonical inner payload check (anti-malleability)
  const reEncodedPayload = encodeUnsignedPayload(unsignedManifest);
  if (!constantTimeEqual(reEncodedPayload, payloadBytes)) {
    throw new Error('Manifest payload is not canonically CBOR-encoded');
  }

  return {
    version,
    payloadBytes,
    signature,
    manifest: {
      ...unsignedManifest,
      artworkIdHex: formatUuidHex(artworkId),
      signature,
    },
  };
}

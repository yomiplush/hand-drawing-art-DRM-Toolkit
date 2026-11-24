import { decode as cborDecode, encode as cborEncode, rfc8949EncodeOptions } from 'cborg';
import type { DecodeOptions } from 'cborg';
import { bytesToHex, constantTimeEqual } from '../crypto/sha256';
import {
  V3_CODE_TO_CREATION_METHOD,
  V3_CODE_TO_EVIDENCE_CATEGORY,
  V3_CODE_TO_SNS_PLATFORM,
  V3_CREATION_METHOD_TO_CODE,
  V3_EVIDENCE_CATEGORY_TO_CODE,
  V3_SNS_PLATFORM_TO_CODE,
  decodeCompactUrl,
  encodeCompactUrl,
  packV3PolicyFlags,
  sanitizeV3Multiline,
  sanitizeV3SingleLine,
  unpackV3PolicyFlags,
} from './compactDictionary';
import { deflateRawFixed, inflateRawBounded } from './deflateRaw';
import {
  DOMAIN_SEPARATION_PREFIX,
  DOMAIN_SEPARATION_PREFIX_V3,
  LICENSE_DEFINITIONS,
  MAX_ATTRIBUTION_UTF8_BYTES,
  MAX_AUTHOR_UTF8_BYTES,
  MAX_OUTPUT_DIMENSION,
  MAX_PROOF_BYTES,
  MAX_TITLE_UTF8_BYTES,
  MAX_V3_AUTHOR_UTF8_BYTES,
  MAX_V3_DECOMPRESSED_BYTES,
  MAX_V3_DESCRIPTION_UTF8_BYTES,
  MAX_V3_EVIDENCE_HASHES,
  MAX_V3_POLICY_NOTE_UTF8_BYTES,
  MAX_V3_PORTFOLIO_LINKS,
  MAX_V3_SNS_LINKS,
  MAX_V3_TITLE_UTF8_BYTES,
  PROTOCOL_VERSION,
  PROTOCOL_VERSION_COMPACT,
  PROTOCOL_VERSION_MASKED,
  getLicenseByCode,
  getLicenseById,
} from './types';
import type {
  ArtworkRegion,
  CompactSnsLink,
  CreationEnvironmentData,
  CreationMethod,
  CreatorProfileLink,
  EvidenceCategory,
  EvidenceHashRecord,
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

function encodeLicenseTuple(license: LicenseDeclaration, isV3: boolean): unknown[] {
  const def = getLicenseById(license.licenseId);
  const attribution = sanitizeAndValidateText(
    license.attributionName,
    MAX_ATTRIBUTION_UTF8_BYTES,
    'attributionName',
  );
  if (isV3) {
    const flags = packV3PolicyFlags(license);
    return attribution !== undefined ? [def.code, flags, attribution] : [def.code, flags];
  }
  if (
    license.allowsDerivatives !== undefined ||
    license.allowsModifications !== undefined ||
    license.requiresAttribution !== undefined
  ) {
    throw new Error('Extended license flags require protocol version 3');
  }
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

function hasV3OnlyFields(manifest: UnsignedManifest): boolean {
  return (
    manifest.description !== undefined ||
    manifest.website !== undefined ||
    (manifest.snsLinks !== undefined && manifest.snsLinks.length > 0) ||
    (manifest.portfolioLinks !== undefined && manifest.portfolioLinks.length > 0) ||
    manifest.creationMethod !== undefined ||
    manifest.creationEnvironment !== undefined ||
    (manifest.evidenceHashes !== undefined && manifest.evidenceHashes.length > 0) ||
    manifest.policyNote !== undefined ||
    manifest.license.allowsDerivatives !== undefined ||
    manifest.license.allowsModifications !== undefined ||
    manifest.license.requiresAttribution !== undefined
  );
}

export function encodeUnsignedPayload(manifest: UnsignedManifest): Uint8Array {
  if (
    manifest.version !== PROTOCOL_VERSION &&
    manifest.version !== PROTOCOL_VERSION_MASKED &&
    manifest.version !== PROTOCOL_VERSION_COMPACT
  ) {
    throw new Error(`Unsupported protocol version: ${manifest.version}`);
  }
  if (manifest.version === PROTOCOL_VERSION && manifest.qrMask !== undefined) {
    throw new Error('qrMask requires protocol version 2 or 3');
  }
  if (manifest.version !== PROTOCOL_VERSION_COMPACT && hasV3OnlyFields(manifest)) {
    throw new Error('Extended self-contained proof fields require protocol version 3');
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

  const isV3 = manifest.version === PROTOCOL_VERSION_COMPACT;
  const authorName = isV3
    ? sanitizeV3SingleLine(manifest.authorName, MAX_V3_AUTHOR_UTF8_BYTES, 'authorName')
    : sanitizeAndValidateText(manifest.authorName, MAX_AUTHOR_UTF8_BYTES, 'authorName');
  const artworkTitle = isV3
    ? sanitizeV3SingleLine(manifest.artworkTitle, MAX_V3_TITLE_UTF8_BYTES, 'artworkTitle')
    : sanitizeAndValidateText(manifest.artworkTitle, MAX_TITLE_UTF8_BYTES, 'artworkTitle');

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
  payloadMap.set(6, encodeLicenseTuple(manifest.license, isV3));
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

  if (isV3) {
    const description = sanitizeV3Multiline(
      manifest.description,
      MAX_V3_DESCRIPTION_UTF8_BYTES,
      'description',
    );
    if (description !== undefined) {
      payloadMap.set(10, description);
    }
    if (manifest.website !== undefined && manifest.website.trim().length > 0) {
      payloadMap.set(11, encodeCompactUrl(manifest.website, 'website'));
    }
    if (manifest.snsLinks && manifest.snsLinks.length > 0) {
      if (manifest.snsLinks.length > MAX_V3_SNS_LINKS) {
        throw new Error(`snsLinks cannot exceed ${MAX_V3_SNS_LINKS} entries`);
      }
      const encodedSns: unknown[][] = [];
      for (let i = 0; i < manifest.snsLinks.length; i++) {
        const link = manifest.snsLinks[i];
        if (!link.url || !link.url.trim()) continue;
        const [urlCode, urlSuffix] = encodeCompactUrl(link.url, `snsLinks[${i}].url`);
        const pCode = link.platform ? V3_SNS_PLATFORM_TO_CODE[link.platform] : 0;
        if (pCode === undefined) {
          throw new Error(`Unsupported SNS platform code: ${link.platform}`);
        }
        const label = sanitizeV3SingleLine(link.label, 48, `snsLinks[${i}].label`);
        if (label !== undefined) {
          encodedSns.push([urlCode, urlSuffix, pCode, label]);
        } else if (pCode !== 0) {
          encodedSns.push([urlCode, urlSuffix, pCode]);
        } else {
          encodedSns.push([urlCode, urlSuffix]);
        }
      }
      if (encodedSns.length > 0) {
        payloadMap.set(12, encodedSns);
      }
    }
    if (manifest.portfolioLinks && manifest.portfolioLinks.length > 0) {
      if (manifest.portfolioLinks.length > MAX_V3_PORTFOLIO_LINKS) {
        throw new Error(`portfolioLinks cannot exceed ${MAX_V3_PORTFOLIO_LINKS} entries`);
      }
      const encodedPortfolio: unknown[][] = [];
      for (let i = 0; i < manifest.portfolioLinks.length; i++) {
        const link = manifest.portfolioLinks[i];
        if (!link.url || !link.url.trim()) continue;
        const [urlCode, urlSuffix] = encodeCompactUrl(link.url, `portfolioLinks[${i}].url`);
        const label = sanitizeV3SingleLine(link.label, 48, `portfolioLinks[${i}].label`);
        encodedPortfolio.push(label !== undefined ? [urlCode, urlSuffix, label] : [urlCode, urlSuffix]);
      }
      if (encodedPortfolio.length > 0) {
        payloadMap.set(13, encodedPortfolio);
      }
    }
    if (manifest.creationMethod !== undefined) {
      const mCode = V3_CREATION_METHOD_TO_CODE[manifest.creationMethod];
      if (!mCode) {
        throw new Error(`Invalid creationMethod: ${String(manifest.creationMethod)}`);
      }
      payloadMap.set(14, mCode);
    }
    if (manifest.creationEnvironment) {
      const envMap = new Map<number, string>();
      const sw = sanitizeV3SingleLine(
        manifest.creationEnvironment.software,
        96,
        'creationEnvironment.software',
      );
      const hw = sanitizeV3SingleLine(
        manifest.creationEnvironment.hardware,
        96,
        'creationEnvironment.hardware',
      );
      const inp = sanitizeV3SingleLine(
        manifest.creationEnvironment.inputDevice,
        96,
        'creationEnvironment.inputDevice',
      );
      const notes = sanitizeV3Multiline(
        manifest.creationEnvironment.notes,
        240,
        'creationEnvironment.notes',
      );
      if (sw !== undefined) envMap.set(1, sw);
      if (hw !== undefined) envMap.set(2, hw);
      if (inp !== undefined) envMap.set(3, inp);
      if (notes !== undefined) envMap.set(4, notes);
      if (envMap.size > 0) {
        payloadMap.set(15, envMap);
      }
    }
    if (manifest.evidenceHashes && manifest.evidenceHashes.length > 0) {
      if (manifest.evidenceHashes.length > MAX_V3_EVIDENCE_HASHES) {
        throw new Error(`evidenceHashes cannot exceed ${MAX_V3_EVIDENCE_HASHES} entries`);
      }
      const encodedHashes = manifest.evidenceHashes.map((rec, idx) => {
        if (!(rec.sha256 instanceof Uint8Array) || rec.sha256.length !== 32) {
          throw new Error(`evidenceHashes[${idx}].sha256 must be 32 bytes`);
        }
        if (!Number.isSafeInteger(rec.byteLength) || rec.byteLength < 0) {
          throw new Error(`evidenceHashes[${idx}].byteLength must be a non-negative integer`);
        }
        const catCode = rec.category ? V3_EVIDENCE_CATEGORY_TO_CODE[rec.category] : 0;
        if (rec.category !== undefined && !catCode) {
          throw new Error(`evidenceHashes[${idx}].category is invalid`);
        }
        const label = sanitizeV3SingleLine(rec.label, 96, `evidenceHashes[${idx}].label`);
        const mime = sanitizeV3SingleLine(rec.mimeType, 64, `evidenceHashes[${idx}].mimeType`);
        if (mime !== undefined) {
          return [new Uint8Array(rec.sha256), rec.byteLength, catCode, label ?? '', mime];
        }
        if (label !== undefined) {
          return [new Uint8Array(rec.sha256), rec.byteLength, catCode, label];
        }
        if (catCode !== 0) {
          return [new Uint8Array(rec.sha256), rec.byteLength, catCode];
        }
        return [new Uint8Array(rec.sha256), rec.byteLength];
      });
      payloadMap.set(16, encodedHashes);
    }
    const policyNote = sanitizeV3Multiline(
      manifest.policyNote,
      MAX_V3_POLICY_NOTE_UTF8_BYTES,
      'policyNote',
    );
    if (policyNote !== undefined) {
      payloadMap.set(17, policyNote);
    }
  }

  return cborEncode(payloadMap, rfc8949EncodeOptions);
}

export function buildSigningMessage(
  payloadBytes: Uint8Array,
  version: number = PROTOCOL_VERSION,
): Uint8Array {
  const prefix =
    version === PROTOCOL_VERSION_COMPACT
      ? DOMAIN_SEPARATION_PREFIX_V3
      : DOMAIN_SEPARATION_PREFIX;
  const message = new Uint8Array(prefix.length + payloadBytes.length);
  message.set(prefix, 0);
  message.set(payloadBytes, prefix.length);
  return message;
}

export function encodeSignedProofEnvelope(
  payloadBytes: Uint8Array,
  signature64: Uint8Array,
  version:
    | typeof PROTOCOL_VERSION
    | typeof PROTOCOL_VERSION_MASKED
    | typeof PROTOCOL_VERSION_COMPACT = PROTOCOL_VERSION,
  options?: { allowDeflate?: boolean },
): Uint8Array {
  if (signature64.length !== 64) {
    throw new Error('Ed25519 signature must be 64 bytes');
  }
  let envelope: unknown[];
  if (version === PROTOCOL_VERSION_COMPACT) {
    const deflated =
      options?.allowDeflate === false ? null : deflateRawFixed(payloadBytes);
    const useDeflate = deflated !== null && deflated.length < payloadBytes.length;
    envelope = [
      PROTOCOL_VERSION_COMPACT,
      useDeflate ? 1 : 0,
      useDeflate ? deflated : payloadBytes,
      signature64,
    ];
  } else {
    envelope = [version, payloadBytes, signature64];
  }
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
  usedDeflate?: boolean;
}

function assertUint8Array(val: unknown, expectedLen: number, label: string): Uint8Array {
  if (!(val instanceof Uint8Array) || val.length !== expectedLen) {
    throw new Error(`${label} must be a ${expectedLen}-byte byte string`);
  }
  return val;
}

function assertCanonicalDecodedString(
  raw: unknown,
  sanitizer: (v: string, maxBytes: number, fieldName: string) => string | undefined,
  maxBytes: number,
  fieldName: string,
): string {
  if (typeof raw !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }
  const clean = sanitizer(raw, maxBytes, fieldName);
  if (clean === undefined || clean !== raw) {
    throw new Error(`${fieldName} is empty or non-canonical`);
  }
  return clean;
}

export function decodeSignedProofEnvelope(proofBytes: Uint8Array): DecodedProofEnvelope {
  if (!(proofBytes instanceof Uint8Array) || proofBytes.length === 0) {
    throw new Error('Proof bytes must be non-empty');
  }
  if (proofBytes.length > MAX_PROOF_BYTES) {
    throw new Error(`Proof payload exceeds maximum size (${MAX_PROOF_BYTES} bytes)`);
  }

  const decodedOuter = cborDecode(proofBytes, STRICT_DECODE_OPTIONS);
  if (!Array.isArray(decodedOuter) || decodedOuter.length < 3) {
    throw new Error('Proof envelope must be a CBOR array');
  }

  const version = decodedOuter[0];
  if (typeof version !== 'number' || !Number.isSafeInteger(version)) {
    throw new Error('Proof version must be an integer');
  }
  if (
    version !== PROTOCOL_VERSION &&
    version !== PROTOCOL_VERSION_MASKED &&
    version !== PROTOCOL_VERSION_COMPACT
  ) {
    throw new UnsupportedProtocolVersionError(version);
  }

  let payloadBytes: Uint8Array;
  let signature: Uint8Array;
  let usedDeflate = false;

  if (version === PROTOCOL_VERSION_COMPACT) {
    if (decodedOuter.length !== 4) {
      throw new Error('Protocol v3 proof envelope must be a 4-element CBOR array');
    }
    const compressionFlag = decodedOuter[1];
    const transportBytes = decodedOuter[2];
    const sig = decodedOuter[3];
    if (compressionFlag !== 0 && compressionFlag !== 1) {
      throw new Error('Protocol v3 compression flag must be 0 or 1');
    }
    if (!(transportBytes instanceof Uint8Array) || transportBytes.length === 0) {
      throw new Error('Protocol v3 payload must be a non-empty byte string');
    }
    if (!(sig instanceof Uint8Array) || sig.length !== 64) {
      throw new Error('Proof signature must be a 64-byte byte string');
    }
    const reEncodedOuter = cborEncode(
      [version, compressionFlag, transportBytes, sig],
      rfc8949EncodeOptions,
    );
    if (!constantTimeEqual(reEncodedOuter, proofBytes)) {
      throw new Error('Proof envelope is not canonically CBOR-encoded');
    }
    if (compressionFlag === 1) {
      usedDeflate = true;
      payloadBytes = inflateRawBounded(transportBytes, MAX_V3_DECOMPRESSED_BYTES);
      if (transportBytes.length >= payloadBytes.length) {
        throw new Error('Compressed v3 payload is not strictly smaller than uncompressed payload');
      }
    } else {
      if (transportBytes.length > MAX_V3_DECOMPRESSED_BYTES) {
        throw new Error('Protocol v3 payload exceeds maximum decompressed size');
      }
      payloadBytes = transportBytes;
    }
    signature = sig;
  } else {
    if (decodedOuter.length !== 3) {
      throw new Error('Proof envelope must be a 3-element CBOR array');
    }
    const [, rawPayload, sig] = decodedOuter;
    if (!(rawPayload instanceof Uint8Array) || rawPayload.length === 0) {
      throw new Error('Proof payload must be a non-empty byte string');
    }
    if (!(sig instanceof Uint8Array) || sig.length !== 64) {
      throw new Error('Proof signature must be a 64-byte byte string');
    }
    const reEncodedOuter = cborEncode([version, rawPayload, sig], rfc8949EncodeOptions);
    if (!constantTimeEqual(reEncodedOuter, proofBytes)) {
      throw new Error('Proof envelope is not canonically CBOR-encoded');
    }
    payloadBytes = rawPayload;
    signature = sig;
  }

  const decodedPayload = cborDecode(payloadBytes, STRICT_DECODE_OPTIONS);
  if (!(decodedPayload instanceof Map)) {
    throw new Error('Manifest payload must be a CBOR map');
  }

  const allowedKeys =
    version === PROTOCOL_VERSION_COMPACT
      ? new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17])
      : version === PROTOCOL_VERSION_MASKED
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

  const isV3 = version === PROTOCOL_VERSION_COMPACT;
  const rawLic = decodedPayload.get(6);
  let license: LicenseDeclaration;
  if (isV3) {
    if (!Array.isArray(rawLic) || (rawLic.length !== 2 && rawLic.length !== 3)) {
      throw new Error('v3 license must be a 2 or 3-element array');
    }
    const [licCode, packedFlags, rawAttrib] = rawLic;
    const licDef = typeof licCode === 'number' ? getLicenseByCode(licCode) : undefined;
    if (!licDef || !LICENSE_DEFINITIONS.some((l) => l.code === licCode)) {
      throw new Error('Unknown license code');
    }
    if (typeof packedFlags !== 'number') {
      throw new Error('v3 policyFlags must be an integer');
    }
    const unpacked = unpackV3PolicyFlags(packedFlags);
    let attributionName: string | undefined;
    if (rawLic.length === 3) {
      if (typeof rawAttrib !== 'string') {
        throw new Error('attributionName must be a string');
      }
      attributionName = sanitizeAndValidateText(
        rawAttrib,
        MAX_ATTRIBUTION_UTF8_BYTES,
        'attributionName',
      );
      if (attributionName === undefined || attributionName !== rawAttrib) {
        throw new Error('attributionName is empty or non-canonical');
      }
    }
    license = {
      licenseId: licDef.id,
      attributionName,
      ...unpacked,
    };
  } else {
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
      if (attributionName === undefined || attributionName !== rawAttrib) {
        throw new Error('attributionName cannot be empty when present');
      }
    }
    license = {
      licenseId: licDef.id,
      attributionName,
      commercialUse,
      redistribution,
      aiTraining,
    };
  }

  let authorName: string | undefined;
  if (decodedPayload.has(7)) {
    const rawAuthor = decodedPayload.get(7);
    if (typeof rawAuthor !== 'string') {
      throw new Error('authorName must be a string');
    }
    authorName = isV3
      ? assertCanonicalDecodedString(rawAuthor, sanitizeV3SingleLine, MAX_V3_AUTHOR_UTF8_BYTES, 'authorName')
      : sanitizeAndValidateText(rawAuthor, MAX_AUTHOR_UTF8_BYTES, 'authorName');
    if (authorName === undefined || authorName !== rawAuthor) {
      throw new Error('authorName cannot be empty when present');
    }
  }

  let artworkTitle: string | undefined;
  if (decodedPayload.has(8)) {
    const rawTitle = decodedPayload.get(8);
    if (typeof rawTitle !== 'string') {
      throw new Error('artworkTitle must be a string');
    }
    artworkTitle = isV3
      ? assertCanonicalDecodedString(rawTitle, sanitizeV3SingleLine, MAX_V3_TITLE_UTF8_BYTES, 'artworkTitle')
      : sanitizeAndValidateText(rawTitle, MAX_TITLE_UTF8_BYTES, 'artworkTitle');
    if (artworkTitle === undefined || artworkTitle !== rawTitle) {
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

  let description: string | undefined;
  let website: string | undefined;
  let snsLinks: CompactSnsLink[] | undefined;
  let portfolioLinks: CreatorProfileLink[] | undefined;
  let creationMethod: CreationMethod | undefined;
  let creationEnvironment: CreationEnvironmentData | undefined;
  let evidenceHashes: EvidenceHashRecord[] | undefined;
  let policyNote: string | undefined;

  if (isV3) {
    if (decodedPayload.has(10)) {
      description = assertCanonicalDecodedString(
        decodedPayload.get(10),
        sanitizeV3Multiline,
        MAX_V3_DESCRIPTION_UTF8_BYTES,
        'description',
      );
    }
    if (decodedPayload.has(11)) {
      website = decodeCompactUrl(decodedPayload.get(11), 'website');
    }
    if (decodedPayload.has(12)) {
      const rawSns = decodedPayload.get(12);
      if (!Array.isArray(rawSns) || rawSns.length === 0 || rawSns.length > MAX_V3_SNS_LINKS) {
        throw new Error('snsLinks must be a non-empty bounded array');
      }
      snsLinks = rawSns.map((entry, idx) => {
        if (!Array.isArray(entry) || entry.length < 2 || entry.length > 4) {
          throw new Error(`snsLinks[${idx}] must be a 2..4 element array`);
        }
        const url = decodeCompactUrl([entry[0], entry[1]], `snsLinks[${idx}].url`);
        const parsed: CompactSnsLink = { url };
        if (entry.length >= 3) {
          const pCode = entry[2];
          if (typeof pCode !== 'number' || !(pCode in V3_CODE_TO_SNS_PLATFORM)) {
            throw new Error(`snsLinks[${idx}] has invalid platform code`);
          }
          if (entry.length === 3 && pCode === 0) {
            throw new Error(`snsLinks[${idx}] non-canonical zero platform code`);
          }
          if (pCode !== 0) {
            parsed.platform = V3_CODE_TO_SNS_PLATFORM[pCode];
          }
        }
        if (entry.length === 4) {
          parsed.label = assertCanonicalDecodedString(
            entry[3],
            sanitizeV3SingleLine,
            48,
            `snsLinks[${idx}].label`,
          );
        }
        return parsed;
      });
    }
    if (decodedPayload.has(13)) {
      const rawPort = decodedPayload.get(13);
      if (!Array.isArray(rawPort) || rawPort.length === 0 || rawPort.length > MAX_V3_PORTFOLIO_LINKS) {
        throw new Error('portfolioLinks must be a non-empty bounded array');
      }
      portfolioLinks = rawPort.map((entry, idx) => {
        if (!Array.isArray(entry) || entry.length < 2 || entry.length > 3) {
          throw new Error(`portfolioLinks[${idx}] must be a 2 or 3 element array`);
        }
        const url = decodeCompactUrl([entry[0], entry[1]], `portfolioLinks[${idx}].url`);
        if (entry.length === 3) {
          const label = assertCanonicalDecodedString(
            entry[2],
            sanitizeV3SingleLine,
            48,
            `portfolioLinks[${idx}].label`,
          );
          return { url, label };
        }
        return { url };
      });
    }
    if (decodedPayload.has(14)) {
      const mCode = decodedPayload.get(14);
      const resolved =
        typeof mCode === 'number' && Number.isSafeInteger(mCode)
          ? V3_CODE_TO_CREATION_METHOD[mCode]
          : undefined;
      if (!resolved) {
        throw new Error('creationMethod contains an invalid code');
      }
      creationMethod = resolved;
    }
    if (decodedPayload.has(15)) {
      const rawEnv = decodedPayload.get(15);
      if (!(rawEnv instanceof Map) || rawEnv.size === 0) {
        throw new Error('creationEnvironment must be a non-empty CBOR map');
      }
      for (const k of rawEnv.keys()) {
        if (typeof k !== 'number' || k < 1 || k > 4) {
          throw new Error(`Invalid creationEnvironment key: ${String(k)}`);
        }
      }
      const env: CreationEnvironmentData = {};
      if (rawEnv.has(1)) {
        env.software = assertCanonicalDecodedString(rawEnv.get(1), sanitizeV3SingleLine, 96, 'creationEnvironment.software');
      }
      if (rawEnv.has(2)) {
        env.hardware = assertCanonicalDecodedString(rawEnv.get(2), sanitizeV3SingleLine, 96, 'creationEnvironment.hardware');
      }
      if (rawEnv.has(3)) {
        env.inputDevice = assertCanonicalDecodedString(rawEnv.get(3), sanitizeV3SingleLine, 96, 'creationEnvironment.inputDevice');
      }
      if (rawEnv.has(4)) {
        env.notes = assertCanonicalDecodedString(rawEnv.get(4), sanitizeV3Multiline, 240, 'creationEnvironment.notes');
      }
      creationEnvironment = env;
    }
    if (decodedPayload.has(16)) {
      const rawHashes = decodedPayload.get(16);
      if (!Array.isArray(rawHashes) || rawHashes.length === 0 || rawHashes.length > MAX_V3_EVIDENCE_HASHES) {
        throw new Error('evidenceHashes must be a non-empty bounded array');
      }
      evidenceHashes = rawHashes.map((entry, idx) => {
        if (!Array.isArray(entry) || entry.length < 2 || entry.length > 5) {
          throw new Error(`evidenceHashes[${idx}] must be a 2..5 element array`);
        }
        const sha = assertUint8Array(entry[0], 32, `evidenceHashes[${idx}].sha256`);
        const byteLength = entry[1];
        if (typeof byteLength !== 'number' || !Number.isSafeInteger(byteLength) || byteLength < 0) {
          throw new Error(`evidenceHashes[${idx}].byteLength must be a non-negative integer`);
        }
        let category: EvidenceCategory | undefined;
        if (entry.length >= 3) {
          const catCode = entry[2];
          if (typeof catCode !== 'number' || !Number.isSafeInteger(catCode)) {
            throw new Error(`evidenceHashes[${idx}].category code invalid`);
          }
          if (entry.length === 3 && catCode === 0) {
            throw new Error(`evidenceHashes[${idx}] non-canonical zero category code`);
          }
          if (catCode !== 0) {
            const cat = V3_CODE_TO_EVIDENCE_CATEGORY[catCode];
            if (!cat) throw new Error(`evidenceHashes[${idx}].category unknown`);
            category = cat;
          }
        }
        let label: string | undefined;
        if (entry.length >= 4) {
          if (typeof entry[3] !== 'string') {
            throw new Error(`evidenceHashes[${idx}].label must be a string`);
          }
          if (entry.length === 4 && entry[3] === '') {
            throw new Error(`evidenceHashes[${idx}] non-canonical empty label`);
          }
          if (entry[3] !== '') {
            label = assertCanonicalDecodedString(
              entry[3],
              sanitizeV3SingleLine,
              96,
              `evidenceHashes[${idx}].label`,
            );
          }
        }
        let mimeType: string | undefined;
        if (entry.length === 5) {
          mimeType = assertCanonicalDecodedString(
            entry[4],
            sanitizeV3SingleLine,
            64,
            `evidenceHashes[${idx}].mimeType`,
          );
        }
        return {
          sha256: sha,
          byteLength,
          ...(category !== undefined ? { category } : {}),
          ...(label !== undefined ? { label } : {}),
          ...(mimeType !== undefined ? { mimeType } : {}),
        };
      });
    }
    if (decodedPayload.has(17)) {
      policyNote = assertCanonicalDecodedString(
        decodedPayload.get(17),
        sanitizeV3Multiline,
        MAX_V3_POLICY_NOTE_UTF8_BYTES,
        'policyNote',
      );
    }
  }

  const unsignedManifest: UnsignedManifest = {
    version,
    artworkId,
    publicKey,
    sha256,
    region,
    qrMask,
    issuedAt,
    license,
    authorName,
    artworkTitle,
    ...(description !== undefined ? { description } : {}),
    ...(website !== undefined ? { website } : {}),
    ...(snsLinks !== undefined ? { snsLinks } : {}),
    ...(portfolioLinks !== undefined ? { portfolioLinks } : {}),
    ...(creationMethod !== undefined ? { creationMethod } : {}),
    ...(creationEnvironment !== undefined ? { creationEnvironment } : {}),
    ...(evidenceHashes !== undefined ? { evidenceHashes } : {}),
    ...(policyNote !== undefined ? { policyNote } : {}),
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
    usedDeflate,
    manifest: {
      ...unsignedManifest,
      artworkIdHex: formatUuidHex(artworkId),
      signature,
    },
  };
}

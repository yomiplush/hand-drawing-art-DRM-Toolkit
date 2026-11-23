import { decode as cborDecode, encode as cborEncode, rfc8949EncodeOptions } from 'cborg';
import type { DecodeOptions } from 'cborg';
import { bytesToHex, base64UrlDecode, base64UrlEncode, constantTimeEqual, sha256 } from '../crypto/sha256';
import { signWithAuthorKey } from '../storage/keyStore';
import type { AuthorKeyRecord } from '../storage/keyStore';
import { formatUuidHex, generateArtworkId, utf8ByteLength } from './cborCodec';
import type {
  CreationEnvironmentData,
  CreationMethod,
  CreatorProfileData,
  CreatorProfileLink,
  EvidenceCategory,
  EvidenceHashRecord,
  ExtendedArtworkMetadata,
  SignedEvidenceExtension,
  SignedManifest,
  UnsignedEvidenceExtension,
} from './types';

export const EVIDENCE_EXTENSION_FORMAT = 'certified-handmade-evidence' as const;
export const EVIDENCE_EXTENSION_VERSION = 1 as const;
export const EVIDENCE_TOKEN_PREFIX = 'chm-evidence:';
export const EVIDENCE_DOMAIN_SEPARATION_PREFIX = new Uint8Array([
  0x43, 0x48, 0x4d, 0x2d, 0x45, 0x56, 0x49, 0x44, 0x45, 0x4e, 0x43, 0x45, 0x31, 0x00,
]); // "CHM-EVIDENCE1\0"

export const MAX_EVIDENCE_CBOR_BYTES = 32_768;
export const MAX_EVIDENCE_INPUT_CHARS = 131_072;
export const MAX_EVIDENCE_TOKEN_CHARS = Math.ceil((MAX_EVIDENCE_CBOR_BYTES * 4) / 3) + 32;

export const MAX_EXT_TITLE_UTF8_BYTES = 256;
export const MAX_EXT_ARTIST_UTF8_BYTES = 128;
export const MAX_EXT_DESCRIPTION_UTF8_BYTES = 4000;
export const MAX_CREATOR_DISPLAY_NAME_UTF8_BYTES = 128;
export const MAX_PROFILE_URL_UTF8_BYTES = 512;
export const MAX_PROFILE_LINK_LABEL_UTF8_BYTES = 64;
export const MAX_PROFILE_LINKS = 12;
export const MAX_ENV_FIELD_UTF8_BYTES = 128;
export const MAX_ENV_NOTES_UTF8_BYTES = 1000;
export const MAX_EVIDENCE_RECORDS = 24;
export const MAX_EVIDENCE_LABEL_UTF8_BYTES = 128;
export const MAX_EVIDENCE_MIME_UTF8_BYTES = 96;

export const CREATION_METHOD_TO_CODE: Record<CreationMethod, number> = {
  'hand-drawn-no-ai': 1,
  'hand-drawn-ai-assisted': 2,
  'ai-generated': 3,
  other: 4,
  'prefer-not-to-disclose': 5,
};

export const CODE_TO_CREATION_METHOD: Record<number, CreationMethod> = {
  1: 'hand-drawn-no-ai',
  2: 'hand-drawn-ai-assisted',
  3: 'ai-generated',
  4: 'other',
  5: 'prefer-not-to-disclose',
};

export const EVIDENCE_CATEGORY_TO_CODE: Record<EvidenceCategory, number> = {
  sketch: 1,
  wip: 2,
  intermediate: 3,
  timelapse: 4,
  'project-file': 5,
  other: 6,
};

export const CODE_TO_EVIDENCE_CATEGORY: Record<number, EvidenceCategory> = {
  1: 'sketch',
  2: 'wip',
  3: 'intermediate',
  4: 'timelapse',
  5: 'project-file',
  6: 'other',
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

export interface PortableEvidenceBundle {
  format: typeof EVIDENCE_EXTENSION_FORMAT;
  version: typeof EVIDENCE_EXTENSION_VERSION;
  artworkId: string;
  proofSha256: string;
  publicKeyFingerprint: string;
  createdAt: string;
  evidenceBase64Url: string;
}

export interface EvidenceExtensionDetailsInput {
  artworkMetadata?: ExtendedArtworkMetadata;
  creatorProfile?: CreatorProfileData;
  creationMethod?: CreationMethod;
  creationEnvironment?: CreationEnvironmentData;
  evidenceRecords?: EvidenceHashRecord[];
}

export class UnsupportedEvidenceVersionError extends Error {
  readonly version: number;
  constructor(version: number) {
    super(`Unsupported evidence extension version: ${version}`);
    this.name = 'UnsupportedEvidenceVersionError';
    this.version = version;
  }
}

function isDisallowedCodeUnit(code: number, allowMultiline: boolean): boolean {
  if (code >= 0x202a && code <= 0x202e) return true;
  if (code >= 0x2066 && code <= 0x2069) return true;
  if (code === 0x7f || (code >= 0x80 && code <= 0x9f)) return true;
  if (code < 0x20) {
    if (allowMultiline && (code === 0x09 || code === 0x0a)) {
      return false;
    }
    return true;
  }
  return false;
}

export function sanitizeSingleLineText(
  value: string | undefined,
  maxBytes: number,
  fieldName: string,
): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  for (let i = 0; i < trimmed.length; i++) {
    if (isDisallowedCodeUnit(trimmed.charCodeAt(i), false)) {
      throw new Error(`${fieldName} contains disallowed control characters`);
    }
  }
  if (utf8ByteLength(trimmed) > maxBytes) {
    throw new Error(`${fieldName} exceeds maximum ${maxBytes} UTF-8 bytes`);
  }
  return trimmed;
}

export function sanitizeMultilineText(
  value: string | undefined,
  maxBytes: number,
  fieldName: string,
): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.replace(/\r\n?/g, '\n').trim();
  if (normalized.length === 0) return undefined;
  for (let i = 0; i < normalized.length; i++) {
    if (isDisallowedCodeUnit(normalized.charCodeAt(i), true)) {
      throw new Error(`${fieldName} contains disallowed control characters`);
    }
  }
  if (utf8ByteLength(normalized) > maxBytes) {
    throw new Error(`${fieldName} exceeds maximum ${maxBytes} UTF-8 bytes`);
  }
  return normalized;
}

export function sanitizeProfileUrl(
  rawUrl: string | undefined,
  fieldName = 'profileUrl',
): string | undefined {
  if (rawUrl === undefined) return undefined;
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) return undefined;
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    if (isDisallowedCodeUnit(code, false) || /\s/.test(trimmed[i])) {
      throw new Error(`${fieldName} contains disallowed whitespace or control characters`);
    }
  }
  if (utf8ByteLength(trimmed) > MAX_PROFILE_URL_UTF8_BYTES) {
    throw new Error(`${fieldName} exceeds maximum ${MAX_PROFILE_URL_UTF8_BYTES} UTF-8 bytes`);
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`${fieldName} must be a valid https:// or http:// URL`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`${fieldName} must use https:// or http://`);
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new Error(`${fieldName} must not contain credentials`);
  }
  if (!parsed.hostname) {
    throw new Error(`${fieldName} must include a valid hostname`);
  }
  return trimmed;
}

export function truncateUtf8(str: string, maxBytes: number): string {
  if (utf8ByteLength(str) <= maxBytes) return str;
  const encoder = new TextEncoder();
  let acc = '';
  for (const ch of str) {
    const candidate = acc + ch;
    if (encoder.encode(candidate).length > maxBytes) break;
    acc = candidate;
  }
  return acc;
}

export function sanitizeEvidenceBasename(rawName: string): string {
  const segment = rawName.split(/[/\\]/).pop() ?? rawName;
  let cleaned = '';
  for (const ch of segment) {
    const code = ch.charCodeAt(0);
    if (isDisallowedCodeUnit(code, false)) continue;
    cleaned += ch;
  }
  cleaned = cleaned.trim();
  if (!cleaned) return 'evidence-file';
  if (utf8ByteLength(cleaned) <= MAX_EVIDENCE_LABEL_UTF8_BYTES) return cleaned;

  const dotIdx = cleaned.lastIndexOf('.');
  if (dotIdx > 0 && dotIdx < cleaned.length - 1) {
    const ext = cleaned.slice(dotIdx);
    const extBytes = utf8ByteLength(ext);
    if (extBytes < MAX_EVIDENCE_LABEL_UTF8_BYTES - 4) {
      const stem = truncateUtf8(cleaned.slice(0, dotIdx), MAX_EVIDENCE_LABEL_UTF8_BYTES - extBytes);
      return `${stem}${ext}`;
    }
  }
  return truncateUtf8(cleaned, MAX_EVIDENCE_LABEL_UTF8_BYTES);
}

function normalizeArtworkMetadata(
  meta: ExtendedArtworkMetadata | undefined,
): ExtendedArtworkMetadata | undefined {
  if (!meta) return undefined;
  const title = sanitizeSingleLineText(meta.title, MAX_EXT_TITLE_UTF8_BYTES, 'artworkMetadata.title');
  const artistName = sanitizeSingleLineText(
    meta.artistName,
    MAX_EXT_ARTIST_UTF8_BYTES,
    'artworkMetadata.artistName',
  );
  const description = sanitizeMultilineText(
    meta.description,
    MAX_EXT_DESCRIPTION_UTF8_BYTES,
    'artworkMetadata.description',
  );
  if (title === undefined && artistName === undefined && description === undefined) {
    return undefined;
  }
  return {
    ...(title !== undefined ? { title } : {}),
    ...(artistName !== undefined ? { artistName } : {}),
    ...(description !== undefined ? { description } : {}),
  };
}

function normalizeCreatorProfile(
  profile: CreatorProfileData | undefined,
): CreatorProfileData | undefined {
  if (!profile) return undefined;
  const displayName = sanitizeSingleLineText(
    profile.displayName,
    MAX_CREATOR_DISPLAY_NAME_UTF8_BYTES,
    'creatorProfile.displayName',
  );
  const website = sanitizeProfileUrl(profile.website, 'creatorProfile.website');
  const rawLinks = profile.links ?? [];
  const links: CreatorProfileLink[] = [];
  for (let i = 0; i < rawLinks.length; i++) {
    const item = rawLinks[i];
    const url = sanitizeProfileUrl(item.url, `creatorProfile.links[${i}].url`);
    if (!url) continue;
    const label = sanitizeSingleLineText(
      item.label,
      MAX_PROFILE_LINK_LABEL_UTF8_BYTES,
      `creatorProfile.links[${i}].label`,
    );
    links.push(label !== undefined ? { url, label } : { url });
  }
  if (links.length > MAX_PROFILE_LINKS) {
    throw new Error(`creatorProfile.links cannot exceed ${MAX_PROFILE_LINKS} entries`);
  }
  if (displayName === undefined && website === undefined && links.length === 0) {
    return undefined;
  }
  return {
    ...(displayName !== undefined ? { displayName } : {}),
    ...(website !== undefined ? { website } : {}),
    ...(links.length > 0 ? { links } : {}),
  };
}

function normalizeCreationEnvironment(
  env: CreationEnvironmentData | undefined,
): CreationEnvironmentData | undefined {
  if (!env) return undefined;
  const software = sanitizeSingleLineText(
    env.software,
    MAX_ENV_FIELD_UTF8_BYTES,
    'creationEnvironment.software',
  );
  const hardware = sanitizeSingleLineText(
    env.hardware,
    MAX_ENV_FIELD_UTF8_BYTES,
    'creationEnvironment.hardware',
  );
  const inputDevice = sanitizeSingleLineText(
    env.inputDevice,
    MAX_ENV_FIELD_UTF8_BYTES,
    'creationEnvironment.inputDevice',
  );
  const notes = sanitizeMultilineText(
    env.notes,
    MAX_ENV_NOTES_UTF8_BYTES,
    'creationEnvironment.notes',
  );
  if (
    software === undefined &&
    hardware === undefined &&
    inputDevice === undefined &&
    notes === undefined
  ) {
    return undefined;
  }
  return {
    ...(software !== undefined ? { software } : {}),
    ...(hardware !== undefined ? { hardware } : {}),
    ...(inputDevice !== undefined ? { inputDevice } : {}),
    ...(notes !== undefined ? { notes } : {}),
  };
}

function normalizeEvidenceRecords(
  records: EvidenceHashRecord[] | undefined,
): EvidenceHashRecord[] | undefined {
  if (!records || records.length === 0) return undefined;
  if (records.length > MAX_EVIDENCE_RECORDS) {
    throw new Error(`evidenceRecords cannot exceed ${MAX_EVIDENCE_RECORDS} entries`);
  }
  return records.map((rec, idx) => {
    if (!(rec.sha256 instanceof Uint8Array) || rec.sha256.length !== 32) {
      throw new Error(`evidenceRecords[${idx}].sha256 must be 32 bytes`);
    }
    if (!Number.isSafeInteger(rec.byteLength) || rec.byteLength < 0) {
      throw new Error(`evidenceRecords[${idx}].byteLength must be a non-negative integer`);
    }
    const label = sanitizeSingleLineText(
      rec.label,
      MAX_EVIDENCE_LABEL_UTF8_BYTES,
      `evidenceRecords[${idx}].label`,
    );
    const mimeType = sanitizeSingleLineText(
      rec.mimeType,
      MAX_EVIDENCE_MIME_UTF8_BYTES,
      `evidenceRecords[${idx}].mimeType`,
    );
    if (rec.category !== undefined && !(rec.category in EVIDENCE_CATEGORY_TO_CODE)) {
      throw new Error(`evidenceRecords[${idx}].category is invalid`);
    }
    return {
      sha256: new Uint8Array(rec.sha256),
      byteLength: rec.byteLength,
      ...(label !== undefined ? { label } : {}),
      ...(rec.category !== undefined ? { category: rec.category } : {}),
      ...(mimeType !== undefined ? { mimeType } : {}),
    };
  });
}

export function hasEvidenceExtensionDetails(input: EvidenceExtensionDetailsInput): boolean {
  if (input.creationMethod !== undefined) return true;
  if (normalizeArtworkMetadata(input.artworkMetadata) !== undefined) return true;
  if (normalizeCreatorProfile(input.creatorProfile) !== undefined) return true;
  if (normalizeCreationEnvironment(input.creationEnvironment) !== undefined) return true;
  if (input.evidenceRecords && input.evidenceRecords.length > 0) return true;
  return false;
}

function assert32Bytes(val: unknown, label: string): Uint8Array {
  if (!(val instanceof Uint8Array) || val.length !== 32) {
    throw new Error(`${label} must be a 32-byte byte string`);
  }
  return val;
}

function assert16Bytes(val: unknown, label: string): Uint8Array {
  if (!(val instanceof Uint8Array) || val.length !== 16) {
    throw new Error(`${label} must be a 16-byte byte string`);
  }
  return val;
}

export function encodeUnsignedEvidencePayload(ext: UnsignedEvidenceExtension): Uint8Array {
  if (ext.version !== EVIDENCE_EXTENSION_VERSION) {
    throw new Error(`Unsupported evidence extension version: ${String(ext.version)}`);
  }
  assert16Bytes(ext.evidenceId, 'evidenceId');
  assert32Bytes(ext.publicKey, 'publicKey');
  assert32Bytes(ext.proofSha256, 'proofSha256');
  assert16Bytes(ext.artworkId, 'artworkId');
  assert32Bytes(ext.artworkSha256, 'artworkSha256');
  if (!Number.isSafeInteger(ext.issuedAt) || ext.issuedAt < 0) {
    throw new Error('issuedAt must be a non-negative integer Unix timestamp');
  }

  const payloadMap = new Map<number, unknown>();
  payloadMap.set(1, new Uint8Array(ext.evidenceId));
  payloadMap.set(2, new Uint8Array(ext.publicKey));
  payloadMap.set(3, new Uint8Array(ext.proofSha256));
  payloadMap.set(4, new Uint8Array(ext.artworkId));
  payloadMap.set(5, new Uint8Array(ext.artworkSha256));
  payloadMap.set(6, ext.issuedAt);

  const meta = normalizeArtworkMetadata(ext.artworkMetadata);
  if (meta) {
    const metaMap = new Map<number, unknown>();
    if (meta.title !== undefined) metaMap.set(1, meta.title);
    if (meta.artistName !== undefined) metaMap.set(2, meta.artistName);
    if (meta.description !== undefined) metaMap.set(3, meta.description);
    payloadMap.set(7, metaMap);
  }

  const profile = normalizeCreatorProfile(ext.creatorProfile);
  if (profile) {
    const profileMap = new Map<number, unknown>();
    if (profile.displayName !== undefined) profileMap.set(1, profile.displayName);
    if (profile.website !== undefined) profileMap.set(2, profile.website);
    if (profile.links && profile.links.length > 0) {
      profileMap.set(
        3,
        profile.links.map((item) => (item.label !== undefined ? [item.url, item.label] : [item.url])),
      );
    }
    payloadMap.set(8, profileMap);
  }

  if (ext.creationMethod !== undefined) {
    const code = CREATION_METHOD_TO_CODE[ext.creationMethod];
    if (!code) {
      throw new Error(`Invalid creationMethod: ${String(ext.creationMethod)}`);
    }
    payloadMap.set(9, code);
  }

  const env = normalizeCreationEnvironment(ext.creationEnvironment);
  if (env) {
    const envMap = new Map<number, unknown>();
    if (env.software !== undefined) envMap.set(1, env.software);
    if (env.hardware !== undefined) envMap.set(2, env.hardware);
    if (env.inputDevice !== undefined) envMap.set(3, env.inputDevice);
    if (env.notes !== undefined) envMap.set(4, env.notes);
    payloadMap.set(10, envMap);
  }

  const records = normalizeEvidenceRecords(ext.evidenceRecords);
  if (records) {
    payloadMap.set(
      11,
      records.map((rec) => {
        const recMap = new Map<number, unknown>();
        recMap.set(1, new Uint8Array(rec.sha256));
        recMap.set(2, rec.byteLength);
        if (rec.label !== undefined) recMap.set(3, rec.label);
        if (rec.category !== undefined) recMap.set(4, EVIDENCE_CATEGORY_TO_CODE[rec.category]);
        if (rec.mimeType !== undefined) recMap.set(5, rec.mimeType);
        return recMap;
      }),
    );
  }

  const encoded = cborEncode(payloadMap, rfc8949EncodeOptions);
  if (encoded.length > MAX_EVIDENCE_CBOR_BYTES - 96) {
    throw new Error(
      `Evidence payload (${encoded.length} bytes) exceeds safe maximum envelope budget`,
    );
  }
  return encoded;
}

export function buildEvidenceSigningMessage(payloadBytes: Uint8Array): Uint8Array {
  const message = new Uint8Array(EVIDENCE_DOMAIN_SEPARATION_PREFIX.length + payloadBytes.length);
  message.set(EVIDENCE_DOMAIN_SEPARATION_PREFIX, 0);
  message.set(payloadBytes, EVIDENCE_DOMAIN_SEPARATION_PREFIX.length);
  return message;
}

export function encodeSignedEvidenceEnvelope(
  payloadBytes: Uint8Array,
  signature64: Uint8Array,
  version: typeof EVIDENCE_EXTENSION_VERSION = EVIDENCE_EXTENSION_VERSION,
): Uint8Array {
  if (signature64.length !== 64) {
    throw new Error('Ed25519 signature must be 64 bytes');
  }
  const encoded = cborEncode([version, payloadBytes, signature64], rfc8949EncodeOptions);
  if (encoded.length > MAX_EVIDENCE_CBOR_BYTES) {
    throw new Error(
      `Encoded evidence extension (${encoded.length} bytes) exceeds maximum (${MAX_EVIDENCE_CBOR_BYTES} bytes)`,
    );
  }
  return encoded;
}

export interface DecodedEvidenceEnvelope {
  version: number;
  payloadBytes: Uint8Array;
  signature: Uint8Array;
  extension: SignedEvidenceExtension;
}

function assertAllowedMapKeys(map: Map<unknown, unknown>, allowed: Set<number>, label: string): void {
  for (const key of map.keys()) {
    if (typeof key !== 'number' || !allowed.has(key)) {
      throw new Error(`Unknown or invalid ${label} key: ${String(key)}`);
    }
  }
}

export function decodeSignedEvidenceEnvelope(evidenceBytes: Uint8Array): DecodedEvidenceEnvelope {
  if (!(evidenceBytes instanceof Uint8Array) || evidenceBytes.length === 0) {
    throw new Error('Evidence extension bytes must be non-empty');
  }
  if (evidenceBytes.length > MAX_EVIDENCE_CBOR_BYTES) {
    throw new Error(
      `Evidence extension exceeds maximum size (${MAX_EVIDENCE_CBOR_BYTES} bytes)`,
    );
  }

  const decodedOuter = cborDecode(evidenceBytes, STRICT_DECODE_OPTIONS);
  if (!Array.isArray(decodedOuter) || decodedOuter.length !== 3) {
    throw new Error('Evidence extension envelope must be a 3-element CBOR array');
  }

  const [version, payloadBytes, signature] = decodedOuter;
  if (typeof version !== 'number' || !Number.isSafeInteger(version)) {
    throw new Error('Evidence extension version must be an integer');
  }
  if (version !== EVIDENCE_EXTENSION_VERSION) {
    throw new UnsupportedEvidenceVersionError(version);
  }
  if (!(payloadBytes instanceof Uint8Array) || payloadBytes.length === 0) {
    throw new Error('Evidence extension payload must be a non-empty byte string');
  }
  if (!(signature instanceof Uint8Array) || signature.length !== 64) {
    throw new Error('Evidence extension signature must be a 64-byte byte string');
  }

  const reEncodedOuter = cborEncode([version, payloadBytes, signature], rfc8949EncodeOptions);
  if (!constantTimeEqual(reEncodedOuter, evidenceBytes)) {
    throw new Error('Evidence extension envelope is not canonically CBOR-encoded');
  }

  const decodedPayload = cborDecode(payloadBytes, STRICT_DECODE_OPTIONS);
  if (!(decodedPayload instanceof Map)) {
    throw new Error('Evidence extension payload must be a CBOR map');
  }
  assertAllowedMapKeys(decodedPayload, new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]), 'evidencePayload');

  const evidenceId = assert16Bytes(decodedPayload.get(1), 'evidenceId');
  const publicKey = assert32Bytes(decodedPayload.get(2), 'publicKey');
  const proofSha256 = assert32Bytes(decodedPayload.get(3), 'proofSha256');
  const artworkId = assert16Bytes(decodedPayload.get(4), 'artworkId');
  const artworkSha256 = assert32Bytes(decodedPayload.get(5), 'artworkSha256');
  const issuedAt = decodedPayload.get(6);
  if (typeof issuedAt !== 'number' || !Number.isSafeInteger(issuedAt) || issuedAt < 0) {
    throw new Error('issuedAt must be a non-negative integer');
  }

  let artworkMetadata: ExtendedArtworkMetadata | undefined;
  if (decodedPayload.has(7)) {
    const rawMeta = decodedPayload.get(7);
    if (!(rawMeta instanceof Map) || rawMeta.size === 0) {
      throw new Error('artworkMetadata must be a non-empty CBOR map');
    }
    assertAllowedMapKeys(rawMeta, new Set([1, 2, 3]), 'artworkMetadata');
    const parsedMeta: ExtendedArtworkMetadata = {};
    if (rawMeta.has(1)) {
      const v = rawMeta.get(1);
      if (typeof v !== 'string') throw new Error('artworkMetadata.title must be a string');
      const s = sanitizeSingleLineText(v, MAX_EXT_TITLE_UTF8_BYTES, 'artworkMetadata.title');
      if (s === undefined) throw new Error('artworkMetadata.title cannot be empty');
      parsedMeta.title = s;
    }
    if (rawMeta.has(2)) {
      const v = rawMeta.get(2);
      if (typeof v !== 'string') throw new Error('artworkMetadata.artistName must be a string');
      const s = sanitizeSingleLineText(v, MAX_EXT_ARTIST_UTF8_BYTES, 'artworkMetadata.artistName');
      if (s === undefined) throw new Error('artworkMetadata.artistName cannot be empty');
      parsedMeta.artistName = s;
    }
    if (rawMeta.has(3)) {
      const v = rawMeta.get(3);
      if (typeof v !== 'string') throw new Error('artworkMetadata.description must be a string');
      const s = sanitizeMultilineText(
        v,
        MAX_EXT_DESCRIPTION_UTF8_BYTES,
        'artworkMetadata.description',
      );
      if (s === undefined) throw new Error('artworkMetadata.description cannot be empty');
      parsedMeta.description = s;
    }
    artworkMetadata = parsedMeta;
  }

  let creatorProfile: CreatorProfileData | undefined;
  if (decodedPayload.has(8)) {
    const rawProfile = decodedPayload.get(8);
    if (!(rawProfile instanceof Map) || rawProfile.size === 0) {
      throw new Error('creatorProfile must be a non-empty CBOR map');
    }
    assertAllowedMapKeys(rawProfile, new Set([1, 2, 3]), 'creatorProfile');
    const parsedProfile: CreatorProfileData = {};
    if (rawProfile.has(1)) {
      const v = rawProfile.get(1);
      if (typeof v !== 'string') throw new Error('creatorProfile.displayName must be a string');
      const s = sanitizeSingleLineText(
        v,
        MAX_CREATOR_DISPLAY_NAME_UTF8_BYTES,
        'creatorProfile.displayName',
      );
      if (s === undefined) throw new Error('creatorProfile.displayName cannot be empty');
      parsedProfile.displayName = s;
    }
    if (rawProfile.has(2)) {
      const v = rawProfile.get(2);
      if (typeof v !== 'string') throw new Error('creatorProfile.website must be a string');
      const u = sanitizeProfileUrl(v, 'creatorProfile.website');
      if (u === undefined) throw new Error('creatorProfile.website cannot be empty');
      parsedProfile.website = u;
    }
    if (rawProfile.has(3)) {
      const rawLinks = rawProfile.get(3);
      if (!Array.isArray(rawLinks) || rawLinks.length === 0 || rawLinks.length > MAX_PROFILE_LINKS) {
        throw new Error('creatorProfile.links must be a non-empty bounded array');
      }
      const parsedLinks: CreatorProfileLink[] = [];
      for (let i = 0; i < rawLinks.length; i++) {
        const entry = rawLinks[i];
        if (!Array.isArray(entry) || (entry.length !== 1 && entry.length !== 2)) {
          throw new Error(`creatorProfile.links[${i}] must be a 1 or 2-element array`);
        }
        if (typeof entry[0] !== 'string') {
          throw new Error(`creatorProfile.links[${i}][0] must be a URL string`);
        }
        const url = sanitizeProfileUrl(entry[0], `creatorProfile.links[${i}].url`);
        if (url === undefined) {
          throw new Error(`creatorProfile.links[${i}].url cannot be empty`);
        }
        if (entry.length === 2) {
          if (typeof entry[1] !== 'string') {
            throw new Error(`creatorProfile.links[${i}][1] must be a label string`);
          }
          const label = sanitizeSingleLineText(
            entry[1],
            MAX_PROFILE_LINK_LABEL_UTF8_BYTES,
            `creatorProfile.links[${i}].label`,
          );
          if (label === undefined) {
            throw new Error(`creatorProfile.links[${i}].label cannot be empty when present`);
          }
          parsedLinks.push({ url, label });
        } else {
          parsedLinks.push({ url });
        }
      }
      parsedProfile.links = parsedLinks;
    }
    creatorProfile = parsedProfile;
  }

  let creationMethod: CreationMethod | undefined;
  if (decodedPayload.has(9)) {
    const rawMethod = decodedPayload.get(9);
    const resolved =
      typeof rawMethod === 'number' && Number.isSafeInteger(rawMethod)
        ? CODE_TO_CREATION_METHOD[rawMethod]
        : undefined;
    if (!resolved) {
      throw new Error('creationMethod contains an invalid code');
    }
    creationMethod = resolved;
  }

  let creationEnvironment: CreationEnvironmentData | undefined;
  if (decodedPayload.has(10)) {
    const rawEnv = decodedPayload.get(10);
    if (!(rawEnv instanceof Map) || rawEnv.size === 0) {
      throw new Error('creationEnvironment must be a non-empty CBOR map');
    }
    assertAllowedMapKeys(rawEnv, new Set([1, 2, 3, 4]), 'creationEnvironment');
    const parsedEnv: CreationEnvironmentData = {};
    if (rawEnv.has(1)) {
      const v = rawEnv.get(1);
      if (typeof v !== 'string') throw new Error('creationEnvironment.software must be a string');
      const s = sanitizeSingleLineText(
        v,
        MAX_ENV_FIELD_UTF8_BYTES,
        'creationEnvironment.software',
      );
      if (s === undefined) throw new Error('creationEnvironment.software cannot be empty');
      parsedEnv.software = s;
    }
    if (rawEnv.has(2)) {
      const v = rawEnv.get(2);
      if (typeof v !== 'string') throw new Error('creationEnvironment.hardware must be a string');
      const s = sanitizeSingleLineText(
        v,
        MAX_ENV_FIELD_UTF8_BYTES,
        'creationEnvironment.hardware',
      );
      if (s === undefined) throw new Error('creationEnvironment.hardware cannot be empty');
      parsedEnv.hardware = s;
    }
    if (rawEnv.has(3)) {
      const v = rawEnv.get(3);
      if (typeof v !== 'string') throw new Error('creationEnvironment.inputDevice must be a string');
      const s = sanitizeSingleLineText(
        v,
        MAX_ENV_FIELD_UTF8_BYTES,
        'creationEnvironment.inputDevice',
      );
      if (s === undefined) throw new Error('creationEnvironment.inputDevice cannot be empty');
      parsedEnv.inputDevice = s;
    }
    if (rawEnv.has(4)) {
      const v = rawEnv.get(4);
      if (typeof v !== 'string') throw new Error('creationEnvironment.notes must be a string');
      const s = sanitizeMultilineText(v, MAX_ENV_NOTES_UTF8_BYTES, 'creationEnvironment.notes');
      if (s === undefined) throw new Error('creationEnvironment.notes cannot be empty');
      parsedEnv.notes = s;
    }
    creationEnvironment = parsedEnv;
  }

  let evidenceRecords: EvidenceHashRecord[] | undefined;
  if (decodedPayload.has(11)) {
    const rawRecords = decodedPayload.get(11);
    if (!Array.isArray(rawRecords) || rawRecords.length === 0 || rawRecords.length > MAX_EVIDENCE_RECORDS) {
      throw new Error('evidenceRecords must be a non-empty bounded array');
    }
    evidenceRecords = rawRecords.map((item, idx) => {
      if (!(item instanceof Map)) {
        throw new Error(`evidenceRecords[${idx}] must be a CBOR map`);
      }
      assertAllowedMapKeys(item, new Set([1, 2, 3, 4, 5]), `evidenceRecords[${idx}]`);
      const recSha = assert32Bytes(item.get(1), `evidenceRecords[${idx}].sha256`);
      const byteLength = item.get(2);
      if (typeof byteLength !== 'number' || !Number.isSafeInteger(byteLength) || byteLength < 0) {
        throw new Error(`evidenceRecords[${idx}].byteLength must be a non-negative integer`);
      }
      let label: string | undefined;
      if (item.has(3)) {
        const v = item.get(3);
        if (typeof v !== 'string') throw new Error(`evidenceRecords[${idx}].label must be a string`);
        label = sanitizeSingleLineText(
          v,
          MAX_EVIDENCE_LABEL_UTF8_BYTES,
          `evidenceRecords[${idx}].label`,
        );
        if (label === undefined) {
          throw new Error(`evidenceRecords[${idx}].label cannot be empty when present`);
        }
      }
      let category: EvidenceCategory | undefined;
      if (item.has(4)) {
        const v = item.get(4);
        const resolved =
          typeof v === 'number' && Number.isSafeInteger(v)
            ? CODE_TO_EVIDENCE_CATEGORY[v]
            : undefined;
        if (!resolved) throw new Error(`evidenceRecords[${idx}].category is invalid`);
        category = resolved;
      }
      let mimeType: string | undefined;
      if (item.has(5)) {
        const v = item.get(5);
        if (typeof v !== 'string') {
          throw new Error(`evidenceRecords[${idx}].mimeType must be a string`);
        }
        mimeType = sanitizeSingleLineText(
          v,
          MAX_EVIDENCE_MIME_UTF8_BYTES,
          `evidenceRecords[${idx}].mimeType`,
        );
        if (mimeType === undefined) {
          throw new Error(`evidenceRecords[${idx}].mimeType cannot be empty when present`);
        }
      }
      return {
        sha256: recSha,
        byteLength,
        ...(label !== undefined ? { label } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(mimeType !== undefined ? { mimeType } : {}),
      };
    });
  }

  const unsigned: UnsignedEvidenceExtension = {
    version: EVIDENCE_EXTENSION_VERSION,
    evidenceId,
    publicKey,
    proofSha256,
    artworkId,
    artworkSha256,
    issuedAt,
    ...(artworkMetadata ? { artworkMetadata } : {}),
    ...(creatorProfile ? { creatorProfile } : {}),
    ...(creationMethod !== undefined ? { creationMethod } : {}),
    ...(creationEnvironment ? { creationEnvironment } : {}),
    ...(evidenceRecords ? { evidenceRecords } : {}),
  };

  const reEncodedPayload = encodeUnsignedEvidencePayload(unsigned);
  if (!constantTimeEqual(reEncodedPayload, payloadBytes)) {
    throw new Error('Evidence extension payload is not canonically CBOR-encoded');
  }

  return {
    version,
    payloadBytes,
    signature,
    extension: {
      ...unsigned,
      evidenceIdHex: formatUuidHex(evidenceId),
      artworkIdHex: formatUuidHex(artworkId),
      proofSha256Hex: bytesToHex(proofSha256),
      artworkSha256Hex: bytesToHex(artworkSha256),
      signature,
    },
  };
}

export function createPortableEvidenceBundle(params: {
  artworkId: string;
  proofSha256Hex: string;
  publicKeyFingerprint: string;
  evidenceBytes: Uint8Array;
  createdAt?: string;
}): PortableEvidenceBundle {
  return {
    format: EVIDENCE_EXTENSION_FORMAT,
    version: EVIDENCE_EXTENSION_VERSION,
    artworkId: params.artworkId,
    proofSha256: params.proofSha256Hex,
    publicKeyFingerprint: params.publicKeyFingerprint,
    createdAt: params.createdAt ?? new Date().toISOString(),
    evidenceBase64Url: base64UrlEncode(params.evidenceBytes),
  };
}

export function parsePortableEvidenceBundle(raw: unknown): {
  bundle: PortableEvidenceBundle;
  evidenceBytes: Uint8Array;
} {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid evidence extension JSON object');
  }
  const obj = raw as Record<string, unknown>;
  if (obj.format !== EVIDENCE_EXTENSION_FORMAT) {
    throw new Error('Unsupported evidence extension format');
  }
  if (obj.version !== EVIDENCE_EXTENSION_VERSION) {
    throw new UnsupportedEvidenceVersionError(
      typeof obj.version === 'number' ? obj.version : -1,
    );
  }
  if (
    typeof obj.evidenceBase64Url !== 'string' ||
    obj.evidenceBase64Url.length === 0 ||
    obj.evidenceBase64Url.length > MAX_EVIDENCE_TOKEN_CHARS ||
    !/^[A-Za-z0-9_-]+$/.test(obj.evidenceBase64Url)
  ) {
    throw new Error('Evidence extension contains invalid evidenceBase64Url payload');
  }
  const evidenceBytes = base64UrlDecode(obj.evidenceBase64Url);
  if (evidenceBytes.length === 0 || evidenceBytes.length > MAX_EVIDENCE_CBOR_BYTES) {
    throw new Error('Evidence extension payload bytes out of bounds');
  }

  return {
    bundle: {
      format: EVIDENCE_EXTENSION_FORMAT,
      version: EVIDENCE_EXTENSION_VERSION,
      artworkId: typeof obj.artworkId === 'string' ? obj.artworkId : '',
      proofSha256: typeof obj.proofSha256 === 'string' ? obj.proofSha256 : '',
      publicKeyFingerprint:
        typeof obj.publicKeyFingerprint === 'string' ? obj.publicKeyFingerprint : '',
      createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : '',
      evidenceBase64Url: obj.evidenceBase64Url,
    },
    evidenceBytes,
  };
}

export function isLikelyEvidenceExtensionText(rawInput: string): boolean {
  const trimmed = rawInput.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith(EVIDENCE_TOKEN_PREFIX)) return true;
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { format?: unknown };
      return parsed?.format === EVIDENCE_EXTENSION_FORMAT;
    } catch {
      return false;
    }
  }
  return false;
}

export function extractEvidenceBytesFromInput(rawInput: string): Uint8Array {
  if (typeof rawInput !== 'string') {
    throw new Error('Evidence extension input must be a string');
  }
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new Error('Evidence extension input is empty');
  }
  if (trimmed.length > MAX_EVIDENCE_INPUT_CHARS) {
    throw new Error('Evidence extension input exceeds maximum allowed length');
  }

  if (trimmed.startsWith('{')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error('Malformed JSON evidence extension');
    }
    return parsePortableEvidenceBundle(parsed).evidenceBytes;
  }

  const token = trimmed.startsWith(EVIDENCE_TOKEN_PREFIX)
    ? trimmed.slice(EVIDENCE_TOKEN_PREFIX.length).trim()
    : trimmed;

  if (!token || token.length > MAX_EVIDENCE_TOKEN_CHARS || !/^[A-Za-z0-9_-]+$/.test(token)) {
    throw new Error('Evidence extension token is invalid');
  }
  const bytes = base64UrlDecode(token);
  if (bytes.length === 0 || bytes.length > MAX_EVIDENCE_CBOR_BYTES) {
    throw new Error('Evidence extension payload bytes out of bounds');
  }
  return bytes;
}

export async function createSignedEvidenceExtension(params: {
  proofBytes: Uint8Array;
  manifest: SignedManifest;
  authorKey: AuthorKeyRecord;
  passphraseIfEncrypted?: string;
  publicKeyFingerprintHex: string;
  details: EvidenceExtensionDetailsInput;
  issuedAt?: number;
  evidenceId?: Uint8Array;
  customSigner?: (message: Uint8Array) => Promise<Uint8Array> | Uint8Array;
}): Promise<{
  evidenceBytes: Uint8Array;
  extension: SignedEvidenceExtension;
  bundle: PortableEvidenceBundle;
  token: string;
}> {
  const {
    proofBytes,
    manifest,
    authorKey,
    passphraseIfEncrypted,
    publicKeyFingerprintHex,
    details,
    issuedAt = manifest.issuedAt,
    evidenceId = generateArtworkId(),
    customSigner,
  } = params;

  if (!constantTimeEqual(authorKey.publicKey, manifest.publicKey)) {
    throw new Error('Author key public key does not match primary artwork manifest');
  }
  const proofSha256 = await sha256(proofBytes);

  const unsigned: UnsignedEvidenceExtension = {
    version: EVIDENCE_EXTENSION_VERSION,
    evidenceId,
    publicKey: manifest.publicKey,
    proofSha256,
    artworkId: manifest.artworkId,
    artworkSha256: manifest.sha256,
    issuedAt,
    artworkMetadata: details.artworkMetadata,
    creatorProfile: details.creatorProfile,
    creationMethod: details.creationMethod,
    creationEnvironment: details.creationEnvironment,
    evidenceRecords: details.evidenceRecords,
  };

  const payloadBytes = encodeUnsignedEvidencePayload(unsigned);
  const signingMessage = buildEvidenceSigningMessage(payloadBytes);
  const signature = customSigner
    ? await customSigner(signingMessage)
    : await signWithAuthorKey(authorKey, signingMessage, passphraseIfEncrypted);
  const evidenceBytes = encodeSignedEvidenceEnvelope(payloadBytes, signature);
  const decoded = decodeSignedEvidenceEnvelope(evidenceBytes);

  const bundle = createPortableEvidenceBundle({
    artworkId: manifest.artworkIdHex,
    proofSha256Hex: bytesToHex(proofSha256),
    publicKeyFingerprint: publicKeyFingerprintHex,
    evidenceBytes,
  });

  return {
    evidenceBytes,
    extension: decoded.extension,
    bundle,
    token: `${EVIDENCE_TOKEN_PREFIX}${bundle.evidenceBase64Url}`,
  };
}

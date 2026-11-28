#!/usr/bin/env node
/**
 * Independent Offline Verifier CLI for Certified Handmade (Node.js)
 *
 * Intentionally imports ZERO modules from ../src/ so verification remains
 * independent of the application bundle. Uses only node:crypto, node:fs,
 * node:path, cborg (MIT/Apache-2.0), fast-png (MIT), and jsqr (Apache-2.0).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { ed25519 } from '@noble/curves/ed25519.js';
import { decode as cborDecode, encode as cborEncode, rfc8949EncodeOptions } from 'cborg';
import { decode as decodePng, hasPngSignature } from 'fast-png';
import jsQR from 'jsqr';

const PROTOCOL_V1 = 1;
const PROTOCOL_V2 = 2;
const PROTOCOL_V3 = 3;
const MAX_V3_DECOMPRESSED_BYTES = 8192;
const EVIDENCE_EXTENSION_FORMAT = 'certified-handmade-evidence';
const EVIDENCE_EXTENSION_VERSION = 1;
const EVIDENCE_TOKEN_PREFIX = 'chm-evidence:';

const MAX_PROOF_BYTES = 2048;
const MAX_NOTICE_BYTES = 2048;
const MAX_INPUT_CHARS = 32768;
const MAX_EVIDENCE_CBOR_BYTES = 32768;
const MAX_EVIDENCE_INPUT_CHARS = 131072;
const MAX_EVIDENCE_FILE_BYTES = 512 * 1024 * 1024;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_OUTPUT_DIMENSION = 10240;
const MAX_TOTAL_PIXELS = 33_554_432;

const MAX_EXT_TITLE_UTF8_BYTES = 256;
const MAX_EXT_ARTIST_UTF8_BYTES = 128;
const MAX_EXT_DESCRIPTION_UTF8_BYTES = 4000;
const MAX_CREATOR_DISPLAY_NAME_UTF8_BYTES = 128;
const MAX_PROFILE_URL_UTF8_BYTES = 512;
const MAX_PROFILE_LINK_LABEL_UTF8_BYTES = 64;
const MAX_PROFILE_LINKS = 12;
const MAX_ENV_FIELD_UTF8_BYTES = 128;
const MAX_ENV_NOTES_UTF8_BYTES = 1000;
const MAX_EVIDENCE_RECORDS = 24;
const MAX_EVIDENCE_LABEL_UTF8_BYTES = 128;
const MAX_EVIDENCE_MIME_UTF8_BYTES = 96;

const DOMAIN_PROOF = Buffer.from('CHM1\0', 'ascii');
const DOMAIN_PROOF_V3 = Buffer.from('CHM3\0', 'ascii');
const DOMAIN_NOTICE = Buffer.from('CHM-NOTICE1\0', 'ascii');
const DOMAIN_EVIDENCE = Buffer.from('CHM-EVIDENCE1\0', 'ascii');
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

const STRICT_CBOR = {
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

const LICENSES = {
  0: 'ARR',
  1: 'CC0-1.0',
  2: 'CC-BY-4.0',
  3: 'CC-BY-SA-4.0',
  4: 'CC-BY-NC-4.0',
  5: 'CC-BY-NC-SA-4.0',
  6: 'CC-BY-ND-4.0',
  7: 'CC-BY-NC-ND-4.0',
};
const POLICIES = { 0: 'unspecified', 1: 'allow', 2: 'disallow' };
const NOTICE_TYPES = { 1: 'revocation', 2: 'rotation' };
const NOTICE_REASONS = { 1: 'key-compromise', 2: 'key-superseded', 3: 'retired', 4: 'other' };
const CREATION_METHOD_NAMES = {
  1: 'hand-drawn-no-ai',
  2: 'hand-drawn-ai-assisted',
  3: 'ai-generated',
  4: 'other',
  5: 'prefer-not-to-disclose',
};
const V3_URL_PREFIX_DICT = {
  1: 'https://',
  2: 'http://',
  3: 'https://x.com/',
  4: 'https://bsky.app/profile/',
  5: 'https://www.pixiv.net/users/',
  6: 'https://skeb.jp/@',
  7: 'https://vgen.co/',
  8: 'https://mastodon.social/@',
  9: 'https://misskey.io/@',
  10: 'https://njump.me/',
  11: 'https://www.furaffinity.net/user/',
  12: 'https://www.deviantart.com/',
  13: 'https://www.instagram.com/',
  14: 'https://www.youtube.com/@',
  15: 'https://github.com/',
};
const V3_SNS_PLATFORMS = {
  0: 'custom', 1: 'x', 2: 'bluesky', 3: 'mastodon', 4: 'misskey',
  5: 'nostr', 6: 'pixiv', 7: 'skeb', 8: 'booth', 9: 'vgen',
  10: 'furaffinity', 11: 'deviantart', 12: 'tumblr', 13: 'instagram',
  14: 'youtube', 15: 'github',
};
const EVIDENCE_CATEGORY_NAMES = {
  1: 'sketch',
  2: 'wip',
  3: 'intermediate',
  4: 'timelapse',
  5: 'project-file',
  6: 'other',
};

function strictBase64UrlDecode(str) {
  if (typeof str !== 'string' || !/^[A-Za-z0-9_-]+$/.test(str) || str.length % 4 === 1) {
    throw new Error('Invalid base64url token');
  }
  const buf = Buffer.from(str, 'base64url');
  if (buf.toString('base64url') !== str) {
    throw new Error('Non-canonical base64url encoding');
  }
  return new Uint8Array(buf);
}

function isStrictEd25519PublicKey(pub32) {
  if (!(pub32 instanceof Uint8Array) || pub32.length !== 32) return false;
  let allZero = true;
  for (let i = 0; i < pub32.length; i++) {
    if (pub32[i] !== 0) {
      allZero = false;
      break;
    }
  }
  if (allZero) return false;
  try {
    const point = ed25519.Point.fromBytes(pub32);
    return !point.isSmallOrder() && point.isTorsionFree();
  } catch {
    return false;
  }
}

function verifyEd25519(pub32, message, sig64) {
  if (pub32.length !== 32 || sig64.length !== 64) return false;
  // Node's OpenSSL accepts small-order / all-zero public keys on some versions
  // (observed on Node 22), which would let a forged signature verify. Mirror the
  // browser core's strict key check before delegating to crypto.verify().
  if (!isStrictEd25519PublicKey(pub32)) return false;
  try {
    const spki = Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(pub32)]);
    const keyObj = crypto.createPublicKey({ key: spki, format: 'der', type: 'spki' });
    return crypto.verify(null, Buffer.from(message), keyObj, Buffer.from(sig64));
  } catch {
    return false;
  }
}

function fingerprintFor(pub32) {
  const fullHex = crypto.createHash('sha256').update(pub32).digest('hex');
  const u = fullHex.slice(0, 16).toUpperCase();
  return {
    fullHex,
    shortDisplay: `CHM-${u.slice(0, 4)}-${u.slice(4, 8)}-${u.slice(8, 12)}-${u.slice(12, 16)}`,
  };
}

function uuidHex(b) {
  const h = Buffer.from(b).toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

function isDisallowedCodeUnit(code, allowMultiline) {
  if (code >= 0x202a && code <= 0x202e) return true;
  if (code >= 0x2066 && code <= 0x2069) return true;
  if (code === 0x7f || (code >= 0x80 && code <= 0x9f)) return true;
  if (code < 0x20) {
    if (allowMultiline && (code === 0x09 || code === 0x0a)) return false;
    return true;
  }
  return false;
}

function validateCanonicalText(value, maxBytes, allowMultiline, fieldName) {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed !== value) {
    throw new Error(`${fieldName} must be non-empty trimmed text`);
  }
  if (allowMultiline && value.includes('\r')) {
    throw new Error(`${fieldName} contains non-canonical CR line endings`);
  }
  for (let i = 0; i < value.length; i++) {
    if (isDisallowedCodeUnit(value.charCodeAt(i), allowMultiline)) {
      throw new Error(`${fieldName} contains disallowed control characters`);
    }
  }
  if (Buffer.byteLength(value, 'utf8') > maxBytes) {
    throw new Error(`${fieldName} exceeds maximum ${maxBytes} UTF-8 bytes`);
  }
  return value;
}

function validateProfileUrl(value, fieldName) {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed !== value) {
    throw new Error(`${fieldName} must be non-empty trimmed URL`);
  }
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (isDisallowedCodeUnit(code, false) || /\s/.test(value[i])) {
      throw new Error(`${fieldName} contains disallowed whitespace or control characters`);
    }
  }
  if (Buffer.byteLength(value, 'utf8') > MAX_PROFILE_URL_UTF8_BYTES) {
    throw new Error(`${fieldName} exceeds maximum ${MAX_PROFILE_URL_UTF8_BYTES} UTF-8 bytes`);
  }
  let parsed;
  try {
    parsed = new URL(value);
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
  return value;
}

function assertAllowedMapKeys(map, allowedSet, label) {
  for (const key of map.keys()) {
    if (typeof key !== 'number' || !allowedSet.has(key)) {
      throw new Error(`Unknown or invalid ${label} key: ${String(key)}`);
    }
  }
}

function normalizeSample8(sample, depth) {
  if (depth === 8) return sample & 0xff;
  if (depth === 16) return (sample >> 8) & 0xff;
  return Math.round((sample / ((1 << depth) - 1)) * 255);
}

function decodePngCanonical(bytes) {
  if (bytes.length > MAX_FILE_BYTES) {
    throw new Error('PNG exceeds 50 MB limit');
  }
  if (!hasPngSignature(bytes) || bytes.length < 33) {
    throw new Error('Invalid or truncated PNG file');
  }
  const chunkType = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  const ihdrLen = Buffer.from(bytes).readUInt32BE(8);
  if (chunkType !== 'IHDR' || ihdrLen !== 13) {
    throw new Error('Malformed PNG IHDR');
  }
  const hdrW = Buffer.from(bytes).readUInt32BE(16);
  const hdrH = Buffer.from(bytes).readUInt32BE(20);
  if (hdrW < 1 || hdrH < 1 || hdrW > MAX_OUTPUT_DIMENSION || hdrH > MAX_OUTPUT_DIMENSION) {
    throw new Error(`PNG dimensions (${hdrW}x${hdrH}) exceed safety limits`);
  }
  if (hdrW * hdrH > MAX_TOTAL_PIXELS) {
    throw new Error('PNG total pixel count exceeds 32 MP limit');
  }

  const dec = decodePng(bytes, { checkCrc: true });
  const { width, height, data, depth, channels, palette, transparency } = dec;
  const pixelCount = width * height;
  const rgba = new Uint8Array(pixelCount * 4);

  if (palette && palette.length > 0) {
    for (let i = 0; i < pixelCount; i++) {
      const idx = data[i];
      const e = palette[idx];
      const out = i * 4;
      if (!e) {
        rgba[out + 3] = 255;
        continue;
      }
      rgba[out] = e[0] ?? 0;
      rgba[out + 1] = e[1] ?? 0;
      rgba[out + 2] = e[2] ?? 0;
      rgba[out + 3] = e.length >= 4 ? e[3] : transparency && idx < transparency.length ? transparency[idx] & 0xff : 255;
    }
    return { width, height, data: rgba };
  }
  if (channels === 4 && depth === 8 && data instanceof Uint8Array) {
    rgba.set(data);
    return { width, height, data: rgba };
  }
  if (channels === 4) {
    for (let i = 0; i < pixelCount * 4; i++) rgba[i] = normalizeSample8(data[i], depth);
    return { width, height, data: rgba };
  }
  if (channels === 3) {
    const tr = transparency && transparency.length >= 3 ? transparency : null;
    for (let i = 0; i < pixelCount; i++) {
      const rRaw = data[i * 3];
      const gRaw = data[i * 3 + 1];
      const bRaw = data[i * 3 + 2];
      rgba[i * 4] = normalizeSample8(rRaw, depth);
      rgba[i * 4 + 1] = normalizeSample8(gRaw, depth);
      rgba[i * 4 + 2] = normalizeSample8(bRaw, depth);
      rgba[i * 4 + 3] = tr && rRaw === tr[0] && gRaw === tr[1] && bRaw === tr[2] ? 0 : 255;
    }
    return { width, height, data: rgba };
  }
  if (channels === 2) {
    for (let i = 0; i < pixelCount; i++) {
      const g = normalizeSample8(data[i * 2], depth);
      rgba[i * 4] = g;
      rgba[i * 4 + 1] = g;
      rgba[i * 4 + 2] = g;
      rgba[i * 4 + 3] = normalizeSample8(data[i * 2 + 1], depth);
    }
    return { width, height, data: rgba };
  }
  if (channels === 1) {
    const tg = transparency && transparency.length >= 1 ? transparency[0] : -1;
    for (let i = 0; i < pixelCount; i++) {
      const raw = data[i];
      const g = normalizeSample8(raw, depth);
      rgba[i * 4] = g;
      rgba[i * 4 + 1] = g;
      rgba[i * 4 + 2] = g;
      rgba[i * 4 + 3] = raw === tg ? 0 : 255;
    }
    return { width, height, data: rgba };
  }
  throw new Error(`Unsupported PNG channels: ${channels}`);
}

function scanQrFromRaster(raster) {
  const tryScan = (w, h, data) =>
    jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), w, h, {
      inversionAttempts: 'attemptBoth',
    });

  const full = tryScan(raster.width, raster.height, raster.data);
  if (full && full.data) return full.data;

  const flatWhite = new Uint8Array(raster.data.length);
  for (let i = 0; i < raster.data.length; i += 4) {
    const a = raster.data[i + 3] / 255;
    flatWhite[i] = Math.round(raster.data[i] * a + 255 * (1 - a));
    flatWhite[i + 1] = Math.round(raster.data[i + 1] * a + 255 * (1 - a));
    flatWhite[i + 2] = Math.round(raster.data[i + 2] * a + 255 * (1 - a));
    flatWhite[i + 3] = 255;
  }
  const flatRes = tryScan(raster.width, raster.height, flatWhite);
  return flatRes && flatRes.data ? flatRes.data : null;
}

function extractProofBytes(rawInput) {
  const trimmed = rawInput.trim();
  if (!trimmed || trimmed.length > MAX_INPUT_CHARS) {
    throw new Error('Empty or oversized proof input');
  }
  let token;
  if (trimmed.startsWith('{')) {
    const obj = JSON.parse(trimmed);
    if (obj.format !== 'certified-handmade-proof-bundle' || obj.version !== 1) {
      throw new Error('Unsupported proof bundle format');
    }
    token = obj.proofBase64Url;
  } else if (trimmed.includes('#')) {
    token = new URLSearchParams(trimmed.slice(trimmed.indexOf('#') + 1)).get('proof');
  } else if (trimmed.includes('?proof=')) {
    token = new URLSearchParams(trimmed.slice(trimmed.indexOf('?') + 1)).get('proof');
  } else if (trimmed.includes('%23proof%3D') || trimmed.includes('%23proof=')) {
    const dec = decodeURIComponent(trimmed);
    token = new URLSearchParams(dec.slice(dec.indexOf('#') + 1)).get('proof');
  } else if (trimmed.startsWith('proof=')) {
    token = new URLSearchParams(trimmed).get('proof');
  } else {
    token = trimmed;
  }
  if (!token) throw new Error('Missing proof token');
  const bytes = strictBase64UrlDecode(token);
  if (bytes.length === 0 || bytes.length > MAX_PROOF_BYTES) {
    throw new Error('Proof bytes out of bounds');
  }
  return bytes;
}

function computeArtworkDigest(raster, region, qrMask) {
  const [rx, ry, rw, rh] = region;
  const extract = (ox, oy, ow, oh) => {
    if (ox === 0 && oy === 0 && ow === raster.width && oh === raster.height) {
      return new Uint8Array(raster.data);
    }
    const out = new Uint8Array(ow * oh * 4);
    for (let row = 0; row < oh; row++) {
      const s = ((oy + row) * raster.width + ox) * 4;
      out.set(raster.data.subarray(s, s + ow * 4), row * ow * 4);
    }
    return out;
  };

  if (qrMask) {
    const exact = raster.width === rw && raster.height === rh;
    const fits = rx + rw <= raster.width && ry + rh <= raster.height;
    if (!exact && !fits) throw new Error('Image dimensions smaller than declared region');
    const buf = exact ? extract(0, 0, rw, rh) : extract(rx, ry, rw, rh);
    const [mx, my, mw, mh] = qrMask;
    const stride = rw * 4;
    for (let row = 0; row < mh; row++) {
      buf.fill(0, (my + row) * stride + mx * 4, (my + row) * stride + (mx + mw) * 4);
    }
    return {
      digest: new Uint8Array(crypto.createHash('sha256').update(buf).digest()),
      mode: 'in-image-masked',
    };
  }
  if (raster.width === rw && raster.height === rh) {
    return {
      digest: new Uint8Array(crypto.createHash('sha256').update(raster.data).digest()),
      mode: 'full-artwork',
    };
  }
  if (rx + rw <= raster.width && ry + rh <= raster.height) {
    const reg = extract(rx, ry, rw, rh);
    return {
      digest: new Uint8Array(crypto.createHash('sha256').update(reg).digest()),
      mode: 'embedded-region',
    };
  }
  throw new Error('Image dimensions smaller than declared region');
}

function decodeV3CompactUrl(raw, fieldName) {
  if (!Array.isArray(raw) || raw.length !== 2) {
    throw new Error(`${fieldName} compact URL must be a 2-element array`);
  }
  const [code, suffix] = raw;
  const prefix = V3_URL_PREFIX_DICT[code];
  if (typeof code !== 'number' || !prefix || typeof suffix !== 'string') {
    throw new Error(`${fieldName} invalid compact URL entry`);
  }
  const full = validateProfileUrl(prefix + suffix, fieldName);
  let bestCode = 0;
  let bestLen = 0;
  for (const [k, p] of Object.entries(V3_URL_PREFIX_DICT)) {
    if (full.startsWith(p) && p.length > bestLen) {
      bestLen = p.length;
      bestCode = Number(k);
    }
  }
  if (bestCode !== code) {
    throw new Error(`${fieldName} uses non-canonical compact URL prefix code`);
  }
  return full;
}

function unpackV3PolicyFlags(flags) {
  if (typeof flags !== 'number' || !Number.isSafeInteger(flags) || flags < 0 || flags > 0xfff) {
    throw new Error('Invalid v3 policyFlags integer');
  }
  const c = POLICIES[flags & 0x3];
  const r = POLICIES[(flags >>> 2) & 0x3];
  const a = POLICIES[(flags >>> 4) & 0x3];
  const d = POLICIES[(flags >>> 6) & 0x3];
  const m = POLICIES[(flags >>> 8) & 0x3];
  if (!c || !r || !a || !d || !m) {
    throw new Error('Invalid 2-bit policy signal in v3 policyFlags');
  }
  const hasAttr = (flags & 0x400) !== 0;
  const attrVal = (flags & 0x800) !== 0;
  if (!hasAttr && attrVal) {
    throw new Error('Invalid v3 policyFlags attribution presence/value combination');
  }
  return {
    commercialUse: c,
    redistribution: r,
    aiTraining: a,
    allowsDerivatives: d === 'unspecified' ? null : d,
    allowsModifications: m === 'unspecified' ? null : m,
    requiresAttribution: hasAttr ? attrVal : null,
  };
}

function verifyProofData(proofInput, raster) {
  const proofBytes = extractProofBytes(proofInput);
  const outer = cborDecode(proofBytes, STRICT_CBOR);
  if (!Array.isArray(outer) || outer.length < 3) {
    throw new Error('Invalid proof envelope structure');
  }
  const ver = outer[0];
  if (ver !== PROTOCOL_V1 && ver !== PROTOCOL_V2 && ver !== PROTOCOL_V3) {
    throw new Error(`Unsupported protocol version: ${String(ver)}`);
  }

  let payloadBytes;
  let sig;
  let usedDeflate = false;

  if (ver === PROTOCOL_V3) {
    if (outer.length !== 4) {
      throw new Error('Protocol v3 envelope must be a 4-element CBOR array');
    }
    const compFlag = outer[1];
    const transportBytes = outer[2];
    sig = outer[3];
    if (compFlag !== 0 && compFlag !== 1) {
      throw new Error('Protocol v3 compression flag must be 0 or 1');
    }
    if (!(transportBytes instanceof Uint8Array) || transportBytes.length === 0 || !(sig instanceof Uint8Array) || sig.length !== 64) {
      throw new Error('Invalid v3 payload or signature byte strings');
    }
    const reOuter = cborEncode([ver, compFlag, transportBytes, sig], rfc8949EncodeOptions);
    if (!Buffer.from(reOuter).equals(Buffer.from(proofBytes))) {
      throw new Error('Non-canonical outer proof CBOR');
    }
    if (compFlag === 1) {
      usedDeflate = true;
      payloadBytes = new Uint8Array(
        zlib.inflateRawSync(Buffer.from(transportBytes), { maxOutputLength: MAX_V3_DECOMPRESSED_BYTES }),
      );
      if (transportBytes.length >= payloadBytes.length) {
        throw new Error('Compressed v3 payload is not strictly smaller than uncompressed payload');
      }
    } else {
      if (transportBytes.length > MAX_V3_DECOMPRESSED_BYTES) {
        throw new Error('v3 payload exceeds maximum size');
      }
      payloadBytes = transportBytes;
    }
  } else {
    if (outer.length !== 3) {
      throw new Error('Invalid proof envelope structure');
    }
    payloadBytes = outer[1];
    sig = outer[2];
    if (!(payloadBytes instanceof Uint8Array) || !(sig instanceof Uint8Array) || sig.length !== 64) {
      throw new Error('Invalid payload or signature byte strings');
    }
    const reOuter = cborEncode([ver, payloadBytes, sig], rfc8949EncodeOptions);
    if (!Buffer.from(reOuter).equals(Buffer.from(proofBytes))) {
      throw new Error('Non-canonical outer proof CBOR');
    }
  }

  const m = cborDecode(payloadBytes, STRICT_CBOR);
  if (!(m instanceof Map)) throw new Error('Manifest payload must be a CBOR map');
  const allowedKeys =
    ver === PROTOCOL_V3
      ? new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17])
      : ver === PROTOCOL_V2
        ? new Set([1, 2, 3, 4, 5, 6, 7, 8, 9])
        : new Set([1, 2, 3, 4, 5, 6, 7, 8]);
  assertAllowedMapKeys(m, allowedKeys, 'manifestPayload');

  const artworkId = m.get(1);
  const pubKey = m.get(2);
  const sha = m.get(3);
  const region = m.get(4);
  const issuedAt = m.get(5);
  const lic = m.get(6);
  const authorName = m.get(7);
  const artworkTitle = m.get(8);
  const qrMask = m.get(9);

  if (!(artworkId instanceof Uint8Array) || artworkId.length !== 16) throw new Error('Invalid artworkId');
  if (!(pubKey instanceof Uint8Array) || pubKey.length !== 32) throw new Error('Invalid publicKey');
  if (!(sha instanceof Uint8Array) || sha.length !== 32) throw new Error('Invalid sha256');
  if (!Array.isArray(region) || region.length !== 4) throw new Error('Invalid region');
  if (typeof issuedAt !== 'number' || !Number.isSafeInteger(issuedAt) || issuedAt < 0) throw new Error('Invalid issuedAt');
  if (ver === PROTOCOL_V1 && qrMask !== undefined) throw new Error('qrMask requires protocol v2 or v3');

  let policySummary;
  let attributionName = null;
  if (ver === PROTOCOL_V3) {
    if (!Array.isArray(lic) || (lic.length !== 2 && lic.length !== 3)) throw new Error('Invalid v3 license');
    if (!LICENSES[lic[0]]) throw new Error('Unknown license code');
    policySummary = unpackV3PolicyFlags(lic[1]);
    if (lic.length === 3) {
      attributionName = validateCanonicalText(lic[2], 48, false, 'attributionName');
    }
  } else {
    if (!Array.isArray(lic) || (lic.length !== 4 && lic.length !== 5)) throw new Error('Invalid license');
    if (!LICENSES[lic[0]] || !POLICIES[lic[1]] || !POLICIES[lic[2]] || !POLICIES[lic[3]]) {
      throw new Error('Invalid license or policy code');
    }
    policySummary = {
      commercialUse: POLICIES[lic[1]],
      redistribution: POLICIES[lic[2]],
      aiTraining: POLICIES[lic[3]],
      allowsDerivatives: null,
      allowsModifications: null,
      requiresAttribution: null,
    };
    if (lic.length === 5) {
      attributionName = validateCanonicalText(lic[4], 48, false, 'attributionName');
    }
  }

  if (authorName !== undefined) {
    validateCanonicalText(authorName, ver === PROTOCOL_V3 ? 64 : 48, false, 'authorName');
  }
  if (artworkTitle !== undefined) {
    validateCanonicalText(artworkTitle, ver === PROTOCOL_V3 ? 128 : 64, false, 'artworkTitle');
  }

  let description = null;
  let website = null;
  let snsLinks = null;
  let portfolioLinks = null;
  let creationMethod = null;
  let creationEnvironment = null;
  let evidenceHashes = null;
  let policyNote = null;

  if (ver === PROTOCOL_V3) {
    if (m.has(10)) description = validateCanonicalText(m.get(10), 600, true, 'description');
    if (m.has(11)) website = decodeV3CompactUrl(m.get(11), 'website');
    if (m.has(12)) {
      const rawSns = m.get(12);
      if (!Array.isArray(rawSns) || rawSns.length === 0 || rawSns.length > 12) throw new Error('Invalid snsLinks');
      snsLinks = rawSns.map((entry, idx) => {
        if (!Array.isArray(entry) || entry.length < 2 || entry.length > 4) throw new Error(`Invalid snsLinks[${idx}]`);
        const url = decodeV3CompactUrl([entry[0], entry[1]], `snsLinks[${idx}].url`);
        const out = { url };
        if (entry.length >= 3) {
          const pCode = entry[2];
          if (typeof pCode !== 'number' || !(pCode in V3_SNS_PLATFORMS)) throw new Error('Invalid SNS platform');
          if (entry.length === 3 && pCode === 0) throw new Error('Non-canonical zero SNS platform');
          if (pCode !== 0) out.platform = V3_SNS_PLATFORMS[pCode];
        }
        if (entry.length === 4) out.label = validateCanonicalText(entry[3], 48, false, `snsLinks[${idx}].label`);
        return out;
      });
    }
    if (m.has(13)) {
      const rawPort = m.get(13);
      if (!Array.isArray(rawPort) || rawPort.length === 0 || rawPort.length > 8) throw new Error('Invalid portfolioLinks');
      portfolioLinks = rawPort.map((entry, idx) => {
        if (!Array.isArray(entry) || entry.length < 2 || entry.length > 3) throw new Error(`Invalid portfolioLinks[${idx}]`);
        const url = decodeV3CompactUrl([entry[0], entry[1]], `portfolioLinks[${idx}].url`);
        return entry.length === 3
          ? { url, label: validateCanonicalText(entry[2], 48, false, `portfolioLinks[${idx}].label`) }
          : { url };
      });
    }
    if (m.has(14)) {
      const mc = m.get(14);
      if (typeof mc !== 'number' || !CREATION_METHOD_NAMES[mc]) throw new Error('Invalid creationMethod');
      creationMethod = CREATION_METHOD_NAMES[mc];
    }
    if (m.has(15)) {
      const rawEnv = m.get(15);
      if (!(rawEnv instanceof Map) || rawEnv.size === 0) throw new Error('Invalid creationEnvironment');
      assertAllowedMapKeys(rawEnv, new Set([1, 2, 3, 4]), 'creationEnvironment');
      creationEnvironment = {};
      if (rawEnv.has(1)) creationEnvironment.software = validateCanonicalText(rawEnv.get(1), 96, false, 'creationEnvironment.software');
      if (rawEnv.has(2)) creationEnvironment.hardware = validateCanonicalText(rawEnv.get(2), 96, false, 'creationEnvironment.hardware');
      if (rawEnv.has(3)) creationEnvironment.inputDevice = validateCanonicalText(rawEnv.get(3), 96, false, 'creationEnvironment.inputDevice');
      if (rawEnv.has(4)) creationEnvironment.notes = validateCanonicalText(rawEnv.get(4), 240, true, 'creationEnvironment.notes');
    }
    if (m.has(16)) {
      const rawHashes = m.get(16);
      if (!Array.isArray(rawHashes) || rawHashes.length === 0 || rawHashes.length > 8) throw new Error('Invalid evidenceHashes');
      evidenceHashes = rawHashes.map((entry, idx) => {
        if (!Array.isArray(entry) || entry.length < 2 || entry.length > 5) throw new Error(`Invalid evidenceHashes[${idx}]`);
        const h = entry[0];
        const bl = entry[1];
        if (!(h instanceof Uint8Array) || h.length !== 32) throw new Error(`Invalid evidenceHashes[${idx}].sha256`);
        if (typeof bl !== 'number' || !Number.isSafeInteger(bl) || bl < 0) throw new Error(`Invalid evidenceHashes[${idx}].byteLength`);
        const rec = { sha256Hex: Buffer.from(h).toString('hex'), byteLength: bl };
        if (entry.length >= 3) {
          const cat = entry[2];
          if (typeof cat !== 'number' || (entry.length === 3 && cat === 0)) throw new Error(`Invalid evidenceHashes[${idx}].category`);
          if (cat !== 0) {
            if (!EVIDENCE_CATEGORY_NAMES[cat]) throw new Error(`Unknown evidenceHashes[${idx}].category`);
            rec.category = EVIDENCE_CATEGORY_NAMES[cat];
          }
        }
        if (entry.length >= 4) {
          if (typeof entry[3] !== 'string' || (entry.length === 4 && entry[3] === '')) {
            throw new Error(`Invalid evidenceHashes[${idx}].label`);
          }
          if (entry[3] !== '') rec.label = validateCanonicalText(entry[3], 96, false, `evidenceHashes[${idx}].label`);
        }
        if (entry.length === 5) {
          rec.mimeType = validateCanonicalText(entry[4], 64, false, `evidenceHashes[${idx}].mimeType`);
        }
        return rec;
      });
    }
    if (m.has(17)) policyNote = validateCanonicalText(m.get(17), 240, true, 'policyNote');
  }

  const reMap = new Map();
  for (const [k, v] of m.entries()) reMap.set(k, v);
  const rePayload = cborEncode(reMap, rfc8949EncodeOptions);
  if (!Buffer.from(rePayload).equals(Buffer.from(payloadBytes))) {
    throw new Error('Non-canonical inner manifest CBOR');
  }

  const domainPrefix = ver === PROTOCOL_V3 ? DOMAIN_PROOF_V3 : DOMAIN_PROOF;
  const signingMsg = Buffer.concat([domainPrefix, Buffer.from(payloadBytes)]);
  const signatureValid = verifyEd25519(pubKey, signingMsg, sig);
  const fp = fingerprintFor(pubKey);

  let integrityStatus = 'not-checked';
  let matchedMode = null;
  let computedShaHex = null;
  let integrityError = null;
  if (raster) {
    try {
      const res = computeArtworkDigest(raster, region, qrMask);
      computedShaHex = Buffer.from(res.digest).toString('hex');
      matchedMode = res.mode;
      integrityStatus = crypto.timingSafeEqual(res.digest, Buffer.from(sha)) ? 'matched' : 'mismatched';
    } catch (e) {
      integrityStatus = 'mismatched';
      integrityError = e instanceof Error ? e.message : String(e);
    }
  }

  let qrMaskCoveragePct = null;
  if (qrMask) {
    qrMaskCoveragePct = Math.round(((qrMask[2] * qrMask[3]) / (region[2] * region[3])) * 1000) / 10;
  }

  return {
    summary: {
      protocolVersion: ver,
      usedDeflate,
      signatureValid,
      integrityStatus,
      matchedMode,
      artworkId: uuidHex(artworkId),
      publicKeyFingerprintHex: fp.fullHex,
      publicKeyFingerprintShort: fp.shortDisplay,
      declaredSha256Hex: Buffer.from(sha).toString('hex'),
      computedSha256Hex: computedShaHex,
      region,
      qrMask: qrMask ?? null,
      qrMaskCoveragePct,
      issuedAtUnix: issuedAt,
      issuedAtIso: new Date(issuedAt * 1000).toISOString(),
      license: LICENSES[lic[0]] ?? `code-${lic[0]}`,
      commercialUse: policySummary.commercialUse,
      redistribution: policySummary.redistribution,
      aiTraining: policySummary.aiTraining,
      allowsDerivatives: policySummary.allowsDerivatives,
      allowsModifications: policySummary.allowsModifications,
      requiresAttribution: policySummary.requiresAttribution,
      attributionName,
      authorName: authorName ?? null,
      artworkTitle: artworkTitle ?? null,
      description,
      website,
      snsLinks,
      portfolioLinks,
      creationMethod,
      creationEnvironment,
      evidenceHashes,
      policyNote,
      integrityError,
    },
    raw: {
      proofBytes,
      publicKey: pubKey,
      artworkId,
      artworkSha256: sha,
    },
  };
}

function extractEvidenceBytes(rawInput) {
  const trimmed = rawInput.trim();
  if (!trimmed || trimmed.length > MAX_EVIDENCE_INPUT_CHARS) {
    throw new Error('Empty or oversized evidence extension input');
  }
  let token;
  if (trimmed.startsWith('{')) {
    const obj = JSON.parse(trimmed);
    if (obj.format !== EVIDENCE_EXTENSION_FORMAT) {
      throw new Error('Unsupported evidence extension format');
    }
    if (obj.version !== EVIDENCE_EXTENSION_VERSION) {
      throw new Error(`Unsupported evidence extension version: ${String(obj.version)}`);
    }
    token = obj.evidenceBase64Url;
  } else if (trimmed.startsWith(EVIDENCE_TOKEN_PREFIX)) {
    token = trimmed.slice(EVIDENCE_TOKEN_PREFIX.length).trim();
  } else {
    token = trimmed;
  }
  if (!token) throw new Error('Missing evidenceBase64Url token');
  const bytes = strictBase64UrlDecode(token);
  if (bytes.length === 0 || bytes.length > MAX_EVIDENCE_CBOR_BYTES) {
    throw new Error('Evidence extension bytes out of bounds');
  }
  return bytes;
}

function hashFileStreamed(filePath) {
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    throw new Error(`Not a regular file: ${filePath}`);
  }
  if (stat.size > MAX_EVIDENCE_FILE_BYTES) {
    throw new Error(`Evidence file exceeds ${MAX_EVIDENCE_FILE_BYTES} byte limit: ${filePath}`);
  }
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    let byteLength = 0;
    const stream = fs.createReadStream(filePath, { highWaterMark: 256 * 1024 });
    stream.on('data', (chunk) => {
      byteLength += chunk.length;
      if (byteLength > MAX_EVIDENCE_FILE_BYTES) {
        stream.destroy();
        reject(new Error(`Evidence file exceeded ${MAX_EVIDENCE_FILE_BYTES} byte limit`));
        return;
      }
      hash.update(chunk);
    });
    stream.on('error', (err) => reject(err));
    stream.on('end', () => {
      const digest = new Uint8Array(hash.digest());
      resolve({
        fileName: path.basename(filePath),
        byteLength,
        digest,
        hex: Buffer.from(digest).toString('hex'),
      });
    });
  });
}

async function verifyEvidenceData(evidenceInput, proofRaw, suppliedFilePaths) {
  const evidenceBytes = extractEvidenceBytes(evidenceInput);
  const outer = cborDecode(evidenceBytes, STRICT_CBOR);
  if (!Array.isArray(outer) || outer.length !== 3) {
    throw new Error('Evidence extension envelope must be a 3-element CBOR array');
  }
  const [version, payloadBytes, sig] = outer;
  if (typeof version !== 'number' || !Number.isSafeInteger(version) || version !== EVIDENCE_EXTENSION_VERSION) {
    throw new Error(`Unsupported evidence extension version: ${String(version)}`);
  }
  if (!(payloadBytes instanceof Uint8Array) || payloadBytes.length === 0) {
    throw new Error('Evidence extension payload must be a non-empty byte string');
  }
  if (!(sig instanceof Uint8Array) || sig.length !== 64) {
    throw new Error('Evidence extension signature must be 64 bytes');
  }
  const reOuter = cborEncode([version, payloadBytes, sig], rfc8949EncodeOptions);
  if (!Buffer.from(reOuter).equals(Buffer.from(evidenceBytes))) {
    throw new Error('Non-canonical outer evidence CBOR');
  }

  const m = cborDecode(payloadBytes, STRICT_CBOR);
  if (!(m instanceof Map)) throw new Error('Evidence payload must be a CBOR map');
  assertAllowedMapKeys(m, new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]), 'evidencePayload');

  const rePayload = cborEncode(m, rfc8949EncodeOptions);
  if (!Buffer.from(rePayload).equals(Buffer.from(payloadBytes))) {
    throw new Error('Non-canonical inner evidence CBOR');
  }

  const evidenceId = m.get(1);
  const pubKey = m.get(2);
  const proofSha256 = m.get(3);
  const artworkId = m.get(4);
  const artworkSha256 = m.get(5);
  const issuedAt = m.get(6);

  if (!(evidenceId instanceof Uint8Array) || evidenceId.length !== 16) throw new Error('Invalid evidenceId');
  if (!(pubKey instanceof Uint8Array) || pubKey.length !== 32) throw new Error('Invalid evidence publicKey');
  if (!(proofSha256 instanceof Uint8Array) || proofSha256.length !== 32) throw new Error('Invalid proofSha256');
  if (!(artworkId instanceof Uint8Array) || artworkId.length !== 16) throw new Error('Invalid evidence artworkId');
  if (!(artworkSha256 instanceof Uint8Array) || artworkSha256.length !== 32) throw new Error('Invalid evidence artworkSha256');
  if (typeof issuedAt !== 'number' || !Number.isSafeInteger(issuedAt) || issuedAt < 0) {
    throw new Error('Invalid evidence issuedAt');
  }

  let artworkMetadata = null;
  if (m.has(7)) {
    const rawMeta = m.get(7);
    if (!(rawMeta instanceof Map) || rawMeta.size === 0) throw new Error('artworkMetadata must be a non-empty CBOR map');
    assertAllowedMapKeys(rawMeta, new Set([1, 2, 3]), 'artworkMetadata');
    artworkMetadata = {};
    if (rawMeta.has(1)) artworkMetadata.title = validateCanonicalText(rawMeta.get(1), MAX_EXT_TITLE_UTF8_BYTES, false, 'artworkMetadata.title');
    if (rawMeta.has(2)) artworkMetadata.artistName = validateCanonicalText(rawMeta.get(2), MAX_EXT_ARTIST_UTF8_BYTES, false, 'artworkMetadata.artistName');
    if (rawMeta.has(3)) artworkMetadata.description = validateCanonicalText(rawMeta.get(3), MAX_EXT_DESCRIPTION_UTF8_BYTES, true, 'artworkMetadata.description');
  }

  let creatorProfile = null;
  if (m.has(8)) {
    const rawProf = m.get(8);
    if (!(rawProf instanceof Map) || rawProf.size === 0) throw new Error('creatorProfile must be a non-empty CBOR map');
    assertAllowedMapKeys(rawProf, new Set([1, 2, 3]), 'creatorProfile');
    creatorProfile = {};
    if (rawProf.has(1)) creatorProfile.displayName = validateCanonicalText(rawProf.get(1), MAX_CREATOR_DISPLAY_NAME_UTF8_BYTES, false, 'creatorProfile.displayName');
    if (rawProf.has(2)) creatorProfile.website = validateProfileUrl(rawProf.get(2), 'creatorProfile.website');
    if (rawProf.has(3)) {
      const rawLinks = rawProf.get(3);
      if (!Array.isArray(rawLinks) || rawLinks.length === 0 || rawLinks.length > MAX_PROFILE_LINKS) {
        throw new Error('creatorProfile.links must be a non-empty bounded array');
      }
      creatorProfile.links = rawLinks.map((entry, idx) => {
        if (!Array.isArray(entry) || (entry.length !== 1 && entry.length !== 2)) {
          throw new Error(`creatorProfile.links[${idx}] must be a 1 or 2-element array`);
        }
        const url = validateProfileUrl(entry[0], `creatorProfile.links[${idx}].url`);
        if (entry.length === 2) {
          const label = validateCanonicalText(entry[1], MAX_PROFILE_LINK_LABEL_UTF8_BYTES, false, `creatorProfile.links[${idx}].label`);
          return { url, label };
        }
        return { url };
      });
    }
  }

  let creationMethod = null;
  if (m.has(9)) {
    const code = m.get(9);
    if (typeof code !== 'number' || !CREATION_METHOD_NAMES[code]) {
      throw new Error('creationMethod contains an invalid code');
    }
    creationMethod = CREATION_METHOD_NAMES[code];
  }

  let creationEnvironment = null;
  if (m.has(10)) {
    const rawEnv = m.get(10);
    if (!(rawEnv instanceof Map) || rawEnv.size === 0) throw new Error('creationEnvironment must be a non-empty CBOR map');
    assertAllowedMapKeys(rawEnv, new Set([1, 2, 3, 4]), 'creationEnvironment');
    creationEnvironment = {};
    if (rawEnv.has(1)) creationEnvironment.software = validateCanonicalText(rawEnv.get(1), MAX_ENV_FIELD_UTF8_BYTES, false, 'creationEnvironment.software');
    if (rawEnv.has(2)) creationEnvironment.hardware = validateCanonicalText(rawEnv.get(2), MAX_ENV_FIELD_UTF8_BYTES, false, 'creationEnvironment.hardware');
    if (rawEnv.has(3)) creationEnvironment.inputDevice = validateCanonicalText(rawEnv.get(3), MAX_ENV_FIELD_UTF8_BYTES, false, 'creationEnvironment.inputDevice');
    if (rawEnv.has(4)) creationEnvironment.notes = validateCanonicalText(rawEnv.get(4), MAX_ENV_NOTES_UTF8_BYTES, true, 'creationEnvironment.notes');
  }

  let evidenceRecords = [];
  if (m.has(11)) {
    const rawRecords = m.get(11);
    if (!Array.isArray(rawRecords) || rawRecords.length === 0 || rawRecords.length > MAX_EVIDENCE_RECORDS) {
      throw new Error('evidenceRecords must be a non-empty bounded array');
    }
    evidenceRecords = rawRecords.map((item, idx) => {
      if (!(item instanceof Map)) throw new Error(`evidenceRecords[${idx}] must be a CBOR map`);
      assertAllowedMapKeys(item, new Set([1, 2, 3, 4, 5]), `evidenceRecords[${idx}]`);
      const recSha = item.get(1);
      if (!(recSha instanceof Uint8Array) || recSha.length !== 32) {
        throw new Error(`evidenceRecords[${idx}].sha256 must be 32 bytes`);
      }
      const byteLength = item.get(2);
      if (typeof byteLength !== 'number' || !Number.isSafeInteger(byteLength) || byteLength < 0) {
        throw new Error(`evidenceRecords[${idx}].byteLength must be a non-negative integer`);
      }
      const label = item.has(3)
        ? validateCanonicalText(item.get(3), MAX_EVIDENCE_LABEL_UTF8_BYTES, false, `evidenceRecords[${idx}].label`)
        : null;
      let category = null;
      if (item.has(4)) {
        const catCode = item.get(4);
        if (typeof catCode !== 'number' || !EVIDENCE_CATEGORY_NAMES[catCode]) {
          throw new Error(`evidenceRecords[${idx}].category is invalid`);
        }
        category = EVIDENCE_CATEGORY_NAMES[catCode];
      }
      const mimeType = item.has(5)
        ? validateCanonicalText(item.get(5), MAX_EVIDENCE_MIME_UTF8_BYTES, false, `evidenceRecords[${idx}].mimeType`)
        : null;
      return {
        index: idx,
        sha256: recSha,
        sha256Hex: Buffer.from(recSha).toString('hex'),
        byteLength,
        label,
        category,
        mimeType,
      };
    });
  }

  const signingMsg = Buffer.concat([DOMAIN_EVIDENCE, Buffer.from(payloadBytes)]);
  const signatureValid = verifyEd25519(pubKey, signingMsg, sig);

  const expectedProofSha = new Uint8Array(crypto.createHash('sha256').update(proofRaw.proofBytes).digest());
  const publicKeyMatchesProof = crypto.timingSafeEqual(Buffer.from(pubKey), Buffer.from(proofRaw.publicKey));
  const artworkIdMatchesProof = crypto.timingSafeEqual(Buffer.from(artworkId), Buffer.from(proofRaw.artworkId));
  const artworkSha256MatchesProof = crypto.timingSafeEqual(Buffer.from(artworkSha256), Buffer.from(proofRaw.artworkSha256));
  const proofSha256MatchesProof = crypto.timingSafeEqual(Buffer.from(proofSha256), Buffer.from(expectedProofSha));
  const proofBindingValid =
    publicKeyMatchesProof &&
    artworkIdMatchesProof &&
    artworkSha256MatchesProof &&
    proofSha256MatchesProof;

  const errors = [];
  const warnings = [];
  if (!signatureValid) errors.push('Evidence extension Ed25519 signature verification failed');
  if (!publicKeyMatchesProof) errors.push('Evidence extension publicKey does not match primary proof');
  if (!artworkIdMatchesProof) errors.push('Evidence extension artworkId does not match primary proof');
  if (!artworkSha256MatchesProof) errors.push('Evidence extension artworkSha256 does not match primary proof');
  if (!proofSha256MatchesProof) errors.push('Evidence extension proofSha256 does not match primary proof');

  const status = !signatureValid ? 'invalid' : !proofBindingValid ? 'binding-mismatch' : 'valid';

  const hashedSupplied = [];
  for (const filePath of suppliedFilePaths) {
    hashedSupplied.push(await hashFileStreamed(filePath));
  }

  const matchedSupplied = new Set();
  const recordChecks = evidenceRecords.map((rec) => {
    const idx = hashedSupplied.findIndex(
      (sup) => sup.byteLength === rec.byteLength && crypto.timingSafeEqual(Buffer.from(sup.digest), Buffer.from(rec.sha256)),
    );
    if (idx >= 0) {
      matchedSupplied.add(idx);
      return {
        index: rec.index,
        sha256Hex: rec.sha256Hex,
        byteLength: rec.byteLength,
        label: rec.label,
        category: rec.category,
        mimeType: rec.mimeType,
        status: 'verified',
        matchedFileName: hashedSupplied[idx].fileName,
      };
    }
    return {
      index: rec.index,
      sha256Hex: rec.sha256Hex,
      byteLength: rec.byteLength,
      label: rec.label,
      category: rec.category,
      mimeType: rec.mimeType,
      status: 'unavailable',
      matchedFileName: null,
    };
  });

  const mismatchedSuppliedFiles = [];
  for (let i = 0; i < hashedSupplied.length; i++) {
    if (!matchedSupplied.has(i)) {
      mismatchedSuppliedFiles.push({
        fileName: hashedSupplied[i].fileName,
        byteLength: hashedSupplied[i].byteLength,
        computedSha256Hex: hashedSupplied[i].hex,
      });
    }
  }
  if (mismatchedSuppliedFiles.length > 0) {
    warnings.push(`${mismatchedSuppliedFiles.length} supplied local evidence file(s) did not match any record in .chmevidence`);
  }

  return {
    status,
    signatureValid,
    proofBindingValid,
    publicKeyMatchesProof,
    artworkIdMatchesProof,
    artworkSha256MatchesProof,
    proofSha256MatchesProof,
    evidenceBytesLength: evidenceBytes.length,
    evidenceId: uuidHex(evidenceId),
    proofSha256Hex: Buffer.from(proofSha256).toString('hex'),
    issuedAtUnix: issuedAt,
    issuedAtIso: new Date(issuedAt * 1000).toISOString(),
    artworkMetadata,
    creatorProfile,
    creationMethod,
    creationEnvironment,
    recordChecks,
    verifiedRecordCount: recordChecks.filter((r) => r.status === 'verified').length,
    unavailableRecordCount: recordChecks.filter((r) => r.status === 'unavailable').length,
    mismatchedSuppliedFiles,
    errors,
    warnings,
  };
}

function verifyNoticeData(rawInput) {
  const trimmed = rawInput.trim();
  let token = trimmed;
  if (trimmed.startsWith('{')) {
    const obj = JSON.parse(trimmed);
    if (obj.format !== 'certified-handmade-key-notice' || obj.version !== 1) {
      throw new Error('Unsupported key notice bundle format');
    }
    token = obj.noticeBase64Url || obj.token;
  }
  token = token.replace(/^chm-notice:/, '');
  const noticeBytes = strictBase64UrlDecode(token);
  if (noticeBytes.length === 0 || noticeBytes.length > MAX_NOTICE_BYTES) {
    throw new Error('Key notice bytes out of bounds');
  }
  const outer = cborDecode(noticeBytes, STRICT_CBOR);
  if (!Array.isArray(outer) || (outer.length !== 3 && outer.length !== 4)) {
    throw new Error('Invalid notice envelope');
  }
  const [ver, payloadBytes, subjSig, replSig] = outer;
  if (ver !== 1 || !(payloadBytes instanceof Uint8Array) || !(subjSig instanceof Uint8Array) || subjSig.length !== 64) {
    throw new Error('Malformed key notice fields');
  }
  const pMap = cborDecode(payloadBytes, STRICT_CBOR);
  if (!(pMap instanceof Map)) throw new Error('Notice payload must be a CBOR map');

  const noticeId = pMap.get(1);
  const typeCode = pMap.get(2);
  const subjPub = pMap.get(3);
  const replPub = pMap.get(4);
  const issuedAt = pMap.get(5);
  const reasonCode = pMap.get(6);
  const note = pMap.get(7);

  const noticeType = NOTICE_TYPES[typeCode];
  if (!noticeType) throw new Error('Invalid notice type');
  const signingMsg = Buffer.concat([DOMAIN_NOTICE, Buffer.from(payloadBytes)]);
  const errors = [];
  if (!verifyEd25519(subjPub, signingMsg, subjSig)) {
    errors.push('subject key signature invalid');
  }
  if (noticeType === 'rotation') {
    if (!(replPub instanceof Uint8Array) || !(replSig instanceof Uint8Array) || !verifyEd25519(replPub, signingMsg, replSig)) {
      errors.push('replacement key signature invalid');
    }
  }
  const sFp = fingerprintFor(subjPub);
  const rFp = replPub instanceof Uint8Array ? fingerprintFor(replPub) : null;
  return {
    valid: errors.length === 0,
    noticeId: uuidHex(noticeId),
    noticeType,
    reason: NOTICE_REASONS[reasonCode] ?? 'unknown',
    subjectFingerprintHex: sFp.fullHex,
    subjectFingerprintShort: sFp.shortDisplay,
    replacementFingerprintHex: rFp?.fullHex ?? null,
    replacementFingerprintShort: rFp?.shortDisplay ?? null,
    noticeIssuedAtUnix: issuedAt,
    verifiedAtUnix: Math.floor(Date.now() / 1000),
    note: note ?? null,
    errors,
  };
}

function readMaybeFile(arg) {
  if (fs.existsSync(arg) && fs.statSync(arg).isFile()) {
    return fs.readFileSync(arg, 'utf8');
  }
  return arg;
}

async function main() {
  const argv = process.argv.slice(2);
  let proofArg = null;
  let artworkArg = null;
  let noticeArg = null;
  let evidenceArg = null;
  const evidenceFileArgs = [];
  let jsonOut = false;
  let positional = null;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') jsonOut = true;
    else if (a === '--proof' && i + 1 < argv.length) proofArg = argv[++i];
    else if (a === '--artwork' && i + 1 < argv.length) artworkArg = argv[++i];
    else if (a === '--notice' && i + 1 < argv.length) noticeArg = argv[++i];
    else if (a === '--evidence' && i + 1 < argv.length) evidenceArg = argv[++i];
    else if (a === '--evidence-file' && i + 1 < argv.length) evidenceFileArgs.push(argv[++i]);
    else if (a === '-h' || a === '--help') {
      console.log('Usage: chm-verify.mjs <signed.png> | --proof <url|token|.chproof.json> [--artwork <img.png>] [--evidence <token|.chmevidence>] [--evidence-file <path>...] | --notice <token|.chnotice.json> [--json]');
      process.exit(0);
    } else if (!a.startsWith('-')) {
      positional = a;
    } else {
      console.error(`Unknown flag: ${a}`);
      process.exit(2);
    }
  }

  try {
    if (noticeArg) {
      const res = verifyNoticeData(readMaybeFile(noticeArg));
      if (jsonOut) console.log(JSON.stringify(res, null, 2));
      else {
        console.log(`Key Notice: ${res.valid ? 'VALID' : 'INVALID'} (${res.noticeType} / ${res.reason})`);
        console.log(`Subject Key: ${res.subjectFingerprintShort} (${res.subjectFingerprintHex})`);
        if (res.replacementFingerprintShort) {
          console.log(`Replacement Key: ${res.replacementFingerprintShort} (${res.replacementFingerprintHex})`);
        }
        console.log(`Notice Declared At: ${new Date(res.noticeIssuedAtUnix * 1000).toISOString()}`);
      }
      process.exit(res.valid ? 0 : 1);
    }

    if (evidenceArg && !proofArg && !positional) {
      console.error('VERIFICATION FAILED: Standalone .chmevidence cannot verify an artwork without the original proof (--proof or <signed.png>).');
      process.exit(1);
    }

    let raster = null;
    let proofInput = proofArg;
    if (!proofInput && positional) {
      if (positional.toLowerCase().endsWith('.png') && fs.existsSync(positional)) {
        const pngBytes = new Uint8Array(fs.readFileSync(positional));
        raster = decodePngCanonical(pngBytes);
        proofInput = scanQrFromRaster(raster);
        if (!proofInput) {
          throw new Error('No Certified Handmade QR code could be decoded from PNG');
        }
      } else {
        proofInput = readMaybeFile(positional);
      }
    } else if (proofInput) {
      proofInput = readMaybeFile(proofInput);
    }

    if (!proofInput) {
      console.error('Usage: chm-verify.mjs <signed.png> | --proof <url|token|.chproof.json> [--artwork <img.png>] [--evidence <token|.chmevidence>] [--evidence-file <path>...] [--json]');
      process.exit(2);
    }
    if (artworkArg && !raster) {
      if (!fs.existsSync(artworkArg)) {
        console.error(`Artwork file not found: ${artworkArg}`);
        process.exit(2);
      }
      raster = decodePngCanonical(new Uint8Array(fs.readFileSync(artworkArg)));
    }

    for (const filePath of evidenceFileArgs) {
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        console.error(`Evidence file not found: ${filePath}`);
        process.exit(2);
      }
    }

    const { summary: res, raw: proofRaw } = verifyProofData(proofInput, raster);

    let evidenceSummary = null;
    if (evidenceArg) {
      const evidenceRaw = readMaybeFile(evidenceArg);
      evidenceSummary = await verifyEvidenceData(evidenceRaw, proofRaw, evidenceFileArgs);
      res.evidenceExtension = evidenceSummary;
    }

    if (jsonOut) {
      console.log(JSON.stringify(res, null, 2));
    } else {
      console.log(`Protocol: v${res.protocolVersion}`);
      console.log(`Cryptographic Signature (Ed25519): ${res.signatureValid ? 'VALID' : 'INVALID'}`);
      console.log(`Artwork Integrity (SHA-256 RGBA8): ${res.integrityStatus.toUpperCase()}${res.matchedMode ? ` (${res.matchedMode})` : ''}`);
      console.log(`Signer Key Fingerprint: ${res.publicKeyFingerprintShort} (${res.publicKeyFingerprintHex})`);
      console.log(`Artwork ID: ${res.artworkId}`);
      console.log(`License: ${res.license} (commercial=${res.commercialUse}, redistribution=${res.redistribution}, aiTraining=${res.aiTraining})`);
      if (res.qrMask) {
        console.log(`Excluded qrMask: [${res.qrMask.join(', ')}] (${res.qrMaskCoveragePct}% of artwork)`);
      }
      if (res.authorName) console.log(`Author (signed): ${res.authorName}`);
      if (res.artworkTitle) console.log(`Title (signed): ${res.artworkTitle}`);
      if (res.creationMethod) console.log(`Creation Method (signed declaration): ${res.creationMethod}`);
      if (res.website) console.log(`Author Website (signed): ${res.website}`);
      if (res.snsLinks?.length) console.log(`SNS Links (signed): ${res.snsLinks.map((l) => l.url).join(', ')}`);
      if (res.evidenceHashes?.length) console.log(`Embedded Evidence Hashes: ${res.evidenceHashes.length} record(s)`);
      if (res.integrityError) {
        console.error(`Integrity Error: ${res.integrityError}`);
      }
      if (evidenceSummary) {
        console.log(`Evidence Extension (.chmevidence): ${evidenceSummary.status.toUpperCase()} (${evidenceSummary.evidenceBytesLength} bytes)`);
        if (evidenceSummary.artworkMetadata?.title) {
          console.log(`Extended Title: ${evidenceSummary.artworkMetadata.title}`);
        }
        if (evidenceSummary.artworkMetadata?.artistName) {
          console.log(`Extended Artist: ${evidenceSummary.artworkMetadata.artistName}`);
        }
        if (evidenceSummary.creatorProfile?.website) {
          console.log(`Creator Website (self-declared): ${evidenceSummary.creatorProfile.website}`);
        }
        if (evidenceSummary.creationMethod) {
          console.log(`Creation Method: ${evidenceSummary.creationMethod} (declared by creator; not independently proved)`);
        }
        if (evidenceSummary.creationEnvironment) {
          const envParts = [
            evidenceSummary.creationEnvironment.software && `software=${evidenceSummary.creationEnvironment.software}`,
            evidenceSummary.creationEnvironment.hardware && `hardware=${evidenceSummary.creationEnvironment.hardware}`,
            evidenceSummary.creationEnvironment.inputDevice && `input=${evidenceSummary.creationEnvironment.inputDevice}`,
          ].filter(Boolean);
          if (envParts.length > 0) {
            console.log(`Creation Environment (declared): ${envParts.join(', ')}`);
          }
        }
        if (evidenceSummary.recordChecks.length > 0) {
          console.log(`Evidence Records: ${evidenceSummary.verifiedRecordCount} verified, ${evidenceSummary.unavailableRecordCount} unavailable`);
        }
        for (const w of evidenceSummary.warnings) {
          console.error(`Evidence Warning: ${w}`);
        }
        for (const e of evidenceSummary.errors) {
          console.error(`Evidence Error: ${e}`);
        }
      }
    }

    const primaryOk = res.signatureValid && res.integrityStatus !== 'mismatched';
    const evidenceOk =
      !evidenceSummary ||
      (evidenceSummary.status === 'valid' && evidenceSummary.mismatchedSuppliedFiles.length === 0);
    process.exit(primaryOk && evidenceOk ? 0 : 1);
  } catch (err) {
    console.error(`VERIFICATION FAILED: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

await main();

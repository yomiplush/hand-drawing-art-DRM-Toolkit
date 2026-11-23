#!/usr/bin/env node
/**
 * Independent Offline Verifier CLI for Certified Handmade (Node.js)
 *
 * Intentionally imports ZERO modules from ../src/ so verification remains
 * independent of the application bundle. Uses only node:crypto, node:fs,
 * cborg (MIT/Apache-2.0), fast-png (MIT), and jsqr (Apache-2.0).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { decode as cborDecode, encode as cborEncode, rfc8949EncodeOptions } from 'cborg';
import { decode as decodePng, hasPngSignature } from 'fast-png';
import jsQR from 'jsqr';

const PROTOCOL_V1 = 1;
const PROTOCOL_V2 = 2;
const MAX_PROOF_BYTES = 2048;
const MAX_NOTICE_BYTES = 2048;
const MAX_INPUT_CHARS = 32768;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_OUTPUT_DIMENSION = 10240;
const MAX_TOTAL_PIXELS = 33_554_432;

const DOMAIN_PROOF = Buffer.from('CHM1\0', 'ascii');
const DOMAIN_NOTICE = Buffer.from('CHM-NOTICE1\0', 'ascii');
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

function verifyEd25519(pub32, message, sig64) {
  if (pub32.length !== 32 || sig64.length !== 64) return false;
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

function verifyProofData(proofInput, raster) {
  const proofBytes = extractProofBytes(proofInput);
  const outer = cborDecode(proofBytes, STRICT_CBOR);
  if (!Array.isArray(outer) || outer.length !== 3) {
    throw new Error('Invalid proof envelope structure');
  }
  const [ver, payloadBytes, sig] = outer;
  if (ver !== PROTOCOL_V1 && ver !== PROTOCOL_V2) {
    throw new Error(`Unsupported protocol version: ${String(ver)}`);
  }
  if (!(payloadBytes instanceof Uint8Array) || !(sig instanceof Uint8Array) || sig.length !== 64) {
    throw new Error('Invalid payload or signature byte strings');
  }
  const reOuter = cborEncode([ver, payloadBytes, sig], rfc8949EncodeOptions);
  if (!Buffer.from(reOuter).equals(Buffer.from(proofBytes))) {
    throw new Error('Non-canonical outer proof CBOR');
  }

  const m = cborDecode(payloadBytes, STRICT_CBOR);
  if (!(m instanceof Map)) throw new Error('Manifest payload must be a CBOR map');

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
  if (!Array.isArray(lic) || (lic.length !== 4 && lic.length !== 5)) throw new Error('Invalid license');
  if (ver === PROTOCOL_V1 && qrMask !== undefined) throw new Error('qrMask requires protocol v2');

  const reMap = new Map();
  for (const [k, v] of m.entries()) reMap.set(k, v);
  const rePayload = cborEncode(reMap, rfc8949EncodeOptions);
  if (!Buffer.from(rePayload).equals(Buffer.from(payloadBytes))) {
    throw new Error('Non-canonical inner manifest CBOR');
  }

  const signingMsg = Buffer.concat([DOMAIN_PROOF, Buffer.from(payloadBytes)]);
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
    protocolVersion: ver,
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
    commercialUse: POLICIES[lic[1]] ?? 'unknown',
    redistribution: POLICIES[lic[2]] ?? 'unknown',
    aiTraining: POLICIES[lic[3]] ?? 'unknown',
    attributionName: lic[4] ?? null,
    authorName: authorName ?? null,
    artworkTitle: artworkTitle ?? null,
    integrityError,
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

function main() {
  const argv = process.argv.slice(2);
  let proofArg = null;
  let artworkArg = null;
  let noticeArg = null;
  let jsonOut = false;
  let positional = null;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') jsonOut = true;
    else if (a === '--proof' && i + 1 < argv.length) proofArg = argv[++i];
    else if (a === '--artwork' && i + 1 < argv.length) artworkArg = argv[++i];
    else if (a === '--notice' && i + 1 < argv.length) noticeArg = argv[++i];
    else if (a === '-h' || a === '--help') {
      console.log('Usage: chm-verify.mjs <signed.png> | --proof <url|token|.chproof.json> [--artwork <img.png>] | --notice <token|.chnotice.json> [--json]');
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
      console.error('Usage: chm-verify.mjs <signed.png> | --proof <url|token|.chproof.json> [--artwork <img.png>] [--json]');
      process.exit(2);
    }
    if (artworkArg && !raster) {
      if (!fs.existsSync(artworkArg)) {
        console.error(`Artwork file not found: ${artworkArg}`);
        process.exit(2);
      }
      raster = decodePngCanonical(new Uint8Array(fs.readFileSync(artworkArg)));
    }

    const res = verifyProofData(proofInput, raster);
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
      if (res.integrityError) {
        console.error(`Integrity Error: ${res.integrityError}`);
      }
    }
    process.exit(res.signatureValid && res.integrityStatus !== 'mismatched' ? 0 : 1);
  } catch (err) {
    console.error(`VERIFICATION FAILED: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();

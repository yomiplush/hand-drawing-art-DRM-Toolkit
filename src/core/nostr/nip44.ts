import { chacha20 } from '@noble/ciphers/chacha.js';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { expand as hkdfExpand, extract as hkdfExtract } from '@noble/hashes/hkdf.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { constantTimeEqual, hexToBytes } from '../crypto/sha256';
import { assertValidNostrPubkeyHex, assertValidNostrSecretKeyBytes } from './secp256k1';

const NIP44_VERSION = 2;
const NIP44_SALT = new TextEncoder().encode('nip44-v2');
const EXTENDED_PREFIX_THRESHOLD = 65536;
const MIN_PLAINTEXT_SIZE = 1;
const MAX_PLAINTEXT_SIZE_DEFAULT = 262_144; // 256 KiB conservative sync limit
const MIN_BASE64_PAYLOAD_LEN = 132;
const MIN_DECODED_PAYLOAD_LEN = 99;

function base64StdEncode(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(binary);
}

function base64StdDecode(input: string, maxDecodedBytes: number): Uint8Array {
  if (typeof input !== 'string' || input.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(input)) {
    throw new Error('Invalid NIP-44 base64 payload');
  }
  const approxBytes = Math.floor((input.length * 3) / 4);
  if (approxBytes > maxDecodedBytes + 4) {
    throw new Error(`NIP-44 payload exceeds maximum allowed size (${maxDecodedBytes} bytes)`);
  }
  const binary = atob(input);
  if (binary.length > maxDecodedBytes) {
    throw new Error(`NIP-44 decoded payload exceeds maximum allowed size (${maxDecodedBytes} bytes)`);
  }
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

/**
 * NIP-44 padding length calculation using safe 64-bit integer arithmetic.
 */
export function calcNip44PaddedLen(unpaddedLen: number): number {
  if (!Number.isInteger(unpaddedLen) || unpaddedLen < 1 || unpaddedLen > 0xffffffff) {
    throw new Error('Invalid plaintext length for NIP-44 padding');
  }
  if (unpaddedLen <= 32) return 32;
  let nextPower = 1;
  let v = unpaddedLen - 1;
  while (v > 0) {
    nextPower *= 2;
    v = Math.floor(v / 2);
  }
  const chunk = nextPower <= 256 ? 32 : Math.floor(nextPower / 8);
  return chunk * (Math.floor((unpaddedLen - 1) / chunk) + 1);
}

export function padNip44Plaintext(plaintext: string, maxPlaintextBytes = MAX_PLAINTEXT_SIZE_DEFAULT): Uint8Array {
  const unpadded = new TextEncoder().encode(plaintext);
  const len = unpadded.length;
  if (len < MIN_PLAINTEXT_SIZE || len > maxPlaintextBytes) {
    throw new Error(`NIP-44 plaintext length (${len}) out of allowed bounds [1, ${maxPlaintextBytes}]`);
  }
  const paddedLen = calcNip44PaddedLen(len);
  const prefixLen = len >= EXTENDED_PREFIX_THRESHOLD ? 6 : 2;
  const out = new Uint8Array(prefixLen + paddedLen);
  const view = new DataView(out.buffer);
  if (len >= EXTENDED_PREFIX_THRESHOLD) {
    view.setUint16(0, 0, false);
    view.setUint32(2, len, false);
  } else {
    view.setUint16(0, len, false);
  }
  out.set(unpadded, prefixLen);
  return out;
}

export function unpadNip44Plaintext(padded: Uint8Array, maxPlaintextBytes = MAX_PLAINTEXT_SIZE_DEFAULT): string {
  if (!(padded instanceof Uint8Array) || padded.length < 34) {
    throw new Error('Invalid NIP-44 padded plaintext buffer');
  }
  const view = new DataView(padded.buffer, padded.byteOffset, padded.byteLength);
  const firstTwo = view.getUint16(0, false);
  let unpaddedLen: number;
  let prefixLen: number;
  if (firstTwo === 0) {
    if (padded.length < 6 + 32) {
      throw new Error('Invalid NIP-44 extended prefix padding');
    }
    unpaddedLen = view.getUint32(2, false);
    if (unpaddedLen < EXTENDED_PREFIX_THRESHOLD) {
      throw new Error('Invalid NIP-44 extended length prefix (< 65536)');
    }
    prefixLen = 6;
  } else {
    unpaddedLen = firstTwo;
    prefixLen = 2;
  }

  if (unpaddedLen < 1 || unpaddedLen > maxPlaintextBytes) {
    throw new Error('Invalid NIP-44 unpadded plaintext length');
  }
  const expectedTotal = prefixLen + calcNip44PaddedLen(unpaddedLen);
  if (padded.length !== expectedTotal) {
    throw new Error('Invalid NIP-44 padding length');
  }

  // Verify padding bytes are strictly zero
  let nonZeroPad = 0;
  for (let i = prefixLen + unpaddedLen; i < padded.length; i++) {
    nonZeroPad |= padded[i];
  }
  if (nonZeroPad !== 0) {
    throw new Error('Invalid non-zero NIP-44 padding bytes');
  }

  const unpadded = padded.subarray(prefixLen, prefixLen + unpaddedLen);
  return new TextDecoder('utf-8', { fatal: true }).decode(unpadded);
}

/**
 * Computes NIP-44 v2 conversation key using unhashed secp256k1 ECDH x-coordinate
 * and HKDF-extract(SHA-256, IKM=shared_x, salt="nip44-v2").
 */
export function getNip44ConversationKey(privateKeyA: Uint8Array, publicKeyBHex: string): Uint8Array {
  assertValidNostrSecretKeyBytes(privateKeyA);
  const validPubHex = assertValidNostrPubkeyHex(publicKeyBHex);
  const compressedB = new Uint8Array(33);
  compressedB[0] = 0x02;
  compressedB.set(hexToBytes(validPubHex), 1);

  const sharedPoint = secp256k1.getSharedSecret(privateKeyA, compressedB, true);
  const sharedX = sharedPoint.subarray(1, 33);
  try {
    return hkdfExtract(sha256, sharedX, NIP44_SALT);
  } finally {
    sharedPoint.fill(0);
  }
}

export function getNip44MessageKeys(
  conversationKey: Uint8Array,
  nonce: Uint8Array,
): { chachaKey: Uint8Array; chachaNonce: Uint8Array; hmacKey: Uint8Array } {
  if (!(conversationKey instanceof Uint8Array) || conversationKey.length !== 32) {
    throw new Error('NIP-44 conversation_key must be 32 bytes');
  }
  if (!(nonce instanceof Uint8Array) || nonce.length !== 32) {
    throw new Error('NIP-44 nonce must be 32 bytes');
  }
  const okm = hkdfExpand(sha256, conversationKey, nonce, 76);
  return {
    chachaKey: okm.slice(0, 32),
    chachaNonce: okm.slice(32, 44),
    hmacKey: okm.slice(44, 76),
  };
}

function hmacAad(hmacKey: Uint8Array, ciphertext: Uint8Array, aadNonce: Uint8Array): Uint8Array {
  if (aadNonce.length !== 32) {
    throw new Error('NIP-44 AAD nonce must be 32 bytes');
  }
  const combined = new Uint8Array(aadNonce.length + ciphertext.length);
  combined.set(aadNonce, 0);
  combined.set(ciphertext, aadNonce.length);
  return hmac(sha256, hmacKey, combined);
}

export function encryptNip44(
  plaintext: string,
  conversationKey: Uint8Array,
  options?: { nonce?: Uint8Array; maxPlaintextBytes?: number },
): string {
  let nonce: Uint8Array;
  if (options?.nonce) {
    if (!(options.nonce instanceof Uint8Array) || options.nonce.length !== 32) {
      throw new Error('NIP-44 nonce must be 32 bytes');
    }
    nonce = options.nonce;
  } else {
    const generated = new Uint8Array(new ArrayBuffer(32));
    globalThis.crypto.getRandomValues(generated);
    nonce = generated;
  }

  const { chachaKey, chachaNonce, hmacKey } = getNip44MessageKeys(conversationKey, nonce);
  try {
    const padded = padNip44Plaintext(plaintext, options?.maxPlaintextBytes ?? MAX_PLAINTEXT_SIZE_DEFAULT);
    const ciphertext = chacha20(chachaKey, chachaNonce, padded);
    const mac = hmacAad(hmacKey, ciphertext, nonce);
    const out = new Uint8Array(1 + 32 + ciphertext.length + 32);
    out[0] = NIP44_VERSION;
    out.set(nonce, 1);
    out.set(ciphertext, 33);
    out.set(mac, 33 + ciphertext.length);
    return base64StdEncode(out);
  } finally {
    chachaKey.fill(0);
    chachaNonce.fill(0);
    hmacKey.fill(0);
  }
}

export function decryptNip44(
  payload: string,
  conversationKey: Uint8Array,
  options?: { maxPlaintextBytes?: number },
): string {
  if (typeof payload !== 'string' || payload.length === 0 || payload[0] === '#') {
    throw new Error('Unsupported NIP-44 encryption version');
  }
  if (payload.length < MIN_BASE64_PAYLOAD_LEN) {
    throw new Error('Invalid NIP-44 payload length');
  }
  const maxPlaintext = options?.maxPlaintextBytes ?? MAX_PLAINTEXT_SIZE_DEFAULT;
  const maxDecodedBytes = 65 + 6 + calcNip44PaddedLen(maxPlaintext);
  const data = base64StdDecode(payload, maxDecodedBytes);
  if (data.length < MIN_DECODED_PAYLOAD_LEN) {
    throw new Error('Invalid NIP-44 decoded data size');
  }
  const version = data[0];
  if (version !== NIP44_VERSION) {
    throw new Error(`Unsupported NIP-44 version: ${version}`);
  }
  const nonce = data.subarray(1, 33);
  const ciphertext = data.subarray(33, data.length - 32);
  const mac = data.subarray(data.length - 32);

  const { chachaKey, chachaNonce, hmacKey } = getNip44MessageKeys(conversationKey, nonce);
  try {
    const calculatedMac = hmacAad(hmacKey, ciphertext, nonce);
    if (!constantTimeEqual(calculatedMac, mac)) {
      throw new Error('Invalid NIP-44 MAC authentication tag');
    }
    const paddedPlaintext = chacha20(chachaKey, chachaNonce, ciphertext);
    return unpadNip44Plaintext(paddedPlaintext, maxPlaintext);
  } finally {
    chachaKey.fill(0);
    chachaNonce.fill(0);
    hmacKey.fill(0);
  }
}

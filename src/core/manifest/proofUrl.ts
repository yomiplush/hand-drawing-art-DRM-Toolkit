import { base64UrlDecode, base64UrlEncode } from '../crypto/sha256';
import { base45Decode, base45Encode } from '../encoding/base45';
import { parsePortableProofBundle } from './proofBundle';
import { DEFAULT_VERIFY_BASE_URL, MAX_PROOF_BYTES } from './types';

export const COMPACT_VERIFY_BASE_URL = 'HTTPS://CERTIFIED-HANDMADE.COM/V';

const MAX_PROOF_TOKEN_CHARS = Math.ceil((MAX_PROOF_BYTES * 4) / 3) + 16;
const MAX_PROOF_INPUT_CHARS = 32_768;

export function sanitizeVerifyBaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return DEFAULT_VERIFY_BASE_URL;
  }
  if (trimmed.length > 2048) {
    throw new Error('Verification base URL exceeds maximum length');
  }
  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('//')) {
      throw new Error('Verification base URL must not be a protocol-relative URL');
    }
    return trimmed.split('#')[0].split('?')[0];
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Verification base URL must be a valid URL');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Verification base URL must not contain userinfo credentials');
  }
  const isLocalHttp =
    parsed.protocol === 'http:' &&
    (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
  if (parsed.protocol !== 'https:' && !isLocalHttp) {
    throw new Error('Verification base URL must use https:// (or localhost http://)');
  }
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

export function buildProofUrl(proofBytes: Uint8Array, baseUrl = DEFAULT_VERIFY_BASE_URL): string {
  const cleanBase = sanitizeVerifyBaseUrl(baseUrl);
  const token = base64UrlEncode(proofBytes);
  return `${cleanBase}#proof=${token}`;
}

/**
 * Builds an ultra-compact QR Alphanumeric-optimized verification URL using
 * `/V#45:<BASE45>` so smartphone cameras resolve smaller QR codes much faster.
 */
export function buildCompactBase45ProofUrl(
  proofBytes: Uint8Array,
  baseUrl = COMPACT_VERIFY_BASE_URL,
): string {
  const cleanBase = baseUrl.trim().replace(/\/$/, '').toUpperCase();
  const token = base45Encode(proofBytes);
  return `${cleanBase}#45:${token}`;
}

export function extractProofBytesFromInput(rawInput: string): Uint8Array {
  if (typeof rawInput !== 'string') {
    throw new Error('Proof input must be a string');
  }
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new Error('Proof input is empty');
  }
  if (trimmed.length > MAX_PROOF_INPUT_CHARS) {
    throw new Error('Proof input exceeds maximum allowed character length');
  }

  // Case 0: Portable Proof Bundle JSON (.chproof.json)
  if (trimmed.startsWith('{')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error('Malformed JSON proof bundle');
    }
    return parsePortableProofBundle(parsed).proofBytes;
  }

  let token: string | null;

  // Case 1: URL containing #45:<BASE45> (compact QR Alphanumeric mode) or #proof=...
  if (trimmed.includes('#')) {
    const hashIdx = trimmed.indexOf('#');
    const fragment = trimmed.slice(hashIdx + 1);
    if (fragment.startsWith('45:') || fragment.startsWith('45%3A') || fragment.startsWith('45%3a')) {
      const b45Payload = fragment.startsWith('45:') ? fragment.slice(3) : fragment.slice(5);
      const bytes = base45Decode(b45Payload);
      if (bytes.byteLength === 0 || bytes.byteLength > MAX_PROOF_BYTES) {
        throw new Error('Proof payload is empty or exceeds maximum byte length');
      }
      return bytes;
    }
    const params = new URLSearchParams(fragment);
    token = params.get('proof');
    if (!token) {
      throw new Error('URL fragment does not contain a "proof" parameter');
    }
  } else if (trimmed.startsWith('45:')) {
    const bytes = base45Decode(trimmed.slice(3));
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_PROOF_BYTES) {
      throw new Error('Proof payload is empty or exceeds maximum byte length');
    }
    return bytes;
  } else if (trimmed.includes('?proof=')) {
    const qIdx = trimmed.indexOf('?');
    const query = trimmed.slice(qIdx + 1);
    const params = new URLSearchParams(query);
    token = params.get('proof');
    if (!token) {
      throw new Error('URL query does not contain a "proof" parameter');
    }
  } else if (trimmed.includes('%23proof%3D') || trimmed.includes('%23proof=')) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(trimmed);
    } catch {
      throw new Error('Malformed percent-encoded verification URL');
    }
    const hashIdx = decoded.indexOf('#');
    const fragment = hashIdx >= 0 ? decoded.slice(hashIdx + 1) : decoded;
    const params = new URLSearchParams(fragment);
    token = params.get('proof');
    if (!token) {
      throw new Error('URL fragment does not contain a "proof" parameter');
    }
  } else if (trimmed.startsWith('proof=')) {
    const params = new URLSearchParams(trimmed);
    token = params.get('proof');
  } else if (/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    // Case 3: Direct base64url proof token
    token = trimmed;
  } else {
    throw new Error('Input is neither a Certified Handmade verification URL nor a proof token');
  }

  if (!token || token.length > MAX_PROOF_TOKEN_CHARS) {
    throw new Error('Proof token is empty or exceeds maximum length');
  }
  if (!/^[A-Za-z0-9_-]+$/.test(token)) {
    throw new Error('Proof token contains disallowed characters');
  }

  return base64UrlDecode(token);
}

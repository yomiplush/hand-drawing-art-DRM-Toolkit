import { base64UrlDecode, base64UrlEncode } from '../crypto/sha256';
import { DEFAULT_VERIFY_BASE_URL, MAX_PROOF_BYTES } from './types';

const MAX_PROOF_TOKEN_CHARS = Math.ceil((MAX_PROOF_BYTES * 4) / 3) + 16;

export function sanitizeVerifyBaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return DEFAULT_VERIFY_BASE_URL;
  }
  if (trimmed.startsWith('/')) {
    return trimmed.split('#')[0].split('?')[0];
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Verification base URL must be a valid URL');
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

export function extractProofBytesFromInput(rawInput: string): Uint8Array {
  if (typeof rawInput !== 'string') {
    throw new Error('Proof input must be a string');
  }
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new Error('Proof input is empty');
  }

  let token: string | null;

  // Case 1: URL containing #proof=...
  if (trimmed.includes('#')) {
    const hashIdx = trimmed.indexOf('#');
    const fragment = trimmed.slice(hashIdx + 1);
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

import { sha256 as nobleSha256 } from '@noble/hashes/sha2.js';

export const DEFAULT_STREAM_CHUNK_BYTES = 2 * 1024 * 1024;
export const MAX_EVIDENCE_FILE_BYTES = 512 * 1024 * 1024;

export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    try {
      const copy = new Uint8Array(data.byteLength);
      copy.set(data);
      const digest = await globalThis.crypto.subtle.digest('SHA-256', copy.buffer);
      return new Uint8Array(digest);
    } catch {
      // Fallback to audited pure-JS SHA-256 if subtle fails in restricted context
    }
  }
  return nobleSha256(data);
}

export function sha256Sync(data: Uint8Array): Uint8Array {
  return nobleSha256(data);
}

export async function sha256Streamed(
  input: Blob | Uint8Array,
  options?: {
    chunkSize?: number;
    maxBytes?: number;
    signal?: AbortSignal;
    onProgress?: (processedBytes: number, totalBytes: number) => void;
  },
): Promise<{ digest: Uint8Array; hex: string; byteLength: number }> {
  const chunkSize = Math.max(64 * 1024, options?.chunkSize ?? DEFAULT_STREAM_CHUNK_BYTES);
  const maxBytes = options?.maxBytes ?? MAX_EVIDENCE_FILE_BYTES;
  const bytesView =
    input instanceof Uint8Array
      ? input
      : ArrayBuffer.isView(input)
        ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
        : null;
  const totalBytes = bytesView ? bytesView.byteLength : (input as Blob).size;

  if (!Number.isSafeInteger(totalBytes) || totalBytes < 0) {
    throw new Error('Invalid file size');
  }
  if (totalBytes > maxBytes) {
    throw new Error(`File size (${totalBytes} bytes) exceeds maximum allowed (${maxBytes} bytes)`);
  }

  const hasher = nobleSha256.create();
  if (totalBytes === 0) {
    options?.onProgress?.(0, 0);
    const digest = hasher.digest();
    return { digest, hex: bytesToHex(digest), byteLength: 0 };
  }

  const blob = bytesView ? null : (input as Blob);
  for (let offset = 0; offset < totalBytes; offset += chunkSize) {
    if (options?.signal?.aborted) {
      throw new Error('File hashing aborted');
    }
    const end = Math.min(offset + chunkSize, totalBytes);
    const chunk = bytesView
      ? bytesView.subarray(offset, end)
      : new Uint8Array(await blob!.slice(offset, end).arrayBuffer());
    hasher.update(chunk);
    options?.onProgress?.(end, totalBytes);
    if (end < totalBytes) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  const digest = hasher.digest();
  return {
    digest,
    hex: bytesToHex(digest),
    byteLength: totalBytes,
  };
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase();
  if (clean.length % 2 !== 0 || !/^[0-9a-f]*$/.test(clean)) {
    throw new Error('Invalid hex string');
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  return bytesToHex(await sha256(data));
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64UrlDecode(input: string): Uint8Array {
  if (typeof input !== 'string' || input.length === 0) {
    throw new Error('Empty base64url input');
  }
  if (!/^[A-Za-z0-9_-]+$/.test(input)) {
    throw new Error('Invalid base64url characters');
  }
  if (input.length % 4 === 1) {
    throw new Error('Invalid base64url length');
  }
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (input.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  // Reject non-canonical trailing padding bits by verifying round-trip
  if (base64UrlEncode(out) !== input) {
    throw new Error('Non-canonical base64url encoding');
  }
  return out;
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

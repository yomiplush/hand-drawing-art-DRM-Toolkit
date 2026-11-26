import type {
  DecryptedVaultSession,
  EncryptedVaultManifest,
  EncryptedVaultManifestEntry,
  GalleryArtworkItem,
} from '../../types/gallerydeck';
import {
  GALLERY_DECK_MANIFEST_ENC_FILENAME,
} from '../../types/gallerydeck';

/**
 * Zero-knowledge client-side encryption engine using Web Crypto API exclusively.
 * - KDF: PBKDF2 (SHA-256, >= 150,000 iterations, random 16-byte salt)
 * - Cipher: AES-GCM (256-bit, random 12-byte IV)
 * - Binary chunk header ("GDE1"):
 *     [0..3]   Magic "GDE1"
 *     [4]      Version (1)
 *     [5..8]   PBKDF2 iterations (uint32 big-endian)
 *     [9..24]  Salt (16 bytes)
 *     [25..36] IV (12 bytes)
 *     [37..]   AES-GCM ciphertext + 16-byte auth tag
 */

export const CRYPTO_MAGIC = new Uint8Array([0x47, 0x44, 0x45, 0x31]); // "GDE1"
export const CRYPTO_VERSION = 1;
export const DEFAULT_PBKDF2_ITERATIONS = 150_000;
export const MIN_PBKDF2_ITERATIONS = 100_000;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;
export const HEADER_BYTES = 4 + 1 + 4 + SALT_BYTES + IV_BYTES; // 37 bytes

/**
 * Single-file offset-indexed vault container ("GDV1") for iOS Safari / Android
 * where showDirectoryPicker is unavailable. Supports File.slice() on-demand
 * chunk decryption without loading the entire archive into memory.
 *
 * Layout:
 *   [0..3]   Magic "GDV1"
 *   [4..7]   Header JSON byte length (uint32 big-endian)
 *   [8..8+L] UTF-8 JSON index: { entries: { [filename]: { offset, length } } }
 *            where offsets are relative to the start of the payload section (8 + L).
 *   [8+L..]  Concatenated encrypted chunks (manifest.enc, thumb_*.enc, img_*.enc)
 */
export const VAULT_CONTAINER_MAGIC = new Uint8Array([0x47, 0x44, 0x56, 0x31]); // "GDV1"

export interface VaultContainerIndex {
  version: 1;
  entries: Record<string, { offset: number; length: number }>;
}

export interface EncryptedChunkFile {
  name: string;
  data: Uint8Array;
}

function getSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto API (crypto.subtle) is not available in this context. Use HTTPS or localhost.');
  }
  return subtle;
}

export async function deriveAesKey(
  passphrase: string,
  salt: Uint8Array,
  iterations = DEFAULT_PBKDF2_ITERATIONS,
  usages: KeyUsage[] = ['encrypt', 'decrypt'],
): Promise<CryptoKey> {
  if (!passphrase || passphrase.length === 0) {
    throw new Error('Passphrase must not be empty.');
  }
  const safeIterations = Math.max(iterations, MIN_PBKDF2_ITERATIONS);
  const subtle = getSubtle();
  const enc = new TextEncoder();
  const baseKey = await subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.slice(),
      iterations: safeIterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    usages,
  );
}

export async function encryptBytes(
  plaintext: Uint8Array,
  passphrase: string,
  iterations = DEFAULT_PBKDF2_ITERATIONS,
): Promise<Uint8Array> {
  const safeIterations = Math.max(iterations, MIN_PBKDF2_ITERATIONS);
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveAesKey(passphrase, salt, safeIterations, ['encrypt']);
  const subtle = getSubtle();
  const cipherBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv: iv.slice() },
    key,
    plaintext.slice(),
  );
  const cipherBytes = new Uint8Array(cipherBuffer);

  const out = new Uint8Array(HEADER_BYTES + cipherBytes.byteLength);
  out.set(CRYPTO_MAGIC, 0);
  out[4] = CRYPTO_VERSION;
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  view.setUint32(5, safeIterations, false);
  out.set(salt, 9);
  out.set(iv, 9 + SALT_BYTES);
  out.set(cipherBytes, HEADER_BYTES);
  return out;
}

export async function decryptBytes(
  encrypted: Uint8Array,
  passphrase: string,
): Promise<Uint8Array> {
  if (encrypted.byteLength <= HEADER_BYTES) {
    throw new Error('Encrypted payload is too short or corrupted.');
  }
  for (let i = 0; i < 4; i++) {
    if (encrypted[i] !== CRYPTO_MAGIC[i]) {
      throw new Error('Invalid encrypted chunk header.');
    }
  }
  const version = encrypted[4];
  if (version !== CRYPTO_VERSION) {
    throw new Error(`Unsupported encryption version: ${version}`);
  }
  const view = new DataView(encrypted.buffer, encrypted.byteOffset, encrypted.byteLength);
  const iterations = view.getUint32(5, false);
  if (iterations < MIN_PBKDF2_ITERATIONS) {
    throw new Error(`PBKDF2 iteration count too low: ${iterations}`);
  }
  const salt = encrypted.slice(9, 9 + SALT_BYTES);
  const iv = encrypted.slice(9 + SALT_BYTES, HEADER_BYTES);
  const ciphertext = encrypted.slice(HEADER_BYTES);

  const key = await deriveAesKey(passphrase, salt, iterations, ['decrypt']);
  const subtle = getSubtle();
  try {
    const plainBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext,
    );
    return new Uint8Array(plainBuffer);
  } catch {
    throw new Error('Decryption failed. Incorrect passphrase or corrupted data.');
  }
}

export async function encryptJson(
  value: unknown,
  passphrase: string,
  iterations = DEFAULT_PBKDF2_ITERATIONS,
): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return encryptBytes(bytes, passphrase, iterations);
}

export async function decryptJson<T>(
  encrypted: Uint8Array,
  passphrase: string,
): Promise<T> {
  const plain = await decryptBytes(encrypted, passphrase);
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

/**
 * Generates a lightweight JPEG/WebP thumbnail byte array from an image Blob or data URL.
 * Falls back cleanly in non-DOM/test environments.
 */
export async function generateCompactThumbnailBytes(
  sourceBytes: Uint8Array,
  mimeType: string,
  fallbackDataUrl?: string,
  maxDimension = 420,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  if (fallbackDataUrl && fallbackDataUrl.startsWith('data:')) {
    const commaIdx = fallbackDataUrl.indexOf(',');
    if (commaIdx > 0) {
      const header = fallbackDataUrl.slice(5, commaIdx);
      const thumbMime = header.split(';')[0] || 'image/jpeg';
      const base64 = fallbackDataUrl.slice(commaIdx + 1);
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return { bytes, mimeType: thumbMime };
    }
  }

  if (typeof document !== 'undefined' && typeof createImageBitmap === 'function') {
    try {
      const blob = new Blob([sourceBytes.slice()], { type: mimeType || 'image/png' });
      const bitmap = await createImageBitmap(blob);
      const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height, 1));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, w, h);
        bitmap.close();
        const thumbBlob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.78),
        );
        if (thumbBlob) {
          return {
            bytes: new Uint8Array(await thumbBlob.arrayBuffer()),
            mimeType: 'image/jpeg',
          };
        }
      }
      bitmap.close();
    } catch {
      // Fall back to original bytes below
    }
  }

  return { bytes: sourceBytes, mimeType: mimeType || 'image/png' };
}

export interface VaultBuildInputItem {
  item: GalleryArtworkItem;
  fullBytes: Uint8Array;
  fullMimeType: string;
}

export interface BuiltEncryptedVault {
  manifest: EncryptedVaultManifest;
  chunks: EncryptedChunkFile[];
}

/**
 * Encrypts a set of gallery artworks into chunked zero-knowledge files:
 *   - manifest.enc
 *   - thumb_<id>.enc
 *   - img_<id>.enc
 */
export async function buildEncryptedVaultChunks(params: {
  vaultName: string;
  items: VaultBuildInputItem[];
  passphrase: string;
  iterations?: number;
  onProgress?: (done: number, total: number) => void;
}): Promise<BuiltEncryptedVault> {
  const { vaultName, items, passphrase, iterations = DEFAULT_PBKDF2_ITERATIONS, onProgress } = params;
  const manifestEntries: EncryptedVaultManifestEntry[] = [];
  const chunks: EncryptedChunkFile[] = [];
  const folderSet = new Set<string>();

  const total = items.length + 1;
  let completed = 0;

  for (const { item, fullBytes, fullMimeType } of items) {
    const safeId = item.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const thumbFile = `thumb_${safeId}.enc`;
    const imgFile = `img_${safeId}.enc`;
    const folder = item.collections[0] || 'Default';
    folderSet.add(folder);

    const thumb = await generateCompactThumbnailBytes(
      fullBytes,
      fullMimeType,
      item.thumbnailDataUrl || undefined,
    );

    const [encThumb, encImg] = await Promise.all([
      encryptBytes(thumb.bytes, passphrase, iterations),
      encryptBytes(fullBytes, passphrase, iterations),
    ]);

    chunks.push({ name: thumbFile, data: encThumb });
    chunks.push({ name: imgFile, data: encImg });

    manifestEntries.push({
      id: item.id,
      title: item.title || item.localFileName || item.id,
      folder,
      authorName: item.authorName,
      width: item.width,
      height: item.height,
      mimeType: fullMimeType || item.mimeType || 'image/png',
      fileSizeBytes: fullBytes.byteLength,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      tags: item.tags,
      collections: item.collections,
      thumbFile,
      imgFile,
      provenanceStatus: item.provenanceStatus,
      licenseId: item.licenseId,
      publicKeyFingerprint: item.publicKeyFingerprint,
    });

    completed += 1;
    onProgress?.(completed, total);
  }

  const manifest: EncryptedVaultManifest = {
    version: 1,
    createdAt: Date.now(),
    vaultName: vaultName.trim() || 'GalleryDeck Vault',
    folders: Array.from(folderSet),
    items: manifestEntries,
  };

  const encManifest = await encryptJson(manifest, passphrase, iterations);
  chunks.unshift({ name: GALLERY_DECK_MANIFEST_ENC_FILENAME, data: encManifest });
  onProgress?.(total, total);

  return { manifest, chunks };
}

/**
 * Packs encrypted chunks into a single offset-indexed `.gdvault` Blob
 * so mobile browsers (iOS Safari / Android) can decrypt individual chunks via File.slice().
 */
export function packChunksToVaultBlob(chunks: EncryptedChunkFile[]): Blob {
  const entries: Record<string, { offset: number; length: number }> = {};
  let cursor = 0;
  for (const chunk of chunks) {
    entries[chunk.name] = { offset: cursor, length: chunk.data.byteLength };
    cursor += chunk.data.byteLength;
  }

  const indexObj: VaultContainerIndex = { version: 1, entries };
  const indexBytes = new TextEncoder().encode(JSON.stringify(indexObj));
  const header = new Uint8Array(8 + indexBytes.byteLength);
  header.set(VAULT_CONTAINER_MAGIC, 0);
  new DataView(header.buffer).setUint32(4, indexBytes.byteLength, false);
  header.set(indexBytes, 8);

  const parts: BlobPart[] = [header.slice()];
  for (const chunk of chunks) {
    parts.push(chunk.data.slice());
  }
  return new Blob(parts, { type: 'application/octet-stream' });
}

/**
 * Reads only the small header & index of a `.gdvault` File/Blob using File.slice().
 */
export async function readVaultContainerIndex(
  file: Blob,
): Promise<{ index: VaultContainerIndex; payloadOffset: number }> {
  const prefixBuf = await file.slice(0, 8).arrayBuffer();
  const prefix = new Uint8Array(prefixBuf);
  if (prefix.byteLength < 8) {
    throw new Error('Invalid .gdvault file (too short).');
  }
  for (let i = 0; i < 4; i++) {
    if (prefix[i] !== VAULT_CONTAINER_MAGIC[i]) {
      throw new Error('Invalid .gdvault file signature.');
    }
  }
  const indexLen = new DataView(prefix.buffer).getUint32(4, false);
  const indexBuf = await file.slice(8, 8 + indexLen).arrayBuffer();
  const index = JSON.parse(new TextDecoder().decode(indexBuf)) as VaultContainerIndex;
  return { index, payloadOffset: 8 + indexLen };
}

/**
 * Opens an encrypted vault from either:
 *   - a single `.gdvault` File/Blob (using File.slice() for OOM-safe on-demand decryption), OR
 *   - a list of `.enc` files (manifest.enc, thumb_*.enc, img_*.enc) selected via <input type="file" multiple> or showDirectoryPicker.
 *
 * Only `manifest.enc` and `thumb_*.enc` are decrypted upfront.
 * Full-resolution `img_*.enc` chunks are decrypted on-demand one at a time via `session.decryptFullImage(itemId)`.
 */
export async function openEncryptedVaultSession(params: {
  files: File[] | FileList;
  passphrase: string;
}): Promise<DecryptedVaultSession> {
  const fileArray = Array.from(params.files);
  if (fileArray.length === 0) {
    throw new Error('No encrypted vault files selected.');
  }

  const singleVaultFile = fileArray.find((f) => f.name.toLowerCase().endsWith('.gdvault'));

  let readChunk: (name: string) => Promise<Uint8Array | null>;

  if (singleVaultFile) {
    const { index, payloadOffset } = await readVaultContainerIndex(singleVaultFile);
    readChunk = async (name: string) => {
      const entry = index.entries[name];
      if (!entry) return null;
      const slice = singleVaultFile.slice(
        payloadOffset + entry.offset,
        payloadOffset + entry.offset + entry.length,
      );
      return new Uint8Array(await slice.arrayBuffer());
    };
  } else {
    const byName = new Map<string, File>();
    for (const f of fileArray) {
      const base = f.name.split('/').pop() || f.name;
      byName.set(base, f);
    }
    readChunk = async (name: string) => {
      const f = byName.get(name);
      if (!f) return null;
      return new Uint8Array(await f.arrayBuffer());
    };
  }

  const manifestEnc = await readChunk(GALLERY_DECK_MANIFEST_ENC_FILENAME);
  if (!manifestEnc) {
    throw new Error(`Missing ${GALLERY_DECK_MANIFEST_ENC_FILENAME} in selected files.`);
  }

  const manifest = await decryptJson<EncryptedVaultManifest>(manifestEnc, params.passphrase);
  const thumbnailUrls: Record<string, string> = {};
  const thumbnailBlobs: Record<string, Blob> = {};
  const createdUrls: string[] = [];

  // Decrypt lightweight thumbnails only (never full images upfront)
  for (const entry of manifest.items) {
    const thumbEnc = await readChunk(entry.thumbFile);
    if (!thumbEnc) continue;
    try {
      const thumbPlain = await decryptBytes(thumbEnc, params.passphrase);
      const blob = new Blob([thumbPlain.slice()], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      thumbnailUrls[entry.id] = url;
      thumbnailBlobs[entry.id] = blob;
      createdUrls.push(url);
    } catch {
      // Skip individual corrupted thumbnail
    }
  }

  const decryptFullImage = async (
    itemId: string,
  ): Promise<{ blobUrl: string; mimeType: string; bytes: Uint8Array }> => {
    const entry = manifest.items.find((i) => i.id === itemId);
    if (!entry) {
      throw new Error('Artwork entry not found in manifest.');
    }
    const imgEnc = await readChunk(entry.imgFile);
    if (!imgEnc) {
      throw new Error(`Missing encrypted image chunk: ${entry.imgFile}`);
    }
    const plain = await decryptBytes(imgEnc, params.passphrase);
    const mimeType = entry.mimeType || 'image/png';
    const blobUrl = URL.createObjectURL(new Blob([plain.slice()], { type: mimeType }));
    return { blobUrl, mimeType, bytes: plain };
  };

  const dispose = () => {
    for (const url of createdUrls) {
      URL.revokeObjectURL(url);
    }
    createdUrls.length = 0;
  };

  return {
    manifest,
    decryptFullImage,
    dispose,
    thumbnailUrls,
    thumbnailBlobs,
  };
}

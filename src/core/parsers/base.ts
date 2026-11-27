import { sha256 as nobleSha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '../crypto/sha256';
import type { LayerMetrics, MergeMethod, NativeProjectFormat } from '../manifest/proofV2';

export interface ProjectLayerSummary {
  name: string;
  visible: boolean;
  opacity: number;
  blendMode: string;
  width?: number;
  height?: number;
}

export interface ProjectInspectionResult {
  format: NativeProjectFormat;
  softwareSignature: string;
  mergeMethod: MergeMethod;
  magicNumberValid: boolean;
  layerMetrics: LayerMetrics;
  layers: ProjectLayerSummary[];
  timelapseDetected: boolean;
  fileSizeBytes: number;
  sourceProjectSha256: string;
}

export interface ProjectMergeResult {
  inspection: ProjectInspectionResult;
  mergedPngBytes: Uint8Array;
  mergedImageSha256: string;
  width: number;
  height: number;
}

export interface ProjectFileInput {
  name: string;
  size: number;
  slice(start?: number, end?: number): Blob;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface StreamingHashProgress {
  bytesProcessed: number;
  totalBytes: number;
  percent: number;
}

export class ProjectParseError extends Error {
  readonly code: string;
  readonly messageJa: string;

  constructor(code: string, messageEn: string, messageJa: string) {
    super(messageEn);
    this.name = 'ProjectParseError';
    this.code = code;
    this.messageJa = messageJa;
  }
}

export interface BaseProjectParser {
  readonly id: string;
  readonly supportedExtensions: readonly string[];
  readonly supportedFormats: readonly NativeProjectFormat[];
  readonly mergeMethod: MergeMethod;

  canParse(fileName: string, headerBytes: Uint8Array): boolean;

  inspect(
    file: ProjectFileInput,
    options?: {
      onHashProgress?: (progress: StreamingHashProgress) => void;
    },
  ): Promise<ProjectInspectionResult>;

  mergeToPng(
    file: ProjectFileInput,
    inspection: ProjectInspectionResult,
  ): Promise<ProjectMergeResult>;
}

export const STREAM_CHUNK_BYTES = 2 * 1024 * 1024; // 2 MiB chunks

/**
 * Computes SHA-256 of a potentially multi-gigabyte file using File.slice() streaming
 * without loading the entire file into browser memory.
 */
export async function computeStreamingSha256(
  file: ProjectFileInput,
  onProgress?: (progress: StreamingHashProgress) => void,
): Promise<string> {
  const hasher = nobleSha256.create();
  const totalBytes = file.size;
  let offset = 0;

  while (offset < totalBytes) {
    const end = Math.min(offset + STREAM_CHUNK_BYTES, totalBytes);
    const chunkBlob = file.slice(offset, end);
    const chunkBuf = await chunkBlob.arrayBuffer();
    hasher.update(new Uint8Array(chunkBuf));
    offset = end;
    onProgress?.({
      bytesProcessed: offset,
      totalBytes,
      percent: totalBytes > 0 ? Math.round((offset / totalBytes) * 100) : 100,
    });
  }

  return bytesToHex(hasher.digest());
}

export function hasBytesAt(haystack: Uint8Array, offset: number, needle: number[]): boolean {
  if (offset < 0 || offset + needle.length > haystack.byteLength) return false;
  for (let i = 0; i < needle.length; i++) {
    if (haystack[offset + i] !== needle[i]) return false;
  }
  return true;
}

export function indexOfAscii(
  haystack: Uint8Array,
  ascii: string,
  maxSearchBytes?: number,
): number {
  const limit = Math.min(haystack.byteLength, maxSearchBytes ?? haystack.byteLength);
  const needleLen = ascii.length;
  if (needleLen === 0 || limit < needleLen) return -1;
  const first = ascii.charCodeAt(0);
  for (let i = 0; i <= limit - needleLen; i++) {
    if (haystack[i] !== first) continue;
    let match = true;
    for (let j = 1; j < needleLen; j++) {
      if (haystack[i + j] !== ascii.charCodeAt(j)) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

export function countAsciiOccurrences(
  haystack: Uint8Array,
  ascii: string,
  maxSearchBytes?: number,
): number {
  const limit = Math.min(haystack.byteLength, maxSearchBytes ?? haystack.byteLength);
  const needleLen = ascii.length;
  if (needleLen === 0 || limit < needleLen) return 0;
  let count = 0;
  let pos = 0;
  while (pos <= limit - needleLen) {
    const idx = indexOfAscii(haystack.subarray(pos, limit), ascii);
    if (idx === -1) break;
    count += 1;
    pos += idx + needleLen;
  }
  return count;
}

/**
 * Detects standalone flat raster images (PNG, JPEG, WebP, GIF, BMP, AVIF/HEIC)
 * regardless of file extension.
 */
export function isStandaloneRasterImage(bytes: Uint8Array): boolean {
  if (hasBytesAt(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return true; // PNG
  if (hasBytesAt(bytes, 0, [0xff, 0xd8, 0xff])) return true; // JPEG
  if (
    hasBytesAt(bytes, 0, [0x52, 0x49, 0x46, 0x46]) &&
    hasBytesAt(bytes, 8, [0x57, 0x45, 0x42, 0x50])
  ) {
    return true; // WebP
  }
  if (hasBytesAt(bytes, 0, [0x47, 0x49, 0x46, 0x38])) return true; // GIF
  if (hasBytesAt(bytes, 0, [0x42, 0x4d])) return true; // BMP
  return false;
}

export function extractEmbeddedPng(bytes: Uint8Array): Uint8Array | null {
  const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const iendSig = [0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];

  let start = -1;
  for (let i = 0; i <= bytes.byteLength - pngSig.length; i++) {
    if (hasBytesAt(bytes, i, pngSig)) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;

  for (let i = start + 8; i <= bytes.byteLength - iendSig.length; i++) {
    if (hasBytesAt(bytes, i, iendSig)) {
      return bytes.slice(start, i + iendSig.length);
    }
  }
  return null;
}

async function inflateRawBytes(compressed: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream is not available in this runtime.');
  }
  const stream = new Blob([compressed.buffer as ArrayBuffer])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Extracts a named entry from a ZIP archive (.procreate, .kra, .ora) using the
 * Central Directory so both Stored (0) and Deflate (8) entries work reliably
 * even when local headers use data descriptors.
 */
export async function extractZipEntryByMatcher(
  zipBytes: Uint8Array,
  matcher: (entryName: string) => boolean,
): Promise<Uint8Array | null> {
  const view = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);
  const decoder = new TextDecoder('utf-8');

  // Locate End of Central Directory (PK\x05\x06) scanning backwards from end
  const minEocd = Math.max(0, zipBytes.byteLength - 65557);
  let eocdOffset = -1;
  for (let i = zipBytes.byteLength - 22; i >= minEocd; i--) {
    if (
      zipBytes[i] === 0x50 &&
      zipBytes[i + 1] === 0x4b &&
      zipBytes[i + 2] === 0x05 &&
      zipBytes[i + 3] === 0x06
    ) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) return null;

  const cdEntries = view.getUint16(eocdOffset + 10, true);
  let cdOffset = view.getUint32(eocdOffset + 16, true);

  for (let i = 0; i < cdEntries; i++) {
    if (cdOffset + 46 > zipBytes.byteLength) break;
    if (
      zipBytes[cdOffset] !== 0x50 ||
      zipBytes[cdOffset + 1] !== 0x4b ||
      zipBytes[cdOffset + 2] !== 0x01 ||
      zipBytes[cdOffset + 3] !== 0x02
    ) {
      break;
    }

    const compressionMethod = view.getUint16(cdOffset + 10, true);
    const compressedSize = view.getUint32(cdOffset + 20, true);
    const nameLen = view.getUint16(cdOffset + 28, true);
    const extraLen = view.getUint16(cdOffset + 30, true);
    const commentLen = view.getUint16(cdOffset + 32, true);
    const localHeaderOffset = view.getUint32(cdOffset + 42, true);

    const name = decoder.decode(zipBytes.subarray(cdOffset + 46, cdOffset + 46 + nameLen));
    cdOffset += 46 + nameLen + extraLen + commentLen;

    if (!matcher(name)) continue;

    if (localHeaderOffset + 30 > zipBytes.byteLength) continue;
    const localNameLen = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > zipBytes.byteLength) continue;

    const rawData = zipBytes.slice(dataStart, dataEnd);
    if (compressionMethod === 0) {
      return rawData;
    }
    if (compressionMethod === 8) {
      return inflateRawBytes(rawData);
    }
  }

  return null;
}

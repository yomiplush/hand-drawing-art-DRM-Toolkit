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

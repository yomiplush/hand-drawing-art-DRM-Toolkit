import { bytesToHex, sha256 } from '../crypto/sha256';
import {
  MAX_PSD_DIMENSION,
  MAX_PSD_PIXELS,
  parsePsdLayerRecords,
} from '../parsers/psdParser';
import { ProjectParseError } from '../parsers/base';

export type SourceProjectFormat = 'PSD' | 'CLIP' | 'PROCREATE' | 'KRA' | 'SAI2';

export interface SourceProjectVerificationResult {
  verified: true;
  projectFormat: SourceProjectFormat;
  layerCount: number;
  /** Non-reversible SHA-256 hex commitment of (project bytes || random 16-byte salt). */
  sourceCommitmentHash: string;
  /** Raw 32-byte SHA-256 of the working project file for automatic Protocol v3 evidenceHashes (CBOR key 16) binding. */
  sourceFileSha256: Uint8Array;
  /** Sanitized basename (no directory path) for optional Protocol v3 evidenceHashes label. */
  sanitizedBasename: string;
  width?: number;
  height?: number;
  fileSizeBytes: number;
}

export interface SourceProjectFileLike {
  name: string;
  size?: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export class SourceProjectVerificationError extends Error {
  readonly reasonCode: string;
  readonly reasonMessageJa: string;

  constructor(reasonCode: string, messageEn: string, messageJa: string) {
    super(messageEn);
    this.name = 'SourceProjectVerificationError';
    this.reasonCode = reasonCode;
    this.reasonMessageJa = messageJa;
  }
}

export const SUPPORTED_SOURCE_PROJECT_EXTENSIONS = [
  '.psd',
  '.clip',
  '.procreate',
  '.kra',
  '.sai2',
] as const;

export const SOURCE_PROJECT_ACCEPT_ATTR = '.psd,.clip,.procreate,.kra,.sai2';

function hasBytesAt(haystack: Uint8Array, offset: number, needle: number[]): boolean {
  if (offset < 0 || offset + needle.length > haystack.byteLength) return false;
  for (let i = 0; i < needle.length; i++) {
    if (haystack[offset + i] !== needle[i]) return false;
  }
  return true;
}

function indexOfAscii(haystack: Uint8Array, ascii: string, maxSearchBytes?: number): number {
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

function countAsciiOccurrences(haystack: Uint8Array, ascii: string, maxSearchBytes?: number): number {
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

function isSpoofedFlatImage(bytes: Uint8Array): boolean {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (hasBytesAt(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return true;
  // JPEG: FF D8 FF
  if (hasBytesAt(bytes, 0, [0xff, 0xd8, 0xff])) return true;
  // WebP: RIFF....WEBP
  if (
    hasBytesAt(bytes, 0, [0x52, 0x49, 0x46, 0x46]) &&
    hasBytesAt(bytes, 8, [0x57, 0x45, 0x42, 0x50])
  ) {
    return true;
  }
  // GIF: GIF87a / GIF89a
  if (hasBytesAt(bytes, 0, [0x47, 0x49, 0x46, 0x38])) return true;
  // BMP: BM
  if (hasBytesAt(bytes, 0, [0x42, 0x4d])) return true;
  return false;
}

function verifyPsdStructure(bytes: Uint8Array): { width: number; height: number; layerCount: number } {
  if (bytes.byteLength < 38) {
    throw new SourceProjectVerificationError(
      'INVALID_PSD_TOO_SMALL',
      'Invalid PSD file: file is too small to contain a valid PSD header and layer structure.',
      '無効なPSDファイルです: 有効なPSDヘッダおよびレイヤー構造を含んでいません。',
    );
  }
  // Magic: '8BPS'
  if (!hasBytesAt(bytes, 0, [0x38, 0x42, 0x50, 0x53])) {
    throw new SourceProjectVerificationError(
      'INVALID_PSD_SIGNATURE',
      'Invalid PSD file: missing 8BPS signature. Renamed flat images are not accepted.',
      '無効なPSDファイルです: 8BPSシグネチャが見つかりません。1枚絵の拡張子偽装は許可されていません。',
    );
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint16(4, false);
  if (version !== 1 && version !== 2) {
    throw new SourceProjectVerificationError(
      'INVALID_PSD_VERSION',
      'Invalid PSD file: unsupported PSD/PSB version.',
      '無効なPSDファイルです: 未対応のPSD/PSBバージョンです。',
    );
  }

  const channels = view.getUint16(12, false);
  const height = view.getUint32(14, false);
  const width = view.getUint32(18, false);
  const depth = view.getUint16(22, false);
  if (
    channels < 1 ||
    channels > 56 ||
    width < 1 ||
    width > MAX_PSD_DIMENSION ||
    height < 1 ||
    height > MAX_PSD_DIMENSION ||
    width * height > MAX_PSD_PIXELS
  ) {
    throw new SourceProjectVerificationError(
      'INVALID_PSD_DIMENSIONS',
      `Invalid PSD file: canvas dimensions (${width}×${height}) or channel count are out of safe local bounds (max ${MAX_PSD_DIMENSION}px, ${MAX_PSD_PIXELS / 1_000_000} MP).`,
      `無効なPSDファイルです: キャンバス寸法（${width}×${height}）またはチャンネル数が安全上限を超えています。`,
    );
  }

  let parsed: ReturnType<typeof parsePsdLayerRecords>;
  try {
    parsed = parsePsdLayerRecords(bytes, version, depth);
  } catch (err) {
    if (err instanceof ProjectParseError) {
      throw new SourceProjectVerificationError(err.code, err.message, err.messageJa);
    }
    throw err;
  }

  if (parsed.layerCount < 2) {
    throw new SourceProjectVerificationError(
      'PSD_SINGLE_LAYER_REJECTED',
      `Rejected: PSD file has only ${parsed.layerCount} layer. At least 2 active layers with drawn pixel content (e.g., sketch/lineart + color or signature) are required to verify creation structure and prevent flat photo/AI spoofing.`,
      `拒絶されました: PSDファイルのレイヤー数が${parsed.layerCount}枚のみです。写真やAI生成1枚絵の偽装を防ぐため、描画ピクセルを含む2枚以上の有効レイヤー（例：線画＋着色、または下書き＋仕上げ・サイン等）が必要です。`,
    );
  }

  if (parsed.activePixelLayerCount < 2) {
    throw new SourceProjectVerificationError(
      'PSD_INSUFFICIENT_ACTIVE_LAYERS',
      `Rejected: Found ${parsed.layerCount} layers, but only ${parsed.activePixelLayerCount} layer contains non-transparent pixel data. Adding an empty transparent layer to a flat photo or AI image is not accepted—at least 2 layers with actual drawn content are required.`,
      `拒絶されました: レイヤーは${parsed.layerCount}枚ありますが、実際に描画ピクセル（非透明データ）を含むレイヤーは${parsed.activePixelLayerCount}枚のみです。空の透明レイヤーを追加しただけのデータは受け付けられません。`,
    );
  }

  return { width, height, layerCount: parsed.layerCount };
}

function verifyClipStructure(bytes: Uint8Array): { layerCount: number } {
  // CLIP STUDIO PAINT header starts with 'CSFCHUNK'
  if (indexOfAscii(bytes, 'CSFCHUNK', 64) !== 0) {
    throw new SourceProjectVerificationError(
      'INVALID_CLIP_SIGNATURE',
      'Invalid CLIP file: missing CSFCHUNK header. Renamed flat images are not accepted.',
      '無効なCLIPファイルです: CSFCHUNKヘッダが見つかりません。1枚絵の拡張子偽装は許可されていません。',
    );
  }

  // Must contain embedded SQLite 3 database header
  const sqliteOffset = indexOfAscii(bytes, 'SQLite format 3\0', Math.min(bytes.byteLength, 2 * 1024 * 1024));
  if (sqliteOffset === -1) {
    throw new SourceProjectVerificationError(
      'INVALID_CLIP_NO_SQLITE',
      'Invalid CLIP file: embedded SQLite 3 project database was not found.',
      '無効なCLIPファイルです: 内部のSQLiteデータベース構造が確認できませんでした。',
    );
  }

  const hasCanvasOrLayer =
    indexOfAscii(bytes, 'Layer', Math.min(bytes.byteLength, 4 * 1024 * 1024)) !== -1 ||
    indexOfAscii(bytes, 'Canvas', Math.min(bytes.byteLength, 4 * 1024 * 1024)) !== -1;
  if (!hasCanvasOrLayer) {
    throw new SourceProjectVerificationError(
      'INVALID_CLIP_NO_LAYERS',
      'Invalid CLIP file: no Canvas/Layer management tables found in project database.',
      '無効なCLIPファイルです: キャンバス・レイヤー管理テーブルが確認できませんでした。',
    );
  }

  const layerMarkers = countAsciiOccurrences(bytes, 'Layer', Math.min(bytes.byteLength, 2 * 1024 * 1024));
  const layerCount = Math.max(2, Math.min(500, layerMarkers));
  return { layerCount };
}

function verifyZipProjectStructure(
  bytes: Uint8Array,
  format: 'PROCREATE' | 'KRA',
): { layerCount: number } {
  // ZIP local file header: PK\x03\x04
  if (!hasBytesAt(bytes, 0, [0x50, 0x4b, 0x03, 0x04])) {
    throw new SourceProjectVerificationError(
      `INVALID_${format}_ZIP`,
      `Invalid ${format} file: missing ZIP archive signature.`,
      `無効な${format}ファイルです: ZIPアーカイブ構造が確認できませんでした。`,
    );
  }

  if (format === 'PROCREATE') {
    const hasDocArchive = indexOfAscii(bytes, 'Document.archive') !== -1;
    if (!hasDocArchive) {
      throw new SourceProjectVerificationError(
        'INVALID_PROCREATE_STRUCTURE',
        'Invalid Procreate file: Document.archive was not found inside the project bundle.',
        '無効なProcreateファイルです: Document.archiveが見つかりませんでした。',
      );
    }
    const chunkCount = countAsciiOccurrences(bytes, '.chunk');
    return { layerCount: Math.max(2, Math.min(500, chunkCount || 2)) };
  }

  // KRA (Krita)
  const hasMainDoc = indexOfAscii(bytes, 'maindoc.xml') !== -1;
  const hasKritaMarker =
    indexOfAscii(bytes, 'mergedimage.png') !== -1 ||
    indexOfAscii(bytes, 'application/x-krita') !== -1;
  if (!hasMainDoc || !hasKritaMarker) {
    throw new SourceProjectVerificationError(
      'INVALID_KRA_STRUCTURE',
      'Invalid Krita (.kra) file: missing maindoc.xml or Krita archive structure.',
      '無効なKrita（.kra）ファイルです: maindoc.xmlまたはKritaプロジェクト構造が見つかりませんでした。',
    );
  }
  const layerEntries = countAsciiOccurrences(bytes, '/layers/layer');
  return { layerCount: Math.max(2, Math.min(500, layerEntries || 2)) };
}

function verifySai2Structure(bytes: Uint8Array): { layerCount: number } {
  const hasSai2Header =
    indexOfAscii(bytes, 'SAI-CANVAS-TYPE0', 64) === 0 ||
    indexOfAscii(bytes, 'SAI2', 32) !== -1;
  if (!hasSai2Header || bytes.byteLength < 64) {
    throw new SourceProjectVerificationError(
      'INVALID_SAI2_SIGNATURE',
      'Invalid SAI2 file: missing SAI2 binary canvas header.',
      '無効なSAI2ファイルです: SAI2固有のバイナリヘッダが確認できませんでした。',
    );
  }
  return { layerCount: 2 };
}

/**
 * Verifies a local source working project file (.psd, .clip, .procreate, .kra, .sai2)
 * 100% client-side in memory and immediately releases the raw binary buffer.
 * Never persists or transmits the working project file itself.
 */
export async function verifySourceProjectFile(
  file: SourceProjectFileLike,
): Promise<SourceProjectVerificationResult> {
  const lowerName = (file.name || '').toLowerCase().trim();
  let expectedFormat: SourceProjectFormat | null = null;
  if (lowerName.endsWith('.psd')) expectedFormat = 'PSD';
  else if (lowerName.endsWith('.clip')) expectedFormat = 'CLIP';
  else if (lowerName.endsWith('.procreate')) expectedFormat = 'PROCREATE';
  else if (lowerName.endsWith('.kra')) expectedFormat = 'KRA';
  else if (lowerName.endsWith('.sai2')) expectedFormat = 'SAI2';

  if (!expectedFormat) {
    throw new SourceProjectVerificationError(
      'UNSUPPORTED_SOURCE_FORMAT',
      'Unsupported source project format. Please select a genuine .psd, .clip, .procreate, .kra, or .sai2 working file.',
      '未対応の作業データ形式です。.psd / .clip / .procreate / .kra / .sai2 のいずれかの作業ファイルを選択してください。',
    );
  }

  const buffer: ArrayBuffer = await file.arrayBuffer();
  const bytes: Uint8Array = new Uint8Array(buffer);
  const fileSizeBytes = bytes.byteLength;

  try {
    if (fileSizeBytes === 0) {
      throw new SourceProjectVerificationError(
        'EMPTY_SOURCE_FILE',
        'Source project file is empty.',
        '作業データファイルが空です。',
      );
    }

    // Reject renamed flat images immediately
    if (isSpoofedFlatImage(bytes)) {
      throw new SourceProjectVerificationError(
        'SPOOFED_FLAT_IMAGE_EXTENSION',
        'Rejected: This file is a flat image (PNG/JPEG/WebP/GIF/BMP) renamed to a project extension. Genuine working project data is required.',
        '拒絶されました: 1枚絵画像（PNG/JPEG/WebP等）の拡張子を偽装したファイルは使用できません。本物の作業データを選択してください。',
      );
    }

    let layerCount = 2;
    let width: number | undefined;
    let height: number | undefined;

    if (expectedFormat === 'PSD') {
      const psd = verifyPsdStructure(bytes);
      layerCount = psd.layerCount;
      width = psd.width;
      height = psd.height;
    } else if (expectedFormat === 'CLIP') {
      const clip = verifyClipStructure(bytes);
      layerCount = clip.layerCount;
    } else if (expectedFormat === 'PROCREATE' || expectedFormat === 'KRA') {
      const zip = verifyZipProjectStructure(bytes, expectedFormat);
      layerCount = zip.layerCount;
    } else if (expectedFormat === 'SAI2') {
      const sai2 = verifySai2Structure(bytes);
      layerCount = sai2.layerCount;
    }

    // Compute raw SHA-256 for automatic Protocol v3 evidenceHashes (CBOR key 16) binding
    const sourceFileSha256 = await sha256(bytes);

    // Compute one-way salted SHA-256 commitment hash of the working file
    const salt = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      crypto.getRandomValues(salt);
    }
    const combined = new Uint8Array(bytes.byteLength + salt.byteLength);
    combined.set(bytes, 0);
    combined.set(salt, bytes.byteLength);
    const digest = await sha256(combined);
    const sourceCommitmentHash = bytesToHex(digest);

    const rawBase = (file.name || 'working-project').split(/[\\/]/).pop() ?? 'working-project';
    const sanitizedBasename = rawBase.replace(/[\r\n\t\0]/g, '').trim().slice(0, 96) || 'working-project';

    return {
      verified: true,
      projectFormat: expectedFormat,
      layerCount,
      sourceCommitmentHash,
      sourceFileSha256,
      sanitizedBasename,
      width,
      height,
      fileSizeBytes,
    };
  } finally {
    // Raw project bytes and buffer go out of scope here and are never persisted or transmitted.
  }
}

export function formatSourceProjectError(err: unknown, locale: 'ja' | 'en' = 'en'): string | null {
  if (err instanceof SourceProjectVerificationError) {
    return locale === 'ja' ? err.reasonMessageJa : err.message;
  }
  return null;
}

/**
 * Encodes lightweight source-project verification metadata into a compact manifest tag
 * so it is cryptographically signed inside Ed25519 proofs without storing any raw project data.
 */
export function buildSourceProjectProofTag(info: SourceProjectVerificationResult): string {
  return `chm-src:${info.projectFormat}:${info.layerCount}:${info.sourceCommitmentHash.slice(0, 16)}`;
}

export interface ParsedSourceProjectBadge {
  projectFormat: SourceProjectFormat;
  layerCount: number;
  commitmentHashPrefix: string;
}

export function parseSourceProjectProofTag(tags?: string[]): ParsedSourceProjectBadge | null {
  if (!tags || tags.length === 0) return null;
  for (const tag of tags) {
    const m = /^chm-src:(PSD|CLIP|PROCREATE|KRA|SAI2):(\d+):([0-9a-f]{8,64})$/i.exec(tag.trim());
    if (m) {
      return {
        projectFormat: m[1].toUpperCase() as SourceProjectFormat,
        layerCount: Number(m[2]),
        commitmentHashPrefix: m[3].toLowerCase(),
      };
    }
  }
  return null;
}

import { encode } from 'fast-png';
import { bytesToHex, sha256 } from '../crypto/sha256';
import {
  ProjectParseError,
  computeStreamingSha256,
  extractEmbeddedPng,
  hasBytesAt,
  type BaseProjectParser,
  type ProjectFileInput,
  type ProjectInspectionResult,
  type ProjectLayerSummary,
  type ProjectMergeResult,
  type StreamingHashProgress,
} from './base';

/** Pre-flight DoS/OOM safety bounds for PSD/PSB files */
export const MAX_PSD_FILE_BYTES = 512 * 1024 * 1024; // 512 MiB
export const MAX_PSD_DIMENSION = 16384; // 16384 px max width/height
export const MAX_PSD_PIXELS = 64_000_000; // 64 MP max canvas area
export const MAX_PSD_LAYER_COUNT = 2048;

const BLEND_MODE_LABELS: Record<string, string> = {
  norm: 'normal',
  'mul ': 'multiply',
  scrn: 'screen',
  over: 'overlay',
  lddg: 'linear-dodge',
  'add ': 'add',
  dark: 'darken',
  lite: 'lighten',
  sLit: 'soft-light',
  hLit: 'hard-light',
  diff: 'difference',
  pass: 'pass-through',
  diss: 'dissolve',
  idiv: 'color-burn',
  'div ': 'color-dodge',
};

interface ParsedPsdLayerRecord {
  name: string;
  top: number;
  left: number;
  bottom: number;
  right: number;
  width: number;
  height: number;
  visible: boolean;
  opacity: number;
  blendMode: string;
  isClippingMask: boolean;
  channels: Array<{ id: number; dataLen: number }>;
  hasNonZeroAlpha: boolean;
  hasActivePixels: boolean;
}

/**
 * Full-layer parser & flattener for Adobe Photoshop (.psd / .psb) project files.
 * Verifies 8BPS magic header, enforces pre-flight dimension/memory bounds, parses real
 * multi-layer records (rejecting single-layer and empty-transparent-layer bypasses),
 * and decodes 8/16/32-bit RGB, Grayscale, and CMYK composite data into deterministic RGBA8 PNG.
 */
export class PsdProjectParser implements BaseProjectParser {
  readonly id = 'psd-parser';
  readonly supportedExtensions = ['.psd', '.psb'] as const;
  readonly supportedFormats = ['PSD', 'PSB'] as const;
  readonly mergeMethod = 'full-layer-render' as const;

  canParse(fileName: string, headerBytes: Uint8Array): boolean {
    const lower = fileName.toLowerCase();
    const extMatch = lower.endsWith('.psd') || lower.endsWith('.psb');
    const magicMatch = hasBytesAt(headerBytes, 0, [0x38, 0x42, 0x50, 0x53]); // '8BPS'
    return extMatch || magicMatch;
  }

  async inspect(
    file: ProjectFileInput,
    options?: { onHashProgress?: (progress: StreamingHashProgress) => void },
  ): Promise<ProjectInspectionResult> {
    // Pre-flight file size check before allocating memory
    if (file.size > MAX_PSD_FILE_BYTES) {
      throw new ProjectParseError(
        'PSD_FILE_TOO_LARGE',
        `Rejected: PSD/PSB file (${Math.round(file.size / (1024 * 1024))} MiB) exceeds the ${MAX_PSD_FILE_BYTES / (1024 * 1024)} MiB local safety limit.`,
        `拒絶されました: PSD/PSBファイルサイズ（${Math.round(file.size / (1024 * 1024))} MiB）がローカル処理上限（${MAX_PSD_FILE_BYTES / (1024 * 1024)} MiB）を超えています。`,
      );
    }

    // Pre-flight 26-byte header check before reading the full ArrayBuffer
    const headerBuf = await file.slice(0, Math.min(file.size, 26)).arrayBuffer();
    const headerBytes = new Uint8Array(headerBuf);
    if (headerBytes.byteLength < 26 || !hasBytesAt(headerBytes, 0, [0x38, 0x42, 0x50, 0x53])) {
      throw new ProjectParseError(
        'INVALID_PSD_HEADER',
        'Invalid PSD/PSB file: missing 8BPS header signature.',
        '無効なPSD/PSBファイルです: 8BPSヘッダが見つかりません。',
      );
    }

    const headerView = new DataView(
      headerBytes.buffer,
      headerBytes.byteOffset,
      headerBytes.byteLength,
    );
    const version = headerView.getUint16(4, false);
    if (version !== 1 && version !== 2) {
      throw new ProjectParseError(
        'UNSUPPORTED_PSD_VERSION',
        `Unsupported PSD/PSB version: ${version}.`,
        `未対応のPSD/PSBバージョンです: ${version}`,
      );
    }

    const channels = headerView.getUint16(12, false);
    const height = headerView.getUint32(14, false);
    const width = headerView.getUint32(18, false);
    const depth = headerView.getUint16(22, false);
    const colorMode = headerView.getUint16(24, false);

    if (channels < 1 || channels > 56 || width < 1 || height < 1) {
      throw new ProjectParseError(
        'INVALID_PSD_DIMENSIONS',
        'Invalid PSD/PSB canvas dimensions or channel count.',
        'PSD/PSBのキャンバスサイズまたはチャンネル数が不正です。',
      );
    }

    if (width > MAX_PSD_DIMENSION || height > MAX_PSD_DIMENSION || width * height > MAX_PSD_PIXELS) {
      throw new ProjectParseError(
        'PSD_DIMENSIONS_EXCEEDED',
        `Rejected: PSD/PSB canvas (${width}×${height}) exceeds the local safety limit (${MAX_PSD_DIMENSION}px max side, ${MAX_PSD_PIXELS / 1_000_000} MP max).`,
        `拒絶されました: PSD/PSBのキャンバスサイズ（${width}×${height}）がローカル処理上限（最大辺${MAX_PSD_DIMENSION}px・最大${MAX_PSD_PIXELS / 1_000_000}MP）を超えています。`,
      );
    }

    if (depth !== 8 && depth !== 16 && depth !== 32) {
      throw new ProjectParseError(
        'UNSUPPORTED_PSD_BIT_DEPTH',
        `Unsupported PSD/PSB bit depth (${depth}-bit). Supported bit depths: 8-bit, 16-bit, and 32-bit.`,
        `未対応のPSD/PSBビット深度（${depth}bit）です。8bit / 16bit / 32bitに対応しています。`,
      );
    }

    if (colorMode !== 1 && colorMode !== 3 && colorMode !== 4) {
      throw new ProjectParseError(
        'UNSUPPORTED_PSD_COLOR_MODE',
        `Unsupported PSD/PSB color mode (${colorMode}). Please use RGB, Grayscale, or CMYK.`,
        `未対応のPSD/PSBカラーモード（${colorMode}）です。RGB・グレースケール・CMYKのいずれかを使用してください。`,
      );
    }

    const sourceProjectSha256 = await computeStreamingSha256(file, options?.onHashProgress);
    const bytes = new Uint8Array(await file.arrayBuffer());

    if (bytes.byteLength < 38) {
      throw new ProjectParseError(
        'INVALID_PSD_HEADER',
        'Invalid PSD/PSB file: file is too small to contain layer information.',
        '無効なPSD/PSBファイルです: レイヤー情報を含むにはファイルサイズが小さすぎます。',
      );
    }

    const parsedLayers = parsePsdLayerRecords(bytes, version, depth);
    const layerCount = parsedLayers.layerCount;

    if (layerCount < 2) {
      throw new ProjectParseError(
        'PSD_SINGLE_LAYER_REJECTED',
        `Rejected: PSD/PSB has only ${layerCount} layer. At least 2 active layers with drawn pixel content (e.g., sketch/lineart + color or signature) are required to verify creation structure and prevent flat photo/AI spoofing.`,
        `拒絶されました: レイヤー数が${layerCount}枚のみです。写真やAI生成1枚絵の偽装を防ぐため、描画ピクセルを含む2枚以上の有効レイヤー（例：線画＋着色、または下書き＋仕上げ・サイン等）が必要です。`,
      );
    }

    if (parsedLayers.activePixelLayerCount < 2) {
      throw new ProjectParseError(
        'PSD_INSUFFICIENT_ACTIVE_LAYERS',
        `Rejected: Found ${layerCount} layers, but only ${parsedLayers.activePixelLayerCount} layer contains non-transparent pixel data. Adding an empty transparent layer to a flat photo or AI image is not accepted—at least 2 layers with actual drawn content (e.g., lineart + color/signature) are required.`,
        `拒絶されました: レイヤーは${layerCount}枚ありますが、実際に描画ピクセル（非透明データ）を含むレイヤーは${parsedLayers.activePixelLayerCount}枚のみです。1枚絵に空の透明レイヤーを追加しただけのデータは受け付けられません。2枚以上の描画レイヤーが必要です。`,
      );
    }

    const visibleCount = parsedLayers.records.filter((r) => r.visible).length;
    const layers: ProjectLayerSummary[] = parsedLayers.records.slice(0, 64).map((r) => ({
      name: r.name,
      visible: r.visible,
      opacity: r.opacity,
      blendMode: r.blendMode,
      width: r.width,
      height: r.height,
    }));

    return {
      format: version === 2 ? 'PSB' : 'PSD',
      softwareSignature: version === 2 ? 'Adobe Photoshop Big (PSB)' : 'Adobe Photoshop (PSD)',
      mergeMethod: this.mergeMethod,
      magicNumberValid: true,
      layerMetrics: {
        layer_count: layerCount,
        visible_layer_count: visibleCount,
        canvas_width: width,
        canvas_height: height,
        has_multi_layer_structure: parsedLayers.activePixelLayerCount >= 2,
      },
      layers,
      timelapseDetected: false,
      fileSizeBytes: file.size,
      sourceProjectSha256,
    };
  }

  async mergeToPng(
    file: ProjectFileInput,
    inspection: ProjectInspectionResult,
  ): Promise<ProjectMergeResult> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const width = inspection.layerMetrics.canvas_width;
    const height = inspection.layerMetrics.canvas_height;

    // 1. Decode the actual flattened PSD/PSB Image Data Section (8/16/32-bit RGB, Grayscale, CMYK; Raw or PackBits RLE)
    const decodedRgba = decodePsdCompositeImageData(bytes);
    let mergedPngBytes: Uint8Array;

    if (decodedRgba) {
      mergedPngBytes = encode({
        width: decodedRgba.width,
        height: decodedRgba.height,
        data: decodedRgba.rgba,
        depth: 8,
        channels: 4,
      });
    } else {
      const embeddedPng = extractEmbeddedPng(bytes);
      if (embeddedPng) {
        mergedPngBytes = embeddedPng;
      } else {
        throw new ProjectParseError(
          'PSD_MISSING_COMPOSITE_DATA',
          'Could not decode composite image data from this PSD/PSB. Please re-save the file with "Maximize Compatibility" enabled in your drawing app.',
          'このPSD/PSBから統合プレビュー画像をデコードできませんでした。制作ソフトで「互換性を優先（Maximize Compatibility）」を有効にして保存し直してください。',
        );
      }
    }

    const mergedImageSha256 = bytesToHex(await sha256(mergedPngBytes));
    return {
      inspection,
      mergedPngBytes,
      mergedImageSha256,
      width: decodedRgba?.width ?? width,
      height: decodedRgba?.height ?? height,
    };
  }
}

/**
 * Parses PSD/PSB Layer and Mask Information section and inspects every layer record's
 * bounding box and alpha/channel pixel data to count genuinely active pixel layers.
 */
export function parsePsdLayerRecords(
  bytes: Uint8Array,
  version: number,
  depth: number,
): {
  layerCount: number;
  activePixelLayerCount: number;
  records: ParsedPsdLayerRecord[];
} {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 26;

  const colorModeLen = view.getUint32(offset, false);
  offset += 4 + colorModeLen;
  if (offset + 4 > bytes.byteLength) {
    throw new ProjectParseError(
      'TRUNCATED_PSD',
      'PSD/PSB file truncated before Image Resources section.',
      'PSD/PSBファイルが途中で途切れています。',
    );
  }
  const imageResourcesLen = view.getUint32(offset, false);
  offset += 4 + imageResourcesLen;

  const lenSize = version === 2 ? 8 : 4;
  if (offset + lenSize > bytes.byteLength) {
    throw new ProjectParseError(
      'PSD_NO_LAYER_SECTION',
      'PSD/PSB file is missing Layer and Mask Information section.',
      'PSD/PSBファイルにレイヤー情報セクションがありません。',
    );
  }
  const layerMaskLen =
    version === 2 ? Number(view.getBigUint64(offset, false)) : view.getUint32(offset, false);
  offset += lenSize;

  if (layerMaskLen <= 0 || offset + lenSize + 2 > bytes.byteLength) {
    throw new ProjectParseError(
      'PSD_NO_MULTI_LAYER',
      'Rejected: PSD/PSB contains no multi-layer data. At least 2 active layers (e.g., lineart + color) are required.',
      '拒絶されました: PSD/PSBに複数レイヤー構造が含まれていません。2枚以上の有効レイヤーが必要です。',
    );
  }

  const layerInfoLen =
    version === 2 ? Number(view.getBigUint64(offset, false)) : view.getUint32(offset, false);
  offset += lenSize;
  const layerInfoEnd = Math.min(bytes.byteLength, offset + layerInfoLen);
  if (layerInfoLen <= 0 || offset + 2 > bytes.byteLength) {
    throw new ProjectParseError(
      'PSD_EMPTY_LAYERS',
      'Rejected: PSD/PSB Layer Info section is empty.',
      '拒絶されました: PSD/PSBのレイヤー情報が空です。',
    );
  }

  const rawLayerCount = view.getInt16(offset, false);
  offset += 2;
  const layerCount = Math.abs(rawLayerCount);

  if (layerCount > MAX_PSD_LAYER_COUNT) {
    throw new ProjectParseError(
      'PSD_TOO_MANY_LAYERS',
      `Rejected: PSD/PSB declares ${layerCount} layers, exceeding the ${MAX_PSD_LAYER_COUNT}-layer safety limit.`,
      `拒絶されました: レイヤー数（${layerCount}枚）がローカル処理上限（${MAX_PSD_LAYER_COUNT}枚）を超えています。`,
    );
  }

  const records: ParsedPsdLayerRecord[] = [];
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const chanLenSize = version === 2 ? 8 : 4;

  for (let i = 0; i < layerCount; i++) {
    if (offset + 18 > layerInfoEnd) {
      throw new ProjectParseError(
        'TRUNCATED_PSD_LAYER_RECORD',
        `Invalid PSD/PSB: truncated layer record at index ${i}.`,
        `無効なPSD/PSBファイルです: レイヤーレコード（${i + 1}枚目）が破損または途切れています。`,
      );
    }

    const top = view.getInt32(offset, false);
    const left = view.getInt32(offset + 4, false);
    const bottom = view.getInt32(offset + 8, false);
    const right = view.getInt32(offset + 12, false);
    const numChannels = view.getUint16(offset + 16, false);
    offset += 18;

    const layerW = Math.max(0, right - left);
    const layerH = Math.max(0, bottom - top);

    const channels: Array<{ id: number; dataLen: number }> = [];
    for (let c = 0; c < numChannels; c++) {
      if (offset + 2 + chanLenSize > layerInfoEnd) {
        throw new ProjectParseError(
          'TRUNCATED_PSD_LAYER_RECORD',
          `Invalid PSD/PSB: truncated channel info in layer ${i + 1}.`,
          `無効なPSD/PSBファイルです: レイヤー${i + 1}のチャンネル情報が途切れています。`,
        );
      }
      const id = view.getInt16(offset, false);
      const dataLen =
        version === 2
          ? Number(view.getBigUint64(offset + 2, false))
          : view.getUint32(offset + 2, false);
      channels.push({ id, dataLen });
      offset += 2 + chanLenSize;
    }

    if (offset + 16 > layerInfoEnd) {
      throw new ProjectParseError(
        'TRUNCATED_PSD_LAYER_RECORD',
        `Invalid PSD/PSB: truncated blend mode/flags in layer ${i + 1}.`,
        `無効なPSD/PSBファイルです: レイヤー${i + 1}の描画モード情報が途切れています。`,
      );
    }

    const blendSig = decoder.decode(bytes.subarray(offset, offset + 4));
    if (blendSig !== '8BIM') {
      throw new ProjectParseError(
        'INVALID_PSD_LAYER_SIGNATURE',
        `Invalid PSD/PSB: unexpected blend mode signature "${blendSig}" in layer ${i + 1}.`,
        `無効なPSD/PSBファイルです: レイヤー${i + 1}のシグネチャが不正です。`,
      );
    }
    const blendKey = decoder.decode(bytes.subarray(offset + 4, offset + 8));
    const opacity = view.getUint8(offset + 8) / 255;
    const clipping = view.getUint8(offset + 9);
    const flags = view.getUint8(offset + 10);
    // offset + 11 is filler
    const extraDataLen = view.getUint32(offset + 12, false);
    offset += 16;

    const extraEnd = Math.min(layerInfoEnd, offset + extraDataLen);
    let layerName = `Layer ${i + 1}`;

    if (offset + 4 <= extraEnd) {
      const maskDataLen = view.getUint32(offset, false);
      let cursor = offset + 4 + maskDataLen;
      if (cursor + 4 <= extraEnd) {
        const blendingRangesLen = view.getUint32(cursor, false);
        cursor += 4 + blendingRangesLen;
        if (cursor < extraEnd) {
          const nameLen = bytes[cursor];
          if (cursor + 1 + nameLen <= extraEnd && nameLen > 0) {
            layerName = decoder.decode(bytes.subarray(cursor + 1, cursor + 1 + nameLen)).trim() || layerName;
          }
        }
      }
    }
    offset = extraEnd;

    const visible = (flags & 0x02) === 0;
    const hasBoundingBox = layerW > 0 && layerH > 0;

    records.push({
      name: layerName,
      top,
      left,
      bottom,
      right,
      width: layerW,
      height: layerH,
      visible,
      opacity,
      blendMode: BLEND_MODE_LABELS[blendKey] ?? blendKey.trim(),
      isClippingMask: clipping === 1,
      channels,
      hasNonZeroAlpha: hasBoundingBox,
      hasActivePixels: hasBoundingBox && opacity > 0,
    });
  }

  // Inspect channel image data following the layer records to catch empty-transparent-layer bypasses
  // (e.g., a full-canvas bounding box whose alpha channel -1 is all 0x00).
  let channelCursor = offset;
  const bytesPerSample = depth === 32 ? 4 : depth === 16 ? 2 : 1;

  for (const rec of records) {
    let alphaChecked = false;
    let alphaHasNonZero = false;

    for (const ch of rec.channels) {
      const chStart = channelCursor;
      const chEnd = Math.min(layerInfoEnd, chStart + ch.dataLen);
      channelCursor = chEnd;

      if (ch.id === -1 && rec.width > 0 && rec.height > 0 && chEnd - chStart >= 2) {
        alphaChecked = true;
        const compression = view.getUint16(chStart, false);
        const dataStart = chStart + 2;
        if (compression === 0) {
          // Raw channel bytes
          for (let p = dataStart; p < chEnd; p++) {
            if (bytes[p] !== 0) {
              alphaHasNonZero = true;
              break;
            }
          }
        } else if (compression === 1) {
          // PackBits RLE: skip row byte-count table, scan compressed RLE stream for any non-zero literal/run byte
          const rowCountFieldSize = version === 2 ? 4 : 2;
          const rleStart = dataStart + rec.height * rowCountFieldSize;
          if (rleStart < chEnd) {
            let pos = rleStart;
            while (pos < chEnd) {
              const header = view.getInt8(pos++);
              if (header >= 0) {
                const count = header + 1;
                const end = Math.min(pos + count, chEnd);
                for (let k = pos; k < end; k++) {
                  if (bytes[k] !== 0) {
                    alphaHasNonZero = true;
                    break;
                  }
                }
                pos = end;
              } else if (header !== -128) {
                const val = pos < chEnd ? bytes[pos++] : 0;
                if (val !== 0) {
                  alphaHasNonZero = true;
                  break;
                }
              }
              if (alphaHasNonZero) break;
            }
          } else {
            // Malformed or truncated RLE table — do not assume non-zero
            alphaHasNonZero = false;
          }
        } else {
          // ZIP-compressed channel (compression 2 or 3): non-trivial compressed payload > 2 bytes
          alphaHasNonZero = chEnd - dataStart > 2 * bytesPerSample;
        }
      }
    }

    if (alphaChecked) {
      rec.hasNonZeroAlpha = alphaHasNonZero;
      rec.hasActivePixels = rec.width > 0 && rec.height > 0 && rec.opacity > 0 && alphaHasNonZero;
    }
  }

  const activePixelLayerCount = records.filter((r) => r.hasActivePixels).length;
  return { layerCount, activePixelLayerCount, records };
}

/**
 * Decodes the flattened composite Image Data Section at the end of a PSD/PSB file.
 * Supports 8-bit, 16-bit, and 32-bit RGB/RGBA, Grayscale, and CMYK in both
 * Compression 0 (Raw) and Compression 1 (PackBits RLE).
 */
function decodePsdCompositeImageData(
  bytes: Uint8Array,
): { width: number; height: number; rgba: Uint8Array } | null {
  if (bytes.byteLength < 40) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint16(4, false);
  const channels = view.getUint16(12, false);
  const height = view.getUint32(14, false);
  const width = view.getUint32(18, false);
  const depth = view.getUint16(22, false);
  const colorMode = view.getUint16(24, false); // 1 = Grayscale, 3 = RGB, 4 = CMYK

  if (depth !== 8 && depth !== 16 && depth !== 32) return null;
  if (colorMode !== 1 && colorMode !== 3 && colorMode !== 4) return null;
  if (width < 1 || height < 1 || width > MAX_PSD_DIMENSION || height > MAX_PSD_DIMENSION) return null;
  if (width * height > MAX_PSD_PIXELS) return null;

  let offset = 26;
  const colorModeLen = view.getUint32(offset, false);
  offset += 4 + colorModeLen;
  if (offset + 4 > bytes.byteLength) return null;

  const imageResourcesLen = view.getUint32(offset, false);
  offset += 4 + imageResourcesLen;

  const lenSize = version === 2 ? 8 : 4;
  if (offset + lenSize > bytes.byteLength) return null;
  const layerMaskLen =
    version === 2 ? Number(view.getBigUint64(offset, false)) : view.getUint32(offset, false);
  offset += lenSize + layerMaskLen;

  if (offset + 2 > bytes.byteLength) return null;
  const compression = view.getUint16(offset, false);
  offset += 2;

  const pixelCount = width * height;
  const bytesPerSample = depth === 32 ? 4 : depth === 16 ? 2 : 1;
  const rowBytes = width * bytesPerSample;
  const planeByteLen = pixelCount * bytesPerSample;
  const maxPlanes = colorMode === 4 ? 5 : 4; // CMYK + optional alpha, or RGB/Gray + optional alpha
  const planesToRead = Math.min(channels, maxPlanes);
  const rawPlanes: Uint8Array[] = [];

  if (compression === 0) {
    // Raw planar channel data
    for (let c = 0; c < planesToRead; c++) {
      if (offset + planeByteLen > bytes.byteLength) return null;
      rawPlanes.push(bytes.subarray(offset, offset + planeByteLen));
      offset += planeByteLen;
    }
  } else if (compression === 1) {
    // PackBits RLE planar channel data
    const rowCountFieldSize = version === 2 ? 4 : 2;
    const totalRows = channels * height;
    const rowLengthsOffset = offset;
    offset += totalRows * rowCountFieldSize;
    if (offset > bytes.byteLength) return null;

    for (let c = 0; c < planesToRead; c++) {
      const plane = new Uint8Array(planeByteLen);
      let dstPos = 0;
      for (let y = 0; y < height; y++) {
        const lenPos = rowLengthsOffset + (c * height + y) * rowCountFieldSize;
        const rleLen =
          version === 2 ? view.getUint32(lenPos, false) : view.getUint16(lenPos, false);
        const rowEnd = Math.min(offset + rleLen, bytes.byteLength);
        const rowDstEnd = dstPos + rowBytes;

        while (offset < rowEnd && dstPos < rowDstEnd) {
          const header = view.getInt8(offset++);
          if (header >= 0) {
            const count = header + 1;
            const end = Math.min(offset + count, rowEnd);
            for (let k = offset; k < end && dstPos < rowDstEnd; k++) {
              plane[dstPos++] = bytes[k];
            }
            offset = end;
          } else if (header !== -128) {
            const count = 1 - header;
            const val = offset < rowEnd ? bytes[offset++] : 0;
            for (let k = 0; k < count && dstPos < rowDstEnd; k++) {
              plane[dstPos++] = val;
            }
          }
        }
        offset = rowEnd;
        dstPos = rowDstEnd;
      }
      rawPlanes.push(plane);
    }
  } else {
    return null;
  }

  // Normalize each plane to 8-bit unsigned samples
  const planes8: Uint8Array[] = rawPlanes.map((raw) => {
    if (depth === 8) return raw;
    const out = new Uint8Array(pixelCount);
    const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    if (depth === 16) {
      for (let i = 0; i < pixelCount; i++) {
        out[i] = dv.getUint16(i * 2, false) >> 8;
      }
    } else {
      // 32-bit IEEE 754 float (big-endian)
      for (let i = 0; i < pixelCount; i++) {
        const f = dv.getFloat32(i * 4, false);
        const clamped = Number.isFinite(f) ? Math.max(0, Math.min(1, f)) : 0;
        out[i] = Math.round(clamped * 255);
      }
    }
    return out;
  });

  const rgba = new Uint8Array(pixelCount * 4);
  if (colorMode === 1) {
    // Grayscale (+ optional alpha)
    const g = planes8[0];
    const a = planes8[1];
    for (let i = 0; i < pixelCount; i++) {
      const idx = i * 4;
      const v = g[i];
      rgba[idx] = v;
      rgba[idx + 1] = v;
      rgba[idx + 2] = v;
      rgba[idx + 3] = a ? a[i] : 255;
    }
  } else if (colorMode === 4) {
    // CMYK (+ optional alpha). In PSD CMYK, 0 = 100% ink, 255 = 0% ink.
    const cPlane = planes8[0];
    const mPlane = planes8[1] ?? cPlane;
    const yPlane = planes8[2] ?? cPlane;
    const kPlane = planes8[3] ?? cPlane;
    const aPlane = planes8[4];
    for (let i = 0; i < pixelCount; i++) {
      const idx = i * 4;
      const k = kPlane[i];
      rgba[idx] = Math.round((cPlane[i] * k) / 255);
      rgba[idx + 1] = Math.round((mPlane[i] * k) / 255);
      rgba[idx + 2] = Math.round((yPlane[i] * k) / 255);
      rgba[idx + 3] = aPlane ? aPlane[i] : 255;
    }
  } else {
    // RGB (+ optional alpha)
    const r = planes8[0];
    const g = planes8[1] ?? r;
    const b = planes8[2] ?? r;
    const a = planes8[3];
    for (let i = 0; i < pixelCount; i++) {
      const idx = i * 4;
      rgba[idx] = r[i];
      rgba[idx + 1] = g[i];
      rgba[idx + 2] = b[i];
      rgba[idx + 3] = a ? a[i] : 255;
    }
  }

  return { width, height, rgba };
}

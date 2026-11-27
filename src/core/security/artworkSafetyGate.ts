import type { CanonicalRaster } from '../image/pngCodec';

export type ArtworkSafetyCategory =
  | 'csam_illegal'
  | 'illicit_drugs_or_trafficking'
  | 'non_art_address_or_drop'
  | 'photorealistic_nsfw'
  | 'non_art_raw_photo';

export interface ArtworkSafetyMetrics {
  skinRatio: number;
  centerSkinRatio: number;
  photorealismScore: number;
  flatPixelRatio: number;
  microNoiseRatio: number;
  hasCameraExif: boolean;
  hasGpsExif: boolean;
}

export interface ArtworkSafetyResult {
  allowed: boolean;
  category?: ArtworkSafetyCategory;
  reasonCode?: string;
  reasonMessage: string;
  reasonMessageJa: string;
  metrics?: ArtworkSafetyMetrics;
}

export interface ArtworkSafetyInput {
  fileName?: string;
  title?: string;
  description?: string;
  policyNote?: string;
  tags?: string[];
  rawBytes?: Uint8Array;
  raster?: CanonicalRaster;
}

export class ArtworkSafetyError extends Error {
  readonly category: ArtworkSafetyCategory;
  readonly reasonCode: string;
  readonly reasonMessageJa: string;

  constructor(result: ArtworkSafetyResult) {
    super(result.reasonMessage);
    this.name = 'ArtworkSafetyError';
    this.category = result.category ?? 'photorealistic_nsfw';
    this.reasonCode = result.reasonCode ?? 'SAFETY_REJECTED';
    this.reasonMessageJa = result.reasonMessageJa;
  }
}

// ---------------------------------------------------------------------------
// Layer 1: Zero-tolerance illegal content, CSAM, illicit drug & drop-address patterns
// ---------------------------------------------------------------------------

const CSAM_PATTERNS: RegExp[] = [
  /(?:^|[\s_\-./\\])csam(?:[\s_\-./\\]|$)/i,
  /\bchild\s*porn(?:ography)?\b/i,
  /\bunderage\s*(?:nude|nsfw|porn|sex|explicit)\b/i,
  /\bminor\s*(?:nude|nsfw|porn|sex|explicit)\b/i,
  /\bpedo(?:phile|philia)?\b/i,
  /(?:^|[\s_\-.])(?:cp|pthc|pedo)(?:[\s_\-.]|$)/i,
  /児童ポルノ/,
  /児ポ/,
  /児童買春/,
  /(?:未成年|小学生|中学生|幼児|幼女).{0,12}(?:ポルノ|わいせつ|ヌード|無修正|裸|性的|エロ)/,
  /(?:ロリ|ペド).{0,8}(?:実写|写真|無修正|動画)/,
];

const ILLICIT_DRUG_PATTERNS: RegExp[] = [
  /\b(?:meth(?:amphetamine)?|cocaine|heroin|fentanyl|mdma|ecstasy|lsd|ketamine|opium|narcotics?)\b/i,
  /\b(?:drug\s*drop|dead\s*drop|drug\s*delivery|drug\s*traffick(?:ing)?|illegal\s*drugs?|buy\s*weed|sell\s*weed)\b/i,
  /覚醒剤/,
  /覚せい剤/,
  /大麻(?:密売|販売|売買|譲渡|受け渡し|配達)/,
  /麻薬(?:密売|密輸|売買|取引|受け渡し)/,
  /違法薬物/,
  /コカイン/,
  /ヘロイン/,
  /フェンタニル/,
  /シャブ(?:売|買|取引|受け渡し)/,
  /薬物.{0,10}(?:密輸|運搬|運ぶ|受け渡し|配達|住所|ドロップ)/,
  /(?:裏取引|違法取引|密売).{0,12}(?:住所|場所|受け渡し|連絡)/,
];

const DROP_ADDRESS_PATTERNS: RegExp[] = [
  // Japanese postal code + prefecture/city address pattern
  /〒?\s*\d{3}-\d{4}\s*[\u4e00-\u9fff]{2,4}[都道府県]/,
  // Explicit drop / delivery / pickup address instructions
  /(?:受け渡し|受渡|受渡し|配達先|配送先|ドロップ|投函先|引き渡し)(?:場所|住所|ポイント)\s*[:：]/,
  /\b(?:drop|pickup|pick-up|delivery|shipping)\s+(?:address|location|point|coords?)\s*:/i,
  // Street address with number + street suffix + unit/zip
  /\b\d{1,5}\s+[A-Za-z0-9.\- ]{3,40}\s(?:Street|St\.|Avenue|Ave\.|Road|Rd\.|Boulevard|Blvd\.|Drive|Dr\.|Lane|Ln\.|Court|Ct\.)\s*,?\s*(?:Apt\.?|Suite|Unit|#)?\s*\d*/i,
  // Encrypted messenger + illicit pickup/drop context
  /\b(?:telegram|wickr|signal|session)\s*[:@]?\s*[A-Za-z0-9_@.-]{3,32}.{0,40}(?:drop|address|delivery|pickup|package|drug|cash)/i,
];

const CAMERA_EXIF_MARKERS = [
  'Exif\0\0',
  'Canon',
  'NIKON',
  'SONY',
  'FUJIFILM',
  'iPhone',
  'Pixel ',
  'SM-G',
  'SM-S',
  'SM-A',
  'ILCE-',
  'DSC-',
  'ExposureTime',
  'FNumber',
  'ISOSpeedRatings',
];

const GPS_EXIF_MARKERS = ['GPSInfo', 'GPSLatitude', 'GPSLongitude', 'GPSAltitude'];

/**
 * Extracts printable ASCII/UTF-8 metadata snippets from raw image bytes (EXIF / PNG tEXt / iTXt / XMP)
 * without allocating huge strings. Scans up to the first 64 KB and last 16 KB where metadata chunks reside.
 */
function extractEmbeddedMetadataText(rawBytes?: Uint8Array): {
  embeddedText: string;
  hasCameraExif: boolean;
  hasGpsExif: boolean;
} {
  if (!rawBytes || rawBytes.byteLength === 0) {
    return { embeddedText: '', hasCameraExif: false, hasGpsExif: false };
  }

  const headLen = Math.min(rawBytes.byteLength, 65536);
  const tailStart = Math.max(headLen, rawBytes.byteLength - 16384);
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const headStr = decoder.decode(rawBytes.subarray(0, headLen));
  const tailStr =
    tailStart < rawBytes.byteLength ? decoder.decode(rawBytes.subarray(tailStart)) : '';
  const combinedRaw = headStr + '\n' + tailStr;

  const hasCameraExif =
    combinedRaw.includes('Exif\0\0') ||
    CAMERA_EXIF_MARKERS.filter((m) => m !== 'Exif\0\0' && combinedRaw.includes(m)).length >= 2;
  const hasGpsExif = GPS_EXIF_MARKERS.some((m) => combinedRaw.includes(m));

  // Keep only readable runs (>= 4 chars) to avoid binary garbage false positives
  const readableRuns = combinedRaw.match(/[\x20-\x7E\u3000-\u9FFF\uFF00-\uFFEF]{4,}/g) ?? [];
  const embeddedText = readableRuns.slice(0, 400).join(' ');

  return { embeddedText, hasCameraExif, hasGpsExif };
}

function checkTextSafety(text: string): ArtworkSafetyResult | null {
  if (!text.trim()) return null;

  for (const pattern of CSAM_PATTERNS) {
    if (pattern.test(text)) {
      return {
        allowed: false,
        category: 'csam_illegal',
        reasonCode: 'CSAM_OR_ILLEGAL_CONTENT_BLOCKED',
        reasonMessage:
          'Rejected: Illegal content (including CSAM / child exploitation) is strictly prohibited and cannot be added.',
        reasonMessageJa:
          '拒絶されました: 児童ポルノ等の違法コンテンツは一切許可されておらず、作品として追加できません。',
      };
    }
  }

  for (const pattern of ILLICIT_DRUG_PATTERNS) {
    if (pattern.test(text)) {
      return {
        allowed: false,
        category: 'illicit_drugs_or_trafficking',
        reasonCode: 'ILLICIT_DRUGS_BLOCKED',
        reasonMessage:
          'Rejected: Illicit drug or trafficking-related content is strictly prohibited and cannot be added.',
        reasonMessageJa:
          '拒絶されました: 違法薬物・密売・運搬に関連するコンテンツは一切許可されておらず、作品として追加できません。',
      };
    }
  }

  for (const pattern of DROP_ADDRESS_PATTERNS) {
    if (pattern.test(text)) {
      return {
        allowed: false,
        category: 'non_art_address_or_drop',
        reasonCode: 'NON_ART_ADDRESS_BLOCKED',
        reasonMessage:
          'Rejected: Physical delivery/drop addresses or non-artwork transaction instructions cannot be added.',
        reasonMessageJa:
          '拒絶されました: 受け渡し住所・配送先住所・取引指示など、アート作品以外の情報は追加できません。',
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Layer 2: Client-side Pixel Analysis (Skin-Tone NSFW + Photorealism Heuristic)
// ---------------------------------------------------------------------------

function isHumanSkinPixel(r: number, g: number, b: number): boolean {
  if (r <= 95 || g <= 40 || b <= 20) return false;
  const maxRgb = Math.max(r, g, b);
  const minRgb = Math.min(r, g, b);
  if (maxRgb - minRgb <= 15) return false;
  if (Math.abs(r - g) <= 15) return false;
  if (!(r > g && r > b)) return false;

  // Standard YCbCr skin-tone chrominance bounds
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173;
}

function analyzeRasterSafetyMetrics(
  raster: CanonicalRaster,
  hasCameraExif: boolean,
  hasGpsExif: boolean,
): ArtworkSafetyMetrics {
  const { width, height, data: rgba } = raster;
  const maxSampleDim = 160;
  const stepX = Math.max(1, Math.floor(width / maxSampleDim));
  const stepY = Math.max(1, Math.floor(height / maxSampleDim));

  let totalSamples = 0;
  let skinSamples = 0;
  let centerSamples = 0;
  let centerSkinSamples = 0;
  let neighborPairs = 0;
  let flatPairs = 0;
  let microNoisePairs = 0;
  const quantizedColors = new Set<number>();

  const xMinCenter = Math.floor(width * 0.15);
  const xMaxCenter = Math.ceil(width * 0.85);
  const yMinCenter = Math.floor(height * 0.15);
  const yMaxCenter = Math.ceil(height * 0.85);

  for (let y = 0; y < height; y += stepY) {
    const inCenterY = y >= yMinCenter && y <= yMaxCenter;
    for (let x = 0; x < width; x += stepX) {
      const idx = (y * width + x) * 4;
      const r = rgba[idx];
      const g = rgba[idx + 1];
      const b = rgba[idx + 2];
      const a = rgba[idx + 3];

      // Ignore fully transparent background pixels
      if (a < 20) continue;

      totalSamples += 1;
      const qColor = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      quantizedColors.add(qColor);

      const isSkin = isHumanSkinPixel(r, g, b);
      if (isSkin) skinSamples += 1;

      if (inCenterY && x >= xMinCenter && x <= xMaxCenter) {
        centerSamples += 1;
        if (isSkin) centerSkinSamples += 1;
      }

      // Check immediate right neighbor for micro-texture / flat-fill distinction
      if (x + 1 < width) {
        const nIdx = idx + 4;
        if (rgba[nIdx + 3] >= 20) {
          const diff =
            Math.abs(r - rgba[nIdx]) +
            Math.abs(g - rgba[nIdx + 1]) +
            Math.abs(b - rgba[nIdx + 2]);
          neighborPairs += 1;
          if (diff <= 3) {
            flatPairs += 1;
          } else if (diff >= 4 && diff <= 30) {
            microNoisePairs += 1;
          }
        }
      }
    }
  }

  if (totalSamples === 0) {
    return {
      skinRatio: 0,
      centerSkinRatio: 0,
      photorealismScore: 0,
      flatPixelRatio: 1,
      microNoiseRatio: 0,
      hasCameraExif,
      hasGpsExif,
    };
  }

  const skinRatio = skinSamples / totalSamples;
  const centerSkinRatio = centerSamples > 0 ? centerSkinSamples / centerSamples : skinRatio;
  const flatPixelRatio = neighborPairs > 0 ? flatPairs / neighborPairs : 1;
  const microNoiseRatio = neighborPairs > 0 ? microNoisePairs / neighborPairs : 0;

  // Color richness: photographs & photorealistic AI images occupy a broad continuous palette
  const colorRichness = Math.min(1, quantizedColors.size / 180);

  // Photorealism score combines low flat-fill ratio, high micro-texture/sensor noise, and continuous palette
  const nonFlatFactor = Math.max(0, 1 - flatPixelRatio * 1.35);
  const microNoiseFactor = Math.min(1, microNoiseRatio / 0.55);
  const exifBoost = hasCameraExif ? 0.15 : 0;

  const photorealismScore = Math.min(
    1,
    nonFlatFactor * 0.4 + microNoiseFactor * 0.4 + colorRichness * 0.2 + exifBoost,
  );

  return {
    skinRatio,
    centerSkinRatio,
    photorealismScore,
    flatPixelRatio,
    microNoiseRatio,
    hasCameraExif,
    hasGpsExif,
  };
}

/**
 * Evaluates an artwork submission (image + metadata) 100% locally in the browser
 * to block illegal content (CSAM, illicit drugs, drop addresses) and photorealistic / AI-photorealistic NSFW
 * before it can be added to GalleryDeck or certified.
 */
export function evaluateArtworkSafety(input: ArtworkSafetyInput): ArtworkSafetyResult {
  const { embeddedText, hasCameraExif, hasGpsExif } = extractEmbeddedMetadataText(input.rawBytes);

  // 1. Check user-supplied metadata, filename, and embedded image text chunks
  const combinedText = [
    input.fileName ?? '',
    input.title ?? '',
    input.description ?? '',
    input.policyNote ?? '',
    ...(input.tags ?? []),
    embeddedText,
  ]
    .filter(Boolean)
    .join('\n');

  const textRejection = checkTextSafety(combinedText);
  if (textRejection) {
    return textRejection;
  }

  // 2. Check raster pixel heuristics (skip tiny synthetic test images < 48x48)
  if (input.raster && input.raster.width >= 48 && input.raster.height >= 48) {
    const metrics = analyzeRasterSafetyMetrics(input.raster, hasCameraExif, hasGpsExif);

    // Block photorealistic or AI-photorealistic NSFW (high skin exposure + photorealistic texture/EXIF)
    const isPhotorealistic = metrics.photorealismScore >= 0.58 || metrics.hasCameraExif;
    if (
      isPhotorealistic &&
      (metrics.centerSkinRatio >= 0.34 || metrics.skinRatio >= 0.32)
    ) {
      return {
        allowed: false,
        category: 'photorealistic_nsfw',
        reasonCode: 'PHOTOREALISTIC_NSFW_BLOCKED',
        reasonMessage:
          'Rejected: Photorealistic or AI-photorealistic NSFW imagery is not allowed. Only legitimate handmade/digital artwork can be added.',
        reasonMessageJa:
          '拒絶されました: 実写または実写に近いAI生成のNSFW画像は許可されていません。正当なアート作品のみ追加できます。',
        metrics,
      };
    }

    // Block extreme explicit skin-tone exposure even without strong EXIF
    if (
      metrics.centerSkinRatio >= 0.52 &&
      metrics.skinRatio >= 0.45 &&
      metrics.flatPixelRatio < 0.45
    ) {
      return {
        allowed: false,
        category: 'photorealistic_nsfw',
        reasonCode: 'EXPLICIT_NSFW_BLOCKED',
        reasonMessage:
          'Rejected: Explicit NSFW imagery detected and blocked. Only legitimate artwork can be added.',
        reasonMessageJa:
          '拒絶されました: 露骨なNSFW画像と判定されたため追加できません。正当なアート作品のみ追加できます。',
        metrics,
      };
    }

    // Block raw camera photos with GPS location metadata (non-artwork / privacy & safety risk)
    if (metrics.hasCameraExif && metrics.hasGpsExif && metrics.photorealismScore >= 0.65) {
      return {
        allowed: false,
        category: 'non_art_raw_photo',
        reasonCode: 'RAW_GPS_PHOTO_BLOCKED',
        reasonMessage:
          'Rejected: Raw camera photographs with GPS location metadata are not accepted. Please submit artwork files only.',
        reasonMessageJa:
          '拒絶されました: GPS位置情報を含むカメラ生写真（アート作品以外）は追加できません。アート作品ファイルのみ送信してください。',
        metrics,
      };
    }

    return {
      allowed: true,
      reasonMessage: 'OK',
      reasonMessageJa: 'OK',
      metrics,
    };
  }

  return {
    allowed: true,
    reasonMessage: 'OK',
    reasonMessageJa: 'OK',
  };
}

/**
 * Throws an ArtworkSafetyError if the artwork or metadata fails safety screening.
 */
export function assertArtworkSafe(input: ArtworkSafetyInput): ArtworkSafetyResult {
  const result = evaluateArtworkSafety(input);
  if (!result.allowed) {
    throw new ArtworkSafetyError(result);
  }
  return result;
}

/**
 * Formats an ArtworkSafetyError into the active UI locale ('ja' or 'en').
 */
export function formatArtworkSafetyError(err: unknown, locale: 'ja' | 'en' = 'en'): string | null {
  if (err instanceof ArtworkSafetyError) {
    return locale === 'ja' ? err.reasonMessageJa : err.message;
  }
  return null;
}

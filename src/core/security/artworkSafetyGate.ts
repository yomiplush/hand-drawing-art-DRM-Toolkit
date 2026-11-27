import jsQR from 'jsqr';
import type { CanonicalRaster } from '../image/pngCodec';

export type ArtworkSafetyCategory =
  | 'csam_illegal'
  | 'illicit_drugs_or_trafficking'
  | 'non_art_address_or_drop'
  | 'photorealistic_nsfw'
  | 'non_art_raw_photo'
  | 'ai_generated_metadata'
  | 'malicious_embedded_qr'
  | 'harassment_meme_spam';

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
  /** Optional pre-decoded QR/barcode payloads to screen synchronously */
  detectedQrPayloads?: string[];
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

const HARASSMENT_MEME_PATTERNS: RegExp[] = [
  /淫夢/,
  /真夏の夜の淫夢/,
  /野獣先輩/,
  /田所浩二/,
  /田所\s*浩二/,
  /114514/,
  /1919810/,
  /ホモビ/,
  /迫真空手部/,
  /bb先輩/i,
  /例のアレ/,
  /こ↑こ↓/,
  /いいよこいよ/,
  /やりますねぇ/,
  /(?:^|[\s_\-./\\])(?:inmu|yaju|yajuu|tadokoro|kbtit|kmr|mur)(?:[\s_\-./\\]|$)/i,
  /koji\s*tadokoro/i,
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

// AI-generated illustration metadata signatures (PNG tEXt/iTXt/zTXt, EXIF, XMP)
const AI_METADATA_PATTERNS: RegExp[] = [
  // Stable Diffusion / Automatic1111 / Forge / WebUI parameters chunk
  /Negative prompt\s*:/i,
  /Steps\s*:\s*\d+\s*,\s*Sampler\s*:/i,
  /CFG scale\s*:\s*[\d.]+/i,
  /(?:tEXt|iTXt|zTXt)parameters\0/i,
  // NovelAI
  /Software\s*[:\0]?\s*NovelAI/i,
  /\bNovelAI\b/i,
  /\bnai-diffusion/i,
  // ComfyUI
  /\bComfyUI\b/i,
  /"class_type"\s*:\s*"KSampler"/i,
  /"ckpt_name"\s*:\s*"[^"]+\.(?:safetensors|ckpt)"/i,
  // Midjourney / InvokeAI / DreamStudio / Stability AI
  /\bMidjourney\b/i,
  /\binvokeai_metadata\b/i,
  /\bsd-metadata\b/i,
  /\bDreamStudio\b/i,
  /(?:tEXt|iTXt|zTXt)Dream\0/i,
  /Software\s*[:\0]\s*Dream(?:\s+by\s+WOMBO)?\b/i,
  /\bStable\s*Diffusion\b/i,
  /\bAutomatic1111\b/i,
  /TrainedAlgorithmicMedia/i,
];

const QR_EXTERNAL_URL_PATTERN = /https?:\/\//i;
const QR_CONTACT_SCHEME_PATTERN =
  /^(?:mailto:|tel:|tg:|sms:|whatsapp:|signal:)|\b(?:discord\.gg\/|discord\.com\/invite\/|t\.me\/|telegram\.me\/|line\.me\/|wickr|signal\.group)/i;
const QR_TRANSACTION_KEYWORD_PATTERN =
  /\b(?:buy|sell|price|order|shipping|delivery|drop|pickup|pick-up|btc|usdt|monero|xmr|cashapp|venmo)\b|(?:取引|購入|販売|住所|受け渡し|配達|連絡先|口座|振込)/i;

/**
 * Returns true if the decoded QR/barcode payload is a legitimate Certified Handmade
 * offline verification URL or compact proof payload.
 */
export function isLegitimateCertifiedHandmadePayload(rawText: string): boolean {
  const trimmed = rawText.trim();
  if (!trimmed) return false;

  // Compact Base45 proof payload
  if (trimmed.startsWith('45:') && trimmed.length > 20) {
    return true;
  }

  // Official Certified Handmade verification URLs (case-insensitive for QR alphanumeric mode)
  if (
    /^https:\/\/(?:www\.)?certified-handmade\.com\/(?:v|verify)?(?:#(?:proof=|45:|[0-9A-Z $%*+\-./:]{20,})|\?proof=)/i.test(
      trimmed,
    )
  ) {
    return true;
  }

  // Local development verification URLs with #proof=
  if (/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/.*#(?:proof=|45:)/i.test(trimmed)) {
    return true;
  }

  // Portable Proof Bundle JSON
  if (trimmed.startsWith('{') && trimmed.includes('"proofBytes"') && trimmed.includes('certified-handmade')) {
    return true;
  }

  return false;
}

/**
 * Checks decoded QR / barcode payloads for unauthorized external URLs, contact schemes,
 * or illicit transaction / drop-address instructions while allowing legitimate
 * Certified Handmade verification payloads.
 */
export function checkBarcodePayloadsSafety(payloads: string[]): ArtworkSafetyResult | null {
  for (const raw of payloads) {
    const text = raw.trim();
    if (!text) continue;

    if (isLegitimateCertifiedHandmadePayload(text)) {
      continue;
    }

    const textRejection = checkTextSafety(text);
    if (textRejection) {
      return textRejection;
    }

    if (
      QR_EXTERNAL_URL_PATTERN.test(text) ||
      QR_CONTACT_SCHEME_PATTERN.test(text) ||
      QR_TRANSACTION_KEYWORD_PATTERN.test(text)
    ) {
      return {
        allowed: false,
        category: 'malicious_embedded_qr',
        reasonCode: 'EMBEDDED_QR_OR_BARCODE_BLOCKED',
        reasonMessage:
          'Rejected: An embedded QR code or barcode containing an external URL, contact link, or transaction/address data was detected.',
        reasonMessageJa:
          '拒絶されました: 外部URL・連絡先リンク・取引や住所情報を含むQRコード／バーコードが画像内に検出されました。',
      };
    }
  }
  return null;
}

function checkAiMetadataSafety(rawMetadataStr: string): ArtworkSafetyResult | null {
  if (!rawMetadataStr) return null;
  for (const pattern of AI_METADATA_PATTERNS) {
    if (pattern.test(rawMetadataStr)) {
      return {
        allowed: false,
        category: 'ai_generated_metadata',
        reasonCode: 'AI_GENERATED_METADATA_BLOCKED',
        reasonMessage:
          'Rejected: AI-generated image metadata (e.g., Stable Diffusion, NovelAI, ComfyUI, Midjourney) was detected. Certified Handmade is strictly for human-made artwork.',
        reasonMessageJa:
          '拒絶されました: AI生成ツール（Stable Diffusion / NovelAI / ComfyUI / Midjourney等）のメタデータが検出されました。Certified Handmadeは手描き・人間制作のアート作品専用です。',
      };
    }
  }
  return null;
}

/**
 * Extracts printable ASCII/UTF-8 metadata snippets from raw image bytes (EXIF / PNG tEXt / iTXt / XMP)
 * without allocating huge strings. Scans up to the first 64 KB and last 16 KB where metadata chunks reside.
 */
function extractEmbeddedMetadataText(rawBytes?: Uint8Array): {
  embeddedText: string;
  combinedRaw: string;
  hasCameraExif: boolean;
  hasGpsExif: boolean;
} {
  if (!rawBytes || rawBytes.byteLength === 0) {
    return { embeddedText: '', combinedRaw: '', hasCameraExif: false, hasGpsExif: false };
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

  return { embeddedText, combinedRaw, hasCameraExif, hasGpsExif };
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
  const { embeddedText, combinedRaw, hasCameraExif, hasGpsExif } = extractEmbeddedMetadataText(
    input.rawBytes,
  );

  // 1a. Check user-supplied metadata, filename, and embedded image text chunks
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

  for (const pattern of HARASSMENT_MEME_PATTERNS) {
    if (pattern.test(combinedText)) {
      return {
        allowed: false,
        category: 'harassment_meme_spam',
        reasonCode: 'HARASSMENT_MEME_BLOCKED',
        reasonMessage:
          'Rejected: Prohibited live-action meme / harassment spam content is not accepted.',
        reasonMessageJa:
          '拒絶されました: 実写ミーム・荒らし・不適切コンテンツ関連のファイルは追加できません。',
      };
    }
  }

  // 1b. Check embedded file metadata (PNG tEXt/iTXt/zTXt, EXIF, XMP) for AI generation signatures
  const aiMetaRejection = checkAiMetadataSafety(combinedRaw);
  if (aiMetaRejection) {
    return aiMetaRejection;
  }

  // 1c. Check any pre-decoded QR/barcode payloads synchronously
  if (input.detectedQrPayloads && input.detectedQrPayloads.length > 0) {
    const qrRejection = checkBarcodePayloadsSafety(input.detectedQrPayloads);
    if (qrRejection) {
      return qrRejection;
    }
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

// ---------------------------------------------------------------------------
// Layer 3: Local QR / Barcode Pixel Scanner (BarcodeDetector API + jsQR fallback)
// ---------------------------------------------------------------------------

interface BarcodeDetectorLike {
  detect(source: unknown): Promise<Array<{ rawValue?: string }>>;
}

interface BarcodeDetectorConstructorLike {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
}

function downscaleRasterForQrScan(
  raster: CanonicalRaster,
  maxDim = 640,
): { data: Uint8ClampedArray; width: number; height: number } {
  const { width, height, data } = raster;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));
  const out = new Uint8ClampedArray(targetW * targetH * 4);
  for (let y = 0; y < targetH; y++) {
    const sy = Math.min(height - 1, Math.floor((y / targetH) * height));
    for (let x = 0; x < targetW; x++) {
      const sx = Math.min(width - 1, Math.floor((x / targetW) * width));
      const si = (sy * width + sx) * 4;
      const di = (y * targetW + x) * 4;
      const a = data[si + 3];
      if (a === 255) {
        out[di] = data[si];
        out[di + 1] = data[si + 1];
        out[di + 2] = data[si + 2];
      } else {
        const inv = 255 - a;
        out[di] = Math.round((data[si] * a + 255 * inv) / 255);
        out[di + 1] = Math.round((data[si + 1] * a + 255 * inv) / 255);
        out[di + 2] = Math.round((data[si + 2] * a + 255 * inv) / 255);
      }
      out[di + 3] = 255;
    }
  }
  return { data: out, width: targetW, height: targetH };
}

/**
 * Scans a raster locally for embedded QR codes and barcodes.
 * Prefers the browser-native BarcodeDetector API and falls back to lightweight jsQR scanning.
 */
export async function scanRasterBarcodes(raster: CanonicalRaster): Promise<string[]> {
  if (raster.width < 32 || raster.height < 32) {
    return [];
  }

  const found = new Set<string>();
  const scaled = downscaleRasterForQrScan(raster, 640);

  // 1. Prefer native BarcodeDetector API when available in the browser
  const globalObj = globalThis as unknown as {
    BarcodeDetector?: BarcodeDetectorConstructorLike;
    OffscreenCanvas?: new (w: number, h: number) => {
      getContext(type: '2d'): { putImageData(img: ImageData, x: number, y: number): void } | null;
    };
    document?: Document;
    ImageData?: typeof ImageData;
  };

  if (typeof globalObj.BarcodeDetector === 'function' && typeof globalObj.ImageData === 'function') {
    try {
      const detector = new globalObj.BarcodeDetector({
        formats: ['qr_code', 'aztec', 'data_matrix', 'pdf417', 'code_128', 'ean_13', 'ean_8', 'upc_a'],
      });
      const imgData = new globalObj.ImageData(
        new Uint8ClampedArray(scaled.data),
        scaled.width,
        scaled.height,
      );
      let source: unknown = imgData;
      if (typeof globalObj.OffscreenCanvas === 'function') {
        const canvas = new globalObj.OffscreenCanvas(scaled.width, scaled.height);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.putImageData(imgData, 0, 0);
          source = canvas;
        }
      } else if (typeof globalObj.document?.createElement === 'function') {
        const canvas = globalObj.document.createElement('canvas');
        canvas.width = scaled.width;
        canvas.height = scaled.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.putImageData(imgData, 0, 0);
          source = canvas;
        }
      }
      const detections = await detector.detect(source);
      for (const item of detections) {
        if (item.rawValue && item.rawValue.trim()) {
          found.add(item.rawValue.trim());
        }
      }
    } catch {
      // Safely fall through to jsQR fallback
    }
  }

  // 2. Lightweight jsQR fallback for browsers without BarcodeDetector (Firefox/Safari/Node)
  if (found.size === 0) {
    try {
      const qr = jsQR(scaled.data, scaled.width, scaled.height, {
        inversionAttempts: 'attemptBoth',
      });
      if (qr?.data && qr.data.trim()) {
        found.add(qr.data.trim());
      }
    } catch {
      // Safe skip
    }
  }

  return Array.from(found);
}

/**
 * Full async safety evaluation: runs Layer 1 (metadata/AI), Layer 2 (pixel heuristics),
 * and Layer 3 (local QR/barcode scanning) 100% client-side.
 */
export async function evaluateArtworkSafetyAsync(
  input: ArtworkSafetyInput,
): Promise<ArtworkSafetyResult> {
  const syncResult = evaluateArtworkSafety(input);
  if (!syncResult.allowed) {
    return syncResult;
  }

  if (input.raster) {
    const scannedPayloads = await scanRasterBarcodes(input.raster);
    if (scannedPayloads.length > 0) {
      const qrRejection = checkBarcodePayloadsSafety(scannedPayloads);
      if (qrRejection) {
        return {
          ...qrRejection,
          metrics: syncResult.metrics,
        };
      }
    }
  }

  return syncResult;
}

/**
 * Throws an ArtworkSafetyError if the artwork or metadata fails full async safety screening.
 */
export async function assertArtworkSafeAsync(
  input: ArtworkSafetyInput,
): Promise<ArtworkSafetyResult> {
  const result = await evaluateArtworkSafetyAsync(input);
  if (!result.allowed) {
    throw new ArtworkSafetyError(result);
  }
  return result;
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

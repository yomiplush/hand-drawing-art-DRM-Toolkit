import type { CanonicalRaster } from '../image/pngCodec';
import type { ArtworkRegion } from '../manifest/types';

export interface PixelForensicsResult {
  pixelAiSignals: string[];
  aiSignalScore: number;
  smoothNoiseLuma: number;
  smoothNoiseChroma: number;
  upsampleGridAnomaly: number;
  stealthWatermarkDetected: boolean;
}

const KNOWN_AI_DIMENSIONS = new Set<string>([
  '1024x1024',
  '1024x1536',
  '1536x1024',
  '1024x1792',
  '1792x1024',
  '1086x1448',
  '1448x1086',
  '896x1152',
  '1152x896',
  '832x1216',
  '1216x832',
  '768x1344',
  '1344x768',
  '640x1536',
  '1536x640',
  '1408x768',
  '768x1408',
  '1280x896',
  '896x1280',
  '1152x896',
  '1200x1200',
  '1024x1280',
  '1280x1024',
  '1376x768',
  '768x1376',
]);

function intersectsMask(
  x: number,
  y: number,
  w: number,
  h: number,
  qrMask?: ArtworkRegion | null,
): boolean {
  if (!qrMask) return false;
  const [mx, my, mw, mh] = qrMask;
  return x + w > mx && x < mx + mw && y + h > my && y < my + mh;
}

/**
 * Checks for NovelAI stealth_pnginfo / stealth_pngcomp watermarks in Alpha or RGB LSBs
 * (column-major MSB-first bit stream). Exact 15-byte ASCII signature check (2^-120 false positive rate).
 */
export function detectStealthLsbWatermark(
  raster: CanonicalRaster,
  region: ArtworkRegion,
): string | null {
  const [rx, ry, rw, rh] = region;
  if (rw < 16 || rh < 16) return null;

  const magics = ['stealth_pnginfo', 'stealth_pngcomp'];

  // Alpha channel column-major LSB
  const extractColMajorAlphaBytes = (byteCount: number): string => {
    let out = '';
    let bitIdx = 0;
    let curByte = 0;
    for (let x = rx; x < rx + rw && out.length < byteCount; x++) {
      for (let y = ry; y < ry + rh && out.length < byteCount; y++) {
        const bit = raster.data[(y * raster.width + x) * 4 + 3] & 1;
        curByte = (curByte << 1) | bit;
        bitIdx++;
        if (bitIdx === 8) {
          out += String.fromCharCode(curByte);
          curByte = 0;
          bitIdx = 0;
        }
      }
    }
    return out;
  };

  // RGB 3-bits-per-pixel column-major LSB
  const extractColMajorRgbBytes = (byteCount: number): string => {
    let out = '';
    let bitIdx = 0;
    let curByte = 0;
    for (let x = rx; x < rx + rw && out.length < byteCount; x++) {
      for (let y = ry; y < ry + rh && out.length < byteCount; y++) {
        const idx = (y * raster.width + x) * 4;
        for (let c = 0; c < 3 && out.length < byteCount; c++) {
          const bit = raster.data[idx + c] & 1;
          curByte = (curByte << 1) | bit;
          bitIdx++;
          if (bitIdx === 8) {
            out += String.fromCharCode(curByte);
            curByte = 0;
            bitIdx = 0;
          }
        }
      }
    }
    return out;
  };

  const alphaHeader = extractColMajorAlphaBytes(15);
  for (const magic of magics) {
    if (alphaHeader === magic) return `Stealth Alpha LSB Watermark (${magic})`;
  }
  const rgbHeader = extractColMajorRgbBytes(15);
  for (const magic of magics) {
    if (rgbHeader === magic) return `Stealth RGB LSB Watermark (${magic})`;
  }
  return null;
}

export function analyzePixelForensics(
  raster: CanonicalRaster,
  region: ArtworkRegion,
  qrMask?: ArtworkRegion | null,
): PixelForensicsResult {
  const [rx, ry, rw, rh] = region;
  if (rw < 64 || rh < 64) {
    return {
      pixelAiSignals: [],
      aiSignalScore: 0,
      smoothNoiseLuma: 0,
      smoothNoiseChroma: 0,
      upsampleGridAnomaly: 0,
      stealthWatermarkDetected: false,
    };
  }

  const signals: string[] = [];
  let score = 0;

  // 1. Deterministic Stealth LSB Watermark (NovelAI etc.)
  const stealthHit = detectStealthLsbWatermark(raster, region);
  const stealthWatermarkDetected = Boolean(stealthHit);
  if (stealthHit) {
    signals.push(stealthHit);
    score += 3;
  }

  // 2. Smooth-region 8x8 patch diffusion/VAE micro-grain analysis (excluding qrMask & transparent margins)
  const data = raster.data;
  const strideW = raster.width;
  const stepP = Math.max(8, Math.floor(Math.sqrt((rw * rh) / 600) / 8) * 8);

  let totalPatches = 0;
  let exactZeroPatches = 0;
  let smoothPatches = 0;
  let smoothLumaLapSum = 0;
  let smoothChromaLapSum = 0;
  let smoothMicroNoisePixels = 0;
  let smoothPixelsTotal = 0;

  for (let py = ry + 8; py + 10 < ry + rh; py += stepP) {
    for (let px = rx + 8; px + 10 < rx + rw; px += stepP) {
      if (intersectsMask(px, py, 8, 8, qrMask)) continue;

      let minL = 255;
      let maxL = 0;
      let hasTransparent = false;
      for (let dy = 0; dy < 8 && !hasTransparent; dy++) {
        for (let dx = 0; dx < 8; dx++) {
          const i = ((py + dy) * strideW + (px + dx)) * 4;
          if (data[i + 3] < 245) {
            hasTransparent = true;
            break;
          }
          const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          if (l < minL) minL = l;
          if (l > maxL) maxL = l;
        }
      }
      if (hasTransparent) continue;

      totalPatches++;
      if (maxL - minL === 0) exactZeroPatches++;
      if (maxL - minL <= 24) {
        smoothPatches++;
        let lapL = 0;
        let lapC = 0;
        let n = 0;
        for (let dy = 1; dy < 7; dy++) {
          for (let dx = 1; dx < 7; dx++) {
            const idx = ((py + dy) * strideW + (px + dx)) * 4;
            const lIdx = idx - 4;
            const rIdx = idx + 4;
            const uIdx = idx - strideW * 4;
            const dIdx = idx + strideW * 4;

            const lc = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            const ll = 0.299 * data[lIdx] + 0.587 * data[lIdx + 1] + 0.114 * data[lIdx + 2];
            const lr = 0.299 * data[rIdx] + 0.587 * data[rIdx + 1] + 0.114 * data[rIdx + 2];
            const lu = 0.299 * data[uIdx] + 0.587 * data[uIdx + 1] + 0.114 * data[uIdx + 2];
            const ld = 0.299 * data[dIdx] + 0.587 * data[dIdx + 1] + 0.114 * data[dIdx + 2];
            const valL = Math.abs(4 * lc - ll - lr - lu - ld);

            const cg = data[idx] - data[idx + 1];
            const lg = data[lIdx] - data[lIdx + 1];
            const rg = data[rIdx] - data[rIdx + 1];
            const ug = data[uIdx] - data[uIdx + 1];
            const dg = data[dIdx] - data[dIdx + 1];
            const valC = Math.abs(4 * cg - lg - rg - ug - dg);

            lapL += valL;
            lapC += valC;
            n++;
            smoothPixelsTotal++;
            if (valL >= 0.8 || valC >= 1.0) smoothMicroNoisePixels++;
          }
        }
        smoothLumaLapSum += lapL / n;
        smoothChromaLapSum += lapC / n;
      }
    }
  }

  const exactZeroPatchRatio = exactZeroPatches / Math.max(1, totalPatches);
  const smoothPatchRatio = smoothPatches / Math.max(1, totalPatches);
  const smoothNoiseLuma = smoothPatches > 0 ? smoothLumaLapSum / smoothPatches : 0;
  const smoothNoiseChroma = smoothPatches > 0 ? smoothChromaLapSum / smoothPatches : 0;
  const smoothMicroNoiseRatio =
    smoothPixelsTotal > 0 ? smoothMicroNoisePixels / smoothPixelsTotal : 0;

  if (
    smoothPatches >= 12 &&
    smoothPatchRatio >= 0.12 &&
    exactZeroPatchRatio <= 0.02 &&
    smoothNoiseLuma >= 1.45 &&
    smoothNoiseChroma >= 1.65 &&
    smoothMicroNoiseRatio >= 0.78
  ) {
    signals.push(
      `Pervasive smooth-region diffusion/VAE micro-noise (luma ${smoothNoiseLuma.toFixed(2)}, chroma ${smoothNoiseChroma.toFixed(2)})`,
    );
    score += 1;
  }

  // 3. 2D Latent Upsampling / Grid Autocorrelation + Spectral Roll-Off + Checkerboard Asymmetry
  const acX = [0, 0, 0];
  const acY = [0, 0, 0];
  const bands = new Float64Array(8);
  let bandTotal = 0;
  const mod2Even = [0, 0];
  const mod2Odd = [0, 0];

  const rowStep = Math.max(2, Math.floor(rh / 160));
  for (let y = ry + 8; y < ry + rh - 8; y += rowStep) {
    if (qrMask && y >= qrMask[1] && y < qrMask[1] + qrMask[3]) continue;
    const len = Math.min(256, rw - 16);
    if (len < 64) continue;
    const xStart = rx + Math.max(8, Math.floor((rw - len) / 2));
    const res = new Float64Array(len);
    const diff = new Float64Array(len);
    let transparentRow = false;
    for (let x = 0; x < len; x++) {
      const idx = (y * strideW + (xStart + x)) * 4;
      if (data[idx + 3] < 245) {
        transparentRow = true;
        break;
      }
      const l = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const ll = 0.299 * data[idx - 4] + 0.587 * data[idx - 3] + 0.114 * data[idx - 2];
      const lr = 0.299 * data[idx + 4] + 0.587 * data[idx + 5] + 0.114 * data[idx + 6];
      res[x] = l - 0.5 * (ll + lr);
      diff[x] = (l - ll) * (0.5 - 0.5 * Math.cos((2 * Math.PI * x) / len));
      if ((x + y) % 2 === 0) mod2Even[0] += Math.abs(res[x]);
      else mod2Odd[0] += Math.abs(res[x]);
      mod2Even[1] += (x + y) % 2 === 0 ? 1 : 0;
      mod2Odd[1] += (x + y) % 2 === 1 ? 1 : 0;
    }
    if (transparentRow) continue;

    for (let i = 0; i < len - 3; i++) {
      acX[0] += res[i] * res[i];
      acX[1] += res[i] * res[i + 1];
      acX[2] += res[i] * res[i + 2];
    }
    if (len >= 128) {
      for (let k = 1; k <= 64; k += 2) {
        let re = 0;
        let im = 0;
        const w = (2 * Math.PI * k) / 128;
        for (let x = 0; x < 128; x++) {
          re += diff[x] * Math.cos(w * x);
          im -= diff[x] * Math.sin(w * x);
        }
        const p = re * re + im * im;
        bands[Math.min(7, Math.floor((k - 1) / 8))] += p;
        bandTotal += p;
      }
    }
  }

  const colStep = Math.max(2, Math.floor(rw / 160));
  for (let x = rx + 8; x < rx + rw - 8; x += colStep) {
    if (qrMask && x >= qrMask[0] && x < qrMask[0] + qrMask[2]) continue;
    const len = Math.min(256, rh - 16);
    if (len < 64) continue;
    const yStart = ry + Math.max(8, Math.floor((rh - len) / 2));
    const res = new Float64Array(len);
    let transparentCol = false;
    for (let y = 0; y < len; y++) {
      const idx = ((yStart + y) * strideW + x) * 4;
      if (data[idx + 3] < 245) {
        transparentCol = true;
        break;
      }
      const uIdx = idx - strideW * 4;
      const dIdx = idx + strideW * 4;
      const l = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const lu = 0.299 * data[uIdx] + 0.587 * data[uIdx + 1] + 0.114 * data[uIdx + 2];
      const ld = 0.299 * data[dIdx] + 0.587 * data[dIdx + 1] + 0.114 * data[dIdx + 2];
      res[y] = l - 0.5 * (lu + ld);
    }
    if (transparentCol) continue;

    for (let i = 0; i < len - 3; i++) {
      acY[0] += res[i] * res[i];
      acY[1] += res[i] * res[i + 1];
      acY[2] += res[i] * res[i + 2];
    }
  }

  const acX1 = acX[0] > 0 ? acX[1] / acX[0] : 0;
  const acX2 = acX[0] > 0 ? acX[2] / acX[0] : 0;
  const acY1 = acY[0] > 0 ? acY[1] / acY[0] : 0;
  const acY2 = acY[0] > 0 ? acY[2] / acY[0] : 0;
  const upsampleGridAnomaly = Math.max(0, Math.min(acX1 - acX2, acY1 - acY2));

  if (
    exactZeroPatchRatio <= 0.03 &&
    acX2 < acX1 - 0.18 &&
    acY2 < acY1 - 0.18 &&
    acX2 <= -0.32 &&
    acY2 <= -0.32
  ) {
    signals.push(
      `2D latent upsampling / VAE grid autocorrelation (lag-2 X:${acX2.toFixed(2)}, Y:${acY2.toFixed(2)})`,
    );
    score += 1;
  }

  const midFreqShare = bandTotal > 0 ? (bands[1] + bands[2] + bands[3]) / bandTotal : 0;
  const nyquistShare = bandTotal > 0 ? (bands[6] + bands[7]) / bandTotal : 0;
  if (
    exactZeroPatchRatio <= 0.03 &&
    midFreqShare >= 0.45 &&
    nyquistShare > 0 &&
    nyquistShare < 0.075 &&
    smoothNoiseLuma >= 1.2
  ) {
    signals.push(
      `Generative mid-band spectral plateau & Nyquist roll-off (${Math.round(midFreqShare * 100)}% mid vs ${Math.round(nyquistShare * 100)}% high)`,
    );
    score += 1;
  }

  // Transposed-conv 2x2 checkerboard parity asymmetry (common in GANs & certain VAEs)
  if (mod2Even[1] > 500 && mod2Odd[1] > 500) {
    const evenMean = mod2Even[0] / mod2Even[1];
    const oddMean = mod2Odd[0] / mod2Odd[1];
    const parityRatio = Math.abs(evenMean - oddMean) / Math.max(0.001, evenMean + oddMean);
    if (parityRatio >= 0.16 && smoothNoiseLuma >= 0.8) {
      signals.push(`2x2 checkerboard residual parity asymmetry (${(parityRatio * 100).toFixed(1)}%)`);
      score += 1;
    }
  }

  // Supporting dimension context ONLY when independent forensic score is already >= 2
  const dimKey = `${rw}x${rh}`;
  if (score >= 2 && KNOWN_AI_DIMENSIONS.has(dimKey)) {
    signals.push(`Common AI generator output dimensions (${dimKey})`);
  }

  return {
    pixelAiSignals: signals,
    aiSignalScore: score,
    smoothNoiseLuma,
    smoothNoiseChroma,
    upsampleGridAnomaly,
    stealthWatermarkDetected,
  };
}

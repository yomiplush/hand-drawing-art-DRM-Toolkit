import type { CanonicalRaster } from './pngCodec';

export interface PerceptualHashes {
  dHashHex: string; // 16 hex chars (64-bit difference hash)
  pHashHex: string; // 16 hex chars (64-bit DCT perceptual hash)
  dHashBits: bigint;
  pHashBits: bigint;
  sourceWidth: number;
  sourceHeight: number;
}

export type VisualSimilarityBand = 'high' | 'moderate' | 'low';

export interface PerceptualComparisonResult {
  dHashHamming: number; // 0..64 (lower = closer)
  pHashHamming: number; // 0..64 (lower = closer)
  dHashSimilarityPct: number; // 0..100
  pHashSimilarityPct: number; // 0..100
  combinedSimilarityPct: number; // 0..100
  band: VisualSimilarityBand;
  isCryptographic: false;
}

/**
 * Downsamples un-premultiplied RGBA8 raster into area-averaged grayscale luminance [0..255]
 * composited over white for transparent pixels. Purely visual helper; NOT cryptographic.
 */
function downsampleGrayscaleBox(raster: CanonicalRaster, dstW: number, dstH: number): Float64Array {
  const { width: srcW, height: srcH, data } = raster;
  const out = new Float64Array(dstW * dstH);

  for (let dy = 0; dy < dstH; dy++) {
    const sy0 = Math.floor((dy * srcH) / dstH);
    const sy1 = Math.max(sy0 + 1, Math.floor(((dy + 1) * srcH) / dstH));
    for (let dx = 0; dx < dstW; dx++) {
      const sx0 = Math.floor((dx * srcW) / dstW);
      const sx1 = Math.max(sx0 + 1, Math.floor(((dx + 1) * srcW) / dstW));

      let sumLum = 0;
      let count = 0;
      for (let sy = sy0; sy < sy1 && sy < srcH; sy++) {
        const rowOffset = sy * srcW * 4;
        for (let sx = sx0; sx < sx1 && sx < srcW; sx++) {
          const i = rowOffset + sx * 4;
          const a = data[i + 3] / 255;
          const invA = 1 - a;
          const r = data[i] * a + 255 * invA;
          const g = data[i + 1] * a + 255 * invA;
          const b = data[i + 2] * a + 255 * invA;
          sumLum += 0.299 * r + 0.587 * g + 0.114 * b;
          count++;
        }
      }
      out[dy * dstW + dx] = count > 0 ? sumLum / count : 0;
    }
  }
  return out;
}

const DCT_SIZE = 32;
const DCT_COS_TABLE: Float64Array = (() => {
  const table = new Float64Array(DCT_SIZE * DCT_SIZE);
  for (let u = 0; u < DCT_SIZE; u++) {
    const alpha = u === 0 ? Math.sqrt(1 / DCT_SIZE) : Math.sqrt(2 / DCT_SIZE);
    for (let x = 0; x < DCT_SIZE; x++) {
      table[u * DCT_SIZE + x] = alpha * Math.cos(((2 * x + 1) * u * Math.PI) / (2 * DCT_SIZE));
    }
  }
  return table;
})();

export function computeDHash64(raster: CanonicalRaster): bigint {
  const gray = downsampleGrayscaleBox(raster, 9, 8);
  let bits = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = gray[y * 9 + x];
      const right = gray[y * 9 + x + 1];
      bits = (bits << 1n) | (left > right ? 1n : 0n);
    }
  }
  return bits;
}

export function computePHash64(raster: CanonicalRaster): bigint {
  const gray = downsampleGrayscaleBox(raster, DCT_SIZE, DCT_SIZE);

  // 1D DCT along rows for low-frequency components u = 0..8
  const rowDct = new Float64Array(DCT_SIZE * 9);
  for (let y = 0; y < DCT_SIZE; y++) {
    const rowOff = y * DCT_SIZE;
    for (let u = 0; u < 9; u++) {
      let sum = 0;
      const cosOff = u * DCT_SIZE;
      for (let x = 0; x < DCT_SIZE; x++) {
        sum += gray[rowOff + x] * DCT_COS_TABLE[cosOff + x];
      }
      rowDct[y * 9 + u] = sum;
    }
  }

  // 1D DCT along columns for v = 0..8, extracting 64 AC coefficients:
  // (v = 0..7, u = 0..7) except DC (0, 0), which is replaced with (8, 8).
  const coeffs: number[] = [];
  for (let v = 0; v < 8; v++) {
    const cosVOff = v * DCT_SIZE;
    for (let u = 0; u < 8; u++) {
      if (v === 0 && u === 0) continue;
      let sum = 0;
      for (let y = 0; y < DCT_SIZE; y++) {
        sum += rowDct[y * 9 + u] * DCT_COS_TABLE[cosVOff + y];
      }
      coeffs.push(sum);
    }
  }
  // 64th coefficient: (v=8, u=8)
  {
    let sum = 0;
    const cos8Off = 8 * DCT_SIZE;
    for (let y = 0; y < DCT_SIZE; y++) {
      sum += rowDct[y * 9 + 8] * DCT_COS_TABLE[cos8Off + y];
    }
    coeffs.push(sum);
  }

  const sorted = [...coeffs].sort((a, b) => a - b);
  const median = (sorted[31] + sorted[32]) / 2;

  let bits = 0n;
  for (let i = 0; i < 64; i++) {
    bits = (bits << 1n) | (coeffs[i] > median ? 1n : 0n);
  }
  return bits;
}

export function computePerceptualHashes(raster: CanonicalRaster): PerceptualHashes {
  if (raster.width < 1 || raster.height < 1 || raster.data.length !== raster.width * raster.height * 4) {
    throw new Error('Invalid CanonicalRaster for perceptual hashing');
  }
  const dHashBits = computeDHash64(raster);
  const pHashBits = computePHash64(raster);
  return {
    dHashBits,
    pHashBits,
    dHashHex: dHashBits.toString(16).padStart(16, '0'),
    pHashHex: pHashBits.toString(16).padStart(16, '0'),
    sourceWidth: raster.width,
    sourceHeight: raster.height,
  };
}

export function hammingDistance64(a: bigint, b: bigint): number {
  let x = (a ^ b) & 0xffffffffffffffffn;
  let count = 0;
  while (x !== 0n) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}

export function comparePerceptualHashes(
  reference: PerceptualHashes,
  candidate: PerceptualHashes,
): PerceptualComparisonResult {
  const dHashHamming = hammingDistance64(reference.dHashBits, candidate.dHashBits);
  const pHashHamming = hammingDistance64(reference.pHashBits, candidate.pHashBits);

  const dHashSimilarityPct = Math.round(((64 - dHashHamming) / 64) * 1000) / 10;
  const pHashSimilarityPct = Math.round(((64 - pHashHamming) / 64) * 1000) / 10;
  const combinedSimilarityPct = Math.round(((128 - dHashHamming - pHashHamming) / 128) * 1000) / 10;

  let band: VisualSimilarityBand = 'low';
  if (dHashHamming <= 10 && pHashHamming <= 10) {
    band = 'high';
  } else if (dHashHamming <= 18 && pHashHamming <= 18) {
    band = 'moderate';
  }

  return {
    dHashHamming,
    pHashHamming,
    dHashSimilarityPct,
    pHashSimilarityPct,
    combinedSimilarityPct,
    band,
    isCryptographic: false,
  };
}

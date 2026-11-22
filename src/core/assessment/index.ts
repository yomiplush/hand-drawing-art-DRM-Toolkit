import type { CanonicalRaster } from '../image/pngCodec';
import type {
  ArtworkRegion,
  HumanMadeAssessmentMetrics,
  HumanMadeAssessmentResult,
} from '../manifest/types';
import { scanImageContainerMetadata } from './metadataScanner';
import { analyzePixelForensics } from './pixelForensics';

export type { HumanMadeAssessmentMetrics, HumanMadeAssessmentResult };

export interface AssessmentInput {
  raster?: CanonicalRaster | null;
  region?: ArtworkRegion | null;
  qrMask?: ArtworkRegion | null;
  rawFileBytes?: Uint8Array | null;
}

export interface HumanMadeAssessor {
  readonly id: string;
  readonly isModelBundled: boolean;
  assess(input?: CanonicalRaster | AssessmentInput | null): Promise<HumanMadeAssessmentResult>;
}

const MAX_SAMPLED_PIXELS = 160_000;

function isAssessmentInput(
  val: CanonicalRaster | AssessmentInput | null | undefined,
): val is AssessmentInput {
  return Boolean(val && typeof val === 'object' && ('raster' in val || 'rawFileBytes' in val));
}

function resolveRegion(
  raster: CanonicalRaster,
  region?: ArtworkRegion | null,
): [number, number, number, number] {
  if (region) {
    const [rx, ry, rw, rh] = region;
    if (
      rx >= 0 &&
      ry >= 0 &&
      rw > 0 &&
      rh > 0 &&
      rx + rw <= raster.width &&
      ry + rh <= raster.height
    ) {
      return [rx, ry, rw, rh];
    }
  }
  return [0, 0, raster.width, raster.height];
}

function inMask(x: number, y: number, qrMask?: ArtworkRegion | null): boolean {
  if (!qrMask) return false;
  return x >= qrMask[0] && x < qrMask[0] + qrMask[2] && y >= qrMask[1] && y < qrMask[1] + qrMask[3];
}

function lumaAt(data: Uint8Array, width: number, x: number, y: number): number {
  const i = (y * width + x) * 4;
  return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
}

function analyzeRasterSignals(
  raster: CanonicalRaster,
  region?: ArtworkRegion | null,
  qrMask?: ArtworkRegion | null,
): {
  artworkWidth: number;
  artworkHeight: number;
  opaqueRatio: number;
  transparentRatio: number;
  semiTransparentRatio: number;
  edgeDensity: number;
  meanGradient: number;
  flatRegionRatio: number;
  sampledColorBuckets: number;
} {
  const [rx, ry, rw, rh] = resolveRegion(raster, region);
  const step = Math.max(1, Math.floor(Math.sqrt((rw * rh) / MAX_SAMPLED_PIXELS)));

  let totalSamples = 0;
  let opaqueCount = 0;
  let transparentCount = 0;
  let semiTransparentCount = 0;

  let gradSamples = 0;
  let gradSum = 0;
  let edgeCount = 0;
  let flatCount = 0;

  const colorBuckets = new Set<number>();
  const data = raster.data;
  const strideW = raster.width;

  for (let y = ry; y < ry + rh; y += step) {
    for (let x = rx; x < rx + rw; x += step) {
      if (inMask(x, y, qrMask)) continue;

      const idx = (y * strideW + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      totalSamples++;
      if (a === 255) {
        opaqueCount++;
      } else if (a === 0) {
        transparentCount++;
      } else {
        semiTransparentCount++;
      }

      if (a > 0) {
        const bucket = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
        colorBuckets.add(bucket);
      }

      if (x + step < rx + rw && y + step < ry + rh && !inMask(x + step, y + step, qrMask)) {
        const c = lumaAt(data, strideW, x, y);
        const dx = Math.abs(c - lumaAt(data, strideW, x + step, y));
        const dy = Math.abs(c - lumaAt(data, strideW, x, y + step));
        const grad = (dx + dy) * 0.5;
        gradSamples++;
        gradSum += grad;
        if (grad > 12) edgeCount++;
        if (grad <= 1) flatCount++;
      }
    }
  }

  const safeTotal = Math.max(1, totalSamples);
  const safeGrad = Math.max(1, gradSamples);

  return {
    artworkWidth: rw,
    artworkHeight: rh,
    opaqueRatio: opaqueCount / safeTotal,
    transparentRatio: transparentCount / safeTotal,
    semiTransparentRatio: semiTransparentCount / safeTotal,
    edgeDensity: edgeCount / safeGrad,
    meanGradient: gradSum / safeGrad,
    flatRegionRatio: flatCount / safeGrad,
    sampledColorBuckets: colorBuckets.size,
  };
}

/**
 * 100% local, zero-cost, zero-external-API forensic signal + container metadata assessor.
 * Never claims definitive proof of human-only authorship from pixels alone; reports
 * observable container metadata, generative pixel/spectral artifacts, and raster statistics transparently.
 */
export const localHeuristicAssessor: HumanMadeAssessor = {
  id: 'local-heuristic-forensics-v2',
  isModelBundled: false,
  async assess(input?: CanonicalRaster | AssessmentInput | null): Promise<HumanMadeAssessmentResult> {
    const raster = isAssessmentInput(input) ? (input.raster ?? null) : (input ?? null);
    const region = isAssessmentInput(input) ? (input.region ?? null) : null;
    const qrMask = isAssessmentInput(input) ? (input.qrMask ?? null) : null;
    const rawFileBytes = isAssessmentInput(input) ? (input.rawFileBytes ?? null) : null;

    if (!raster) {
      return {
        status: 'not-assessed',
        modelId: null,
        summaryKey: 'no-image',
        metrics: null,
        notes: [
          'No artwork image pixels were provided; load the artwork file or signed PNG to run local signal checks.',
        ],
      };
    }

    const resolvedRegion = resolveRegion(raster, region);
    const [meta, pixelSignals, forensics] = await Promise.all([
      scanImageContainerMetadata(rawFileBytes),
      Promise.resolve(analyzeRasterSignals(raster, resolvedRegion, qrMask)),
      Promise.resolve(analyzePixelForensics(raster, resolvedRegion, qrMask)),
    ]);

    const metrics: HumanMadeAssessmentMetrics = {
      artworkWidth: pixelSignals.artworkWidth,
      artworkHeight: pixelSignals.artworkHeight,
      containerFormat: meta.containerFormat,
      isCertifiedHandmadeOutput: meta.isCertifiedHandmadeOutput,
      hasC2paContainer: meta.hasC2paContainer,
      aiMetadataSignals: meta.aiMetadataSignals,
      pixelAiSignals: forensics.pixelAiSignals,
      aiSignalScore: forensics.aiSignalScore,
      smoothNoiseLuma: forensics.smoothNoiseLuma,
      smoothNoiseChroma: forensics.smoothNoiseChroma,
      upsampleGridAnomaly: forensics.upsampleGridAnomaly,
      stealthWatermarkDetected: forensics.stealthWatermarkDetected,
      creativeToolHints: meta.creativeToolHints,
      opaqueRatio: pixelSignals.opaqueRatio,
      transparentRatio: pixelSignals.transparentRatio,
      semiTransparentRatio: pixelSignals.semiTransparentRatio,
      edgeDensity: pixelSignals.edgeDensity,
      meanGradient: pixelSignals.meanGradient,
      flatRegionRatio: pixelSignals.flatRegionRatio,
      sampledColorBuckets: pixelSignals.sampledColorBuckets,
    };

    const notes: string[] = [];
    if (meta.aiMetadataSignals.length > 0) {
      notes.push(`Detected AI generator metadata markers: ${meta.aiMetadataSignals.join(', ')}`);
      if (forensics.pixelAiSignals.length > 0) {
        notes.push(`Also observed pixel/spectral AI signals: ${forensics.pixelAiSignals.join('; ')}`);
      }
      return {
        status: 'experimental-available',
        modelId: 'local-heuristic-forensics-v2',
        summaryKey: 'ai-metadata-detected',
        metrics,
        notes,
      };
    }

    if (forensics.stealthWatermarkDetected || forensics.aiSignalScore >= 2) {
      notes.push(
        `Detected pixel/spectral signals commonly produced by AI generators: ${forensics.pixelAiSignals.join('; ')}`,
      );
      return {
        status: 'experimental-available',
        modelId: 'local-heuristic-forensics-v2',
        summaryKey: 'ai-pixel-signals-detected',
        metrics,
        notes,
      };
    }

    const tooSmall = pixelSignals.artworkWidth < 32 || pixelSignals.artworkHeight < 32;
    const uniformBlank =
      pixelSignals.sampledColorBuckets <= 3 && pixelSignals.edgeDensity < 0.002;

    if (tooSmall || uniformBlank) {
      notes.push(
        'Artwork region is very small (<32 px) or visually uniform; local pixel signals are inconclusive.',
      );
      return {
        status: 'inconclusive',
        modelId: 'local-heuristic-forensics-v2',
        summaryKey: 'insufficient-visual-signal',
        metrics,
        notes,
      };
    }

    notes.push(
      'No AI generator metadata or multi-signal diffusion/upsampling anomaly detected (reference only, not proof of hand-drawn origin).',
    );
    return {
      status: 'experimental-available',
      modelId: 'local-heuristic-forensics-v2',
      summaryKey: 'local-signals-clean',
      metrics,
      notes,
    };
  },
};

export const defaultHumanMadeAssessor: HumanMadeAssessor = localHeuristicAssessor;

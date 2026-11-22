import { describe, expect, it } from 'vitest';
import { encode as encodePng } from 'fast-png';
import { defaultHumanMadeAssessor } from '../../src/core/assessment';
import { scanImageContainerMetadata } from '../../src/core/assessment/metadataScanner';
import type { CanonicalRaster } from '../../src/core/image';

function makeArtisticPattern(width: number, height: number, withSoftAlpha = false): CanonicalRaster {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = (x * 7 + y * 3) & 0xff;
      data[i + 1] = (x * 2 + y * 11) & 0xff;
      data[i + 2] = (x * 5 + y * 13) & 0xff;
      data[i + 3] = withSoftAlpha && x < 24 ? (x * 10) & 0xff : 255;
    }
  }
  return { width, height, data };
}

function makeSolidRaster(width: number, height: number): CanonicalRaster {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = 255;
  }
  return { width, height, data };
}

describe('100% local heuristic & container metadata assessment', () => {
  it('returns not-assessed when no image is provided', async () => {
    const res = await defaultHumanMadeAssessor.assess(null);
    expect(res.status).toBe('not-assessed');
    expect(res.summaryKey).toBe('no-image');
    expect(res.metrics).toBeNull();
  });

  it('evaluates valid artwork pixels locally with zero external dependencies', async () => {
    const raster = makeArtisticPattern(128, 96, true);
    const pngBytes = encodePng({
      width: raster.width,
      height: raster.height,
      data: raster.data,
      depth: 8,
      channels: 4,
      text: { Software: 'CLIP STUDIO PAINT EX' },
    });

    const res = await defaultHumanMadeAssessor.assess({
      raster,
      rawFileBytes: pngBytes,
    });

    expect(res.status).toBe('experimental-available');
    expect(res.summaryKey).toBe('local-signals-clean');
    expect(res.metrics).not.toBeNull();
    expect(res.metrics?.artworkWidth).toBe(128);
    expect(res.metrics?.artworkHeight).toBe(96);
    expect(res.metrics?.containerFormat).toBe('png');
    expect(res.metrics?.creativeToolHints).toContain('CLIP STUDIO PAINT');
    expect(res.metrics?.aiMetadataSignals).toEqual([]);
    expect(res.metrics?.semiTransparentRatio).toBeGreaterThan(0);
    expect(res.metrics?.sampledColorBuckets).toBeGreaterThan(20);
  });

  it('detects AI generator metadata markers in PNG tEXt chunks', async () => {
    const raster = makeArtisticPattern(128, 128, false);
    const aiPng = encodePng({
      width: raster.width,
      height: raster.height,
      data: raster.data,
      depth: 8,
      channels: 4,
      text: {
        parameters: '1girl, anime illustration\nNegative prompt: blurry\nSteps: 28, Sampler: Euler a, CFG scale: 7',
      },
    });

    const scan = await scanImageContainerMetadata(aiPng);
    expect(scan.aiMetadataSignals.length).toBeGreaterThan(0);

    const res = await defaultHumanMadeAssessor.assess({
      raster,
      rawFileBytes: aiPng,
    });
    expect(res.status).toBe('experimental-available');
    expect(res.summaryKey).toBe('ai-metadata-detected');
    expect(res.metrics?.aiMetadataSignals.length).toBeGreaterThan(0);
  });

  it('returns inconclusive for tiny (<32px) or uniform blank canvases', async () => {
    const tiny = makeArtisticPattern(16, 16, false);
    const tinyRes = await defaultHumanMadeAssessor.assess(tiny);
    expect(tinyRes.status).toBe('inconclusive');
    expect(tinyRes.summaryKey).toBe('insufficient-visual-signal');

    const blank = makeSolidRaster(120, 120);
    const blankRes = await defaultHumanMadeAssessor.assess(blank);
    expect(blankRes.status).toBe('inconclusive');
    expect(blankRes.summaryKey).toBe('insufficient-visual-signal');
  });
});

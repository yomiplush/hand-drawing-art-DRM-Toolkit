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

function makeCleanCelArt(width: number, height: number): CanonicalRaster {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      // Clean flat shaded regions + crisp ink diagonal
      const onLine = Math.abs(x - y) <= 2;
      if (onLine) {
        data[i] = 24;
        data[i + 1] = 28;
        data[i + 2] = 40;
      } else if (x < width / 2) {
        data[i] = 220;
        data[i + 1] = 235;
        data[i + 2] = 250;
      } else {
        data[i] = 175;
        data[i + 1] = 195;
        data[i + 2] = 225;
      }
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

function makeSyntheticAiUpsampledRaster(width = 192, height = 192): CanonicalRaster {
  const data = new Uint8Array(width * height * 4);
  // Deterministic 2x latent upsampling wave + micro chroma/luma grain across smooth base
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const baseR = 120 + (x / width) * 60;
      const baseG = 130 + (y / height) * 50;
      const baseB = 145 + ((x + y) / (width + height)) * 40;
      // Strong lag-2 oscillation (period 4 px: +a, 0, -a, 0 -> ac1 ~ 0, ac2 strongly negative)
      // combined with independent color offsets to mimic VAE decoder micro-grain
      const waveX = Math.cos((Math.PI / 2) * x);
      const waveY = Math.cos((Math.PI / 2) * y);
      const grain = 2.6 * (waveX + waveY);
      const chromaShift = ((x * 3 + y * 5) % 3) - 1;
      data[i] = clamp(baseR + grain + chromaShift * 1.4);
      data[i + 1] = clamp(baseG + grain - chromaShift * 1.1);
      data[i + 2] = clamp(baseB + grain + chromaShift * 1.7);
      data[i + 3] = 255;
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

function buildPngChunk(type: string, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + payload.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, payload.length, false);
  for (let i = 0; i < 4; i++) {
    out[4 + i] = type.charCodeAt(i);
  }
  out.set(payload, 8);
  // Zero CRC is sufficient for metadataScanner which reads length/type/payload
  return out;
}

function insertPngChunkBeforeIend(pngBytes: Uint8Array, type: string, payload: Uint8Array): Uint8Array {
  // Locate IEND chunk near the end
  for (let i = 8; i + 12 <= pngBytes.length; ) {
    const view = new DataView(pngBytes.buffer, pngBytes.byteOffset, pngBytes.byteLength);
    const len = view.getUint32(i, false);
    const chunkType = String.fromCharCode(
      pngBytes[i + 4],
      pngBytes[i + 5],
      pngBytes[i + 6],
      pngBytes[i + 7],
    );
    if (chunkType === 'IEND') {
      const injected = buildPngChunk(type, payload);
      const merged = new Uint8Array(pngBytes.length + injected.length);
      merged.set(pngBytes.subarray(0, i), 0);
      merged.set(injected, i);
      merged.set(pngBytes.subarray(i), i + injected.length);
      return merged;
    }
    i += 12 + len;
  }
  return pngBytes;
}

function buildMinimalJpegWithSegments(segments: Array<{ marker: number; textBytes: Uint8Array }>): Uint8Array {
  const parts: Uint8Array[] = [new Uint8Array([0xff, 0xd8])];
  for (const seg of segments) {
    const len = seg.textBytes.length + 2;
    const header = new Uint8Array(4);
    header[0] = 0xff;
    header[1] = seg.marker;
    header[2] = (len >> 8) & 0xff;
    header[3] = len & 0xff;
    parts.push(header, seg.textBytes);
  }
  parts.push(new Uint8Array([0xff, 0xd9]));
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

describe('100% local heuristic, spectral forensics & container metadata assessment', () => {
  it('returns not-assessed when no image is provided', async () => {
    const res = await defaultHumanMadeAssessor.assess(null);
    expect(res.status).toBe('not-assessed');
    expect(res.summaryKey).toBe('no-image');
    expect(res.metrics).toBeNull();
  });

  it('evaluates valid artwork pixels locally with zero external dependencies and no false positive', async () => {
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
    expect(res.metrics?.pixelAiSignals).toEqual([]);
    expect(res.metrics?.semiTransparentRatio).toBeGreaterThan(0);
    expect(res.metrics?.sampledColorBuckets).toBeGreaterThan(20);

    const celRaster = makeCleanCelArt(256, 256);
    const celRes = await defaultHumanMadeAssessor.assess(celRaster);
    expect(celRes.summaryKey).toBe('local-signals-clean');
    expect(celRes.metrics?.aiSignalScore).toBe(0);
  });

  it('detects AI generator metadata markers in PNG tEXt and C2PA caBX chunks (SD/ComfyUI/ChatGPT)', async () => {
    const raster = makeArtisticPattern(128, 128, false);
    const aiPng = encodePng({
      width: raster.width,
      height: raster.height,
      data: raster.data,
      depth: 8,
      channels: 4,
      text: {
        parameters:
          '1girl, anime illustration\nNegative prompt: blurry\nSteps: 28, Sampler: Euler a, CFG scale: 7',
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

    // ChatGPT / GPT-4o / C2PA caBX chunk inside PNG
    const basePng = encodePng({
      width: raster.width,
      height: raster.height,
      data: raster.data,
      depth: 8,
      channels: 4,
    });
    const c2paPayload = new TextEncoder().encode(
      'jumb\0\0c2pa.actionsChatGPT gpt-image-1 trainedAlgorithmicMedia',
    );
    const chatGptPng = insertPngChunkBeforeIend(basePng, 'caBX', c2paPayload);
    const chatGptScan = await scanImageContainerMetadata(chatGptPng);
    expect(chatGptScan.hasC2paContainer).toBe(true);
    expect(chatGptScan.aiMetadataSignals).toContain('OpenAI / ChatGPT / DALL-E metadata marker');
    expect(chatGptScan.aiMetadataSignals).toContain(
      'C2PA / IPTC trainedAlgorithmicMedia assertion',
    );
  });

  it('detects AI metadata in JPEG APP11 JUMBF/C2PA boxes and UNICODE UTF-16LE EXIF UserComment', async () => {
    const app11Payload = new TextEncoder().encode('jumbc2paMade with Google AI Imagen SynthID');
    const unicodePrefix = new TextEncoder().encode('Exif\0\0UNICODE\0');
    const utf16Text = 'Flux.1 dev prompt: neon city';
    const utf16Bytes = new Uint8Array(utf16Text.length * 2);
    for (let i = 0; i < utf16Text.length; i++) {
      utf16Bytes[i * 2] = utf16Text.charCodeAt(i);
      utf16Bytes[i * 2 + 1] = 0;
    }
    const app1Payload = new Uint8Array(unicodePrefix.length + utf16Bytes.length);
    app1Payload.set(unicodePrefix, 0);
    app1Payload.set(utf16Bytes, unicodePrefix.length);

    const jpegBytes = buildMinimalJpegWithSegments([
      { marker: 0xeb, textBytes: app11Payload },
      { marker: 0xe1, textBytes: app1Payload },
    ]);

    const scan = await scanImageContainerMetadata(jpegBytes);
    expect(scan.containerFormat).toBe('jpeg');
    expect(scan.hasC2paContainer).toBe(true);
    expect(scan.aiMetadataSignals).toContain('Google Gemini / Imagen metadata marker');
    expect(scan.aiMetadataSignals).toContain('Stable Diffusion / Flux metadata marker');
  });

  it('detects NovelAI stealth_pnginfo LSB watermark in alpha channel', async () => {
    const raster = makeCleanCelArt(128, 128);
    // Embed 'stealth_pnginfo' (15 ASCII bytes = 120 bits) in column-major MSB-first alpha LSBs
    const magic = 'stealth_pnginfo';
    let bitPos = 0;
    for (let x = 0; x < raster.width && bitPos < magic.length * 8; x++) {
      for (let y = 0; y < raster.height && bitPos < magic.length * 8; y++) {
        const charIdx = Math.floor(bitPos / 8);
        const shift = 7 - (bitPos % 8);
        const bit = (magic.charCodeAt(charIdx) >> shift) & 1;
        const idx = (y * raster.width + x) * 4 + 3;
        raster.data[idx] = (raster.data[idx] & 0xfe) | bit;
        bitPos++;
      }
    }

    const res = await defaultHumanMadeAssessor.assess(raster);
    expect(res.status).toBe('experimental-available');
    expect(res.summaryKey).toBe('ai-pixel-signals-detected');
    expect(res.metrics?.stealthWatermarkDetected).toBe(true);
    expect(res.metrics?.pixelAiSignals.some((s) => s.includes('stealth_pnginfo'))).toBe(true);
  });

  it('detects synthetic multi-signal diffusion/VAE upsampling pixel & spectral anomalies', async () => {
    const aiRaster = makeSyntheticAiUpsampledRaster(192, 192);
    const res = await defaultHumanMadeAssessor.assess(aiRaster);

    expect(res.status).toBe('experimental-available');
    expect(res.summaryKey).toBe('ai-pixel-signals-detected');
    expect(res.metrics?.aiSignalScore).toBeGreaterThanOrEqual(2);
    expect(res.metrics?.pixelAiSignals.length).toBeGreaterThanOrEqual(2);
  });

  it('excludes qrMask from pixel forensics so embedded QR does not trigger false AI warnings', async () => {
    const cel = makeCleanCelArt(320, 320);
    const aiNoise = makeSyntheticAiUpsampledRaster(320, 320);
    const qrMask: [number, number, number, number] = [20, 20, 140, 140];

    // Copy noisy block strictly inside qrMask
    for (let y = qrMask[1]; y < qrMask[1] + qrMask[3]; y++) {
      for (let x = qrMask[0]; x < qrMask[0] + qrMask[2]; x++) {
        const idx = (y * 320 + x) * 4;
        cel.data[idx] = aiNoise.data[idx];
        cel.data[idx + 1] = aiNoise.data[idx + 1];
        cel.data[idx + 2] = aiNoise.data[idx + 2];
        cel.data[idx + 3] = 255;
      }
    }

    const maskedRes = await defaultHumanMadeAssessor.assess({
      raster: cel,
      region: [0, 0, 320, 320],
      qrMask,
    });
    expect(maskedRes.summaryKey).toBe('local-signals-clean');
    expect(maskedRes.metrics?.aiSignalScore).toBe(0);
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

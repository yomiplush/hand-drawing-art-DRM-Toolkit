import { describe, expect, it } from 'vitest';
import type { CanonicalRaster } from '../../src/core/image/pngCodec';
import {
  ArtworkSafetyError,
  assertArtworkSafe,
  evaluateArtworkSafety,
  formatArtworkSafetyError,
} from '../../src/core/security/artworkSafetyGate';

function createFlatArtworkRaster(width = 128, height = 128): CanonicalRaster {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // Stylized flat-shaded anime/illustration palette (sky blue + dark lineart)
      const isLine = x % 32 === 0 || y % 32 === 0;
      data[idx] = isLine ? 30 : 120;
      data[idx + 1] = isLine ? 40 : 185;
      data[idx + 2] = isLine ? 65 : 235;
      data[idx + 3] = 255;
    }
  }
  return { width, height, data };
}

function createPhotorealisticSkinRaster(width = 128, height = 128): CanonicalRaster {
  const data = new Uint8Array(width * height * 4);
  let seed = 1337;
  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // Continuous human skin-tone with photographic sensor micro-noise
      const jitterR = Math.floor((nextRand() - 0.5) * 18);
      const jitterG = Math.floor((nextRand() - 0.5) * 14);
      const jitterB = Math.floor((nextRand() - 0.5) * 12);
      data[idx] = Math.min(255, Math.max(0, 212 + jitterR));
      data[idx + 1] = Math.min(255, Math.max(0, 152 + jitterG));
      data[idx + 2] = Math.min(255, Math.max(0, 122 + jitterB));
      data[idx + 3] = 255;
    }
  }
  return { width, height, data };
}

function createPhotorealisticLandscapeRaster(width = 128, height = 128): CanonicalRaster {
  const data = new Uint8Array(width * height * 4);
  let seed = 4242;
  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const jitter = Math.floor((nextRand() - 0.5) * 20);
      data[idx] = Math.min(255, Math.max(0, 60 + Math.floor((x / width) * 60) + jitter));
      data[idx + 1] = Math.min(255, Math.max(0, 130 + Math.floor((y / height) * 50) + jitter));
      data[idx + 2] = Math.min(255, Math.max(0, 180 + jitter));
      data[idx + 3] = 255;
    }
  }
  return { width, height, data };
}

describe('artworkSafetyGate', () => {
  it('allows legitimate hand-drawn / digital illustration artwork', () => {
    const result = evaluateArtworkSafety({
      fileName: 'blue-sky-illustration.png',
      title: 'Morning Sketch #12',
      description: 'Hand-drawn digital watercolor illustration in Clip Studio Paint.',
      tags: ['illustration', 'original', 'handmade'],
      raster: createFlatArtworkRaster(),
    });
    expect(result.allowed).toBe(true);
  });

  it('strictly blocks CSAM / child exploitation keywords in filename or metadata', () => {
    const enResult = evaluateArtworkSafety({
      fileName: 'csam_sample.jpg',
    });
    expect(enResult.allowed).toBe(false);
    expect(enResult.category).toBe('csam_illegal');

    const jaResult = evaluateArtworkSafety({
      title: '児童ポルノ画像',
    });
    expect(jaResult.allowed).toBe(false);
    expect(jaResult.category).toBe('csam_illegal');
  });

  it('strictly blocks illicit drug / trafficking instructions in metadata or embedded bytes', () => {
    const metaResult = evaluateArtworkSafety({
      description: '違法薬物の受け渡し用メモ 覚醒剤',
    });
    expect(metaResult.allowed).toBe(false);
    expect(metaResult.category).toBe('illicit_drugs_or_trafficking');

    const embeddedBytes = new TextEncoder().encode('PNG...tEXtComment\0drug drop cocaine delivery');
    const bytesResult = evaluateArtworkSafety({
      fileName: 'innocent.png',
      rawBytes: embeddedBytes,
    });
    expect(bytesResult.allowed).toBe(false);
    expect(bytesResult.category).toBe('illicit_drugs_or_trafficking');
  });

  it('blocks non-art physical delivery / drop addresses', () => {
    const jaAddr = evaluateArtworkSafety({
      description: '受け渡し住所: 〒150-0001 東京都渋谷区神宮前1-2-3',
    });
    expect(jaAddr.allowed).toBe(false);
    expect(jaAddr.category).toBe('non_art_address_or_drop');

    const enAddr = evaluateArtworkSafety({
      policyNote: 'Drop address: 742 Evergreen Terrace Street, Apt 4',
    });
    expect(enAddr.allowed).toBe(false);
    expect(enAddr.category).toBe('non_art_address_or_drop');
  });

  it('blocks photorealistic or AI-photorealistic NSFW skin-heavy imagery', () => {
    const result = evaluateArtworkSafety({
      fileName: 'ai_photo_realistic.png',
      raster: createPhotorealisticSkinRaster(),
    });
    expect(result.allowed).toBe(false);
    expect(result.category).toBe('photorealistic_nsfw');
  });

  it('blocks raw camera photos containing GPS EXIF metadata', () => {
    const fakeJpegWithGps = new TextEncoder().encode(
      'Exif\0\0Apple iPhone 15 Pro ExposureTime GPSInfo GPSLatitude 35.6895',
    );
    const result = evaluateArtworkSafety({
      fileName: 'IMG_1024.JPG',
      rawBytes: fakeJpegWithGps,
      raster: createPhotorealisticLandscapeRaster(),
    });
    expect(result.allowed).toBe(false);
    expect(result.category).toBe('non_art_raw_photo');
  });

  it('throws ArtworkSafetyError and formats localized error messages', () => {
    let caught: unknown;
    try {
      assertArtworkSafe({ title: '児童ポルノ' });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ArtworkSafetyError);
    expect(formatArtworkSafetyError(caught, 'ja')).toContain('拒絶されました');
    expect(formatArtworkSafetyError(caught, 'en')).toContain('Rejected:');
  });
});

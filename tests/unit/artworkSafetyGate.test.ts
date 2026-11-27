import { describe, expect, it } from 'vitest';
import type { CanonicalRaster } from '../../src/core/image/pngCodec';
import {
  ArtworkSafetyError,
  assertArtworkSafe,
  checkBarcodePayloadsSafety,
  evaluateArtworkSafety,
  evaluateArtworkSafetyAsync,
  formatArtworkSafetyError,
  isLegitimateCertifiedHandmadePayload,
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

  // -------------------------------------------------------------------------
  // AI-generated illustration metadata detection
  // -------------------------------------------------------------------------

  it('blocks AI-generated illustration metadata (Stable Diffusion, NovelAI, ComfyUI, Midjourney)', () => {
    const sdBytes = new TextEncoder().encode(
      'PNG\r\n...tEXtparameters\0masterpiece, 1girl\nNegative prompt: lowres, bad anatomy\nSteps: 28, Sampler: Euler a, CFG scale: 7',
    );
    const sdResult = evaluateArtworkSafety({ fileName: 'girl.png', rawBytes: sdBytes });
    expect(sdResult.allowed).toBe(false);
    expect(sdResult.category).toBe('ai_generated_metadata');

    const naiBytes = new TextEncoder().encode('PNG...tEXtSoftware\0NovelAI\0tEXtSource\0Stable Diffusion XL');
    const naiResult = evaluateArtworkSafety({ fileName: 'nai_art.png', rawBytes: naiBytes });
    expect(naiResult.allowed).toBe(false);
    expect(naiResult.category).toBe('ai_generated_metadata');

    const comfyBytes = new TextEncoder().encode(
      'PNG...tEXtprompt\0{"3":{"class_type":"KSampler","inputs":{"seed":42}}} ComfyUI',
    );
    const comfyResult = evaluateArtworkSafety({ fileName: 'comfy.png', rawBytes: comfyBytes });
    expect(comfyResult.allowed).toBe(false);
    expect(comfyResult.category).toBe('ai_generated_metadata');

    const mjBytes = new TextEncoder().encode('PNG...tEXtDescription\0Created with Midjourney v6');
    const mjResult = evaluateArtworkSafety({ fileName: 'mj.png', rawBytes: mjBytes });
    expect(mjResult.allowed).toBe(false);
    expect(mjResult.category).toBe('ai_generated_metadata');
  });

  // -------------------------------------------------------------------------
  // Embedded QR / barcode payload screening
  // -------------------------------------------------------------------------

  it('blocks embedded QR/barcode payloads containing external URLs, contact schemes, or transaction keywords', () => {
    const urlRes = evaluateArtworkSafety({
      fileName: 'art_with_qr.png',
      detectedQrPayloads: ['https://suspicious-shop.example/order?item=123'],
    });
    expect(urlRes.allowed).toBe(false);
    expect(urlRes.category).toBe('malicious_embedded_qr');

    const contactRes = checkBarcodePayloadsSafety(['tg://resolve?domain=secret_drop_bot']);
    expect(contactRes?.allowed).toBe(false);
    expect(contactRes?.category).toBe('malicious_embedded_qr');

    const discordRes = checkBarcodePayloadsSafety(['https://discord.gg/abcdef123']);
    expect(discordRes?.allowed).toBe(false);
    expect(discordRes?.category).toBe('malicious_embedded_qr');

    const txRes = checkBarcodePayloadsSafety(['購入・受け渡し連絡先: 渋谷駅ロッカー']);
    expect(txRes?.allowed).toBe(false);
    expect(txRes?.category).toBe('malicious_embedded_qr');
  });

  // -------------------------------------------------------------------------
  // False-positive prevention tests for legitimate hand-drawn artwork
  // -------------------------------------------------------------------------

  it('allows healthy character illustrations with wide skin-tone area (anime cel-shading & painterly)', () => {
    // Anime cel-shaded character portrait: ~45% flat/cel-shaded skin tone, ~55% hair/clothing/bg
    const width = 128;
    const height = 128;
    const animeData = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const inFaceOrArms = x >= 24 && x < 104 && y >= 24 && y < 104;
        if (inFaceOrArms) {
          // Flat cel-shaded anime skin with clean shadow band
          const isShadow = x > 84;
          animeData[idx] = isShadow ? 218 : 244;
          animeData[idx + 1] = isShadow ? 174 : 206;
          animeData[idx + 2] = isShadow ? 156 : 186;
        } else {
          // Hair & sky background
          animeData[idx] = 80;
          animeData[idx + 1] = 120;
          animeData[idx + 2] = 210;
        }
        animeData[idx + 3] = 255;
      }
    }
    const animeResult = evaluateArtworkSafety({
      fileName: 'character_portrait_cel.png',
      title: 'Summer Character Portrait',
      description: 'Hand-drawn anime character illustration in Clip Studio Paint.',
      raster: { width, height, data: animeData },
    });
    expect(animeResult.allowed).toBe(true);

    // Painterly (厚塗り) character portrait: smooth brush gradients, ~40% skin area, no camera EXIF
    const painterlyData = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const inCharacter = x >= 28 && x < 100 && y >= 28 && y < 100;
        if (inCharacter) {
          // Smooth painterly shading gradient (diff <= 2 between adjacent pixels)
          const grad = Math.floor(((x - 28) / 72) * 24);
          painterlyData[idx] = 235 - grad;
          painterlyData[idx + 1] = 190 - grad;
          painterlyData[idx + 2] = 165 - grad;
        } else {
          painterlyData[idx] = 45 + Math.floor((y / height) * 40);
          painterlyData[idx + 1] = 65 + Math.floor((x / width) * 35);
          painterlyData[idx + 2] = 110;
        }
        painterlyData[idx + 3] = 255;
      }
    }
    const painterlyResult = evaluateArtworkSafety({
      fileName: 'character_atsunuri.png',
      title: '厚塗りキャラクターイラスト',
      description: 'Procreateで手描きした厚塗りポートレート作品。',
      raster: { width, height, data: painterlyData },
    });
    expect(painterlyResult.allowed).toBe(true);
  });

  it('allows background illustrations with fictional signboard text and dream-themed titles', () => {
    const result = evaluateArtworkSafety({
      fileName: 'dream_cafe_alley_bg.png',
      title: 'Dreamy Cafe on Starlight Avenue',
      description:
        'Background art featuring fictional neon signs: "CAFE DREAM", "OPEN 24H", "FANTASY BAKERY".',
      tags: ['background', 'dream', 'signboard', 'handmade'],
      raster: createFlatArtworkRaster(),
    });
    expect(result.allowed).toBe(true);
  });

  it('allows legitimate Certified Handmade offline verification QR payloads', async () => {
    const standardUrl =
      'https://certified-handmade.com/#proof=o2F2AaJhaVggAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const compactUrl =
      'HTTPS://CERTIFIED-HANDMADE.COM/#45:QED8WEX00000000000000000000000000000000';
    const compactRaw = '45:QED8WEX00000000000000000000000000000000';

    expect(isLegitimateCertifiedHandmadePayload(standardUrl)).toBe(true);
    expect(isLegitimateCertifiedHandmadePayload(compactUrl)).toBe(true);
    expect(isLegitimateCertifiedHandmadePayload(compactRaw)).toBe(true);

    const result = await evaluateArtworkSafetyAsync({
      fileName: 'signed_artwork.png',
      title: 'Original Hand-Drawn Landscape',
      raster: createFlatArtworkRaster(),
      detectedQrPayloads: [standardUrl, compactUrl, compactRaw],
    });
    expect(result.allowed).toBe(true);
  });
});

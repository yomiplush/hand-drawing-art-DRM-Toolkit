import {
  computePublicKeyFingerprint,
  derivePublicKeyFromSeed,
  importNonExtractablePrivateKey,
  supportsWebCryptoEd25519,
} from '../crypto/ed25519';
import { encryptKeyBackup } from '../crypto/keyBackup';
import { base64UrlEncode } from '../crypto/sha256';
import type { CanonicalRaster } from '../image/pngCodec';
import { createSignedArtworkPng } from '../manifest/signArtwork';
import type { AuthorKeyRecord } from '../storage/keyStore';

// Fixed non-secret demo seed used solely to generate an offline verifiable sample illustration
const DEMO_SEED = new Uint8Array([
  0x43, 0x48, 0x4d, 0x2d, 0x44, 0x45, 0x4d, 0x4f,
  0x2d, 0x53, 0x41, 0x4d, 0x50, 0x4c, 0x45, 0x2d,
  0x41, 0x52, 0x54, 0x57, 0x4f, 0x52, 0x4b, 0x2d,
  0x32, 0x30, 0x32, 0x36, 0x2d, 0x30, 0x31, 0x21,
]);
const DEMO_PASSPHRASE = 'certified-handmade-demo-sample';

const cachedSamplePromises = new Map<string, Promise<File>>();

function buildSampleStudioRaster(width = 240, height = 180): CanonicalRaster {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const ny = y / (height - 1);
    for (let x = 0; x < width; x++) {
      const nx = x / (width - 1);
      const i = (y * width + x) * 4;

      // Soft twilight sky gradient
      let r = Math.round(142 + nx * 36 + Math.pow(ny, 1.4) * 95);
      let g = Math.round(176 + nx * 24 + Math.pow(ny, 1.2) * 52);
      let b = Math.round(235 - Math.pow(ny, 1.6) * 28);

      // Gentle rolling studio hill
      const hillY = 0.72 + 0.06 * Math.sin(nx * Math.PI * 2.2) + 0.03 * Math.cos(nx * Math.PI * 4.5);
      if (ny > hillY) {
        const depth = (ny - hillY) / (1 - hillY);
        r = Math.round(48 + depth * 22);
        g = Math.round(88 + depth * 32);
        b = Math.round(166 - depth * 18);
      }

      // Warm golden crescent moon
      const mx = (x - width * 0.28) / 24;
      const my = (y - height * 0.31) / 24;
      const moonOuter = mx * mx + my * my;
      const mxInner = (x - width * 0.315) / 20;
      const myInner = (y - height * 0.285) / 20;
      const moonInner = mxInner * mxInner + myInner * myInner;
      if (moonOuter < 1.0 && moonInner > 0.85) {
        r = 255;
        g = 232;
        b = 148;
      }

      // Bright 4-point star sparkle
      const sx = Math.abs(x - width * 0.68);
      const sy = Math.abs(y - height * 0.28);
      if (sx < 14 && sy < 14 && (sx * sy < 18 || sx + sy < 7)) {
        const dist = Math.hypot(sx, sy);
        if (dist < 14) {
          r = 255;
          g = 247;
          b = 200;
        }
      }

      data[i] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

export async function getSampleSignedArtworkFile(locale?: string): Promise<File> {
  const key = locale === 'ja' ? 'ja' : 'en';
  const existing = cachedSamplePromises.get(key);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    const publicKey = derivePublicKeyFromSeed(DEMO_SEED);
    const fp = await computePublicKeyFingerprint(publicKey);
    const canWebCrypto = await supportsWebCryptoEd25519();

    let authorKey: AuthorKeyRecord;
    let passphraseIfEncrypted: string | undefined;

    if (canWebCrypto) {
      const cryptoKey = await importNonExtractablePrivateKey(DEMO_SEED);
      authorKey = {
        id: 'sample-demo-key',
        label: 'Certified Handmade Demo Artist',
        publicKey,
        publicKeyBase64Url: base64UrlEncode(publicKey),
        fingerprintHex: fp.fullHex,
        fingerprintShort: fp.shortDisplay,
        storageMode: 'webcrypto-non-extractable',
        webCryptoPrivateKey: cryptoKey,
        hasBackupDownloaded: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      };
    } else {
      const encryptedBackup = await encryptKeyBackup({
        seed32: DEMO_SEED,
        publicKey32: publicKey,
        passphrase: DEMO_PASSPHRASE,
        label: 'Certified Handmade Demo Artist',
      });
      authorKey = {
        id: 'sample-demo-key',
        label: 'Certified Handmade Demo Artist',
        publicKey,
        publicKeyBase64Url: base64UrlEncode(publicKey),
        fingerprintHex: fp.fullHex,
        fingerprintShort: fp.shortDisplay,
        storageMode: 'noble-encrypted-seed',
        encryptedBackup,
        hasBackupDownloaded: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      passphraseIfEncrypted = DEMO_PASSPHRASE;
    }

    const isJa = key === 'ja';
    const raster = buildSampleStudioRaster();
    const signed = await createSignedArtworkPng({
      artworkRaster: raster,
      authorKey,
      passphraseIfEncrypted,
      authorName: isJa ? 'サンプル絵描き（Demo）' : 'Demo Illustrator',
      artworkTitle: isJa ? '星夜のスケッチ（サンプル）' : 'Starry Sketch (Sample)',
      protocolVersion: 3,
      license: {
        licenseId: 'CC-BY-NC-4.0',
        commercialUse: 'disallow',
        redistribution: 'allow',
        aiTraining: 'disallow',
        requiresAttribution: true,
      },
      burnOptions: {
        placement: 'bottom-right',
        theme: 'dark-slate',
        marginPx: 10,
        quietZoneModules: 1,
        showLabel: true,
      },
    });

    const copy = new Uint8Array(signed.pngBytes.byteLength);
    copy.set(signed.pngBytes);
    return new File([copy.buffer], 'sample-artwork.certified-handmade.png', {
      type: 'image/png',
    });
  })().catch((err) => {
    cachedSamplePromises.delete(key);
    throw err;
  });

  cachedSamplePromises.set(key, promise);
  return promise;
}

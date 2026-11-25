// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createAuthorKey } from '../../src/core/storage/keyStore';
import { encode as encodePng } from 'fast-png';
import { imageWorkerClient } from '../../src/core/workers/imageWorkerClient';
import { InMemoryIdbBackend, createInMemoryIndexedDb } from '../helpers/inMemoryIndexedDb';

function makeSampleRaster(w = 64, h = 64) {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 61;
    data[i + 1] = 115;
    data[i + 2] = 197;
    data[i + 3] = 255;
  }
  return { width: w, height: h, data };
}

describe('imageWorkerClient (synchronous fallback & progress callbacks when Worker is unavailable)', () => {
  it('decodes, signs, computes perceptual hashes, and verifies cleanly with progress callbacks', async () => {
    const idb = createInMemoryIndexedDb(new InMemoryIdbBackend());
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      writable: true,
      value: idb.factory,
    });

    const raster = makeSampleRaster();
    const rawPng = encodePng({ ...raster, depth: 8, channels: 4 });

    const decodeStages: string[] = [];
    const decoded = await imageWorkerClient.decodeImage(rawPng, (_pct, stage) => {
      decodeStages.push(stage);
    });
    expect(decoded.raster.width).toBe(64);
    expect(decodeStages).toContain('decoding');
    expect(decodeStages).toContain('complete');

    const hashes = await imageWorkerClient.computePerceptualHashes(decoded.raster);
    expect(hashes.dHashHex.length).toBeGreaterThan(0);

    const { record } = await createAuthorKey({ label: 'Worker Fallback Key' });
    const signStages: string[] = [];
    const signed = await imageWorkerClient.signArtworkFrame(
      {
        artworkRaster: decoded.raster,
        authorKey: record,
        license: {
          licenseId: 'ARR',
          commercialUse: 'disallow',
          redistribution: 'disallow',
          aiTraining: 'disallow',
        },
        burnOptions: {
          placement: 'bottom-right',
          theme: 'dark-slate',
          marginPx: 8,
        },
        artworkTitle: 'Gentle Azure Study',
        authorName: 'Artist',
      },
      (_pct, stage) => signStages.push(stage),
    );
    expect(signed.pngBytes.byteLength).toBeGreaterThan(0);
    expect(signStages).toContain('complete');

    const verifyStages: string[] = [];
    const verified = await imageWorkerClient.verifyImage(
      {
        fileOrBytes: signed.pngBytes,
      },
      (_pct, stage) => verifyStages.push(stage),
    );
    expect(verified.verification.signatureStatus).toBe('valid');
    expect(verified.verification.integrityStatus).toBe('matched');
    expect(verifyStages).toContain('complete');
  });
});

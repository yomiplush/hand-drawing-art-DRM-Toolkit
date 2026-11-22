import { encode as encodePng } from 'fast-png';
import { describe, expect, it } from 'vitest';
import {
  decodePngToCanonicalRgba8,
  encodeCanonicalRgba8ToPng,
  hashArtworkRegion,
  hashCanonicalRaster,
  inspectPngHeader,
} from '../../src/core/image';

describe('Canonical PNG codec and RGBA8 hashing', () => {
  it('preserves exact un-premultiplied RGBA8 pixels including alpha=0', async () => {
    const raster = {
      width: 2,
      height: 2,
      data: new Uint8Array([
        123, 45, 67, 0, // Transparent pixel with non-zero RGB
        200, 100, 50, 128, // Semi-transparent pixel
        10, 20, 30, 255, // Opaque pixel
        255, 255, 255, 1, // Near-zero alpha pixel
      ]),
    };

    const png = encodeCanonicalRgba8ToPng(raster);
    const decoded = decodePngToCanonicalRgba8(png);

    expect(decoded.width).toBe(2);
    expect(decoded.height).toBe(2);
    expect(decoded.data).toEqual(raster.data);

    const h1 = await hashCanonicalRaster(raster);
    const h2 = await hashCanonicalRaster(decoded);
    expect(h1).toEqual(h2);
  });

  it('normalizes palette PNGs into canonical RGBA8', () => {
    // Transparent entry first (index 0) and opaque entry second (index 1) per PNG tRNS ordering
    const palPng = encodePng({
      width: 2,
      height: 1,
      depth: 8,
      channels: 1,
      palette: [
        [40, 50, 60, 0],
        [10, 20, 30, 255],
      ],
      data: new Uint8Array([1, 0]),
    });

    const decoded = decodePngToCanonicalRgba8(palPng);
    expect(decoded.data).toEqual(new Uint8Array([10, 20, 30, 255, 40, 50, 60, 0]));
  });

  it('rejects oversized PNG dimensions in IHDR pre-flight before decompression', () => {
    const fakeHugePng = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
      0x00, 0x00, 0x00, 0x0d, // IHDR length 13
      0x49, 0x48, 0x44, 0x52, // "IHDR"
      0x00, 0x01, 0x86, 0xa0, // width = 100000
      0x00, 0x01, 0x86, 0xa0, // height = 100000
      0x08, 0x06, 0x00, 0x00, 0x00, // 8-bit RGBA
      0x00, 0x00, 0x00, 0x00,
    ]);
    expect(() => inspectPngHeader(fakeHugePng)).toThrow();
    expect(() => decodePngToCanonicalRgba8(fakeHugePng)).toThrow();
  });

  it('hashes extracted sub-regions identically to standalone artwork', async () => {
    const art = {
      width: 2,
      height: 2,
      data: new Uint8Array([
        1, 2, 3, 255, 4, 5, 6, 255,
        7, 8, 9, 255, 10, 11, 12, 255,
      ]),
    };
    const canvas = {
      width: 4,
      height: 4,
      data: new Uint8Array(4 * 4 * 4).fill(255),
    };
    // Copy 2x2 art into (1, 1)
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        const s = (y * 2 + x) * 4;
        const d = ((1 + y) * 4 + (1 + x)) * 4;
        canvas.data.set(art.data.subarray(s, s + 4), d);
      }
    }

    const standaloneHash = await hashCanonicalRaster(art);
    const regionHash = await hashArtworkRegion(canvas, [1, 1, 2, 2]);
    expect(regionHash.digest).toEqual(standaloneHash);
  });
});

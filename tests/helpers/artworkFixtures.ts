/**
 * Shared E2E fixtures for artwork signing tests.
 *
 * The /create flow requires two distinct inputs:
 *   1. a flat artwork raster (the drawing itself), and
 *   2. a working project file with real multi-layer structure, which the local
 *      verifier parses to prove the artwork was not a one-click AI export.
 *
 * Gradients make poor artwork fixtures: per-pixel noise trips the artwork
 * safety gate's photorealism heuristic. These helpers therefore use flat colour
 * blocks, and generate a genuinely parseable PSD rather than an empty stub.
 */
import { encode as encodePng } from 'fast-png';

/** Flat-colour illustration. Hard edges keep flatPixelRatio high. */
export function buildIllustrationPng(width = 400, height = 300): Buffer {
  const data = new Uint8Array(width * height * 4);
  const bg = [250, 246, 238];
  const shapes: Array<[number, number, number, number, number[]]> = [
    [60, 80, 220, 220, [220, 60, 60]],
    [240, 120, 360, 260, [50, 90, 200]],
    [150, 160, 290, 200, [30, 30, 40]],
  ];
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = bg[0];
    data[i * 4 + 1] = bg[1];
    data[i * 4 + 2] = bg[2];
    data[i * 4 + 3] = 255;
  }
  for (const [x0, y0, x1, y1, c] of shapes) {
    for (let y = Math.max(0, y0); y < Math.min(height, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(width, x1); x++) {
        const i = (y * width + x) * 4;
        data[i] = c[0];
        data[i + 1] = c[1];
        data[i + 2] = c[2];
        data[i + 3] = 255;
      }
    }
  }
  return Buffer.from(encodePng({ width, height, data, depth: 8, channels: 4 }));
}

/**
 * Minimal but structurally valid multi-layer PSD (8BPS, 4 channels per layer).
 * Mirrors the fixture used by tests/unit/sourceProjectVerifier.test.ts so the
 * verifier sees >= 2 non-empty layers.
 */
export function buildWorkingProjectPsd(
  layerCount = 3,
  width = 800,
  height = 600,
): Uint8Array {
  const layerRecs: Uint8Array[] = [];
  const layerChans: Uint8Array[] = [];

  for (let i = 0; i < layerCount; i++) {
    const lw = 2;
    const lh = 2;
    const chDataLen = 2 + lw * lh;
    const rec = new Uint8Array(18 + 4 * 6 + 16 + 12);
    const rv = new DataView(rec.buffer);
    rv.setInt32(0, 0, false);
    rv.setInt32(4, 0, false);
    rv.setInt32(8, lh, false);
    rv.setInt32(12, lw, false);
    rv.setUint16(16, 4, false);
    let p = 18;
    for (const cid of [0, 1, 2, -1]) {
      rv.setInt16(p, cid, false);
      rv.setUint32(p + 2, chDataLen, false);
      p += 6;
    }
    rec.set([0x38, 0x42, 0x49, 0x4d], p); // '8BIM'
    rec.set([0x6e, 0x6f, 0x72, 0x6d], p + 4); // 'norm'
    rec[p + 8] = 255;
    rec[p + 9] = 0;
    rec[p + 10] = 0;
    rec[p + 11] = 0;
    rv.setUint32(p + 12, 12, false);
    rv.setUint32(p + 16, 0, false);
    rv.setUint32(p + 20, 0, false);
    rec[p + 24] = 2;
    rec[p + 25] = 0x4c; // 'L'
    rec[p + 26] = 0x31 + i;
    layerRecs.push(rec);

    for (let c = 0; c < 4; c++) {
      const ch = new Uint8Array(chDataLen);
      ch.fill(255, 2);
      layerChans.push(ch);
    }
  }

  const recsLen = layerRecs.reduce((s, r) => s + r.byteLength, 0);
  const chansLen = layerChans.reduce((s, c) => s + c.byteLength, 0);
  const layerInfoLen = 2 + recsLen + chansLen;
  const layerMaskLen = 4 + layerInfoLen;

  const bytes = new Uint8Array(26 + 4 + 4 + 4 + layerMaskLen);
  const view = new DataView(bytes.buffer);
  bytes.set([0x38, 0x42, 0x50, 0x53], 0); // '8BPS'
  view.setUint16(4, 1, false);
  view.setUint16(12, 4, false);
  view.setUint32(14, height, false);
  view.setUint32(18, width, false);
  view.setUint16(22, 8, false);
  view.setUint16(24, 3, false);
  view.setUint32(26, 0, false);
  view.setUint32(30, 0, false);
  view.setUint32(34, layerMaskLen, false);
  view.setUint32(38, layerInfoLen, false);
  view.setInt16(42, layerCount, false);

  let off = 44;
  for (const r of layerRecs) {
    bytes.set(r, off);
    off += r.byteLength;
  }
  for (const c of layerChans) {
    bytes.set(c, off);
    off += c.byteLength;
  }
  return bytes;
}

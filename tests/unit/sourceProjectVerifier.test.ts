import { describe, expect, it } from 'vitest';
import {
  buildSourceProjectProofTag,
  formatSourceProjectError,
  parseSourceProjectProofTag,
  SourceProjectVerificationError,
  verifySourceProjectFile,
} from '../../src/core/security/sourceProjectVerifier';

function buildMinimalValidPsd(
  layerCount = 3,
  width = 800,
  height = 600,
  emptyLayerIndices: number[] = [],
): Uint8Array {
  const layerRecs: Uint8Array[] = [];
  const layerChans: Uint8Array[] = [];
  for (let i = 0; i < layerCount; i++) {
    const isEmpty = emptyLayerIndices.includes(i);
    const lw = isEmpty ? 0 : 2;
    const lh = isEmpty ? 0 : 2;
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
    rec[p + 8] = 255; // opacity
    rec[p + 9] = 0; // clipping
    rec[p + 10] = 0; // flags
    rec[p + 11] = 0; // filler
    rv.setUint32(p + 12, 12, false); // extraDataLen
    rv.setUint32(p + 16, 0, false); // mask
    rv.setUint32(p + 20, 0, false); // blend ranges
    rec[p + 24] = 2;
    rec[p + 25] = 0x4c; // 'L'
    rec[p + 26] = 0x31 + i;
    layerRecs.push(rec);

    for (let c = 0; c < 4; c++) {
      const ch = new Uint8Array(chDataLen);
      if (lw * lh > 0) ch.fill(255, 2);
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

function buildMinimalValidClip(): Uint8Array {
  const header = new TextEncoder().encode(
    'CSFCHUNK\0\0\0\0CHNKHead...SQLite format 3\0...CREATE TABLE Canvas...CREATE TABLE Layer...Layer...Layer...',
  );
  return header;
}

function makeFakeFile(name: string, bytes: Uint8Array) {
  return {
    name,
    size: bytes.byteLength,
    async arrayBuffer() {
      return bytes.slice().buffer;
    },
  };
}

describe('sourceProjectVerifier', () => {
  it('verifies a valid multi-layer PSD and returns only lightweight commitment metadata (zero raw bytes)', async () => {
    const psdBytes = buildMinimalValidPsd(4, 1920, 1080);
    const result = await verifySourceProjectFile(makeFakeFile('character_final.psd', psdBytes));

    expect(result.verified).toBe(true);
    expect(result.projectFormat).toBe('PSD');
    expect(result.layerCount).toBe(4);
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
    expect(result.sourceCommitmentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.sourceFileSha256).toBeInstanceOf(Uint8Array);
    expect(result.sourceFileSha256.byteLength).toBe(32);
    expect(result.sanitizedBasename).toBe('character_final.psd');
    // Ensure no raw binary fields exist on the returned object (safe for Google Drive / IndexedDB metadata)
    expect(Object.keys(result)).not.toContain('bytes');
    expect(Object.keys(result)).not.toContain('rawBytes');
    expect(Object.keys(result)).not.toContain('buffer');
    expect(Object.keys(result)).not.toContain('file');

    const tag = buildSourceProjectProofTag(result);
    const parsed = parseSourceProjectProofTag(['original', tag]);
    expect(parsed).toEqual({
      projectFormat: 'PSD',
      layerCount: 4,
      commitmentHashPrefix: result.sourceCommitmentHash.slice(0, 16),
    });
  });

  it('verifies a valid CLIP STUDIO PAINT (.clip) file with CSFCHUNK and embedded SQLite 3 DB', async () => {
    const clipBytes = buildMinimalValidClip();
    const result = await verifySourceProjectFile(makeFakeFile('illustration.clip', clipBytes));

    expect(result.verified).toBe(true);
    expect(result.projectFormat).toBe('CLIP');
    expect(result.layerCount).toBeGreaterThanOrEqual(2);
    expect(result.sourceCommitmentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a flat PNG renamed to .psd or .clip (extension spoofing)', async () => {
    const pngMagic = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
    let caught: unknown;
    try {
      await verifySourceProjectFile(makeFakeFile('fake_renamed.psd', pngMagic));
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(SourceProjectVerificationError);
    expect((caught as SourceProjectVerificationError).reasonCode).toBe(
      'SPOOFED_FLAT_IMAGE_EXTENSION',
    );
    expect(formatSourceProjectError(caught, 'ja')).toContain('拡張子を偽装');
    expect(formatSourceProjectError(caught, 'en')).toContain('renamed');
  });

  it('rejects a single-layer PSD file and a 2-layer PSD with an empty second layer', async () => {
    const singleLayerPsd = buildMinimalValidPsd(1, 512, 512);
    await expect(
      verifySourceProjectFile(makeFakeFile('flat_single.psd', singleLayerPsd)),
    ).rejects.toThrow(/At least 2 active layers/);

    const emptySecondLayerPsd = buildMinimalValidPsd(2, 512, 512, [1]);
    await expect(
      verifySourceProjectFile(makeFakeFile('empty_second.psd', emptySecondLayerPsd)),
    ).rejects.toThrow(/non-transparent pixel data/);
  });

  it('verifies valid Procreate and Krita ZIP-based project archives', async () => {
    const procreateBytes = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04,
      ...new TextEncoder().encode('Document.archive layer1.chunk layer2.chunk'),
    ]);
    const procreateRes = await verifySourceProjectFile(
      makeFakeFile('sketch.procreate', procreateBytes),
    );
    expect(procreateRes.verified).toBe(true);
    expect(procreateRes.projectFormat).toBe('PROCREATE');

    const kraBytes = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04,
      ...new TextEncoder().encode('mimetypeapplication/x-krita maindoc.xml mergedimage.png /layers/layer1 /layers/layer2'),
    ]);
    const kraRes = await verifySourceProjectFile(makeFakeFile('painting.kra', kraBytes));
    expect(kraRes.verified).toBe(true);
    expect(kraRes.projectFormat).toBe('KRA');
  });
});

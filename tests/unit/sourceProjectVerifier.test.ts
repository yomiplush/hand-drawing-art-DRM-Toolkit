import { describe, expect, it } from 'vitest';
import {
  buildSourceProjectProofTag,
  formatSourceProjectError,
  parseSourceProjectProofTag,
  SourceProjectVerificationError,
  verifySourceProjectFile,
} from '../../src/core/security/sourceProjectVerifier';

function buildMinimalValidPsd(layerCount = 3, width = 800, height = 600): Uint8Array {
  // 26 header + 4 colorModeLen(0) + 4 imageResLen(0) + 4 layerMaskLen(10) + 4 layerInfoLen(6) + 2 layerCount + 4 padding
  const buf = new ArrayBuffer(64);
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);
  // '8BPS'
  bytes[0] = 0x38;
  bytes[1] = 0x42;
  bytes[2] = 0x50;
  bytes[3] = 0x53;
  view.setUint16(4, 1, false); // PSD version 1
  view.setUint16(12, 4, false); // RGBA channels
  view.setUint32(14, height, false);
  view.setUint32(18, width, false);
  view.setUint16(22, 8, false); // 8-bit depth
  view.setUint16(24, 3, false); // RGB color mode
  view.setUint32(26, 0, false); // Color Mode Data length = 0
  view.setUint32(30, 0, false); // Image Resources length = 0
  view.setUint32(34, 16, false); // Layer & Mask Info length = 16
  view.setUint32(38, 12, false); // Layer Info length = 12
  view.setInt16(42, layerCount, false); // Layer count
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

  it('rejects a single-layer PSD file', async () => {
    const singleLayerPsd = buildMinimalValidPsd(1, 512, 512);
    await expect(
      verifySourceProjectFile(makeFakeFile('flat_single.psd', singleLayerPsd)),
    ).rejects.toThrow(/At least 2 layers/);
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

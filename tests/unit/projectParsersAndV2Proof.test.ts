import { describe, expect, it } from 'vitest';
import { base64UrlEncode } from '@yomiplush/chm-exchange/core';
import { generateEd25519KeyMaterial, signWithSeed } from '../../src/core/crypto/ed25519';
import { bytesToHex, sha256 } from '../../src/core/crypto/sha256';
import {
  createChmExchangeArtworkPackage,
  parseAndVerifyChmExchangePackage,
} from '../../src/core/exchange/proofAdapter';
import {
  PROOF_SCHEMA_VERSION_V2,
  createProofIdV2,
  signChmProofV2,
  verifyChmProofAny,
  type ChmProofV2Payload,
  type SignedChmProofV1,
} from '../../src/core/manifest/proofV2';
import {
  ProjectParseError,
  inspectNativeProjectFile,
  mergeNativeProjectFile,
  type ProjectFileInput,
} from '../../src/core/parsers';

function makeFileInput(name: string, bytes: Uint8Array): ProjectFileInput {
  const blob = new Blob([bytes.buffer as ArrayBuffer]);
  return {
    name,
    size: bytes.byteLength,
    slice: (start?: number, end?: number) => blob.slice(start, end),
    arrayBuffer: () => blob.arrayBuffer(),
  };
}

interface SyntheticLayerSpec {
  name: string;
  width: number;
  height: number;
  alphaValue: number; // 0 = completely transparent, 255 = opaque
  blendKey?: string;
}

/**
 * Builds a spec-compliant PSD (version 1) with real Layer Records, Channel Image Data,
 * and flattened Composite Image Data (compression 0 Raw).
 */
function buildSyntheticPsd(options: {
  width?: number;
  height?: number;
  depth?: 8 | 16 | 32;
  colorMode?: 1 | 3 | 4;
  layers: SyntheticLayerSpec[];
}): Uint8Array {
  const width = options.width ?? 4;
  const height = options.height ?? 4;
  const depth = options.depth ?? 8;
  const colorMode = options.colorMode ?? 3;
  const channels = colorMode === 4 ? 4 : colorMode === 1 ? 2 : 4;
  const bytesPerSample = depth === 32 ? 4 : depth === 16 ? 2 : 1;

  // Build layer records & channel data
  const layerRecordChunks: Uint8Array[] = [];
  const layerChannelChunks: Uint8Array[] = [];

  for (const layer of options.layers) {
    const pixelCount = layer.width * layer.height;
    const chDataLen = 2 + pixelCount * bytesPerSample; // 2 bytes compression(0) + raw samples
    const numCh = 4; // R, G, B, Alpha(-1)
    const nameBytes = new TextEncoder().encode(layer.name);
    const pascalPaddedLen = Math.ceil((1 + nameBytes.length) / 4) * 4;
    // extraData = 4 (maskLen=0) + 4 (blendRangesLen=0) + pascalPaddedLen
    const extraLen = 8 + pascalPaddedLen;
    const recSize = 18 + numCh * 6 + 16 + extraLen;
    const rec = new Uint8Array(recSize);
    const rv = new DataView(rec.buffer);
    let pos = 0;
    rv.setInt32(pos, 0, false); pos += 4; // top
    rv.setInt32(pos, 0, false); pos += 4; // left
    rv.setInt32(pos, layer.height, false); pos += 4; // bottom
    rv.setInt32(pos, layer.width, false); pos += 4; // right
    rv.setUint16(pos, numCh, false); pos += 2;

    const channelIds = [0, 1, 2, -1];
    for (const cid of channelIds) {
      rv.setInt16(pos, cid, false); pos += 2;
      rv.setUint32(pos, chDataLen, false); pos += 4;
    }

    // '8BIM' + blendKey
    rec.set([0x38, 0x42, 0x49, 0x4d], pos); pos += 4;
    const blend = (layer.blendKey ?? 'norm').padEnd(4, ' ').slice(0, 4);
    rec.set(new TextEncoder().encode(blend), pos); pos += 4;
    rec[pos++] = 255; // opacity
    rec[pos++] = 0; // clipping
    rec[pos++] = 0; // flags (visible)
    rec[pos++] = 0; // filler
    rv.setUint32(pos, extraLen, false); pos += 4;
    rv.setUint32(pos, 0, false); pos += 4; // mask len
    rv.setUint32(pos, 0, false); pos += 4; // blend ranges len
    rec[pos] = nameBytes.length;
    rec.set(nameBytes, pos + 1);
    layerRecordChunks.push(rec);

    for (const cid of channelIds) {
      const chBuf = new Uint8Array(chDataLen);
      // compression = 0 (Raw)
      if (pixelCount > 0) {
        const fillVal = cid === -1 ? layer.alphaValue : 180;
        chBuf.fill(fillVal, 2);
      }
      layerChannelChunks.push(chBuf);
    }
  }

  const layerRecordsTotal = layerRecordChunks.reduce((s, c) => s + c.byteLength, 0);
  const layerChannelsTotal = layerChannelChunks.reduce((s, c) => s + c.byteLength, 0);
  const layerInfoLen = 2 + layerRecordsTotal + layerChannelsTotal;
  const layerMaskLen = 4 + layerInfoLen;

  // Composite Image Data (compression 0 Raw)
  const compPixels = width * height;
  const compPlaneBytes = compPixels * bytesPerSample;
  const compLen = 2 + channels * compPlaneBytes;

  const totalLen = 26 + 4 + 4 + 4 + layerMaskLen + compLen;
  const out = new Uint8Array(totalLen);
  const view = new DataView(out.buffer);

  // Header
  out.set([0x38, 0x42, 0x50, 0x53], 0); // '8BPS'
  view.setUint16(4, 1, false); // version 1
  view.setUint16(12, channels, false);
  view.setUint32(14, height, false);
  view.setUint32(18, width, false);
  view.setUint16(22, depth, false);
  view.setUint16(24, colorMode, false);
  let offset = 26;

  view.setUint32(offset, 0, false); offset += 4; // colorModeLen
  view.setUint32(offset, 0, false); offset += 4; // imageResourcesLen
  view.setUint32(offset, layerMaskLen, false); offset += 4;
  view.setUint32(offset, layerInfoLen, false); offset += 4;
  view.setInt16(offset, options.layers.length, false); offset += 2;

  for (const rec of layerRecordChunks) {
    out.set(rec, offset);
    offset += rec.byteLength;
  }
  for (const ch of layerChannelChunks) {
    out.set(ch, offset);
    offset += ch.byteLength;
  }

  // Composite image data (compression 0)
  view.setUint16(offset, 0, false); offset += 2;
  for (let c = 0; c < channels; c++) {
    if (depth === 8) {
      out.fill(c === 0 ? 220 : c === 1 ? 140 : c === 2 ? 90 : 255, offset, offset + compPlaneBytes);
    } else if (depth === 16) {
      for (let i = 0; i < compPixels; i++) {
        view.setUint16(offset + i * 2, c === 3 ? 0xffff : 0x8000, false);
      }
    } else {
      for (let i = 0; i < compPixels; i++) {
        view.setFloat32(offset + i * 4, c === 3 ? 1.0 : 0.5, false);
      }
    }
    offset += compPlaneBytes;
  }

  return out;
}

describe('Native Project Parsers, v2 Proof Schema & CHM-Exchange Adapter', () => {
  it('rejects standalone unmerged PNG, JPEG, and WebP files', async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const jpgBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
    const webpBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

    for (const [name, bytes] of [
      ['illustration.png', pngBytes],
      ['photo.jpg', jpgBytes],
      ['ai-gen.webp', webpBytes],
    ] as const) {
      const file = makeFileInput(name, bytes);
      await expect(inspectNativeProjectFile(file)).rejects.toThrow(ProjectParseError);
      await expect(inspectNativeProjectFile(file)).rejects.toThrow(/Standalone raster images/i);
    }
  });

  it('rejects spoofed PNG files renamed to .psd', async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const spoofed = makeFileInput('fake.psd', pngBytes);

    await expect(inspectNativeProjectFile(spoofed)).rejects.toThrow(ProjectParseError);
    await expect(inspectNativeProjectFile(spoofed)).rejects.toThrow(/flat raster image/i);
  });

  it('rejects a single-layer PSD with a helpful explanation for artists', async () => {
    const singleLayerPsd = buildSyntheticPsd({
      layers: [{ name: 'Background', width: 4, height: 4, alphaValue: 255 }],
    });
    const file = makeFileInput('single.psd', singleLayerPsd);

    await expect(inspectNativeProjectFile(file)).rejects.toThrow(ProjectParseError);
    await expect(inspectNativeProjectFile(file)).rejects.toThrow(/At least 2 active layers/i);
  });

  it('rejects a 2-layer PSD where the second layer is empty (0x0) or fully transparent (alpha=0)', async () => {
    const zeroBoxBypass = buildSyntheticPsd({
      layers: [
        { name: 'Photo', width: 4, height: 4, alphaValue: 255 },
        { name: 'Empty Layer', width: 0, height: 0, alphaValue: 0 },
      ],
    });
    await expect(
      inspectNativeProjectFile(makeFileInput('empty-box.psd', zeroBoxBypass)),
    ).rejects.toThrow(/non-transparent pixel data/i);

    const transparentBypass = buildSyntheticPsd({
      layers: [
        { name: 'AI Image', width: 4, height: 4, alphaValue: 255 },
        { name: 'Transparent Dummy', width: 4, height: 4, alphaValue: 0 },
      ],
    });
    await expect(
      inspectNativeProjectFile(makeFileInput('transparent-dummy.psd', transparentBypass)),
    ).rejects.toThrow(/non-transparent pixel data/i);
  });

  it('enforces pre-flight dimension DoS bounds before allocating full buffers', async () => {
    const oversizedHeader = new Uint8Array(64);
    const view = new DataView(oversizedHeader.buffer);
    oversizedHeader.set([0x38, 0x42, 0x50, 0x53], 0);
    view.setUint16(4, 1, false);
    view.setUint16(12, 4, false);
    view.setUint32(14, 25000, false); // height > 16384
    view.setUint32(18, 25000, false); // width > 16384
    view.setUint16(22, 8, false);
    view.setUint16(24, 3, false);

    await expect(
      inspectNativeProjectFile(makeFileInput('bomb.psd', oversizedHeader)),
    ).rejects.toThrow(/exceeds the local safety limit/i);
  });

  it('decodes 16-bit RGB and CMYK multi-layer PSDs into deterministic RGBA8 PNGs', async () => {
    const psd16 = buildSyntheticPsd({
      width: 4,
      height: 4,
      depth: 16,
      colorMode: 3,
      layers: [
        { name: 'Lineart', width: 4, height: 4, alphaValue: 255, blendKey: 'mul ' },
        { name: 'Base Color', width: 4, height: 4, alphaValue: 255, blendKey: 'norm' },
      ],
    });
    const file16 = makeFileInput('art16.psd', psd16);
    const { inspection: insp16 } = await inspectNativeProjectFile(file16);
    expect(insp16.layers[0].name).toBe('Lineart');
    expect(insp16.layers[0].blendMode).toBe('multiply');
    const merged16 = await mergeNativeProjectFile(file16, insp16);
    expect(merged16.mergedPngBytes.byteLength).toBeGreaterThan(32);

    const psdCmyk = buildSyntheticPsd({
      width: 4,
      height: 4,
      depth: 8,
      colorMode: 4,
      layers: [
        { name: 'Ink', width: 4, height: 4, alphaValue: 255 },
        { name: 'Paper', width: 4, height: 4, alphaValue: 255 },
      ],
    });
    const fileCmyk = makeFileInput('print-cmyk.psd', psdCmyk);
    const { inspection: inspCmyk } = await inspectNativeProjectFile(fileCmyk);
    const mergedCmyk = await mergeNativeProjectFile(fileCmyk, inspCmyk);
    expect(mergedCmyk.mergedPngBytes.byteLength).toBeGreaterThan(32);
  });

  it('inspects, merges, signs v2 proof, packages for CHM-Exchange, and verifies a multi-layer .psd', async () => {
    const psdBytes = buildSyntheticPsd({
      width: 8,
      height: 8,
      layers: [
        { name: 'Sketch', width: 8, height: 8, alphaValue: 255 },
        { name: 'Lineart', width: 8, height: 8, alphaValue: 255 },
        { name: 'Color', width: 8, height: 8, alphaValue: 255 },
        { name: 'Highlight', width: 8, height: 8, alphaValue: 255, blendKey: 'scrn' },
      ],
    });
    const psdFile = makeFileInput('hero-art.psd', psdBytes);

    let progressSeen = false;
    const { inspection } = await inspectNativeProjectFile(psdFile, {
      onHashProgress: (p) => {
        if (p.percent === 100) progressSeen = true;
      },
    });

    expect(progressSeen).toBe(true);
    expect(inspection.format).toBe('PSD');
    expect(inspection.layerMetrics.layer_count).toBe(4);
    expect(inspection.layerMetrics.has_multi_layer_structure).toBe(true);

    const mergeResult = await mergeNativeProjectFile(psdFile, inspection);
    expect(mergeResult.mergedPngBytes.byteLength).toBeGreaterThan(32);

    // Deterministic merge check
    const mergeResult2 = await mergeNativeProjectFile(psdFile, inspection);
    expect(mergeResult2.mergedImageSha256).toBe(mergeResult.mergedImageSha256);

    const { seed32: privateKey, publicKey } = await generateEd25519KeyMaterial();
    const payload: ChmProofV2Payload = {
      schema_version: PROOF_SCHEMA_VERSION_V2,
      proof_id: createProofIdV2(),
      merged_image_sha256: mergeResult.mergedImageSha256,
      source_project_sha256: inspection.sourceProjectSha256,
      provenance_metadata: {
        project_format: inspection.format,
        merge_method: inspection.mergeMethod,
        layer_metrics: inspection.layerMetrics,
        timelapse_detected: inspection.timelapseDetected,
        software_signature: inspection.softwareSignature,
        timestamp: new Date().toISOString(),
        source_file_size_bytes: inspection.fileSizeBytes,
      },
      artist_public_key: base64UrlEncode(publicKey),
      artwork_title: 'Handmade Hero',
      author_name: 'Yomi',
    };

    const signedV2 = await signChmProofV2({ payload, privateKey });
    const verification = await verifyChmProofAny({
      proof: signedV2,
      mergedImageBytes: mergeResult.mergedPngBytes,
      sourceProjectSha256Hex: inspection.sourceProjectSha256,
    });

    expect(verification.valid).toBe(true);
    expect(verification.schemaVersion).toBe('2');
    expect(verification.nativeProjectCertified).toBe(true);
    expect(verification.mergedImageHashMatches).toBe(true);
    expect(verification.sourceProjectHashMatches).toBe(true);

    // CHM-Exchange packaging & verification round-trip
    const pkg = createChmExchangeArtworkPackage({
      proof: signedV2,
      galleryDeck: {
        title: 'Handmade Hero',
        authorName: 'Yomi',
        createdAt: new Date().toISOString(),
      },
    });
    const roundTrip = await parseAndVerifyChmExchangePackage(
      JSON.stringify(pkg),
      mergeResult.mergedPngBytes,
    );
    expect(roundTrip.valid).toBe(true);
    expect(roundTrip.pkg?.proof.payload.source_project_sha256).toBe(
      inspection.sourceProjectSha256,
    );
  });

  it('maintains backward compatibility when verifying legacy v1 proofs', async () => {
    const { seed32: privateKey, publicKey } = await generateEd25519KeyMaterial();
    const imgBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const artworkSha256 = bytesToHex(await sha256(imgBytes));
    const issuedAt = '2026-01-01T00:00:00.000Z';
    const pubB64 = base64UrlEncode(publicKey);
    const sig = signWithSeed(
      privateKey,
      new TextEncoder().encode(`${artworkSha256}:${issuedAt}:${pubB64}`),
    );

    const v1Proof: SignedChmProofV1 = {
      schema_version: '1',
      artwork_sha256: artworkSha256,
      artist_public_key: pubB64,
      issued_at: issuedAt,
      signature_ed25519: base64UrlEncode(sig),
    };

    const result = await verifyChmProofAny({
      proof: v1Proof,
      mergedImageBytes: imgBytes,
    });

    expect(result.valid).toBe(true);
    expect(result.schemaVersion).toBe('1');
    expect(result.nativeProjectCertified).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

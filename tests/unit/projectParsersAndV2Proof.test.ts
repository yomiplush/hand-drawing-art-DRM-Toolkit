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

function buildValidMultiLayerPsd(layerCount = 3): Uint8Array {
  const buf = new ArrayBuffer(64);
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);
  // '8BPS'
  u8.set([0x38, 0x42, 0x50, 0x53], 0);
  view.setUint16(4, 1, false); // version 1 (PSD)
  view.setUint16(12, 4, false); // RGBA channels
  view.setUint32(14, 32, false); // height
  view.setUint32(18, 32, false); // width
  view.setUint16(22, 8, false); // depth
  view.setUint16(24, 3, false); // RGB
  view.setUint32(26, 0, false); // color mode len
  view.setUint32(30, 0, false); // image resources len
  view.setUint32(34, 16, false); // layer & mask len
  view.setUint32(38, 12, false); // layer info len
  view.setInt16(42, layerCount, false);
  return u8;
}

describe('Native Project Parsers, v2 Proof Schema & CHM-Exchange Adapter', () => {
  it('rejects standalone unmerged PNG files', async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const file = makeFileInput('illustration.png', pngBytes);

    await expect(inspectNativeProjectFile(file)).rejects.toThrow(ProjectParseError);
    await expect(inspectNativeProjectFile(file)).rejects.toThrow(/Standalone raster images/i);
  });

  it('rejects spoofed PNG files renamed to .psd', async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const spoofed = makeFileInput('fake.psd', pngBytes);

    await expect(inspectNativeProjectFile(spoofed)).rejects.toThrow(ProjectParseError);
    await expect(inspectNativeProjectFile(spoofed)).rejects.toThrow(/flat raster image/i);
  });

  it('inspects, merges, signs v2 proof, packages for CHM-Exchange, and verifies a multi-layer .psd', async () => {
    const psdBytes = buildValidMultiLayerPsd(4);
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

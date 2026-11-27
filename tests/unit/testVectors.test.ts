import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { encode as cborEncode, rfc8949EncodeOptions } from 'cborg';
import { ed25519 } from '@noble/curves/ed25519.js';
import {
  DOMAIN_SEPARATION_PREFIX,
  DOMAIN_SEPARATION_PREFIX_V3,
  decodeSignedProofEnvelope,
  encodeSignedProofEnvelope,
  encodeUnsignedPayload,
} from '../../src/core/manifest';
import {
  EVIDENCE_DOMAIN_SEPARATION_PREFIX,
  encodeSignedEvidenceEnvelope,
  encodeUnsignedEvidencePayload,
} from '../../src/core/manifest/evidenceExtension';
import { base64UrlDecode, base64UrlEncode, sha256 } from '../../src/core/crypto/sha256';
import { verifyProofAndArtwork } from '../../src/core/verify/verifier';
import { verifyEvidenceExtension } from '../../src/core/verify/evidenceVerifier';
import type { UnsignedManifest } from '../../src/core/manifest/types';

interface ProofVector {
  id: string;
  description: string;
  protocolVersion: 1 | 2 | 3;
  expectedValid: boolean;
  expectedErrorHint?: string;
  proofBase64Url: string;
}

interface EvidenceVector {
  id: string;
  description: string;
  primaryProofId: string;
  expectedValid: boolean;
  expectedStatus: 'valid' | 'binding-mismatch';
  evidenceBase64Url: string;
}

interface TestVectorSuite {
  schemaVersion: 1;
  specVersion: '1.3.1';
  proofVectors: ProofVector[];
  evidenceVectors: EvidenceVector[];
}

const VECTORS_PATH = path.resolve(process.cwd(), 'tests/vectors/protocol-vectors.json');
const NODE_CLI_PATH = path.resolve(process.cwd(), 'tools/chm-verify.mjs');

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

async function buildDeterministicVectorSuite(): Promise<TestVectorSuite> {
  const seed = new Uint8Array(32);
  for (let i = 0; i < 32; i++) seed[i] = i + 1;
  const pubKey = ed25519.getPublicKey(seed);
  const artworkSha256 = await sha256(new TextEncoder().encode('chm-test-vector-artwork-v1.3.1'));
  const artworkId = new Uint8Array([
    0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x47, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x01,
  ]);
  const artworkId2 = new Uint8Array([
    0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x47, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x02,
  ]);

  // 1. Protocol v1 valid
  const v1Manifest: UnsignedManifest = {
    version: 1,
    artworkId,
    issuedAt: 1732752000,
    publicKey: pubKey,
    sha256: artworkSha256,
    region: [0, 0, 128, 128],
    license: {
      licenseId: 'ARR',
      aiTraining: 'disallow',
      commercialUse: 'disallow',
      redistribution: 'disallow',
      attributionName: 'Test Artist',
    },
    author: 'Test Artist',
    title: 'Vector V1',
  };
  const v1Payload = encodeUnsignedPayload(v1Manifest);
  const v1Sig = ed25519.sign(concatBytes(DOMAIN_SEPARATION_PREFIX, v1Payload), seed);
  const v1ProofBytes = encodeSignedProofEnvelope(v1Payload, v1Sig, 1);
  const v1ProofB64 = base64UrlEncode(v1ProofBytes);

  // 2. Protocol v2 valid with qrMask
  const v2Manifest: UnsignedManifest = {
    ...v1Manifest,
    version: 2,
    artworkId: artworkId2,
    title: 'Vector V2 Masked',
    qrMask: [96, 96, 24, 24],
  };
  const v2Payload = encodeUnsignedPayload(v2Manifest);
  const v2Sig = ed25519.sign(concatBytes(DOMAIN_SEPARATION_PREFIX, v2Payload), seed);
  const v2ProofBytes = encodeSignedProofEnvelope(v2Payload, v2Sig, 2);
  const v2ProofB64 = base64UrlEncode(v2ProofBytes);

  // 3. Protocol v3 valid (compressed)
  const v3Manifest: UnsignedManifest = {
    ...v1Manifest,
    version: 3,
    title: 'Vector V3 Compact Proof',
    description:
      'Self-contained Protocol v3 test vector with repeated text to trigger deterministic raw DEFLATE compression. ' +
      'Self-contained Protocol v3 test vector with repeated text to trigger deterministic raw DEFLATE compression.',
    websiteUrl: 'https://certified-handmade.com/artist/test',
    snsLinks: [{ platform: 'github', url: 'https://github.com/yomiplush' }],
    creationMethod: 'hand-drawn-no-ai',
    policyNote: 'No AI training or unauthorized redistribution.',
    evidenceHashes: [
      {
        category: 'project-file',
        sha256: await sha256(new TextEncoder().encode('vector-psd-source')),
        byteLength: 4096,
      },
    ],
  };
  const v3Payload = encodeUnsignedPayload(v3Manifest);
  const v3Sig = ed25519.sign(concatBytes(DOMAIN_SEPARATION_PREFIX_V3, v3Payload), seed);
  const v3ProofBytes = encodeSignedProofEnvelope(v3Payload, v3Sig, 3);
  const v3ProofB64 = base64UrlEncode(v3ProofBytes);

  // 4. Protocol v1 tampered signature
  const tamperedSig = new Uint8Array(v1Sig);
  tamperedSig[0] ^= 0xff;
  const v1TamperedB64 = base64UrlEncode(encodeSignedProofEnvelope(v1Payload, tamperedSig, 1));

  // 5. Protocol v1 small-order / all-zero public key
  const zeroPub = new Uint8Array(32);
  const smallOrderManifest: UnsignedManifest = { ...v1Manifest, publicKey: zeroPub };
  const smallOrderPayload = encodeUnsignedPayload(smallOrderManifest);
  const smallOrderSig = new Uint8Array(64);
  const v1SmallOrderB64 = base64UrlEncode(encodeSignedProofEnvelope(smallOrderPayload, smallOrderSig, 1));

  // 6. Protocol v1 non-canonical CBOR (integer 1 encoded as 2-byte 0x18 0x01 instead of 0x01)
  const nonCanonicalPayload = new Uint8Array([0xa1, 0x18, 0x01, 0x01]);
  const nonCanonicalSig = ed25519.sign(concatBytes(DOMAIN_SEPARATION_PREFIX, nonCanonicalPayload), seed);
  const v1NonCanonicalB64 = base64UrlEncode(encodeSignedProofEnvelope(nonCanonicalPayload, nonCanonicalSig, 1));

  // 7. Protocol v3 DEFLATE decompression limit exceeded (> 8192 bytes)
  const hugePayload = new Uint8Array(9000);
  hugePayload.fill(0x41);
  const compressedHuge = new Uint8Array(deflateRawSync(hugePayload));
  const v3BombEnvelope = cborEncode([3, 1, compressedHuge, new Uint8Array(64)], rfc8949EncodeOptions);
  const v3BombB64 = base64UrlEncode(v3BombEnvelope);

  // 8. Protocol v2 invalid qrMask (too small: mw=10 < 21)
  const badMaskSmallMap = new Map<number, unknown>([
    [1, 2],
    [2, artworkId],
    [3, 1732752000],
    [4, pubKey],
    [5, artworkSha256],
    [6, [0, 0, 128, 128]],
    [7, [1, 2, 2, 2]],
    [9, [10, 10, 10, 10]],
  ]);
  const badMaskSmallPayload = cborEncode(badMaskSmallMap, rfc8949EncodeOptions);
  const badMaskSmallSig = ed25519.sign(concatBytes(DOMAIN_SEPARATION_PREFIX, badMaskSmallPayload), seed);
  const v2BadMaskSmallB64 = base64UrlEncode(encodeSignedProofEnvelope(badMaskSmallPayload, badMaskSmallSig, 2));

  // 9. Protocol v2 invalid qrMask (out of region bounds)
  const badMaskOobMap = new Map<number, unknown>([
    [1, 2],
    [2, artworkId],
    [3, 1732752000],
    [4, pubKey],
    [5, artworkSha256],
    [6, [0, 0, 128, 128]],
    [7, [1, 2, 2, 2]],
    [9, [110, 110, 30, 30]],
  ]);
  const badMaskOobPayload = cborEncode(badMaskOobMap, rfc8949EncodeOptions);
  const badMaskOobSig = ed25519.sign(concatBytes(DOMAIN_SEPARATION_PREFIX, badMaskOobPayload), seed);
  const v2BadMaskOobB64 = base64UrlEncode(encodeSignedProofEnvelope(badMaskOobPayload, badMaskOobSig, 2));

  // 10. .chmevidence bound to v1_valid
  const v1ProofSha256 = await sha256(v1ProofBytes);
  const evidenceId = new Uint8Array([
    0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x40, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99,
  ]);
  const evidencePayload = encodeUnsignedEvidencePayload({
    version: 1,
    evidenceId,
    artworkId,
    artworkSha256,
    proofSha256: v1ProofSha256,
    publicKey: pubKey,
    issuedAt: 1732752100,
    creationMethod: 'hand-drawn-no-ai',
    artworkMetadata: {
      title: 'Vector V1 Extended',
      artistName: 'Test Artist',
      description: 'Bound evidence extension for v1_valid',
    },
  });
  const evidenceSig = ed25519.sign(concatBytes(EVIDENCE_DOMAIN_SEPARATION_PREFIX, evidencePayload), seed);
  const evidenceBytes = encodeSignedEvidenceEnvelope(evidencePayload, evidenceSig);
  const evidenceB64 = base64UrlEncode(evidenceBytes);

  return {
    schemaVersion: 1,
    specVersion: '1.3.1',
    proofVectors: [
      {
        id: 'v1_valid',
        description: 'Valid Protocol v1 proof with canonical CBOR and Ed25519 signature',
        protocolVersion: 1,
        expectedValid: true,
        proofBase64Url: v1ProofB64,
      },
      {
        id: 'v2_valid_qrMask',
        description: 'Valid Protocol v2 proof with in-image qrMask [96, 96, 24, 24]',
        protocolVersion: 2,
        expectedValid: true,
        proofBase64Url: v2ProofB64,
      },
      {
        id: 'v3_valid_compressed',
        description: 'Valid Protocol v3 self-contained compact proof with DEFLATE compression',
        protocolVersion: 3,
        expectedValid: true,
        proofBase64Url: v3ProofB64,
      },
      {
        id: 'v1_tampered_signature',
        description: 'Protocol v1 proof with 1-byte tampered Ed25519 signature',
        protocolVersion: 1,
        expectedValid: false,
        expectedErrorHint: 'signature',
        proofBase64Url: v1TamperedB64,
      },
      {
        id: 'v1_small_order_pubkey',
        description: 'Protocol v1 proof with all-zero small-order Ed25519 public key',
        protocolVersion: 1,
        expectedValid: false,
        expectedErrorHint: 'public key',
        proofBase64Url: v1SmallOrderB64,
      },
      {
        id: 'v1_non_canonical_cbor',
        description: 'Protocol v1 proof with non-canonical CBOR integer encoding',
        protocolVersion: 1,
        expectedValid: false,
        expectedErrorHint: 'canonical',
        proofBase64Url: v1NonCanonicalB64,
      },
      {
        id: 'v3_deflate_limit_exceeded',
        description: 'Protocol v3 proof whose DEFLATE payload exceeds MAX_V3_DECOMPRESSED_BYTES (8192)',
        protocolVersion: 3,
        expectedValid: false,
        expectedErrorHint: 'deflate',
        proofBase64Url: v3BombB64,
      },
      {
        id: 'v2_invalid_qrmask_too_small',
        description: 'Protocol v2 proof with qrMask smaller than minimum 21x21 modules',
        protocolVersion: 2,
        expectedValid: false,
        expectedErrorHint: 'qrMask',
        proofBase64Url: v2BadMaskSmallB64,
      },
      {
        id: 'v2_invalid_qrmask_out_of_bounds',
        description: 'Protocol v2 proof with qrMask extending outside artwork region',
        protocolVersion: 2,
        expectedValid: false,
        expectedErrorHint: 'qrMask',
        proofBase64Url: v2BadMaskOobB64,
      },
    ],
    evidenceVectors: [
      {
        id: 'evidence_valid',
        description: 'Valid .chmevidence bound to v1_valid',
        primaryProofId: 'v1_valid',
        expectedValid: true,
        expectedStatus: 'valid',
        evidenceBase64Url: evidenceB64,
      },
      {
        id: 'evidence_binding_mismatch',
        description: 'Valid .chmevidence from v1_valid replayed against v2_valid_qrMask',
        primaryProofId: 'v2_valid_qrMask',
        expectedValid: false,
        expectedStatus: 'binding-mismatch',
        evidenceBase64Url: evidenceB64,
      },
    ],
  };
}

describe('Independent Protocol & Evidence Test Vectors (tests/vectors/protocol-vectors.json)', () => {
  it('validates all fixed proof and evidence vectors in TypeScript core', async () => {
    if (process.env.GENERATE_VECTORS === '1') {
      const generated = await buildDeterministicVectorSuite();
      writeFileSync(VECTORS_PATH, `${JSON.stringify(generated, null, 2)}\n`, 'utf8');
    }

    const suite = JSON.parse(readFileSync(VECTORS_PATH, 'utf8')) as TestVectorSuite;
    expect(suite.schemaVersion).toBe(1);
    expect(suite.proofVectors.length).toBeGreaterThanOrEqual(9);
    expect(suite.evidenceVectors.length).toBeGreaterThanOrEqual(2);

    const proofBytesById = new Map<string, Uint8Array>();

    for (const vec of suite.proofVectors) {
      const result = await verifyProofAndArtwork({ proofInput: vec.proofBase64Url });
      if (vec.expectedValid) {
        expect(result.signatureStatus, vec.id).toBe('valid');
        const bytes = base64UrlDecode(vec.proofBase64Url);
        const decoded = decodeSignedProofEnvelope(bytes);
        expect(decoded.manifest.version, vec.id).toBe(vec.protocolVersion);
        proofBytesById.set(vec.id, bytes);
      } else {
        expect(result.signatureStatus, `${vec.id} must be rejected`).not.toBe('valid');
      }
    }

    for (const ev of suite.evidenceVectors) {
      const primaryBytes = proofBytesById.get(ev.primaryProofId);
      expect(primaryBytes, `Missing primary proof ${ev.primaryProofId}`).toBeDefined();
      const primaryDecoded = decodeSignedProofEnvelope(primaryBytes!);
      const res = await verifyEvidenceExtension({
        evidenceInput: `chm-evidence:${ev.evidenceBase64Url}`,
        proofBytes: primaryBytes!,
        manifest: primaryDecoded.manifest,
      });
      expect(res.status, ev.id).toBe(ev.expectedStatus);
    }
  });

  it('validates all fixed vectors through the independent Node.js offline CLI (tools/chm-verify.mjs)', () => {
    const suite = JSON.parse(readFileSync(VECTORS_PATH, 'utf8')) as TestVectorSuite;
    const workDir = mkdtempSync(path.join(tmpdir(), 'chm-vectors-cli-'));

    try {
      const proofTokenById = new Map<string, string>();
      for (const vec of suite.proofVectors) {
        proofTokenById.set(vec.id, vec.proofBase64Url);

        let exitCode = 0;
        let stdout = '';
        try {
          stdout = execFileSync(process.execPath, [NODE_CLI_PATH, '--proof', vec.proofBase64Url, '--json'], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
          });
        } catch (err: unknown) {
          const e = err as { status?: number; stdout?: string };
          exitCode = e.status ?? 1;
          stdout = e.stdout ?? '';
        }

        if (vec.expectedValid) {
          expect(exitCode, `Node CLI should accept ${vec.id}`).toBe(0);
          const parsed = JSON.parse(stdout) as { signatureValid?: boolean; signatureStatus?: string };
          expect(parsed.signatureValid === true || parsed.signatureStatus === 'valid', vec.id).toBe(true);
        } else {
          expect(exitCode, `Node CLI must reject ${vec.id}`).not.toBe(0);
        }
      }

      for (const ev of suite.evidenceVectors) {
        const primaryToken = proofTokenById.get(ev.primaryProofId)!;
        const evToken = `chm-evidence:${ev.evidenceBase64Url}`;

        let exitCode = 0;
        let stdout = '';
        try {
          stdout = execFileSync(
            process.execPath,
            [NODE_CLI_PATH, '--proof', primaryToken, '--evidence', evToken, '--json'],
            {
              encoding: 'utf8',
              stdio: ['ignore', 'pipe', 'pipe'],
            },
          );
        } catch (err: unknown) {
          const e = err as { status?: number; stdout?: string };
          exitCode = e.status ?? 1;
          stdout = e.stdout ?? '';
        }

        if (ev.expectedValid) {
          expect(exitCode, `Node CLI should accept ${ev.id}`).toBe(0);
          const parsed = JSON.parse(stdout) as Record<string, unknown>;
          expect(parsed.signatureValid, ev.id).toBe(true);
        } else {
          expect(exitCode, `Node CLI must reject ${ev.id}`).not.toBe(0);
        }
      }
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });
});

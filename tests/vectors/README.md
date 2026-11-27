# Certified Handmade — Independent Test Vectors (`tests/vectors/`)

This directory contains fixed, deterministic cryptographic test vectors for independent verifiers, auditors, and third-party implementations conforming to [`SPEC.md`](../../SPEC.md).

## Files

- [`protocol-vectors.json`](./protocol-vectors.json) — Fixed test vectors covering:
  - **Protocol v1 / v2 / v3 valid proofs** (`v1_valid`, `v2_valid_qrMask`, `v3_valid_compressed`)
  - **Protocol v1 / v2 / v3 invalid / adversarial proofs**:
    - Tampered Ed25519 signature (`v1_tampered_signature`)
    - Small-order / all-zero Ed25519 public key (`v1_small_order_pubkey`)
    - Non-canonical CBOR encoding (`v1_non_canonical_cbor`)
    - Protocol v3 DEFLATE decompression ceiling exceeded (`> 8192` bytes, `v3_deflate_limit_exceeded`)
    - Protocol v2 `qrMask` boundary violations (`mw < 21` and out-of-region bounds)
  - **`.chmevidence` extension binding**:
    - Valid primary proof + bound `.chmevidence` (`evidence_valid`)
    - Cross-proof replay / substitution (`evidence_binding_mismatch` → must fail with `binding-mismatch`)

## Automated Verification

These vectors are automatically verified by:
1. **Vitest (TypeScript reference implementation & Node.js CLI parity):** `npx vitest run tests/unit/testVectors.test.ts`
2. **Go Independent Offline CLI:** `cd tools/chm-verify && go test -v -run TestProtocolVectors ./...`

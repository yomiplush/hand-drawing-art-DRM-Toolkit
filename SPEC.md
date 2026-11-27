# Certified Handmade Protocol Specification (`SPEC.md`)

**Protocol Versions:** `1` (Outer QR Border) · `2` (In-Image Masked QR Overlay) · `3` (Self-Contained Compact QR, `CHM3\0`) · `CHM-SYNC-v1` (Auth-Only Nostr Transport) · `CHM-VAULT-v1` (`chm-vault-keyring-v1` / `chm-vault-aead-v1` / `chm-vault-keyshare-v1`)  
**Status:** Implemented Specification (`v1`, `v2`, & `v3` + Pluggable Encrypted Vault & Auth-Only Device Sync)  
**Official Nostr NIP Reference Commit:** [`nostr-protocol/nips@bec0fc8`](https://github.com/nostr-protocol/nips/commit/bec0fc8)  
**Goal:** Enable anyone, anywhere, forever—even without the original website or any central server—to independently verify signed artwork manifests and pixel integrity using standard cryptographic primitives.

---

## 1. Cryptographic Primitives

1. **Hash Function:** SHA-256 (FIPS 180-4)
2. **Digital Signature:** Pure Ed25519 (RFC 8032)
3. **Binary Serialization:** Deterministic CBOR (RFC 8949 Section 4.2)
4. **Compact Compression (Protocol `v3`):** Raw DEFLATE (`deflate-raw`, RFC 1951, bounded decompression to `8192` bytes)
5. **Transport Encoding:** Unpadded Base64url (RFC 4648 Section 5, without `=` padding)
6. **Encrypted Key & Vault Backup / Sync (`.chkey.json`, `.chmvault.json`, Google Drive Vault):**
   - **Key Wrapping:** PBKDF2-HMAC-SHA256 (`600,000` iterations default; valid bounds `100,000..5,000,000`, 16-byte random salt) + AES-256-GCM (12-byte random IV, 128-bit tag, AAD-bound envelope metadata)
   - **Per-Purpose Key Derivation:** HKDF-SHA256 (`chm-vault-v1:<purpose>:epoch=<epoch>`) deriving isolated AES-256-GCM keys for `manifest`, `proofs`, `profiles`, `policies`, `settings`, and `snapshots` from an independent 256-bit random Vault Master Key (`VMK`)
7. **Optional Auth-Only Nostr Transport Primitives (`CHM-SYNC-v1`, strictly isolated from Ed25519):** BIP-340 Schnorr on secp256k1 (`NIP-01`), Versioned ChaCha20 + HMAC-SHA256 (`NIP-44 v2`), Ephemeral Gift Wrap (`NIP-59`), and scrypt + XChaCha20-Poly1305 (`NIP-49` `ncryptsec1`)

---

## 2. Canonical Artwork Raster (`CAR-v1`) & Hash Normalization

To eliminate browser `<canvas>` premultiplied-alpha corruption and color-profile conversion differences:

1. **Pixel Format:** Un-premultiplied (straight) **RGBA8**, 4 bytes per pixel `[R, G, B, A]` (`0..255`), stored in row-major order (top-to-bottom, left-to-right).
2. **PNG Decoding Rules:**
   - Pre-flight `IHDR` validation MUST verify PNG magic bytes and enforce dimension/pixel limits (`<= 8192 px` input / `<= 10240 px` output, `<= 33,554,432` pixels) **before** `IDAT` decompression.
   - `8-bit RGBA` (`colorType=6, bitDepth=8`) is copied verbatim without premultiplication, preserving RGB bytes even where `A = 0`.
   - `16-bit` channels are downscaled by `sample >> 8`.
   - `RGB` (`colorType=2`) expands to `[R, G, B, alpha]` (`0` if matching `tRNS`, else `255`).
   - `Grayscale` (`colorType=0`) and `Grayscale+Alpha` (`colorType=4`) expand `[G, G, G, A]`.
   - `Indexed` (`colorType=3`) expands via `PLTE` and `tRNS` (`255` when `index >= tRNS.length`).
3. **Native Working Project File Inputs (`.psd`, `.psb`, `.clip`, `.procreate`, `.kra`, etc.):**
   - Primary signing in `/create` requires a multi-layer native working project file rather than a standalone flat PNG/JPEG/WebP image, preventing one-click AI-generated rasters and camera photos from spoofing hand-drawn provenance.
   - Pre-flight header checks enforce file size (`<= 512 MiB`), canvas dimensions (`<= 16384 px`, `<= 64 MP`), and layer count (`<= 2048`) **before** full buffer allocation. For `.psd`/`.psb`, the parser verifies actual layer records and requires at least `2` active layers containing non-transparent pixel data (rejecting single-layer PSDs and empty-transparent-layer bypasses).
   - Composite image data (8-bit, 16-bit, or 32-bit RGB, Grayscale, or CMYK; Raw or PackBits RLE) is decoded and normalized 100% locally in the browser into Canonical Artwork Raster (`CAR-v1` straight `RGBA8`) and exported exclusively as a lossless RGBA8 PNG with the embedded QR code. The raw working file is never uploaded to any server, and its SHA-256 hash is bound into Protocol `v3` `evidenceHashes` (CBOR key `16`).
4. **Artwork Digest:**
   - **Protocol `v1` (or `v3` without `qrMask`):** `artworkSha256 = SHA-256(rgba8Bytes)` where `rgba8Bytes` is the cropped `region = [artX, artY, artW, artH]` (`artW * artH * 4` bytes).
   - **Protocol `v2` (or `v3` with `qrMask`):** Extract the cropped `region = [artX, artY, artW, artH]` RGBA8 bytes, overwrite every byte inside `qrMask = [mx, my, mw, mh]` (coordinates relative to `region`) with `0x00`, and compute `artworkSha256 = SHA-256(maskedRgba8Bytes)` (see Section 3.2).
   - Dimension confusion (e.g., `100×200` vs `200×100`) is prevented because `region = [x, y, width, height]` (and `qrMask` when present) is bound inside the signed manifest.

---

## 3. Solving the QR / Image Hash Circular Dependency

Burning a QR code into a PNG modifies the image file bytes. Certified Handmade provides three mutually compatible, non-circular protocol versions:

### 3.1 Protocol v1 (and v3 Outer-Border) — Outer QR Border

1. Layout calculation determines the output canvas `(outWidth, outHeight)` and the artwork rectangle `region = [artX, artY, artW, artH]` **before** final signing (converging QR module count via at most 3 deterministic passes).
2. `artworkSha256` hashes **only** the untouched `artW × artH` artwork pixels inside `region`.
3. The Ed25519 signature binds `region = [artX, artY, artW, artH]` and `artworkSha256`.
4. The QR code (ECC level `M`) and optional provenance label are rendered **strictly outside** `[artX, artY, artW, artH]` into the surrounding margin of the lossless output PNG.
5. During verification:
   - If uploaded image dimensions equal `(artW, artH)` (`full-artwork` match mode), the verifier hashes `[0, 0, artW, artH]`.
   - Otherwise, if `artX + artW <= imgW && artY + artH <= imgH` (`embedded-region` match mode), the verifier extracts `[artX, artY, artW, artH]` and computes `SHA-256`.

### 3.2 Protocol v2 (and v3 Masked Studio) — In-Image QR Overlay (`qrMask`)

When an artist embeds a translucent or styled QR code directly on top of the illustration without adding an outer border:

1. `region` MUST cover `[0, 0, artW, artH]` (or an explicit bounded rectangle `region`).
2. `qrMask = [mx, my, mw, mh]` defines the exact bounding rectangle (in pixels relative to `region`) into which the QR code overlay is composited. Constraints enforced by encoder and verifier:
   - `mx >= 0`, `my >= 0`, `mw >= 21`, `mh >= 21`
   - `mx + mw <= region[2]` (`artW`) and `my + mh <= region[3]` (`artH`)
   - All coordinates are non-negative safe integers within `MAX_OUTPUT_DIMENSION` (`10240`).
3. **Masked Hash Computation (`hashMaskedArtworkRegion`):**
   - Extract the canonical straight-RGBA8 slice for `region` (`w = region[2]`, `h = region[3]`, `stride = w * 4`).
   - For each row `r` from `0` to `mh - 1`:
     fill bytes `[ (my + r) * stride + mx * 4 .. (my + r) * stride + (mx + mw) * 4 )` with `0x00`.
   - Compute `artworkSha256 = SHA-256(maskedBytes)`.
4. **QR Compositing:** Pixels inside `[mx, my, mw, mh]` are straight-alpha blended with the QR pattern (ECC level `M`, `Q`, or `H`, minimum 2-module quiet zone inside the box). Pixels **outside** `qrMask` remain bit-for-bit identical to the input artwork.
5. **Security Boundary of `qrMask`:**
   - **Pixels inside `qrMask` are NOT covered by `artworkSha256`** and may be altered without breaking hash verification.
   - Every pixel **outside** `qrMask` is protected byte-for-byte by `artworkSha256`.
   - Verifiers MUST clearly notify users of the `qrMask` bounds (`[mx, my, mw, mh]`) whenever `qrMask` is present (`v2` or `v3`).
6. During verification:
   - If `imgW === region[2] && imgH === region[3]`, apply `hashMaskedArtworkRegion` over `[0, 0, region[2], region[3]]`.
   - Otherwise, if `region[0] + region[2] <= imgW && region[1] + region[3] <= imgH`, apply `hashMaskedArtworkRegion` over `region`. (`matchedMode = 'in-image-masked'`).

### 3.3 Protocol v3 (`CHM3\0`) — Self-Contained Compact QR Envelope

Protocol `v3` (`PROTOCOL_VERSION_COMPACT = 3`) extends the QR manifest so an entire self-declared provenance dossier—description, creator website, up to 12 SNS links, up to 8 portfolio links, creation method & environment, up to 8 local evidence SHA-256 hashes, 12-bit extended policy flags, and `policyNote`—can be carried **offline directly inside the QR payload** (working seamlessly alongside or without a separate `.chmevidence` file), using canonical dictionary compression and optional raw DEFLATE while strictly bounding envelope size to `MAX_PROOF_BYTES = 2048` and decompressed payload size to `MAX_V3_DECOMPRESSED_BYTES = 8192`.

See [`docs/CHM-COMPACT-PROOF-V3.md`](./docs/CHM-COMPACT-PROOF-V3.md) for byte-level rationale and benchmark measurements.

---

## 4. Deterministic CBOR Manifest & Signature Format

### 4.1 Unsigned Manifest Map (`payloadBytes`)

Encoded as a deterministic RFC 8949 CBOR map with integer keys sorted ascending:

| Key | Name | CBOR Type | Protocol | Constraints |
| --- | --- | --- | --- | --- |
| `1` | `artworkId` | `bstr` (16 bytes) | `v1`, `v2`, `v3` | Random RFC 4122 UUIDv4 bytes |
| `2` | `publicKey` | `bstr` (32 bytes) | `v1`, `v2`, `v3` | Raw Ed25519 public key |
| `3` | `sha256` | `bstr` (32 bytes) | `v1`, `v2`, `v3` | Canonical RGBA8 SHA-256 digest (masked when `key 9` present) |
| `4` | `region` | `array(4)` of `uint` | `v1`, `v2`, `v3` | `[x, y, width, height]`, `w >= 1, h >= 1`, within `10240` |
| `5` | `issuedAt` | `uint` | `v1`, `v2`, `v3` | Self-declared Unix epoch seconds |
| `6` | `license` | `array(4..5)` (`v1`/`v2`), `array(2..3)` (`v3`) | `v1`, `v2`, `v3` | `v1`/`v2`: `[licenseCode, commercial, redistribution, aiTraining, attributionName?]`; `v3`: `[licenseCode, packedFlags12Bit, attributionName?]` |
| `7` | `authorName` | `tstr` (optional) | `v1`, `v2`, `v3` | `v1`/`v2`: max `48` UTF-8 B; `v3`: max `64` UTF-8 B (sanitized) |
| `8` | `artworkTitle` | `tstr` (optional) | `v1`, `v2`, `v3` | `v1`/`v2`: max `64` UTF-8 B; `v3`: max `128` UTF-8 B (sanitized) |
| `9` | `qrMask` | `array(4)` of `uint` | `v2`, `v3` | `[mx, my, mw, mh]`, `mw,mh >= 21`, inside `region`; forbidden in `v1` |
| `10` | `description` | `tstr` (optional) | `v3` only | Multiline sanitized (`\n`/`\t` allowed, `\r` normalized), max `600` UTF-8 B |
| `11` | `website` | `array(2)` (optional) | `v3` only | `[urlPrefixCode, urlSuffix]`, longest-prefix canonical URL (`http:`/`https:`, `<=512` B) |
| `12` | `snsLinks` | `array(1..12)` (optional) | `v3` only | Items: `[urlCode, urlSuffix]`, `[urlCode, urlSuffix, platformCode]`, or `[urlCode, urlSuffix, platformCode, label]` (`label <= 48` B) |
| `13` | `portfolioLinks` | `array(1..8)` (optional) | `v3` only | Items: `[urlCode, urlSuffix]` or `[urlCode, urlSuffix, label]` (`label <= 48` B) |
| `14` | `creationMethod` | `uint` (optional) | `v3` only | `1`=`hand-drawn-no-ai`, `2`=`hand-drawn-ai-assisted`, `3`=`ai-generated`, `4`=`other`, `5`=`prefer-not-to-disclose` |
| `15` | `creationEnvironment` | `map` (optional, non-empty) | `v3` only | `1`: `software` (`<=96` B), `2`: `hardware` (`<=96` B), `3`: `inputDevice` (`<=96` B), `4`: `notes` (multiline `<=240` B) |
| `16` | `evidenceHashes` | `array(1..8)` (optional) | `v3` only | Items: `[sha256_32, byteLength, categoryCode?, label?, mimeType?]` (`category` `1..6`, `label <= 96` B basename only, `mimeType <= 64` B) |
| `17` | `policyNote` | `tstr` (optional) | `v3` only | Multiline sanitized custom policy note, max `240` UTF-8 B |

#### License, Policy & Compact Dictionary Codes

- `licenseCode`: `0`=`ARR`, `1`=`CC0-1.0`, `2`=`CC-BY-4.0`, `3`=`CC-BY-SA-4.0`, `4`=`CC-BY-NC-4.0`, `5`=`CC-BY-NC-SA-4.0`, `6`=`CC-BY-ND-4.0`, `7`=`CC-BY-NC-ND-4.0`
- `v1`/`v2` Policy Signals: `0`=`unspecified`, `1`=`allow`, `2`=`disallow`; optional 5th element `attributionName` (`<=48` UTF-8 B)
- **`v3` Packed Policy Flags (`packedFlags12Bit`, integer `0..0xfff`):**
  - Bits `0..1`: `commercialUse` (`0`/`1`/`2`)
  - Bits `2..3`: `redistribution` (`0`/`1`/`2`)
  - Bits `4..5`: `aiTraining` (`0`/`1`/`2`)
  - Bits `6..7`: `allowsDerivatives` (`0`/`1`/`2`)
  - Bits `8..9`: `allowsModifications` (`0`/`1`/`2`)
  - Bit `10`: `hasRequiresAttribution` (`0` omitted, `1` present)
  - Bit `11`: `requiresAttribution` boolean (`1` if `bit 10 == 1` and attribution required; MUST be `0` if `bit 10 == 0`)
- **`v3` URL Prefix Dictionary (`V3_URL_PREFIX_DICT` codes `1..15`):**
  `1`=`https://`, `2`=`http://`, `3`=`https://x.com/`, `4`=`https://bsky.app/profile/`, `5`=`https://www.pixiv.net/users/`, `6`=`https://skeb.jp/@`, `7`=`https://vgen.co/`, `8`=`https://mastodon.social/@`, `9`=`https://misskey.io/@`, `10`=`https://njump.me/`, `11`=`https://www.furaffinity.net/user/`, `12`=`https://www.deviantart.com/`, `13`=`https://www.instagram.com/`, `14`=`https://www.youtube.com/@`, `15`=`https://github.com/`. Verifiers MUST reject non-longest prefix matches.

### 4.2 Domain-Separated Signing Input

To prevent cross-protocol signature reuse:

- **Protocol `v1` & `v2`:**
  ```
  signingMessage = 0x43 0x48 0x4D 0x31 0x00 || payloadBytes   // "CHM1\0"
  signature      = Ed25519_Sign(privateKey, signingMessage)    // 64 bytes
  ```
- **Protocol `v3`:** Signature covers the **uncompressed canonical `payloadBytes`** with the `v3` prefix so compression never invalidates verification or introduces compression-oracle malleability:
  ```
  signingMessage = 0x43 0x48 0x4D 0x33 0x00 || payloadBytes   // "CHM3\0"
  signature      = Ed25519_Sign(privateKey, signingMessage)    // 64 bytes
  ```

### 4.3 Signed Proof Envelope (`proofBytes`)

Encoded as a deterministic RFC 8949 CBOR array:

- **Protocol `v1` & `v2` (3-element array):**
  ```
  proofEnvelope = [ version, payloadBytes, signature ]         // version in {1, 2}
  ```
- **Protocol `v3` (4-element array):**
  ```
  proofEnvelope = [ 3, compressionFlag, payloadOrDeflatedBytes, signature ]
  // compressionFlag = 0 (raw payloadBytes) or 1 (raw DEFLATE bytes strictly smaller than payloadBytes)
  ```

Maximum encoded envelope size across all versions: `2048` bytes (`MAX_PROOF_BYTES`). Maximum decompressed `payloadBytes` in `v3`: `8192` bytes (`MAX_V3_DECOMPRESSED_BYTES`).

### 4.4 Anti-Malleability & Version Validation Rules

A conforming verifier MUST reject proofs if any of the following hold:
- Indefinite-length CBOR items, `undefined`, `NaN`, `Infinity`, floats, BigInts, invalid UTF-8, or duplicate map keys are present.
- `version` is not an integer in `{1, 2, 3}`: MUST explicitly return `Unsupported` protocol version rather than silently downgrading or partially parsing unknown structures.
- Array arity mismatch (`!= 3` for `v1`/`v2`, `!= 4` for `v3`), invalid `compressionFlag` (`notin {0, 1}`), compressed `payloadOrDeflatedBytes` that is not strictly smaller than decompressed `payloadBytes` (`deflated.length >= payloadBytes.length`), or decompressed output exceeding `8192` bytes.
- Unknown map keys or malformed values in `payloadBytes`:
  - `version == 1`: keys outside `{1..8}` (including `9` `qrMask`) MUST be rejected.
  - `version == 2`: keys outside `{1..9}` MUST be rejected.
  - `version == 3`: keys outside `{1..17}` MUST be rejected; `v3` string/URL sanitizers MUST reject ASCII control chars (`<0x20` except `\n`/`\t` on multiline fields), C1 controls (`U+007F..U+009F`), Unicode bidi overrides (`U+202A..U+202E`, `U+2066..U+2069`), non-canonical URL prefix codes, embedded URL `user:pass@` credentials, or non-`http:`/`https:` schemes.
- Re-encoding the decoded payload map or outer envelope with RFC 8949 deterministic rules does not match the input bytes byte-for-byte.

---

## 5. QR Code URI Format & Optional Portable Proof Bundle

### 5.1 Embedded QR URI Format

```
https://www.certified-handmade.com/verify#proof=<base64url(proofBytes)>
```

- Using the URL **fragment** (`#proof=...`) ensures browsers never transmit the proof payload in HTTP requests.
- Protocol `v1` and outer-border `v3` QR codes use Error Correction Level `M` (15%) with a mandatory minimum **4-module** `#FFFFFF` quiet zone and integer pixel module scaling.
- Masked in-image QR codes (`v2`, or `v3` with `qrMask`) support Error Correction Levels `M`, `Q`, or `H` and embed directly inside `qrMask`.
- Offline verifiers (including Standalone Edition on `127.0.0.1:43777`) MUST parse the `#proof=` token locally and MUST NOT perform any automatic outbound navigation or network lookup to `certified-handmade.com`.

### 5.2 Optional Portable Proof Bundle (`.chproof.json`)

For convenient file-based archiving or USB transfer alongside an unmodified artwork file, an optional versioned JSON container wraps the **exact unmodified `proofBase64Url` bytes**:

```json
{
  "format": "certified-handmade-proof-bundle",
  "version": 1,
  "protocolVersion": 3,
  "artworkId": "01234567-89ab-cdef-4123-8123456789ab",
  "publicKeyFingerprint": "<64-char sha256(publicKey) hex>",
  "createdAt": "2026-11-23T00:00:00.000Z",
  "proofBase64Url": "<unpadded base64url(proofBytes)>"
}
```

- The cryptographic signature binds only `proofBytes` (`proofBase64Url`); JSON wrapper fields (`createdAt`, `artworkId`, `publicKeyFingerprint`) are convenience metadata and MUST NOT be trusted unless matched against the verified CBOR payload.

---

## 6. Author Public Key Fingerprint

```
fingerprint  = SHA-256(publicKey32)   // 32 bytes / 64 lowercase hex chars
shortDisplay = "CHM-" + uppercase(hex(fingerprint[0..8])).groupedBy4("-")
```

---

## 7. Independent Offline Verification Algorithm

Any standalone script or tool (Python, Rust, Go, Node.js) can verify a signed PNG, `#proof=...` token, or `.chproof.json` bundle completely offline:

1. Extract the `#proof=` token (from QR text, URL fragment, raw token, or `.chproof.json`'s `proofBase64Url`) and decode unpadded base64url into `proofBytes` (`<= 2048` B).
2. Decode `proofBytes` as strict CBOR:
   - If `version in {1, 2}`: `[version, payloadBytes, signature64]`.
   - If `version == 3`: `[3, compressionFlag, rawOrDeflatedBytes, signature64]`; if `compressionFlag == 1`, inflate raw DEFLATE strictly bounded to `<= 8192` bytes into `payloadBytes` and verify strict shrinkage (`rawOrDeflatedBytes.length < payloadBytes.length`).
   - Otherwise, report `Unsupported` and stop. Confirm canonical re-encoding of the outer array.
3. Verify Ed25519 signature over domain-separated payload:
   - `v1`/`v2`: `Ed25519_Verify(publicKey, b"CHM1\x00" + payloadBytes, signature64)`
   - `v3`: `Ed25519_Verify(publicKey, b"CHM3\x00" + payloadBytes, signature64)`
   -> sets **Cryptographic Signature** (`Valid` / `Invalid`).
4. Decode `payloadBytes` as strict CBOR map (`{1..8}` for `v1`, `{1..9}` for `v2`, `{1..17}` for `v3`) and confirm canonical re-encoding. Validate `region`, optional `qrMask`, compact URL dictionary canonicality, policy flags, and string sanitization constraints.
5. **Artwork Integrity** (if an artwork image is supplied):
   - Decode the PNG into straight RGBA8 (`CAR-v1`, enforcing pre-flight `IHDR` size bounds).
   - Extract `region = [x, y, w, h]` (or `[0, 0, w, h]` when image dimensions equal `(w, h)`).
   - If `qrMask` (`key 9`) is present, zero all RGBA bytes inside `[mx, my, mw, mh]` relative to the extracted rectangle before hashing.
   - Compare `SHA-256(rasterBytes)` with key `3` -> sets **Artwork Integrity** (`Matched` / `Mismatched` / `Not Checked`).
6. **Evidence File Hashes (Mode C via `v3` `key 16` or `.chmevidence`):**
   - If local evidence files are supplied, stream each file (`<= 512 MiB`) to compute `SHA-256` + `byteLength` and compare against signed records; unmatched supplied files MUST be flagged. Missing local files for signed records MUST be reported as *Unavailable*, never *Invalid*.
7. **Author Identity** (local trust store only):
   - Compare `publicKey` against the verifier's own local trusted keys list -> sets **Author Identity** (`Locally Trusted Key` / `Unknown / Unverified Key`).
   - A `Valid` signature proves only that the holder of the matching Ed25519 private key signed the manifest; it does **not** independently prove hand-drawn creation or legal copyright ownership.

---

## 8. Normative Test Vector (v1 — Outer QR Border)

- **Ed25519 Seed (hex, test only):**
  `9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60`
- **Ed25519 Public Key (hex):**
  `d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a`
- **Public Key Fingerprint (SHA-256 hex):**
  `21fe31dfa154a261626bf854046fd2271b7bed4b6abe45aa58877ef47f9721b9` (`CHM-21FE-31DF-A154-A261`)
- **Artwork ID (hex / UUID):**
  `0123456789abcdef41238123456789ab` (`01234567-89ab-cdef-4123-8123456789ab`)
- **2×2 Test Artwork RGBA8 Bytes (hex):**
  `ff0000ff00ff00ff0000ffff7b2d4300`
- **Artwork SHA-256 (hex):**
  `e6019fe41c7637360ab90c89c338b1dc864766c7adbb48b960abd9463725c57a`
- **Region:** `[24, 24, 2, 2]`
- **Issued At:** `1795352786`
- **License Tuple:** `[4, 2, 1, 2, "YomiPlush"]` (`CC-BY-NC-4.0`, commercial=`disallow`, redistribution=`allow`, aiTraining=`disallow`)
- **Author Name:** `"YomiPlush"`
- **Artwork Title:** `"Test Vector 2x2"`
- **Canonical Payload CBOR (hex):**
  `a801500123456789abcdef41238123456789ab025820d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a035820e6019fe41c7637360ab90c89c338b1dc864766c7adbb48b960abd9463725c57a0484181818180202051a6b02e8d206850402010269596f6d69506c7573680769596f6d69506c757368086f5465737420566563746f7220327832`
- **Ed25519 Signature over `CHM1\0 || payload` (hex):**
  `de1ee87132b29a89a89f1954b56ba0872abb07b7f38bbf05de73fa7d0064f217a22ed3c8168000d552b04e92acdc9d9310d8cb78ef932e59adeb71ac6968d404`
- **Proof Token (`#proof=...`):**
  `gwFYk6gBUAEjRWeJq83vQSOBI0VniasCWCDXWpgBgrEKt9VL_tPJZAc6DuFy89qmIyWvAhpo9wdRGgNYIOYBn-Qcdjc2CrkMicM4sdyGR2bHrbtIuWCr2UY3JcV6BIQYGBgYAgIFGmsC6NIGhQQCAQJpWW9taVBsdXNoB2lZb21pUGx1c2gIb1Rlc3QgVmVjdG9yIDJ4MlhA3h7ocTKymomonxlUtWughyq7B7fzi78F3nP6fQBk8heiLtPIFoAA1VKwTpKs3J2TENjLeO-TLlmt63GsaWjUBA`

---

## 9. Normative Test Vector (v2 — In-Image Masked QR)

- **Ed25519 Seed & Public Key:** Same as Section 8 (`d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a`, `CHM-21FE-31DF-A154-A261`)
- **Artwork ID (hex / UUID):**
  `fedcba98765443218123456789abcdef` (`fedcba98-7654-4321-8123-456789abcdef`)
- **24×24 Synthetic Test Artwork RGBA8 Pattern:**
  For `y = 0..23`, `x = 0..23`, pixel `[R, G, B, A] = [(x * 10 + y) & 0xff, (x + y * 10) & 0xff, (x ^ y) & 0xff, 255]`
- **Region:** `[0, 0, 24, 24]`
- **QR Mask (`key 9`):** `[2, 2, 21, 21]`
- **Masked Artwork SHA-256 (after zeroing `[2, 2, 21, 21]` RGBA bytes, hex):**
  `be13d44bb13b0aa8d26c9ee3af23e0fb583dea9a94a26114f39dee5aa52598f3`
- **Issued At:** `1795352786`
- **License Tuple:** `[0, 2, 2, 2]` (`ARR`, commercial=`disallow`, redistribution=`disallow`, aiTraining=`disallow`)
- **Author Name:** `"YomiPlush"`
- **Artwork Title:** `"Test Vector v2 Masked"`
- **Canonical Payload CBOR (hex):**
  `a90150fedcba98765443218123456789abcdef025820d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a035820be13d44bb13b0aa8d26c9ee3af23e0fb583dea9a94a26114f39dee5aa52598f30484000018181818051a6b02e8d20684000202020769596f6d69506c75736808755465737420566563746f72207632204d61736b6564098402021515`
- **Ed25519 Signature over `CHM1\0 || payload` (hex):**
  `82c2fa87fb210ee446c84250cd19e580691e5dd90cafce66e6778b6c4a20cbd969f51800f74d695931eb9642da1a8e0e6038d07d5bf0bfe5d01849e5f1677e03`
- **Proof Token (`#proof=...`):**
  `gwJYlakBUP7cuph2VEMhgSNFZ4mrze8CWCDXWpgBgrEKt9VL_tPJZAc6DuFy89qmIyWvAhpo9wdRGgNYIL4T1EuxOwqo0mye468j4PtYPeqalKJhFPOd7lqlJZjzBIQAABgYGBgFGmsC6NIGhAACAgIHaVlvbWlQbHVzaAh1VGVzdCBWZWN0b3IgdjIgTWFza2VkCYQCAhUVWECCwvqH-yEO5EbIQlDNGeWAaR5d2Qyvzmbmd4tsSiDL2Wn1GAD3TWlZMeuWQtoajg5gONB9W_C_5dAYSeXxZ34D`

---

## 10. Offline Key Revocation & Rotation Notices (`CHM-NOTICE1\0`)

Certified Handmade allows artists to publish offline-verifiable key revocation and key rotation notices without introducing any central certificate authority (CA) or online Certificate Revocation List (CRL) server.

### 10.1 Notice Payload Map (`payloadBytes`)

Encoded as deterministic RFC 8949 CBOR map with integer keys sorted ascending:

| Key | Name | CBOR Type | Constraints |
| --- | --- | --- | --- |
| `1` | `noticeId` | `bstr` (16 bytes) | Random RFC 4122 UUIDv4 bytes |
| `2` | `noticeType` | `uint` | `1` = `revocation`, `2` = `rotation` |
| `3` | `subjectPublicKey` | `bstr` (32 bytes) | Ed25519 public key being revoked or rotated |
| `4` | `replacementPublicKey` | `bstr` (32 bytes, optional) | **Required** for `rotation` (`2`), MUST differ from `subjectPublicKey`; **forbidden** for `revocation` (`1`) |
| `5` | `noticeIssuedAt` | `uint` | Self-declared Unix epoch seconds |
| `6` | `reason` | `uint` | `1` = `key-compromise`, `2` = `key-superseded`, `3` = `retired`, `4` = `other` |
| `7` | `note` | `tstr` (optional) | Max `160` UTF-8 bytes, no ASCII control chars (`<0x20` or `0x7f`) |

### 10.2 Domain-Separated Signing Input & Envelope

```
noticeSigningMessage = 0x43 0x48 0x4D 0x2D 0x4E 0x4F 0x54 0x49 0x43 0x45 0x31 0x00 || payloadBytes
                       ("C"  "H"  "M"  "-"  "N"  "O"  "T"  "I"  "C"  "E"  "1"  "\0")
```

- **Revocation Notice (`noticeType == 1`):**
  `noticeEnvelope = [ 1, payloadBytes, subjectSignature ]` (3-element CBOR array; signed by `subjectPublicKey`).
- **Rotation Notice (`noticeType == 2`):**
  `noticeEnvelope = [ 1, payloadBytes, subjectSignature, replacementSignature ]` (4-element CBOR array; **dual-signed** by both `subjectPublicKey` and `replacementPublicKey` over identical `noticeSigningMessage`).
- Maximum encoded notice envelope size: `2048` bytes (`MAX_NOTICE_BYTES`).
- Transport representations: `chm-notice:<unpadded base64url(noticeBytes)>` token or portable `.chnotice.json` (`format: "certified-handmade-key-notice"`, `version: 1`).

### 10.3 Verification & Honest Semantics

1. Offline verifiers MUST validate canonical CBOR encoding and verify both signatures cleanly for `rotation` notices (or `subjectSignature` for `revocation`).
2. **`noticeIssuedAt` vs `verifiedAt`:** Verifiers MUST treat `noticeIssuedAt` as self-declared and distinguish it from local inspection time (`verifiedAt`).
3. **Leaked-Key Limitation:** If a private key was leaked, an attacker holding that seed can sign arbitrary revocation notices or backdated artwork manifests (`CHM1\0` / `CHM3\0`). Verifiers MUST warn users to confirm key status and replacements out-of-band.
4. **Absence of Local Notices:** Without a central CRL, finding zero matching notices in local storage MUST be reported only as *no local notice found on this device* — NEVER as "Not Revoked".
5. **Historical Proof Independence:** Importing a revocation or rotation notice MUST NEVER rewrite past certificates' mathematical `Signature Valid` / `Artwork Integrity` evaluation; the local notice warning is surfaced separately alongside historical cryptographic results.

---

## 11. Offline Key-Possession Challenge-Response (`CHM-CHALLENGE1\0`)

To let two parties test offline whether someone currently possesses the private key corresponding to a known Ed25519 public key:

### 11.1 Challenge Payload Map

| Key | Name | CBOR Type | Constraints |
| --- | --- | --- | --- |
| `1` | `challengeId` | `bstr` (16 bytes) | Random RFC 4122 UUIDv4 bytes |
| `2` | `targetPublicKey` | `bstr` (32 bytes) | Target Ed25519 public key |
| `3` | `nonce` | `bstr` (32 bytes) | Random 32-byte fresh challenge nonce |
| `4` | `issuedAt` | `uint` | Challenge generation Unix epoch seconds |
| `5` | `note` | `tstr` (optional) | Max `96` UTF-8 bytes, no ASCII control chars |

### 11.2 Envelopes & Signature Scope

- **Challenge:** `chm-challenge:<base64url([ 1, payloadBytes ])>`
- **Response:** `chm-response:<base64url([ 1, payloadBytes, signature64 ])>` where:
  ```
  challengeSigningMessage = "CHM-CHALLENGE1\0" || payloadBytes
  signature64             = Ed25519_Sign(targetPrivateKey, challengeSigningMessage)
  ```
- Maximum envelope size: `1024` bytes (`MAX_CHALLENGE_BYTES`).
- Passing a challenge verification MUST match exact canonical `payloadBytes` (preserving `nonce`, `challengeId`, `targetPublicKey`, `issuedAt`, and `note`) and proves **private-key possession for that nonce only**. It does **not** prove real-world legal identity, copyright ownership, or that an artwork was created without AI.

---

## 12. Auxiliary Perceptual Similarity & Independent Offline CLI Verifiers

### 12.1 Non-Cryptographic Perceptual Similarity (`dHash64` + `DCT pHash64`)

- Strict `SHA-256` over `CAR-v1` canonical RGBA8 pixels remains the **only** cryptographic integrity mechanism in Certified Handmade.
- Optional visual comparison helpers compute a 64-bit difference hash (`dHash64`, `9×8` grayscale box downsample) and 64-bit 2D-DCT perceptual hash (`pHash64`, `32×32` grayscale downsample) strictly locally to assist artists comparing recompressed social-media copies against a reference image.
- Implementations MUST label perceptual comparisons explicitly as **non-cryptographic auxiliary hints** (`isCryptographic: false`) and NEVER use them to mark `Artwork Integrity` as `Matched`.

### 12.2 Independent Offline CLI Verifiers

To prevent single-implementation lock-in and support long-term auditability, the repository provides two standalone offline CLI verifiers importing **zero modules from `src/`**:

- **Go CLI (`tools/chm-verify/`):** Standard-library-only Go binary verifying `#proof=` tokens (`v1`, `v2`, and `v3` `CHM3\0` with raw DEFLATE decompression & compact dictionary expansion), `.chproof.json`, `.chmevidence` + local evidence files (including `v3` `evidenceHashes` Mode C verification), lossless PNG `CAR-v1` integrity (including `qrMask`), and `.chnotice.json` / `chm-notice:` tokens.
- **Node.js CLI (`tools/chm-verify.mjs`):** Minimal Node.js verifier supporting PNG embedded-QR extraction, `v1`/`v2`/`v3` verification, `--proof`, `--artwork`, `--evidence`, `--evidence-file`, `--notice`, and `--json`.

---

## 13. CHM Secure Device Pairing (`CHM-DEVICE-PAIRING-v1`)

`CHM-DEVICE-PAIRING-v1` enables serverless, offline 2-step QR enrollment of secondary devices (PC, smartphone, tablet) under an existing **CHM Identity** (Ed25519 author public key) without copying the root private key. Core protocol implementation resides in `@yomiplush/chm-exchange/core` and host IndexedDB custody/reconciliation resides in `src/core/storage/devicePairingStore.ts`.

### 13.1 Domain-Separated Envelopes & Canonical CBOR

All envelopes use strict deterministic RFC 8949 CBOR maps (ascending integer keys, canonical re-encode byte-for-byte check, no floats/indefinite/duplicate keys, `MAX_PAIRING_CBOR_BYTES = 2048`, `MAX_PAIRING_TOKEN_CHARS = 3072`, `MAX_PAIRING_QR_URL_CHARS = 4096`):

| Kind | Prefix / Fragment | Domain Prefix | Signer |
| --- | --- | --- | --- |
| `1` Pairing Request | `chm-pair-req:` / `#pair-req=` | `CHM-DEVICE-PAIRING-v1:REQ\0` | New Device Private Key |
| `2` Enrollment Certificate | `chm-pair-cert:` / `#pair-cert=` | `CHM-DEVICE-PAIRING-v1:CERT\0` | Owner Root Private Key |
| `3` Device Revocation Notice | `chm-pair-rev:` / `#pair-rev=` | `CHM-DEVICE-PAIRING-v1:REVOKE\0` | Owner Root Private Key |
| `4` Signed Device Registry | `chm-pair-reg:` / `.chdevreg.{json,cbor}` | `CHM-DEVICE-PAIRING-v1:REGISTRY\0` | Owner Root Private Key |

Out-of-band pairing confirmation code (`CHM-PAIR-CONFIRM1\0`) uses `SHA-256("CHM-PAIR-CONFIRM1\0" || requestHash(32) || nonce(32) || devicePublicKey(32))` formatted as an 8-character Crockford-style code (`A7K9-M2P4`).

### 13.2 Key Custody, Cryptographic Binding & Replay Defense

1. **Key Custody:** Each device generates an independent Ed25519 keypair locally (`webcrypto-non-extractable` in IndexedDB where supported, AES-256-GCM encrypted seed fallback otherwise). Root private keys are never transmitted or copied.
2. **Proof of Possession & Request Binding:** Step 1 signs the pairing request (containing 256-bit `nonce`, `requestId`, `deviceId`, `devicePublicKey`, `deviceDisplayName`, `ownerTarget`, `issuedAt`, `expiresAt`, default TTL `300s`, max `3600s`) with the device private key. Step 2 verifies strict Ed25519 (`zip215: false`, small-order/torsion-free curve point check) and signs an Enrollment Certificate containing `requestHash = SHA-256(canonicalRequestEnvelopeBytes)`.
3. **Replay Protection:** Both `req:<requestId>` and `nonce:<nonceHex>` are persisted in IndexedDB (`usedPairingNonces`) upon completion, rejection of replay, or cancellation—preventing QR replay even if the device clock is rolled back.
4. **Trust & Revocation Semantics:** Scanning an Enrollment Certificate never promotes an unknown Owner Identity to `Trusted` automatically (`active-unverified-owner` until explicitly confirmed). Device revocations (`revocationSequence` monotonic) cannot be rolled back by re-importing older `.chdevreg.json` / `.chdevreg.cbor` registry snapshots.

### 13.3 Separation of Future Delegated Signing (Not Implemented in v1)

In `v1`, allowed permissions in pairing requests and enrollment certificates are restricted to `["device-identity"]`. Any non-v1 or elevated permission (such as delegated artwork signing or delegated device approval) MUST be rejected by `v1` validators.

---

## 14. Metadata & Creation Evidence Extension (`.chmevidence`, `CHM-EVIDENCE1\0`)

For artworks containing very large descriptions (`>600` B) or `9..24` local evidence files exceeding QR capacity, `.chmevidence` (`CHM-EVIDENCE1\0`) serves as a complementary, domain-separated signed extension cryptographically bound (`proofSha256`, `artworkId`, `artworkSha256`, `publicKey`) to any `v1`, `v2`, or `v3` primary proof.

### 14.1 Relationship with Protocol v3

- Protocol `v1` and `v2` proofs keep all extended metadata strictly in `.chmevidence` (`0` extra QR bytes).
- Protocol `v3` carries compact public metadata (`description <= 600 B`, `website`, `<=12` SNS links, `<=8` portfolio links, `creationMethod`, `creationEnvironment`, `<=8` evidence hashes, `policyNote`) directly inside the QR payload, and may still pair with `.chmevidence` when archival evidence sets exceed 8 files or longer notes are needed.

### 14.2 Domain-Separated Envelope & Transport Format

- **Domain Separation Prefix:** `CHM-EVIDENCE1\0` (`[ 1, payloadBytes, signature64 ]`, `MAX_EVIDENCE_CBOR_BYTES = 32,768`).
- **Four-Field Binding:** Verifiers MUST verify the Ed25519 signature AND constant-time equality of `publicKey`, `artworkId`, `artworkSha256`, AND `proofSha256 = SHA-256(proofBytes)`. Mismatches fail with `binding-mismatch`. Standalone `.chmevidence` without a primary proof MUST be rejected.

---

## 15. Opt-In Auth-Only Decentralized Device Sync (`CHM-SYNC-v1`)

`CHM-SYNC-v1` (`src/core/sync/`, `src/core/nostr/`) is an optional device-authentication transport over free Nostr relays (`nostr-protocol/nips@bec0fc8`). It is **disabled at rest** (`enabled: false`) and strictly isolated from proof storage and Google Drive sync.

### 15.1 Strict Auth-Only Boundary

Permitted Nostr sync payloads are restricted exclusively to:
- Device registration (`enroll-device`)
- Device authorization (`authorize-sync-device`)
- Device revocation (`revoke-device`, Priority `0`)
- Identity transport binding (`CHM-SYNC-v1:BIND\0` / `CHM-SYNC-v1:NOSTR-POP\0`)
- Signed identity checkpoint (`checkpoint`)

**Prohibited over Nostr:** Proof vaults (`vaultProofs`), artwork details, author profiles, SNS links, policy presets, general user settings, and new `CHM-PUBLIC-PROOF-v1` broadcasts (`NOSTR_PUBLIC_PROOF_PUBLISHING_DISABLED = true`) MUST NOT be sent over Nostr relays. Any legacy `vaultProofs` / `profileSnapshot` / `trustedArtists` fields encountered in old envelopes are ignored or rejected rather than persisted to Vault.

### 15.2 Key Separation, Binding, Operations & Relay Policy

- **Strict Key Separation:** Per-device `secp256k1` Nostr transport keys (`nostrKeys`) MUST NEVER share key material with any CHM Ed25519 key (`assertNostrSecretKeyDistinctFromEd25519`).
- **Adopted NIPs:** `NIP-01`, `NIP-09`, `NIP-11`, `NIP-42`, `NIP-44 v2`, `NIP-49`, `NIP-59` (`kind 1059`), `NIP-65` (`kind 10002`, capped `<= 8` `wss://` relays). **NIP-04 is strictly forbidden.**
- **Dual-Signed Peer Binding (`CHM-SYNC-v1:BIND\0` + `CHM-SYNC-v1:NOSTR-POP\0`)** & **Hash-Chained Sync Operations (`CHM-SYNC-v1:OP\0`)** verify deterministically via monotonic sequences and `prevOpHash`.
- **Zero-Cost NIP-11 Policy & Budget:** Paid relays are blocked pre-flight and auto-paused at runtime (`payment-required`); `revoke-device` (`Priority 0`) and device auth ops (`Priority 1`) bypass the 1 MiB / 30-day soft rolling sync budget (`DEFAULT_ONLINE_SYNC_BUDGET_BYTES`).

---

## 16. Encrypted Proof Vault & Pluggable Storage (`CHM-VAULT-v1` & Google Drive Vault)

### 16.1 Pluggable `StorageProvider` Backends (`src/core/storage/providers/`)

1. **`IndexedDbStorageProvider` (`certified-handmade-store` v7):** Stores compact signed proof records (`< 1.2 KiB` each, `id = SHA-256(proofBytes)`), author profiles, policy presets, sync/drive state, and tombstones with **zero** raw artwork pixels or plaintext private keys.
2. **`PortableFileStorageProvider` (`.chmvault.json`):** Plain (`certified-handmade-vault-backup` v1, `containsPrivateKeys: false`) or passphrase-encrypted (`certified-handmade-vault-encrypted-backup` v1, `PBKDF2-SHA256 600,000` + `AES-256-GCM`) portable archives. Restored proofs re-verify Ed25519 signatures before entering IndexedDB.
3. **`GoogleDriveStorageProvider` (`src/core/google/`, `src/core/vault/`):** Optional personal Google Drive Encrypted Vault using GIS OAuth 2.0 Token Model (`drive.appdata` `appDataFolder` scope, RAM-only access token, `drive.about.get` account binding, `appProperties` folder/file discovery).

### 16.2 Encrypted Drive Vault Cryptography (`src/core/vault/vaultCrypto.ts`)

- **Independent Vault Master Key (`VMK`):** 256-bit CSPRNG key (`generateVaultMasterKey`), never derived from Ed25519 signing keys or Nostr `secp256k1` keys (`assertVaultPassphraseValid` rejects `nsec1...` and `chm-key-backup...` inputs).
- **Passphrase-Wrapped Keyring (`chm-vault-keyring-v1`):** Wraps epoch `VMK`s with `PBKDF2-SHA256` (`600,000` iterations, bounded `100,000..5,000,000`) + `AES-256-GCM` bound via AAD `CHM-VAULT-KEYRING-v1|vault=<vaultId>|epoch=<currentEpoch>`.
- **HKDF-SHA256 Purpose Separation (`derivePurposeSubkey`):** Derives distinct `AES-256-GCM` keys using salt `SHA-256("chm-hkdf-salt:" + vaultId)` and info `"chm-vault-v1:" + purpose + ":epoch=" + epoch` across 6 strictly separated purposes: `manifest`, `proofs`, `profiles`, `policies`, `settings`, `snapshots`.
- **Per-Record AEAD Envelope (`chm-vault-aead-v1`):** Fresh 96-bit CSPRNG IV per encryption; AAD binds `CHM-VAULT-REC-v1|v=<vaultId>|p=<purpose>|e=<epoch>|id=<recordId>|h=<contentHash>`.
- **Cross-Device Key Share & Epoch Rotation (`chm-vault-keyshare-v1`):** Transfers unlocked epoch keys safely using a temporary sharing passphrase (`CHM-VAULT-SHARE-v1|vault=<vaultId>|epoch=<currentEpoch>`), and supports key epoch rotation (`rotationReason: 'device-revoked' | 'manual-rotation'`). Note: epoch rotation protects *future* writes and cannot erase data already retrieved prior to revocation.
- **Sync Safety Invariants:** `lastManifestSeq` & `lastManifestHash` rollback detection; three-way conflict detection preserving local and remote versions without silent last-write-wins overwrites; soft deletion tombstones; immutable proof chunking (`PROOF_CHUNK_SIZE = 100`); `assertNoForbiddenSyncSecrets` rejecting raw binary buffers, pixels, private keys, `nsec`, and OAuth tokens.

See [`docs/GOOGLE-DRIVE-SETUP.md`](./docs/GOOGLE-DRIVE-SETUP.md), [`docs/STORAGE-PROVIDERS.md`](./docs/STORAGE-PROVIDERS.md), and [`docs/CHM-COMPACT-PROOF-V3.md`](./docs/CHM-COMPACT-PROOF-V3.md) for full details.

---

## 17. Serverless Public-Key Exchange (`/exchange`, `@yomiplush/chm-exchange`)

### 17.1 Host Adapter Boundary & Public-Only Projection (`src/core/exchange/hostAdapter.ts`)

- `/exchange` (`src/pages/ExchangePage.tsx`) mounts `<ChmExchangeView />` from `@yomiplush/chm-exchange/react` backed by `createCertifiedHandmadeExchangeAdapter()`.
- **Public-only identity projection:** `toPublicHostIdentity()` uses `stripToPublicHostIdentity()` so only public fields (`id`, `displayName`, `publicKeyBase64Url`, `fingerprintHex`, `fingerprintShort`, `createdAt`) are exposed from IndexedDB `AuthorKeyRecord` entries. Private key material (`webCryptoPrivateKey`, `encryptedBackup`) is never exposed across the exchange boundary.
- **Trusted key boundary:** `listTrustedKeys()` and `getTrustStatus()` return trusted status **only** for records where `verificationState !== 'unconfirmed'`. `addTrustedKey()` validates the Ed25519 public key, recomputes its `SHA-256` fingerprint locally, and throws (rolling back the write) if any declared `fingerprintHex` does not match.

### 17.2 Transport, Fingerprint Verification & Artwork Package Wrapper (`src/core/exchange/proofAdapter.ts`)

- **Exchange transport:** Public keys are shared locally via `#key=<base64url>` URL fragments (never sent to servers in HTTP `GET` requests), QR codes, or canonical `chm-exchange-public-key` (`v1`) JSON bundles.
- **Trust establishment:** Received keys are inspected locally with recomputed `SHA-256(publicKey32)` (`64`-hex `fingerprintHex` and `CHM-XXXX-XXXX-XXXX-XXXX`) and remain untrusted (`unconfirmed`) until explicit out-of-band fingerprint verification promotes them to `confirmed`.
- **Signed v2 artwork exchange wrapper:** `src/core/exchange/proofAdapter.ts` defines `ChmExchangeArtworkPackage` (`exchange_schema_version: "2.0"`, `package_type: "chm-verified-artwork"`), wrapping a verified `SignedChmProofV2` native project proof (`schema_version: "2"`, `layer_count >= 1`) alongside `gallery_deck` metadata and optional `certified_png_base64`, and re-verifies proofs via `verifyChmProofAny()` on import.

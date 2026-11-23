# Certified Handmade Protocol Specification (`SPEC.md`)

**Protocol Versions:** `1` (Outer QR Border) · `2` (In-Image Masked QR Overlay)  
**Status:** Implemented Specification (`v1` & `v2`)  
**Goal:** Enable anyone, anywhere, forever—even without the original website or any central server—to independently verify signed artwork manifests and pixel integrity using standard cryptographic primitives.

---

## 1. Cryptographic Primitives

1. **Hash Function:** SHA-256 (FIPS 180-4)
2. **Digital Signature:** Pure Ed25519 (RFC 8032)
3. **Binary Serialization:** Deterministic CBOR (RFC 8949 Section 4.2)
4. **Transport Encoding:** Unpadded Base64url (RFC 4648 Section 5, without `=` padding)
5. **Encrypted Key Backup (`.chkey.json`, optional client backup format):** PBKDF2-HMAC-SHA256 (`600,000` iterations, 16-byte salt) + AES-256-GCM (12-byte IV, 128-bit tag, AAD-bound 32-byte Ed25519 public key)

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
3. **Non-PNG Inputs (JPEG, WebP):**
   - Decoded once on import with EXIF orientation applied (`imageOrientation: 'from-image'`, `premultiplyAlpha: 'none'`, `colorSpaceConversion: 'none'`), converted to RGBA8, and exported exclusively as lossless RGBA8 PNG so all downstream verification uses deterministic PNG decoding.
4. **Artwork Digest:**
   - **Protocol v1:** `artworkSha256 = SHA-256(rgba8Bytes)` where `rgba8Bytes` is the cropped `region = [artX, artY, artW, artH]` (`artW * artH * 4` bytes).
   - **Protocol v2:** Extract the cropped `region = [artX, artY, artW, artH]` RGBA8 bytes, overwrite every byte inside `qrMask = [mx, my, mw, mh]` (coordinates relative to `region`) with `0x00`, and compute `artworkSha256 = SHA-256(maskedRgba8Bytes)` (see Section 3.2).
   - Dimension confusion (e.g., `100×200` vs `200×100`) is prevented because `region = [x, y, width, height]` (and `qrMask` in v2) is bound inside the signed manifest.

---

## 3. Solving the QR / Image Hash Circular Dependency

Burning a QR code into a PNG modifies the image file bytes. Certified Handmade provides two mutually compatible, non-circular protocol modes:

### 3.1 Protocol v1 — Outer QR Border (Default)

1. Layout calculation determines the output canvas `(outWidth, outHeight)` and the artwork rectangle `region = [artX, artY, artW, artH]` **before** final signing (converging QR module count via at most 3 deterministic passes).
2. `artworkSha256` hashes **only** the untouched `artW × artH` artwork pixels inside `region`.
3. The Ed25519 signature binds `region = [artX, artY, artW, artH]` and `artworkSha256`.
4. The QR code (ECC level `M`) and optional provenance label are rendered **strictly outside** `[artX, artY, artW, artH]` into the surrounding margin of the lossless output PNG.
5. During verification:
   - If uploaded image dimensions equal `(artW, artH)` (`full-artwork` match mode), the verifier hashes `[0, 0, artW, artH]`.
   - Otherwise, if `artX + artW <= imgW && artY + artH <= imgH` (`embedded-region` match mode), the verifier extracts `[artX, artY, artW, artH]` and computes `SHA-256`.

### 3.2 Protocol v2 — In-Image QR Overlay (`qrMask`)

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
   - Verifiers MUST clearly notify users of the `qrMask` bounds (`[mx, my, mw, mh]`) whenever verifying a Protocol v2 manifest.
6. During verification:
   - If `imgW === region[2] && imgH === region[3]`, apply `hashMaskedArtworkRegion` over `[0, 0, region[2], region[3]]`.
   - Otherwise, if `region[0] + region[2] <= imgW && region[1] + region[3] <= imgH`, apply `hashMaskedArtworkRegion` over `region`. (`matchedMode = 'in-image-masked'`).

---

## 4. Deterministic CBOR Manifest & Signature Format

### 4.1 Unsigned Manifest Map (`payloadBytes`)

Encoded as a deterministic RFC 8949 CBOR map with integer keys sorted ascending:

| Key | Name | CBOR Type | Protocol | Constraints |
| --- | --- | --- | --- | --- |
| `1` | `artworkId` | `bstr` (16 bytes) | `v1`, `v2` | Random RFC 4122 UUIDv4 bytes |
| `2` | `publicKey` | `bstr` (32 bytes) | `v1`, `v2` | Raw Ed25519 public key |
| `3` | `sha256` | `bstr` (32 bytes) | `v1`, `v2` | Canonical RGBA8 SHA-256 digest (masked in `v2`) |
| `4` | `region` | `array(4)` of `uint` | `v1`, `v2` | `[x, y, width, height]`, `w >= 1, h >= 1`, within `10240` |
| `5` | `issuedAt` | `uint` | `v1`, `v2` | Self-declared Unix epoch seconds |
| `6` | `license` | `array(4 or 5)` | `v1`, `v2` | `[licenseCode, commercial, redistribution, aiTraining, attributionName?]` |
| `7` | `authorName` | `tstr` (optional) | `v1`, `v2` | Max 48 UTF-8 bytes, no ASCII control chars (`<0x20` or `0x7f`) |
| `8` | `artworkTitle` | `tstr` (optional) | `v1`, `v2` | Max 64 UTF-8 bytes, no ASCII control chars (`<0x20` or `0x7f`) |
| `9` | `qrMask` | `array(4)` of `uint` | `v2` only | `[mx, my, mw, mh]`, `mw,mh >= 21`, inside `region` size; forbidden in `v1` |

#### License & Policy Codes (Key `6`)

- `licenseCode`:
  - `0`: `ARR` (All Rights Reserved)
  - `1`: `CC0-1.0`
  - `2`: `CC-BY-4.0`
  - `3`: `CC-BY-SA-4.0`
  - `4`: `CC-BY-NC-4.0`
  - `5`: `CC-BY-NC-SA-4.0`
  - `6`: `CC-BY-ND-4.0`
  - `7`: `CC-BY-NC-ND-4.0`
- `commercial`, `redistribution`, `aiTraining`:
  - `0`: `unspecified`
  - `1`: `allow`
  - `2`: `disallow`
- `attributionName` (optional 5th element): `tstr`, max 48 UTF-8 bytes.

### 4.2 Domain-Separated Signing Input

To prevent cross-protocol signature reuse:

```
signingMessage = 0x43 0x48 0x4D 0x31 0x00 || payloadBytes
                 ("C"  "H"  "M"  "1"  "\0")
signature      = Ed25519_Sign(privateKey, signingMessage)   // 64 bytes
```

### 4.3 Signed Proof Envelope (`proofBytes`)

Encoded as a deterministic RFC 8949 CBOR 3-element array:

```
proofEnvelope = [ version, payloadBytes, signature ]   // version in {1, 2}
```

Maximum encoded size: `2048` bytes (`MAX_PROOF_BYTES`).

### 4.4 Anti-Malleability & Version Validation Rules

A conforming verifier MUST reject proofs if any of the following hold:
- Indefinite-length CBOR items, `undefined`, `NaN`, `Infinity`, floats, BigInts, invalid UTF-8, or duplicate map keys are present.
- `version` is not an integer in `{1, 2}`: MUST explicitly return `Unsupported` protocol version rather than silently downgrading or partially parsing unknown structures.
- Unknown map keys appear in `payloadBytes`:
  - For `version == 1`, any key outside `{1..8}` (including key `9` `qrMask`) MUST be rejected.
  - For `version == 2`, any key outside `{1..9}` MUST be rejected.
- Re-encoding the decoded payload map or outer envelope with RFC 8949 deterministic rules does not match the input bytes byte-for-byte.

---

## 5. QR Code URI Format & Optional Portable Proof Bundle

### 5.1 Embedded QR URI Format

```
https://certified-handmade.com/verify#proof=<base64url(proofBytes)>
```

- Using the URL **fragment** (`#proof=...`) ensures browsers never transmit the proof payload in HTTP requests.
- Protocol v1 QR codes use Error Correction Level `M` (15%) with a mandatory minimum **4-module** `#FFFFFF` quiet zone and integer pixel module scaling.
- Protocol v2 In-Image QR codes support Error Correction Levels `M`, `Q`, or `H` and embed directly inside `qrMask`.
- Offline verifiers (including Standalone Edition on `127.0.0.1:43777`) MUST parse the `#proof=` token locally and MUST NOT perform any automatic outbound navigation or network lookup to `certified-handmade.com`.

### 5.2 Optional Portable Proof Bundle (`.chproof.json`)

For convenient file-based archiving or USB transfer alongside an unmodified artwork file, an optional versioned JSON container wraps the **exact unmodified `proofBase64Url` bytes**:

```json
{
  "format": "certified-handmade-proof-bundle",
  "version": 1,
  "protocolVersion": 1,
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

1. Extract the `#proof=` token (from QR text, URL fragment, raw token, or `.chproof.json`'s `proofBase64Url`) and decode unpadded base64url into `proofBytes`.
2. Decode `proofBytes` as strict CBOR `[version, payloadBytes, signature]`. If `version` is not `1` or `2`, report `Unsupported` and stop. Confirm canonical re-encoding of the outer array.
3. Verify `Ed25519_Verify(publicKey, b"CHM1\x00" + payloadBytes, signature)` -> sets **Cryptographic Signature** (`Valid` / `Invalid`).
4. Decode `payloadBytes` as strict CBOR map (`{1..8}` for v1, `{1..9}` for v2) and confirm canonical re-encoding. Validate `region`, optional `qrMask` (`v2`), and string constraints.
5. **Artwork Integrity** (if an artwork image is supplied):
   - Decode the PNG into straight RGBA8 (`CAR-v1`, enforcing pre-flight `IHDR` size bounds).
   - Extract `region = [x, y, w, h]` (or `[0, 0, w, h]` when image dimensions equal `(w, h)`).
   - If `qrMask` (`key 9`) is present, zero all RGBA bytes inside `[mx, my, mw, mh]` relative to the extracted rectangle before hashing.
   - Compare `SHA-256(rasterBytes)` with key `3` -> sets **Artwork Integrity** (`Matched` / `Mismatched` / `Not Checked`).
6. **Author Identity** (local trust store only):
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
3. **Leaked-Key Limitation:** If a private key was leaked, an attacker holding that seed can sign arbitrary revocation notices or backdated artwork manifests (`CHM1\0`). Verifiers MUST warn users to confirm key status and replacements out-of-band.
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

- **Go CLI (`tools/chm-verify/`):** Standard-library-only Go binary verifying `#proof=`, `.chproof.json`, lossless PNG `CAR-v1` `v1`/`v2` integrity (including `qrMask`), and `.chnotice.json` / `chm-notice:` tokens.
- **Node.js CLI (`tools/chm-verify.mjs`):** Minimal Node.js verifier supporting PNG embedded-QR extraction, `--proof`, `--artwork`, `--notice`, and `--json`.

---

## 13. CHM Secure Device Pairing (`CHM-DEVICE-PAIRING-v1`)

`CHM-DEVICE-PAIRING-v1` enables serverless, offline 2-step QR enrollment of secondary devices (PC, smartphone, tablet) under an existing **CHM Identity** (Ed25519 author public key) without copying the root private key. Core protocol implementation resides in `@yomiplush/chm-exchange/core` (`src/core/pairing/`) and host IndexedDB custody/reconciliation resides in `src/core/storage/devicePairingStore.ts`.

### 13.1 Domain-Separated Envelopes & Canonical CBOR

All envelopes use strict deterministic RFC 8949 CBOR maps (ascending integer keys, canonical re-encode byte-for-byte check, no floats/indefinite/duplicate keys, `MAX_PAIRING_CBOR_BYTES = 2048`, `MAX_PAIRING_TOKEN_CHARS = 3072`, `MAX_PAIRING_QR_URL_CHARS = 4096`):

| Kind | Prefix / Fragment | Domain Prefix | Signer |
| --- | --- | --- | --- |
| `1` Pairing Request | `chm-pair-req:` / `#pair-req=` | `CHM-DEVICE-PAIRING-v1:REQ\0` | New Device Private Key |
| `2` Enrollment Certificate | `chm-pair-cert:` / `#pair-cert=` | `CHM-DEVICE-PAIRING-v1:CERT\0` | Owner Root Private Key |
| `3` Device Revocation Notice | `chm-pair-rev:` / `#pair-rev=` | `CHM-DEVICE-PAIRING-v1:REVOKE\0` | Owner Root Private Key |
| `4` Signed Device Registry | `chm-pair-reg:` / `.chdevreg.{json,cbor}` | `CHM-DEVICE-PAIRING-v1:REGISTRY\0` | Owner Root Private Key |

### 13.2 Key Custody, Cryptographic Binding & Replay Defense

1. **Key Custody:** Each device generates an independent Ed25519 keypair locally (`webcrypto-non-extractable` in IndexedDB where supported, AES-256-GCM encrypted seed fallback otherwise). Root private keys are never transmitted or copied.
2. **Proof of Possession & Request Binding:** Step 1 signs the pairing request (containing 256-bit `nonce`, `requestId`, `deviceId`, `devicePublicKey`, `deviceDisplayName`, `ownerTarget`, `issuedAt`, `expiresAt`, default TTL `300s`, max `3600s`) with the device private key. Step 2 verifies strict Ed25519 (`zip215: false`, small-order/torsion-free curve point check) and signs an Enrollment Certificate containing `requestHash = SHA-256(canonicalRequestEnvelopeBytes)`.
3. **Replay Protection:** Both `req:<requestId>` and `nonce:<nonceHex>` are persisted in IndexedDB (`usedPairingNonces`) upon completion, rejection of replay, or cancellation—preventing QR replay even if the device clock is rolled back.
4. **Trust & Revocation Semantics:** Scanning an Enrollment Certificate never promotes an unknown Owner Identity to `Trusted` automatically (`active-unverified-owner` until explicitly confirmed). Device revocations (`revocationSequence` monotonic) cannot be rolled back by re-importing older `.chdevreg.json` / `.chdevreg.cbor` registry snapshots.

### 13.3 Separation of Future Delegated Signing (Not Implemented in v1)

In `v1`, allowed permissions in pairing requests and enrollment certificates are restricted to `["device-identity"]`. Any non-v1 or elevated permission (such as delegated artwork signing or delegated device approval) MUST be rejected by `v1` validators. Supporting delegated artwork signing in a future `v2+` extension requires explicit scoped capability chains and verifier awareness inside `CHM1\0` and is intentionally omitted from `v1`.

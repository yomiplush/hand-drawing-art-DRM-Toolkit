# Certified Handmade Protocol Specification (`SPEC.md`)

**Protocol Version:** `1`  
**Status:** Implemented MVP Specification  
**Goal:** Enable anyone, anywhere, forever—even without the original website or any central server—to independently verify signed artwork manifests and pixel integrity using standard cryptographic primitives.

---

## 1. Cryptographic Primitives

1. **Hash Function:** SHA-256 (FIPS 180-4)
2. **Digital Signature:** Pure Ed25519 (RFC 8032)
3. **Binary Serialization:** Deterministic CBOR (RFC 8949 Section 4.2)
4. **Transport Encoding:** Unpadded Base64url (RFC 4648 Section 5, without `=` padding)
5. **Encrypted Key Backup (optional client backup format):** PBKDF2-HMAC-SHA256 (`600,000` iterations, 16-byte salt) + AES-256-GCM (12-byte IV, 128-bit tag, AAD-bound public key)

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
   - `artworkSha256 = SHA-256(rgba8Bytes)` where `rgba8Bytes.length === width * height * 4`.
   - Dimension confusion (e.g., `100×200` vs `200×100`) is prevented because `region = [x, y, width, height]` is bound inside the signed manifest.

---

## 3. Solving the QR / Image Hash Circular Dependency

1. Layout calculation determines the output canvas `(outWidth, outHeight)` and the artwork rectangle `region = [artX, artY, artW, artH]` **before** final signing (converging QR module count via at most 3 deterministic passes).
2. `artworkSha256` hashes **only** the `artW × artH` artwork pixels.
3. The Ed25519 signature binds `region = [artX, artY, artW, artH]` and `artworkSha256`.
4. The QR code and optional provenance label are rendered **strictly outside** `[artX, artY, artW, artH]` into the surrounding margin of the lossless output PNG.
5. During verification:
   - If uploaded image dimensions equal `(artW, artH)`, the verifier hashes `[0, 0, artW, artH]`.
   - Otherwise, if `artX + artW <= imgW && artY + artH <= imgH`, the verifier extracts `[artX, artY, artW, artH]` and computes `SHA-256`.

---

## 4. Deterministic CBOR Manifest & Signature Format

### 4.1 Unsigned Manifest Map (`payloadBytes`)

Encoded as a deterministic RFC 8949 CBOR map with integer keys sorted ascending (`1..8`):

| Key | Name | CBOR Type | Constraints |
| --- | --- | --- | --- |
| `1` | `artworkId` | `bstr` (16 bytes) | Random UUIDv4 bytes |
| `2` | `publicKey` | `bstr` (32 bytes) | Raw Ed25519 public key |
| `3` | `sha256` | `bstr` (32 bytes) | Canonical RGBA8 SHA-256 digest |
| `4` | `region` | `array(4)` of `uint` | `[x, y, width, height]`, `w >= 1, h >= 1` |
| `5` | `issuedAt` | `uint` | Self-declared Unix epoch seconds |
| `6` | `license` | `array(4 or 5)` | `[licenseCode, commercial, redistribution, aiTraining, attributionName?]` |
| `7` | `authorName` | `tstr` (optional) | Max 48 UTF-8 bytes, no ASCII control chars |
| `8` | `artworkTitle` | `tstr` (optional) | Max 64 UTF-8 bytes, no ASCII control chars |

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
proofEnvelope = [ 1, payloadBytes, signature ]
```

Maximum encoded size: `2048` bytes (`MAX_PROOF_BYTES`).

### 4.4 Anti-Malleability Validation Rules

A conforming verifier MUST reject proofs if any of the following hold:
- Indefinite-length CBOR items, `undefined`, `NaN`, `Infinity`, floats, or duplicate map keys are present.
- Unknown map keys outside `{1..8}` appear in `payloadBytes`.
- Re-encoding the decoded payload map or outer envelope with RFC 8949 deterministic rules does not match the input bytes byte-for-byte.
- `version !== 1` (MUST report `Unsupported` protocol version rather than attempting partial parsing).

---

## 5. QR Code URI Format

```
https://certified-handmade.com/verify#proof=<base64url(proofBytes)>
```

- Using the URL **fragment** (`#proof=...`) ensures browsers never transmit the proof payload in HTTP requests.
- QR codes use Error Correction Level `M` (15%) with a mandatory minimum **4-module** `#FFFFFF` quiet zone and integer pixel module scaling.

---

## 6. Author Public Key Fingerprint

```
fingerprint = SHA-256(publicKey32)   // 32 bytes / 64 lowercase hex chars
shortDisplay = "CHM-" + uppercase(hex(fingerprint[0..8])).groupedBy4("-")
```

---

## 7. Independent Third-Party Verification Algorithm

Any standalone script (Python, Rust, Go, Node.js) can verify a signed PNG or `#proof=...` URL without running Certified Handmade's web app:

1. Extract the `#proof=` token and decode unpadded base64url into `proofBytes`.
2. Decode `proofBytes` as strict CBOR `[version, payloadBytes, signature]`, confirm `version == 1` and canonical re-encoding.
3. Verify `Ed25519_Verify(publicKey, b"CHM1\x00" + payloadBytes, signature)`.
4. Decode `payloadBytes` as strict CBOR map `{1..8}` and confirm canonical re-encoding.
5. (If verifying an image) Decode the PNG into straight RGBA8, extract `[x, y, w, h]` (or `[0, 0, w, h]` if dimensions equal `(w, h)`), and compare `SHA-256(croppedRgba8)` against key `3`.

---

## 8. Normative Test Vector (v1)

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

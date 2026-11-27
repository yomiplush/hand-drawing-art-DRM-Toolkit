# Protocol v3 — Self-Contained Compact Proof Specification (`CHM-COMPACT-PROOF-V3.md`)

**Protocol Version:** `3` (`PROTOCOL_VERSION_COMPACT = 3`)  
**Domain Separation Prefix:** `CHM3\0` (`0x43 0x48 0x4D 0x33 0x00`)  
**Status:** Implemented across Web/PWA (`src/core/manifest/*`), Node.js CLI (`tools/chm-verify.mjs`), and Go CLI (`tools/chm-verify/`)

---

## 1. Motivation & Design Constraints

Protocol `v1` (outer QR frame) and `v2` (in-image masked QR overlay) purposefully stored minimal fields in the QR code and pushed creator links, artwork descriptions, creation environment notes, and evidence hashes out to a companion `.chmevidence` file. While compact, sharing just a signed PNG on social platforms meant verifiers without the companion `.chmevidence` file could not see creator links, creation tool declarations, or compare local WIP/PSD SHA-256 hashes.

**Protocol `v3` (`CHM3\0`)** solves this cleanly **without central servers** and **without bloated un-scannable QR codes** by combining:
1. Canonical RFC 8949 integer-keyed CBOR (`keys 1..17`)
2. 12-bit bit-packed license & extended policy flags
3. Canonical longest-prefix URL dictionary (`1..15`) + enumerated SNS platforms/creation methods/evidence categories
4. Optional **raw DEFLATE compression** (`deflate-raw`) checked for strict size reduction (`compressed.length < uncompressed.length`)

---

## 2. Wire Format & CBOR Schema

### 2.1 Outer Envelope (`proofBytes`, `<= 2048` B)

Deterministic 4-element RFC 8949 CBOR array:

```text
proofEnvelope = [ 3, compressionFlag, payloadOrDeflatedBytes, signature64 ]
```

- `compressionFlag = 0`: `payloadOrDeflatedBytes` is raw canonical `payloadBytes`.
- `compressionFlag = 1`: `payloadOrDeflatedBytes` is raw DEFLATE (`RFC 1951`) of `payloadBytes`, permitted **only** when `deflated.length < payloadBytes.length` and `payloadBytes.length <= 8192` (`MAX_V3_DECOMPRESSED_BYTES`).
- **`signature64`** is computed over `0x43 0x48 0x4D 0x33 0x00 || payloadBytes` (**always uncompressed canonical `payloadBytes`**).

### 2.2 Payload Map (`keys 1..17`, Sorted Ascending)

- **Shared Keys (`1..9`):** UUIDv4 `artworkId(16)`, Ed25519 `publicKey(32)`, canonical RGBA8 `sha256(32)`, `region[4]`, `issuedAt`, `license` (`[licenseCode, packedFlags12Bit, attributionName?]`), `authorName` (`<=64` B), `artworkTitle` (`<=128` B), optional `qrMask[4]` (masked mode).
- **Extended Self-Contained Keys (`10..17`):**
  - `10` `description`: multiline sanitized UTF-8 (`<=600` B)
  - `11` `website`: `[urlPrefixCode, urlSuffix]`
  - `12` `snsLinks`: up to `12` tuples (`[urlCode, urlSuffix, platformCode?, label?]`)
  - `13` `portfolioLinks`: up to `8` tuples (`[urlCode, urlSuffix, label?]`)
  - `14` `creationMethod`: integer `1..5`
  - `15` `creationEnvironment`: sub-map `1=software(<=96B)`, `2=hardware(<=96B)`, `3=inputDevice(<=96B)`, `4=notes(<=240B)`
  - `16` `evidenceHashes`: up to `8` tuples (`[sha256(32), byteLength, categoryCode?, label(<=96B)?, mimeType(<=64B)?]`)
  - `17` `policyNote`: multiline sanitized UTF-8 (`<=240` B)

### 2.3 Canonical URL Prefix Dictionary (`V3_URL_PREFIX_DICT`)

Encoders MUST pick the **longest** matching prefix (`bestCompactUrlCode`), and conforming verifiers MUST reject any non-longest match or non-`http:`/`https:` scheme (`decodeCompactUrl`):

| Code | Canonical Prefix |
| --- | --- |
| `1` | `https://` |
| `2` | `http://` |
| `3` | `https://x.com/` |
| `4` | `https://bsky.app/profile/` |
| `5` | `https://www.pixiv.net/users/` |
| `6` | `https://skeb.jp/@` |
| `7` | `https://vgen.co/` |
| `8` | `https://mastodon.social/@` |
| `9` | `https://misskey.io/@` |
| `10` | `https://njump.me/` |
| `11` | `https://www.furaffinity.net/user/` |
| `12` | `https://www.deviantart.com/` |
| `13` | `https://www.instagram.com/` |
| `14` | `https://www.youtube.com/@` |
| `15` | `https://github.com/` |

### 2.4 Security & Anti-Malleability Guards

1. **Bounded Inflation (`inflateRawBounded`):** Rejects compressed streams expanding beyond `MAX_V3_DECOMPRESSED_BYTES = 8192` bytes and rejects envelopes where DEFLATE failed to strictly shrink the payload (`compressionFlag == 1` requires `deflated.length < payloadBytes.length`).
2. **Strict CBOR Re-Encode Check:** Both the decompressed `payloadBytes` map and outer 4-element array must re-encode byte-for-byte under RFC 8949 deterministic rules (no indefinite lengths, floats, BigInts, duplicate keys, or invalid UTF-8).
3. **String & Bidi Sanitization:** Control characters (`<0x20` except `\n`/`\t` on multiline fields), C1 controls (`U+007F..U+009F`), and Unicode Bidi overrides (`U+202A..U+202E`, `U+2066..U+2069`) are rejected at encode and decode time.
4. **Zero Auto-Fetch:** Verifiers render decoded URLs as inspectable text/links only and never fetch external profiles automatically.

---

## 3. Measured Benchmarks (`tests/unit/protocolV3.test.ts`)

Measured directly from the live canonical encoder/QR matrix generator on a richly populated creator dossier (UUID, Ed25519 key, pixel SHA-256, author, title, description, website, 4 SNS links via URL dictionary, portfolio link, `hand-drawn-no-ai` creation method + software/hardware/inputDevice, `sketch.kra` evidence SHA-256 record, custom `policyNote`, and 12-bit extended license flags) at Error Correction Level `M` (`15%`):

| Encoding Variant | Payload Bytes | Signed Envelope Bytes | Payload / Token Representation | QR Symbol (ECC `M`) | Modules |
| --- | --- | --- | --- | --- | --- |
| **Protocol `v3` Uncompressed (`flag = 0`, Base64url URI)** | `558 B` | `630 B` | Standard `#proof=` URI (`882` chars) | **Version 24** | `113 × 113` |
| **Protocol `v3` Raw DEFLATE (`flag = 1`, Base64url URI)** | `451 B` (**-19.2% / -107 B**) | `523 B` | Standard `#proof=` URI (**`742` chars**) | **Version 22** | **`105 × 105`** |
| *Mixed-Segment Comparison: Base45 Token (`B45`)* | `451 B` | `523 B` | 42-char URI prefix + `785`-char alphanumeric Base45 token | Version 19 | `93 × 93` |

Certified Handmade ships the standard `#proof=<base64url>` URI (`Version 22`, `105 × 105` modules in the benchmark above) so every smartphone camera and offline scanner opens `https://www.certified-handmade.com/verify#proof=...` directly with zero special parser apps required.

---

## 4. Compatibility with `.chmevidence` & Offline CLIs

- **Backward Compatible:** `v1` and `v2` verifiers reject `v3` explicitly as `Unsupported` rather than silently misparsing, while `v3`-aware verifiers (Web UI `/verify`, `tools/chm-verify.mjs`, `tools/chm-verify` Go CLI) verify `v1`, `v2`, and `v3` seamlessly.
- **Mode A & Mode C Without `.chmevidence`:** When a `v3` proof includes key `16` (`evidenceHashes`), Mode C verification compares supplied local PSD/KRA/WIP files directly against the signed hashes embedded inside the PNG QR code alone—or merges cleanly with `.chmevidence` when more than `8` files or full `<=4000` B descriptions are needed.

# Data Portability & Open Formats (`DATA-PORTABILITY.md`)

Certified Handmade rejects proprietary lock-in: every key, artwork signature, extended evidence package, device registry, and proof archive uses documented open standards (RFC 8032 Ed25519, RFC 8949 Deterministic CBOR, SHA-256, AES-256-GCM, PBKDF2-SHA256, Nostr NIP-01/44/49/59/65/78).

---

## 1. Export & Interchange Artifacts

| Artifact Extension / Prefix | Contents | Contains Private Keys? | Verification Requirement on Import |
| --- | --- | --- | --- |
| Signed `.png` (`v1` / `v2`) | Lossless RGBA8 artwork + embedded QR `#proof=<base64url>` | No | `CAR-v1` RGBA8 + `CHM1\\0` Ed25519 |
| `.chproof.json` | Portable JSON wrapper around unmodified `proofBase64Url` | No | `CHM1\\0` Ed25519 signature |
| `.chmevidence` | Signed metadata, profile links, creation method & WIP SHA-256 hashes | No | `CHM-EVIDENCE1\\0` Ed25519 + 4-field proof binding |
| `.chkey.json` | PBKDF2-SHA256 (`600k`) + AES-256-GCM encrypted Author private key | **Yes (encrypted)** | AAD-bound public key + GCM authentication tag |
| `.chnotice.json` / `chm-notice:` | Offline key revocation or dual-signed rotation notice | No | `CHM-NOTICE1\\0` Ed25519 |
| `.chdevreg.{json,cbor}` | Signed paired-device & revocation registry snapshot | No | `CHM-DEVICE-PAIRING-v1:REGISTRY\\0` monotonic check |
| `.chmvault.json` (`CHM-VAULT-v1`) | Compact Proof Vault export (`containsPrivateKeys: false`) | **Never** | Re-verifies every `proofBase64Url` via `CHM1\\0` Ed25519 on import |
| `.chmvault.enc.json` | Passphrase-encrypted Proof Vault export (PBKDF2-SHA256 `600k` + AES-256-GCM) | **Never** | GCM authentication + `CHM1\\0` Ed25519 per proof |
| NIP-49 `ncryptsec1...` / NIP-65 `kind 10002` / NIP-78 `kind 30078` | Standard Nostr key backup, relay list & public proof index event | Encrypted (`ncryptsec1`) or None (`10002`/`30078`) | Standard BIP-340 Schnorr + `CHM1\\0` Ed25519 |

---

## 2. Independent Verification & Long-Term Preservation

Even if `certified-handmade.com` ever goes dark in 50 years:
1. Anyone can verify signed artworks and `.chmevidence` extensions completely offline using:
   - `tools/chm-verify` (zero-dependency Go standard library CLI)
   - `tools/chm-verify.mjs` (minimal Node.js CLI)
   - Portable Standalone Edition binaries (`http://127.0.0.1:43777`)
   - Any independent verifier implementing [`SPEC.md`](../SPEC.md).
2. Every `.chmvault.json` bundle stores raw verifiable `proofBase64Url` tokens, never stripped UI summaries—so your exported archive remains cryptographically self-verifying forever.

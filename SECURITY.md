# Security Model & Threat Analysis (`SECURITY.md`)

## 1. Security Architecture Summary

Certified Handmade is a **Cryptographic Artwork Provenance**, **Encrypted Proof Vault**, and **Auth-Only Device Sync** system (not copy-protection DRM). It operates under a **zero-server-trust, local-first** architecture across the Web/PWA Edition, the Portable Standalone Edition, and the independent offline CLIs (`tools/chm-verify` and `tools/chm-verify.mjs`):
- Private keys (`Ed25519` CHM keys, `VMK` Vault master keys, and per-device `secp256k1` Nostr transport keys) and artwork pixels are processed exclusively inside local memory / Web Crypto API and are never transmitted to any maintainer server, Nostr relay, or local Go HTTP server.
- Google OAuth 2.0 (GIS Token Model, `https://www.googleapis.com/auth/drive.appdata` scope) authorizes storage access to the **user's own** Google Drive only; OAuth access tokens remain strictly in RAM and Google sign-in alone **never** grants CHM authorship identity or Vault decryption capability.
- Proof and pairing data is embedded inside URL fragments (`#proof=...`, `#pair-req=...`, `#pair-cert=...`), which browsers do not send in HTTP `GET` requests.
- Strict Content Security Policy (`public/_headers`, `index.html`, and `standalone/server.go`) blocks `unsafe-eval`, inline scripts, and unauthorized origins (`script-src 'self' https://accounts.google.com/gsi/client; frame-src https://accounts.google.com/gsi/; connect-src 'self' wss: https:` on Web/PWA with lazy GIS loading only upon explicit connect click; Standalone omits GIS origins and intentionally disables Google OAuth on `127.0.0.1:43777`). Both editions produce **zero** outbound network traffic at rest.

---

## 2. Threat Model & Mitigations

| Threat | Mitigation |
| --- | --- |
| **Manifest or license tampering in QR (`v1`, `v2`, `v3`)** | Ed25519 signature covers deterministic RFC 8949 CBOR payload with domain prefix `CHM1\0` (`v1`/`v2`) or `CHM3\0` (`v3` over uncompressed payload). Canonical re-encoding checks block CBOR malleability. Small-order / all-zero public keys and malformed signatures are rejected. |
| **DEFLATE decompression bombs / non-canonical compression in `v3`** | `inflateRawBounded` enforces a hard `MAX_V3_DECOMPRESSED_BYTES = 8192` ceiling and `MAX_PROOF_BYTES = 2048` proof ceiling. Conforming decoders verify `compressionFlag in {0, 1}`, require strict shrinkage (`deflated.length < payloadBytes.length`), and re-verify canonical CBOR & Ed25519 signatures over `CHM3\0 || payloadBytes`. |
| **Non-canonical URL dictionary / URL spoofing in `v3`** | Verifiers reject any `v3` URL not matching the exact longest prefix in `V3_URL_PREFIX_DICT` (`1..15`), reject non-`http:`/`https:` schemes, embedded `user:pass@` credentials, whitespace, C0/C1 controls, and Unicode bidi overrides. |
| **Cross-domain signature replay** | Proof manifests (`CHM1\0`, `CHM3\0`), key notices (`CHM-NOTICE1\0`), challenges (`CHM-CHALLENGE1\0`), metadata/evidence extensions (`CHM-EVIDENCE1\0`), device pairing (`CHM-DEVICE-PAIRING-v1:{REQ,CERT,REVOKE,REGISTRY}\0`), pairing confirmation codes (`CHM-PAIR-CONFIRM1\0`), and Nostr auth sync (`CHM-SYNC-v1:{BIND,NOSTR-POP,OP}\0`) use distinct null-terminated ASCII domain separation prefixes. |
| **Cross-artwork replay or substitution of `.chmevidence`** | `.chmevidence` binds simultaneously to `publicKey`, `artworkId`, `artworkSha256`, AND `proofSha256 = SHA-256(proofBytes)`. Reusing a valid signed extension on a different proof—even from the same artist over the same artwork—fails with `binding-mismatch`. |
| **Standalone `.chmevidence` presented as artwork proof** | Both browser and CLI verifiers explicitly reject `.chmevidence` unless accompanied by a valid primary `CHM1\0` or `CHM3\0` proof; no artwork verification status is emitted from an extension alone. |
| **Public key substitution & auto-trusting scanned keys** | Public key is inside the signed payload; replacing it invalidates the signature unless re-signed by another key (which changes the SHA-256 fingerprint). Keys received via QR scans or `@yomiplush/chm-exchange` remain `unconfirmed` (`Unknown / Unverified Key`) until explicit out-of-band fingerprint confirmation. |
| **Artwork pixel tampering & `v2`/`v3` `qrMask` abuse** | Signed `sha256` covers un-premultiplied RGBA8 pixels of `[x, y, w, h]` (with `[mx, my, mw, mh]` zeroed out when `qrMask` is present) via lossless `fast-png`. `qrMask` (`mw, mh >= 21`, inside `region`) is signed inside CBOR key `9`; verifiers warn prominently (`>15%` caution, `>30%` high coverage) and report `qrMask` bounds transparently. |
| **Decompression bombs / OOM images, oversized PSDs & huge evidence files** | Pre-flight `IHDR` parser checks PNG dimensions (`<= 8192 px` input / `<= 10240 px` output, `<= 32 MP`) and file size (`<= 50 MB`) before `IDAT` decompression. Pre-flight PSD/PSB header checks enforce file size (`<= 512 MiB`), canvas dimensions (`<= 16384 px`, `<= 64 MP`), and layer count (`<= 2048`) before full buffer allocation, and verify at least 2 active non-transparent pixel layers to block single-layer / empty-layer spoofing. Evidence hashing streams files in 2 MiB chunks up to a hard `512 MiB` ceiling. |
| **XSS / injection / bidi spoofing via QR, metadata, URLs & Drive/sync payloads** | Strict base64url validation (no `=`, exact roundtrip), URL rejection for non-`http:`/`https:` schemes and credentials, control/C1 & bidi override (`U+202A..U+202E`, `U+2066..U+2069`) rejection, prototype-pollution key filtering (`__proto__`, `constructor`, `prototype`), and strict React text rendering without `eval` or `dangerouslySetInnerHTML`. |
| **Google OAuth token theft via storage/XSS/logs or CSRF/popup hijack** | Uses GIS OAuth 2.0 Token Model exclusively with narrow `https://www.googleapis.com/auth/drive.appdata` scope (hidden `appDataFolder` scope only — never normal My Drive or full Drive access, zero Client Secret in frontend, zero Service Accounts/Workers auth). Access token is stored strictly in RAM (`InMemoryGoogleAuthManager`)—never `localStorage`, `sessionStorage`, IndexedDB, URLs, or logs—cleared on disconnect/revoke/reload. GIS script loads lazily only on user click. `COOP: same-origin-allow-popups` enables GIS popup flow safely. |
| **Google account spoofing or cross-account Drive cache confusion** | `fetchDriveAccountProfile` calls `drive.about.get` (`user(displayName,emailAddress,permissionId)`) on connect to bind session state to `hashGoogleAccountKey(accountKey)` (`SHA-256("chm-google-acct:" + accountKey)`). Switching accounts clears prior access tokens, zeroizes in-memory unlocked `VMK`s, and isolates `PersistedDriveAccountState` file IDs, queues, and conflict records. |
| **Compromised Google account / malicious Drive file tampering** | Connecting Google **cannot decrypt** Vault artifacts (`chm-vault-keyring-v1` requires the user-chosen Vault passphrase via `PBKDF2-SHA256 600,000` or `chm-vault-keyshare-v1`). Independent 256-bit `VMK`s expand via `HKDF-SHA256` into 6 purpose-isolated keys (`manifest`, `proofs`, `profiles`, `policies`, `settings`, `snapshots`) with AAD-bound `AES-256-GCM` tags (`chm-vault-aead-v1`). Connecting/authorizing Google never certifies CHM authorship. |
| **Plaintext pixels or private keys accidentally synced to Google Drive** | `sanitizeProofForSync` and `assertNoForbiddenSyncSecrets` recursively block binary buffers (`Uint8Array`/`ArrayBuffer`) and prohibited keys (`raster`, `rgba`, `pixels`, `pngBytes`, `imageData`, `projectFileBytes`, `webCryptoPrivateKey`, `encryptedBackup`, `seed32`, `privateKey`, `secretKey`, `nsec`, `nip49`, `encryptedSecret`, `accessToken`, `access_token`) before encryption. Remote manifests undergo `lastManifestSeq`/`lastManifestHash` rollback detection and Ed25519 re-verification of all proofs. |
| **Concurrent multi-device edits or Drive folder loss** | Signed proofs are immutable content-addressed chunks (`id = SHA-256(proofBytes)`); mutable profiles/policies/settings use three-way conflict detection (`keep-local`, `accept-remote`, `keep-both`) instead of blind last-write-wins overwrites, plus monotonic soft tombstones. Deleted/moved Drive folders recover automatically via `appProperties` (`chmApp`, `chmRole`, `chmVaultId`). |
| **Nostr metadata leakage or Vault exposure over public relays** | Nostr (`CHM-SYNC-v1`) is strictly isolated to device auth/registration/revocation/checkpoints (`NOSTR_PUBLIC_PROOF_PUBLISHING_DISABLED = true`). Artwork details, proof vaults, profiles, SNS links, policy presets, and settings are **never** published to Nostr relays. Deprecated NIP-04 is forbidden; allowed auth messages use NIP-44 v2 + NIP-59 (`kind 1059`). |
| **Pairing QR tampering, MitM substitution, replay & privilege escalation** | `CHM-DEVICE-PAIRING-v1` enforces canonical CBOR, small-order Ed25519 rejection (`zip215: false`), `requestHash` binding, 8-char confirmation code (`CHM-PAIR-CONFIRM1\0`), persistent `requestId` + `nonce` replay tracking, explicit user approval dialogs, and strict `['device-identity']` permissions. |
| **Relay hijacking, NIP-42 cross-relay auth replay & paid relay lock-in** | Relays require `wss://`; NIP-42 binds to relay URL + challenge; NIP-11 pre-flight and runtime `payment-required` handling auto-pause paid relays; Priority `0` revocations bypass the 1 MiB / 30-day rolling sync budget. |
| **Plaintext private key leakage** | Plaintext private keys are never stored in `localStorage` or `IndexedDB` and are never exported by `CHM-VAULT-v1` backups (`containsPrivateKeys: false`) or Drive sync. Vault passphrase checks reject accidental reuse of `nsec1...` or `chm-key-backup...` markers. |
| **Standalone DNS rebinding / LAN exposure** | `standalone/server.go` binds strictly to `127.0.0.1:43777`, rejects non-loopback `Host` headers (`403`), enforces `GET`/`HEAD` (`405`), blocks traversal (`400`), and never silently falls back to an ephemeral port on port conflict. |

---

## 3. Critical Trust Boundaries & Limitations

1. **Identity Is Not Provided by Google Sign-In or a Central CA:**
   - Connecting a Google account authorizes storage in Google Drive (`drive.appdata`) **only**—it never acts as an Ed25519 authorship key or trusted identity claim.
   - A `Valid` cryptographic signature or passing an offline `CHM-CHALLENGE1` check proves only possession of the Ed25519 private key matching `publicKey`. Unconfirmed public keys display `Unknown / Unverified Key` until verified out-of-band.
2. **Device Revocation & Key Epoch Rotation Do Not Perform Remote Wipe:**
   - Revoking a device via `CHM-DEVICE-PAIRING-v1`, `CHM-SYNC-v1`, or rotating the Drive Vault epoch (`rotationReason: 'device-revoked'`) stops future trust and encrypts **future** Drive writes under a new `VMK` epoch.
   - **It cannot remotely erase** encrypted blobs, decrypted cached proofs, or key material already retrieved by a device prior to revocation.
3. **Offline & Decentralized Revocation Limitations (`CHM-NOTICE1`, `CHM-SYNC-v1`):**
   - Without a central CRL/OCSP server, absence of a local notice is reported strictly as *no local notice found on this device* — NEVER `"Not Revoked"`. Free Nostr relays carry no uptime SLA or retention guarantee.
4. **Cryptography Does Not Prove Hand-Drawing or Legal Copyright:**
   - Author/title/description/URL fields and timestamps (`issuedAt`, `noticeIssuedAt`, `.chmevidence.createdAt`) are self-declared without an external TSA or external social API verification. Verifiers label creation methods as `declared by creator` and never emit a "Human-Made Confidence" score.
5. **Non-Cryptographic Visual Similarity Helper:**
   - `dHash64` / `DCT pHash64` in `/verify` is an auxiliary local heuristic (`isCryptographic: false`) and never replaces `CAR-v1` `SHA-256`.
6. **XSS, Endpoint Security & Honest Audit Scope:**
   - Non-extractable `CryptoKey` handles, RAM-only OAuth tokens, and CSP (`public/_headers`) mitigate persistence/injection risks, but compromised browsers/OS/extensions still threaten active sessions.
   - Official Nostr compliance was reviewed against [`nostr-protocol/nips@bec0fc8`](https://github.com/nostr-protocol/nips/commit/bec0fc8), and comprehensive unit, integration (`MockNostrRelay` + mocked Google Drive), Go CLI, and Playwright E2E suites run continuously. **No independent third-party cryptographic audit has been conducted** (zero paid services architecture).
7. **Browser Storage Eviction & Cross-Origin Separation:**
   - `IndexedDB` (`certified-handmade-store` v7) can be cleared by browser eviction, and Web (`certified-handmade.com`) vs Standalone (`127.0.0.1:43777`) have distinct origins. Always maintain encrypted `.chkey.json` and `.chmvault.json` (or Personal Google Drive) backups.
8. **Non-Binding Policy Signals:**
   - Machine-readable declarations (`aiTraining: disallow`, `policyNote`, etc.) express creator intent only and do not technically block scraping or override statutory/Creative Commons law.

---

## 4. Reporting Vulnerabilities

Please open a private security advisory on GitHub:
https://github.com/yomiplush/hand-drawing-art-DRM-Toolkit/security

See companion documentation: [`docs/THREAT-MODEL.md`](./docs/THREAT-MODEL.md), [`docs/KEY-MANAGEMENT.md`](./docs/KEY-MANAGEMENT.md), [`docs/GOOGLE-DRIVE-SETUP.md`](./docs/GOOGLE-DRIVE-SETUP.md), and [`docs/STORAGE-PROVIDERS.md`](./docs/STORAGE-PROVIDERS.md).

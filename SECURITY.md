# Security Model & Threat Analysis (`SECURITY.md`)

## 1. Security Architecture Summary

Certified Handmade is a **Cryptographic Artwork Provenance**, **Local Proof Vault**, and **Opt-In Decentralized Sync** system (not copy-protection DRM). It operates under a **zero-server-trust, local-first** architecture across the Web/PWA Edition, the Portable Standalone Edition, and the independent offline CLIs (`tools/chm-verify` and `tools/chm-verify.mjs`):
- Private keys (`Ed25519` CHM keys and `secp256k1` Nostr transport keys) and artwork pixels are processed exclusively inside local memory / Web Crypto API and are never transmitted to any backend, relay, or local Go HTTP server.
- Proof and pairing data is embedded inside URL fragments (`#proof=...`, `#pair-req=...`, `#pair-cert=...`), which browsers do not send in HTTP `GET` requests.
- Strict Content Security Policy (`public/_headers`, `index.html`, and `standalone/server.go`) blocks inline scripts, external scripts, and unauthorized origins (`connect-src 'self' wss: https:` across Web/PWA and Standalone strictly for optional user-consented Nostr relay transport and NIP-11 relay metadata checks, with **zero** relay traffic at rest).

---

## 2. Threat Model & Mitigations

| Threat | Mitigation |
| --- | --- |
| **Manifest or license tampering in QR** | Ed25519 signature covers deterministic RFC 8949 CBOR payload with domain prefix `CHM1\0`. Canonical re-encoding checks block CBOR malleability. Small-order / all-zero public keys and malformed signatures are rejected. |
| **Cross-domain signature replay** | Proof manifests (`CHM1\0`), key revocation/rotation notices (`CHM-NOTICE1\0`), key-possession challenges (`CHM-CHALLENGE1\0`), metadata/evidence extensions (`CHM-EVIDENCE1\0`), device pairing (`CHM-DEVICE-PAIRING-v1:{REQ,CERT,REVOKE,REGISTRY}\0`), pairing confirmation codes (`CHM-PAIR-CONFIRM1\0`), and Nostr sync (`CHM-SYNC-v1:{BIND,NOSTR-POP,OP}\0`) use distinct null-terminated ASCII domain separation prefixes. |
| **Cross-artwork replay or substitution of `.chmevidence`** | `.chmevidence` binds simultaneously to `publicKey`, `artworkId`, `artworkSha256`, AND `proofSha256 = SHA-256(proofBytes)`. Reusing a valid signed extension on a different proof—even from the same artist over the same artwork—fails with `binding-mismatch`. |
| **Standalone `.chmevidence` presented as artwork proof** | Both browser and CLI verifiers explicitly reject `.chmevidence` unless accompanied by a valid primary `CHM1\0` proof; no artwork verification status is emitted from an extension alone. |
| **Public key substitution** | Public key is inside the signed payload; replacing it invalidates the signature unless re-signed by another key (which changes the SHA-256 fingerprint and triggers `Unknown / Unverified Key` unless confirmed out-of-band). |
| **Auto-trusting scanned / exchanged keys** | Keys received via verification links, QR scans, or `@yomiplush/chm-exchange` are **never automatically promoted to Trusted**. Users can either save a key in an explicitly `unconfirmed` state (still treated as `Unverified` during verification) or confirm the full 64-character SHA-256 fingerprint out-of-band first. |
| **Artwork pixel tampering** | Signed `sha256` covers un-premultiplied RGBA8 pixels of `[x, y, w, h]` (with `[mx, my, mw, mh]` zeroed out in Protocol v2). Decoded losslessly via `fast-png`, bypassing Canvas premultiplication loss. |
| **Protocol v2 `qrMask` abuse / over-exclusion** | `qrMask` bounds (`mw, mh >= 21`, contained inside `region`) are signed inside CBOR key `9`. Verifiers prominently display excluded bounds and masked area coverage (`<=15%` low, `>15%` caution, `>30%` high warning), and Studio includes an excluded-mask highlight overlay and `Optimize QR Size` helper. |
| **Artwork swap against valid QR** | Verifier explicitly separates **Signature Valid** from **Artwork Integrity (`Not Checked` / `Matched` / `Mismatched`)**. |
| **Decompression bombs / OOM images & huge evidence files** | Pre-flight `IHDR` parser checks PNG dimensions (`<= 8192 px` input / `<= 10240 px` output, `<= 32 MP`) and file size (`<= 50 MB`) before `IDAT` decompression. Evidence hashing streams files in 2 MiB chunks up to a hard `512 MiB` ceiling. |
| **XSS / injection / bidi spoofing via QR, metadata, URLs & sync payloads** | Strict base64url validation (no `=`, exact roundtrip), URL rejection for non-`http:`/`https:` schemes (`javascript:`, `data:`, `file:`) and `wss:` relay enforcement, embedded credentials (`user:pass@`), protocol-relative (`//`) paths, whitespace, control/C1 chars, Unicode bidi overrides (`U+202A..U+202E`, `U+2066..U+2069`), prototype-pollution key filtering (`__proto__`, `constructor`, `prototype`), and malformed JSON. React renders all user/manifest strings strictly as text without `eval`, `dangerouslySetInnerHTML`, or auto-navigation. |
| **Pairing QR tampering, MitM substitution, replay & privilege escalation** | `CHM-DEVICE-PAIRING-v1` uses strict RFC 8949 canonical CBOR, small-order/non-torsion-free Ed25519 curve checks (`zip215: false`), domain prefixes, `requestHash` cryptographic binding, an 8-char out-of-band confirmation code (`CHM-PAIR-CONFIRM1\0`), persistent `requestId` + 256-bit `nonce` replay tracking independent of clock, explicit user approval dialogs, and strict `['device-identity']` permission allowlisting. |
| **Stale registry rollback & auto-trust** | Unknown owners imported via enrollment QR remain `active-unverified-owner` until explicit out-of-band confirmation. Local device revocations (`deviceRevocations`) are monotonic and never rolled back when importing older signed `.chdevreg.json`/`.chdevreg.cbor` snapshots. |
| **Ed25519 / secp256k1 key reuse or Nostr relay impersonation (`CHM-SYNC-v1`)** | CHM Ed25519 keys and Nostr secp256k1 transport keys are strictly isolated (`assertNostrSecretKeyDistinctFromEd25519`, cross-key byte equality rejected). Relays have **zero** CHM authority; every Nostr peer binding (`chm-sync-bind:`) requires dual Ed25519 + BIP-340 Schnorr proof-of-possession (`CHM-SYNC-v1:BIND\0` + `CHM-SYNC-v1:NOSTR-POP\0`), and every sync op (`CHM-SYNC-v1:OP\0`) is signed by the Owner root key, verified deterministically via hash-chained `prevOpHash` + monotonic sequence tracking. |
| **Sync metadata leakage & NIP-04 weaknesses** | Deprecated NIP-04 is **forbidden**. All `CHM-SYNC-v1` messages use **NIP-44 v2** (`ChaCha20 + HMAC-SHA256`) wrapped inside **NIP-59 Gift Wrap (`kind 1059`)** with ephemeral single-use wrapping keys so relays cannot correlate sender `npub`, operation kind, or CHM author fingerprint. `CHM-VAULT-v1` and sync rumors never transmit artwork pixels, WIPs, or private keys. |
| **Relay hijacking, NIP-42 cross-relay auth replay & paid relay lock-in** | Relays must use `wss://` (with local loopback test override disabled in production). NIP-42 `kind 22242` auth signatures bind strictly to the active relay URL + challenge. NIP-11 HTTP/JSON pre-flight (`Accept: application/nostr+json`) rejects relays advertising `payment_required: true`, `payments_url`, or fees, and runtime `OK false "payment-required:"` / `CLOSED` responses automatically pause and flag the relay (`policyStatus = 'payment-required'`). |
| **Soft sync budget starvation of revocations** | `revoke-device` (Priority `0`) and identity ops (Priority `1`) always bypass the 1 MiB / 30-day rolling soft sync budget (`DEFAULT_ONLINE_SYNC_BUDGET_BYTES = 1_048_576`), ensuring security revocations still dispatch to active peers even after vault metadata sync defers gracefully. |
| **Malicious / forged `CHM-PUBLIC-PROOF-v1` events (NIP-78 `kind 30078`)** | Public proof events fetched from relays are untrusted inputs: `parseAndVerifyPublicProofEvent` validates NIP-01 `id`/Schnorr signature, schema bounds, AND full local `CHM1\0` / `v2` Ed25519 verification before entering query results or Vault storage. Author trust still requires local Confirmed Trusted Key verification. |
| **Plaintext private key leakage** | Plaintext private keys are never stored in `localStorage` or `IndexedDB` and are never exposed by the Standalone HTTP server or JSON Vault backups (`containsPrivateKeys: false`). Active CHM keys and Nostr secret keys use non-extractable Web Crypto `CryptoKey` / AES-256-GCM wrapping handles where supported; `.chkey.json` & encrypted Vault backups use PBKDF2-SHA256 (`600,000` iterations) + AES-256-GCM; Nostr exports use NIP-49 `ncryptsec1` (scrypt + XChaCha20-Poly1305). |
| **Unsupported protocol downgrade** | Outer envelope version `notin {1, 2}` (or `.chmevidence` version `!= 1`, or unknown `CHM-SYNC-v1` envelope version/op kind) explicitly returns `Unsupported` / rejects rather than silently coercing unknown fields; v1 explicitly forbids key `9` (`qrMask`). |
| **Standalone DNS rebinding / LAN exposure** | `standalone/server.go` binds strictly to `127.0.0.1` (`43777`), rejects non-loopback `Host` headers with `403 Forbidden`, enforces read-only `GET`/`HEAD` (`405`), blocks path traversal (`400`), and mirrors `public/_headers` security policies (`connect-src 'self' wss: https:`). |
| **Silent storage origin drift on port conflict** | On `127.0.0.1:43777` bind failure, the launcher checks `/__chm_health`; it either hands off to a verified Certified Handmade instance or exits with an explicit error—never silently picking an ephemeral port that would hide existing IndexedDB keys. |

---

## 3. Critical Trust Boundaries & Limitations

1. **Identity Is Not Provided by a Central CA:**
   - A `Valid` cryptographic signature or passing an offline `CHM-CHALLENGE1` check proves only possession of the Ed25519 private key matching `publicKey`.
   - Unless a verifier has independently confirmed the artist's full SHA-256 public key fingerprint out-of-band (e.g., official artist website, social profile bio, or direct verification) and confirmed it in **Locally Trusted Keys**, the UI displays `Unknown / Unverified Key`.
2. **Offline & Decentralized Revocation Limitations (`CHM-NOTICE1`, `CHM-DEVICE-PAIRING-v1`, `CHM-SYNC-v1`):**
   - Certified Handmade intentionally operates without a central CRL or OCSP server. Verifiers only consult `.chnotice.json` / `chm-notice:` notices **imported locally into that device's IndexedDB `keyNotices` store**.
   - Absence of a local notice does **not** guarantee a key has not been revoked elsewhere; the UI never claims `"Not Revoked"`.
   - Even with opt-in `CHM-SYNC-v1` enabled, free community Nostr relays provide **no SLA, no guaranteed delivery, and no permanent retention**; a device that is offline or using disjoint relays will not see revocations until synchronized or updated out-of-band via QR / `.chdevreg.{json,cbor}`.
   - If a signer's private key seed was leaked, the attacker holding that seed can sign revocation notices or issue backdated historical signatures (`CHM1\0`). Historical mathematical validity of certificates is preserved independently and surfaced alongside local notices rather than silently rewritten.
3. **Cryptography Does Not Prove Hand-Drawing or Legal Copyright:**
   - Author name, artwork title, and timestamps (`issuedAt`, `noticeIssuedAt`, `.chmevidence.createdAt`) are self-declared without an external Trusted Timestamping Authority (TSA).
   - A malicious actor could sign an AI-generated or copied image with their own keypair—cryptography binds *signatures to keys and pixel hashes*, **not** *human authorship* or *legal copyright ownership*.
4. **Non-Cryptographic Visual Similarity Helper:**
   - Optional `dHash64` / `DCT pHash64` visual similarity comparison in `/verify` is an **auxiliary heuristic only** (`isCryptographic: false`) for checking SNS-recompressed copies. It can produce false positives on visually similar compositions or miss subtle edits, and never replaces strict `SHA-256`.
5. **XSS, Endpoint Security & Honest Audit Scope:**
   - Non-extractable `CryptoKey` protects seeds from Web Crypto export, and CSP blocks remote script execution, but endpoint/OS/extension compromise still jeopardizes active signing sessions.
   - Official Nostr protocol conformance was reviewed against [`nostr-protocol/nips@bec0fc8`](https://github.com/nostr-protocol/nips/commit/bec0fc8), and extensive unit, integration (`MockNostrRelay` loopback), fuzz/negative, CLI, and Playwright E2E tests have been implemented in this repository. **No independent third-party cryptographic or security audit has been performed** (zero paid services architecture).
6. **Browser Storage Eviction & Cross-Origin Separation:**
   - `IndexedDB` (`authorKeys`, `trustedKeys`, `keyNotices`, `creatorProfiles`, `proofVault`, `syncSettings`, `syncOutbox`, `syncOpsLog`) is not guaranteed permanent across site-data clearing, and Web (`certified-handmade.com`) vs Standalone (`127.0.0.1:43777`) have distinct origins. Always export and verify encrypted `.chkey.json`, `.chdevreg`, `ncryptsec1` (if syncing), and Vault backups.
7. **Non-Binding Policy Signals:**
   - Preferences such as `aiTraining: disallow` are machine-readable metadata declarations only; they do not technically block scraping or training and do not alter Creative Commons legal terms.
8. **Serverless Multi-Device Sync, Key Custody & Delegated Signing Boundary (`CHM-DEVICE-PAIRING-v1` & `CHM-SYNC-v1`):**
   - Paired devices (`['device-identity']`) authenticate device sync envelopes and relay channels; they cannot mint new `CHM1` artwork signatures unless the root `.chkey.json` key was explicitly restored onto that device.
   - Decentralized Nostr Sync (`CHM-SYNC-v1`) is **100% opt-in and disabled at rest** (`0` background network requests). If free relays are unreachable, rate-limited, or switch to paid policies (`NIP-11` / `payment-required`), Certified Handmade automatically pauses paid relays and degrades cleanly to offline QR pairing and `.chdevreg` / Vault file portability.
9. **Extended Metadata, Creation Declarations & Evidence Files (`.chmevidence`):**
   - Creator websites and social links inside `.chmevidence` are **signed self-declarations only**; Certified Handmade performs zero outbound API checks and never verifies social account ownership.
   - Creation method (`hand-drawn-no-ai`, etc.) and creation environment (`software`, `hardware`, `inputDevice`, `notes`) are creator-signed statements—verifiers clearly label them as `declared by creator` and never compute a "Human-Made Confidence" score.
   - Local evidence hashing only stores `SHA-256`, `byteLength`, basename label, category, and optional MIME type in `.chmevidence`; raw WIP images, `.psd`/`.kra` files, and timelapses stay strictly local.

---

## 4. Reporting Vulnerabilities

Please open a private security advisory or issue on GitHub:
https://github.com/yomiplush/hand-drawing-art-DRM-Toolkit/security

For deeper component-level documentation, see [`docs/THREAT-MODEL.md`](./docs/THREAT-MODEL.md), [`docs/KEY-MANAGEMENT.md`](./docs/KEY-MANAGEMENT.md), and [`docs/RELAY-POLICY.md`](./docs/RELAY-POLICY.md).

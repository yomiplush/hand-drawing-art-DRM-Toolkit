# Security Model & Threat Analysis (`SECURITY.md`)

## 1. Security Architecture Summary

Certified Handmade is a **Cryptographic Artwork Provenance** and rights-declaration system (not copy-protection DRM). It operates under a **zero-server-trust, local-only** architecture across the Web/PWA Edition, the Portable Standalone Edition, and the independent offline CLIs (`tools/chm-verify` and `tools/chm-verify.mjs`):
- Private keys and artwork pixels are processed exclusively inside local memory / Web Crypto API and are never transmitted to any backend or local Go HTTP server.
- Proof data is embedded inside the URL fragment (`#proof=...`), which browsers do not send in HTTP `GET` requests.
- Strict Content Security Policy (`public/_headers`, `index.html`, and `standalone/server.go`) blocks inline scripts, external scripts, and outbound `fetch`/`XHR` connections (`connect-src 'self'`).

---

## 2. Threat Model & Mitigations

| Threat | Mitigation |
| --- | --- |
| **Manifest or license tampering in QR** | Ed25519 signature covers deterministic RFC 8949 CBOR payload with domain prefix `CHM1\0`. Canonical re-encoding checks block CBOR malleability. Small-order / all-zero public keys and malformed signatures are rejected. |
| **Cross-domain signature replay** | Proof manifests (`CHM1\0`), key revocation/rotation notices (`CHM-NOTICE1\0`), and key-possession challenges (`CHM-CHALLENGE1\0`) use distinct null-terminated ASCII domain separation prefixes. |
| **Public key substitution** | Public key is inside the signed payload; replacing it invalidates the signature unless re-signed by another key (which changes the SHA-256 fingerprint and triggers `Unknown / Unverified Key` unless confirmed out-of-band). |
| **Auto-trusting scanned / exchanged keys** | Keys received via verification links, QR scans, or `@yomiplush/chm-exchange` are **never automatically promoted to Trusted**. Users can either save a key in an explicitly `unconfirmed` state (still treated as `Unverified` during verification) or confirm the full 64-character SHA-256 fingerprint out-of-band first. |
| **Artwork pixel tampering** | Signed `sha256` covers un-premultiplied RGBA8 pixels of `[x, y, w, h]` (with `[mx, my, mw, mh]` zeroed out in Protocol v2). Decoded losslessly via `fast-png`, bypassing Canvas premultiplication loss. |
| **Protocol v2 `qrMask` abuse / over-exclusion** | `qrMask` bounds (`mw, mh >= 21`, contained inside `region`) are signed inside CBOR key `9`. Verifiers prominently display excluded bounds and masked area coverage (`<=15%` low, `>15%` caution, `>30%` high warning), and Studio includes an excluded-mask highlight overlay and `Optimize QR Size` helper. |
| **Artwork swap against valid QR** | Verifier explicitly separates **Signature Valid** from **Artwork Integrity (`Not Checked` / `Matched` / `Mismatched`)**. |
| **Decompression bombs / OOM images** | Pre-flight `IHDR` parser checks PNG dimensions (`<= 8192 px` input / `<= 10240 px` output, `<= 32 MP`) and file size (`<= 50 MB`) before `IDAT` decompression. |
| **XSS / injection via QR / URLs / JSON bundles** | Strict base64url validation (no `=`, exact roundtrip), URL rejection for embedded credentials (`user:pass@`), protocol-relative (`//`) paths, overly long inputs (`> 32 KB` / `> 2048 B` CBOR), control characters, and malformed JSON. No `eval`, `dangerouslySetInnerHTML`, or auto-navigation. |
| **Pairing QR tampering, replay & privilege escalation** | `CHM-DEVICE-PAIRING-v1` uses strict RFC 8949 canonical CBOR, small-order/non-torsion-free Ed25519 curve checks (`zip215: false`), domain prefixes (`CHM-DEVICE-PAIRING-v1:{REQ,CERT,REVOKE,REGISTRY}\0`), `requestHash` cryptographic binding, persistent `requestId` + 256-bit `nonce` replay tracking independent of clock, explicit user approval dialogs, and strict `[\x27device-identity\x27]` permission allowlisting. |
| **Stale registry rollback & auto-trust** | Unknown owners imported via enrollment QR remain `active-unverified-owner` until explicit out-of-band confirmation. Local device revocations (`deviceRevocations`) are monotonic and never rolled back when importing older signed `.chdevreg.json`/`.chdevreg.cbor` snapshots. |
| **Plaintext private key leakage** | Plaintext private keys are never stored in `localStorage` or `IndexedDB` and are never exposed by the Standalone HTTP server. Active keys use non-extractable Web Crypto `CryptoKey` handles where supported; `.chkey.json` backups require >= 8 chars (12+ chars recommended with passphrase strength feedback) using PBKDF2-SHA256 (`600,000` iterations) + AES-256-GCM with AAD-bound public key. |
| **Unsupported protocol downgrade** | Outer envelope version `notin {1, 2}` explicitly returns `Unsupported` rather than silently coercing unknown fields; v1 explicitly forbids key `9` (`qrMask`). |
| **Standalone DNS rebinding / LAN exposure** | `standalone/server.go` binds strictly to `127.0.0.1` (`43777`), rejects non-loopback `Host` headers with `403 Forbidden`, enforces read-only `GET`/`HEAD` (`405`), blocks path traversal (`400`), and mirrors `public/_headers` security policies. |
| **Silent storage origin drift on port conflict** | On `127.0.0.1:43777` bind failure, the launcher checks `/__chm_health`; it either hands off to a verified Certified Handmade instance or exits with an explicit error—never silently picking an ephemeral port that would hide existing IndexedDB keys. |

---

## 3. Critical Trust Boundaries & Limitations

1. **Identity Is Not Provided by a Central CA:**
   - A `Valid` cryptographic signature or passing an offline `CHM-CHALLENGE1` check proves only possession of the Ed25519 private key matching `publicKey`.
   - Unless a verifier has independently confirmed the artist's full SHA-256 public key fingerprint out-of-band (e.g., official artist website, social profile bio, or direct verification) and confirmed it in **Locally Trusted Keys**, the UI displays `Unknown / Unverified Key`.
2. **Offline Revocation & Rotation Limitations (`CHM-NOTICE1`):**
   - Certified Handmade intentionally operates without a central CRL or OCSP server. Verifiers only consult `.chnotice.json` / `chm-notice:` notices **imported locally into that device's IndexedDB `keyNotices` store**.
   - Absence of a local notice does **not** guarantee a key has not been revoked elsewhere; the UI never claims `"Not Revoked"`.
   - If a signer's private key seed was leaked, the attacker holding that seed could sign revocation notices or issue backdated historical signatures (`CHM1\0`). Historical mathematical validity of certificates is preserved independently and surfaced alongside local notices rather than silently rewritten.
3. **Cryptography Does Not Prove Hand-Drawing or Legal Copyright:**
   - Author name, artwork title, and timestamps (`issuedAt`, `noticeIssuedAt`) are self-declared without an external Trusted Timestamping Authority (TSA).
   - A malicious actor could sign an AI-generated or copied image with their own keypair—cryptography binds *signatures to keys and pixel hashes*, **not** *human authorship* or *legal copyright ownership*.
4. **Non-Cryptographic Visual Similarity Helper:**
   - Optional `dHash64` / `DCT pHash64` visual similarity comparison in `/verify` is an **auxiliary heuristic only** (`isCryptographic: false`) for checking SNS-recompressed copies. It can produce false positives on visually similar compositions or miss subtle edits, and never replaces strict `SHA-256`.
5. **XSS, Endpoint Security & Self-Review Scope:**
   - Non-extractable `CryptoKey` protects seeds from Web Crypto export, and CSP blocks remote script execution, but endpoint/OS/extension compromise still jeopardizes active signing sessions.
   - Internal security hardening, fuzz/negative tests, and cross-implementation test vectors have been added in this repository; **no independent third-party cryptographic audit has been contracted** (zero paid services architecture).
6. **Browser Storage Eviction & Cross-Origin Separation:**
   - `IndexedDB` (`authorKeys`, `trustedKeys`, `keyNotices`) is not guaranteed permanent across site-data clearing, and Web (`certified-handmade.com`) vs Standalone (`127.0.0.1:43777`) have distinct origins. Always export and verify encrypted `.chkey.json` backups.
7. **Non-Binding Policy Signals:**
   - Preferences such as `aiTraining: disallow` are machine-readable metadata declarations only; they do not technically block scraping or training and do not alter Creative Commons legal terms.

---

8. **Serverless Multi-Device Sync & Offline Revocation (`CHM-DEVICE-PAIRING-v1`):**
   - Because Certified Handmade uses zero central servers, device enrollments and revocations do **not** synchronize automatically across browsers or devices.
   - An offline device cannot prove a paired device has not been revoked elsewhere; share signed revocation QR/tokens or `.chdevreg.{json,cbor}` backups out-of-band.
   - Compromised browser origins/extensions or malicious JavaScript (XSS) on a device holding a non-extractable `CryptoKey` can still invoke Web Crypto `sign()` during an active session (mitigated by strict CSP, input bounds, and explicit UI confirmation).

---

## 4. Reporting Vulnerabilities

Please open a private security advisory or issue on GitHub:
https://github.com/yomiplush/hand-drawing-art-DRM-Toolkit/security

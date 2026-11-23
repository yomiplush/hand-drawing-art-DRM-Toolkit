# Security Model & Threat Analysis (`SECURITY.md`)

## 1. Security Architecture Summary

Certified Handmade operates under a **zero-server-trust, local-only** architecture across both the Web/PWA Edition and the Portable Standalone Edition:
- Private keys and artwork pixels are processed exclusively inside browser memory / Web Crypto API and are never transmitted to any backend or local Go HTTP server.
- Proof data is embedded inside the URL fragment (`#proof=...`), which browsers do not send in HTTP `GET` requests.
- Strict Content Security Policy (`public/_headers`, `index.html`, and `standalone/server.go`) blocks inline scripts, external scripts, and outbound `fetch`/`XHR` connections (`connect-src 'self'`).

---

## 2. Threat Model & Mitigations

| Threat | Mitigation |
| --- | --- |
| **Manifest or license tampering in QR** | Ed25519 signature covers deterministic RFC 8949 CBOR payload with domain prefix `CHM1\0`. Canonical re-encoding checks block CBOR malleability. |
| **Public key substitution** | Public key is inside the signed payload; replacing it invalidates the signature unless re-signed by another key (which changes the key fingerprint and fails **Locally Trusted Key** checks). |
| **Artwork pixel tampering** | Signed `sha256` covers un-premultiplied RGBA8 pixels of `[x, y, w, h]` (with `[mx, my, mw, mh]` zeroed out in Protocol v2). Decoded losslessly via `fast-png`, bypassing Canvas premultiplication loss. |
| **Protocol v2 `qrMask` abuse** | `qrMask` bounds (`mw, mh >= 21`, contained inside `region`) are signed inside CBOR key `9`. Verifiers prominently display the excluded `qrMask` rectangle and remind reviewers that pixels inside the QR box are excluded from SHA-256 verification. |
| **Artwork swap against valid QR** | Verifier explicitly separates **Signature Valid** from **Artwork Integrity (`Not Checked` / `Matched` / `Mismatched`)**. |
| **Decompression bombs / OOM images** | Pre-flight `IHDR` parser checks PNG dimensions (`<= 8192 px` input / `<= 10240 px` output, `<= 32 MP`) and file size (`<= 50 MB`) before `IDAT` decompression. |
| **XSS / injection via QR / `#proof=` / `.chproof.json`** | Strict base64url regex + CBOR parser + JSON schema guard (no `eval`, no `dangerouslySetInnerHTML`, no automatic outbound navigation from QR URLs, control characters rejected, UTF-8 byte caps enforced). |
| **Plaintext private key leakage** | Plaintext private keys are never stored in `localStorage` or `IndexedDB` and are never exposed by the Standalone HTTP server. Active keys use non-extractable Web Crypto `CryptoKey` handles where supported; `.chkey.json` backups use PBKDF2-SHA256 (`600,000` iterations) + AES-256-GCM with AAD-bound public key. |
| **Unsupported protocol downgrade** | Outer envelope version `notin {1, 2}` explicitly returns `Unsupported` rather than silently coercing unknown fields; v1 explicitly forbids key `9` (`qrMask`). |
| **Standalone DNS rebinding / LAN exposure** | `standalone/server.go` binds strictly to `127.0.0.1` (`43777`), rejects non-loopback `Host` headers with `403 Forbidden`, enforces read-only `GET`/`HEAD` (`405`), blocks path traversal (`400`), and mirrors `public/_headers` security policies. |
| **Silent storage origin drift on port conflict** | On `127.0.0.1:43777` bind failure, the launcher checks `/__chm_health`; it either hands off to a verified Certified Handmade instance or exits with an explicit error—never silently picking an ephemeral port that would hide existing IndexedDB keys. |

---

## 3. Critical Trust Boundaries & Limitations

1. **Identity Is Not Provided by a Central CA:**
   - A `Valid` cryptographic signature only proves possession of the private key corresponding to `publicKey` in that manifest.
   - Unless a verifier has independently confirmed the artist's public key out-of-band (e.g., official artist website, social profile, or key fingerprint check) and added it to **Locally Trusted Keys**, the UI displays `Unknown / Unverified Key` and suppresses any trusted badge.
2. **Self-Declared Claims & Timestamps:**
   - Author name, artwork title, and `issuedAt` timestamp are self-declared by the signer. Without an external trusted timestamping authority (TSA), a signer can backdate or forward-date `issuedAt`.
   - A malicious actor could sign an AI-generated or stolen image with their own newly generated keypair—cryptographic signatures prove *who signed a claim*, not *how the pixels were drawn*.
3. **XSS & Endpoint Security:**
   - Non-extractable `CryptoKey` prevents an attacker from exfiltrating the raw Ed25519 seed via `crypto.subtle.exportKey`, and strict CSP blocks external scripts. However, if a user's browser or OS is compromised by malware or malicious extensions, local signing operations within the active origin remain exposed to that endpoint compromise.
4. **Browser Storage Eviction & Cross-Origin Separation:**
   - `IndexedDB` is not permanent storage; clearing site data or browser storage pressure can delete keys.
   - Furthermore, the hosted Web Edition (`certified-handmade.com`) and Standalone Edition (`http://127.0.0.1:43777`) have distinct browser origins and separate `IndexedDB` stores. Always keep an encrypted `.chkey.json` backup stored offline and use backup verification / restore to move keys safely.
5. **Non-Binding Policy Signals:**
   - Preferences such as `aiTraining: disallow` are machine-readable declarations only; they are not technical DRM blocks and do not alter Creative Commons legal text.

---

## 4. Reporting Vulnerabilities

Please open a private security advisory or issue on GitHub:
https://github.com/yomiplush/hand-drawing-art-DRM-Toolkit/security

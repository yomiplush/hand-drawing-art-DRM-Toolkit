# Security Model & Threat Analysis (`SECURITY.md`)

## 1. Security Architecture Summary

Certified Handmade operates under a **zero-server-trust, local-only** architecture:
- Private keys and artwork pixels are processed exclusively in browser memory and never transmitted to any backend.
- Proof data is embedded inside the URL fragment (`#proof=...`), which browsers do not send in HTTP `GET` requests.
- Strict Content Security Policy (`public/_headers` and `index.html`) blocks inline scripts, external scripts, and outbound `fetch`/`XHR` connections (`connect-src 'self'`).

---

## 2. Threat Model & Mitigations

| Threat | Mitigation |
| --- | --- |
| **Manifest or license tampering in QR** | Ed25519 signature covers deterministic RFC 8949 CBOR payload with domain prefix `CHM1\0`. Canonical re-encoding checks block CBOR malleability. |
| **Public key substitution** | Public key is inside the signed payload; replacing it invalidates the signature unless re-signed by another key (which changes the key fingerprint and fails **Locally Trusted Key** checks). |
| **Artwork pixel tampering** | Signed `sha256` covers un-premultiplied RGBA8 pixels of `[x, y, w, h]`. Decoded losslessly via `fast-png`, bypassing Canvas premultiplication loss. |
| **Artwork swap against valid QR** | Verifier explicitly separates **Signature Valid** from **Artwork Integrity (`Not Checked` / `Matched` / `Mismatched`)**. |
| **Decompression bombs / OOM images** | Pre-flight `IHDR` parser checks PNG dimensions (`<= 10240 px`, `<= 32 MP`) and file size (`<= 50 MB`) before `IDAT` decompression. |
| **XSS / injection via QR / `#proof=`** | Strict base64url regex + CBOR parser (no `eval`, no `dangerouslySetInnerHTML`, no dynamic `href` navigation from QR content, control characters rejected, UTF-8 byte caps enforced). |
| **Plaintext private key leakage** | Plaintext private keys are never stored in `localStorage` or `IndexedDB`. Active keys use non-extractable Web Crypto `CryptoKey` handles where supported; backups use PBKDF2-SHA256 (`600,000` iterations) + AES-256-GCM with AAD-bound public key. |
| **Unsupported protocol downgrade** | Outer envelope version `!= 1` explicitly returns `Unsupported` rather than silently coercing unknown fields. |

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
4. **Browser Storage Eviction:**
   - `IndexedDB` is not permanent storage; clearing site data or browser storage pressure can delete keys. Always keep an encrypted `.chkey.json` backup stored offline.
5. **Offline PWA First-Load Limit:**
   - Verification works 100% offline once the PWA has been cached by the Service Worker, but a device that has never visited the app cannot initialize it offline over the network.
6. **Non-Binding Policy Signals:**
   - Preferences such as `aiTraining: disallow` are machine-readable declarations only; they are not technical DRM blocks and do not alter Creative Commons legal text.

---

## 4. Reporting Vulnerabilities

Please open a private security advisory or issue on GitHub:
https://github.com/yomiplush/hand-drawing-art-DRM-Toolkit/security

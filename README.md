# Certified Handmade

**Your Art. Your Rights. Your Freedom.**

Certified Handmade is a 100% free, open-source, offline-first digital artwork provenance and rights-declaration toolkit. Artists can cryptographically sign illustrations locally with Ed25519, embed self-contained verification QR codes into lossless PNG margins (Protocol v1) or masked in-image overlays (Protocol v2), and run either the **Web / PWA Edition** (`certified-handmade.com`) or the **Portable Standalone Edition** (`127.0.0.1:43777` for Linux x86_64 and Windows x86_64) completely offline—including on first launch.

- **Website:** https://certified-handmade.com/
- **Repository:** https://github.com/yomiplush/hand-drawing-art-DRM-Toolkit
- **License:** MIT (see [`LICENSE`](./LICENSE))

---

## Core Principles

- **100% Free & Open Source** (MIT License)
- **Zero Paid Infrastructure** (no paid APIs, no cloud DBs, no VPS, no telemetry)
- **No NFTs, No Blockchain, No Cryptocurrency, No Crypto Wallets**
- **No Accounts, No Subscriptions, No Paywalls, No Ads**
- **No Central Authentication Server or Server File Uploads**
- **Local First & Offline First** (PWA + Portable Standalone Binaries)

All key generation, Ed25519 signing, canonical RGBA8 pixel hashing, PNG encoding/decoding, QR burning, QR scanning, and verification run **100% locally on your device**.

---

## Editions

| Edition | Target | Internet Required? | Storage Origin |
| --- | --- | --- | --- |
| **Web / PWA Edition** | Desktop, iPhone, iPad, Android browsers | First visit over HTTPS caches PWA; subsequent use works offline | `https://certified-handmade.com` |
| **Standalone Edition** | **Linux x86_64** (CachyOS / Arch / Debian / Fedora) & **Windows x86_64** | **No** — works 100% offline from launch #1 (zero Node.js/Go install needed) | `http://127.0.0.1:43777` |

> **Moving keys between Web & Standalone:** Because browsers isolate IndexedDB storage per origin, export a passphrase-encrypted `.chkey.json` backup in **Identity / Keys** (`/keys`) or during quick key generation and restore it on the other edition.

---

## Features

1. **Local Ed25519 Key Management (`/keys`)**
   - Generates Ed25519 keypairs inside the browser (non-extractable Web Crypto `CryptoKey` in IndexedDB where supported, with audited `@noble/ed25519` fallback).
   - Passphrase-encrypted private key backups (`.chkey.json` using 600,000-iteration PBKDF2-SHA256 + AES-256-GCM), backup verification without modifying IndexedDB ("Verify Backup Only"), and safe restore flow.
   - Public key export and a personal **Locally Trusted Keys** list (no central CA).
2. **Certificate Creation, Outer QR Border (v1) & In-Image QR Studio (v2) (`/create`)**
   - Normalizes PNG (lossless via `fast-png`, preserving exact straight RGBA8 including `alpha = 0`), JPEG, and WebP inputs into Canonical Artwork Raster (`RGBA8`).
   - Encodes artwork SHA-256, region `[x, y, width, height]`, optional `qrMask` (v2), declared timestamp, license (`All Rights Reserved`, `CC0-1.0`, `CC BY / BY-SA / BY-NC / BY-NC-SA / BY-ND / BY-NC-ND 4.0`), and non-binding intent flags (including AI training preference) into deterministic RFC 8949 CBOR signed with Ed25519.
   - Post-render QR readability self-check verifies every generated PNG before export, and optionally exports a `.chproof.json` portable proof bundle alongside the PNG.
3. **Independent Offline Verification (`/verify`)**
   - Accepts `/verify#proof=...` URL fragments, pasted proof tokens, `.chproof.json` proof bundles, clipboard images, PWA Web Share Target handoffs, uploaded signed PNGs, or live local camera QR scanning (`getUserMedia`).
   - Never automatically fetches or navigates to remote URLs during verification.
   - Displays **three independent statuses** without conflating them:
     - **A. Cryptographic Signature:** `Valid` / `Invalid` / `Unsupported`
     - **B. Artwork Integrity:** `Matched` / `Mismatched` / `Not Checked` (with Protocol v2 `qrMask` boundary warning)
     - **C. Author Identity:** `Locally Trusted Key` / `Unknown / Unverified Key`
4. **13-Language UI** & Responsive Touch-First Design.

---

## Important Limitations & Scope

- **Signature ≠ Proof of Hand-Drawing:** A valid Ed25519 signature proves only that the holder of a keypair signed the manifest and (when checked) that the artwork pixels match. It cannot mathematically prove from a finished image alone that no AI tools were used.
- **Self-Declared Timestamps:** Without an external timestamp authority, `issuedAt` reflects the local device clock declared by the signer.
- **Browser Storage Volatility:** IndexedDB keys can be deleted by browser eviction or clearing site data. Always export and safely store an encrypted `.chkey.json` backup.

---

## Local Development & Standalone Builds

### Prerequisites

- **Web / Tests:** Node.js 20+ (tested on Node 26), npm 10+
- **Standalone Launcher (for building binaries from source):** Go 1.22+ (tested on Go 1.27.4, zero third-party Go modules — standard library only)

### Commands

```bash
# Install Node dependencies
npm install

# Start development server
npm run dev

# Typecheck & Lint
npm run typecheck
npm run lint

# Run unit & integration tests (Vitest)
npm test

# Production web build (static files + PWA Service Worker in dist/)
npm run build

# Build portable Standalone binaries & reproducible archives in release/
npm run build:standalone

# Run web Playwright E2E tests (Desktop + Mobile Chromium)
npm run test:e2e

# Run offline Standalone Linux binary Playwright E2E tests (http://127.0.0.1:43777)
npm run test:standalone
```

### Standalone Launcher Security & CLI Flags

The Go launcher (`standalone/`) compiles a zero-external-dependency executable embedding `dist/` via `embed.FS`:

- Binds strictly to `127.0.0.1:43777` (loopback only, stable IndexedDB storage origin).
- Validates HTTP `Host` headers (`403 Forbidden` against DNS rebinding).
- Enforces read-only `GET`/`HEAD` (`405 Method Not Allowed`) and blocks traversal paths (`400 Bad Request`).
- Never handles private keys or accepts state-changing HTTP endpoints.
- Supports `--port <port>`, `--no-browser`, `--open-path <path>`, and `--version`.
- On bind conflict, safely probes `/__chm_health`: reuses a verified running Certified Handmade instance or fails cleanly without silently shifting the storage origin.

---

## Cloudflare Pages & GitHub Releases Deployment

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for:
- Free Cloudflare Pages deployment (`dist/`)
- Local & zero-cost GitHub Releases packaging for Linux x86_64 and Windows x86_64 with `SHA256SUMS.txt`

---

## Documentation Index

- [`SPEC.md`](./SPEC.md) — Canonical manifest schema (Protocol v1 & v2), deterministic RFC 8949 CBOR format, RGBA8 normalization, `qrMask` hashing, `.chproof.json` bundle schema, and normative v1/v2 test vectors.
- [`SECURITY.md`](./SECURITY.md) — Threat model, key storage architecture, loopback HTTP hardening, verification semantics, CSP, and residual risks.
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — Cloudflare Pages setup, portable standalone build/release workflow, and self-hosting guide.
- [`THIRD_PARTY_LICENSES.md`](./THIRD_PARTY_LICENSES.md) — Open-source dependencies and licenses.

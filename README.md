# Certified Handmade

**Your Art. Your Rights. Your Freedom.**

Certified Handmade is a 100% free, open-source, offline-first **Cryptographic Artwork Provenance** and rights-declaration toolkit. Artists can cryptographically sign illustrations locally with Ed25519, embed self-contained verification QR codes into lossless PNG margins (Protocol v1) or masked in-image overlays (Protocol v2), and run either the **Web / PWA Edition** (`certified-handmade.com`), the **Portable Standalone Edition** (`127.0.0.1:43777` for Linux x86_64 and Windows x86_64), or the **Independent Offline CLIs** completely offline—including on first launch.

- **Website:** https://certified-handmade.com/
- **Repository:** https://github.com/yomiplush/hand-drawing-art-DRM-Toolkit
- **License:** MIT (see [`LICENSE`](./LICENSE))

---

## Core Principles

- **100% Free & Open Source** (MIT License)
- **Zero Paid Infrastructure** (no paid APIs, no cloud DBs, no VPS, no telemetry)
- **No NFTs, No Blockchain, No Cryptocurrency, No Crypto Wallets**
- **No Accounts, No Subscriptions, No Paywalls, No Ads**
- **No Central Authentication Server, No Central CRL, or Server File Uploads**
- **Local First & Offline First** (PWA + Portable Standalone Binaries + Independent CLIs)

All key generation, Ed25519 signing, canonical RGBA8 pixel hashing, PNG encoding/decoding, QR burning, QR scanning, streaming local evidence hashing, visual similarity checks, notice verification, and challenge-response checks run **100% locally on your device**.

---

## Editions

| Edition | Target | Internet Required? | Storage Origin |
| --- | --- | --- | --- |
| **Web / PWA Edition** | Desktop, iPhone, iPad, Android browsers | First visit over HTTPS caches PWA; subsequent use works offline | `https://certified-handmade.com` |
| **Standalone Edition** | **Linux x86_64** & **Windows x86_64** | **No** — works 100% offline from launch #1 (zero Node.js/Go install needed) | `http://127.0.0.1:43777` |
| **Independent CLI Verifiers** | `tools/chm-verify` (Go) & `tools/chm-verify.mjs` (Node.js) | **No** — stateless verification importing zero files from `src/` | CLI / JSON stdout |

> **Moving keys between Web & Standalone:** Because browsers isolate IndexedDB storage per origin, export a passphrase-encrypted `.chkey.json` backup in **Identity / Keys** (`/keys`) or during quick key generation and restore it on the other edition.

---

## Features

1. **Decentralized Ed25519 Key Management, Trust & Challenges (`/keys`, `/exchange`)**
   - Generates Ed25519 keypairs inside the browser (non-extractable Web Crypto `CryptoKey` in IndexedDB where supported, with audited `@noble/ed25519` fallback).
   - Passphrase-encrypted private key backups (`.chkey.json` using 600,000-iteration PBKDF2-SHA256 + AES-256-GCM) with live passphrase strength feedback (`8+` required, `12+` recommended), non-mutating backup verification ("Verify Backup Only"), and restore flow.
   - Displays copyable full 64-hex SHA-256 key fingerprints and scannable fingerprint QR codes, integrates with `@yomiplush/chm-exchange`, and requires explicit out-of-band fingerprint confirmation before promoting a received key to **Trusted** (`unconfirmed` vs `confirmed`).
   - Supports offline **Key Revocation & Rotation Notices** (`CHM-NOTICE1\0`, `.chnotice.json` / `chm-notice:`)—single-signed for revocation and dual-signed (old + new key) for rotation—and **Offline Key-Possession Challenge-Response** (`CHM-CHALLENGE1\0`).
2. **Certificate Creation, Optional Artwork Details (`.chmevidence`), Outer QR Border (v1) & In-Image QR Studio (v2) (`/create`)**
   - Normalizes PNG (lossless via `fast-png`, preserving exact straight RGBA8 including `alpha = 0`), JPEG, and WebP inputs into Canonical Artwork Raster (`RGBA8`).
   - Encodes artwork SHA-256, region `[x, y, width, height]`, optional `qrMask` (v2), declared timestamp, license (`All Rights Reserved`, `CC0-1.0`, `CC BY / BY-SA / BY-NC / BY-NC-SA / BY-ND / BY-NC-ND 4.0`), and non-binding intent flags (including AI training preference) into deterministic RFC 8949 CBOR signed with Ed25519.
   - **Artwork Details (Optional):** Collapsible progressive disclosure for multilingual artwork title/artist/description, creator website & unbounded social/portfolio links (with optional local IndexedDB default persistence), creation method declaration (`hand-drawn-no-ai`, `hand-drawn-ai-assisted`, `ai-generated`, `other`, `prefer-not-to-disclose`), creation environment notes (software, hardware, input device, free-form notes), and streaming local `SHA-256` hashing of private evidence files (sketches, WIPs, PSD/KRA/CLIP projects, timelapses—raw files stay local on your device).
   - **Compact QR & `.chmevidence`:** Extended details are signed in a separate domain-separated `.chmevidence` file (`CHM-EVIDENCE1\0`) cryptographically bound (`proofSha256`, `artworkId`, `artworkSha256`, `publicKey`) to the primary proof—leaving the embedded QR code (`0` extra bytes) compact and backward compatible.
   - Protocol v2 Studio displays live `qrMask` excluded-area percentage warnings (`>15%` caution, `>30%` high), an optional excluded-mask highlight overlay on the preview canvas, and a one-click **Optimize QR Size** helper.
   - Post-render QR readability self-check verifies every generated PNG before export, and optionally exports a `.chproof.json` portable proof bundle alongside the PNG and `.chmevidence`.
3. **Independent Offline Verification (`Mode A / B / C`) & SNS Visual Helper (`/verify`)**
   - Accepts `/verify#proof=...` URL fragments, pasted proof tokens, `.chproof.json` proof bundles, clipboard images, PWA Web Share Target handoffs, uploaded signed PNGs, or live local camera QR scanning (`getUserMedia`).
   - Supports three offline verification modes:
     - **Mode A:** Artwork + embedded QR / primary proof only.
     - **Mode B:** Primary proof + `.chmevidence` signed extension (rejecting standalone `.chmevidence` without a primary proof, and reporting unsupplied evidence files honestly as *Unavailable*, never *Invalid*).
     - **Mode C:** Primary proof + `.chmevidence` + local evidence files (streaming SHA-256 verification).
   - Never automatically fetches or navigates to remote URLs during verification.
   - Displays **independent statuses** without conflating them:
     - **A. Cryptographic Signature:** `Valid` / `Invalid` / `Unsupported`
     - **B. Artwork Integrity:** `Matched` / `Mismatched` / `Not Checked` (with Protocol v2 `qrMask` excluded-area percentage & bounds)
     - **C. Author Identity:** `Locally Trusted Key` / `Unknown / Unverified Key` (with `Unconfirmed` indicator until fingerprint confirmed)
     - **D. Local Key Notice Check:** Surfaces locally imported revocation/rotation notices (without rewriting historical signature math), or clearly states when no local notice exists on this device (never falsely saying "Not Revoked").
     - **E. Extended Artwork Details & Creation Evidence (Optional):** Clearly labels creator profile URLs and creation method as signed self-declarations (`declared by creator`), never computes a "Human-Made Confidence" score, and renders all text safely.
   - Includes a collapsible, strictly **non-cryptographic** `dHash64` + `DCT pHash64` helper to visually compare SNS-recompressed copies locally.
4. **CHM Secure Device Pairing (`/devices`, `CHM-DEVICE-PAIRING-v1`)**
   - Pairs PC, smartphone, and tablet browsers to an existing CHM Identity 100% offline via a 2-step QR handshake (with PNG/JPEG/WebP QR upload and paste fallback).
   - Each device creates an independent local Ed25519 device key (non-extractable Web Crypto preferred, encrypted fallback supported) without ever copying the root author private key.
   - Supports explicit approval confirmation, manual owner trust confirmation, persistent `requestId`/`nonce` replay defense, signed device revocations, and monotonic signed registry backups (`.chdevreg.json` / `.chdevreg.cbor`).
5. **13-Language UI & Touch-First Accessibility** across desktop and mobile viewports.

---

## Independent Offline CLI Verifiers (`tools/`)

To verify artworks, proofs, `.chmevidence` extensions, and key notices independently of the web app (`zero src/ imports`):

```bash
# Node.js CLI (Mode A/B/C verification & key notices)
node tools/chm-verify.mjs signed-artwork.png
node tools/chm-verify.mjs --proof art.chproof.json --artwork original.png --evidence art.chmevidence --evidence-file sketch.kra --json
node tools/chm-verify.mjs --notice notice.chnotice.json

# Go CLI (standard library only)
cd tools/chm-verify
go run . --proof /path/to/art.chproof.json --artwork /path/to/original.png --evidence /path/to/art.chmevidence --evidence-file /path/to/sketch.kra --json
go run . --notice /path/to/notice.chnotice.json
```

---

## Important Limitations & Scope

- **Cryptographic Provenance, Not Copy-Protection DRM:** Certified Handmade creates tamper-evident signatures and machine-readable rights declarations; it does **not** encrypt artwork pixels, block screenshots, or technically enforce `aiTraining: disallow`.
- **Signature ≠ Proof of Hand-Drawing or Legal Copyright:** A valid Ed25519 signature (or `.chmevidence` evidence hash match / offline key-possession challenge) proves only that the holder of that private key signed the data and (when checked) that pixels or local evidence files match their signed SHA-256 hashes. It cannot prove by math alone that no AI tools were used, verify external social account ownership, or prove legal copyright ownership.
- **Self-Declared Timestamps & Decentralized Notices:** Without a central server or TSA, `issuedAt`, `noticeIssuedAt`, and `.chmevidence` `createdAt` are self-declared, and verifiers only see `.chnotice.json` notices imported locally. If a private key leaks, anyone holding that seed can sign notices or backdated manifests.
- **Perceptual Similarity Is Auxiliary Only:** `dHash`/`pHash` visual scores are non-cryptographic aids for resized/recompressed social images and never replace `SHA-256`.
- **Browser Storage Volatility:** IndexedDB stores (`authorKeys`, `trustedKeys`, `keyNotices`, `creatorProfiles`) can be deleted by browser eviction or clearing site data. Always export and verify an encrypted `.chkey.json` backup.

---

## Local Development & Standalone Builds

### Prerequisites

- **Web / Tests:** Node.js 20+ (tested on Node 26), npm 10+
- **Standalone Launcher & Go CLI:** Go 1.22+ (zero third-party Go modules — standard library only)

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

# Run Go independent CLI tests
cd tools/chm-verify && go test -v ./...

# Production web build (static files + PWA Service Worker in dist/)
npm run build

# Build portable Standalone binaries & reproducible archives in release/
npm run build:standalone

# Run web Playwright E2E tests (Desktop + Mobile Chromium)
npm run test:e2e

# Run offline Standalone Linux binary Playwright E2E tests (http://127.0.0.1:43777)
npm run test:standalone
```

---

## Cloudflare Pages & GitHub Releases Deployment

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for:
- Free Cloudflare Pages deployment (`dist/`)
- Local & zero-cost GitHub Releases packaging for Linux x86_64 and Windows x86_64 with `SHA256SUMS.txt`

---

## Documentation Index

- [`SPEC.md`](./SPEC.md) — Canonical manifest schema (Protocol v1 & v2), `CHM-EVIDENCE1`, `CHM-NOTICE1` & `CHM-CHALLENGE1` specifications, perceptual/CLI boundaries, and normative v1/v2 test vectors.
- [`SECURITY.md`](./SECURITY.md) — Threat model, out-of-band key trust, `.chmevidence` anti-replay/XSS boundaries, key storage architecture, revocation/backdating limits, loopback HTTP hardening, CSP, and residual risks.
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — Cloudflare Pages setup, portable standalone build/release workflow, and self-hosting guide.
- [`THIRD_PARTY_LICENSES.md`](./THIRD_PARTY_LICENSES.md) — Open-source dependencies and licenses.

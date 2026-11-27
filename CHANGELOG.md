# Changelog

All notable changes to **Certified Handmade** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.2] - 2026-11-28

### Changed
- Canonicalized production origin URLs to `https://www.certified-handmade.com`.
- Hardened CI/CD and security automation (`.github/workflows/ci.yml` least-privilege permissions, CodeQL analysis, Dependabot updates).
- Synchronized `README.md`, `SPEC.md`, `SECURITY.md`, and `THIRD_PARTY_LICENSES.md` with `/exchange` (`@yomiplush/chm-exchange`) and social media re-compression scope notes.
- Added `CONTRIBUTING.md`, structured `.github/ISSUE_TEMPLATE/` forms, and `CHANGELOG.md`.

### Fixed
- Cloudflare Pages production builds failing on `npm ci` peer-dependency resolution (`eslint-plugin-jsx-a11y` vs `eslint` 10) by adding a project `.npmrc` (`legacy-peer-deps=true`).

## [1.3.1] - 2026-11-28

### Added
- WCAG 2.1 AA accessibility improvements, `eslint-plugin-jsx-a11y`, and `@axe-core/playwright` E2E checks.
- Social media re-compression workflow guide (`docs/SNS-WORKFLOW.md`), QR readability checker, and CI workflow.
- Global default Nostr relays with optional Japan relay presets and reset controls.

## [1.3.0] - 2026-11-27

### Added
- macOS (`arm64` / `amd64`) standalone builds and multi-OS CI verification.
- Interactive 3D motion graphics onboarding tutorial.
- Passphrase confirmation input across all key and backup creation forms.

### Fixed
- Compact in-image QR minimum size (`96px`), 2-module quiet zone, and contrast floor for smartphone cameras.
- Cross-browser file picker behavior on iOS, iPadOS, and macOS Safari.

## [1.2.2] - 2026-11-27

### Added
- Ephemeral source project verifier, client-side artwork safety guards (perceptual dHash blocklist, real-name/PII author guard), and SEO/AEO page generation.
- Native multi-layer working file verification (`.psd`, `.psb`, `.clip`, `.procreate`, `.kra`, `.ora`, `.sai2`) and Protocol v2 dual-hash proofs.

## [1.2.1] - 2026-11-27

### Changed
- Prepared v1.2.1 standalone release and resolved lint and unit test checks.

## [1.2.0] - 2026-11-26

### Added
- Dedicated `/offline` page, in-image default QR mode in GalleryDeck, and 2-step Google Drive sync reset.
- Dedicated `tags` field in Protocol v3 manifests.

## [1.1.0] - 2026-11-24

### Added
- Protocol v3 (`CHM3\0`) self-contained compact QR envelopes with DEFLATE compression and canonical URL dictionary.
- Creation evidence extensions (`.chmevidence`, `CHM-EVIDENCE1\0`) and Mode A/B/C verification.
- Zero-cost auth-only decentralized Nostr device sync (`CHM-SYNC-v1` over NIP-44 v2 + NIP-59).
- Pluggable Proof Vault storage providers (`IndexedDB`, `.chmvault.json`, and opt-in Personal Google Drive `drive.appdata`).

## [1.0.0] - 2026-11-23

### Added
- Initial production release of Certified Handmade: Ed25519 key management (`/keys`), serverless public-key exchange (`/exchange` via `@yomiplush/chm-exchange`), certificate creation (`/create` Protocol v1 & v2), offline verification (`/verify`), device pairing (`/devices`), 13-language UI, PWA, Portable Standalone Edition, and independent Node.js & Go CLI verifiers.

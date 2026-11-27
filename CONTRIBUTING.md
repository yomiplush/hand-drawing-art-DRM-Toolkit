# Contributing to Certified Handmade

Thank you for your interest in contributing to **Certified Handmade**! We welcome bug reports, documentation improvements, translations, accessibility fixes, and well-tested code contributions.

> **Security Vulnerabilities:** Please do **not** report security issues in public GitHub issues. See [`SECURITY.md`](./SECURITY.md) and open a private advisory at <https://github.com/yomiplush/hand-drawing-art-DRM-Toolkit/security>.

---

## Core Architectural Rules

Before making changes, please keep these non-negotiable principles in mind:

1. **100% Local-First & Privacy-First:** Never add telemetry, analytics, external CDN scripts, or background network requests. Artwork pixels and private keys must never leave the user's device.
2. **Zero Cryptographic Regression:** Any changes touching Ed25519, SHA-256, AES-256-GCM, RFC 8949 CBOR, or protocol encodings (`v1`/`v2`/`v3`, `CHM-EVIDENCE1`, `CHM-NOTICE1`, `CHM-CHALLENGE1`, `CHM-DEVICE-PAIRING-v1`, `CHM-SYNC-v1`, `CHM-VAULT-v1`) must preserve compatibility with [`SPEC.md`](./SPEC.md) and include unit tests.
3. **Independent CLI Parity:** Protocol verification changes must remain consistent across the web app (`src/`), the Node.js CLI (`tools/chm-verify.mjs`), and the Go CLI (`tools/chm-verify/`).

---

## Local Setup & Verification

### Prerequisites

- **Node.js 22+** (pinned in [`.node-version`](./.node-version); `package.json` `engines.node` requires `>=20.19.0`) and **npm 10+**
- **Go 1.22+** (for `tools/chm-verify` and `standalone/` tests)

### Commands

```bash
# Install dependencies
npm ci --legacy-peer-deps

# Start local dev server
npm run dev

# Run full verification suite
npm run typecheck
npm run lint
npm test
npm run build

# Run Go CLI & Standalone server tests
cd tools/chm-verify && go test -v ./...
cd standalone && go test -v ./...

# Run Playwright E2E tests (Desktop & Mobile Chromium)
npx playwright install --with-deps chromium
npm run test:e2e
```

---

## Pull Request Guidelines

- Keep pull requests **small and focused** on a single bug fix, feature, or documentation/translation improvement.
- Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` before opening a PR.
- Add or update unit tests (Vitest) and/or E2E tests (Playwright) for any behavioral changes.
- Write commit messages, PR descriptions, code comments, and documentation in clear, concise **English**.

---

## Localization & Translation Guide (13 Languages)

Certified Handmade currently supports **13 locales** defined in `SUPPORTED_LOCALES` ([`src/core/storage/consent.ts`](./src/core/storage/consent.ts)) and `LOCALE_OPTIONS` ([`src/i18n/context.ts`](./src/i18n/context.ts)):

`en`, `ja`, `zh-CN`, `zh-TW`, `ko`, `ru`, `uk`, `es`, `fr`, `de`, `pt`, `it`, `ar` (RTL)

### How Translations Are Structured

1. **Core UI dictionaries (`Translations`):**
   - `en` ([`src/i18n/en.ts`](./src/i18n/en.ts)) and `ja` ([`src/i18n/ja.ts`](./src/i18n/ja.ts)) are statically loaded.
   - Other locales are lazy-loaded in [`src/i18n/index.tsx`](./src/i18n/index.tsx) via `loadExtraLocale()` from:
     - [`src/i18n/locales/eastAsia.ts`](./src/i18n/locales/eastAsia.ts) (`zhCN`, `zhTW`, `ko`)
     - [`src/i18n/locales/slavic.ts`](./src/i18n/locales/slavic.ts) (`ru`, `uk`)
     - [`src/i18n/locales/europeanAndArabic.ts`](./src/i18n/locales/europeanAndArabic.ts) (`es`, `fr`, `de`, `pt`, `it`, `ar`)
2. **Feature-specific dictionaries (`src/i18n/*.ts`):**
   - Modular dictionaries (such as `a11y.ts`, `artworkDetails.ts`, `devicePairing.ts`, `discord.ts`, `galleryDeck.ts`, `googleCompliance.ts`, `hardening.ts`, `howto.ts`, `humanUx.ts`, `interactiveTutorial.ts`, `licenses.ts`, `minimalUi.ts`, `nextGen.ts`, `qrStudio.ts`, `seo.ts`, `simple.ts`, `tutorial.ts`, `uxGuidance.ts`, `vault.ts`, `verifyMobile.ts`) export `Record<Locale, ...>` objects or fall back to `.en` in [`src/i18n/index.tsx`](./src/i18n/index.tsx).

### Improving an Existing Translation

1. Locate the key in [`src/i18n/en.ts`](./src/i18n/en.ts) or the relevant `src/i18n/*.ts` / `src/i18n/locales/*.ts` file.
2. Update the string for your target locale, keeping placeholders (e.g., `{count}`, `{name}`) and technical identifiers intact.
3. Run `npm run typecheck && npm run lint && npm test` to verify types and tests pass.

### Adding a New Language

1. Add the BCP-47 locale code to `SUPPORTED_LOCALES` in [`src/core/storage/consent.ts`](./src/core/storage/consent.ts).
2. Add the `{ code, label, dir }` entry to `LOCALE_OPTIONS` in [`src/i18n/context.ts`](./src/i18n/context.ts) (set `dir: 'rtl'` for right-to-left languages).
3. Add browser language detection in `detectInitialLang()` inside [`src/state/uiPreferences.ts`](./src/state/uiPreferences.ts).
4. Create the `Translations` dictionary (e.g., in `src/i18n/locales/`) and wire it into `loadExtraLocale()` in [`src/i18n/index.tsx`](./src/i18n/index.tsx).
5. Add entries for the new locale in the feature dictionaries under `src/i18n/*.ts` (TypeScript will flag any required `Record<Locale, ...>` keys via `npm run typecheck`).
6. Run `npm run typecheck && npm run lint && npm test && npm run build`.

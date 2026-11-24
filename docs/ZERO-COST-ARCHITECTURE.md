# Zero-Cost Decentralized Architecture (`ZERO-COST-ARCHITECTURE.md`)

**User Mandatory Cost:** ¥0 / \$0 Forever  
**Maintainer Mandatory Ongoing Cost:** Domain renewal (`certified-handmade.com`) **only**

---

## 1. Why Zero-Cost Architecture Matters

Artists worldwide—especially hobbyists, students, and independent illustrators—should never lose provenance protection if a startup folds, runs out of VC funding, or introduces paywalls. Certified Handmade guarantees sustainability by removing recurring server compute, database storage, and bandwidth liabilities from both the maintainer and the artist.

---

## 2. Zero-Cost Functional Mapping

| Function | Mechanism | User Cost | Maintainer Marginal Cost |
| --- | --- | --- | --- |
| **Static Web / PWA Hosting** | Cloudflare Pages static assets (`dist/`) + offline Service Worker (`sw.js`) | \$0 | \$0 (unlimited static requests on free tier) |
| **Portable Offline App** | Go stdlib single-file server (`127.0.0.1:43777`) via GitHub Releases | \$0 | \$0 |
| **Author & Device Identity** | Local Web Crypto Ed25519 + `@noble/ed25519` | \$0 | \$0 |
| **Artwork Signing & QR** | Local SHA-256 + RFC 8949 CBOR + `fast-png` + `qrcode` | \$0 | \$0 |
| **Offline Verification** | Browser WASM-free JS, Node CLI (`chm-verify.mjs`), Go CLI (`tools/chm-verify`) | \$0 | \$0 |
| **Local Proof Database** | Client IndexedDB (`CHM-VAULT-v1`, ~1 KiB per proof) | \$0 | \$0 |
| **Device Pairing** | Offline 2-step QR (`CHM-DEVICE-PAIRING-v1`, `@yomiplush/chm-exchange`) | \$0 | \$0 |
| **Encrypted Multi-Device Sync** | Optional NIP-44 + NIP-59 (`kind 1059`) over free community Nostr relays | \$0 | \$0 |
| **Public Proof Index (Opt-In)** | Optional NIP-78 (`kind 30078`) on free relays + local signature check | \$0 | \$0 |
| **Backups & Portability** | Local JSON / PBKDF2 / AES-256-GCM / NIP-49 file downloads | \$0 | \$0 |
| **Multilingual UI (13 Locales)** | Static bundled dictionaries (`src/i18n/*`) | \$0 | \$0 |

---

## 3. Prohibited Paid Dependencies

The architecture explicitly **forbids** adding any mandatory dependency on:
- Cloud databases or auth providers (Firebase, Supabase, Auth0, AWS Cognito)
- Paid compute/storage (AWS S3/Lambda, GCP, Azure, paid VPS)
- Blockchain gas fees, NFT minting, crypto wallets, or paid SaaS APIs
- Paid Nostr relays (enforced pre-flight via NIP-11 and at runtime via `payment-required` auto-pause)
- Central Certificate Authorities or central CRL servers

Even if a vendor offers a "free tier" with credit-card metered overage risks, Certified Handmade avoids it so billing surprises cannot lock users out.

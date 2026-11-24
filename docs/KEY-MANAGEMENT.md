# Key Management & Cryptographic Custody (`KEY-MANAGEMENT.md`)

---

## 1. Key Hierarchy & Strict Cryptographic Separation

Certified Handmade maintains **three distinct key classes** per device/identity and enforces domain and byte-level isolation between them:

| Key Class | Curve / Algorithm | Scope | Storage Mechanism | Transmitted / Shared? |
| --- | --- | --- | --- | --- |
| **Owner / Author Identity Key** | Ed25519 (RFC 8032) | Signs artworks (`CHM1\\0`), evidence (`CHM-EVIDENCE1\\0`), notices (`CHM-NOTICE1\\0`), enrollment certs (`CHM-DEVICE-PAIRING-v1:CERT\\0`), revocations, and sync ops (`CHM-SYNC-v1:OP\\0`). | Non-extractable Web Crypto `CryptoKey` in IndexedDB (`authorKeys`), or PBKDF2-SHA256 (`600k` iter) + AES-256-GCM encrypted seed; `.chkey.json` offline backup. | **Never** shared with paired devices or relays. Public key (`32 B`) + SHA-256 fingerprint shared openly. |
| **Per-Device CHM Identity Key** | Ed25519 (RFC 8032) | Independent per-device keypair generated locally on PC/iPad/phone; signs `#pair-req=` requests (`CHM-DEVICE-PAIRING-v1:REQ\\0`) and device CHM attestations. | Non-extractable Web Crypto `CryptoKey` or passphrase AES-256-GCM seed in IndexedDB (`deviceIdentity`). | **Never** leaves its originating device. |
| **Per-Device Nostr Sync Key** | secp256k1 / BIP-340 Schnorr | Authenticates NIP-42 relay `AUTH`, signs NIP-59 seals/binding PoP, and encrypts/decrypts NIP-44 sync bundles. | IndexedDB `nostrKeys`: either AES-256-GCM wrapped by a non-extractable Web Crypto `CryptoKey` (`webcrypto-aesgcm-wrapped`, AAD-bound to `deviceIdHex:nostrPubkeyHex`) OR NIP-49 `ncryptsec1` passphrase encryption (`nip49-encrypted`). | **Never** transmitted to relays; **never** derived from or equal to Ed25519 keys. Ephemeral single-use wrap keys are generated per NIP-59 Gift Wrap and wiped. |

---

## 2. Explicit Prohibitions Enforced by Design

- **No Ed25519-to-secp256k1 Key Reuse:** `getOrCreateDeviceNostrKey` passes `[localDevice.publicKey, ...]` into `assertDistinctFromEd25519Secrets` and verifies `constantTimeEqual(nostrPub, localDevice.publicKey) === false`.
- **No Plaintext Private Keys in `localStorage`, URLs, Logs, or Exports:**
  - Encrypted/non-extractable custody uses IndexedDB only.
  - Peer cards (`chm-sync-bind:...`), Vault backups (`.chmvault.json`), public proof events (`kind 30078`), and exchange QR payloads (`#key=`, `#pair-req=`, `#pair-cert=`) contain **zero private keys**, enforced by runtime validators and automated E2E leak scanners (`assertNoPrivateKeyLeak`).
- **No Unconsented SNS Nostr Key Hijacking:** CHM never imports or signs with a user's external social Nostr `nsec` / NIP-07 extension key; Decentralized Sync uses a dedicated CHM-scoped device keypair.
- **No Weak CSPRNG / Custom Crypto:** Uses Web Crypto `crypto.getRandomValues` / `SubtleCrypto` plus audited `@noble/ed25519`, `@noble/curves`, `@noble/ciphers`, and `@noble/hashes`. Ephemeral buffers are zeroed via `wipeBytes()`.

---

## 3. Lifecycle Operations

- **Passphrase Strength:** `.chkey.json` and fallback encrypted keys require `>= 8` characters (`12+` recommended) with PBKDF2-HMAC-SHA256 (`600,000` iterations) + AES-256-GCM, or NIP-49 scrypt (`logN = 16` in production, `12` configurable for fast tests).
- **Backup Verification Without Mutation:** Users can verify `.chkey.json` backups against an unlock passphrase in `/keys` without overwriting active IndexedDB state.
- **Key Rotation & Compromise:**
  - If a **paired device** is lost/compromised, revoke only that `deviceIdHex` on the Owner device (`CHM-DEVICE-PAIRING-v1:REVOKE\\0` + Priority `0` sync op). Other devices continue seamlessly while revoked Nostr pubkeys are immediately excluded from all future Gift Wrap recipients.
  - If an **Author Root Key** is compromised, generate a new Author key and issue a dual-signed `CHM-NOTICE1` rotation notice (if old key is still held) or single-signed revocation notice, and distribute it offline/across devices.

# Certified Handmade Architecture (`ARCHITECTURE.md`)

**Status:** Implemented (`CHM1`/`CHM2` + `CHM-DEVICE-PAIRING-v1` + `CHM-SYNC-v1` + `CHM-VAULT-v1`)  
**Referenced Nostr NIPs Commit:** `nostr-protocol/nips` `@ bec0fc8`

---

## 1. Layered Design

Certified Handmade separates cryptographic trust from transport, storage, and UI across four strict layers:

| Layer | Responsibility | Key Modules | Relay Dependence |
| --- | --- | --- | --- |
| **Layer 1 — CHM Cryptographic Core** | Pure Ed25519 signing/verification, SHA-256 canonical RGBA8 pixel hashing (`CAR-v1`), deterministic RFC 8949 CBOR (`CHM1`, `CHM-EVIDENCE1`, `CHM-NOTICE1`, `CHM-CHALLENGE1`), QR burning/decoding, and offline verification. | `src/core/crypto/*`, `src/core/manifest/*`, `src/core/verify/*`, `tools/chm-verify/`, `tools/chm-verify.mjs` | **None (0%)** |
| **Layer 2 — CHM Device Identity** | Separation of Owner root Ed25519 identity from per-device Ed25519 keys, explicit 2-step QR enrollment (`CHM-DEVICE-PAIRING-v1`), anti-replay nonces, monotonic device revocation, and `@yomiplush/chm-exchange` core integration. | `@yomiplush/chm-exchange`, `src/core/storage/devicePairingStore.ts`, `src/core/sync/confirmationCode.ts` | **None (0%)** |
| **Layer 3 — CHM Sync & Proof Vault** | Pluggable `SyncTransport` interface (`NostrSyncTransport` implementation), strictly isolated per-device secp256k1 Nostr keys, NIP-44 + NIP-59 Gift Wrap transport encryption, NIP-11 zero-cost relay gating, 30-day rolling soft byte budget, priority queue, and compact local `CHM-VAULT-v1` storage. | `src/core/nostr/*`, `src/core/sync/*`, `src/core/vault/*` | **Optional (Opt-in only)** |
| **Layer 4 — Human-Friendly UI** | Progressive-disclosure React interface (`/`, `/create`, `/verify`, `/keys`, `/exchange`, `/devices`, `/vault`, `/docs`), 13 locales, offline-first PWA Service Worker, and Portable Standalone Go server (`127.0.0.1:43777`). | `src/pages/*`, `src/components/*`, `src/i18n/*`, `standalone/` | **Optional** |

---

## 2. Core Trust & Independence Invariants

1. **Zero Relay Authority:** Nostr relays (`NostrSyncTransport`) are untrusted, replaceable byte conduits. A relay outage, censorship event, paywall conversion, or malicious payload injection **cannot**:
   - Prevent local artwork signing (`/create`) or offline verification (`/verify`).
   - Forge an Owner revocation, device enrollment certificate, or `CHM-VAULT-v1` proof (all inner envelopes verify against Owner/Author Ed25519 signatures).
   - Escalate a paired device's permissions (`permissions` is restricted to `["device-identity"]` in v1).
2. **Protocol Exchangeability (`SyncTransport`):**
   - `src/core/sync/syncEngine.ts` depends on the transport abstraction interface (`SyncTransport` in `src/core/sync/types.ts`) rather than raw WebSocket logic. Future transports (e.g., direct LAN WebRTC or Tor/libp2p relays) can replace `NostrSyncTransport` without changing Layer 1 (`CHM1`/`CHM2`) or Layer 2 (`CHM-DEVICE-PAIRING-v1`).
3. **Host vs. Protocol Split (`CHM-Exchange`):**
   - Authoritative protocol primitives for `#key=` public-key exchange, `CHM-DEVICE-PAIRING-v1` CBOR codecs, and confirmation code derivation reside in [`CHM-Exchange`](https://github.com/yomiplush/CHM-Exchange).
   - Host private-key custody (Web Crypto non-extractable `CryptoKey` + IndexedDB), artwork signing, Nostr encrypted sync, Proof Vault, PWA, and Standalone launcher reside in `hand-drawing-art-DRM-Toolkit`.

---

## 3. Data Flow Overview

1. **Signing & Vault Recording (Local Only):**
   - `/create` computes canonical RGBA8 `SHA-256`, signs deterministic CBOR (`CHM1\\0`) with the Author Ed25519 key, burns QR onto lossless PNG, and appends the compact signed proof (`~1 KiB`, zero pixels, zero private keys) to local `IndexedDB` (`proofVault`).
2. **Device Enrollment (Offline First):**
   - New device generates an independent local Ed25519 keypair + signed `#pair-req=`.
   - Owner inspects request + out-of-band confirmation code, approves explicitly, and returns `#pair-cert=` (optionally appending `&sync-bind=` when Decentralized Sync is active).
3. **Decentralized Multi-Device Sync (Opt-In Only):**
   - Inactive until the user explicitly accepts consent in `/devices`.
   - Device-to-device Nostr envelopes use strictly separate per-device `secp256k1` keys, encrypted via NIP-44 and wrapped with NIP-59 ephemeral single-use keys (`kind 1059`) addressed only to active non-revoked peers.
   - Received payloads are verified against Owner Ed25519 signatures (`CHM-SYNC-v1:OP\\0`) and primary proof signatures (`CHM1\\0`) before any local state or Vault record is accepted.
4. **Graceful Degradation:**
   - If the device is offline, relays turn paid/unreachable, or the 30-day soft online sync budget (`1 MiB`) is reached for bulk Vault proofs, the app stays 100% usable locally and directs users to offline `.chkey.json` / `.chdevreg.{json,cbor}` / `.chmvault.{json,enc.json}` portable bundles in `/vault` and `/devices`.

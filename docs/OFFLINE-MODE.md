# 100% Offline-First Operation (`OFFLINE-MODE.md`)

Certified Handmade guarantees full core functionality with **zero internet connection**—including if every Nostr relay on earth goes offline or becomes paid.

---

## 1. Offline Parity Matrix

| Capability | Offline Web/PWA | Portable Standalone (`127.0.0.1:43777`) | Independent CLIs (`tools/`) | Online Relays Needed? |
| --- | --- | --- | --- | --- |
| Generate Author Ed25519 Key (`/keys`) | Yes | Yes | N/A | **No** |
| Export/Verify/Restore `.chkey.json` | Yes | Yes | N/A | **No** |
| Sign Artwork PNG + QR (`v1` & `v2`) (`/create`) | Yes | Yes | N/A | **No** |
| Generate `.chmevidence` + Stream Local WIP Hashes | Yes | Yes | N/A | **No** |
| Verify Proof, PNG Pixels & `.chmevidence` (`Mode A/B/C`) | Yes | Yes | Yes (`chm-verify`, `chm-verify.mjs`) | **No** |
| Local Proof Vault Search, Manage & Export (`/vault`) | Yes | Yes | N/A | **No** |
| Offline Key Exchange & Pairing (`/exchange`, `/devices`) | Yes | Yes | N/A | **No** |
| Issue & Verify `CHM-NOTICE1` Revocation / Rotation | Yes | Yes | Yes | **No** |
| Transfer Vault Backups via USB / AirDrop / File | Yes | Yes | N/A | **No** |
| Incremental Multi-Device Relay Sync (`/devices`) | Deferred cleanly | Deferred cleanly | N/A | Optional (`wss://`) |
| Optional Public Proof Search (`kind 30078`) (`/vault`) | Unavailable when offline | Unavailable when offline | N/A | Optional (`wss://`) |

---

## 2. Offline Fallback Workflow

1. Every artwork signed in `/create` automatically records into local IndexedDB `proofVault` with zero network I/O.
2. Users can inspect, search, filter, delete, and export **all proofs** at any time on `/vault` as `.chmvault.json` or encrypted `.chmvault.enc.json` (AES-256-GCM + PBKDF2-SHA256).
3. Paired devices and revocations export offline via `.chdevreg.json` / `.chdevreg.cbor` and `#pair-req=` / `#pair-cert=` QR codes on `/devices`.
4. Outbox envelopes queued while offline remain safely persisted in IndexedDB `syncOutbox` and flush automatically by priority once connectivity returns.

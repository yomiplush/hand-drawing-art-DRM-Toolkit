# Offline & Decentralized Recovery Guide (`RECOVERY.md`)

Certified Handmade is local-first: users **never** lose permanent access to their identity or artwork proofs if a Nostr relay disappears, blocks traffic, or converts to a paid plan.

---

## 1. Recovery Scenarios & Playbooks

### Scenario A — Lost or Stolen Secondary Device (iPad / Phone / Secondary PC)
1. On your **Owner Root Device**, open **`/devices`** -> **Registered Devices**.
2. Click **Revoke Device** (`revokePairedDevice`) for the lost device and choose a reason (`lost-device` / `device-compromised`).
3. If **Decentralized Sync** is enabled:
   - The revocation emits a **Priority `0`** `revoke-device` operation.
   - Priority `0` operations bypass the 30-day soft data cap (`1 MiB`) and broadcast immediately to all remaining trusted devices—excluding the lost device's Nostr pubkey from all Gift Wrap recipients.
4. If offline or relays are unreachable:
   - Export the signed `.chdevreg.json` / `.chdevreg.cbor` device registry snapshot or `chm-pair-rev:` token from `/devices` and import it manually onto your other devices.

### Scenario B — Browser Data Cleared / Hardware Failure / Moving Web <-> Standalone
Because browsers isolate `IndexedDB` per origin (`https://certified-handmade.com` vs `http://127.0.0.1:43777`) and may evict site data under low-disk pressure:
1. **Before loss (Preventive Backups):**
   - Export your encrypted Author identity backup (`.chkey.json`, PBKDF2-SHA256 `600k` iter + AES-256-GCM) in **`/keys`** and verify it with **Verify Backup Only**.
   - Export your Proof Vault backup (`.chmvault.json` or AES-256-GCM passphrase-encrypted `.chmvault.enc.json`) in **`/vault`**.
   - Optionally export `.chdevreg.json` in **`/devices`**.
2. **Restoring onto a Fresh Browser or Portable Standalone Edition:**
   - Import `.chkey.json` in `/keys` with your passphrase.
   - Import `.chmvault.json` (or `.chmvault.enc.json`) in `/vault` (or re-pair/sync selected proofs from a surviving paired device). Every restored record is re-verified with Ed25519 before saving.
   - Import `.chdevreg.json` in `/devices` (monotonically preserving revocations).

### Scenario C — Owner Author Key Compromised
1. Immediately generate a replacement Author Ed25519 key in **`/keys`**.
2. Generate a signed `CHM-NOTICE1` revocation notice (or dual-signed rotation notice if old seed is still trusted temporarily to sign rotation) -> save `.chnotice.json` / `chm-notice:`.
3. Publish/share your new Author fingerprint (`CHM-XXXX-...`) out-of-band on your artist bio/website and import `.chnotice.json` on verifiers.
4. Historical proofs signed before compromise still verify mathematically alongside the local notice warning (see `SECURITY.md`).

### Scenario D — Relays Go Paid or Unreachable
- Signing (`/create`), Verification (`/verify`), Local Vault (`/vault`), Key Management (`/keys`), and Offline Pairing (`/devices`) continue working **100% unchanged**.
- Remove paid/dead relays in `/devices`, add any free `wss://` community relay (verified automatically via NIP-11), or transfer `.chmvault.{json,enc.json}` & `.chdevreg.json` offline.

# Zero-Cost Relay Policy & NIP-11 Enforcement (`RELAY-POLICY.md`)

---

## 1. Relay Neutrality & Consent Principles

1. **Zero Relays Contacted by Default:** `createDefaultSyncSettings()` starts with `enabled: false`, `consentAccepted: false`, and `relays: []`. No default relay is queried or opened until the user explicitly enables Decentralized Sync in **`/devices`**.
2. **Untrusted Conduits Only:** Community public relays have no SLA, no guaranteed retention, and no authority over CHM proofs or devices.
3. **Optional Presets (`CURATED_DEFAULT_RELAY_PRESETS`):**
   - `wss://relay.damus.io` (enabled once user consents)
   - `wss://nos.lol` (enabled once user consents)
   - `wss://relay.nostr.band` (disabled optional backup preset)
   Users may remove all presets and use their own community or self-hosted `wss://` relays at any time.

---

## 2. Automated Pre-Flight NIP-11 Screening (`src/core/nostr/nip11.ts`)

Before saving a newly added relay (`addRelayConfig`) or when clicking **Check Free Policy** (`probeAndSaveRelayPolicy`), Certified Handmade fetches the relay's NIP-11 JSON document (`Accept: application/nostr+json`) over HTTPS and runs `evaluateNip11FreeRelayPolicy`:

| Condition in NIP-11 Document | Resulting `RelayPolicyStatus` | Zero-Cost Action |
| --- | --- | --- |
| `limitation.payment_required === true` | `payment-required` | **Rejected** on add (`autoRejectPaidRelays: true`); disabled automatically if probed later |
| Non-empty `payments_url` or positive `fees.admission` / `fees.subscription` / `fees.publication` | `payment-required` | **Rejected** automatically |
| `limitation.restricted_writes === true` | `write-restricted` | Flagged in UI so user knows writes may fail without whitelist |
| `limitation.min_pow_difficulty > 0` | `pow-required` | Flagged in UI (high client CPU/battery cost warned) |
| No payment requirement & writes open | `free-usable` | Allowed (`usableForZeroCost: true`) |
| HTTP/CORS failure on NIP-11 | `unreachable` | Allowed only if `skipNip11Check` / explicit fallback; runtime rejection guard remains active |

- All non-test relay URLs must use **`wss://`** without embedded credentials (`validateRelayUrl`). Loopback `ws://127.0.0.1` is restricted strictly to automated tests (`allowInsecureLocalWsForTest`).

---

## 3. Runtime Paywall & Quota Protection (`classifyRelayRejection`)

Even if a relay starts free and later switches to paid/restricted rules:
- Every `OK` / `CLOSED` / `NOTICE` WebSocket frame is classified by `classifyRelayRejection` (`src/core/sync/relayManager.ts`).
- If a relay responds with `payment-required`:
  - `persistRelayFeedbackAndUsage` immediately sets `policyStatus = 'payment-required'` and `enabled = false` in IndexedDB `syncSettings`.
  - No automatic invoice payment, redirect, or Lightning prompt is ever triggered.
- If a relay responds with `quota-exceeded` or `restricted`:
  - The relay's `policyStatus` is updated and surfaced in `/devices` alongside a non-alarming fallback banner guiding the user to offline Vault backups (`/vault`).

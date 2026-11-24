# CHM Sync & Nostr Protocol Specification (`CHM-SYNC-PROTOCOL.md`)

**Sync Protocol:** `CHM-SYNC-v1`  
**Public Index Protocol (Opt-In):** `CHM-PUBLIC-PROOF-v1`  
**Official Nostr NIP Reference Commit:** [`nostr-protocol/nips@bec0fc8`](https://github.com/nostr-protocol/nips/commit/bec0fc8)

---

## 1. Adopted NIPs & Deliberate Exclusions

| NIP | Role in Certified Handmade | Module |
| --- | --- | --- |
| **NIP-01** | Basic event model, SHA-256 `id` commitment, BIP-340 Schnorr signature generation/verification. | `src/core/nostr/nip01.ts`, `secp256k1.ts` |
| **NIP-09** | `kind 5` deletion requests (`createNip09DeletionRequestEvent`, `verifyNip09DeletionRequest`) to request pruning of superseded relay events (best-effort; never relied upon for security revocation). | `src/core/nostr/nip09.ts` |
| **NIP-11** | Relay Information Document HTTP/JSON pre-flight check (`Accept: application/nostr+json`) enforcing `usableForZeroCost` before saving/probing relays. | `src/core/nostr/nip11.ts` |
| **NIP-42** | Relay `AUTH` challenge-response (`kind 22242`) scoped strictly to relay URL + challenge string using the device's dedicated Nostr secp256k1 key. | `src/core/nostr/nip42.ts`, `src/core/sync/relayManager.ts` |
| **NIP-44** | Versioned (`v2`) ChaCha20 + HMAC-SHA256 padded authenticated encryption for sync payloads and NIP-59 seals/wraps. | `src/core/nostr/nip44.ts` |
| **NIP-49** | `ncryptsec1` passphrase-encrypted Nostr private key storage/backup (XChaCha20-Poly1305 + scrypt) when Web Crypto AES-GCM wrapping is unavailable or exported. | `src/core/nostr/nip49.ts`, `nostrKeyStore.ts` |
| **NIP-59** | Rumor (`kind 13` / inner) -> Seal -> Ephemeral Gift Wrap (`kind 1059`) protecting sender identity and metadata from relays (`wrapRumorForRecipient`, `unwrapGiftWrapEvent`). | `src/core/nostr/nip59.ts` |
| **NIP-65** | `kind 10002` relay preference list helper (`createNip65RelayListEvent`, `parseNip65RelayListEvent`) bounded to `<= 8` `wss://` relays. | `src/core/nostr/nip65.ts` |
| **NIP-78** | Optional opt-in `kind 30078` application-specific replaceable events (`d = chm-proof:<id>`, `t = certified-handmade-proof`, `chm_author = <fp>`) carrying **only public `CHM1` proof tokens** (`CHM-PUBLIC-PROOF-v1`), never private data or artwork pixels. | `src/core/vault/publicIndex.ts` |
| **Excluded: NIP-04** | Explicitly **NOT implemented** and forbidden due to known cryptographic weaknesses (non-authenticated AES-CBC, unpadded length leaks, deprecated status). | — |

---

## 2. `CHM-SYNC-v1` Cryptographic Attestations & Operations

Nostr transport keys **never** carry CHM authority on their own. Authority flows strictly from CHM Ed25519 signatures:

### 2.1 Peer Nostr-to-CHM Binding Attestation (`CHM-SYNC-v1:BIND\0`)
- Token prefix: `chm-sync-bind:` (`MAX_BINDING_CBOR_BYTES = 2048`).
- Dual proof-of-possession:
  1. Signed by the CHM Owner key (or enrolled local Device Ed25519 key) over `"CHM-SYNC-v1:BIND\0" || payloadBytes`.
  2. Signed by the device's Nostr secp256k1 private key (BIP-340 Schnorr) over `SHA-256("CHM-SYNC-v1:NOSTR-POP\0" || canonicalPayloadBytes)`.
- Verifies that the Nostr pubkey `npub...` legitimately speaks for CHM `deviceId` without exposing any secret key or trusting the relay.

### 2.2 Hash-Chained Sync Operations (`CHM-SYNC-v1:OP\0`)
- Monotonic sequence starting at `1`, with `prevOpHash` pointing to the SHA-256 of the preceding canonical operation envelope (`ZERO_HASH_BYTES_32` for sequence `1`, `MAX_SYNC_OP_CBOR_BYTES = 65536`).
- Operation kinds (`SYNC_OP_CODE_MAP`):
  - `1`: `enroll-device` (carries `SignedEnrollmentCertificate` + optional `SignedDeviceRegistrySnapshot`)
  - `2`: `revoke-device` (carries `SignedDeviceRevocationNotice` + optional snapshot)
  - `3`: `authorize-sync-device` (carries `DecodedBindingAttestation`)
  - `4`: `checkpoint` (carries monotonic signed registry snapshot)
- `resolveDeterministicSyncState` detects causal gaps (`missingSequences`), invalid Owner signatures, or sequence forks without trusting arrival order from relays.

---

## 3. NIP-59 Encrypted Rumor Payload & Priority Queue

### 3.1 Inner Rumor JSON (`MAX_SYNC_RUMOR_JSON_CHARS = 65536`)
Encoded inside NIP-44 + NIP-59 Gift Wrap (`kind 1059`):
```json
{
  "protocol": "CHM-SYNC-v1",
  "payloadKind": "sync-bundle",
  "opsBase64Url": ["..."],
  "bindingsBase64Url": ["..."],
  "vaultProofs": [
    {
      "proofBase64Url": "...",
      "creationMethod": "hand-drawn-no-ai",
      "createdAt": "2026-11-24T00:00:00.000Z"
    }
  ],
  "profileSnapshot": { "...": "optional creator defaults (<= 12 links)" },
  "trustedArtists": [{ "publicKeyBase64Url": "...", "label": "...", "verificationState": "confirmed" }]
}
```
- Bounded at `MAX_SYNC_BUNDLE_ITEMS = 64` ops/bindings and `MAX_VAULT_PROOFS_PER_BUNDLE = 24` proofs per bundle (`syncSelectedVaultProofs` batches in chunks of `16`).
- **Zero artwork pixels, WIP files, or private keys** are ever included.
- Prototype-pollution (`__proto__`, `constructor`, `prototype`) and oversized strings are rejected in `decodeAndVerifySyncRumorPayload`.

### 3.2 Outbox Priority Queue (`SyncPriority`)
- **Priority `0` (Security Critical):** `revoke-device` — bypasses the 1 MiB 30-day soft sync budget; flushed before all other messages.
- **Priority `1` (Identity Core):** `enroll-device`, `authorize-sync-device`, `checkpoint`, binding announcements — bypasses soft budget so pairing consistency is preserved.
- **Priority `2` (Selected Proof Metadata Sync):** `CHM-VAULT-v1` proof bundles + profile/trusted keys — subject to the 30-day soft cap (`1 MiB` default); cleanly deferred (`budgetDeferredCount`) if exceeded.
- **Priority `3` (Background / Bulk):** Low-priority metadata sync, deferred under budget limits.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bytesToHex, hexToBytes } from '../../src/core/crypto/sha256';
import {
  NOSTR_WRAPPING_KEY_RECORD_ID,
  deleteDeviceNostrKey,
  deriveNostrPublicKeyHex,
  encodeBech32,
  encryptNip49PrivateKey,
  exportDeviceNostrBackupNcryptsec,
  getDeviceNostrKeyRecord,
  getOrCreateDeviceNostrKey,
  importDeviceNostrBackupNcryptsec,
  withUnlockedDeviceNostrSecret,
} from '../../src/core/nostr';
import { STORE_NOSTR_KEYS } from '../../src/core/storage/keyStore';
import { InMemoryIdbBackend, createInMemoryIndexedDb } from '../helpers/inMemoryIndexedDb';

describe('Nostr device key custody store', () => {
  const originalIdb = globalThis.indexedDB;
  let backend: InMemoryIdbBackend;

  beforeEach(() => {
    backend = new InMemoryIdbBackend();
    const { factory } = createInMemoryIndexedDb(backend);
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      writable: true,
      value: factory,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      writable: true,
      value: originalIdb,
    });
  });

  it('wraps device Nostr secret key non-extractably without storing plaintext nsec or raw scalar in IDB', async () => {
    const devId = 'aaaaaaaa111142228333444444444444';
    const fakeEd25519Pub = crypto.getRandomValues(new Uint8Array(32));
    const rec = await getOrCreateDeviceNostrKey({
      deviceIdHex: devId,
      disallowedEd25519Bytes: [fakeEd25519Pub],
      passphraseIfFallback: 'test-fallback-pass-1234',
      nip49LogN: 12,
    });

    expect(rec.deviceIdHex).toBe(devId);
    expect(rec.npub.startsWith('npub1')).toBe(true);
    expect(rec.nostrPubkeyHex).toHaveLength(64);
    expect(rec.nostrPubkeyHex).not.toBe(bytesToHex(fakeEd25519Pub));

    // Unlock briefly and verify derived public key + zero-wipe after callback exits
    let leakedSliceRef: Uint8Array | null = null;
    const derivedPub = await withUnlockedDeviceNostrSecret(
      { deviceIdHex: devId, passphraseIfFallback: 'test-fallback-pass-1234' },
      (sec) => {
        leakedSliceRef = sec;
        return deriveNostrPublicKeyHex(sec);
      },
    );
    expect(derivedPub).toBe(rec.nostrPubkeyHex);
    expect(leakedSliceRef!.every((b) => b === 0)).toBe(true);

    // Inspect raw IndexedDB backing store directly: MUST NOT contain plaintext nsec1 or raw 32-byte scalar
    const rawStore = backend.stores.get(STORE_NOSTR_KEYS)!;
    const rawEntry = JSON.stringify(rawStore.rows.get(devId));
    expect(rawEntry).not.toContain('nsec1');
    if (rec.storageMode === 'webcrypto-aesgcm-wrapped') {
      expect(rec.wrappedSecret?.ciphertextBase64Url).toBeTruthy();
      const wrapRecord = rawStore.rows.get(NOSTR_WRAPPING_KEY_RECORD_ID) as { wrappingKey?: CryptoKey };
      expect(wrapRecord?.wrappingKey?.extractable).toBe(false);
    }

    // Export NIP-49 ncryptsec backup and re-import into a second device slot
    const exported = await exportDeviceNostrBackupNcryptsec({
      deviceIdHex: devId,
      backupPassword: 'backup-strong-password',
      unlockPassphraseIfFallback: 'test-fallback-pass-1234',
      logN: 12,
    });
    expect(exported.ncryptsec.startsWith('ncryptsec1')).toBe(true);
    expect(exported.npub).toBe(rec.npub);

    const devId2 = 'bbbbbbbb111142228333444444444444';
    const imported = await importDeviceNostrBackupNcryptsec({
      deviceIdHex: devId2,
      ncryptsec: exported.ncryptsec,
      backupPassword: 'backup-strong-password',
      nip49LogN: 12,
    });
    expect(imported.nostrPubkeyHex).toBe(rec.nostrPubkeyHex);

    await deleteDeviceNostrKey(devId);
    expect(await getDeviceNostrKeyRecord(devId)).toBeNull();
  });

  it('rejects importing a Nostr secret that matches an existing Ed25519 scalar', async () => {
    const devId = 'cccccccc111142228333444444444444';
    const edSeed = hexToBytes('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60');
    const badNcrypt = await encryptNip49PrivateKey({
      secretKey: edSeed,
      password: 'pass-test-reuse',
      logN: 12,
    });
    expect(encodeBech32('npub', edSeed).startsWith('npub1')).toBe(true);

    await expect(
      importDeviceNostrBackupNcryptsec({
        deviceIdHex: devId,
        ncryptsec: badNcrypt,
        backupPassword: 'pass-test-reuse',
        disallowedEd25519Bytes: [edSeed],
        nip49LogN: 12,
      }),
    ).rejects.toThrow(/key separation violation/i);
  });
});

// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  assertVaultPassphraseValid,
  createUnlockedVaultKeyring,
  decryptVaultRecordJson,
  encryptVaultRecordJson,
  exportCrossDeviceVaultKeyShare,
  importCrossDeviceVaultKeyShare,
  rotateVaultKeyringEpoch,
  unwrapVaultKeyringWithPassphrase,
  wrapVaultKeyringWithPassphrase,
} from '../../src/core/vault/vaultCrypto';

const TEST_ITERATIONS = 100_000;

describe('Vault Client-Side AEAD Crypto, HKDF Subkey Separation & Key Epochs', () => {
  it('rejects weak passphrases and refuses reuse of Nostr nsec or CHM key backup strings', () => {
    expect(() => assertVaultPassphraseValid('short')).toThrow();
    expect(() =>
      assertVaultPassphraseValid('nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq2s9f0v'),
    ).toThrow(/Nostr nsec/);
    expect(() => assertVaultPassphraseValid('chm-key-backup-v1-secret')).toThrow(/key backup/);
    expect(() => assertVaultPassphraseValid('my-dedicated-vault-passphrase')).not.toThrow();
  });

  it('wraps and unwraps a Vault keyring with AES-256-GCM + AAD tamper detection', async () => {
    const keyring = createUnlockedVaultKeyring('vault-test-01');
    const wrapped = await wrapVaultKeyringWithPassphrase({
      keyring,
      passphrase: 'correct-horse-battery-staple',
      iterations: TEST_ITERATIONS,
    });

    const unwrapped = await unwrapVaultKeyringWithPassphrase({
      envelope: wrapped,
      passphrase: 'correct-horse-battery-staple',
    });
    expect(unwrapped.vaultId).toBe('vault-test-01');
    expect(unwrapped.currentEpoch).toBe(1);
    expect(unwrapped.epochs[1]).toEqual(keyring.epochs[1]);

    await expect(
      unwrapVaultKeyringWithPassphrase({
        envelope: wrapped,
        passphrase: 'wrong-passphrase-value',
      }),
    ).rejects.toThrow();

    await expect(
      unwrapVaultKeyringWithPassphrase({
        envelope: { ...wrapped, vaultId: 'vault-tampered' },
        passphrase: 'correct-horse-battery-staple',
      }),
    ).rejects.toThrow();
  });

  it('enforces HKDF purpose separation and detects ciphertext/AAD tampering', async () => {
    const keyring = createUnlockedVaultKeyring('vault-domain-sep');
    const env = await encryptVaultRecordJson({
      keyring,
      purpose: 'proofs',
      recordId: 'chunk-abc',
      payload: { secretTitle: 'Hidden Title' },
    });

    const ok = await decryptVaultRecordJson<{ secretTitle: string }>({
      keyring,
      envelope: env,
      expectedPurpose: 'proofs',
      expectedRecordId: 'chunk-abc',
    });
    expect(ok.secretTitle).toBe('Hidden Title');

    // Cross-purpose decryption MUST fail
    await expect(
      decryptVaultRecordJson({
        keyring,
        envelope: env,
        expectedPurpose: 'profiles',
        expectedRecordId: 'chunk-abc',
      }),
    ).rejects.toThrow(/Purpose mismatch/);

    // Even if someone tampers with envelope.purpose to match expectedPurpose, AAD & HKDF fail
    await expect(
      decryptVaultRecordJson({
        keyring,
        envelope: { ...env, purpose: 'profiles' },
        expectedPurpose: 'profiles',
        expectedRecordId: 'chunk-abc',
      }),
    ).rejects.toThrow();

    // Tampering contentHash or ciphertext fails AEAD authentication
    await expect(
      decryptVaultRecordJson({
        keyring,
        envelope: { ...env, contentHash: '0'.repeat(64) },
        expectedPurpose: 'proofs',
      }),
    ).rejects.toThrow();
  });

  it('rotates Vault key epochs cleanly while preserving decryption of previous epoch records', async () => {
    const keyring1 = createUnlockedVaultKeyring('vault-epochs');
    const recEpoch1 = await encryptVaultRecordJson({
      keyring: keyring1,
      purpose: 'proofs',
      recordId: 'chunk-e1',
      payload: ['proof-1'],
    });

    const keyring2 = rotateVaultKeyringEpoch(keyring1);
    expect(keyring2.currentEpoch).toBe(2);
    expect(keyring2.epochs[2]).not.toEqual(keyring2.epochs[1]);

    const recEpoch2 = await encryptVaultRecordJson({
      keyring: keyring2,
      purpose: 'proofs',
      recordId: 'chunk-e2',
      payload: ['proof-2'],
    });
    expect(recEpoch2.epoch).toBe(2);

    // Rotated keyring decrypts both epoch 1 and epoch 2
    expect(
      await decryptVaultRecordJson({
        keyring: keyring2,
        envelope: recEpoch1,
        expectedPurpose: 'proofs',
      }),
    ).toEqual(['proof-1']);
    expect(
      await decryptVaultRecordJson({
        keyring: keyring2,
        envelope: recEpoch2,
        expectedPurpose: 'proofs',
      }),
    ).toEqual(['proof-2']);

    // Old epoch-1 keyring CANNOT decrypt new epoch-2 records
    await expect(
      decryptVaultRecordJson({
        keyring: keyring1,
        envelope: recEpoch2,
        expectedPurpose: 'proofs',
      }),
    ).rejects.toThrow(/epoch 2/i);
  });

  it('exports and imports encrypted cross-device Vault key shares', async () => {
    const keyring = createUnlockedVaultKeyring('vault-share-1');
    const share = await exportCrossDeviceVaultKeyShare({
      keyring,
      transferPassphrase: 'one-time-transfer-pass',
      iterations: TEST_ITERATIONS,
    });

    await expect(
      importCrossDeviceVaultKeyShare({
        envelope: share,
        transferPassphrase: 'wrong-transfer-pass',
      }),
    ).rejects.toThrow();

    const imported = await importCrossDeviceVaultKeyShare({
      envelope: share,
      transferPassphrase: 'one-time-transfer-pass',
    });
    expect(imported.vaultId).toBe(keyring.vaultId);
    expect(imported.epochs[1]).toEqual(keyring.epochs[1]);
  });
});

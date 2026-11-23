import { describe, expect, it, vi } from 'vitest';
import {
  base64UrlEncode,
  computePublicKeyFingerprintSync,
  hexToBytes,
} from '@yomiplush/chm-exchange/core';
import {
  derivePublicKeyFromSeed,
  isValidStrictEd25519PublicKey,
  signWithSeed,
  verifyEd25519Signature,
} from '../../src/core/crypto/ed25519';
import { SUPPORTED_LOCALES } from '../../src/core/storage/consent';
import { DEVICE_PAIRING_I18N } from '../../src/i18n/devicePairing';

const hoisted = vi.hoisted(() => ({
  ownerSeedHex: '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60',
  deviceSeedHex: '4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb',
}));

vi.mock('../../src/core/storage/devicePairingStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/storage/devicePairingStore')>();
  const {
    base64UrlEncode: b64u,
    computePublicKeyFingerprintSync: computeFp,
    hexToBytes: fromHex,
  } = await import('@yomiplush/chm-exchange/core');
  const { derivePublicKeyFromSeed: pubFromSeed } = await import('../../src/core/crypto/ed25519');

  const ownerPub = pubFromSeed(fromHex(hoisted.ownerSeedHex));
  const ownerFp = computeFp(ownerPub);
  const devicePub = pubFromSeed(fromHex(hoisted.deviceSeedHex));
  const deviceFp = computeFp(devicePub);

  const mockDeviceRecord = {
    deviceIdHex: '11111111222243338444555555555555',
    deviceIdBytes: fromHex('11111111222243338444555555555555'),
    deviceName: 'YomiPlush Studio PC',
    publicKey: devicePub,
    publicKeyBase64Url: b64u(devicePub),
    fingerprintHex: deviceFp.fullHex,
    fingerprintShort: deviceFp.shortDisplay,
    storageMode: 'noble-encrypted-seed' as const,
    webCryptoPrivateKey: { type: 'private', extractable: false } as unknown as CryptoKey,
    encryptedBackup: {
      format: 'certified-handmade-key-backup' as const,
      version: 1 as const,
      kdf: 'PBKDF2-SHA256' as const,
      iterations: 600000,
      cipher: 'AES-256-GCM' as const,
      salt: 'AAAA',
      iv: 'BBBB',
      ciphertext: 'SECRET_DEVICE_SEED',
      publicKey: b64u(devicePub),
      fingerprint: deviceFp.fullHex,
      label: 'YomiPlush Studio PC',
      createdAt: '2026-11-23T00:00:00.000Z',
    },
    revokedLocally: false,
    createdAt: '2026-11-23T00:00:00.000Z',
  };

  const mockPairedEntry = {
    key: `${ownerFp.fullHex}:11111111222243338444555555555555`,
    ownerFingerprintHex: ownerFp.fullHex,
    ownerFingerprintShort: ownerFp.shortDisplay,
    ownerPublicKeyBase64Url: b64u(ownerPub),
    ownerDisplayName: 'YomiPlush',
    deviceIdHex: '11111111222243338444555555555555',
    devicePublicKeyBase64Url: b64u(devicePub),
    deviceFingerprintHex: deviceFp.fullHex,
    deviceFingerprintShort: deviceFp.shortDisplay,
    deviceName: 'iPhone',
    permissions: ['device-identity'] as ['device-identity'],
    issuedAt: 1795352786,
    enrollmentToken: 'chm-pair-cert:mock',
    localVerificationStatus: 'active-trusted' as const,
  };

  return {
    ...actual,
    getLocalDeviceIdentity: vi.fn(async () => ({
      device: mockDeviceRecord,
      corruptionWarnings: [],
    })),
    loadDevicePairingState: vi.fn(async () => ({
      localDevice: mockDeviceRecord,
      pendingSessions: [],
      pairedDevices: [mockPairedEntry],
      revocations: [],
      corruptionWarnings: [],
    })),
  };
});

describe('Strict Ed25519 public key checks & device pairing host integration', () => {
  it('rejects all-zero and small-order Ed25519 public keys while verifying valid signatures', async () => {
    const allZero = new Uint8Array(32);
    expect(isValidStrictEd25519PublicKey(allZero)).toBe(false);

    // Ed25519 identity point (1, y=1 -> encoding 0x01 followed by 31 zero bytes) is small-order
    const identityPoint = new Uint8Array(32);
    identityPoint[0] = 0x01;
    expect(isValidStrictEd25519PublicKey(identityPoint)).toBe(false);

    // Order-2 point (0, -1) -> 0xecff...ff7f
    const order2Point = hexToBytes('ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f');
    expect(isValidStrictEd25519PublicKey(order2Point)).toBe(false);

    const seed = hexToBytes(hoisted.ownerSeedHex);
    const validPub = derivePublicKeyFromSeed(seed);
    expect(isValidStrictEd25519PublicKey(validPub)).toBe(true);

    const msg = new TextEncoder().encode('CHM-DEVICE-PAIRING-v1-test');
    const sig = signWithSeed(seed, msg);
    expect(await verifyEd25519Signature(validPub, msg, sig)).toBe(true);
    expect(await verifyEd25519Signature(allZero, msg, sig)).toBe(false);
    expect(await verifyEd25519Signature(identityPoint, msg, sig)).toBe(false);
    expect(await verifyEd25519Signature(order2Point, msg, sig)).toBe(false);
  });

  it('strips all private key fields from getLocalDeviceIdentity and listPairedDevices in hostAdapter', async () => {
    const { createCertifiedHandmadeExchangeAdapter } = await import(
      '../../src/core/exchange/hostAdapter'
    );
    const adapter = createCertifiedHandmadeExchangeAdapter();

    const local = (await adapter.getLocalDeviceIdentity?.()) as unknown as Record<string, unknown>;
    expect(local).toBeTruthy();
    expect(Object.keys(local).sort()).toEqual([
      'createdAt',
      'deviceIdHex',
      'deviceName',
      'fingerprintHex',
      'fingerprintShort',
      'publicKeyBase64Url',
      'storageMode',
    ]);
    expect(local.webCryptoPrivateKey).toBeUndefined();
    expect(local.encryptedBackup).toBeUndefined();
    expect(local.seed32).toBeUndefined();

    const paired = (await adapter.listPairedDevices?.()) as unknown as Record<string, unknown>[];
    expect(paired).toHaveLength(1);
    expect(paired[0].webCryptoPrivateKey).toBeUndefined();
    expect(paired[0].encryptedBackup).toBeUndefined();
    expect(paired[0].deviceName).toBe('iPhone');

    const ownerPub = derivePublicKeyFromSeed(hexToBytes(hoisted.ownerSeedHex));
    const ownerFp = computePublicKeyFingerprintSync(ownerPub);
    expect(base64UrlEncode(ownerPub).length).toBe(43);
    const filtered = await adapter.listPairedDevices?.(ownerFp.fullHex);
    expect(filtered).toHaveLength(1);
    const empty = await adapter.listPairedDevices?.('0'.repeat(64));
    expect(empty).toHaveLength(0);
  });

  it('provides localized device pairing copy across all 13 supported locales', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const copy = DEVICE_PAIRING_I18N[locale];
      expect(copy.navItem.trim().length).toBeGreaterThan(2);
      expect(copy.title.trim().length).toBeGreaterThan(5);
      expect(copy.helpPoints).toHaveLength(4);
      expect(copy.offlineSyncWarning.trim().length).toBeGreaterThan(20);
      if (locale !== 'en') {
        expect(copy.navItem).not.toBe(DEVICE_PAIRING_I18N.en.navItem);
      }
    }
    expect(DEVICE_PAIRING_I18N.ja.title).not.toBe(DEVICE_PAIRING_I18N.en.title);
    expect(DEVICE_PAIRING_I18N.ja.confirmDialogTitleSuffix).toContain('登録しますか？');
  });
});

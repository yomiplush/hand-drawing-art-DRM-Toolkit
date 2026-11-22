import { describe, expect, it, vi } from 'vitest';
import {
  base64UrlEncode,
  computePublicKeyFingerprintSync,
  createPublicKeyBundle,
  encodeExchangeUrl,
  hexToBytes,
  parsePublicKeyExchangeInput,
} from '@yomiplush/chm-exchange/core';
import { buildPublicKeyExportBundle } from '../../src/core/storage/keyStore';

const hoisted = vi.hoisted(() => ({
  pubHex: 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a',
}));

const PUB_BYTES = hexToBytes(hoisted.pubHex);
const PUB_B64 = base64UrlEncode(PUB_BYTES);
const FP = computePublicKeyFingerprintSync(PUB_BYTES);

vi.mock('../../src/core/storage/keyStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/storage/keyStore')>();
  const {
    base64UrlEncode: b64u,
    computePublicKeyFingerprintSync: computeFp,
    hexToBytes: fromHex,
  } = await import('@yomiplush/chm-exchange/core');
  const pubBytes = fromHex(hoisted.pubHex);
  const pubB64 = b64u(pubBytes);
  const fp = computeFp(pubBytes);

  const mockAuthorRecord = {
    id: 'author-1',
    label: 'Mock Artist',
    publicKey: pubBytes,
    publicKeyBase64Url: pubB64,
    fingerprintHex: fp.fullHex,
    fingerprintShort: fp.shortDisplay,
    storageMode: 'noble-encrypted-seed' as const,
    webCryptoPrivateKey: { type: 'private', extractable: false } as unknown as CryptoKey,
    encryptedBackup: {
      format: 'certified-handmade-key-backup' as const,
      version: 1 as const,
      kdf: 'PBKDF2-SHA256' as const,
      iterations: 310000,
      cipher: 'AES-256-GCM' as const,
      salt: 'AAAA',
      iv: 'BBBB',
      ciphertext: 'SECRET_CIPHERTEXT',
      publicKey: pubB64,
      fingerprint: fp.fullHex,
      label: 'Mock Artist',
      createdAt: '2026-11-23T00:00:00.000Z',
    },
    hasBackupDownloaded: true,
    createdAt: '2026-11-23T00:00:00.000Z',
  };

  return {
    ...actual,
    listAuthorKeys: vi.fn(async () => [mockAuthorRecord]),
    getAuthorKey: vi.fn(async (id: string) => (id === 'author-1' ? mockAuthorRecord : undefined)),
    listTrustedKeys: vi.fn(async () => []),
    findTrustedKeyByPublicKey: vi.fn(async () => undefined),
  };
});

describe('Certified Handmade <-> CHM-Exchange Adapter & Format Compatibility', () => {
  it('strips all private key fields (webCryptoPrivateKey, encryptedBackup) in hostAdapter', async () => {
    const { createCertifiedHandmadeExchangeAdapter } = await import(
      '../../src/core/exchange/hostAdapter'
    );
    const adapter = createCertifiedHandmadeExchangeAdapter();

    const identities = await adapter.listPublicIdentities();
    expect(identities).toHaveLength(1);
    const exported = identities[0] as unknown as Record<string, unknown>;
    expect(Object.keys(exported).sort()).toEqual([
      'createdAt',
      'displayName',
      'fingerprintHex',
      'fingerprintShort',
      'id',
      'publicKeyBase64Url',
    ]);
    expect(exported.webCryptoPrivateKey).toBeUndefined();
    expect(exported.encryptedBackup).toBeUndefined();

    const single = (await adapter.getPublicIdentity?.('author-1')) as unknown as Record<
      string,
      unknown
    >;
    expect(single.webCryptoPrivateKey).toBeUndefined();
    expect(single.encryptedBackup).toBeUndefined();
    expect(single.fingerprintShort).toBe(FP.shortDisplay);
  });

  it('maintains bidirectional compatibility with host PublicKeyExportBundle format', () => {
    const hostExport = buildPublicKeyExportBundle({
      publicKeyBase64Url: PUB_B64,
      fingerprintHex: FP.fullHex,
      label: 'YomiPlush Host Export',
    });

    const parsedFromHost = parsePublicKeyExchangeInput(JSON.stringify(hostExport));
    expect(parsedFromHost.sourceKind).toBe('host-json');
    expect(parsedFromHost.publicKeyBase64Url).toBe(PUB_B64);
    expect(parsedFromHost.fingerprintHex).toBe(FP.fullHex);
    expect(parsedFromHost.displayName).toBe('YomiPlush Host Export');

    const exchangeBundle = createPublicKeyBundle({
      publicKey: PUB_BYTES,
      displayName: 'YomiPlush Host Export',
    });
    const url = encodeExchangeUrl(exchangeBundle);
    const parsedFromUrl = parsePublicKeyExchangeInput(url);
    expect(parsedFromUrl.fingerprintHex).toBe(FP.fullHex);
    expect(parsedFromUrl.publicKeyBase64Url).toBe(PUB_B64);
  });
});

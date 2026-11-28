import { describe, expect, it } from 'vitest';
import { isAuthorKeyBackupVerified } from '../../src/core/storage/keyStore';
import type { AuthorKeyRecord } from '../../src/core/storage/keyStore';

function record(overrides: Partial<AuthorKeyRecord>): AuthorKeyRecord {
  return {
    id: 'test-key',
    label: 'Test Artist',
    publicKey: new Uint8Array(32),
    publicKeyBase64Url: 'test',
    fingerprintHex: '00'.repeat(32),
    fingerprintShort: 'CHM-0000-0000-0000-0000',
    storageMode: 'webcrypto-non-extractable',
    hasBackupDownloaded: false,
    createdAt: new Date(0).toISOString(),
    ...overrides,
  };
}

describe('backup verification gate', () => {
  it('blocks a newly created key until the backup is re-opened', () => {
    const key = record({ hasBackupDownloaded: true, hasBackupVerified: false });
    expect(isAuthorKeyBackupVerified(key)).toBe(false);
  });

  it('passes once the backup file was verified', () => {
    expect(isAuthorKeyBackupVerified(record({ hasBackupVerified: true }))).toBe(true);
  });

  it('grandfathers pre-flag records that already downloaded a backup', () => {
    expect(isAuthorKeyBackupVerified(record({ hasBackupDownloaded: true }))).toBe(true);
  });

  it('blocks keys with no backup at all', () => {
    expect(isAuthorKeyBackupVerified(record({ hasBackupDownloaded: false }))).toBe(false);
    expect(isAuthorKeyBackupVerified(null)).toBe(false);
  });
});

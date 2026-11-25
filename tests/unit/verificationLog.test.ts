import { beforeEach, describe, expect, it } from 'vitest';
import {
  appendVerificationLog,
  clearVerificationLogs,
  loadVerificationLogs,
} from '../../src/core/verify/verificationLog';

describe('verificationLog (local verification history)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('appends verification entries newest-first, caps at 50 entries, and clears cleanly', () => {
    expect(loadVerificationLogs()).toEqual([]);

    for (let i = 1; i <= 55; i++) {
      appendVerificationLog({
        sourceLabel: `artwork-${i}.png`,
        protocolVersion: 3,
        signatureStatus: 'valid',
        integrityStatus: 'matched',
        identityStatus: 'trusted',
        artworkTitle: `Artwork ${i}`,
      });
    }

    const loaded = loadVerificationLogs();
    expect(loaded).toHaveLength(50);
    expect(loaded[0].artworkTitle).toBe('Artwork 55');
    expect(loaded[49].artworkTitle).toBe('Artwork 6');

    const cleared = clearVerificationLogs();
    expect(cleared).toEqual([]);
    expect(loadVerificationLogs()).toEqual([]);
  });

  it('handles corrupt localStorage payloads gracefully', () => {
    localStorage.setItem('chm_verification_logs_v1', '{broken-json');
    expect(loadVerificationLogs()).toEqual([]);
  });
});

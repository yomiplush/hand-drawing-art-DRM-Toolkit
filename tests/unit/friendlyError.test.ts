import { describe, expect, it } from 'vitest';
import { toFriendlyError } from '../../src/core/errors/friendlyError';

describe('toFriendlyError (artist-centered plain language error mapping)', () => {
  it('translates passphrase errors into calm localized copy while keeping technical detail', () => {
    const jaErr = toFriendlyError(new Error('Incorrect passphrase / AES-GCM decrypt failed'), 'ja');
    expect(jaErr.title).toContain('パスフレーズ');
    expect(jaErr.dataSafe.length).toBeGreaterThan(5);
    expect(jaErr.nextAction.length).toBeGreaterThan(5);
    expect(jaErr.technicalDetail).toContain('AES-GCM');

    const enErr = toFriendlyError(new Error('Incorrect passphrase'), 'en');
    expect(enErr.title).toContain('Passphrase');
    expect(enErr.dataSafe).toContain('untouched');
  });

  it('maps image decode, QR missing, Google auth, network, storage, and unknown errors safely', () => {
    expect(toFriendlyError(new Error('PNG chunk corrupted'), 'en').title).toContain('image');
    expect(toFriendlyError(new Error('Image dimension too large'), 'ja').title).toContain('サイズ');
    expect(toFriendlyError(new Error('QR code not found in artwork'), 'en').title).toContain('QR');
    expect(
      toFriendlyError(
        new Error('No readable Certified Handmade QR code found in this image.'),
        'en',
      ).title,
    ).toContain('QR');
    expect(toFriendlyError(new Error('Google OAuth popup closed by user'), 'en').title).toContain('Google Drive');
    expect(toFriendlyError(new Error('WebSocket relay fetch timeout'), 'ja').title).toContain('通信');
    expect(toFriendlyError(new Error('IndexedDB QuotaExceededError'), 'en').title).toContain('storage');
    expect(toFriendlyError('unexpected failure', 'en').technicalDetail).toBe('unexpected failure');
  });
});

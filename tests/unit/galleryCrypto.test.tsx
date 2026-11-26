import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../src/i18n';
import { GoogleDriveRiskConsentModal } from '../../src/pages/GalleryDeck/GoogleDriveRiskConsentModal';
import {
  MIN_PBKDF2_ITERATIONS,
  OFFLINE_VIEWER_CSP,
  buildEncryptedVaultChunks,
  decryptBytes,
  deleteLocalEncryptedVault,
  encryptBytes,
  generateOfflineViewerHtml,
  listLocalEncryptedVaults,
  loadLocalEncryptedVaultFile,
  openEncryptedVaultSession,
  packChunksToVaultBlob,
  readVaultContainerIndex,
  saveLocalEncryptedVault,
} from '../../src/services/galleryCrypto';
import type { GalleryArtworkItem } from '../../src/types/gallerydeck';

function makeSampleItem(id: string): GalleryArtworkItem {
  const now = Date.now();
  return {
    id,
    title: `Artwork ${id}`,
    createdAt: now,
    importedAt: now,
    updatedAt: now,
    width: 1200,
    height: 900,
    mimeType: 'image/png',
    fileSizeBytes: 64,
    thumbnailDataUrl: '',
    provenanceStatus: 'unverified',
    qrMode: 'none',
    tags: ['sketch'],
    collections: ['NSFW-Private'],
  };
}

describe('Zero-Knowledge GalleryCrypto Engine', () => {
  it('encrypts and decrypts bytes with PBKDF2 (>=100k) + AES-GCM and random salt/IV', async () => {
    const plaintext = new TextEncoder().encode('secret-nsfw-artwork-binary-payload');
    const enc1 = await encryptBytes(plaintext, 'correct-horse-battery', MIN_PBKDF2_ITERATIONS);
    const enc2 = await encryptBytes(plaintext, 'correct-horse-battery', MIN_PBKDF2_ITERATIONS);

    // Random salt & IV ensure identical plaintext produces distinct ciphertext
    expect(enc1).not.toEqual(enc2);

    const dec1 = await decryptBytes(enc1, 'correct-horse-battery');
    expect(Array.from(dec1)).toEqual(Array.from(plaintext));
    expect(new TextDecoder().decode(dec1)).toBe('secret-nsfw-artwork-binary-payload');

    await expect(decryptBytes(enc1, 'wrong-passphrase')).rejects.toThrow();
  });

  it('builds chunked vault (manifest.enc, thumb_*.enc, img_*.enc) and decrypts .gdvault via File.slice()', async () => {
    const item = makeSampleItem('art-001');
    const fullBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4, 5, 6, 7, 8]);

    const { manifest, chunks } = await buildEncryptedVaultChunks({
      vaultName: 'Private Deck',
      items: [{ item, fullBytes, fullMimeType: 'image/png' }],
      passphrase: 'vault-password-123',
      iterations: MIN_PBKDF2_ITERATIONS,
    });

    expect(manifest.items).toHaveLength(1);
    expect(chunks.map((c) => c.name)).toEqual([
      'manifest.enc',
      'thumb_art-001.enc',
      'img_art-001.enc',
    ]);

    // Pack into single .gdvault container and verify offset index
    const vaultBlob = packChunksToVaultBlob(chunks);
    const { index } = await readVaultContainerIndex(vaultBlob);
    expect(Object.keys(index.entries)).toEqual([
      'manifest.enc',
      'thumb_art-001.enc',
      'img_art-001.enc',
    ]);

    // Mock URL.createObjectURL / revokeObjectURL for jsdom
    const created: string[] = [];
    const revoked: string[] = [];
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => {
      const u = `blob:mock-${created.length}`;
      created.push(u);
      return u;
    });
    URL.revokeObjectURL = vi.fn((u: string) => {
      revoked.push(u);
    });

    try {
      const vaultFile = new File([vaultBlob], 'private-deck.gdvault', {
        type: 'application/octet-stream',
      });
      const session = await openEncryptedVaultSession({
        files: [vaultFile],
        passphrase: 'vault-password-123',
      });

      expect(session.manifest.vaultName).toBe('Private Deck');
      expect(session.thumbnailUrls['art-001']).toBeDefined();

      // On-demand full image decryption
      const full = await session.decryptFullImage('art-001');
      expect(full.mimeType).toBe('image/png');
      expect(full.blobUrl).toMatch(/^blob:mock-/);

      URL.revokeObjectURL(full.blobUrl);
      session.dispose();
      expect(revoked.length).toBeGreaterThanOrEqual(2);
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });

  it('generates a self-contained offline viewer HTML with strict CSP and zero external URLs', () => {
    const html = generateOfflineViewerHtml();
    expect(html).toContain(`<meta http-equiv="Content-Security-Policy" content="${OFFLINE_VIEWER_CSP}" />`);
    expect(html).toContain('URL.revokeObjectURL');
    expect(html).toContain('crypto.subtle.deriveKey');
    expect(html).not.toMatch(/https?:\/\//i);
  });

  it('saves, lists, loads, and deletes encrypted vaults locally without plaintext', async () => {
    const item = makeSampleItem('local-001');
    const fullBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const { chunks } = await buildEncryptedVaultChunks({
      vaultName: 'My Local Vault',
      items: [{ item, fullBytes, fullMimeType: 'image/png' }],
      passphrase: 'local-secret-password',
      iterations: MIN_PBKDF2_ITERATIONS,
    });
    const vaultBlob = packChunksToVaultBlob(chunks);

    const meta = await saveLocalEncryptedVault({
      vaultName: 'My Local Vault',
      itemCount: 1,
      vaultBlob,
    });
    expect(meta.vaultName).toBe('My Local Vault');

    const listed = await listLocalEncryptedVaults();
    expect(listed.some((v) => v.id === meta.id)).toBe(true);

    const loadedFile = await loadLocalEncryptedVaultFile(meta.id);
    expect(loadedFile).not.toBeNull();
    expect(loadedFile!.name).toBe('My-Local-Vault.gdvault');

    await deleteLocalEncryptedVault(meta.id);
    const afterDelete = await loadLocalEncryptedVaultFile(meta.id);
    expect(afterDelete).toBeNull();
  });

  it('encrypts and restores wss:// customNostrRelays in the vault manifest without leaking plaintext', async () => {
    const relayA = 'wss://paid-relay.example.com';
    const relayB = 'wss://self-hosted.example.org/nostr';
    const { manifest, chunks } = await buildEncryptedVaultChunks({
      vaultName: 'Drive Relay Sync',
      items: [],
      passphrase: 'relay-sync-passphrase',
      customNostrRelays: [relayA, 'https://ignored.example.com', relayB, relayA],
      iterations: MIN_PBKDF2_ITERATIONS,
    });
    expect(manifest.customNostrRelays).toEqual([relayA, relayB]);

    // Verify plaintext relay URL is not present in the encrypted manifest chunk
    const manifestChunk = chunks.find((c) => c.name === 'manifest.enc');
    expect(manifestChunk).toBeDefined();
    const rawText = new TextDecoder().decode(manifestChunk!.data);
    expect(rawText).not.toContain(relayA);
    expect(rawText).not.toContain(relayB);

    // Pack & decrypt via openEncryptedVaultSession
    const vaultBlob = packChunksToVaultBlob(chunks);
    const vaultFile = new File([vaultBlob], 'drive-sync.gdvault', {
      type: 'application/octet-stream',
    });
    const session = await openEncryptedVaultSession({
      files: [vaultFile],
      passphrase: 'relay-sync-passphrase',
    });
    try {
      expect(session.manifest.customNostrRelays).toEqual([relayA, relayB]);
    } finally {
      session.dispose();
    }
  });
});

describe('GoogleDriveRiskConsentModal', () => {
  it('blocks Google Drive connection until the user checks the consent box', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <I18nProvider>
        <GoogleDriveRiskConsentModal
          open={true}
          onCancel={onCancel}
          onConfirmConsent={onConfirm}
        />
      </I18nProvider>,
    );

    const confirmBtn = screen.getByTestId('gdrive-risk-confirm-btn') as HTMLButtonElement;
    const checkbox = screen.getByTestId('gdrive-risk-consent-checkbox') as HTMLInputElement;

    // Must be disabled before checking consent
    expect(confirmBtn.disabled).toBe(true);
    fireEvent.click(confirmBtn);
    expect(onConfirm).not.toHaveBeenCalled();

    // Check consent box -> button becomes enabled
    fireEvent.click(checkbox);
    expect(confirmBtn.disabled).toBe(false);

    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

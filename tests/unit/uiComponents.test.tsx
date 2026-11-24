// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ArtworkDetailsPanel,
  createEmptyArtworkDetailsDraft,
  type ArtworkDetailsDraft,
} from '../../src/components/ArtworkDetailsPanel';
import { StorageSettingsPanel } from '../../src/components/vault/StorageSettingsPanel';
import { VerifiedArtworkDetailsCard } from '../../src/components/VerifiedArtworkDetailsCard';
import { AdvancedSettings } from '../../src/components/ui/AdvancedSettings';
import { CompactStatus } from '../../src/components/ui/CompactStatus';
import { HelpDisclosure } from '../../src/components/ui/HelpDisclosure';
import { HelpIconButton } from '../../src/components/ui/HelpIconButton';
import type { EvidenceVerificationSummary } from '../../src/core/manifest/types';
import { I18nProvider } from '../../src/i18n';

afterEach(() => {
  cleanup();
});

describe('Reusable progressive disclosure UI components', () => {
  it('HelpDisclosure toggles cleanly and closes on Escape while restoring focus', () => {
    render(
      <HelpDisclosure label="How signing works" testId="help-disclosure">
        <p>Local Ed25519 signing details</p>
      </HelpDisclosure>,
    );

    const trigger = screen.getByRole('button', { name: 'How signing works' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Local Ed25519 signing details')).toBeNull();

    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const body = screen.getByText('Local Ed25519 signing details');
    expect(body).toBeTruthy();

    fireEvent.keyDown(body, { key: 'Escape' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Local Ed25519 signing details')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('HelpIconButton opens popover dialog and closes on Escape with focus return', () => {
    render(
      <HelpIconButton label="Open Help" title="Certified Handmade Help" testId="help-btn">
        <p>Offline-first cryptographic provenance.</p>
      </HelpIconButton>,
    );

    const btn = screen.getByTestId('help-btn');
    expect(btn.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Offline-first cryptographic provenance.')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(btn);
  });

  it('AdvancedSettings expands controls on demand and supports Escape', () => {
    render(
      <AdvancedSettings label="Advanced QR Settings" summary="Default settings">
        <div>Module Scale Control</div>
      </AdvancedSettings>,
    );

    const trigger = screen.getByRole('button', { name: /Advanced QR Settings/i });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Module Scale Control')).toBeNull();

    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const inner = screen.getByText('Module Scale Control');
    expect(inner).toBeTruthy();

    fireEvent.keyDown(inner, { key: 'Escape' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('CompactStatus displays status row and inline help toggle', () => {
    render(
      <CompactStatus
        label="Signature"
        value="Valid"
        tone="success"
        icon={<CheckCircle2 />}
        helpLabel="About Signature"
        helpText="Ed25519 signature matched the public key in the manifest."
        testId="status-row"
        helpTestId="status-help-btn"
      />,
    );

    const row = screen.getByTestId('status-row');
    expect(row.textContent).toContain('Signature');
    expect(row.textContent).toContain('Valid');
    expect(screen.queryByText(/Ed25519 signature matched/)).toBeNull();

    fireEvent.click(screen.getByTestId('status-help-btn'));
    expect(screen.getByText(/Ed25519 signature matched/)).toBeTruthy();
  });

  it('VerifiedArtworkDetailsCard renders untrusted text safely without HTML execution and distinguishes claims from proof', () => {
    const summary: EvidenceVerificationSummary = {
      status: 'valid',
      errors: [],
      extensionSignatureValid: true,
      bindingMatchesPrimaryProof: true,
      evidenceBytesLength: 256,
      verifiedRecordCount: 1,
      unavailableRecordCount: 1,
      mismatchedSuppliedFiles: [
        {
          fileName: '<script>evil()</script>wrong.png',
          byteLength: 42,
          computedSha256Hex: 'aa'.repeat(32),
        },
      ],
      recordChecks: [
        {
          index: 0,
          sha256Hex: '11'.repeat(32),
          byteLength: 1024,
          label: 'rough-sketch.png',
          category: 'sketch',
          status: 'verified',
          matchedFileName: 'rough-sketch.png',
        },
        {
          index: 1,
          sha256Hex: '22'.repeat(32),
          byteLength: 4096,
          label: 'timelapse.mp4',
          category: 'timelapse',
          status: 'unavailable',
        },
      ],
      extension: {
        version: 1,
        proofSha256: new Uint8Array(32),
        artworkId: new Uint8Array(16),
        artworkSha256: new Uint8Array(32),
        publicKey: new Uint8Array(32),
        createdAt: 1795352786,
        artworkMetadata: {
          title: '<script>alert(1)</script> Moonlit 🎨',
          artistName: '<img src=x onerror=alert(2)> Studio',
          description: 'Line 1\n<svg onload=alert(3)>',
        },
        creatorProfile: {
          displayName: 'Yomi <b>Bold</b>',
          website: 'https://certified-handmade.com',
          links: [{ label: 'Pixiv', url: 'https://www.pixiv.net/users/123' }],
        },
        creationMethod: 'hand-drawn-no-ai',
        creationEnvironment: {
          software: 'Krita',
          hardware: 'Linux workstation',
          inputDevice: 'Wacom pen',
          notes: '<b>Inert</b> pencil',
        },
        signature: new Uint8Array(64),
      },
    };

    const { container } = render(
      <I18nProvider>
        <VerifiedArtworkDetailsCard summary={summary} />
      </I18nProvider>,
    );

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('svg[onload]')).toBeNull();

    const panel = screen.getByTestId('verify-artwork-details-panel');
    expect(panel.textContent).toContain('<script>alert(1)</script> Moonlit 🎨');
    expect(panel.textContent).toContain('<img src=x onerror=alert(2)> Studio');
    expect(panel.textContent).toContain('<svg onload=alert(3)>');
    expect(panel.textContent).toContain('<b>Inert</b> pencil');
    expect(panel.textContent).toContain(
      'Creation method: Hand-drawn (no generative AI) (declared by creator)',
    );
    expect(panel.textContent).toContain(
      'Cryptographic verification confirms the signer signed this declaration',
    );
    expect(panel.textContent).not.toContain('100% Human-Made Verified');

    expect(screen.getByTestId('verify-evidence-record-0').textContent).toContain('Hash verified');
    expect(screen.getByTestId('verify-evidence-record-1').textContent).toContain(
      'Unavailable (not supplied)',
    );
    expect(screen.getByTestId('verify-evidence-mismatched-files').textContent).toContain(
      '<script>evil()</script>wrong.png',
    );
  });

  it('VerifiedArtworkDetailsCard refuses to render unsafe javascript:/data: links as anchors', () => {
    const summary: EvidenceVerificationSummary = {
      status: 'valid',
      errors: [],
      extensionSignatureValid: true,
      bindingMatchesPrimaryProof: true,
      verifiedRecordCount: 0,
      unavailableRecordCount: 0,
      mismatchedSuppliedFiles: [],
      recordChecks: [],
      extension: {
        version: 1,
        proofSha256: new Uint8Array(32),
        artworkId: new Uint8Array(16),
        artworkSha256: new Uint8Array(32),
        publicKey: new Uint8Array(32),
        createdAt: 1795352786,
        creatorProfile: {
          displayName: 'Artist',
          website: 'javascript:alert(1)',
          links: [{ label: 'Bad', url: 'data:text/html,hi' }],
        },
        signature: new Uint8Array(64),
      },
    };

    const { container } = render(
      <I18nProvider>
        <VerifiedArtworkDetailsCard summary={summary} />
      </I18nProvider>,
    );

    expect(container.querySelectorAll('a')).toHaveLength(0);
  });

  it('ArtworkDetailsPanel stays collapsed by default, groups creation & local evidence controls, and lists all 6 creation options', () => {
    function Harness() {
      const [draft, setDraft] = useState<ArtworkDetailsDraft>(createEmptyArtworkDetailsDraft);
      return (
        <I18nProvider>
          <ArtworkDetailsPanel draft={draft} onChange={setDraft} />
        </I18nProvider>
      );
    }

    render(<Harness />);

    const disclosureBtn = screen.getByTestId('create-artwork-details').querySelector('button')!;
    expect(disclosureBtn.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('details-creation-method')).toBeNull();

    fireEvent.click(disclosureBtn);
    expect(disclosureBtn.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByTestId('details-group-creation')).toBeTruthy();
    expect(screen.getByTestId('details-group-evidence')).toBeTruthy();

    const select = screen.getByTestId('details-creation-method') as HTMLSelectElement;
    const optionValues = Array.from(select.querySelectorAll('option')).map((o) => o.value);
    expect(optionValues).toEqual([
      '',
      'hand-drawn-no-ai',
      'hand-drawn-ai-assisted',
      'ai-generated',
      'other',
      'prefer-not-to-disclose',
    ]);

    fireEvent.change(select, { target: { value: 'hand-drawn-no-ai' } });
    expect(select.value).toBe('hand-drawn-no-ai');

    fireEvent.click(screen.getByTestId('details-group-evidence'));
    expect(screen.getByTestId('details-evidence-file-input')).toBeTruthy();
  });

  it('StorageSettingsPanel renders IndexedDB, Portable File, and lazy Google Drive controls safely', () => {
    render(
      <I18nProvider>
        <StorageSettingsPanel />
      </I18nProvider>,
    );

    expect(screen.getByTestId('storage-provider-indexeddb')).toBeTruthy();
    expect(screen.getByTestId('storage-provider-portable')).toBeTruthy();
    expect(screen.getByTestId('storage-provider-google-drive')).toBeTruthy();

    // GIS script must NOT be eagerly injected on initial render
    expect(document.querySelector('script[src="https://accounts.google.com/gsi/client"]')).toBeNull();

    const exportBtn = screen.getByTestId('portable-export-btn') as HTMLButtonElement;
    expect(exportBtn.disabled).toBe(true);

    fireEvent.change(screen.getByTestId('portable-passphrase-input'), {
      target: { value: 'strong-passphrase-2026' },
    });
    expect(exportBtn.disabled).toBe(false);
  });
});

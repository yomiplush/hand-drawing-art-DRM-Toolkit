// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CheckCircle2 } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';
import { AdvancedSettings } from '../../src/components/ui/AdvancedSettings';
import { CompactStatus } from '../../src/components/ui/CompactStatus';
import { HelpDisclosure } from '../../src/components/ui/HelpDisclosure';
import { HelpIconButton } from '../../src/components/ui/HelpIconButton';

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
});

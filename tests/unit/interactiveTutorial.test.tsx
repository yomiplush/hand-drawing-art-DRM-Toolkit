// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { InteractiveTutorialModal } from '../../src/components/tutorial/InteractiveTutorialModal';
import { Layout } from '../../src/components/Layout';
import { PreferencesProvider } from '../../src/components/PreferencesContext';
import {
  TUTORIAL_SEEN_STORAGE_KEY,
  hasSeenInteractiveTutorial,
  markInteractiveTutorialSeen,
  resetInteractiveTutorialSeen,
} from '../../src/core/preferences/tutorialState';
import { SUPPORTED_LOCALES } from '../../src/core/storage/consent';
import { I18nProvider } from '../../src/i18n';
import { INTERACTIVE_TUTORIAL_I18N } from '../../src/i18n/interactiveTutorial.data';

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <I18nProvider>
      <PreferencesProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </PreferencesProvider>
    </I18nProvider>,
  );
}

describe('Interactive 3D Tutorial state, UI, i18n, and re-entry', () => {
  beforeEach(() => {
    localStorage.clear();
    cleanup();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('persists skipped and completed states in localStorage and resets cleanly', () => {
    expect(hasSeenInteractiveTutorial()).toBe(false);

    markInteractiveTutorialSeen('skipped');
    expect(localStorage.getItem(TUTORIAL_SEEN_STORAGE_KEY)).toBe('skipped');
    expect(hasSeenInteractiveTutorial()).toBe(true);

    resetInteractiveTutorialSeen();
    expect(hasSeenInteractiveTutorial()).toBe(false);

    markInteractiveTutorialSeen('completed');
    expect(localStorage.getItem(TUTORIAL_SEEN_STORAGE_KEY)).toBe('completed');
    expect(hasSeenInteractiveTutorial()).toBe(true);
  });

  it('covers all 13 supported languages with non-empty localized copy', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const entry = INTERACTIVE_TUTORIAL_I18N[locale];
      expect(entry).toBeDefined();
      expect(entry.dialogAria.trim().length).toBeGreaterThan(2);
      expect(entry.headerButtonTooltip.trim().length).toBeGreaterThan(3);
      expect(entry.skipBtn.trim().length).toBeGreaterThan(1);
      expect(entry.doneBtn.trim().length).toBeGreaterThan(1);
      expect(entry.dragHint.trim().length).toBeGreaterThan(4);
      expect(entry.steps).toHaveLength(4);
      for (const step of entry.steps) {
        expect(step.badge.trim().length).toBeGreaterThan(2);
        expect(step.title.trim().length).toBeGreaterThan(3);
        expect(step.body.trim().length).toBeGreaterThan(10);
      }
      if (locale !== 'en') {
        expect(entry.steps[0].title).not.toBe(INTERACTIVE_TUTORIAL_I18N.en.steps[0].title);
        expect(entry.skipBtn).not.toBe(INTERACTIVE_TUTORIAL_I18N.en.skipBtn);
      }
    }
  });

  it('renders on first visit, supports 3D pointer drag, step navigation, and bottom-end skip', () => {
    const onSkip = vi.fn();
    const onComplete = vi.fn();

    renderWithProviders(
      <InteractiveTutorialModal open={true} onSkip={onSkip} onComplete={onComplete} />,
    );

    expect(screen.getByTestId('interactive-tutorial-modal')).toBeInTheDocument();
    expect(screen.getByTestId('tutorial-step-counter')).toHaveTextContent('1 / 4');

    // Pointer drag on 3D stage should work without throwing
    const stage = screen.getByTestId('tutorial-3d-stage');
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 160, clientY: 80 });
    fireEvent.pointerUp(stage, { pointerId: 1, clientX: 160, clientY: 80 });

    // Navigate through all 4 steps
    fireEvent.click(screen.getByTestId('tutorial-next-btn'));
    expect(screen.getByTestId('tutorial-step-counter')).toHaveTextContent('2 / 4');
    fireEvent.click(screen.getByTestId('tutorial-next-btn'));
    expect(screen.getByTestId('tutorial-step-counter')).toHaveTextContent('3 / 4');
    fireEvent.click(screen.getByTestId('tutorial-next-btn'));
    expect(screen.getByTestId('tutorial-step-counter')).toHaveTextContent('4 / 4');

    // Final step shows Get Started / done button
    fireEvent.click(screen.getByTestId('tutorial-done-btn'));
    expect(onComplete).toHaveBeenCalledTimes(1);

    // Fixed bottom-end skip button triggers onSkip
    fireEvent.click(screen.getByTestId('tutorial-skip-btn'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('does not render modal when open is false and exposes header relaunch button in Layout', () => {
    const onOpenTutorial = vi.fn();

    const { rerender } = renderWithProviders(
      <>
        <Layout
          offlineReady={false}
          needRefresh={false}
          onUpdateSw={vi.fn()}
          onOpenCookieSettings={vi.fn()}
          onOpenTutorial={onOpenTutorial}
        />
        <InteractiveTutorialModal open={false} onSkip={vi.fn()} onComplete={vi.fn()} />
      </>,
    );

    expect(screen.queryByTestId('interactive-tutorial-modal')).not.toBeInTheDocument();
    const headerBtn = screen.getByTestId('header-tutorial-btn');
    fireEvent.click(headerBtn);
    expect(onOpenTutorial).toHaveBeenCalledTimes(1);

    rerender(
      <I18nProvider>
        <PreferencesProvider>
          <MemoryRouter>
            <InteractiveTutorialModal open={true} onSkip={vi.fn()} onComplete={vi.fn()} />
          </MemoryRouter>
        </PreferencesProvider>
      </I18nProvider>,
    );
    expect(screen.getByTestId('interactive-tutorial-modal')).toBeInTheDocument();
  });
});

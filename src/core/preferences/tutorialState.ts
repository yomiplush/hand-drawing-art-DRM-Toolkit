export type TutorialDismissReason = 'completed' | 'skipped';

export const TUTORIAL_SEEN_STORAGE_KEY = 'chm_interactive_tutorial_seen_v1';

export function hasSeenInteractiveTutorial(): boolean {
  try {
    const value = localStorage.getItem(TUTORIAL_SEEN_STORAGE_KEY);
    return value === 'completed' || value === 'skipped' || value === '1';
  } catch {
    return false;
  }
}

export function markInteractiveTutorialSeen(reason: TutorialDismissReason): void {
  try {
    localStorage.setItem(TUTORIAL_SEEN_STORAGE_KEY, reason);
  } catch {
    // Ignore storage unavailability (e.g. private mode restrictions)
  }
}

export function resetInteractiveTutorialSeen(): void {
  try {
    localStorage.removeItem(TUTORIAL_SEEN_STORAGE_KEY);
  } catch {
    // Ignore storage unavailability
  }
}

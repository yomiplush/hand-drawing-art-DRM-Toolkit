import type { InteractiveTutorialTranslations } from '../../interactiveTutorial';

export const EN: InteractiveTutorialTranslations = {
  dialogAria: 'Interactive 3D tutorial',
  headerButtonLabel: 'Tutorial',
  headerButtonTooltip: 'Open interactive 3D tutorial',
  launchFromPageBtn: 'Launch 3D Interactive Tour',
  dragHint: 'Drag or swipe to tilt in 3D',
  stepCounterLabel: 'Step',
  backBtn: 'Back',
  nextBtn: 'Next',
  skipBtn: 'Skip',
  doneBtn: 'Get Started',
  steps: [
    {
      badge: '100% Local & Offline',
      title: 'Proof made entirely on your device',
      body: 'No account, no cloud upload, and no servers. Your artwork and signing keys stay inside your browser at all times.',
      highlight: 'Zero uploads · Works offline',
    },
    {
      badge: 'Step 1 · Local Key',
      title: 'Create your own signing key',
      body: 'Start by generating your personal Ed25519 key right in this browser. Save a backup file whenever you are ready so you never lose it.',
      highlight: 'Ed25519 local key · Easy backup',
    },
    {
      badge: 'Step 2 · Simple Mode',
      title: 'Sign artwork in just a few clicks',
      body: 'In Simple Mode, just pick your illustration and burn a tamper-evident QR certificate into it. You can switch to Advanced Mode anytime.',
      highlight: 'Simple Mode default · Switch anytime',
    },
    {
      badge: 'Step 3 · Offline Verify',
      title: 'Anyone can verify offline',
      body: 'Scan the QR code or drop the signed image into Verify to check authenticity and pixel integrity anywhere—even without internet.',
      highlight: 'Instant QR & image verification',
    },
  ],
};

// Aggregate of every module's non-en/ja locale data. Loaded lazily once per
// non-English/Japanese locale switch, as a single code-split chunk.
import { OTHERS as seo } from './seo/others';
import { OTHERS as minimal } from './minimalUi/others';
import { OTHERS as hardening } from './hardening/others';
import { OTHERS as tutorial } from './tutorial/others';
import { OTHERS as licenses } from './licenses/others';
import { OTHERS as qrStudio } from './qrStudio/others';
import { OTHERS as interactiveTutorial } from './interactiveTutorial/others';
import { OTHERS as verifyMobile } from './verifyMobile/others';
import { OTHERS as googleCompliance } from './googleCompliance/others';
import { OTHERS as uxGuidance } from './uxGuidance/others';
import { OTHERS as howTo } from './howto/others';
import { OTHERS as nextGen } from './nextGen/others';
import { OTHERS as artworkDetails } from './artworkDetails/others';

export const LOCALE_OTHERS = {
  seo,
  minimal,
  hardening,
  tutorial,
  licenses,
  qrStudio,
  interactiveTutorial,
  verifyMobile,
  googleCompliance,
  uxGuidance,
  howTo,
  nextGen,
  artworkDetails,
};

import { describe, expect, it } from 'vitest';
import { LICENSE_DEFINITIONS } from '../../src/core/manifest/types';
import { SUPPORTED_LOCALES } from '../../src/core/storage/consent';
import { HOWTO_I18N } from '../../src/i18n/howto';
import { LICENSE_I18N } from '../../src/i18n/licenses';

describe('13-language license guide & simple how-to translations', () => {
  it('provides localized license descriptions for all 8 licenses in all 13 languages', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const guide = LICENSE_I18N[locale];
      expect(guide.guideTitle.length).toBeGreaterThan(3);
      expect(guide.signalGuideBody.length).toBeGreaterThan(10);
      expect(guide.appLicenseBody.length).toBeGreaterThan(10);

      for (const def of LICENSE_DEFINITIONS) {
        const entry = guide.items[def.id];
        expect(entry).toBeDefined();
        expect(entry.name.trim().length).toBeGreaterThan(2);
        expect(entry.summary.trim().length).toBeGreaterThan(10);
      }

      if (locale !== 'en') {
        expect(guide.guideTitle).not.toBe(LICENSE_I18N.en.guideTitle);
        expect(guide.items.ARR.summary).not.toBe(LICENSE_I18N.en.items.ARR.summary);
      }
    }
  });

  it('provides 3-step usage guide & quick-keygen copy for all 13 languages', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const howto = HOWTO_I18N[locale];
      expect(howto.homeTitle.length).toBeGreaterThan(3);
      expect(howto.steps).toHaveLength(3);
      for (const s of howto.steps) {
        expect(s.title.trim().length).toBeGreaterThan(3);
        expect(s.desc.trim().length).toBeGreaterThan(10);
      }
      expect(howto.quickKeyBtn.trim().length).toBeGreaterThan(3);
      expect(howto.advancedToggle.trim().length).toBeGreaterThan(3);

      if (locale !== 'en') {
        expect(howto.homeTitle).not.toBe(HOWTO_I18N.en.homeTitle);
        expect(howto.quickKeyBtn).not.toBe(HOWTO_I18N.en.quickKeyBtn);
      }
    }
  });
});

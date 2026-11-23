import { describe, expect, it } from 'vitest';
import { LICENSE_DEFINITIONS } from '../../src/core/manifest/types';
import { SUPPORTED_LOCALES } from '../../src/core/storage/consent';
import { en } from '../../src/i18n/en';
import { HOWTO_I18N } from '../../src/i18n/howto';
import { ja } from '../../src/i18n/ja';
import { LICENSE_I18N } from '../../src/i18n/licenses';
import { ko, zhCN, zhTW } from '../../src/i18n/locales/eastAsia';
import { ar, de, es, fr, it as itLocale, pt } from '../../src/i18n/locales/europeanAndArabic';
import { ru, uk } from '../../src/i18n/locales/slavic';
import { QR_STUDIO_I18N } from '../../src/i18n/qrStudio';
import { SEO_I18N } from '../../src/i18n/seo';
import { STANDALONE_I18N } from '../../src/i18n/standalone';
import { TUTORIAL_I18N } from '../../src/i18n/tutorial';
import { VERIFY_MOBILE_I18N } from '../../src/i18n/verifyMobile';

const BASE_TRANSLATIONS = {
  en,
  ja,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  ko,
  ru,
  uk,
  es,
  fr,
  de,
  pt,
  it: itLocale,
  ar,
};

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

  it('provides full Tutorial page translations & guided links for all 13 languages', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const tut = TUTORIAL_I18N[locale];
      expect(tut.navLabel.trim().length).toBeGreaterThan(1);
      expect(tut.homeCta.trim().length).toBeGreaterThan(3);
      expect(tut.title.trim().length).toBeGreaterThan(3);
      expect(tut.reassuranceItems).toHaveLength(3);
      expect(tut.steps).toHaveLength(4);
      for (const step of tut.steps) {
        expect(step.title.trim().length).toBeGreaterThan(3);
        expect(step.desc.trim().length).toBeGreaterThan(10);
        expect(step.ctaLabel.trim().length).toBeGreaterThan(2);
        expect(['/create', '/verify', '/keys', '/docs']).toContain(step.to);
      }
      expect(tut.cheatItems).toHaveLength(4);
      expect(tut.faqs).toHaveLength(3);

      if (locale !== 'en') {
        expect(tut.title).not.toBe(TUTORIAL_I18N.en.title);
        expect(tut.subtitle).not.toBe(TUTORIAL_I18N.en.subtitle);
        expect(tut.homeCta).not.toBe(TUTORIAL_I18N.en.homeCta);
      }
    }
  });

  it('provides unified Manual In-Image QR Studio translations for all 13 languages', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const studio = QR_STUDIO_I18N[locale];
      expect(studio.navLabel.trim().length).toBeGreaterThan(2);
      expect(studio.title.trim().length).toBeGreaterThan(5);
      expect(studio.subtitle.trim().length).toBeGreaterThan(15);
      expect(studio.signInImageBtn.trim().length).toBeGreaterThan(5);
      expect(studio.modeSectionTitle.trim().length).toBeGreaterThan(3);
      expect(studio.modeOuterLabel.trim().length).toBeGreaterThan(3);
      expect(studio.modeOuterDesc.trim().length).toBeGreaterThan(10);
      expect(studio.modeStudioLabel.trim().length).toBeGreaterThan(3);
      expect(studio.modeStudioDesc.trim().length).toBeGreaterThan(10);
      expect(studio.uploadFirstHint.trim().length).toBeGreaterThan(10);

      if (locale !== 'en') {
        expect(studio.title).not.toBe(QR_STUDIO_I18N.en.title);
        expect(studio.subtitle).not.toBe(QR_STUDIO_I18N.en.subtitle);
        expect(studio.modeStudioLabel).not.toBe(QR_STUDIO_I18N.en.modeStudioLabel);
      }
    }
  });

  it('provides home.manifesto and verifyMobile UX translations for all 13 languages', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const base = BASE_TRANSLATIONS[locale];
      expect(base.home.manifesto.trim().length).toBeGreaterThan(10);
      if (locale !== 'en') {
        expect(base.home.manifesto).not.toBe(en.home.manifesto);
      }

      const vm = VERIFY_MOBILE_I18N[locale];
      expect(vm.proofStep2Title.trim().length).toBeGreaterThan(5);
      expect(vm.proofStep2Desc.trim().length).toBeGreaterThan(10);
      expect(vm.pasteImageBtn.trim().length).toBeGreaterThan(5);
      expect(vm.pasteBusy.trim().length).toBeGreaterThan(3);
      expect(vm.pasteNoImage.trim().length).toBeGreaterThan(5);
      expect(vm.pasteUnsupported.trim().length).toBeGreaterThan(5);
      expect(vm.pasteHint.trim().length).toBeGreaterThan(5);
      expect(vm.rawProofToggle.trim().length).toBeGreaterThan(5);
      expect(vm.attachedReadyBadge.trim().length).toBeGreaterThan(2);
      expect(vm.sharedImageVerifiedNote.trim().length).toBeGreaterThan(5);
      expect(vm.sharedImageNoQrNote.trim().length).toBeGreaterThan(10);
      expect(vm.cameraFollowUpHint.trim().length).toBeGreaterThan(10);

      if (locale !== 'en') {
        expect(vm.proofStep2Title).not.toBe(VERIFY_MOBILE_I18N.en.proofStep2Title);
        expect(vm.pasteImageBtn).not.toBe(VERIFY_MOBILE_I18N.en.pasteImageBtn);
      }
    }
  });

  it('provides Standalone Edition copy for all 13 languages', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const st = STANDALONE_I18N[locale];
      expect(st.title.trim().length).toBeGreaterThan(5);
      expect(st.subtitle.trim().length).toBeGreaterThan(20);
      expect(st.modes).toHaveLength(3);
      expect(st.platforms).toHaveLength(2);
      if (locale !== 'en') {
        expect(st.title).not.toBe(STANDALONE_I18N.en.title);
      }
    }
  });

  it('provides route SEO metadata and FAQ copy for all 13 languages', () => {
    const routeKeys = [
      'home',
      'create',
      'createStudio',
      'verify',
      'tutorial',
      'keys',
      'docs',
      'privacy',
    ] as const;

    for (const locale of SUPPORTED_LOCALES) {
      const seo = SEO_I18N[locale];
      for (const routeKey of routeKeys) {
        const meta = seo[routeKey];
        expect(meta.title.trim().length).toBeGreaterThan(15);
        expect(meta.description.trim().length).toBeGreaterThan(30);
        if (locale === 'en' || locale === 'ja') {
          expect(meta.description.trim().length).toBeGreaterThan(55);
        }
        expect(meta.keywords.trim().length).toBeGreaterThan(15);
      }
      expect(seo.homeFaqTitle.trim().length).toBeGreaterThan(5);
      expect(seo.homeFaqSubtitle.trim().length).toBeGreaterThan(10);
      expect(seo.homeFaqs).toHaveLength(5);
      for (const item of seo.homeFaqs) {
        expect(item.q.trim().length).toBeGreaterThan(10);
        expect(item.a.trim().length).toBeGreaterThan(25);
      }

      if (locale !== 'en') {
        expect(seo.home.title).not.toBe(SEO_I18N.en.home.title);
        expect(seo.homeFaqTitle).not.toBe(SEO_I18N.en.homeFaqTitle);
      }
    }
  });
});

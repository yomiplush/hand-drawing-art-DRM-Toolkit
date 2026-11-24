import { describe, expect, it } from 'vitest';
import { LICENSE_DEFINITIONS } from '../../src/core/manifest/types';
import { SUPPORTED_LOCALES } from '../../src/core/storage/consent';
import { ARTWORK_DETAILS_I18N } from '../../src/i18n/artworkDetails';
import { en } from '../../src/i18n/en';
import { GOOGLE_COMPLIANCE_I18N } from '../../src/i18n/googleCompliance';
import { HOWTO_I18N } from '../../src/i18n/howto';
import { ja } from '../../src/i18n/ja';
import { LICENSE_I18N } from '../../src/i18n/licenses';
import { ko, zhCN, zhTW } from '../../src/i18n/locales/eastAsia';
import { ar, de, es, fr, it as itLocale, pt } from '../../src/i18n/locales/europeanAndArabic';
import { ru, uk } from '../../src/i18n/locales/slavic';
import { MINIMAL_UI_I18N } from '../../src/i18n/minimalUi';
import { NEXT_GEN_I18N } from '../../src/i18n/nextGen';
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

  it('provides minimal UI/UX copy for all 13 languages', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const mui = MINIMAL_UI_I18N[locale];
      expect(mui.home.tagline.trim().length).toBeGreaterThan(4);
      expect(mui.home.createCta.trim().length).toBeGreaterThan(3);
      expect(mui.home.verifyCta.trim().length).toBeGreaterThan(3);
      expect(mui.home.helpItems).toHaveLength(6);
      expect(mui.create.signAndDownloadBtn.trim().length).toBeGreaterThan(3);
      expect(mui.verify.sigLabel.trim().length).toBeGreaterThan(1);
      expect(mui.verify.intLabel.trim().length).toBeGreaterThan(1);
      expect(mui.verify.idLabel.trim().length).toBeGreaterThan(1);
      if (locale !== 'en') {
        expect(mui.home.tagline).not.toBe(MINIMAL_UI_I18N.en.home.tagline);
        expect(mui.home.createCta).not.toBe(MINIMAL_UI_I18N.en.home.createCta);
      }
    }
  });

  it('provides Artwork Details & Creation Evidence copy for all 13 languages', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const ad = ARTWORK_DETAILS_I18N[locale];
      expect(ad.disclosureTitle.trim().length).toBeGreaterThan(4);
      expect(ad.disclosureHint.trim().length).toBeGreaterThan(10);
      expect(ad.methodHandDrawnNoAi.trim().length).toBeGreaterThan(4);
      expect(ad.methodPreferNotToDisclose.trim().length).toBeGreaterThan(3);
      expect(ad.verifyStandaloneError.trim().length).toBeGreaterThan(10);
      expect(ad.verifyExtValidBadge.trim().length).toBeGreaterThan(5);
      expect(ad.verifyEvidenceStatusVerified.trim().length).toBeGreaterThan(3);
      expect(ad.verifyEvidenceStatusUnavailable.trim().length).toBeGreaterThanOrEqual(3);
      if (locale !== 'en') {
        expect(ad.disclosureTitle).not.toBe(ARTWORK_DETAILS_I18N.en.disclosureTitle);
        expect(ad.methodHandDrawnNoAi).not.toBe(ARTWORK_DETAILS_I18N.en.methodHandDrawnNoAi);
        expect(ad.verifyStandaloneError).not.toBe(ARTWORK_DETAILS_I18N.en.verifyStandaloneError);
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

  it('provides Next-Gen profiles, policies, Protocol v3, Storage/Google Drive, and Nostr Auth-Only translations for all 13 languages', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const ng = NEXT_GEN_I18N[locale];
      expect(ng.navStorage.trim().length).toBeGreaterThan(3);
      expect(ng.create.profileSectionTitle.trim().length).toBeGreaterThan(3);
      expect(ng.create.policyPresetLabel.trim().length).toBeGreaterThan(3);
      expect(ng.create.qrSizingTitle.trim().length).toBeGreaterThan(3);
      expect(ng.verify.v3MetadataTitle.trim().length).toBeGreaterThan(3);
      expect(ng.storage.driveTitle.trim().length).toBeGreaterThan(5);
      expect(ng.storage.driveConnectBtn.trim().length).toBeGreaterThan(3);
      expect(ng.nostrAuthOnly.bannerTitle.trim().length).toBeGreaterThan(5);
      expect(ng.nostrAuthOnly.bannerBody.trim().length).toBeGreaterThan(15);

      expect(ng.create.policyWarnings['cc0-with-restriction'].trim().length).toBeGreaterThan(10);
      expect(ng.create.policyWarnings['arr-with-commercial-allow'].trim().length).toBeGreaterThan(10);
      expect(ng.create.policyWarnings['nd-with-derivatives-allow'].trim().length).toBeGreaterThan(10);
      expect(ng.create.policyWarnings['nc-with-commercial-allow'].trim().length).toBeGreaterThan(10);

      if (locale !== 'en') {
        expect(ng.navStorage).not.toBe(NEXT_GEN_I18N.en.navStorage);
        expect(ng.create.profileSectionTitle).not.toBe(NEXT_GEN_I18N.en.create.profileSectionTitle);
        expect(ng.storage.driveConnectBtn).not.toBe(NEXT_GEN_I18N.en.storage.driveConnectBtn);
        expect(ng.nostrAuthOnly.bannerTitle).not.toBe(NEXT_GEN_I18N.en.nostrAuthOnly.bannerTitle);
      }
    }
  });

  it('provides Google OAuth homepage overview and privacy disclosures for all 13 languages', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const gc = GOOGLE_COMPLIANCE_I18N[locale];
      expect(gc.homeOverview.appPurposeTitle.trim().length).toBeGreaterThan(5);
      expect(gc.homeOverview.appPurposeBody.trim().length).toBeGreaterThan(20);
      expect(gc.homeOverview.drivePurposeTitle.trim().length).toBeGreaterThan(5);
      expect(gc.homeOverview.drivePurposeBody.trim().length).toBeGreaterThan(20);
      expect(gc.homeOverview.privacyLinkLabel.trim().length).toBeGreaterThan(3);
      expect(gc.privacyPolicyGoogle.sectionTitle.trim().length).toBeGreaterThan(10);
      expect(gc.privacyPolicyGoogle.sectionBody.trim().length).toBeGreaterThan(40);
      expect(gc.privacyPolicyGoogle.tableRowName.trim().length).toBeGreaterThan(5);
      if (locale !== 'en') {
        expect(gc.homeOverview.appPurposeTitle).not.toBe(GOOGLE_COMPLIANCE_I18N.en.homeOverview.appPurposeTitle);
        expect(gc.privacyPolicyGoogle.sectionTitle).not.toBe(GOOGLE_COMPLIANCE_I18N.en.privacyPolicyGoogle.sectionTitle);
      }
    }
  });
});

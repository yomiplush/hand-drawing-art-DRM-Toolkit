
export interface HelpTopic {
  title: string;
  body: string;
}

export interface MinimalUiTranslations {
  nav: {
    createShort: string;
    verifyShort: string;
    menuBtn: string;
    myKeysItem: string;
    keyExchangeItem: string;
    standaloneItem: string;
    settingsSection: string;
    languageLabel: string;
  };
  home: {
    tagline: string;
    subtitle: string;
    createCta: string;
    verifyCta: string;
    helpLabel: string;
    helpTitle: string;
    closeHelp: string;
    helpDocsLink: string;
    helpTutorialLink: string;
    helpItems: [HelpTopic, HelpTopic, HelpTopic, HelpTopic, HelpTopic, HelpTopic];
  };
  create: {
    helpLabel: string;
    helpBody: string;
    step1Title: string;
    step1Hint: string;
    changeImageBtn: string;
    step2Title: string;
    createSigningKeyBtn: string;
    keyRequiredNote: string;
    advancedIdentityLabel: string;
    step3Title: string;
    modeOutsideTitle: string;
    modeOutsideBadge: string;
    modeOutsideDesc: string;
    modeInsideTitle: string;
    modeInsideBadge: string;
    modeInsideDesc: string;
    advancedQrLabel: string;
    outerPreviewNote: string;
    quietZoneLabel: string;
    quietZoneNone: string;
    quietZoneMinimal: string;
    quietZoneCompact: string;
    quietZoneStandard: string;
    step4Title: string;
    signAndDownloadBtn: string;
    technicalDetailsLabel: string;
  };
  verify: {
    helpLabel: string;
    helpBody: string;
    inputTitle: string;
    tabImage: string;
    tabCamera: string;
    tabProof: string;
    dropHint: string;
    sigLabel: string;
    sigValid: string;
    sigInvalid: string;
    sigUnsupported: string;
    sigHelp: string;
    intLabel: string;
    intMatched: string;
    intMismatched: string;
    intNotChecked: string;
    intHelp: string;
    idLabel: string;
    idTrusted: string;
    idUnverified: string;
    idHelp: string;
    detailsLabel: string;
    declaredSummaryTitle: string;
    autoVerifiedBadge: string;
    verifyingProofLabel: string;
    rightsSignalsLabel: string;
  };
  keys: {
    helpLabel: string;
    unbackedAlertShort: string;
  };
  exchange: {
    helpLabel: string;
    helpBody: string;
  };
}

import { EN } from './locales-data/minimalUi/en';
import { JA } from './locales-data/minimalUi/ja';
import type { MinimalUiTranslationsOthers } from './locales-data/minimalUi/others';

export const MINIMAL_UI_I18N_EN: MinimalUiTranslations = EN;
export const MINIMAL_UI_I18N_JA: MinimalUiTranslations = JA;

export async function loadMinimalUiOthers(): Promise<MinimalUiTranslationsOthers> {
  return (await import('./locales-data/minimalUi/others')).OTHERS;
}


export interface HardeningTranslations {
  passphraseStrength: {
    label: string;
    tooShort: string;
    fair: string;
    strong: string;
    guidance: string;
  };
  fingerprint: {
    label: string;
    fullHexLabel: string;
    shortLabel: string;
    copyFullBtn: string;
    copiedFull: string;
    showQrBtn: string;
    hideQrBtn: string;
    qrCaption: string;
  };
  trust: {
    outOfBandNote: string;
    confirmCheckbox: string;
    unconfirmedBadge: string;
    confirmNowBtn: string;
    saveUnconfirmedBtn: string;
    unconfirmedHelp: string;
  };
  challenge: {
    sectionTitle: string;
    sectionSubtitle: string;
    createTitle: string;
    targetPubLabel: string;
    noteLabel: string;
    notePlaceholder: string;
    createBtn: string;
    challengeTokenLabel: string;
    signTitle: string;
    challengeInputLabel: string;
    signKeySelectLabel: string;
    signPassLabel: string;
    signBtn: string;
    responseTokenLabel: string;
    verifyTitle: string;
    responseInputLabel: string;
    verifyBtn: string;
    validResult: string;
    invalidResult: string;
    scopeDisclaimer: string;
  };
  notices: {
    sectionTitle: string;
    sectionSubtitle: string;
    createTitle: string;
    subjectKeyLabel: string;
    typeLabel: string;
    typeRevocation: string;
    typeRotation: string;
    replacementKeyLabel: string;
    reasonLabel: string;
    reasons: {
      'key-compromise': string;
      'key-superseded': string;
      retired: string;
      other: string;
    };
    noteLabel: string;
    passLabel: string;
    createBtn: string;
    downloadBtn: string;
    copyBtn: string;
    compromiseWarning: string;
    importTitle: string;
    importPlaceholder: string;
    importBtn: string;
    importFileBtn: string;
    listTitle: string;
    noNotices: string;
    revokeBadge: string;
    rotateBadge: string;
    issuedAtLabel: string;
    noneLocalInfo: string;
    localMatchBannerRevoked: string;
    localMatchBannerRotated: string;
    historicalValidNote: string;
  };
  similarity: {
    sectionTitle: string;
    badgeNonCrypto: string;
    subtitle: string;
    dropTitle: string;
    compareBtn: string;
    clearBtn: string;
    combinedLabel: string;
    dHashLabel: string;
    pHashLabel: string;
    bandHigh: string;
    bandModerate: string;
    bandLow: string;
    disclaimer: string;
    noBaseline: string;
  };
  qrMaskSafety: {
    coverageLabel: string;
    tierOk: string;
    tierCaution: string;
    tierHigh: string;
    warnCaution: string;
    warnHigh: string;
    highlightToggle: string;
    optimizeSizeBtn: string;
    appliedHint: string;
  };
  docsAddendum: {
    cliTitle: string;
    cliBody: string;
    noticesTitle: string;
    noticesBody: string;
  };
}

import { EN } from './locales-data/hardening/en';
import { JA } from './locales-data/hardening/ja';
import type { HardeningTranslationsOthers } from './locales-data/hardening/others';

export const HARDENING_I18N_EN: HardeningTranslations = EN;
export const HARDENING_I18N_JA: HardeningTranslations = JA;

export async function loadHardeningOthers(): Promise<HardeningTranslationsOthers> {
  return (await import('./locales-data/hardening/others')).OTHERS;
}

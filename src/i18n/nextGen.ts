import type { PolicyWarningCode } from '../core/policies/types';

export interface NextGenTranslations {
  navStorage: string;
  create: {
    profileSectionTitle: string;
    profileSelectorLabel: string;
    profileNewOption: string;
    profileNameLabel: string;
    profileNamePlaceholder: string;
    profileSaveBtn: string;
    profileSetDefaultBtn: string;
    profileDeleteBtn: string;
    profileDefaultBadge: string;
    profileSavedNote: string;
    profilePublicNoteLabel: string;
    profilePublicNotePlaceholder: string;
    profileSnsTitle: string;
    profileAddSnsBtn: string;
    profilePortfolioTitle: string;
    profileAddPortfolioBtn: string;
    profileSnapshotHint: string;
    descriptionLabel: string;
    descriptionPlaceholder: string;
    policyPresetLabel: string;
    policyPresetCustom: string;
    savePresetBtn: string;
    savePresetPlaceholder: string;
    presetSavedNote: string;
    derivativesLabel: string;
    modificationsLabel: string;
    requiresAttributionLabel: string;
    policyNoteLabel: string;
    policyNotePlaceholder: string;
    policyWarnings: Record<PolicyWarningCode, string>;
    qrSizingTitle: string;
    qrTierCompact: string;
    qrTierStandard: string;
    qrTierLarge: string;
    qrTierExceeded: string;
    qrSavingsNote: string;
    qrExceededHint: string;
    qrMetricsToggle: string;
    qrUncompressedLabel: string;
    qrCompressedLabel: string;
    qrProofBytesLabel: string;
    qrUrlCharsLabel: string;
    qrModulesLabel: string;
    qrV3SelfContainedBadge: string;
  };
  verify: {
    v3MetadataTitle: string;
    v3ProfileSnapshotNote: string;
    v3SnsLinksLabel: string;
    v3PortfolioLinksLabel: string;
    v3DerivativesLabel: string;
    v3ModificationsLabel: string;
    v3RequiresAttributionLabel: string;
    v3Yes: string;
    v3No: string;
    v3PolicyNoteLabel: string;
    v3EvidenceHashesTitle: string;
    v3NoExtensionNeededNote: string;
  };
  storage: {
    pageTitle: string;
    pageSubtitle: string;
    sectionBadge: string;
    localTitle: string;
    localDesc: string;
    portableTitle: string;
    portableDesc: string;
    portablePassPlaceholder: string;
    exportChmvaultBtn: string;
    importChmvaultBtn: string;
    portableExportSuccess: string;
    portableImportSuccess: string;
    driveTitle: string;
    driveDesc: string;
    driveConnectBtn: string;
    driveSwitchAccountBtn: string;
    driveConnectedAs: string;
    driveScopeBadge: string;
    driveMemoryNotice: string;
    driveIdentityNotice: string;
    driveStandaloneNotice: string;
    drivePassphraseLabel: string;
    drivePassphrasePlaceholder: string;
    driveUnlockBtn: string;
    driveSyncNowBtn: string;
    driveSyncingBtn: string;
    driveLastSynced: string;
    driveNeverSynced: string;
    drivePendingQueue: string;
    driveDisconnectBtn: string;
    driveRevokeBtn: string;
    driveDisconnectNote: string;
    driveConflictsTitle: string;
    driveKeepLocalBtn: string;
    driveAcceptRemoteBtn: string;
    driveKeepBothBtn: string;
    driveKeyShareTitle: string;
    driveTransferPassPlaceholder: string;
    driveExportKeyShareBtn: string;
    driveImportKeySharePlaceholder: string;
    driveImportKeyShareBtn: string;
    driveRotateEpochBtn: string;
    driveRotateEpochNote: string;
    driveUnlockedMsg: string;
    driveSyncDoneMsg: string;
    driveDisconnectedMsg: string;
  };
  nostrAuthOnly: {
    bannerTitle: string;
    bannerBody: string;
    vaultMovedHint: string;
  };
}

;

;

;

;

;

;

;

;

;

;

;

;

;

import { EN } from './locales-data/nextGen/en';
import { JA } from './locales-data/nextGen/ja';
import type { NextGenTranslationsOthers } from './locales-data/nextGen/others';

export const NEXT_GEN_I18N_EN: NextGenTranslations = EN;
export const NEXT_GEN_I18N_JA: NextGenTranslations = JA;

export async function loadNextGenOthers(): Promise<NextGenTranslationsOthers> {
  return (await import('./locales-data/nextGen/others')).OTHERS;
}

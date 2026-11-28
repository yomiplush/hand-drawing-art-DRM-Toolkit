export interface ArtworkDetailsTranslations {
  disclosureTitle: string;
  disclosureHint: string;
  groupArtwork: string;
  groupCreator: string;
  groupCreation: string;
  groupEvidence: string;
  titleLabel: string;
  titlePlaceholder: string;
  artistLabel: string;
  artistPlaceholder: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  creatorDisplayNameLabel: string;
  creatorDisplayNamePlaceholder: string;
  websiteLabel: string;
  websitePlaceholder: string;
  linksLabel: string;
  linkUrlPlaceholder: string;
  linkLabelPlaceholder: string;
  addLinkBtn: string;
  removeBtn: string;
  saveProfileBtn: string;
  profileSavedNote: string;
  clearProfileBtn: string;
  profileDisclaimer: string;
  creationMethodLabel: string;
  methodNotDeclared: string;
  methodHandDrawnNoAi: string;
  methodHandDrawnAiAssisted: string;
  methodAiGenerated: string;
  methodOtherGroupLabel: string;
  methodOther: string;
  methodPreferNotToDisclose: string;
  softwareLabel: string;
  softwarePlaceholder: string;
  hardwareLabel: string;
  hardwarePlaceholder: string;
  inputDeviceLabel: string;
  inputDevicePlaceholder: string;
  creationNotesLabel: string;
  creationNotesPlaceholder: string;
  declarationHonestyNote: string;
  evidencePickBtn: string;
  evidencePrivacyNote: string;
  evidenceHashingBusy: string;
  evidenceLabelInput: string;
  evidenceCategoryLabel: string;
  catSketch: string;
  catWip: string;
  catIntermediate: string;
  catTimelapse: string;
  catProjectFile: string;
  catOther: string;
  downloadEvidenceBtn: string;
  evidenceSavedBadge: string;
  evidenceSaveReminder: string;
  compactQrNote: string;
  verifySectionTitle: string;
  verifySectionHint: string;
  verifyAttachEvidenceBtn: string;
  verifyAttachFilesBtn: string;
  verifyClearEvidenceBtn: string;
  verifyClearFilesBtn: string;
  verifyStandaloneError: string;
  verifyDetailsPanelTitle: string;
  verifyExtValidBadge: string;
  verifyExtInvalidBadge: string;
  verifyExtMismatchBadge: string;
  verifyExtUnsupportedBadge: string;
  verifyProfileSelfDeclared: string;
  verifyMethodPrefix: string;
  verifyMethodDeclaredSuffix: string;
  verifyStatementOnlyNote: string;
  verifyEvidenceSummaryTitle: string;
  verifyEvidenceVerifiedCount: string;
  verifyEvidenceUnavailableCount: string;
  verifyEvidenceStatusVerified: string;
  verifyEvidenceStatusUnavailable: string;
  verifyEvidenceMismatchTitle: string;
  verifyEvidenceMismatchHint: string;
  verifyMatchedLocalFile: string;
  docsTitle: string;
  docsLead: string;
  docsModesTitle: string;
  docsModeA: string;
  docsModeB: string;
  docsModeC: string;
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

import { EN } from './locales-data/artworkDetails/en';
import { JA } from './locales-data/artworkDetails/ja';
import type { ArtworkDetailsTranslationsOthers } from './locales-data/artworkDetails/others';

export const ARTWORK_DETAILS_I18N_EN: ArtworkDetailsTranslations = EN;
export const ARTWORK_DETAILS_I18N_JA: ArtworkDetailsTranslations = JA;

export async function loadArtworkDetailsOthers(): Promise<ArtworkDetailsTranslationsOthers> {
  return (await import('./locales-data/artworkDetails/others')).OTHERS;
}

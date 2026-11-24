import type { LicenseId, PolicySignal } from '../manifest/types';

export type PolicyWarningCode =
  | 'cc0-with-restriction'
  | 'arr-with-commercial-allow'
  | 'nd-with-derivatives-allow'
  | 'nc-with-commercial-allow'
  | 'non-binding-disclosure';

export interface PolicyValidationWarning {
  code: PolicyWarningCode;
  severity: 'warning' | 'info';
  messageKey: string;
  defaultMessage: string;
}

export interface PolicyPresetInput {
  id?: string;
  name: string;
  description?: string;
  licenseId: LicenseId;
  commercialUse: PolicySignal;
  redistribution: PolicySignal;
  aiTraining: PolicySignal;
  allowsDerivatives?: PolicySignal;
  allowsModifications?: PolicySignal;
  requiresAttribution?: boolean;
  customNote?: string;
  isDefault?: boolean;
}

export interface PolicyPreset extends PolicyPresetInput {
  id: string;
  schemaVersion: 1;
  version: number;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyValidationResult {
  valid: boolean;
  errors: string[];
  warnings: PolicyValidationWarning[];
}

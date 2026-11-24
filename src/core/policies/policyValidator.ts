import { bytesToHex, sha256Sync } from '../crypto/sha256';
import { LICENSE_DEFINITIONS, type LicenseId, type PolicySignal } from '../manifest/types';
import type {
  PolicyPresetInput,
  PolicyValidationResult,
  PolicyValidationWarning,
} from './types';

const utf8Encoder = new TextEncoder();
const VALID_SIGNALS = new Set<PolicySignal>(['unspecified', 'allow', 'disallow']);
const VALID_LICENSES = new Set<LicenseId>(LICENSE_DEFINITIONS.map((l) => l.id));

export function normalizePolicySignal(val: PolicySignal | undefined): PolicySignal {
  return val && VALID_SIGNALS.has(val) ? val : 'unspecified';
}

export function detectPolicyContradictions(policy: {
  licenseId: LicenseId;
  commercialUse: PolicySignal;
  redistribution: PolicySignal;
  aiTraining: PolicySignal;
  allowsDerivatives?: PolicySignal;
  allowsModifications?: PolicySignal;
}): PolicyValidationWarning[] {
  const warnings: PolicyValidationWarning[] = [];

  if (
    policy.licenseId === 'CC0-1.0' &&
    (policy.commercialUse === 'disallow' ||
      policy.redistribution === 'disallow' ||
      policy.aiTraining === 'disallow' ||
      policy.allowsDerivatives === 'disallow' ||
      policy.allowsModifications === 'disallow')
  ) {
    warnings.push({
      code: 'cc0-with-restriction',
      severity: 'warning',
      messageKey: 'policy.warning.cc0Restriction',
      defaultMessage:
        'CC0 1.0 dedicates the work to the public domain without legal restrictions. Disallow flags serve only as a non-binding creator preference note.',
    });
  }

  if (
    policy.licenseId === 'ARR' &&
    (policy.commercialUse === 'allow' ||
      policy.redistribution === 'allow' ||
      policy.allowsDerivatives === 'allow' ||
      policy.allowsModifications === 'allow')
  ) {
    warnings.push({
      code: 'arr-with-commercial-allow',
      severity: 'warning',
      messageKey: 'policy.warning.arrAllow',
      defaultMessage:
        'All Rights Reserved is paired with an allow preference flag. Consider selecting a Creative Commons license (e.g., CC BY or CC BY-NC) to express permissive permissions unambiguously.',
    });
  }

  if (
    (policy.licenseId === 'CC-BY-ND-4.0' || policy.licenseId === 'CC-BY-NC-ND-4.0') &&
    (policy.allowsDerivatives === 'allow' || policy.allowsModifications === 'allow')
  ) {
    warnings.push({
      code: 'nd-with-derivatives-allow',
      severity: 'warning',
      messageKey: 'policy.warning.ndDerivativesAllow',
      defaultMessage:
        'NoDerivatives (ND) licenses disallow distributing adapted or modified versions, which conflicts with allowing derivatives or modifications.',
    });
  }

  if (
    (policy.licenseId === 'CC-BY-NC-4.0' ||
      policy.licenseId === 'CC-BY-NC-SA-4.0' ||
      policy.licenseId === 'CC-BY-NC-ND-4.0') &&
    policy.commercialUse === 'allow'
  ) {
    warnings.push({
      code: 'nc-with-commercial-allow',
      severity: 'warning',
      messageKey: 'policy.warning.ncCommercialAllow',
      defaultMessage:
        'NonCommercial (NC) licenses forbid commercial use, which conflicts with marking commercial use as allowed.',
    });
  }

  warnings.push({
    code: 'non-binding-disclosure',
    severity: 'info',
    messageKey: 'policy.warning.nonBindingDisclosure',
    defaultMessage:
      'Cryptographic policy flags declare author intent inside signed provenance records. They are machine-readable declarations, not automated legal or technical enforcement.',
  });

  return warnings;
}

export function validatePolicyPreset(input: PolicyPresetInput): PolicyValidationResult {
  const errors: string[] = [];
  const trimmedName = typeof input.name === 'string' ? input.name.trim() : '';
  if (!trimmedName) {
    errors.push('Policy preset name is required');
  } else if (trimmedName.length > 64) {
    errors.push('Policy preset name must be 64 characters or fewer');
  }

  if (!VALID_LICENSES.has(input.licenseId)) {
    errors.push(`Unsupported licenseId: ${String(input.licenseId)}`);
  }

  if (!VALID_SIGNALS.has(input.commercialUse)) {
    errors.push('Invalid commercialUse policy signal');
  }
  if (!VALID_SIGNALS.has(input.redistribution)) {
    errors.push('Invalid redistribution policy signal');
  }
  if (!VALID_SIGNALS.has(input.aiTraining)) {
    errors.push('Invalid aiTraining policy signal');
  }
  if (input.allowsDerivatives !== undefined && !VALID_SIGNALS.has(input.allowsDerivatives)) {
    errors.push('Invalid allowsDerivatives policy signal');
  }
  if (input.allowsModifications !== undefined && !VALID_SIGNALS.has(input.allowsModifications)) {
    errors.push('Invalid allowsModifications policy signal');
  }

  if (input.description && input.description.trim().length > 240) {
    errors.push('Policy preset description must be 240 characters or fewer');
  }
  if (input.customNote && input.customNote.trim().length > 240) {
    errors.push('Policy custom note must be 240 characters or fewer');
  }

  const warnings = VALID_LICENSES.has(input.licenseId)
    ? detectPolicyContradictions({
        licenseId: input.licenseId,
        commercialUse: normalizePolicySignal(input.commercialUse),
        redistribution: normalizePolicySignal(input.redistribution),
        aiTraining: normalizePolicySignal(input.aiTraining),
        allowsDerivatives: normalizePolicySignal(input.allowsDerivatives),
        allowsModifications: normalizePolicySignal(input.allowsModifications),
      })
    : [];

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function computePolicyPresetHash(input: PolicyPresetInput): string {
  const canonical = JSON.stringify({
    name: input.name.trim().slice(0, 64),
    description: input.description?.trim().slice(0, 240) || undefined,
    licenseId: input.licenseId,
    commercialUse: normalizePolicySignal(input.commercialUse),
    redistribution: normalizePolicySignal(input.redistribution),
    aiTraining: normalizePolicySignal(input.aiTraining),
    allowsDerivatives: normalizePolicySignal(input.allowsDerivatives),
    allowsModifications: normalizePolicySignal(input.allowsModifications),
    requiresAttribution: Boolean(input.requiresAttribution),
    customNote: input.customNote?.trim().slice(0, 240) || undefined,
  });
  return bytesToHex(sha256Sync(utf8Encoder.encode(canonical)));
}

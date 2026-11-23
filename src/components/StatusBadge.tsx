import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type {
  ArtworkIntegrityStatus,
  AuthorIdentityStatus,
  SignatureStatus,
  VerificationResult,
} from '../core/manifest/types';
import { useI18n } from '../i18n/context';
import { CompactStatus } from './ui/CompactStatus';
import type { StatusTone } from './ui/CompactStatus';

interface StatusGridProps {
  signatureStatus: SignatureStatus;
  integrityStatus: ArtworkIntegrityStatus;
  identityStatus: AuthorIdentityStatus;
  trustedKeyLabel?: string | null;
  trustedKeyUnconfirmed?: boolean;
  matchedMode?: VerificationResult['matchedMode'];
}

interface RowSpec {
  tone: StatusTone;
  icon: typeof CheckCircle2;
  text: string;
}

export function StatusDimensionsGrid({
  signatureStatus,
  integrityStatus,
  identityStatus,
  trustedKeyLabel,
  trustedKeyUnconfirmed = false,
  matchedMode,
}: StatusGridProps) {
  const { t } = useI18n();
  const mv = t.minimal.verify;

  const sigMap: Record<SignatureStatus, RowSpec> = {
    valid: {
      tone: 'success',
      icon: CheckCircle2,
      text: mv.sigValid,
    },
    invalid: {
      tone: 'danger',
      icon: XCircle,
      text: mv.sigInvalid,
    },
    unsupported: {
      tone: 'warning',
      icon: AlertTriangle,
      text: mv.sigUnsupported,
    },
  };

  const intMap: Record<ArtworkIntegrityStatus, RowSpec> = {
    matched: {
      tone: 'success',
      icon: CheckCircle2,
      text: mv.intMatched,
    },
    mismatched: {
      tone: 'danger',
      icon: XCircle,
      text: mv.intMismatched,
    },
    'not-checked': {
      tone: 'warning',
      icon: HelpCircle,
      text: mv.intNotChecked,
    },
  };

  const idMap: Record<AuthorIdentityStatus, RowSpec> = {
    'locally-trusted': {
      tone: 'success',
      icon: ShieldCheck,
      text: trustedKeyLabel ? `${mv.idTrusted} (${trustedKeyLabel})` : mv.idTrusted,
    },
    unknown: {
      tone: 'warning',
      icon: ShieldAlert,
      text: mv.idUnverified,
    },
  };

  const sigRow = sigMap[signatureStatus];
  const intRow = intMap[integrityStatus];
  const idRow = idMap[identityStatus];

  const SigIcon = sigRow.icon;
  const IntIcon = intRow.icon;
  const IdIcon = idRow.icon;

  return (
    <div className="space-y-2.5">
      <CompactStatus
        testId="status-signature"
        helpTestId="status-signature-help"
        label={mv.sigLabel}
        value={sigRow.text}
        tone={sigRow.tone}
        icon={<SigIcon className="h-5 w-5" />}
        helpText={mv.sigHelp}
        helpLabel={`${mv.sigLabel} — ?`}
        helpCloseLabel={t.minimal.home.closeHelp}
      />

      <CompactStatus
        testId="status-integrity"
        helpTestId="status-integrity-help"
        label={mv.intLabel}
        value={intRow.text}
        tone={intRow.tone}
        icon={<IntIcon className="h-5 w-5" />}
        extra={
          matchedMode ? (
            <span className="rounded bg-black/25 border border-white/15 px-2 py-0.5 text-[11px] font-mono opacity-90">
              {matchedMode}
            </span>
          ) : undefined
        }
        helpText={mv.intHelp}
        helpLabel={`${mv.intLabel} — ?`}
        helpCloseLabel={t.minimal.home.closeHelp}
      />

      <CompactStatus
        testId="status-identity"
        helpTestId="status-identity-help"
        label={mv.idLabel}
        value={idRow.text}
        tone={idRow.tone}
        icon={<IdIcon className="h-5 w-5" />}
        extra={
          trustedKeyUnconfirmed && identityStatus === 'unknown' ? (
            <span className="rounded bg-amber-500/20 border border-amber-400/35 px-2 py-0.5 text-[11px] text-amber-100">
              {t.hardening.trust.unconfirmedBadge}
            </span>
          ) : undefined
        }
        helpText={mv.idHelp}
        helpLabel={`${mv.idLabel} — ?`}
        helpCloseLabel={t.minimal.home.closeHelp}
      />
    </div>
  );
}

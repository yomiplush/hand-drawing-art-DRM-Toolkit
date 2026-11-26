import {
  AlertTriangle,
  CheckCircle2,
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
  identityStatus,
  trustedKeyLabel,
  trustedKeyUnconfirmed = false,
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
  const idRow = idMap[identityStatus];

  const SigIcon = sigRow.icon;
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
        testId="status-identity"
        helpTestId="status-identity-help"
        label={mv.idLabel}
        value={idRow.text}
        tone={idRow.tone}
        icon={<IdIcon className="h-5 w-5" />}
        extra={
          trustedKeyUnconfirmed && identityStatus === 'unknown' ? (
            <span className="rounded-md ga-status-warning border px-2 py-0.5 text-[11px]">
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

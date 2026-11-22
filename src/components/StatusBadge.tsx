import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  HelpCircle,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type {
  ArtworkIntegrityStatus,
  AuthorIdentityStatus,
  HumanMadeAssessmentStatus,
  SignatureStatus,
} from '../core/manifest/types';
import { useI18n } from '../i18n/context';

interface StatusGridProps {
  signatureStatus: SignatureStatus;
  integrityStatus: ArtworkIntegrityStatus;
  identityStatus: AuthorIdentityStatus;
  assessmentStatus: HumanMadeAssessmentStatus;
  trustedKeyLabel?: string | null;
}

export function StatusDimensionsGrid({
  signatureStatus,
  integrityStatus,
  identityStatus,
  assessmentStatus,
  trustedKeyLabel,
}: StatusGridProps) {
  const { t } = useI18n();

  const sigCard = {
    valid: {
      tone: 'border-sky-300/35 bg-[#05162b]/75 text-sky-100',
      icon: CheckCircle2,
      text: t.verify.badges.sigValid,
    },
    invalid: {
      tone: 'border-rose-500/45 bg-rose-950/50 text-rose-100',
      icon: XCircle,
      text: t.verify.badges.sigInvalid,
    },
    unsupported: {
      tone: 'border-amber-400/40 bg-amber-950/40 text-amber-100',
      icon: AlertTriangle,
      text: t.verify.badges.sigUnsupported,
    },
  }[signatureStatus];

  const intCard = {
    matched: {
      tone: 'border-sky-300/35 bg-[#05162b]/75 text-sky-100',
      icon: CheckCircle2,
      text: t.verify.badges.intMatched,
    },
    mismatched: {
      tone: 'border-rose-500/45 bg-rose-950/50 text-rose-100',
      icon: XCircle,
      text: t.verify.badges.intMismatched,
    },
    'not-checked': {
      tone: 'border-amber-400/35 bg-amber-950/35 text-amber-100',
      icon: HelpCircle,
      text: t.verify.badges.intNotChecked,
    },
  }[integrityStatus];

  const idCard = {
    'locally-trusted': {
      tone: 'border-emerald-400/40 bg-emerald-950/40 text-emerald-100',
      icon: ShieldCheck,
      text: trustedKeyLabel
        ? `${t.verify.badges.idTrusted} (${trustedKeyLabel})`
        : t.verify.badges.idTrusted,
    },
    unknown: {
      tone: 'border-amber-400/35 bg-amber-950/35 text-amber-100',
      icon: ShieldAlert,
      text: t.verify.badges.idUnknown,
    },
  }[identityStatus];

  const assessCard = {
    'not-assessed': {
      tone: 'border-white/[0.1] bg-[#051224]/70 text-slate-300',
      icon: Cpu,
      text: t.verify.badges.assessNotAssessed,
    },
    'experimental-available': {
      tone: 'border-sky-300/35 bg-[#05162b]/75 text-sky-100',
      icon: Cpu,
      text: t.verify.badges.assessExperimental,
    },
    inconclusive: {
      tone: 'border-white/[0.12] bg-[#051224]/70 text-slate-300',
      icon: HelpCircle,
      text: t.verify.badges.assessInconclusive,
    },
  }[assessmentStatus];

  const cards = [
    { key: 'sig', title: t.verify.dimA, ...sigCard, testId: 'status-signature' },
    { key: 'int', title: t.verify.dimB, ...intCard, testId: 'status-integrity' },
    { key: 'id', title: t.verify.dimC, ...idCard, testId: 'status-identity' },
    { key: 'assess', title: t.verify.dimD, ...assessCard, testId: 'status-assessment' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.key}
            data-testid={card.testId}
            className={`rounded-xl border backdrop-blur-md p-4 ${card.tone}`}
          >
            <div className="text-xs font-medium uppercase tracking-wider opacity-75 mb-1.5">
              {card.title}
            </div>
            <div className="flex items-center gap-2 font-semibold text-sm sm:text-base">
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>{card.text}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

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
      tone: 'border-cyan-400/40 bg-cyan-500/10 text-cyan-200',
      icon: CheckCircle2,
      text: t.verify.badges.sigValid,
    },
    invalid: {
      tone: 'border-rose-500/50 bg-rose-500/15 text-rose-200',
      icon: XCircle,
      text: t.verify.badges.sigInvalid,
    },
    unsupported: {
      tone: 'border-amber-400/40 bg-amber-500/15 text-amber-200',
      icon: AlertTriangle,
      text: t.verify.badges.sigUnsupported,
    },
  }[signatureStatus];

  const intCard = {
    matched: {
      tone: 'border-cyan-400/40 bg-cyan-500/10 text-cyan-200',
      icon: CheckCircle2,
      text: t.verify.badges.intMatched,
    },
    mismatched: {
      tone: 'border-rose-500/50 bg-rose-500/15 text-rose-200',
      icon: XCircle,
      text: t.verify.badges.intMismatched,
    },
    'not-checked': {
      tone: 'border-amber-400/35 bg-amber-500/10 text-amber-200',
      icon: HelpCircle,
      text: t.verify.badges.intNotChecked,
    },
  }[integrityStatus];

  const idCard = {
    'locally-trusted': {
      tone: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
      icon: ShieldCheck,
      text: trustedKeyLabel
        ? `${t.verify.badges.idTrusted} (${trustedKeyLabel})`
        : t.verify.badges.idTrusted,
    },
    unknown: {
      tone: 'border-amber-400/35 bg-amber-500/10 text-amber-200',
      icon: ShieldAlert,
      text: t.verify.badges.idUnknown,
    },
  }[identityStatus];

  const assessCard = {
    'not-assessed': {
      tone: 'border-slate-700 bg-slate-900/70 text-slate-300',
      icon: Cpu,
      text: t.verify.badges.assessNotAssessed,
    },
    'experimental-available': {
      tone: 'border-sky-400/35 bg-sky-500/10 text-sky-200',
      icon: Cpu,
      text: t.verify.badges.assessExperimental,
    },
    inconclusive: {
      tone: 'border-slate-600 bg-slate-800/70 text-slate-300',
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
            className={`rounded-xl border p-4 ${card.tone}`}
          >
            <div className="text-xs font-medium uppercase tracking-wider opacity-80 mb-1.5">
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

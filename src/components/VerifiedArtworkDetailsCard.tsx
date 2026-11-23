
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  ExternalLink,
  FileCheck2,
  HelpCircle,
  Info,
  ShieldAlert,
  User,
} from 'lucide-react';
import { sanitizeProfileUrl } from '../core/manifest/evidenceExtension';
import type {
  CreationMethod,
  EvidenceCategory,
  EvidenceVerificationSummary,
} from '../core/manifest/types';
import { useI18n } from '../i18n/context';
import { AdvancedSettings } from './ui/AdvancedSettings';

function isSafeExternalUrl(raw: string): boolean {
  try {
    return sanitizeProfileUrl(raw) !== undefined;
  } catch {
    return false;
  }
}

export function VerifiedArtworkDetailsCard({
  summary,
}: {
  summary: EvidenceVerificationSummary;
}) {
  const { t } = useI18n();

  if (summary.status === 'none' || summary.status === 'missing-primary-proof') {
    return null;
  }

  const formatCreationMethod = (method: CreationMethod): string => {
    switch (method) {
      case 'hand-drawn-no-ai':
        return t.artworkDetails.methodHandDrawnNoAi;
      case 'hand-drawn-ai-assisted':
        return t.artworkDetails.methodHandDrawnAiAssisted;
      case 'ai-generated':
        return t.artworkDetails.methodAiGenerated;
      case 'other':
        return t.artworkDetails.methodOther;
      case 'prefer-not-to-disclose':
        return t.artworkDetails.methodPreferNotToDisclose;
    }
  };

  const formatCategory = (cat?: EvidenceCategory): string => {
    switch (cat) {
      case 'sketch':
        return t.artworkDetails.catSketch;
      case 'wip':
        return t.artworkDetails.catWip;
      case 'intermediate':
        return t.artworkDetails.catIntermediate;
      case 'timelapse':
        return t.artworkDetails.catTimelapse;
      case 'project-file':
        return t.artworkDetails.catProjectFile;
      default:
        return t.artworkDetails.catOther;
    }
  };

  const statusTone =
    summary.status === 'valid'
      ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200'
      : summary.status === 'unsupported'
        ? 'border-amber-400/35 bg-amber-500/10 text-amber-200'
        : 'border-rose-400/40 bg-rose-500/15 text-rose-200';

  const statusText =
    summary.status === 'valid'
      ? t.artworkDetails.verifyExtValidBadge
      : summary.status === 'binding-mismatch'
        ? t.artworkDetails.verifyExtMismatchBadge
        : summary.status === 'unsupported'
          ? t.artworkDetails.verifyExtUnsupportedBadge
          : t.artworkDetails.verifyExtInvalidBadge;

  const ext = summary.extension;

  return (
    <AdvancedSettings
      label={t.artworkDetails.verifyDetailsPanelTitle}
      summary={statusText}
      defaultOpen
      testId="verify-artwork-details-panel"
    >
      <div className="space-y-4">
        <div
          data-testid="verify-extension-status-badge"
          className={`rounded-xl border px-3.5 py-2.5 flex items-center gap-2.5 text-xs sm:text-sm font-semibold ${statusTone}`}
        >
          {summary.status === 'valid' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>{statusText}</span>
          {summary.evidenceBytesLength != null && (
            <span className="ms-auto font-mono text-[11px] opacity-80">
              {summary.evidenceBytesLength} bytes
            </span>
          )}
        </div>

        {summary.errors.length > 0 && (
          <div
            role="alert"
            data-testid="verify-extension-errors"
            className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 space-y-1 text-xs text-rose-200"
          >
            {summary.errors.map((err, i) => (
              <p key={i}>{err}</p>
            ))}
          </div>
        )}

        {ext && summary.status === 'valid' && (
          <div className="space-y-4">
            {/* Artwork metadata */}
            {ext.artworkMetadata && (
              <div
                data-testid="verify-ext-artwork-metadata"
                className="rounded-xl border border-white/[0.08] bg-[#030b18]/65 p-4 space-y-2.5"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-sky-200">
                  <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{t.artworkDetails.groupArtwork}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                  {ext.artworkMetadata.title && (
                    <div>
                      <div className="text-[11px] text-slate-400">{t.artworkDetails.titleLabel}</div>
                      <div className="font-medium text-white break-words">
                        {ext.artworkMetadata.title}
                      </div>
                    </div>
                  )}
                  {ext.artworkMetadata.artistName && (
                    <div>
                      <div className="text-[11px] text-slate-400">{t.artworkDetails.artistLabel}</div>
                      <div className="font-medium text-white break-words">
                        {ext.artworkMetadata.artistName}
                      </div>
                    </div>
                  )}
                </div>
                {ext.artworkMetadata.description && (
                  <div>
                    <div className="text-[11px] text-slate-400">
                      {t.artworkDetails.descriptionLabel}
                    </div>
                    <p className="text-xs sm:text-sm text-slate-200 whitespace-pre-wrap break-words mt-0.5 leading-relaxed">
                      {ext.artworkMetadata.description}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Creator profile */}
            {ext.creatorProfile && (
              <div
                data-testid="verify-ext-creator-profile"
                className="rounded-xl border border-white/[0.08] bg-[#030b18]/65 p-4 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-semibold text-sky-200">
                    <User className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{t.artworkDetails.groupCreator}</span>
                  </span>
                  <span className="rounded-full border border-white/[0.12] bg-[#020813]/75 px-2.5 py-0.5 text-[10px] text-slate-300">
                    {t.artworkDetails.verifyProfileSelfDeclared}
                  </span>
                </div>

                {ext.creatorProfile.displayName && (
                  <div className="text-sm font-medium text-white break-words">
                    {ext.creatorProfile.displayName}
                  </div>
                )}

                {ext.creatorProfile.website && isSafeExternalUrl(ext.creatorProfile.website) && (
                  <div>
                    <a
                      href={ext.creatorProfile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-sky-300 hover:text-sky-200 underline underline-offset-4 break-all"
                    >
                      <span>{ext.creatorProfile.website}</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    </a>
                  </div>
                )}

                {ext.creatorProfile.links && ext.creatorProfile.links.length > 0 && (
                  <ul className="flex flex-wrap gap-2 pt-1">
                    {ext.creatorProfile.links.map((link, idx) =>
                      isSafeExternalUrl(link.url) ? (
                        <li key={idx}>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] bg-[#020813]/75 px-3 py-1.5 text-xs text-sky-200 hover:border-sky-400/40 break-all"
                          >
                            <span>{link.label ? `${link.label}: ${link.url}` : link.url}</span>
                            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                          </a>
                        </li>
                      ) : null,
                    )}
                  </ul>
                )}
              </div>
            )}

            {/* Creation Method & Environment */}
            {(ext.creationMethod !== undefined || ext.creationEnvironment) && (
              <div
                data-testid="verify-ext-creation"
                className="rounded-xl border border-white/[0.08] bg-[#030b18]/65 p-4 space-y-3"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-sky-200">
                  <Cpu className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{t.artworkDetails.groupCreation}</span>
                </div>

                {ext.creationMethod && (
                  <div
                    data-testid="verify-ext-creation-method"
                    className="rounded-lg border border-sky-400/25 bg-sky-500/10 px-3 py-2 text-xs sm:text-sm text-sky-100"
                  >
                    <span className="font-semibold">
                      {t.artworkDetails.verifyMethodPrefix}{' '}
                      {formatCreationMethod(ext.creationMethod)}{' '}
                      {t.artworkDetails.verifyMethodDeclaredSuffix}
                    </span>
                  </div>
                )}

                {ext.creationEnvironment && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    {ext.creationEnvironment.software && (
                      <div className="rounded-lg border border-white/[0.08] bg-[#020813]/70 p-2.5">
                        <div className="text-[11px] text-slate-400">
                          {t.artworkDetails.softwareLabel}
                        </div>
                        <div className="text-white mt-0.5 break-words">
                          {ext.creationEnvironment.software}
                        </div>
                      </div>
                    )}
                    {ext.creationEnvironment.hardware && (
                      <div className="rounded-lg border border-white/[0.08] bg-[#020813]/70 p-2.5">
                        <div className="text-[11px] text-slate-400">
                          {t.artworkDetails.hardwareLabel}
                        </div>
                        <div className="text-white mt-0.5 break-words">
                          {ext.creationEnvironment.hardware}
                        </div>
                      </div>
                    )}
                    {ext.creationEnvironment.inputDevice && (
                      <div className="rounded-lg border border-white/[0.08] bg-[#020813]/70 p-2.5">
                        <div className="text-[11px] text-slate-400">
                          {t.artworkDetails.inputDeviceLabel}
                        </div>
                        <div className="text-white mt-0.5 break-words">
                          {ext.creationEnvironment.inputDevice}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {ext.creationEnvironment?.notes && (
                  <div>
                    <div className="text-[11px] text-slate-400">
                      {t.artworkDetails.creationNotesLabel}
                    </div>
                    <p className="text-xs text-slate-200 whitespace-pre-wrap break-words mt-0.5">
                      {ext.creationEnvironment.notes}
                    </p>
                  </div>
                )}

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {t.artworkDetails.verifyStatementOnlyNote}
                </p>
              </div>
            )}

            {/* Evidence Records */}
            {summary.recordChecks.length > 0 && (
              <div
                data-testid="verify-ext-evidence-records"
                className="rounded-xl border border-white/[0.08] bg-[#030b18]/65 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-semibold text-sky-200">
                    <FileCheck2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{t.artworkDetails.verifyEvidenceSummaryTitle}</span>
                  </span>
                  <div className="flex flex-wrap gap-2 text-xs font-mono">
                    {summary.verifiedRecordCount > 0 && (
                      <span
                        data-testid="verify-evidence-verified-count"
                        className="rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-0.5 text-emerald-200"
                      >
                        {summary.verifiedRecordCount} {t.artworkDetails.verifyEvidenceVerifiedCount}
                      </span>
                    )}
                    {summary.unavailableRecordCount > 0 && (
                      <span
                        data-testid="verify-evidence-unavailable-count"
                        className="rounded-full border border-white/[0.14] bg-[#020813]/75 px-2.5 py-0.5 text-slate-300"
                      >
                        {summary.unavailableRecordCount}{' '}
                        {t.artworkDetails.verifyEvidenceUnavailableCount}
                      </span>
                    )}
                  </div>
                </div>

                <ul className="space-y-2">
                  {summary.recordChecks.map((rec) => (
                    <li
                      key={rec.index}
                      data-testid={`verify-evidence-record-${rec.index}`}
                      className="rounded-lg border border-white/[0.08] bg-[#020813]/75 p-3 space-y-1.5 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-white break-words">
                          {rec.label || `Evidence #${rec.index + 1}`}
                          <span className="ms-2 rounded bg-white/[0.08] px-2 py-0.5 text-[10px] text-slate-300">
                            {formatCategory(rec.category)}
                          </span>
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                            rec.status === 'verified'
                              ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                              : 'border-white/[0.14] bg-white/[0.05] text-slate-300'
                          }`}
                        >
                          {rec.status === 'verified' ? (
                            <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                          ) : (
                            <HelpCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
                          )}
                          <span>
                            {rec.status === 'verified'
                              ? t.artworkDetails.verifyEvidenceStatusVerified
                              : t.artworkDetails.verifyEvidenceStatusUnavailable}
                          </span>
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-400 break-all">
                        SHA-256: {rec.sha256Hex} · {rec.byteLength.toLocaleString()} bytes
                        {rec.matchedFileName && (
                          <span className="ms-2 text-emerald-300">
                            ({t.artworkDetails.verifyMatchedLocalFile} {rec.matchedFileName})
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Mismatched local supplied files */}
            {summary.mismatchedSuppliedFiles.length > 0 && (
              <div
                role="alert"
                data-testid="verify-evidence-mismatched-files"
                className="rounded-xl border border-rose-400/40 bg-rose-500/15 p-4 space-y-2 text-xs text-rose-100"
              >
                <div className="flex items-center gap-2 font-semibold text-rose-200">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{t.artworkDetails.verifyEvidenceMismatchTitle}</span>
                </div>
                <p>{t.artworkDetails.verifyEvidenceMismatchHint}</p>
                <ul className="space-y-1 font-mono text-[11px] text-rose-200 break-all">
                  {summary.mismatchedSuppliedFiles.map((f, idx) => (
                    <li key={idx}>
                      {f.fileName} ({f.byteLength.toLocaleString()} bytes) · SHA-256:{' '}
                      {f.computedSha256Hex}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </AdvancedSettings>
  );
}

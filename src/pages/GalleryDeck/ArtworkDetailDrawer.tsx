import { useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  FileSignature,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { HelpTip } from '../../components/HelpTip';
import { LICENSE_DEFINITIONS } from '../../core/manifest/types';
import type { LicenseId } from '../../core/manifest/types';
import { useI18n } from '../../i18n/context';
import type { GalleryArtworkItem } from '../../types/gallerydeck';

interface ArtworkDetailDrawerProps {
  item: GalleryArtworkItem | null;
  busyAction: 'certify' | 'verify' | null;
  onClose: () => void;
  onCertify: (
    item: GalleryArtworkItem,
    licenseId: LicenseId,
    qrMode: 'in-image' | 'outer-border',
  ) => Promise<void>;
  onVerify: (item: GalleryArtworkItem) => Promise<void>;
  onDownload: (item: GalleryArtworkItem) => Promise<void>;
  onDelete: (item: GalleryArtworkItem) => void;
}

export function ArtworkDetailDrawer({
  item,
  busyAction,
  onClose,
  onCertify,
  onVerify,
  onDownload,
  onDelete,
}: ArtworkDetailDrawerProps) {
  const { t } = useI18n();
  const gd = t.galleryDeck;
  const [selectedLicense, setSelectedLicense] = useState<LicenseId>(item?.licenseId ?? 'ARR');
  const [selectedQrMode, setSelectedQrMode] = useState<'in-image' | 'outer-border'>('in-image');
  const [copiedProof, setCopiedProof] = useState(false);

  if (!item) return null;

  const handleCopyProof = async () => {
    if (!item.proofUrl) return;
    try {
      await navigator.clipboard.writeText(item.proofUrl);
      setCopiedProof(true);
      setTimeout(() => setCopiedProof(false), 2000);
    } catch {
      // ignore clipboard error in restricted contexts
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.title || gd.title}
      data-testid="gallerydeck-detail-drawer"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border ga-border-strong ga-surface-solid ga-text shadow-[var(--ga-shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={gd.closeDetails}
          data-testid="gallerydeck-close-drawer"
          className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full ga-surface-subtle border ga-border ga-text-secondary hover:text-[var(--ga-text)] cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 sm:p-7">
          {/* Artwork Preview */}
          <div className="flex flex-col gap-3">
            <div className="relative overflow-hidden rounded-xl border ga-border bg-[var(--ga-bg-tint)] aspect-[4/3] flex items-center justify-center">
              {item.thumbnailDataUrl ? (
                <img
                  src={item.thumbnailDataUrl}
                  alt={item.title}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="ga-text-muted text-sm">{gd.noPreview}</div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {item.provenanceStatus === 'signed' && (
                <span
                  data-testid="detail-status-signed"
                  className="inline-flex items-center gap-1 rounded-full border ga-status-success px-2.5 py-1 font-semibold"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {gd.badgeVerified}
                </span>
              )}
              {item.provenanceStatus === 'unverified' && (
                <span
                  data-testid="detail-status-unverified"
                  className="inline-flex items-center gap-1 rounded-full border ga-status-warning px-2.5 py-1 font-semibold"
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  {gd.badgeUnverified}
                </span>
              )}
              {item.provenanceStatus === 'invalid' && (
                <span
                  data-testid="detail-status-invalid"
                  className="inline-flex items-center gap-1 rounded-full border ga-status-error px-2.5 py-1 font-semibold"
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  {gd.badgeInvalid}
                </span>
              )}
              {item.qrMode !== 'none' && (
                <span className="inline-flex items-center gap-1 rounded-full border ga-border-strong ga-surface-subtle px-2.5 py-1 ga-text-secondary font-medium">
                  <QrCode className="h-3.5 w-3.5 ga-text-accent" />
                  {gd.badgeQrBurned}
                </span>
              )}
              {item.licenseId && (
                <span className="inline-flex items-center rounded-full ga-surface-subtle border ga-border px-2.5 py-1 ga-text-secondary font-medium">
                  {item.licenseId}
                </span>
              )}
            </div>
          </div>

          {/* Provenance Metadata & Actions */}
          <div className="flex flex-col justify-between gap-5">
            <div className="space-y-4">
              {(item.title || item.authorName) && (
                <div>
                  {item.title && (
                    <h2 className="text-xl sm:text-2xl font-bold ga-text pr-8">{item.title}</h2>
                  )}
                  {item.authorName && (
                    <p className="text-sm ga-text-muted mt-0.5">{item.authorName}</p>
                  )}
                </div>
              )}

              <dl className="grid grid-cols-2 gap-3 rounded-xl ga-surface-subtle border ga-border p-3.5 text-xs">
                <div>
                  <dt className="ga-text-muted">{gd.metaDimensions}</dt>
                  <dd className="font-mono ga-text mt-0.5">
                    {item.width} × {item.height} px
                  </dd>
                </div>
                <div>
                  <dt className="ga-text-muted">{gd.metaTimestamp}</dt>
                  <dd className="font-mono ga-text mt-0.5">
                    {new Date(item.updatedAt).toLocaleDateString()}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="ga-text-muted">{gd.metaFingerprint}</dt>
                  <dd className="font-mono ga-text-accent mt-0.5 break-all">
                    {item.publicKeyFingerprint ?? '—'}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="ga-text-muted">{gd.metaPixelHash}</dt>
                  <dd className="font-mono ga-text-secondary mt-0.5 break-all text-[11px]">
                    {item.artworkSha256Hex ? `${item.artworkSha256Hex.slice(0, 32)}…` : '—'}
                  </dd>
                </div>
                {item.verificationSummary && (
                  <div className="col-span-2">
                    <dt className="ga-text-muted">{gd.metaVerification}</dt>
                    <dd className="ga-text font-medium mt-0.5">{item.verificationSummary}</dd>
                  </div>
                )}
                {item.sourceProjectFormat && item.sourceCommitmentHash && (
                  <div className="col-span-2" data-testid="drawer-source-project-meta">
                    <dt className="ga-text-muted">Source Project</dt>
                    <dd className="font-mono text-[11px] ga-text-accent mt-0.5 break-all">
                      {item.sourceProjectFormat}
                      {item.sourceLayerCount ? ` (${item.sourceLayerCount} layers)` : ''} ·{' '}
                      {item.sourceCommitmentHash.slice(0, 16)}…
                    </dd>
                  </div>
                )}
              </dl>

              {item.provenanceStatus !== 'signed' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs ga-text-secondary font-medium">
                      {gd.selectLicenseLabel}
                    </label>
                    <HelpTip
                      label={gd.selectLicenseLabel}
                      text={t.simple.create.backupTipText}
                    />
                  </div>
                  <select
                    value={selectedLicense}
                    onChange={(e) => setSelectedLicense(e.target.value as LicenseId)}
                    className="w-full rounded-xl ga-surface-solid border ga-border-strong px-3 py-2 text-sm ga-text"
                  >
                    {LICENSE_DEFINITIONS.map((lic) => (
                      <option key={lic.id} value={lic.id}>
                        {lic.id} — {lic.shortLabel}
                      </option>
                    ))}
                  </select>

                  <div className="pt-1 space-y-1.5">
                    <label className="text-xs ga-text-secondary font-medium block">
                      {t.simple.create.qrStyleLabel}
                    </label>
                    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.simple.create.qrStyleLabel}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selectedQrMode === 'in-image'}
                        onClick={() => setSelectedQrMode('in-image')}
                        data-testid="gallerydeck-qrmode-in-image"
                        className={`rounded-xl border px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                          selectedQrMode === 'in-image'
                            ? 'border-[var(--ga-accent)] bg-[var(--ga-accent-soft)] ga-text font-semibold'
                            : 'ga-border ga-surface-subtle ga-text-secondary hover:ga-text'
                        }`}
                      >
                        <div>{t.simple.create.styleInsideTitle}</div>
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selectedQrMode === 'outer-border'}
                        onClick={() => setSelectedQrMode('outer-border')}
                        data-testid="gallerydeck-qrmode-outer-border"
                        className={`rounded-xl border px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                          selectedQrMode === 'outer-border'
                            ? 'border-[var(--ga-accent)] bg-[var(--ga-accent-soft)] ga-text font-semibold'
                            : 'ga-border ga-surface-subtle ga-text-secondary hover:ga-text'
                        }`}
                      >
                        <div>{t.simple.create.styleOuterTitle}</div>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap gap-2">
                {item.provenanceStatus !== 'signed' ? (
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => void onCertify(item, selectedLicense, selectedQrMode)}
                    data-testid="gallerydeck-certify-btn"
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--ga-accent)] hover:bg-[var(--ga-accent-hover)] disabled:opacity-50 px-4 py-2.5 text-sm font-semibold text-[#FAF9F6] transition-colors cursor-pointer"
                  >
                    <FileSignature className="h-4 w-4" />
                    {busyAction === 'certify' ? gd.certifying : gd.actionCertifyNow}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => void onVerify(item)}
                    data-testid="gallerydeck-verify-btn"
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--ga-accent)] hover:bg-[var(--ga-accent-hover)] disabled:opacity-50 px-4 py-2.5 text-sm font-semibold text-[#FAF9F6] transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {busyAction === 'verify' ? gd.verifying : gd.actionVerify}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => void onDownload(item)}
                  data-testid="gallerydeck-download-btn"
                  className="ga-btn-secondary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  {gd.actionDownloadPng}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {item.proofUrl && (
                  <button
                    type="button"
                    onClick={() => void handleCopyProof()}
                    data-testid="gallerydeck-copy-proof-btn"
                    className="flex-1 ga-btn-secondary inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium cursor-pointer"
                  >
                    {copiedProof ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        {gd.copiedProofUrl}
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        {gd.actionCopyProofUrl}
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onDelete(item)}
                  data-testid="gallerydeck-delete-btn"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/60 px-3 py-2 text-xs font-medium text-rose-300 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {gd.actionDelete}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

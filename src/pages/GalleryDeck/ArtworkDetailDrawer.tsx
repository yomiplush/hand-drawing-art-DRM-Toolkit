import { useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileSignature,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { LICENSE_DEFINITIONS } from '../../core/manifest/types';
import type { LicenseId } from '../../core/manifest/types';
import { useI18n } from '../../i18n/context';
import type { GalleryArtworkItem } from '../../types/gallerydeck';

interface ArtworkDetailDrawerProps {
  item: GalleryArtworkItem | null;
  busyAction: 'certify' | 'verify' | null;
  onClose: () => void;
  onCertify: (item: GalleryArtworkItem, licenseId: LicenseId) => Promise<void>;
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700/80 bg-slate-900/95 text-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={gd.closeDetails}
          data-testid="gallerydeck-close-drawer"
          className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-800/90 text-slate-200 hover:bg-slate-700 cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 sm:p-7">
          {/* Artwork Preview */}
          <div className="flex flex-col gap-3">
            <div className="relative overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950 aspect-[4/3] flex items-center justify-center">
              {item.thumbnailDataUrl ? (
                <img
                  src={item.thumbnailDataUrl}
                  alt={item.title}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="text-slate-500 text-sm">{gd.noPreview}</div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {item.provenanceStatus === 'signed' && (
                <span
                  data-testid="detail-status-signed"
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-1 text-emerald-300 font-medium"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {gd.badgeVerified}
                </span>
              )}
              {item.provenanceStatus === 'unverified' && (
                <span
                  data-testid="detail-status-unverified"
                  className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-400/40 px-2.5 py-1 text-amber-300 font-medium"
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  {gd.badgeUnverified}
                </span>
              )}
              {item.provenanceStatus === 'invalid' && (
                <span
                  data-testid="detail-status-invalid"
                  className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 border border-rose-400/40 px-2.5 py-1 text-rose-300 font-medium"
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  {gd.badgeInvalid}
                </span>
              )}
              {item.qrMode !== 'none' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/20 border border-cyan-400/40 px-2.5 py-1 text-cyan-300 font-medium">
                  <QrCode className="h-3.5 w-3.5" />
                  {gd.badgeQrBurned}
                </span>
              )}
              {item.licenseId && (
                <span className="inline-flex items-center rounded-full bg-slate-800 border border-slate-600 px-2.5 py-1 text-slate-200 font-medium">
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
                    <h2 className="text-xl sm:text-2xl font-bold text-white pr-8">{item.title}</h2>
                  )}
                  {item.authorName && (
                    <p className="text-sm text-slate-400 mt-0.5">{item.authorName}</p>
                  )}
                </div>
              )}

              <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-950/70 border border-slate-800 p-3.5 text-xs">
                <div>
                  <dt className="text-slate-400">{gd.metaDimensions}</dt>
                  <dd className="font-mono text-slate-100 mt-0.5">
                    {item.width} × {item.height} px
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">{gd.metaTimestamp}</dt>
                  <dd className="font-mono text-slate-100 mt-0.5">
                    {new Date(item.updatedAt).toLocaleDateString()}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-slate-400">{gd.metaFingerprint}</dt>
                  <dd className="font-mono text-cyan-300 mt-0.5 break-all">
                    {item.publicKeyFingerprint ?? '—'}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-slate-400">{gd.metaPixelHash}</dt>
                  <dd className="font-mono text-slate-300 mt-0.5 break-all text-[11px]">
                    {item.artworkSha256Hex ? `${item.artworkSha256Hex.slice(0, 32)}…` : '—'}
                  </dd>
                </div>
                {item.verificationSummary && (
                  <div className="col-span-2">
                    <dt className="text-slate-400">{gd.metaVerification}</dt>
                    <dd className="text-emerald-300 mt-0.5">{item.verificationSummary}</dd>
                  </div>
                )}
              </dl>

              {item.provenanceStatus !== 'signed' && (
                <div className="space-y-2">
                  <label className="block text-xs text-slate-300 font-medium">
                    {gd.selectLicenseLabel}
                  </label>
                  <select
                    value={selectedLicense}
                    onChange={(e) => setSelectedLicense(e.target.value as LicenseId)}
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                  >
                    {LICENSE_DEFINITIONS.map((lic) => (
                      <option key={lic.id} value={lic.id}>
                        {lic.id} — {lic.shortLabel}
                      </option>
                    ))}
                  </select>
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
                    onClick={() => void onCertify(item, selectedLicense)}
                    data-testid="gallerydeck-certify-btn"
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors cursor-pointer"
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
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {busyAction === 'verify' ? gd.verifying : gd.actionVerify}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => void onDownload(item)}
                  data-testid="gallerydeck-download-btn"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-100 transition-colors cursor-pointer"
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
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 cursor-pointer"
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

                <Link
                  to="/create"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {gd.openInCreateStudio}
                </Link>

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

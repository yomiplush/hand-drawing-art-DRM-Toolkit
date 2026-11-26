import { useState } from 'react';
import { AlertTriangle, ShieldAlert, X } from 'lucide-react';
import { useI18n } from '../../i18n/context';

interface GoogleDriveRiskConsentModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirmConsent: () => void;
}

/**
 * Mandatory risk-warning & consent gate displayed before any Google Drive OAuth
 * or Drive sync/load action can proceed.
 */
export function GoogleDriveRiskConsentModal(props: GoogleDriveRiskConsentModalProps) {
  if (!props.open) return null;
  return <GoogleDriveRiskConsentModalBody {...props} />;
}

function GoogleDriveRiskConsentModalBody({
  onCancel,
  onConfirmConsent,
}: GoogleDriveRiskConsentModalProps) {
  const { t } = useI18n();
  const gd = t.galleryDeck;
  const [agreed, setAgreed] = useState(false);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gdrive-risk-modal-title"
      data-testid="gdrive-risk-consent-modal"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-xl rounded-2xl border border-rose-500/50 bg-slate-900 text-slate-100 shadow-2xl p-5 sm:p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 text-rose-400">
            <AlertTriangle className="h-6 w-6 shrink-0" />
            <h2 id="gdrive-risk-modal-title" className="text-base sm:text-lg font-bold text-white">
              {gd.driveRiskModalTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label={gd.closeDetails}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-xl border border-rose-500/35 bg-rose-950/35 p-4 space-y-3 text-xs sm:text-sm leading-relaxed text-rose-100">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <p>{gd.driveRiskWarning1}</p>
          </div>
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <p>{gd.driveRiskWarning2}</p>
          </div>
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <p>{gd.driveRiskWarning3}</p>
          </div>
        </div>

        <label
          htmlFor="gdrive-risk-consent-checkbox"
          className="flex items-start gap-3 rounded-xl border border-slate-700/80 bg-slate-950/70 p-3.5 cursor-pointer select-none"
        >
          <input
            id="gdrive-risk-consent-checkbox"
            data-testid="gdrive-risk-consent-checkbox"
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-500 bg-slate-800 text-rose-500 focus:ring-rose-500 cursor-pointer"
          />
          <span className="text-xs sm:text-sm text-slate-200 leading-snug">
            {gd.driveRiskCheckboxLabel}
          </span>
        </label>

        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            data-testid="gdrive-risk-cancel-btn"
            className="w-full sm:w-auto rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-200 cursor-pointer"
          >
            {gd.closeDetails}
          </button>
          <button
            type="button"
            disabled={!agreed}
            onClick={() => {
              if (!agreed) return;
              onConfirmConsent();
            }}
            data-testid="gdrive-risk-confirm-btn"
            className="w-full sm:w-auto rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed px-4 py-2.5 text-xs sm:text-sm font-semibold text-white transition-colors cursor-pointer"
          >
            {gd.driveRiskConfirmButton}
          </button>
        </div>
      </div>
    </div>
  );
}

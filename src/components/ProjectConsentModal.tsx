import { Layers, Lock, ShieldCheck, X } from 'lucide-react';

export interface ProjectConsentModalProps {
  open: boolean;
  fileName: string;
  fileSizeBytes: number;
  locale?: 'ja' | 'en';
  onConfirm: () => void;
  onCancel: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function ProjectConsentModal({
  open,
  fileName,
  fileSizeBytes,
  locale = 'en',
  onConfirm,
  onCancel,
}: ProjectConsentModalProps) {
  if (!open) return null;

  const isJa = locale === 'ja';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-consent-title"
      data-testid="project-consent-modal"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#041226]/80 backdrop-blur-md p-4"
    >
      <div className="w-full max-w-md rounded-2xl border ga-border-strong ga-card p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--ga-accent-soft)] text-[var(--ga-accent)]">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="project-consent-title" className="text-base font-bold ga-text">
                {isJa ? '解析とレイヤー統合の確認' : 'Analysis & Merge Consent'}
              </h2>
              <p className="text-xs font-mono ga-text-muted truncate max-w-[260px]">
                {fileName} ({formatBytes(fileSizeBytes)})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label={isJa ? 'キャンセル' : 'Cancel'}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full ga-btn-secondary cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <ul className="space-y-3 text-xs sm:text-sm ga-text-secondary">
          <li className="flex items-start gap-2.5">
            <Lock className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" aria-hidden="true" />
            <span>
              {isJa
                ? '100%ブラウザ内でローカル処理されます。作業ファイルがサーバーへアップロードされることはありません。'
                : '100% local in-browser processing. Your project file is never uploaded to any server.'}
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 mt-0.5 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
            <span>
              {isJa
                ? 'レイヤー階層・タイムラプス・制作メタデータを検証し、SHA-256ハッシュを計算します。'
                : 'Inspects layer hierarchy, timelapse markers, and creation metadata to compute a cryptographic SHA-256 hash.'}
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <Layers className="h-4 w-4 mt-0.5 text-sky-400 shrink-0" aria-hidden="true" />
            <span>
              {isJa
                ? '全レイヤーを1枚の統合PNG画像に自動フラット化し、暗号証明を付与します。'
                : 'Automatically flattens/merges all layers into a single composite PNG for cryptographic certification.'}
            </span>
          </li>
        </ul>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t ga-border">
          <button
            type="button"
            onClick={onCancel}
            data-testid="consent-cancel-btn"
            className="rounded-xl ga-btn-secondary px-4 py-2 text-xs sm:text-sm font-medium min-h-[42px] cursor-pointer"
          >
            {isJa ? 'キャンセル' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            data-testid="consent-agree-merge-btn"
            className="rounded-xl ga-btn-primary px-4 py-2 text-xs sm:text-sm font-semibold min-h-[42px] cursor-pointer"
          >
            {isJa ? '同意して統合する' : 'Agree & Merge'}
          </button>
        </div>
      </div>
    </div>
  );
}

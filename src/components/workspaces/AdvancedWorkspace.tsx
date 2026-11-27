import { useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  KeyRound,
  Layers,
  LayoutGrid,
  Package,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { NATIVE_PROJECT_ACCEPT } from '../../core/parsers';
import type {
  ProjectInspectionResult,
  ProjectMergeResult,
  StreamingHashProgress,
} from '../../core/parsers';
import type { ChmProofV2Payload, SignedChmProofV2 } from '../../core/manifest/proofV2';
import type { AuthorKeyRecord } from '../../core/storage/keyStore';
import type { ProjectPipelineStage } from '../../core/workers/projectMergeClient';

export interface AdvancedWorkspaceProps {
  stage: ProjectPipelineStage;
  locale?: 'ja' | 'en';
  inspection: ProjectInspectionResult | null;
  hashProgress: StreamingHashProgress | null;
  mergeResult: ProjectMergeResult | null;
  previewUrl: string | null;
  draftPayload: ChmProofV2Payload | null;
  signedProof: SignedChmProofV2 | null;
  authorKeys: AuthorKeyRecord[];
  selectedKeyId: string;
  keyBackedUp: boolean;
  artworkTitle: string;
  authorName: string;
  errorMessage: string | null;
  onSelectKey: (id: string) => void;
  onChangeTitle: (title: string) => void;
  onChangeAuthorName: (name: string) => void;
  onFileSelected: (file: File) => void;
  onCertify: () => void;
  onDownloadPng: () => void;
  onAddToGalleryDeck: () => void;
  onExportChmExchange: () => void;
  onBackupKeyClick: () => void;
}

export function AdvancedWorkspace({
  stage,
  locale = 'en',
  inspection,
  hashProgress,
  mergeResult,
  previewUrl,
  draftPayload,
  signedProof,
  authorKeys,
  selectedKeyId,
  keyBackedUp,
  artworkTitle,
  authorName,
  errorMessage,
  onSelectKey,
  onChangeTitle,
  onChangeAuthorName,
  onFileSelected,
  onCertify,
  onDownloadPng,
  onAddToGalleryDeck,
  onExportChmExchange,
  onBackupKeyClick,
}: AdvancedWorkspaceProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isJa = locale === 'ja';
  const displayedJson = signedProof ?? draftPayload;

  return (
    <section data-testid="advanced-workspace" className="space-y-4">
      {errorMessage && (
        <div
          role="alert"
          data-testid="advanced-workspace-error"
          className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs sm:text-sm text-rose-500"
        >
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT PANE: Source Inspector */}
        <div
          data-testid="advanced-left-pane"
          className="lg:col-span-4 rounded-2xl border ga-border-strong ga-card p-4 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold ga-text">
              {isJa ? 'ソース検査 (Source Inspector)' : 'Source Inspector'}
            </h2>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg ga-btn-secondary px-2.5 py-1.5 text-xs font-medium cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isJa ? '選択' : 'Load'}</span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept={NATIVE_PROJECT_ACCEPT}
              data-testid="advanced-project-file-input"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFileSelected(f);
                e.target.value = '';
              }}
            />
          </div>

          {hashProgress && hashProgress.percent < 100 && (
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono ga-text-muted">
                <span>Streaming SHA-256</span>
                <span>{hashProgress.percent}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-black/20 overflow-hidden">
                <div
                  className="h-full bg-[var(--ga-accent)] transition-all"
                  style={{ width: `${hashProgress.percent}%` }}
                />
              </div>
            </div>
          )}

          {inspection ? (
            <div className="space-y-3 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-500">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  Magic OK ({inspection.format})
                </span>
                {inspection.timelapseDetected && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-sky-400">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    Timelapse
                  </span>
                )}
              </div>

              <dl className="space-y-1.5 font-mono text-[11px]">
                <div>
                  <dt className="ga-text-muted">Software</dt>
                  <dd className="ga-text font-semibold">{inspection.softwareSignature}</dd>
                </div>
                <div>
                  <dt className="ga-text-muted">Merge Method</dt>
                  <dd className="ga-text">{inspection.mergeMethod}</dd>
                </div>
                <div>
                  <dt className="ga-text-muted">Source SHA-256</dt>
                  <dd className="ga-text break-all">{inspection.sourceProjectSha256}</dd>
                </div>
              </dl>

              <div className="space-y-1.5 pt-2 border-t ga-border">
                <div className="flex items-center justify-between text-[11px] font-semibold ga-text-secondary">
                  <span className="inline-flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                    Layer Tree ({inspection.layerMetrics.layer_count})
                  </span>
                </div>
                <ul className="max-h-40 overflow-y-auto space-y-1 rounded-lg bg-black/15 p-2 font-mono text-[11px]">
                  {inspection.layers.map((layer, idx) => (
                    <li key={`${layer.name}-${idx}`} className="flex justify-between gap-2">
                      <span className="truncate ga-text">{layer.name}</span>
                      <span className="ga-text-muted shrink-0">
                        {layer.blendMode} · {Math.round(layer.opacity * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-xs ga-text-muted py-8 text-center">
              {isJa
                ? 'ネイティブ作業ファイル（.psd, .clip, .procreate 等）を読み込んでください。'
                : 'Load a native project file (.psd, .clip, .procreate, .kra, etc.) to inspect.'}
            </p>
          )}
        </div>

        {/* CENTER PANE: Merge & Payload Preview */}
        <div
          data-testid="advanced-center-pane"
          className="lg:col-span-4 rounded-2xl border ga-border-strong ga-card p-4 space-y-4"
        >
          <h2 className="text-sm font-bold ga-text">
            {isJa ? '統合プレビュー & v2ペイロード' : 'Merge & Payload Preview'}
          </h2>

          {previewUrl ? (
            <div className="rounded-xl border ga-border bg-black/20 p-2">
              <img
                src={previewUrl}
                alt="Merged composite preview"
                className="mx-auto max-h-48 object-contain"
              />
            </div>
          ) : (
            <div className="flex h-36 items-center justify-center rounded-xl border border-dashed ga-border text-xs ga-text-muted">
              {isJa ? '統合画像プレビュー待機中' : 'Awaiting merged composite'}
            </div>
          )}

          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold ga-text-secondary">
              JSON Cryptographic Payload (v2)
            </div>
            <pre
              data-testid="advanced-json-payload"
              className="max-h-60 overflow-auto rounded-xl bg-black/30 p-3 text-[11px] font-mono text-sky-200"
            >
              {displayedJson
                ? JSON.stringify(displayedJson, null, 2)
                : '// Drop & merge a native project file to preview v2 payload'}
            </pre>
          </div>
        </div>

        {/* RIGHT PANE: Key & Output Controls */}
        <div
          data-testid="advanced-right-pane"
          className="lg:col-span-4 rounded-2xl border ga-border-strong ga-card p-4 space-y-4"
        >
          <h2 className="text-sm font-bold ga-text">
            {isJa ? '鍵・出力コントロール' : 'Key & Output Controls'}
          </h2>

          {!keyBackedUp && authorKeys.length > 0 && (
            <div
              data-testid="key-backup-warning"
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs space-y-2"
            >
              <div className="flex items-center gap-1.5 font-semibold text-amber-500">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {isJa ? '秘密鍵が未バックアップです' : 'Private key not backed up'}
                </span>
              </div>
              <button
                type="button"
                onClick={onBackupKeyClick}
                className="text-[11px] font-semibold underline text-amber-400 cursor-pointer"
              >
                {isJa ? '今すぐ鍵をバックアップ →' : 'Export Ed25519 key backup →'}
              </button>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium ga-text-secondary">
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isJa ? '署名用 Ed25519 鍵' : 'Active Ed25519 Key'}</span>
            </label>
            <select
              value={selectedKeyId}
              onChange={(e) => onSelectKey(e.target.value)}
              className="w-full rounded-xl border ga-border bg-[var(--ga-surface-solid)] px-3 py-2 text-xs ga-text"
            >
              {authorKeys.length === 0 ? (
                <option value="">{isJa ? '鍵がありません' : 'No local key yet'}</option>
              ) : (
                authorKeys.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label} ({k.fingerprintShort})
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="space-y-2 pt-2 border-t ga-border">
            <label className="block text-xs font-medium ga-text-secondary">
              {isJa ? '作品タイトル (GalleryDeck)' : 'Artwork Title (GalleryDeck)'}
              <input
                type="text"
                value={artworkTitle}
                onChange={(e) => onChangeTitle(e.target.value)}
                placeholder={isJa ? '無題の作品' : 'Untitled Artwork'}
                className="mt-1 w-full rounded-xl border ga-border bg-[var(--ga-surface-solid)] px-3 py-2 text-xs ga-text"
              />
            </label>
            <label className="block text-xs font-medium ga-text-secondary">
              {isJa ? '作者名' : 'Author Name'}
              <input
                type="text"
                value={authorName}
                onChange={(e) => onChangeAuthorName(e.target.value)}
                placeholder={isJa ? 'アーティスト名' : 'Artist Name'}
                className="mt-1 w-full rounded-xl border ga-border bg-[var(--ga-surface-solid)] px-3 py-2 text-xs ga-text"
              />
            </label>
          </div>

          <div className="space-y-2 pt-2 border-t ga-border">
            <button
              type="button"
              onClick={onCertify}
              disabled={!mergeResult || stage === 'signing'}
              data-testid="advanced-certify-btn"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl ga-btn-primary px-4 py-2.5 text-xs font-semibold min-h-[42px] disabled:opacity-50 cursor-pointer"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span>{isJa ? 'v2暗号証明を生成' : 'Sign v2 Proof'}</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onDownloadPng}
                disabled={!signedProof}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl ga-btn-secondary px-3 py-2 text-xs font-medium disabled:opacity-50 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>PNG</span>
              </button>
              <button
                type="button"
                onClick={onAddToGalleryDeck}
                disabled={!signedProof}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl ga-btn-secondary px-3 py-2 text-xs font-medium disabled:opacity-50 cursor-pointer"
              >
                <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                <span>GalleryDeck</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onExportChmExchange}
              disabled={!signedProof}
              data-testid="advanced-export-exchange-btn"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border ga-border-strong px-4 py-2 text-xs font-semibold ga-text hover:bg-[var(--ga-accent-soft)] disabled:opacity-50 cursor-pointer"
            >
              <Package className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isJa ? 'CHM-Exchangeパッケージ出力' : 'Export CHM-Exchange Package'}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

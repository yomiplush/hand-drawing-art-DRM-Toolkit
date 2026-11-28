import { useRef } from 'react';
import {
  CheckCircle2,
  Download,
  Layers,
  LayoutGrid,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { HelpTip } from '../HelpTip';
import { getNativeProjectAcceptAttr } from '../../core/parsers';
import type { ProjectInspectionResult, ProjectMergeResult } from '../../core/parsers';
import type { SignedChmProofV2 } from '../../core/manifest/proofV2';
import type { ProjectPipelineStage } from '../../core/workers/projectMergeClient';

export interface SimpleWorkspaceProps {
  stage: ProjectPipelineStage;
  locale?: 'ja' | 'en';
  inspection: ProjectInspectionResult | null;
  mergeResult: ProjectMergeResult | null;
  previewUrl: string | null;
  signedProof: SignedChmProofV2 | null;
  errorMessage: string | null;
  onFileSelected: (file: File) => void;
  onCertify: () => void;
  onDownloadPng: () => void;
  onAddToGalleryDeck: () => void;
  onReset: () => void;
}

export function SimpleWorkspace({
  stage,
  locale = 'en',
  inspection,
  mergeResult,
  previewUrl,
  signedProof,
  errorMessage,
  onFileSelected,
  onCertify,
  onDownloadPng,
  onAddToGalleryDeck,
  onReset,
}: SimpleWorkspaceProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isJa = locale === 'ja';

  const currentStep =
    stage === 'complete' ? 3 : stage === 'ready-to-sign' || stage === 'signing' ? 2 : 1;

  return (
    <section data-testid="simple-workspace" className="mx-auto max-w-xl space-y-6">
      {/* Compact 3-step indicator */}
      <ol
        aria-label={isJa ? '証明の手順' : 'Certification steps'}
        className="flex flex-col gap-2 text-xs font-semibold sm:flex-row sm:items-center"
      >
        {[
          { num: 1, label: isJa ? '1. 作業ファイル' : '1. Drop Project' },
          { num: 2, label: isJa ? '2. 統合して証明' : '2. Merge & Sign' },
          { num: 3, label: isJa ? '3. 保存・登録' : '3. Save & Deck' },
        ].map((step) => (
          <li
            key={step.num}
            aria-current={currentStep === step.num ? 'step' : undefined}
            className={`flex-1 rounded-xl border px-3 py-2 text-center transition-colors ${
              currentStep === step.num
                ? 'border-[var(--ga-accent)] bg-[var(--ga-accent-soft)] text-[var(--ga-accent)]'
                : currentStep > step.num
                  ? 'ga-border bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'ga-border ga-text-muted'
            }`}
          >
            {step.label}
            {currentStep === step.num && (
              <span className="sr-only">{isJa ? '（現在の手順）' : ' (current step)'}</span>
            )}
          </li>
        ))}
      </ol>

      {errorMessage && (
        <div
          role="alert"
          data-testid="simple-workspace-error"
          className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs sm:text-sm text-rose-700 dark:text-rose-300"
        >
          {errorMessage}
        </div>
      )}

      {/* Step 1: Drop Native Project File */}
      {currentStep === 1 && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) onFileSelected(f);
          }}
          className="rounded-2xl border-2 border-dashed ga-border-strong ga-card p-8 text-center space-y-4"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--ga-accent-soft)] text-[var(--ga-accent)]">
            <Upload className="h-7 w-7" aria-hidden="true" />
          </div>

          <div className="flex items-center justify-center gap-1.5">
            <h2 className="text-lg font-bold ga-text">
              {isJa ? '作業ファイルをドロップ' : 'Drop Project File'}
            </h2>
            <HelpTip
              label="Why native project files"
              testId="help-tip-why-native-project-files"
              text={
                isJa
                  ? 'AI生成や盗用を防ぐため、.psd / .clip / .procreate などのレイヤー付き作業ファイルのみ受け付けます。'
                  : 'Only native multi-layer project files (.psd, .clip, .procreate, .kra) are accepted to prevent flat-image spoofing.'
              }
            />
          </div>

          <p className="text-xs font-mono ga-text-muted">.psd · .clip · .procreate · .kra · .sai2</p>

          <input
            ref={inputRef}
            type="file"
            accept={getNativeProjectAcceptAttr()}
            data-testid="simple-project-file-input"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFileSelected(f);
              e.target.value = '';
            }}
          />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={stage === 'inspecting' || stage === 'merging'}
            data-testid="simple-select-project-btn"
            className="inline-flex items-center justify-center gap-2 rounded-xl ga-btn-primary px-6 py-3 text-sm font-semibold min-h-[46px] cursor-pointer"
          >
            {stage === 'inspecting' || stage === 'merging' ? (
              <>
                <Layers className="h-4 w-4 animate-bounce" aria-hidden="true" />
                <span>{isJa ? 'レイヤー統合中…' : 'Flattening layers…'}</span>
              </>
            ) : (
              <span>{isJa ? 'ファイルを選択' : 'Select Project File'}</span>
            )}
          </button>
        </div>
      )}

      {/* Step 2: Layer Flatten Visual & Certify */}
      {currentStep === 2 && mergeResult && inspection && (
        <div className="rounded-2xl border ga-border-strong ga-card p-6 text-center space-y-5">
          <div className="flex items-center justify-center gap-1.5">
            <h2 className="text-lg font-bold ga-text">
              {isJa ? '統合完了・証明を作成' : 'Layers Flattened'}
            </h2>
            <HelpTip
              label="About certification"
              text={
                isJa
                  ? '統合PNGと元作業ファイルのSHA-256ハッシュをあなたのEd25519鍵で署名します。'
                  : 'Signs both the merged PNG hash and original project hash with your local Ed25519 key.'
              }
            />
          </div>

          {previewUrl && (
            <div className="mx-auto max-h-64 overflow-hidden rounded-xl border ga-border bg-black/20">
              <img
                src={previewUrl}
                alt="Flattened artwork preview"
                className="mx-auto max-h-64 object-contain"
              />
            </div>
          )}

          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--ga-accent-soft)] px-3.5 py-1 text-xs font-medium text-[var(--ga-accent)]">
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {inspection.format} · {inspection.layerMetrics.layer_count}{' '}
              {isJa ? 'レイヤー' : 'layers'}
            </span>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onReset}
              className="rounded-xl ga-btn-secondary px-4 py-2.5 text-sm font-medium min-h-[44px] cursor-pointer"
            >
              {isJa ? 'やり直す' : 'Reset'}
            </button>
            <button
              type="button"
              onClick={onCertify}
              disabled={stage === 'signing'}
              data-testid="simple-certify-btn"
              className="inline-flex items-center gap-2 rounded-xl ga-btn-primary px-6 py-2.5 text-sm font-semibold min-h-[44px] cursor-pointer"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span>{isJa ? '作品を証明する' : 'Certify Artwork'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Download & Add to GalleryDeck */}
      {currentStep === 3 && signedProof && (
        <div
          data-testid="simple-complete-card"
          className="rounded-2xl border border-emerald-500/40 ga-card p-6 text-center space-y-5"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
            <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
          </div>

          <div className="flex items-center justify-center gap-1.5">
            <h2 className="text-lg font-bold ga-text">
              {isJa ? '証明が完了しました' : 'Artwork Certified'}
            </h2>
            <HelpTip
              label="What happens next"
              text={
                isJa
                  ? '証明済みPNGをダウンロードするか、GalleryDeckにそのまま追加して公開管理できます。'
                  : 'Download your certified PNG or add it directly to GalleryDeck for showcasing.'
              }
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={onDownloadPng}
              data-testid="simple-download-png-btn"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl ga-btn-primary px-5 py-3 text-sm font-semibold min-h-[46px] cursor-pointer"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>{isJa ? '証明済みPNGを保存' : 'Download Certified PNG'}</span>
            </button>
            <button
              type="button"
              onClick={onAddToGalleryDeck}
              data-testid="simple-add-gallerydeck-btn"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl ga-btn-secondary px-5 py-3 text-sm font-semibold min-h-[46px] cursor-pointer"
            >
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />
              <span>{isJa ? 'GalleryDeckに追加' : 'Add to GalleryDeck'}</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

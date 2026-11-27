import { useRef, useState } from 'react';
import {
  AlertTriangle,
  Cloud,
  Database,
  Download,
  HardDrive,
  KeyRound,
  Lock,
  RefreshCw,
  Trash2,
  Unlock,
  Upload,
  X,
} from 'lucide-react';
import { useAppPreferences } from '../../components/PreferencesContext';
import {
  getCustomNostrProofRelays,
  setCustomNostrProofRelays,
} from '../../core/nostr/proofRelay';
import { useI18n } from '../../i18n/context';
import type { SyncTierStatus } from '../../types/gallerydeck';

interface SyncPanelModalProps {
  open: boolean;
  itemCount: number;
  tierStatuses: Record<'indexeddb' | 'filesystem' | 'gdrive', SyncTierStatus>;
  driveConnected: boolean;
  syncing: boolean;
  onClose: () => void;
  onConnectDrive: () => Promise<void>;
  onUploadEncryptedDrive: (passphrase: string) => Promise<void>;
  onRestoreEncryptedDrive: (passphrase: string) => Promise<void>;
  onResetDriveSync: () => Promise<void>;
  onSyncNow: () => Promise<void>;
  onExportArchive: () => Promise<void>;
  onImportArchive: (file: File) => Promise<void>;
}

export function SyncPanelModal({
  open,
  itemCount,
  tierStatuses,
  driveConnected,
  syncing,
  onClose,
  onConnectDrive,
  onUploadEncryptedDrive,
  onRestoreEncryptedDrive,
  onResetDriveSync,
  onSyncNow,
  onExportArchive,
  onImportArchive,
}: SyncPanelModalProps) {
  const { t, locale } = useI18n();
  const { isAdvanced } = useAppPreferences();
  const gd = t.galleryDeck;
  const isJa = locale === 'ja';
  const archiveInputRef = useRef<HTMLInputElement | null>(null);
  const [driveResetStep, setDriveResetStep] = useState<0 | 1 | 2>(0);
  const [resettingDrive, setResettingDrive] = useState(false);
  const [drivePassphrase, setDrivePassphrase] = useState('');
  const [driveCryptoBusy, setDriveCryptoBusy] = useState<'upload' | 'restore' | null>(null);
  const [driveCryptoError, setDriveCryptoError] = useState<string | null>(null);
  const [customRelaysInput, setCustomRelaysInput] = useState<string>(() =>
    getCustomNostrProofRelays().join('\n'),
  );
  const [customRelaysSaved, setCustomRelaysSaved] = useState(false);

  if (!open) return null;

  const handleConfirmResetDrive = async () => {
    setResettingDrive(true);
    try {
      await onResetDriveSync();
      setDriveResetStep(0);
    } finally {
      setResettingDrive(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={gd.syncModalTitle}
      data-testid="gallerydeck-sync-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={gd.closeDetails}
        onClick={() => {
          setDriveResetStep(0);
          onClose();
        }}
        className="fixed inset-0 cursor-default"
      />
      <div
        className="relative z-10 w-full max-w-2xl rounded-2xl border border-slate-700/80 bg-slate-900/95 text-slate-100 shadow-2xl p-5 sm:p-6 space-y-5"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">{gd.syncModalTitle}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{gd.syncModalSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setDriveResetStep(0);
              onClose();
            }}
            aria-label={gd.closeDetails}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Tier 1: IndexedDB */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-cyan-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white">{gd.tierIndexedDb}</p>
                <p className="text-xs text-slate-400">
                  {itemCount} {gd.itemsCached}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-0.5 text-xs text-emerald-300">
              {tierStatuses.indexeddb.state}
            </span>
          </div>

          {/* Tier 2: Google Drive Encrypted Full Sync */}
          <div className="rounded-xl border border-sky-500/30 bg-slate-950/70 p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Cloud className="h-5 w-5 text-sky-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-white">
                    {isJa ? 'Google Drive 暗号化フル同期（イラスト＋証明一括）' : 'Google Drive Encrypted Full Sync'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {isJa
                      ? 'イラストデータ・サムネイル・来歴証明をすべて端末内で AES-256-GCM 暗号化して保存します。復号すれば Web 版・スタンドアロン版どちらでも利用できます。'
                      : 'Encrypts all artwork images, thumbnails, and provenance metadata locally with AES-256-GCM before saving to Google Drive. Decrypt in Web or Standalone Edition.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!driveConnected && (
                  <button
                    type="button"
                    disabled={syncing || resettingDrive || driveCryptoBusy !== null}
                    onClick={() => void onConnectDrive()}
                    data-testid="gallerydeck-connect-drive-btn"
                    className="rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 px-3 py-1.5 text-xs font-semibold text-slate-950 cursor-pointer"
                  >
                    {gd.connectDrive}
                  </button>
                )}
                {driveConnected && driveResetStep === 0 && (
                  <button
                    type="button"
                    disabled={syncing || resettingDrive || driveCryptoBusy !== null}
                    onClick={() => setDriveResetStep(1)}
                    data-testid="gallerydeck-reset-drive-btn"
                    className="inline-flex items-center gap-1 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 disabled:opacity-40 border border-rose-400/40 px-2.5 py-1.5 text-xs font-medium text-rose-200 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{isJa ? '同期設定を削除' : 'Remove Sync'}</span>
                  </button>
                )}
              </div>
            </div>

            {driveConnected && (
              <div className="rounded-xl border border-sky-400/20 bg-sky-950/25 p-3 space-y-2.5">
                <label className="block space-y-1">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-200">
                    <KeyRound className="h-3.5 w-3.5 text-sky-400" />
                    {isJa ? '暗号化 / 復号パスフレーズ（8文字以上）' : 'Encryption / Decryption Passphrase (8+ chars)'}
                  </span>
                  <input
                    type="password"
                    value={drivePassphrase}
                    onChange={(e) => {
                      setDrivePassphrase(e.target.value);
                      setDriveCryptoError(null);
                    }}
                    placeholder={isJa ? 'パスフレーズを入力…' : 'Enter passphrase…'}
                    data-testid="gallerydeck-drive-passphrase-input"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
                  />
                </label>

                {driveCryptoError && (
                  <p className="text-xs text-rose-300">{driveCryptoError}</p>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={syncing || resettingDrive || driveCryptoBusy !== null}
                    data-testid="gallerydeck-drive-encrypt-upload-btn"
                    onClick={async () => {
                      if (drivePassphrase.trim().length < 8) {
                        setDriveCryptoError(
                          isJa
                            ? 'パスフレーズは8文字以上で入力してください。'
                            : 'Passphrase must be at least 8 characters.',
                        );
                        return;
                      }
                      setDriveCryptoError(null);
                      setDriveCryptoBusy('upload');
                      try {
                        await onUploadEncryptedDrive(drivePassphrase);
                      } catch (err) {
                        setDriveCryptoError(err instanceof Error ? err.message : String(err));
                      } finally {
                        setDriveCryptoBusy(null);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 px-3 py-2 text-xs font-semibold text-slate-950 cursor-pointer"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    <span>
                      {driveCryptoBusy === 'upload'
                        ? isJa
                          ? '暗号化して保存中…'
                          : 'Encrypting & Uploading…'
                        : isJa
                          ? 'すべて暗号化して Drive に保存'
                          : 'Encrypt All & Save to Drive'}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={syncing || resettingDrive || driveCryptoBusy !== null}
                    data-testid="gallerydeck-drive-decrypt-restore-btn"
                    onClick={async () => {
                      if (drivePassphrase.trim().length < 8) {
                        setDriveCryptoError(
                          isJa
                            ? '復号パスフレーズ（8文字以上）を入力してください。'
                            : 'Enter your passphrase (8+ chars) to decrypt.',
                        );
                        return;
                      }
                      setDriveCryptoError(null);
                      setDriveCryptoBusy('restore');
                      try {
                        await onRestoreEncryptedDrive(drivePassphrase);
                        setCustomRelaysInput(getCustomNostrProofRelays().join('\n'));
                        setCustomRelaysSaved(false);
                      } catch (err) {
                        setDriveCryptoError(err instanceof Error ? err.message : String(err));
                      } finally {
                        setDriveCryptoBusy(null);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-sky-400/40 px-3 py-2 text-xs font-medium text-sky-100 cursor-pointer"
                  >
                    <Unlock className="h-3.5 w-3.5 text-sky-400" />
                    <span>
                      {driveCryptoBusy === 'restore'
                        ? isJa
                          ? '復号して復元中…'
                          : 'Decrypting & Restoring…'
                        : isJa
                          ? 'Drive から復号して復元'
                          : 'Decrypt & Restore from Drive'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {driveResetStep === 1 && (
              <div
                data-testid="gallerydeck-reset-drive-confirm-1"
                className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2.5"
              >
                <div className="flex items-start gap-2 text-xs text-amber-200">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
                  <p className="font-medium">
                    {isJa
                      ? 'Google Drive の同期設定を削除しますか？'
                      : 'Remove Google Drive sync settings?'}
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDriveResetStep(0)}
                    className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs text-slate-200 cursor-pointer"
                  >
                    {isJa ? 'キャンセル' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDriveResetStep(2)}
                    data-testid="gallerydeck-reset-drive-next-btn"
                    className="rounded-lg bg-amber-500 hover:bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-950 cursor-pointer"
                  >
                    {isJa ? '削除する' : 'Continue'}
                  </button>
                </div>
              </div>
            )}

            {driveResetStep === 2 && (
              <div
                data-testid="gallerydeck-reset-drive-confirm-2"
                className="rounded-xl border border-rose-500/50 bg-rose-500/15 p-3 space-y-2.5"
              >
                <div className="flex items-start gap-2 text-xs text-rose-100">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                  <p className="font-semibold">
                    {isJa
                      ? '本当に削除しますか？Google Drive との連携トークンと同期設定が完全にリセットされます。'
                      : 'Are you really sure? This will revoke the Google Drive token and reset all sync settings.'}
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={resettingDrive}
                    onClick={() => setDriveResetStep(0)}
                    className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs text-slate-200 cursor-pointer"
                  >
                    {isJa ? 'キャンセル' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    disabled={resettingDrive}
                    onClick={() => void handleConfirmResetDrive()}
                    data-testid="gallerydeck-reset-drive-final-btn"
                    className="rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                  >
                    {resettingDrive
                      ? isJa
                        ? '削除中…'
                        : 'Removing…'
                      : isJa
                        ? '本当に削除する'
                        : 'Yes, Remove Permanently'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Optional Custom / Paid Nostr Relays for Ultra-Compact QR */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-2.5">
            <div>
              <p className="text-sm font-semibold text-white">
                {isJa
                  ? 'カスタム Nostr リレー（任意・有料リレー対応）'
                  : 'Custom Nostr Relays (Optional / Paid Relay Support)'}
              </p>
              <p className="text-xs text-slate-400">
                {isJa
                  ? '有料 Nostr リレーや自前リレーをお持ちの場合、wss:// URL を入力すると無料リレーより優先して超小型 QR の保存・取得に使います。'
                  : 'Add your paid or self-hosted wss:// Nostr relay URLs (one per line) to prioritize them alongside free public relays.'}
              </p>
            </div>
            <textarea
              rows={2}
              value={customRelaysInput}
              onChange={(e) => {
                setCustomRelaysInput(e.target.value);
                setCustomRelaysSaved(false);
              }}
              placeholder="wss://your-paid-relay.example.com"
              data-testid="gallerydeck-custom-nostr-relays-input"
              className="w-full rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 font-mono text-xs text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-emerald-300">
                {customRelaysSaved ? (isJa ? '✓ 保存しました' : '✓ Saved') : ''}
              </span>
              <button
                type="button"
                data-testid="gallerydeck-save-nostr-relays-btn"
                onClick={() => {
                  const urls = customRelaysInput
                    .split(/[\n,]+/)
                    .map((s) => s.trim())
                    .filter(Boolean);
                  const saved = setCustomNostrProofRelays(urls);
                  setCustomRelaysInput(saved.join('\n'));
                  setCustomRelaysSaved(true);
                }}
                className="rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-100 cursor-pointer"
              >
                {isJa ? 'リレー設定を保存' : 'Save Relays'}
              </button>
            </div>
          </div>

          {/* Portable .chdeck Archive Fallback (Advanced Mode only) */}
          {isAdvanced && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-3">
              <div className="flex items-center gap-3">
                <HardDrive className="h-5 w-5 text-amber-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-white">{gd.archiveTitle}</p>
                  <p className="text-xs text-slate-400">{gd.archiveDesc}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void onExportArchive()}
                  data-testid="gallerydeck-export-archive-btn"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 px-3 py-2 text-xs font-medium text-cyan-200 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  {gd.exportArchive}
                </button>
                <button
                  type="button"
                  onClick={() => archiveInputRef.current?.click()}
                  data-testid="gallerydeck-import-archive-btn"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-2 text-xs font-medium text-slate-100 cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {gd.importArchive}
                </button>
                <input
                  ref={archiveInputRef}
                  type="file"
                  accept=".chdeck,.json,application/json"
                  data-testid="gallerydeck-archive-file-input"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      void onImportArchive(file);
                      e.target.value = '';
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            disabled={syncing || resettingDrive}
            onClick={() => void onSyncNow()}
            data-testid="gallerydeck-sync-all-btn"
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-slate-950 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? gd.syncing : gd.syncAllTiers}
          </button>
        </div>
      </div>
    </div>
  );
}

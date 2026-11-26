import { useRef, useState } from 'react';
import {
  AlertTriangle,
  Cloud,
  Database,
  Download,
  HardDrive,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
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
  onResetDriveSync,
  onSyncNow,
  onExportArchive,
  onImportArchive,
}: SyncPanelModalProps) {
  const { t, locale } = useI18n();
  const gd = t.galleryDeck;
  const isJa = locale === 'ja';
  const archiveInputRef = useRef<HTMLInputElement | null>(null);
  const [driveResetStep, setDriveResetStep] = useState<0 | 1 | 2>(0);
  const [resettingDrive, setResettingDrive] = useState(false);

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
      onClick={() => {
        setDriveResetStep(0);
        onClose();
      }}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-slate-700/80 bg-slate-900/95 text-slate-100 shadow-2xl p-5 sm:p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
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

          {/* Tier 2: Google Drive */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Cloud className="h-5 w-5 text-sky-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-white">{gd.tierGoogleDrive}</p>
                  <p className="text-xs text-slate-400">
                    {driveConnected ? gd.driveConnectedDesc : gd.driveDisconnectedDesc}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={syncing || resettingDrive}
                  onClick={() => void onConnectDrive()}
                  data-testid="gallerydeck-connect-drive-btn"
                  className="rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-100 cursor-pointer"
                >
                  {driveConnected ? gd.syncNow : gd.connectDrive}
                </button>
                {driveConnected && driveResetStep === 0 && (
                  <button
                    type="button"
                    disabled={syncing || resettingDrive}
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

          {/* Portable .chdeck Archive Fallback */}
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

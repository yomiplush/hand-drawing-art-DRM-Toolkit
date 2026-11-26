import { useRef } from 'react';
import {
  Cloud,
  Database,
  Download,
  FolderSync,
  HardDrive,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import { useI18n } from '../../i18n/context';
import { isFileSystemAccessSupported } from '../../services/galleryStorage';
import type { SyncTierStatus } from '../../types/gallerydeck';

interface SyncPanelModalProps {
  open: boolean;
  itemCount: number;
  tierStatuses: Record<'indexeddb' | 'filesystem' | 'gdrive', SyncTierStatus>;
  linkedDirName: string | null;
  driveConnected: boolean;
  syncing: boolean;
  onClose: () => void;
  onLinkDirectory: () => Promise<void>;
  onConnectDrive: () => Promise<void>;
  onSyncNow: () => Promise<void>;
  onExportArchive: () => Promise<void>;
  onImportArchive: (file: File) => Promise<void>;
}

export function SyncPanelModal({
  open,
  itemCount,
  tierStatuses,
  linkedDirName,
  driveConnected,
  syncing,
  onClose,
  onLinkDirectory,
  onConnectDrive,
  onSyncNow,
  onExportArchive,
  onImportArchive,
}: SyncPanelModalProps) {
  const { t } = useI18n();
  const gd = t.galleryDeck;
  const archiveInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const fsSupported = isFileSystemAccessSupported();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={gd.syncModalTitle}
      data-testid="gallerydeck-sync-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4"
      onClick={onClose}
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
            onClick={onClose}
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

          {/* Tier 2: Local Directory (File System Access API) */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
            <div className="flex items-center gap-3">
              <FolderSync className="h-5 w-5 text-indigo-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white">{gd.tierLocalDirectory}</p>
                <p className="text-xs text-slate-400">
                  {linkedDirName
                    ? `${gd.linkedFolderPrefix}: ${linkedDirName}`
                    : fsSupported
                      ? gd.tierLocalDirectoryDesc
                      : gd.fsNotSupported}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={!fsSupported || syncing}
              onClick={() => void onLinkDirectory()}
              data-testid="gallerydeck-link-dir-btn"
              className="rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-100 cursor-pointer shrink-0"
            >
              {linkedDirName ? gd.changeFolder : gd.linkFolder}
            </button>
          </div>

          {/* Tier 3: Google Drive */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
            <div className="flex items-center gap-3">
              <Cloud className="h-5 w-5 text-sky-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white">{gd.tierGoogleDrive}</p>
                <p className="text-xs text-slate-400">
                  {driveConnected ? gd.driveConnectedDesc : gd.driveDisconnectedDesc}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={syncing}
              onClick={() => void onConnectDrive()}
              data-testid="gallerydeck-connect-drive-btn"
              className="rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-100 cursor-pointer shrink-0"
            >
              {driveConnected ? gd.syncNow : gd.connectDrive}
            </button>
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
            disabled={syncing}
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

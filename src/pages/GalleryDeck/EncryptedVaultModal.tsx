import { useEffect, useRef, useState } from 'react';
import {
  Download,
  FileCode2,
  FolderOpen,
  HardDrive,
  Lock,
  ShieldCheck,
  Trash2,
  Unlock,
  Upload,
  X,
} from 'lucide-react';
import { useI18n } from '../../i18n/context';
import {
  buildEncryptedVaultChunks,
  deleteLocalEncryptedVault,
  downloadOfflineViewerHtml,
  generateOfflineViewerHtml,
  listLocalEncryptedVaults,
  loadLocalEncryptedVaultFile,
  openEncryptedVaultSession,
  packChunksToVaultBlob,
  saveLocalEncryptedVault,
} from '../../services/galleryCrypto';
import type { LocalEncryptedVaultMeta, VaultBuildInputItem } from '../../services/galleryCrypto';
import { isFileSystemAccessSupported } from '../../services/galleryStorage';
import type { IndexedDbGalleryAdapter } from '../../services/galleryStorage';
import type { DirectoryPickerWindow } from '../../services/galleryStorage/fileSystemAdapter';
import type { DecryptedVaultSession, GalleryArtworkItem } from '../../types/gallerydeck';
import {
  GALLERY_DECK_OFFLINE_VIEWER_FILENAME,
  GALLERY_DECK_VAULT_EXTENSION,
} from '../../types/gallerydeck';

interface EncryptedVaultModalProps {
  open: boolean;
  items: GalleryArtworkItem[];
  idbAdapter: IndexedDbGalleryAdapter;
  onClose: () => void;
  onToast: (message: string) => void;
  onImportDecryptedItems?: (items: GalleryArtworkItem[]) => Promise<void> | void;
}

async function urlToDataUrl(url: string): Promise<string> {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read thumbnail'));
    reader.readAsDataURL(blob);
  });
}

type VaultTab = 'export' | 'decrypt';

export function EncryptedVaultModal({
  open,
  items,
  idbAdapter,
  onClose,
  onToast,
  onImportDecryptedItems,
}: EncryptedVaultModalProps) {
  const { t } = useI18n();
  const gd = t.galleryDeck;
  const fsSupported = isFileSystemAccessSupported();

  const [tab, setTab] = useState<VaultTab>('export');
  const [vaultName, setVaultName] = useState('GalleryDeck Vault');
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [exportConfirm, setExportConfirm] = useState('');
  const [exportBusy, setExportBusy] = useState(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [decryptPassphrase, setDecryptPassphrase] = useState('');
  const [decryptBusy, setDecryptBusy] = useState(false);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [session, setSession] = useState<DecryptedVaultSession | null>(null);
  const [activeFolder, setActiveFolder] = useState<string>('ALL');

  const [viewingItemId, setViewingItemId] = useState<string | null>(null);
  const [viewingTitle, setViewingTitle] = useState<string>('');
  const [viewingUrl, setViewingUrl] = useState<string | null>(null);
  const [viewingLoading, setViewingLoading] = useState(false);
  const [savedLocalVaults, setSavedLocalVaults] = useState<LocalEncryptedVaultMeta[]>([]);

  const multiFileInputRef = useRef<HTMLInputElement | null>(null);

  const refreshSavedVaults = async () => {
    try {
      const list = await listLocalEncryptedVaults();
      setSavedLocalVaults(list);
    } catch {
      // ignore storage read error
    }
  };

  const releaseViewingImage = () => {
    if (viewingUrl) {
      URL.revokeObjectURL(viewingUrl);
      setViewingUrl(null);
    }
    setViewingItemId(null);
    setViewingTitle('');
    setViewingLoading(false);
  };

  const lockVaultSession = () => {
    releaseViewingImage();
    if (session) {
      session.dispose();
      setSession(null);
    }
    setDecryptPassphrase('');
    setDecryptError(null);
  };

  // Cleanup ObjectURLs on unmount or modal close, and load saved local vaults when opened
  useEffect(() => {
    if (open) {
      const timer = window.setTimeout(() => {
        void refreshSavedVaults();
      }, 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      releaseViewingImage();
      if (session) {
        session.dispose();
        setSession(null);
      }
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const activeItems = items.filter((i) => !i.deleted);

  const collectVaultInputs = async (): Promise<VaultBuildInputItem[]> => {
    const inputs: VaultBuildInputItem[] = [];
    for (const item of activeItems) {
      if (!item.blobRef) continue;
      const stored = await idbAdapter.loadBlob(item.blobRef);
      if (!stored) continue;
      inputs.push({
        item,
        fullBytes: stored.bytes,
        fullMimeType: stored.mimeType || item.mimeType || 'image/png',
      });
    }
    return inputs;
  };

  const handleExportSingleVault = async () => {
    if (!exportPassphrase || exportPassphrase !== exportConfirm) return;
    setExportBusy(true);
    setExportProgress('0%');
    try {
      const inputs = await collectVaultInputs();
      if (inputs.length === 0) {
        onToast(gd.vaultNoLocalImages);
        return;
      }
      const { chunks } = await buildEncryptedVaultChunks({
        vaultName,
        items: inputs,
        passphrase: exportPassphrase,
        onProgress: (done, total) => setExportProgress(`${Math.round((done / total) * 100)}%`),
      });
      const blob = packChunksToVaultBlob(chunks);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (vaultName.trim() || 'gallerydeck-vault').replace(/[^a-zA-Z0-9_-]/g, '-');
      a.download = `${safeName}${GALLERY_DECK_VAULT_EXTENSION}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      onToast(gd.vaultExportedSuccess);
    } catch (err) {
      onToast(err instanceof Error ? err.message : gd.vaultExportFailed);
    } finally {
      setExportBusy(false);
      setExportProgress(null);
    }
  };

  const handleSaveLocalBrowserVault = async () => {
    if (!exportPassphrase || exportPassphrase !== exportConfirm) return;
    setExportBusy(true);
    setExportProgress('0%');
    try {
      const inputs = await collectVaultInputs();
      if (inputs.length === 0) {
        onToast(gd.vaultNoLocalImages);
        return;
      }
      const { chunks } = await buildEncryptedVaultChunks({
        vaultName,
        items: inputs,
        passphrase: exportPassphrase,
        onProgress: (done, total) => setExportProgress(`${Math.round((done / total) * 100)}%`),
      });
      const blob = packChunksToVaultBlob(chunks);
      await saveLocalEncryptedVault({
        vaultName,
        itemCount: inputs.length,
        vaultBlob: blob,
      });
      await refreshSavedVaults();
      onToast(gd.vaultSavedLocallySuccess);
    } catch (err) {
      onToast(err instanceof Error ? err.message : gd.vaultExportFailed);
    } finally {
      setExportBusy(false);
      setExportProgress(null);
    }
  };

  const handleSelectSavedVault = async (id: string) => {
    setDecryptError(null);
    const file = await loadLocalEncryptedVaultFile(id);
    if (!file) {
      setDecryptError(gd.vaultDecryptFailed);
      return;
    }
    setSelectedFiles([file]);
  };

  const handleDownloadSavedVault = async (id: string) => {
    const file = await loadLocalEncryptedVaultFile(id);
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDeleteSavedVault = async (id: string) => {
    await deleteLocalEncryptedVault(id);
    await refreshSavedVaults();
  };

  const handleExportChunkedFolder = async () => {
    if (!fsSupported || !exportPassphrase || exportPassphrase !== exportConfirm) return;
    setExportBusy(true);
    setExportProgress('0%');
    try {
      const picker = (window as DirectoryPickerWindow).showDirectoryPicker!;
      const dirHandle = await picker({ id: 'gallerydeck-encrypted-vault', mode: 'readwrite' });
      const inputs = await collectVaultInputs();
      if (inputs.length === 0) {
        onToast(gd.vaultNoLocalImages);
        return;
      }
      const { chunks } = await buildEncryptedVaultChunks({
        vaultName,
        items: inputs,
        passphrase: exportPassphrase,
        onProgress: (done, total) => setExportProgress(`${Math.round((done / total) * 100)}%`),
      });
      for (const chunk of chunks) {
        const fh = await dirHandle.getFileHandle(chunk.name, { create: true });
        const writable = await fh.createWritable();
        await writable.write(chunk.data.slice());
        await writable.close();
      }
      // Also write the self-contained offline viewer HTML into the local folder
      const htmlHandle = await dirHandle.getFileHandle(GALLERY_DECK_OFFLINE_VIEWER_FILENAME, {
        create: true,
      });
      const htmlWritable = await htmlHandle.createWritable();
      await htmlWritable.write(generateOfflineViewerHtml());
      await htmlWritable.close();
      onToast(gd.vaultExportedSuccess);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        onToast(err instanceof Error ? err.message : gd.vaultExportFailed);
      }
    } finally {
      setExportBusy(false);
      setExportProgress(null);
    }
  };

  const handlePickEncryptedFolder = async () => {
    if (!fsSupported) return;
    setDecryptError(null);
    try {
      const picker = (window as DirectoryPickerWindow).showDirectoryPicker!;
      const dirHandle = await picker({ id: 'gallerydeck-encrypted-vault-read', mode: 'read' });
      const collected: File[] = [];
      for await (const entry of (dirHandle as unknown as { values: () => AsyncIterable<FileSystemHandle> }).values()) {
        if (entry.kind === 'file') {
          collected.push(await (entry as FileSystemFileHandle).getFile());
        }
      }
      setSelectedFiles(collected);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setDecryptError(err instanceof Error ? err.message : gd.vaultDecryptFailed);
      }
    }
  };

  const handleUnlockVault = async () => {
    if (selectedFiles.length === 0 || !decryptPassphrase) return;
    setDecryptBusy(true);
    setDecryptError(null);
    try {
      const nextSession = await openEncryptedVaultSession({
        files: selectedFiles,
        passphrase: decryptPassphrase,
      });
      if (session) session.dispose();
      setSession(nextSession);
      setActiveFolder('ALL');

      // Automatically reflect decrypted artworks into GalleryDeck (IndexedDB + catalog)
      if (onImportDecryptedItems && nextSession.manifest.items.length > 0) {
        const now = Date.now();
        const hydrated: GalleryArtworkItem[] = [];
        for (const entry of nextSession.manifest.items) {
          let blobRef: string | undefined;
          let mimeType = entry.mimeType || 'image/png';
          let fileSizeBytes = entry.fileSizeBytes;
          try {
            const { blobUrl, mimeType: decryptedMime } = await nextSession.decryptFullImage(entry.id);
            try {
              const res = await fetch(blobUrl);
              const bytes = new Uint8Array(await res.arrayBuffer());
              mimeType = decryptedMime || mimeType;
              fileSizeBytes = bytes.byteLength;
              await idbAdapter.saveBlob(entry.id, bytes, mimeType);
              blobRef = entry.id;
            } finally {
              URL.revokeObjectURL(blobUrl);
            }
          } catch {
            // Keep metadata even if full image chunk fails
          }

          let thumbnailDataUrl = '';
          const thumbUrl = nextSession.thumbnailUrls[entry.id];
          if (thumbUrl) {
            try {
              thumbnailDataUrl = await urlToDataUrl(thumbUrl);
            } catch {
              thumbnailDataUrl = '';
            }
          }

          hydrated.push({
            id: entry.id,
            title: entry.title,
            authorName: entry.authorName,
            createdAt: entry.createdAt || now,
            importedAt: now,
            updatedAt: now,
            width: entry.width,
            height: entry.height,
            mimeType,
            fileSizeBytes,
            thumbnailDataUrl,
            blobRef,
            provenanceStatus: entry.provenanceStatus ?? 'unverified',
            qrMode: 'none',
            publicKeyFingerprint: entry.publicKeyFingerprint,
            licenseId: entry.licenseId,
            tags: entry.tags ?? [],
            collections: entry.collections ?? [],
            deleted: false,
          });
        }
        if (hydrated.length > 0) {
          await onImportDecryptedItems(hydrated);
        }
      }
    } catch (err) {
      setDecryptError(err instanceof Error ? err.message : gd.vaultDecryptFailed);
    } finally {
      setDecryptBusy(false);
    }
  };

  const handleOpenFullImage = async (itemId: string, title: string) => {
    if (!session) return;
    releaseViewingImage();
    setViewingItemId(itemId);
    setViewingTitle(title);
    setViewingLoading(true);
    try {
      const { blobUrl } = await session.decryptFullImage(itemId);
      setViewingUrl(blobUrl);
    } catch (err) {
      onToast(err instanceof Error ? err.message : gd.vaultDecryptFailed);
      setViewingItemId(null);
    } finally {
      setViewingLoading(false);
    }
  };

  const passMismatch = exportConfirm.length > 0 && exportPassphrase !== exportConfirm;
  const canExport = exportPassphrase.length > 0 && exportPassphrase === exportConfirm && !exportBusy;

  const filteredVaultItems = session
    ? activeFolder === 'ALL'
      ? session.manifest.items
      : session.manifest.items.filter((i) => i.folder === activeFolder)
    : [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={gd.vaultModalTitle}
      data-testid="gallerydeck-vault-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700/80 bg-slate-900/95 text-slate-100 shadow-2xl p-5 sm:p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white">{gd.vaultModalTitle}</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{gd.vaultModalSubtitle}</p>
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

        {/* Mode Switcher */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <button
            type="button"
            onClick={() => setTab('export')}
            data-testid="vault-tab-export"
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold cursor-pointer ${
              tab === 'export'
                ? 'bg-cyan-500 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Lock className="h-3.5 w-3.5" />
            {gd.vaultTabExport}
          </button>
          <button
            type="button"
            onClick={() => setTab('decrypt')}
            data-testid="vault-tab-decrypt"
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold cursor-pointer ${
              tab === 'decrypt'
                ? 'bg-cyan-500 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Unlock className="h-3.5 w-3.5" />
            {gd.vaultTabDecrypt}
          </button>
          <button
            type="button"
            onClick={() => {
              downloadOfflineViewerHtml();
              onToast(gd.vaultOfflineViewerDownloaded);
            }}
            data-testid="vault-download-offline-html-btn"
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 px-3 py-2 text-xs font-semibold text-emerald-200 cursor-pointer"
          >
            <FileCode2 className="h-3.5 w-3.5" />
            {gd.vaultDownloadOfflineViewer}
          </button>
        </div>

        {tab === 'export' ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs text-cyan-300">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>{gd.vaultZeroKnowledgeNote}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-300 mb-1">{gd.vaultNameLabel}</label>
                  <input
                    type="text"
                    value={vaultName}
                    onChange={(e) => setVaultName(e.target.value)}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">{gd.vaultPassphraseLabel}</label>
                  <input
                    type="password"
                    value={exportPassphrase}
                    onChange={(e) => setExportPassphrase(e.target.value)}
                    autoComplete="new-password"
                    data-testid="vault-export-passphrase"
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">{gd.vaultPassphraseConfirmLabel}</label>
                  <input
                    type="password"
                    value={exportConfirm}
                    onChange={(e) => setExportConfirm(e.target.value)}
                    autoComplete="new-password"
                    data-testid="vault-export-passphrase-confirm"
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              {passMismatch && (
                <p className="text-xs text-rose-400">{gd.vaultPassphraseMismatch}</p>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  disabled={!canExport}
                  onClick={() => void handleExportSingleVault()}
                  data-testid="vault-export-single-btn"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 px-4 py-2 text-xs font-semibold text-slate-950 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  {exportProgress ? `${gd.vaultEncrypting} (${exportProgress})` : gd.vaultExportSingleFile}
                </button>

                <button
                  type="button"
                  disabled={!canExport}
                  onClick={() => void handleSaveLocalBrowserVault()}
                  data-testid="vault-save-local-btn"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-40 border border-emerald-400/40 px-4 py-2 text-xs font-semibold text-emerald-200 cursor-pointer"
                >
                  <HardDrive className="h-3.5 w-3.5" />
                  {gd.vaultSaveLocalBrowser}
                </button>

                {fsSupported && (
                  <button
                    type="button"
                    disabled={!canExport}
                    onClick={() => void handleExportChunkedFolder()}
                    data-testid="vault-export-folder-btn"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-600 px-4 py-2 text-xs font-semibold text-slate-100 cursor-pointer"
                  >
                    <FolderOpen className="h-3.5 w-3.5 text-indigo-400" />
                    {gd.vaultExportChunkedFolder}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {!session ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {fsSupported && (
                    <button
                      type="button"
                      onClick={() => void handlePickEncryptedFolder()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3.5 py-2 text-xs font-medium text-slate-100 cursor-pointer"
                    >
                      <FolderOpen className="h-3.5 w-3.5 text-indigo-400" />
                      {gd.vaultPickFolder}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => multiFileInputRef.current?.click()}
                    data-testid="vault-pick-files-btn"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3.5 py-2 text-xs font-medium text-slate-100 cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5 text-cyan-400" />
                    {gd.vaultPickFiles}
                  </button>
                  <input
                    ref={multiFileInputRef}
                    type="file"
                    multiple
                    accept=".gdvault,.enc"
                    data-testid="vault-file-input"
                    className="hidden"
                    onChange={(e) => {
                      setSelectedFiles(Array.from(e.target.files ?? []));
                      setDecryptError(null);
                      e.target.value = '';
                    }}
                  />
                </div>

                <p className="text-xs text-slate-400">
                  {selectedFiles.length > 0
                    ? `${selectedFiles.length} file(s) ready`
                    : gd.vaultPickHint}
                </p>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="password"
                    value={decryptPassphrase}
                    onChange={(e) => setDecryptPassphrase(e.target.value)}
                    placeholder={gd.vaultPassphraseLabel}
                    autoComplete="off"
                    data-testid="vault-decrypt-passphrase"
                    className="flex-1 rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white"
                  />
                  <button
                    type="button"
                    disabled={selectedFiles.length === 0 || !decryptPassphrase || decryptBusy}
                    onClick={() => void handleUnlockVault()}
                    data-testid="vault-unlock-btn"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 px-4 py-2 text-xs font-semibold text-slate-950 cursor-pointer"
                  >
                    <Unlock className="h-3.5 w-3.5" />
                    {decryptBusy ? gd.vaultDecrypting : gd.vaultUnlockButton}
                  </button>
                </div>

                {decryptError && <p className="text-xs text-rose-400">{decryptError}</p>}

                {/* Locally Saved Encrypted Vaults (IndexedDB) */}
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <HardDrive className="h-3.5 w-3.5 text-emerald-400" />
                    {gd.vaultSavedListTitle}
                  </p>
                  {savedLocalVaults.length === 0 ? (
                    <p className="text-xs text-slate-500">{gd.vaultSavedEmpty}</p>
                  ) : (
                    <div className="space-y-1.5">
                      {savedLocalVaults.map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-white truncate">{v.vaultName}</p>
                            <p className="text-[11px] text-slate-400 font-mono">
                              {v.itemCount} items · {(v.byteLength / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => void handleSelectSavedVault(v.id)}
                              className="rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 px-2.5 py-1 text-xs font-medium text-cyan-200 cursor-pointer"
                            >
                              {gd.vaultLoadFromLocal}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDownloadSavedVault(v.id)}
                              aria-label={gd.vaultExportSingleFile}
                              className="rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 p-1.5 text-slate-200 cursor-pointer"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteSavedVault(v.id)}
                              aria-label={gd.actionDelete}
                              className="rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/60 p-1.5 text-rose-300 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 overflow-x-auto">
                    {['ALL', ...session.manifest.folders].map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setActiveFolder(f)}
                        className={`rounded-full px-3 py-1 text-xs font-medium cursor-pointer ${
                          activeFolder === f
                            ? 'bg-white text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {f === 'ALL' ? `All (${session.manifest.items.length})` : f}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={lockVaultSession}
                    className="rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/60 px-3 py-1.5 text-xs font-medium text-rose-200 cursor-pointer"
                  >
                    {gd.vaultLockAndClear}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredVaultItems.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => void handleOpenFullImage(entry.id, entry.title)}
                      className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950/80 hover:border-cyan-400/60 text-left transition-colors cursor-pointer"
                    >
                      <div className="aspect-[4/3] bg-slate-950 flex items-center justify-center overflow-hidden">
                        {session.thumbnailUrls[entry.id] ? (
                          <img
                            src={session.thumbnailUrls[entry.id]}
                            alt={entry.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-[11px] text-slate-500">{gd.noPreview}</span>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-medium text-white truncate">{entry.title}</p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {entry.width}×{entry.height}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full-Resolution On-Demand Decrypted Lightbox (revokes ObjectURL immediately on close) */}
      {viewingItemId && (
        <div
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-slate-950/95 p-4"
          onClick={(e) => {
            e.stopPropagation();
            releaseViewingImage();
          }}
        >
          <div
            className="w-full max-w-5xl flex items-center justify-between gap-3 mb-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-white truncate">{viewingTitle}</p>
            <button
              type="button"
              onClick={releaseViewingImage}
              className="rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-100 cursor-pointer"
            >
              {gd.closeDetails}
            </button>
          </div>
          <div
            className="flex-1 w-full max-w-5xl flex items-center justify-center overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {viewingLoading ? (
              <p className="text-xs text-cyan-300">{gd.vaultDecrypting}</p>
            ) : viewingUrl ? (
              <img
                src={viewingUrl}
                alt={viewingTitle}
                className="max-w-full max-h-[82vh] object-contain rounded-xl"
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

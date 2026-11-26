import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Cloud,
  FolderOpen,
  Gamepad2,
  HardDrive,
  ImagePlus,
  QrCode,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { HelpTip } from '../../components/HelpTip';
import { useAppPreferences } from '../../components/PreferencesContext';
import { googleAuthManager } from '../../core/google/gisAuth';
import type { LicenseId } from '../../core/manifest/types';
import { useDeckNavigation } from '../../hooks/useDeckNavigation';
import { useI18n } from '../../i18n/context';
import {
  buildEncryptedVaultChunks,
  openEncryptedVaultSession,
  packChunksToVaultBlob,
} from '../../services/galleryCrypto';
import type { VaultBuildInputItem } from '../../services/galleryCrypto';
import {
  FileSystemGalleryAdapter,
  GoogleDriveGalleryAdapter,
  IndexedDbGalleryAdapter,
  base64ToBytes,
  bytesToBase64,
  loadInitialCatalog,
  mergeCatalogs,
  parseChdeckArchive,
  serializeChdeckArchive,
  syncGalleryAdapters,
} from '../../services/galleryStorage';
import { createEmptyCatalog } from '../../types/gallerydeck';
import type {
  GalleryArtworkItem,
  GalleryDeckCatalog,
  GalleryFilterTab,
  SyncTierStatus,
} from '../../types/gallerydeck';
import { ArtworkDetailDrawer } from './ArtworkDetailDrawer';
import { InImageQrPlacementModal } from './InImageQrPlacementModal';
import type { CertifyModalSubmission } from './InImageQrPlacementModal';
import {
  certifyArtworkInDeck,
  importArtworkFileToDeck,
  verifyArtworkInDeck,
} from './galleryDeckHelpers';
import { GoogleDriveRiskConsentModal } from './GoogleDriveRiskConsentModal';
import { SyncPanelModal } from './SyncPanelModal';

const FILTER_TABS: GalleryFilterTab[] = ['all', 'recent', 'verified', 'unverified', 'collections'];

export function GalleryDeckPage() {
  const { t, locale } = useI18n();
  const { isAdvanced } = useAppPreferences();
  const gd = t.galleryDeck;
  const isJa = locale === 'ja';

  const [idbAdapter] = useState<IndexedDbGalleryAdapter>(() => new IndexedDbGalleryAdapter());
  const idbAdapterRef = useRef<IndexedDbGalleryAdapter>(idbAdapter);
  const fsAdapterRef = useRef<FileSystemGalleryAdapter>(new FileSystemGalleryAdapter());
  const gdriveAdapterRef = useRef<GoogleDriveGalleryAdapter>(
    new GoogleDriveGalleryAdapter(googleAuthManager),
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const [catalog, setCatalog] = useState<GalleryDeckCatalog>(() => createEmptyCatalog());
  const [activeTab, setActiveTab] = useState<GalleryFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [pendingQrPlacement, setPendingQrPlacement] = useState<{
    item: GalleryArtworkItem;
    licenseId: LicenseId;
    qrMode: 'in-image' | 'outer-border';
  } | null>(null);
  const [vaultModalOpen, setVaultModalOpen] = useState(false);
  const [driveRiskModalOpen, setDriveRiskModalOpen] = useState(false);
  const [driveRiskConsentAccepted, setDriveRiskConsentAccepted] = useState(false);
  const [busyAction, setBusyAction] = useState<'certify' | 'verify' | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const [linkedDirName] = useState<string | null>(null);
  const [driveConnected, setDriveConnected] = useState<boolean>(
    () => googleAuthManager.getState().connected,
  );

  const [tierStatuses, setTierStatuses] = useState<
    Record<'indexeddb' | 'filesystem' | 'gdrive', SyncTierStatus>
  >({
    indexeddb: { tier: 'indexeddb', state: 'synced', lastSyncedAt: null },
    filesystem: { tier: 'filesystem', state: 'disconnected', lastSyncedAt: null },
    gdrive: { tier: 'gdrive', state: 'disconnected', lastSyncedAt: null },
  });

  const showToast = useCallback((msg: string) => {
    setStatusToast(msg);
    setTimeout(() => {
      setStatusToast((curr) => (curr === msg ? null : curr));
    }, 3500);
  }, []);

  // Load initial catalog from IndexedDB
  useEffect(() => {
    let active = true;
    void loadInitialCatalog(idbAdapterRef.current).then((loaded) => {
      if (!active) return;
      setCatalog(loaded);
      setTierStatuses((prev) => ({
        ...prev,
        indexeddb: { tier: 'indexeddb', state: 'synced', lastSyncedAt: Date.now() },
      }));
    });
    return () => {
      active = false;
    };
  }, []);

  // Subscribe to Google Auth state
  useEffect(() => {
    const auth = googleAuthManager;
    return auth.subscribe(() => {
      const connected = auth.getState().connected;
      setDriveConnected(connected);
      setTierStatuses((prev) => ({
        ...prev,
        gdrive: {
          ...prev.gdrive,
          state: connected ? 'idle' : 'disconnected',
        },
      }));
    });
  }, []);

  const persistCatalog = useCallback(
    async (nextCatalog: GalleryDeckCatalog) => {
      setCatalog(nextCatalog);
      const adapters = [
        idbAdapterRef.current,
        ...(fsAdapterRef.current.isLinked() ? [fsAdapterRef.current] : []),
        ...(driveRiskConsentAccepted && gdriveAdapterRef.current.isAvailable()
          ? [gdriveAdapterRef.current]
          : []),
      ];
      await syncGalleryAdapters(nextCatalog, adapters);
    },
    [driveRiskConsentAccepted],
  );

  // Filter visible items
  const visibleItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const activeItems = catalog.items.filter((item) => !item.deleted);

    let filtered = activeItems;
    if (activeTab === 'verified') {
      filtered = activeItems.filter((i) => i.provenanceStatus === 'signed');
    } else if (activeTab === 'unverified') {
      filtered = activeItems.filter((i) => i.provenanceStatus !== 'signed');
    } else if (activeTab === 'collections') {
      filtered = activeItems.filter((i) => i.collections.length > 0);
    } else if (activeTab === 'recent') {
      filtered = [...activeItems].sort((a, b) => b.importedAt - a.importedAt).slice(0, 12);
    }

    if (query) {
      filtered = filtered.filter(
        (i) =>
          i.title.toLowerCase().includes(query) ||
          (i.authorName?.toLowerCase().includes(query) ?? false) ||
          (i.licenseId?.toLowerCase().includes(query) ?? false) ||
          i.tags.some((tag) => tag.toLowerCase().includes(query)),
      );
    }
    return filtered;
  }, [catalog.items, activeTab, searchQuery]);

  const safeFocusedIndex =
    visibleItems.length > 0 ? Math.min(focusedIndex, visibleItems.length - 1) : 0;
  const focusedItem = visibleItems[safeFocusedIndex] ?? null;
  const selectedItem = useMemo(
    () => catalog.items.find((i) => i.id === selectedItemId && !i.deleted) ?? null,
    [catalog.items, selectedItemId],
  );

  // Scroll focused card into view smoothly
  useEffect(() => {
    const el = cardRefs.current[safeFocusedIndex];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [safeFocusedIndex]);

  const handleNextTab = useCallback(() => {
    setActiveTab((curr) => FILTER_TABS[(FILTER_TABS.indexOf(curr) + 1) % FILTER_TABS.length]);
    setFocusedIndex(0);
  }, []);

  const handlePrevTab = useCallback(() => {
    setActiveTab(
      (curr) => FILTER_TABS[(FILTER_TABS.indexOf(curr) - 1 + FILTER_TABS.length) % FILTER_TABS.length],
    );
    setFocusedIndex(0);
  }, []);

  const { gamepadConnected, gamepadName } = useDeckNavigation({
    itemCount: visibleItems.length,
    focusedIndex: safeFocusedIndex,
    onFocusChange: setFocusedIndex,
    onSelect: () => {
      if (focusedItem) setSelectedItemId(focusedItem.id);
    },
    onBack: () => {
      if (driveRiskModalOpen) {
        setDriveRiskModalOpen(false);
      } else if (vaultModalOpen) {
        setVaultModalOpen(false);
      } else if (selectedItemId) {
        setSelectedItemId(null);
      } else if (syncModalOpen) {
        setSyncModalOpen(false);
      }
    },
    onNextTab: handleNextTab,
    onPrevTab: handlePrevTab,
    onOpenSearch: () => searchInputRef.current?.focus(),
    disabled: Boolean(selectedItemId || syncModalOpen || vaultModalOpen || driveRiskModalOpen),
  });

  const handleImportFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const imported: GalleryArtworkItem[] = [];
      for (const file of Array.from(files)) {
        const item = await importArtworkFileToDeck(
          file,
          idbAdapterRef.current,
          fsAdapterRef.current,
        );
        imported.push(item);
      }
      const nextCatalog: GalleryDeckCatalog = {
        ...catalog,
        updatedAt: Date.now(),
        items: [...imported, ...catalog.items],
      };
      await persistCatalog(nextCatalog);
      setFocusedIndex(0);
      showToast(`${imported.length} ${gd.toastImported}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : gd.toastImportFailed);
    }
  };

  const executeCertify = async (
    item: GalleryArtworkItem,
    submission: CertifyModalSubmission,
  ) => {
    setBusyAction('certify');
    try {
      const updated = await certifyArtworkInDeck({
        item,
        idbAdapter: idbAdapterRef.current,
        licenseId: submission.licenseId,
        authorName: submission.authorName || undefined,
        artworkTitle: submission.artworkTitle || undefined,
        qrMode: submission.qrMode,
        inImagePlacement: submission.inImagePlacement,
      });
      const nextCatalog: GalleryDeckCatalog = {
        ...catalog,
        updatedAt: Date.now(),
        items: catalog.items.map((i) => (i.id === updated.id ? updated : i)),
      };
      await persistCatalog(nextCatalog);
      setPendingQrPlacement(null);
      showToast(gd.toastCertified);
    } catch (err) {
      showToast(err instanceof Error ? err.message : gd.toastCertifyFailed);
    } finally {
      setBusyAction(null);
    }
  };

  const handleCertify = async (
    item: GalleryArtworkItem,
    licenseId: LicenseId,
    qrMode: 'in-image' | 'outer-border' = 'in-image',
  ) => {
    setPendingQrPlacement({ item, licenseId, qrMode });
  };

  const handleVerify = async (item: GalleryArtworkItem) => {
    setBusyAction('verify');
    try {
      const updated = await verifyArtworkInDeck({
        item,
        idbAdapter: idbAdapterRef.current,
      });
      const nextCatalog: GalleryDeckCatalog = {
        ...catalog,
        updatedAt: Date.now(),
        items: catalog.items.map((i) => (i.id === updated.id ? updated : i)),
      };
      await persistCatalog(nextCatalog);
      showToast(updated.verificationSummary || gd.toastVerified);
    } catch (err) {
      showToast(err instanceof Error ? err.message : gd.toastVerifyFailed);
    } finally {
      setBusyAction(null);
    }
  };

  const handleDownload = async (item: GalleryArtworkItem) => {
    const blob = item.blobRef ? await idbAdapterRef.current.loadBlob(item.blobRef) : null;
    if (!blob) {
      showToast(gd.toastNoBlob);
      return;
    }
    const url = URL.createObjectURL(new Blob([blob.bytes.slice()], { type: blob.mimeType }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.title || 'artwork'}${item.provenanceStatus === 'signed' ? '-certified' : ''}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDelete = (item: GalleryArtworkItem) => {
    const now = Date.now();
    const nextCatalog: GalleryDeckCatalog = {
      ...catalog,
      updatedAt: now,
      items: catalog.items.map((i) =>
        i.id === item.id ? { ...i, deleted: true, updatedAt: now } : i,
      ),
    };
    setSelectedItemId(null);
    void persistCatalog(nextCatalog);
    showToast(gd.toastDeleted);
  };

  const handleSyncAll = async (allowDriveOverride = false) => {
    setSyncing(true);
    try {
      const canUseDrive =
        (driveRiskConsentAccepted || allowDriveOverride) && gdriveAdapterRef.current.isAvailable();
      const adapters = [
        idbAdapterRef.current,
        ...(fsAdapterRef.current.isLinked() ? [fsAdapterRef.current] : []),
        ...(canUseDrive ? [gdriveAdapterRef.current] : []),
      ];
      const result = await syncGalleryAdapters(catalog, adapters);
      setCatalog(result.catalog);
      const now = Date.now();
      setTierStatuses((prev) => ({
        indexeddb: {
          ...prev.indexeddb,
          state: result.syncedTiers.includes('indexeddb') ? 'synced' : prev.indexeddb.state,
          lastSyncedAt: now,
        },
        filesystem: {
          ...prev.filesystem,
          state: fsAdapterRef.current.isLinked()
            ? result.syncedTiers.includes('filesystem')
              ? 'synced'
              : 'error'
            : 'disconnected',
          lastSyncedAt: result.syncedTiers.includes('filesystem') ? now : prev.filesystem.lastSyncedAt,
        },
        gdrive: {
          ...prev.gdrive,
          state: gdriveAdapterRef.current.isAvailable()
            ? result.syncedTiers.includes('gdrive')
              ? 'synced'
              : 'error'
            : 'disconnected',
          lastSyncedAt: result.syncedTiers.includes('gdrive') ? now : prev.gdrive.lastSyncedAt,
        },
      }));
      showToast(gd.toastSynced);
    } finally {
      setSyncing(false);
    }
  };

  const executeConnectDrive = async () => {
    const auth = googleAuthManager;
    if (!auth.getState().connected) {
      try {
        await auth.connectInteractive({ prompt: 'consent' });
      } catch (err) {
        showToast(err instanceof Error ? err.message : gd.toastSyncFailed);
        return;
      }
    }
    await handleSyncAll(true);
  };

  const handleConnectDrive = async () => {
    if (!driveRiskConsentAccepted) {
      setDriveRiskModalOpen(true);
      return;
    }
    await executeConnectDrive();
  };

  const handleConfirmDriveRiskConsent = () => {
    setDriveRiskConsentAccepted(true);
    setDriveRiskModalOpen(false);
    void executeConnectDrive();
  };

  const handleResetDriveSync = async () => {
    await googleAuthManager.disconnect({ revokeAuthorization: true });
    setDriveConnected(false);
    setDriveRiskConsentAccepted(false);
    setTierStatuses((prev) => ({
      ...prev,
      gdrive: { tier: 'gdrive', state: 'disconnected', lastSyncedAt: null },
    }));
    showToast(isJa ? 'Google Drive の同期設定を削除しました' : 'Google Drive sync settings removed');
  };

  const handleUploadEncryptedDrive = async (passphrase: string) => {
    const active = catalog.items.filter((i) => !i.deleted);
    const inputs: VaultBuildInputItem[] = [];
    for (const item of active) {
      if (!item.blobRef) continue;
      const stored = await idbAdapterRef.current.loadBlob(item.blobRef);
      if (!stored) continue;
      inputs.push({
        item,
        fullBytes: stored.bytes,
        fullMimeType: stored.mimeType || item.mimeType || 'image/png',
      });
    }
    if (inputs.length === 0) {
      throw new Error(
        isJa
          ? '暗号化して保存できるイラスト画像がローカルにありません。'
          : 'No local artwork images found to encrypt and upload.',
      );
    }
    const built = await buildEncryptedVaultChunks({
      vaultName: 'GalleryDeck Drive Sync',
      items: inputs,
      passphrase,
    });
    const bundleBlob = packChunksToVaultBlob(built.chunks);
    await gdriveAdapterRef.current.saveEncryptedBundle(bundleBlob);
    setTierStatuses((prev) => ({
      ...prev,
      gdrive: { tier: 'gdrive', state: 'synced', lastSyncedAt: Date.now() },
    }));
    showToast(
      isJa
        ? `${inputs.length}件の作品を暗号化して Google Drive に保存しました`
        : `Encrypted and saved ${inputs.length} artwork(s) to Google Drive`,
    );
  };

  const handleRestoreEncryptedDrive = async (passphrase: string) => {
    const bundleBlob = await gdriveAdapterRef.current.loadEncryptedBundle();
    if (!bundleBlob) {
      throw new Error(
        isJa
          ? 'Google Drive に暗号化データが見つかりませんでした。先に暗号化して保存してください。'
          : 'No encrypted bundle found on Google Drive. Encrypt and save first.',
      );
    }
    const bundleFile = new File([bundleBlob], 'gallerydeck-encrypted-bundle.gdvault', {
      type: 'application/octet-stream',
    });
    const session = await openEncryptedVaultSession({
      files: [bundleFile],
      passphrase,
    });
    try {
      const restoredItems: GalleryArtworkItem[] = [];
      for (const entry of session.manifest.items) {
        const full = await session.decryptFullImage(entry.id);
        const fullRes = await fetch(full.blobUrl);
        const fullBytes = new Uint8Array(await fullRes.arrayBuffer());
        const blobRef = `blob:${entry.id}`;
        await idbAdapterRef.current.saveBlob(blobRef, fullBytes, full.mimeType);
        const thumbUrl = session.thumbnailUrls[entry.id] ?? '';
        let thumbDataUrl = '';
        if (thumbUrl) {
          const thumbRes = await fetch(thumbUrl);
          const thumbBlob = await thumbRes.blob();
          thumbDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
            reader.onerror = () => resolve('');
            reader.readAsDataURL(thumbBlob);
          });
        }
        const existing = catalog.items.find((i) => i.id === entry.id);
        restoredItems.push({
          id: entry.id,
          title: entry.title,
          authorName: entry.authorName,
          createdAt: entry.createdAt,
          importedAt: existing?.importedAt ?? entry.createdAt,
          updatedAt: Date.now(),
          width: entry.width,
          height: entry.height,
          mimeType: full.mimeType,
          fileSizeBytes: fullBytes.byteLength,
          thumbnailDataUrl: thumbDataUrl,
          blobRef,
          provenanceStatus: entry.provenanceStatus ?? existing?.provenanceStatus ?? 'unverified',
          qrMode: existing?.qrMode ?? 'none',
          publicKeyFingerprint: entry.publicKeyFingerprint ?? existing?.publicKeyFingerprint,
          artworkSha256Hex: existing?.artworkSha256Hex,
          licenseId: entry.licenseId ?? existing?.licenseId,
          tags: entry.tags,
          collections: entry.collections,
          proofToken: existing?.proofToken,
          proofUrl: existing?.proofUrl,
        });
      }
      const byId = new Map(catalog.items.map((item) => [item.id, item]));
      for (const item of restoredItems) {
        byId.set(item.id, item);
      }
      const nextCatalog: GalleryDeckCatalog = {
        ...catalog,
        updatedAt: Date.now(),
        items: Array.from(byId.values()).sort((a, b) => b.importedAt - a.importedAt),
      };
      await persistCatalog(nextCatalog);
      setFocusedIndex(0);
      setTierStatuses((prev) => ({
        ...prev,
        gdrive: { tier: 'gdrive', state: 'synced', lastSyncedAt: Date.now() },
      }));
      showToast(
        isJa
          ? `Google Drive から ${restoredItems.length}件の作品を復号して復元しました`
          : `Decrypted and restored ${restoredItems.length} artwork(s) from Google Drive`,
      );
    } finally {
      session.dispose();
    }
  };

  const handleExportArchive = async () => {
    const assets: Record<string, { mimeType: string; base64: string }> = {};
    for (const item of catalog.items) {
      if (item.deleted || !item.blobRef) continue;
      const blob = await idbAdapterRef.current.loadBlob(item.blobRef);
      if (blob) {
        assets[item.id] = { mimeType: blob.mimeType, base64: bytesToBase64(blob.bytes) };
      }
    }
    const json = serializeChdeckArchive(catalog, assets);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `gallerydeck-backup-${new Date().toISOString().slice(0, 10)}.chdeck`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(gd.toastExported);
  };

  const handleImportArchive = async (file: File) => {
    try {
      const text = await file.text();
      const archive = parseChdeckArchive(text);
      if (archive.assets) {
        for (const [id, asset] of Object.entries(archive.assets)) {
          const item = archive.catalog.items.find((i) => i.id === id);
          const blobKey = item?.blobRef ?? `blob:${id}`;
          await idbAdapterRef.current.saveBlob(
            blobKey,
            base64ToBytes(asset.base64),
            asset.mimeType,
          );
        }
      }
      const merged = mergeCatalogs(catalog, archive.catalog);
      await persistCatalog(merged);
      showToast(gd.toastRestored);
    } catch (err) {
      showToast(err instanceof Error ? err.message : gd.toastRestoreFailed);
    }
  };

  const tabLabel = (tab: GalleryFilterTab): string => {
    switch (tab) {
      case 'all':
        return gd.tabAll;
      case 'recent':
        return gd.tabRecent;
      case 'verified':
        return gd.tabVerified;
      case 'unverified':
        return gd.tabUnverified;
      case 'collections':
        return gd.tabCollections;
    }
  };

  return (
    <section
      data-testid="gallerydeck-page"
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer?.files?.length) {
          void handleImportFiles(e.dataTransfer.files);
        }
      }}
      className="relative -mx-4 sm:-mx-6 -my-6 sm:-my-10 min-h-[calc(100vh-6rem)] overflow-hidden bg-transparent ga-text flex flex-col justify-between"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        data-testid="gallerydeck-file-input"
        className="hidden"
        onChange={(e) => {
          void handleImportFiles(e.target.files);
          e.target.value = '';
        }}
      />
      {/* Minimal Gallery Header (hidden in Simple Mode when empty so GalleryDeck floats cleanly alone) */}
      {(isAdvanced || visibleItems.length > 0 || searchQuery.length > 0 || activeTab !== 'all') && (
      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6 pt-5 pb-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight ga-text">
              {gd.title}
            </h1>
            <HelpTip
              label={t.simple.home.localOnlyTipLabel}
              text={t.simple.home.localOnlyTipText}
              testId="gallerydeck-help-tip-btn"
              panelTestId="gallerydeck-help-tip-panel"
            />
            {linkedDirName && (
              <span className="inline-flex items-center gap-1 rounded-full border ga-border-strong ga-surface-subtle px-2.5 py-0.5 text-[11px] font-mono ga-text-secondary">
                <FolderOpen className="h-3 w-3 ga-text-accent" />
                {linkedDirName}
              </span>
            )}
            {gamepadConnected && (
              <span
                title={gamepadName ?? undefined}
                className="inline-flex items-center gap-1 rounded-full border ga-border-strong ga-surface-subtle px-2 py-0.5 text-[11px] ga-text-secondary"
              >
                <Gamepad2 className="h-3 w-3" />
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSyncModalOpen(true)}
              data-testid="gallerydeck-open-sync-btn"
              className="ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium cursor-pointer"
            >
              {driveConnected ? (
                <Cloud className="h-3.5 w-3.5 ga-text-accent" />
              ) : (
                <HardDrive className="h-3.5 w-3.5 ga-text-muted" />
              )}
              <span className="hidden sm:inline">{gd.storageSyncButton}</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              data-testid="gallerydeck-import-btn"
              className="chm-link-dynamic ga-btn-primary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold cursor-pointer"
            >
              <ImagePlus className="h-4 w-4" />
              {gd.importArtwork}
            </button>
          </div>
        </div>

        {/* Filter Tabs + Quick Search (only shown when items exist or searching) */}
        {(visibleItems.length > 0 || searchQuery.length > 0 || activeTab !== 'all') && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div role="tablist" aria-label={gd.filterTabsAria} className="flex items-center gap-1.5 overflow-x-auto pb-1 chm-no-scrollbar">
              {FILTER_TABS.map((tab) => {
                const active = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    data-testid={`gallerydeck-tab-${tab}`}
                    onClick={() => {
                      setActiveTab(tab);
                      setFocusedIndex(0);
                    }}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-[var(--ga-primary-bg)] text-[var(--ga-primary-text)]'
                        : 'ga-surface-subtle ga-text-secondary hover:text-[var(--ga-text)] border ga-border'
                    }`}
                  >
                    {tabLabel(tab)}
                  </button>
                );
              })}
            </div>

            <div className="relative w-full sm:w-60">
              <Search className="h-3.5 w-3.5 ga-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setFocusedIndex(0);
                }}
                placeholder={gd.searchPlaceholder}
                data-testid="gallerydeck-search-input"
                className="w-full rounded-full ga-surface-solid border ga-border pl-8 pr-3 py-1.5 text-xs ga-text placeholder:text-[var(--ga-text-muted)] focus:outline-none focus:border-[var(--ga-accent)]"
              />
            </div>
          </div>
        )}
      </div>
      )}

      {/* Main Gallery Light-Table Stage */}
      <div className="relative z-10 flex-1 flex flex-col justify-center py-6 sm:py-8">
        {visibleItems.length === 0 ? (
          <div
            data-testid="gallerydeck-empty-state"
            className="mx-auto w-full max-w-lg px-4 text-center space-y-5"
          >
            <div className="ga-card rounded-3xl p-7 sm:p-10 space-y-6">
              <div className="space-y-1.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight ga-text">
                  {gd.title}
                </h1>
                <p className="text-xs sm:text-sm ga-text-secondary">
                  {isJa
                    ? '絵を入れて署名するだけ。完全無料・登録なし・画像はサーバーに送りません。'
                    : gd.emptySubtitle}
                </p>
              </div>

              {/* Ultra-clear 3-step visual flow for illustrators */}
              <div className="grid grid-cols-3 gap-2 text-[11px] sm:text-xs">
                <div className="ga-surface-subtle rounded-2xl px-2 py-2.5 font-semibold ga-text">
                  <span className="block text-[10px] ga-text-accent font-mono mb-0.5">STEP 1</span>
                  {isJa ? '絵を入れる' : 'Drop Art'}
                </div>
                <div className="ga-surface-subtle rounded-2xl px-2 py-2.5 font-semibold ga-text">
                  <span className="block text-[10px] ga-text-accent font-mono mb-0.5">STEP 2</span>
                  {isJa ? '署名をつける' : 'Sign Proof'}
                </div>
                <div className="ga-surface-subtle rounded-2xl px-2 py-2.5 font-semibold ga-text">
                  <span className="block text-[10px] ga-text-accent font-mono mb-0.5">STEP 3</span>
                  {isJa ? 'PNGを保存' : 'Save PNG'}
                </div>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                data-testid={isAdvanced ? 'gallerydeck-empty-import-btn' : 'gallerydeck-import-btn'}
                className="chm-link-dynamic w-full group flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed ga-border-strong bg-[var(--ga-accent-soft)] hover:bg-[var(--ga-surface-subtle)] py-7 px-4 cursor-pointer"
              >
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl ga-btn-primary shadow-[var(--ga-shadow)] transition-transform group-hover:scale-105">
                  <ImagePlus className="h-7 w-7" />
                </span>
                <span className="text-base sm:text-lg font-bold tracking-tight ga-text">
                  {isJa ? 'イラストを追加（タップ / ドロップ）' : gd.importArtwork}
                </span>
                <span className="text-[11px] ga-text-muted">
                  PNG / JPEG / WebP
                </span>
              </button>

              <div className="pt-2 border-t ga-border flex flex-wrap items-center justify-center gap-2">
                <Link
                  to="/verify"
                  data-testid="gallerydeck-quick-verify-link"
                  className="chm-link-dynamic ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold ga-text"
                >
                  <ShieldCheck className="h-3.5 w-3.5 ga-text-accent" />
                  <span>{isJa ? '作品を検証する' : t.simple.home.verifyCardTitle}</span>
                </Link>
                <Link
                  to="/verify?demo=sample"
                  data-testid="home-sample-demo-link"
                  className="chm-link-dynamic ga-btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold ga-text-accent"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{t.discordUx.homeUx.demoCalloutBtn}</span>
                </Link>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-[11px] ga-text-muted">
                <span>{t.simple.home.localOnlyBadge}</span>
                <HelpTip
                  label={t.simple.home.localOnlyTipLabel}
                  text={t.simple.home.localOnlyTipText}
                  testId="gallerydeck-empty-local-tip"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 space-y-6">
            {/* Gallery Framed Spotlight Stage */}
            {focusedItem && (
              <div
                key={focusedItem.id}
                data-testid="gallerydeck-spotlight-stage"
                className="chm-spotlight-enter grid grid-cols-1 lg:grid-cols-12 gap-6 items-center rounded-3xl ga-card p-4 sm:p-6"
              >
                <div className="lg:col-span-7">
                  <div className="rounded-2xl border ga-border ga-surface-subtle p-3 sm:p-4">
                    <div className="aspect-[16/10] w-full overflow-hidden rounded-xl bg-[var(--ga-bg-tint)] flex items-center justify-center">
                      {focusedItem.thumbnailDataUrl ? (
                        <img
                          src={focusedItem.thumbnailDataUrl}
                          alt={focusedItem.title}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="ga-text-muted text-xs">{gd.noPreview}</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 flex flex-col justify-between gap-5">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {focusedItem.provenanceStatus === 'signed' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border ga-status-success px-2.5 py-0.5 text-xs font-semibold">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {gd.badgeVerified}
                        </span>
                      ) : focusedItem.provenanceStatus === 'invalid' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border ga-status-error px-2.5 py-0.5 text-xs font-semibold">
                          <ShieldAlert className="h-3.5 w-3.5" />
                          {gd.badgeInvalid}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border ga-status-warning px-2.5 py-0.5 text-xs font-semibold">
                          <ShieldAlert className="h-3.5 w-3.5" />
                          {gd.badgeUnverified}
                        </span>
                      )}
                      {focusedItem.qrMode !== 'none' && (
                        <span className="inline-flex items-center gap-1 rounded-full border ga-border-strong ga-surface-subtle px-2.5 py-0.5 text-xs font-medium ga-text-secondary">
                          <QrCode className="h-3.5 w-3.5 ga-text-accent" />
                          {gd.badgeQrBurned}
                        </span>
                      )}
                    </div>

                    <div>
                      {focusedItem.title && (
                        <h2 className="text-xl sm:text-2xl font-bold ga-text tracking-tight truncate">
                          {focusedItem.title}
                        </h2>
                      )}
                      <p className="text-xs ga-text-muted mt-1 font-mono">
                        {focusedItem.width} × {focusedItem.height} px · {focusedItem.licenseId ?? '—'}
                      </p>
                    </div>

                    {focusedItem.publicKeyFingerprint && (
                      <p className="text-xs font-mono ga-text-secondary ga-surface-subtle border ga-border rounded-xl px-3 py-2 truncate">
                        {focusedItem.publicKeyFingerprint}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedItemId(focusedItem.id)}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--ga-accent)] hover:bg-[var(--ga-accent-hover)] px-4 py-2.5 text-sm font-semibold text-[#FAF9F6] transition-colors cursor-pointer"
                    >
                      {focusedItem.provenanceStatus === 'signed' ? gd.actionVerify : gd.actionCertifyNow}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Compact Gallery Filmstrip Rail */}
            <div
              role="listbox"
              aria-label={gd.carouselAria}
              data-testid="gallerydeck-carousel"
              className="flex items-stretch gap-3.5 overflow-x-auto pb-3 pt-1 px-1 snap-x snap-mandatory chm-no-scrollbar"
            >
              {visibleItems.map((item, idx) => {
                const isFocused = idx === safeFocusedIndex;
                return (
                  <button
                    key={item.id}
                    ref={(el) => {
                      cardRefs.current[idx] = el;
                    }}
                    type="button"
                    role="option"
                    aria-selected={isFocused}
                    data-testid={`gallerydeck-card-${idx}`}
                    data-focused={isFocused ? 'true' : 'false'}
                    onFocus={() => setFocusedIndex(idx)}
                    onMouseEnter={() => setFocusedIndex(idx)}
                    onClick={() => {
                      setFocusedIndex(idx);
                      setSelectedItemId(item.id);
                    }}
                    className={`group relative shrink-0 w-44 sm:w-52 rounded-2xl overflow-hidden text-left transition-all duration-150 snap-center cursor-pointer focus:outline-none ${
                      isFocused
                        ? 'ring-2 ring-[var(--ga-accent)] ga-surface-solid shadow-[var(--ga-shadow)]'
                        : 'opacity-80 hover:opacity-100 ga-surface-solid border ga-border'
                    }`}
                  >
                    <div className="aspect-[4/3] w-full bg-[var(--ga-bg-tint)] overflow-hidden relative">
                      {item.thumbnailDataUrl ? (
                        <img
                          src={item.thumbnailDataUrl}
                          alt={item.title}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center ga-text-muted text-xs">
                          {gd.noPreview}
                        </div>
                      )}

                      <div className="absolute top-2 left-2 flex gap-1">
                        {item.provenanceStatus === 'signed' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ga-accent)] px-2 py-0.5 text-[10px] font-bold text-[#FAF9F6]">
                            <ShieldCheck className="h-2.5 w-2.5" />
                            OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full ga-surface-solid border ga-border px-1.5 py-0.5 text-[10px] font-semibold ga-text-muted">
                            —
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-2.5">
                      {item.title && (
                        <p className="font-medium text-xs ga-text truncate">{item.title}</p>
                      )}
                      <p className="text-[10px] ga-text-muted font-mono mt-0.5">
                        {item.width}×{item.height} · {item.licenseId ?? '—'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Quiet Status Strip (shown in Advanced Mode or when artworks exist) */}
      {(isAdvanced || visibleItems.length > 0) && (
      <footer className="relative z-10 border-t ga-border ga-surface-subtle">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs ga-text-muted">
          <div className="flex items-center gap-3 min-w-0">
            {focusedItem ? (
              <>
                {focusedItem.title && (
                  <span className="font-semibold ga-text truncate">{focusedItem.title}</span>
                )}
                <span className="hidden sm:inline font-mono text-[11px] ga-text-muted">
                  {focusedItem.publicKeyFingerprint ?? gd.badgeUnverified}
                </span>
              </>
            ) : (
              <span>{gd.footerReady}</span>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-3 text-[11px]">
            <span>
              <kbd className="rounded border ga-border ga-surface-solid px-1.5 py-0.5 font-mono ga-text-secondary">←/→</kbd>{' '}
              {gd.hintBrowse}
            </span>
            <span>
              <kbd className="rounded border ga-border ga-surface-solid px-1.5 py-0.5 font-mono ga-text-secondary">Enter</kbd>{' '}
              {gd.hintSelect}
            </span>
            <span>
              <kbd className="rounded border ga-border ga-surface-solid px-1.5 py-0.5 font-mono ga-text-secondary">Esc</kbd>{' '}
              {gd.hintBack}
            </span>
          </div>
        </div>
      </footer>
      )}

      {/* Toast Notification */}
      {statusToast && (
        <div
          role="status"
          data-testid="gallerydeck-toast"
          className="fixed bottom-16 right-5 z-50 rounded-xl ga-surface-solid border ga-border-strong px-4 py-2.5 text-xs font-medium ga-text shadow-[var(--ga-shadow-lg)]"
        >
          {statusToast}
        </div>
      )}

      {/* Detail & Action Drawer */}
      <ArtworkDetailDrawer
        item={selectedItem}
        busyAction={busyAction}
        onClose={() => setSelectedItemId(null)}
        onCertify={handleCertify}
        onVerify={handleVerify}
        onDownload={handleDownload}
        onDelete={handleDelete}
      />

      {/* Multi-Tier Persistence & Sync Modal */}
      <SyncPanelModal
        open={syncModalOpen}
        itemCount={catalog.items.filter((i) => !i.deleted).length}
        tierStatuses={tierStatuses}
        driveConnected={driveConnected}
        syncing={syncing}
        onClose={() => setSyncModalOpen(false)}
        onConnectDrive={handleConnectDrive}
        onUploadEncryptedDrive={handleUploadEncryptedDrive}
        onRestoreEncryptedDrive={handleRestoreEncryptedDrive}
        onResetDriveSync={handleResetDriveSync}
        onSyncNow={() => handleSyncAll()}
        onExportArchive={handleExportArchive}
        onImportArchive={handleImportArchive}
      />

      {/* Mandatory Google Drive Risk Consent Gate Modal */}
      <GoogleDriveRiskConsentModal
        open={driveRiskModalOpen}
        onCancel={() => setDriveRiskModalOpen(false)}
        onConfirmConsent={handleConfirmDriveRiskConsent}
      />

      {/* Separate-Layer Artwork Info + Interactive In-Image QR Placement Modal */}
      <InImageQrPlacementModal
        open={pendingQrPlacement !== null}
        item={pendingQrPlacement?.item ?? null}
        initialLicenseId={pendingQrPlacement?.licenseId ?? 'ARR'}
        initialQrMode={pendingQrPlacement?.qrMode ?? 'in-image'}
        busy={busyAction === 'certify'}
        onCancel={() => setPendingQrPlacement(null)}
        onConfirm={async (submission) => {
          if (!pendingQrPlacement) return;
          await executeCertify(pendingQrPlacement.item, submission);
        }}
      />
    </section>
  );
}

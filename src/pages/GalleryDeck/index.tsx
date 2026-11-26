import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
} from 'lucide-react';
import { googleAuthManager } from '../../core/google/gisAuth';
import type { LicenseId } from '../../core/manifest/types';
import { useDeckNavigation } from '../../hooks/useDeckNavigation';
import { useI18n } from '../../i18n/context';
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
import {
  certifyArtworkInDeck,
  importArtworkFileToDeck,
  relinkCatalogFromLocalFolder,
  verifyArtworkInDeck,
} from './galleryDeckHelpers';
import { SyncPanelModal } from './SyncPanelModal';

const FILTER_TABS: GalleryFilterTab[] = ['all', 'recent', 'verified', 'unverified', 'collections'];

export function GalleryDeckPage() {
  const { t } = useI18n();
  const gd = t.galleryDeck;

  const idbAdapterRef = useRef<IndexedDbGalleryAdapter>(new IndexedDbGalleryAdapter());
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
  const [busyAction, setBusyAction] = useState<'certify' | 'verify' | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const [linkedDirName, setLinkedDirName] = useState<string | null>(null);
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

  const persistCatalog = useCallback(async (nextCatalog: GalleryDeckCatalog) => {
    setCatalog(nextCatalog);
    const adapters = [
      idbAdapterRef.current,
      ...(fsAdapterRef.current.isLinked() ? [fsAdapterRef.current] : []),
      ...(gdriveAdapterRef.current.isAvailable() ? [gdriveAdapterRef.current] : []),
    ];
    await syncGalleryAdapters(nextCatalog, adapters);
  }, []);

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
      if (selectedItemId) {
        setSelectedItemId(null);
      } else if (syncModalOpen) {
        setSyncModalOpen(false);
      }
    },
    onNextTab: handleNextTab,
    onPrevTab: handlePrevTab,
    onOpenSearch: () => searchInputRef.current?.focus(),
    disabled: Boolean(selectedItemId || syncModalOpen),
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

  const handleCertify = async (item: GalleryArtworkItem, licenseId: LicenseId) => {
    setBusyAction('certify');
    try {
      const updated = await certifyArtworkInDeck({
        item,
        idbAdapter: idbAdapterRef.current,
        licenseId,
      });
      const nextCatalog: GalleryDeckCatalog = {
        ...catalog,
        updatedAt: Date.now(),
        items: catalog.items.map((i) => (i.id === updated.id ? updated : i)),
      };
      await persistCatalog(nextCatalog);
      showToast(gd.toastCertified);
    } catch (err) {
      showToast(err instanceof Error ? err.message : gd.toastCertifyFailed);
    } finally {
      setBusyAction(null);
    }
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

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const adapters = [
        idbAdapterRef.current,
        ...(fsAdapterRef.current.isLinked() ? [fsAdapterRef.current] : []),
        ...(gdriveAdapterRef.current.isAvailable() ? [gdriveAdapterRef.current] : []),
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

  const handleLinkDirectory = async () => {
    try {
      const name = await fsAdapterRef.current.linkDirectory();
      setLinkedDirName(name);
      const { catalog: relinked, relinkedCount } = await relinkCatalogFromLocalFolder(
        catalog,
        fsAdapterRef.current,
        idbAdapterRef.current,
      );
      await persistCatalog(relinked);
      if (relinkedCount > 0) {
        showToast(`${name} (${relinkedCount})`);
      } else {
        await handleSyncAll();
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : gd.toastSyncFailed);
    }
  };

  const handleConnectDrive = async () => {
    const auth = googleAuthManager;
    if (!auth.getState().connected) {
      try {
        await auth.connectInteractive({ prompt: 'consent' });
      } catch (err) {
        showToast(err instanceof Error ? err.message : gd.toastSyncFailed);
        return;
      }
    }
    await handleSyncAll();
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
      className="relative -mx-3 sm:-mx-6 -my-6 min-h-[calc(100vh-4rem)] overflow-hidden bg-slate-950 text-slate-100 flex flex-col justify-between"
    >
      {/* Original Atelier Ambient Backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-all duration-700"
        style={{
          backgroundImage: focusedItem?.thumbnailDataUrl
            ? `url(${focusedItem.thumbnailDataUrl})`
            : 'radial-gradient(circle at 20% 20%, rgba(14,165,233,0.18), transparent 52%), radial-gradient(circle at 82% 78%, rgba(16,185,129,0.14), transparent 48%)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: focusedItem?.thumbnailDataUrl ? 'blur(64px) saturate(1.2)' : undefined,
          transform: 'scale(1.15)',
          opacity: focusedItem?.thumbnailDataUrl ? 0.22 : 1,
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#070d18]/90 via-[#0a1220]/75 to-[#060b14]/95"
      />

      {/* Minimal Header */}
      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6 pt-4 pb-2 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
              {gd.title}
            </h1>
            {linkedDirName && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/90 border border-slate-700 px-2.5 py-0.5 text-[11px] font-mono text-cyan-300">
                <FolderOpen className="h-3 w-3" />
                {linkedDirName}
              </span>
            )}
            {gamepadConnected && (
              <span
                title={gamepadName ?? undefined}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-500/20 border border-indigo-400/40 px-2 py-0.5 text-[11px] text-indigo-200"
              >
                <Gamepad2 className="h-3 w-3" />
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleLinkDirectory()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 cursor-pointer"
            >
              <FolderOpen className="h-3.5 w-3.5 text-indigo-400" />
              <span className="hidden sm:inline">{linkedDirName ? gd.changeFolder : gd.linkFolder}</span>
            </button>

            <button
              type="button"
              onClick={() => setSyncModalOpen(true)}
              data-testid="gallerydeck-open-sync-btn"
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 cursor-pointer"
            >
              {driveConnected ? (
                <Cloud className="h-3.5 w-3.5 text-sky-400" />
              ) : (
                <HardDrive className="h-3.5 w-3.5 text-cyan-400" />
              )}
              <span className="hidden sm:inline">{gd.storageSyncButton}</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              data-testid="gallerydeck-import-btn"
              className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 px-3.5 py-2 text-xs font-semibold text-slate-950 transition-colors cursor-pointer"
            >
              <ImagePlus className="h-4 w-4" />
              {gd.importArtwork}
            </button>
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
          </div>
        </div>

        {/* Filter Tabs + Quick Search */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label={gd.filterTabsAria} className="flex items-center gap-1.5 overflow-x-auto pb-1">
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
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80'
                  }`}
                >
                  {tabLabel(tab)}
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
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
              className="w-full rounded-full bg-slate-900/90 border border-slate-700/80 pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>
      </div>

      {/* Main Original Atelier Spotlight Stage + Filmstrip Gallery Rail */}
      <div className="relative z-10 flex-1 flex flex-col justify-center py-4 sm:py-6">
        {visibleItems.length === 0 ? (
          <div
            data-testid="gallerydeck-empty-state"
            className="mx-auto max-w-md text-center px-6 py-10 rounded-3xl border border-slate-800/90 bg-slate-900/70 backdrop-blur-md space-y-5 shadow-xl"
          >
            <h2 className="text-base font-semibold text-white">{gd.emptyTitle}</h2>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => void handleLinkDirectory()}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-100 cursor-pointer"
              >
                <FolderOpen className="h-4 w-4 text-indigo-400" />
                1. {gd.linkFolder}
              </button>
              <button
                type="button"
                onClick={() => setSyncModalOpen(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-100 cursor-pointer"
              >
                <Cloud className="h-4 w-4 text-sky-400" />
                2. {gd.storageSyncButton}
              </button>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 cursor-pointer"
            >
              <ImagePlus className="h-4 w-4" />
              {gd.importArtwork}
            </button>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 space-y-6">
            {/* Atelier Spotlight Framed Stage */}
            {focusedItem && (
              <div
                data-testid="gallerydeck-spotlight-stage"
                className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center rounded-3xl border border-slate-800/90 bg-slate-900/65 backdrop-blur-md p-4 sm:p-6 shadow-2xl"
              >
                <div className="lg:col-span-7">
                  <div className="rounded-2xl border border-slate-700/70 bg-slate-950/90 p-2.5 sm:p-3.5 shadow-inner">
                    <div className="aspect-[16/10] w-full overflow-hidden rounded-xl bg-slate-950 flex items-center justify-center">
                      {focusedItem.thumbnailDataUrl ? (
                        <img
                          src={focusedItem.thumbnailDataUrl}
                          alt={focusedItem.title}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="text-slate-600 text-xs">{gd.noPreview}</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {focusedItem.provenanceStatus === 'signed' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-400/40 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {gd.badgeVerified}
                        </span>
                      ) : focusedItem.provenanceStatus === 'invalid' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-400/40 px-2.5 py-0.5 text-xs font-medium text-rose-300">
                          <ShieldAlert className="h-3.5 w-3.5" />
                          {gd.badgeInvalid}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-400/40 px-2.5 py-0.5 text-xs font-medium text-amber-300">
                          <ShieldAlert className="h-3.5 w-3.5" />
                          {gd.badgeUnverified}
                        </span>
                      )}
                      {focusedItem.qrMode !== 'none' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 border border-cyan-400/40 px-2.5 py-0.5 text-xs font-medium text-cyan-300">
                          <QrCode className="h-3.5 w-3.5" />
                          {gd.badgeQrBurned}
                        </span>
                      )}
                    </div>

                    <div>
                      {focusedItem.title && (
                        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">
                          {focusedItem.title}
                        </h2>
                      )}
                      <p className="text-xs text-slate-400 mt-1 font-mono">
                        {focusedItem.width} × {focusedItem.height} px · {focusedItem.licenseId ?? '—'}
                      </p>
                    </div>

                    {focusedItem.publicKeyFingerprint && (
                      <p className="text-xs font-mono text-cyan-300/90 bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 truncate">
                        {gd.metaFingerprint}: {focusedItem.publicKeyFingerprint}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedItemId(focusedItem.id)}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors cursor-pointer"
                    >
                      {focusedItem.provenanceStatus === 'signed' ? gd.actionVerify : gd.actionCertifyNow}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Compact Atelier Filmstrip Rail */}
            <div
              role="listbox"
              aria-label={gd.carouselAria}
              data-testid="gallerydeck-carousel"
              className="flex items-stretch gap-3.5 overflow-x-auto pb-3 pt-1 px-1 snap-x snap-mandatory"
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
                    className={`group relative shrink-0 w-44 sm:w-52 rounded-2xl overflow-hidden text-left transition-all duration-200 snap-center cursor-pointer focus:outline-none ${
                      isFocused
                        ? 'ring-2 ring-cyan-400 bg-slate-900 shadow-[0_0_24px_rgba(34,211,238,0.22)]'
                        : 'opacity-75 hover:opacity-100 bg-slate-900/70 border border-slate-800/90'
                    }`}
                  >
                    <div className="aspect-[4/3] w-full bg-slate-950 overflow-hidden relative">
                      {item.thumbnailDataUrl ? (
                        <img
                          src={item.thumbnailDataUrl}
                          alt={item.title}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-slate-600 text-xs">
                          {gd.noPreview}
                        </div>
                      )}

                      <div className="absolute top-2 left-2 flex gap-1">
                        {item.provenanceStatus === 'signed' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/90 border border-emerald-400/50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                            <ShieldCheck className="h-2.5 w-2.5" />
                            OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-950/90 border border-amber-400/50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                            <ShieldAlert className="h-2.5 w-2.5" />
                            —
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-2.5">
                      {item.title && (
                        <p className="font-medium text-xs text-white truncate">{item.title}</p>
                      )}
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
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

      {/* Console Metadata & Control Hints Footer */}
      <footer className="relative z-10 border-t border-slate-800/80 bg-slate-950/85 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-3 min-w-0">
            {focusedItem ? (
              <>
                {focusedItem.title && (
                  <span className="font-semibold text-slate-200 truncate">{focusedItem.title}</span>
                )}
                <span className="hidden sm:inline font-mono text-[11px] text-slate-500">
                  {focusedItem.publicKeyFingerprint ?? gd.badgeUnverified}
                </span>
              </>
            ) : (
              <span>{gd.footerReady}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <span>
              <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-200">←/→</kbd>{' '}
              {gd.hintBrowse}
            </span>
            <span>
              <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-200">Enter</kbd>{' '}
              {gd.hintSelect}
            </span>
            <span>
              <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-200">Esc</kbd>{' '}
              {gd.hintBack}
            </span>
          </div>
        </div>
      </footer>

      {/* Toast Notification */}
      {statusToast && (
        <div
          role="status"
          data-testid="gallerydeck-toast"
          className="fixed bottom-16 right-5 z-50 rounded-xl bg-slate-800 border border-cyan-400/50 px-4 py-2.5 text-xs font-medium text-cyan-100 shadow-lg"
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
        linkedDirName={linkedDirName}
        driveConnected={driveConnected}
        syncing={syncing}
        onClose={() => setSyncModalOpen(false)}
        onLinkDirectory={handleLinkDirectory}
        onConnectDrive={handleConnectDrive}
        onSyncNow={handleSyncAll}
        onExportArchive={handleExportArchive}
        onImportArchive={handleImportArchive}
      />
    </section>
  );
}

import type { Locale } from './context';

export interface GalleryDeckTranslations {
  navItem: string;
  title: string;
  subtitle: string;
  importArtwork: string;
  storageSyncButton: string;
  gamepadReady: string;
  filterTabsAria: string;
  tabAll: string;
  tabRecent: string;
  tabVerified: string;
  tabUnverified: string;
  tabCollections: string;
  searchPlaceholder: string;
  carouselAria: string;
  emptyTitle: string;
  emptySubtitle: string;
  noPreview: string;
  badgeVerified: string;
  badgeUnverified: string;
  badgeInvalid: string;
  badgeQrBurned: string;
  closeDetails: string;
  metaDimensions: string;
  metaTimestamp: string;
  metaFingerprint: string;
  metaPixelHash: string;
  metaVerification: string;
  selectLicenseLabel: string;
  actionCertifyNow: string;
  certifying: string;
  actionVerify: string;
  verifying: string;
  actionDownloadPng: string;
  actionCopyProofUrl: string;
  copiedProofUrl: string;
  openInCreateStudio: string;
  actionDelete: string;
  syncModalTitle: string;
  syncModalSubtitle: string;
  tierIndexedDb: string;
  itemsCached: string;
  tierLocalDirectory: string;
  tierLocalDirectoryDesc: string;
  linkedFolderPrefix: string;
  fsNotSupported: string;
  linkFolder: string;
  changeFolder: string;
  tierGoogleDrive: string;
  driveConnectedDesc: string;
  driveDisconnectedDesc: string;
  connectDrive: string;
  syncNow: string;
  syncAllTiers: string;
  syncing: string;
  archiveTitle: string;
  archiveDesc: string;
  exportArchive: string;
  importArchive: string;
  footerReady: string;
  hintBrowse: string;
  hintSelect: string;
  hintBack: string;
  toastImported: string;
  toastImportFailed: string;
  toastCertified: string;
  toastCertifyFailed: string;
  toastVerified: string;
  toastVerifyFailed: string;
  toastNoBlob: string;
  toastDeleted: string;
  toastSynced: string;
  toastSyncFailed: string;
  toastExported: string;
  toastRestored: string;
  toastRestoreFailed: string;
}

const en: GalleryDeckTranslations = {
  navItem: 'GalleryDeck',
  title: 'GalleryDeck',
  subtitle: 'Original local-first atelier showcase for your hand-drawn artwork & Ed25519 provenance.',
  importArtwork: 'Import Artwork',
  storageSyncButton: 'Storage & Sync',
  gamepadReady: 'Gamepad Ready',
  filterTabsAria: 'Gallery filter tabs',
  tabAll: 'All',
  tabRecent: 'Recent',
  tabVerified: 'Verified',
  tabUnverified: 'Unverified',
  tabCollections: 'Collections',
  searchPlaceholder: 'Search title, license, tag… (/)',
  carouselAria: 'Artwork library carousel',
  emptyTitle: 'Your GalleryDeck is empty',
  emptySubtitle: 'Import PNG, JPEG, or WebP artworks locally—zero server upload.',
  noPreview: 'No preview',
  badgeVerified: 'Verified Signature',
  badgeUnverified: 'Unverified',
  badgeInvalid: 'Invalid',
  badgeQrBurned: 'QR Burned',
  closeDetails: 'Close',
  metaDimensions: 'Dimensions',
  metaTimestamp: 'Updated',
  metaFingerprint: 'Key Fingerprint',
  metaPixelHash: 'Canonical Pixel SHA-256',
  metaVerification: 'Verification',
  selectLicenseLabel: 'License for certification',
  actionCertifyNow: 'Certify Now',
  certifying: 'Signing…',
  actionVerify: 'Verify',
  verifying: 'Verifying…',
  actionDownloadPng: 'Download PNG',
  actionCopyProofUrl: 'Copy /verify#proof Link',
  copiedProofUrl: 'Copied!',
  openInCreateStudio: 'Open in /create',
  actionDelete: 'Remove',
  syncModalTitle: 'Persistent Storage & Multi-Tier Sync',
  syncModalSubtitle: 'Protect your library against browser cache eviction—100% client-side.',
  tierIndexedDb: '1. IndexedDB Primary Cache',
  itemsCached: 'artworks cached locally',
  tierLocalDirectory: '2. Local Directory Sync',
  tierLocalDirectoryDesc: 'Link a local folder to auto-sync gallerydeck-catalog.json.',
  linkedFolderPrefix: 'Linked folder',
  fsNotSupported: 'Not supported in this browser—use .chdeck archive below.',
  linkFolder: 'Link Folder',
  changeFolder: 'Change Folder',
  tierGoogleDrive: '3. Google Drive Metadata Sync (Zero Images)',
  driveConnectedDesc: 'Connected (appDataFolder). Syncs provenance metadata & proofs only—artwork images are never uploaded.',
  driveDisconnectedDesc: 'Syncs provenance metadata & proofs only—artwork images/thumbnails stay 100% local.',
  connectDrive: 'Connect Drive',
  syncNow: 'Sync Drive',
  syncAllTiers: 'Sync All Active Tiers',
  syncing: 'Syncing…',
  archiveTitle: 'Portable .chdeck Archive (Safari / iOS Fallback)',
  archiveDesc: 'Export or restore your entire catalog and cached artworks as a single file.',
  exportArchive: 'Export .chdeck',
  importArchive: 'Restore .chdeck',
  footerReady: 'Ready · Zero-server local-first mode',
  hintBrowse: 'Browse',
  hintSelect: 'Details',
  hintBack: 'Back',
  toastImported: 'artwork(s) added to GalleryDeck',
  toastImportFailed: 'Failed to import artwork',
  toastCertified: 'Artwork signed with Ed25519 & QR burned!',
  toastCertifyFailed: 'Certification failed',
  toastVerified: 'Verification complete',
  toastVerifyFailed: 'Verification failed',
  toastNoBlob: 'Full-resolution PNG is not cached on this device.',
  toastDeleted: 'Artwork removed from deck',
  toastSynced: 'All active storage tiers synced',
  toastSyncFailed: 'Sync failed',
  toastExported: 'Exported .chdeck archive',
  toastRestored: 'Catalog restored from archive',
  toastRestoreFailed: 'Failed to restore archive',
};

const ja: GalleryDeckTranslations = {
  ...en,
  navItem: 'GalleryDeck',
  title: 'GalleryDeck',
  subtitle: '手描き作品とEd25519来歴証明のためのオリジナル・アトリエ展示ステージ。',
  importArtwork: '作品を追加',
  storageSyncButton: 'ストレージ & 同期',
  gamepadReady: 'ゲームパッド接続中',
  tabAll: 'すべて',
  tabRecent: '最近',
  tabVerified: '署名済み',
  tabUnverified: '未署名',
  tabCollections: 'コレクション',
  searchPlaceholder: 'タイトル・ライセンス・タグを検索… (/)',
  emptyTitle: 'GalleryDeckに作品がありません',
  emptySubtitle: 'PNG / JPEG / WebPをローカルに追加（サーバー送信ゼロ）。',
  badgeVerified: '署名検証済み',
  badgeUnverified: '未署名',
  badgeInvalid: '検証エラー',
  badgeQrBurned: 'QR焼込済み',
  closeDetails: '閉じる',
  metaDimensions: 'サイズ',
  metaTimestamp: '更新日',
  metaFingerprint: '鍵フィンガープリント',
  metaPixelHash: '正規化ピクセル SHA-256',
  metaVerification: '検証結果',
  selectLicenseLabel: '証明に付与するライセンス',
  actionCertifyNow: '今すぐ証明する',
  certifying: '署名中…',
  actionVerify: '整合性を検証',
  verifying: '検証中…',
  actionDownloadPng: 'PNGをダウンロード',
  actionCopyProofUrl: '/verify#proof リンクをコピー',
  copiedProofUrl: 'コピーしました',
  openInCreateStudio: '/create で開く',
  actionDelete: '削除',
  syncModalTitle: '永続ストレージ & マルチティア同期',
  syncModalSubtitle: 'ブラウザキャッシュ消去に備え、ローカルフォルダやGoogle Driveへ同期します。',
  tierIndexedDb: '1. IndexedDB プライマリキャッシュ',
  itemsCached: '作品をローカルにキャッシュ中',
  tierLocalDirectory: '2. ローカルフォルダ同期',
  tierLocalDirectoryDesc: 'ローカルフォルダを紐付けて gallerydeck-catalog.json を自動同期。',
  linkedFolderPrefix: '連携フォルダ',
  fsNotSupported: 'このブラウザでは非対応です。下の .chdeck アーカイブをご利用ください。',
  linkFolder: 'フォルダを連携',
  changeFolder: 'フォルダを変更',
  tierGoogleDrive: '3. Google Drive メタデータ同期（画像送信ゼロ）',
  driveConnectedDesc: '接続済み（appDataFolder）。来歴メタデータと署名証明のみ同期し、イラスト画像は一切送信しません。',
  driveDisconnectedDesc: '来歴メタデータと署名証明のみ同期します（イラスト画像・サムネイルはローカル専用）。',
  connectDrive: 'Driveに接続',
  syncNow: 'Driveと同期',
  syncAllTiers: 'すべての連携先を同期',
  syncing: '同期中…',
  archiveTitle: 'ポータブル .chdeck アーカイブ (Safari / iOS 向け)',
  archiveDesc: 'カタログと作品データを1ファイルに書き出し・復元できます。',
  exportArchive: '.chdeck を書き出し',
  importArchive: '.chdeck から復元',
  footerReady: '準備完了 · ゼロサーバー・ローカルファースト',
  hintBrowse: '移動',
  hintSelect: '詳細',
  hintBack: '戻る',
  toastImported: '件の作品を追加しました',
  toastCertified: 'Ed25519署名とQR焼込が完了しました！',
  toastDeleted: '作品をデッキから削除しました',
  toastSynced: '同期が完了しました',
  toastExported: '.chdeck アーカイブを書き出しました',
  toastRestored: 'アーカイブからカタログを復元しました',
};

export const GALLERY_DECK_I18N: Record<Locale, GalleryDeckTranslations> = {
  en,
  ja,
  'zh-CN': en,
  'zh-TW': en,
  ko: en,
  ru: en,
  uk: en,
  es: en,
  fr: en,
  de: en,
  pt: en,
  it: en,
  ar: en,
};

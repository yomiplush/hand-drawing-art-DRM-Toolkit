import type { SupportedLocale } from '../core/storage/consent';

export interface VaultTranslations {
  navItem: string;
  title: string;
  subtitle: string;
  zeroCostNote: string;
  statsTotalProofs: string;
  statsSyncSelected: string;
  statsEstimatedStorage: string;
  searchPlaceholder: string;
  syncSelectedOnlyFilter: string;
  emptyStateTitle: string;
  emptyStateBody: string;
  syncDeviceCheckbox: string;
  copyVerifyUrlBtn: string;
  copiedBtn: string;
  downloadProofJsonBtn: string;
  deleteProofBtn: string;
  backupSectionTitle: string;
  backupSectionDesc: string;
  exportPlainJsonBtn: string;
  encryptedPassPlaceholder: string;
  exportEncryptedJsonBtn: string;
  importBackupLabel: string;
  importBackupSuccess: string;
  importBackupError: string;
  publicLookupSummary: string;
  publicLookupDesc: string;
  publicLookupAuthorFilterPlaceholder: string;
  publicLookupBtn: string;
  publicLookupSearching: string;
  publicLookupResultNote: string;
}

const EN_VAULT: VaultTranslations = {
  navItem: 'Proof Vault',
  title: 'Local Proof Vault & Portable Backup',
  subtitle: 'Stores only compact signed certificates (~1 KiB each) locally in your browser. Artwork images and private keys are never stored here.',
  zeroCostNote: '¥0 · Local-First IndexedDB · Portable Open JSON',
  statsTotalProofs: 'Saved Proofs',
  statsSyncSelected: 'Selected for Device Sync',
  statsEstimatedStorage: 'Compact Vault Size',
  searchPlaceholder: 'Search by title, artist, artwork ID, hash, or license...',
  syncSelectedOnlyFilter: 'Synced items only',
  emptyStateTitle: 'No saved artwork proofs yet',
  emptyStateBody: 'Certificates you create on Create Certificate are automatically saved here as lightweight offline records, or you can import a JSON backup below.',
  syncDeviceCheckbox: 'Sync across my paired devices',
  copyVerifyUrlBtn: 'Copy Verify Link',
  copiedBtn: 'Copied',
  downloadProofJsonBtn: 'Save .chproof.json',
  deleteProofBtn: 'Remove',
  backupSectionTitle: 'Portable Backup & Restore (¥0)',
  backupSectionDesc: 'Export all verified proof records as open JSON (plain or AES-256-GCM encrypted). Never contains private signing keys or artwork pixels.',
  exportPlainJsonBtn: 'Export JSON Backup',
  encryptedPassPlaceholder: 'Passphrase for encrypted backup (8+ chars)',
  exportEncryptedJsonBtn: 'Export Encrypted JSON',
  importBackupLabel: 'Restore from JSON or Encrypted Vault Backup (.json)',
  importBackupSuccess: 'Restored verified proofs into local vault.',
  importBackupError: 'Failed to import backup JSON.',
  publicLookupSummary: 'Optional: Search Public Proof Announcements (Free Nostr Relays)',
  publicLookupDesc: 'Queries only your enabled free wss:// relays when clicked. Every returned proof is verified locally using its Ed25519 signature—relays cannot forge proofs.',
  publicLookupAuthorFilterPlaceholder: 'Optional author fingerprint prefix (hex)...',
  publicLookupBtn: 'Search Configured Relays',
  publicLookupSearching: 'Searching relays…',
  publicLookupResultNote: 'Cryptographically verified public proofs found:',
};

const JA_VAULT: VaultTranslations = {
  navItem: '証明保管庫 (Vault)',
  title: 'ローカル証明保管庫・ポータブルバックアップ',
  subtitle: '署名済みの軽量な作品証明データ（1件約1KB）のみをブラウザ内に保管します。作品画像本体や秘密鍵は保存されません。',
  zeroCostNote: '完全無料 (¥0) · ローカル正本 (IndexedDB) · ポータブルJSON',
  statsTotalProofs: '保管中の証明数',
  statsSyncSelected: '端末間同期の対象',
  statsEstimatedStorage: '保管データ容量',
  searchPlaceholder: '作品名・作者名・作品ID・ハッシュ・ライセンスで検索...',
  syncSelectedOnlyFilter: '同期対象のみ表示',
  emptyStateTitle: '保存された作品証明はまだありません',
  emptyStateBody: '「証明書を作成」で署名すると自動的に軽量レコードとしてここへ保存されます。下のバックアップ読込から復元することもできます。',
  syncDeviceCheckbox: '登録済み端末へ同期する',
  copyVerifyUrlBtn: '検証リンクをコピー',
  copiedBtn: 'コピーしました',
  downloadProofJsonBtn: '.chproof.json を保存',
  deleteProofBtn: '削除',
  backupSectionTitle: 'ポータブルバックアップと復元 (¥0)',
  backupSectionDesc: 'すべての作品証明をオープンなJSON（通常またはAES-256-GCM暗号化）で書き出し・復元できます。秘密鍵や画像ピクセルは含まれません。',
  exportPlainJsonBtn: 'JSONバックアップを書き出す',
  encryptedPassPlaceholder: '暗号化用パスフレーズ（8文字以上）',
  exportEncryptedJsonBtn: '暗号化JSONを書き出す',
  importBackupLabel: 'バックアップファイル (.json) から復元する',
  importBackupSuccess: '署名検証済みの証明を保管庫へ復元しました。',
  importBackupError: 'バックアップファイルの読み込みに失敗しました。',
  publicLookupSummary: '任意：公開されている作品証明を無料Relayから検索（オプトイン）',
  publicLookupDesc: 'ボタンを押したときだけ有効な無料 wss:// Relayへ問い合わせます。取得した証明はすべて端末上でEd25519署名を検証します。',
  publicLookupAuthorFilterPlaceholder: '作者フィンガープリント先頭（16進数・任意）...',
  publicLookupBtn: '設定済みRelayを検索',
  publicLookupSearching: 'Relayを検索中…',
  publicLookupResultNote: '署名検証に成功した公開証明の件数:',
};

const EXTRA_NAV_LABELS: Record<Exclude<SupportedLocale, 'en' | 'ja'>, string> = {
  'zh-CN': '本地证明库',
  'zh-TW': '本地證明庫',
  ko: '증명 보관함',
  ru: 'Хранилище доказательств',
  uk: 'Сховище доказів',
  es: 'Bóveda de Pruebas',
  fr: 'Coffre de Preuves',
  de: 'Nachweis-Tresor',
  pt: 'Cofre de Provas',
  it: 'Archivio Prove',
  ar: 'خزنة الإثباتات',
};

export const VAULT_I18N: Record<SupportedLocale, VaultTranslations> = {
  en: EN_VAULT,
  ja: JA_VAULT,
  'zh-CN': { ...EN_VAULT, navItem: EXTRA_NAV_LABELS['zh-CN'] },
  'zh-TW': { ...EN_VAULT, navItem: EXTRA_NAV_LABELS['zh-TW'] },
  ko: { ...EN_VAULT, navItem: EXTRA_NAV_LABELS.ko },
  ru: { ...EN_VAULT, navItem: EXTRA_NAV_LABELS.ru },
  uk: { ...EN_VAULT, navItem: EXTRA_NAV_LABELS.uk },
  es: { ...EN_VAULT, navItem: EXTRA_NAV_LABELS.es },
  fr: { ...EN_VAULT, navItem: EXTRA_NAV_LABELS.fr },
  de: { ...EN_VAULT, navItem: EXTRA_NAV_LABELS.de },
  pt: { ...EN_VAULT, navItem: EXTRA_NAV_LABELS.pt },
  it: { ...EN_VAULT, navItem: EXTRA_NAV_LABELS.it },
  ar: { ...EN_VAULT, navItem: EXTRA_NAV_LABELS.ar },
};

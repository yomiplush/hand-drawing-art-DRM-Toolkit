import type { SupportedLocale } from '../core/storage/consent';

export interface DecentralizedSyncTranslations {
  tabLabel: string;
  sectionTitle: string;
  sectionSubtitle: string;
  consentTitle: string;
  consentPoints: [string, string, string, string];
  consentCheckbox: string;
  enableBtn: string;
  disableBtn: string;
  syncNowBtn: string;
  syncingLabel: string;
  statusLabels: {
    disabled: string;
    offline: string;
    syncing: string;
    'synced-observable': string;
    'partial-relays': string;
    'error-unreachable': string;
  };
  honestGuaranteeNote: string;
  causalGapWarning: string;
  queuedUpdatesLabel: string;
  lastSyncedLabel: string;
  neverSyncedLabel: string;
  peerCardTitle: string;
  peerCardDesc: string;
  copyPeerCardBtn: string;
  importPeerCardLabel: string;
  importPeerCardPlaceholder: string;
  importPeerCardBtn: string;
  importPeerCardSuccess: string;
  relaysTitle: string;
  relaysDesc: string;
  addRelayPlaceholder: string;
  addRelayBtn: string;
  loadPresetsBtn: string;
  resetRelaysBtn: string;
  presetGlobalTitle: string;
  presetGlobalAddBtn: string;
  presetJapanTitle: string;
  presetJapanAddBtn: string;
  presetJapanIpNotice: string;
  presetRelayAdded: string;
  presetRelayAddOne: string;
  removeRelayBtn: string;
  advancedSummary: string;
  advancedNpubLabel: string;
  advancedKeyCustodyLabel: string;
  advancedProtocolLabel: string;
  advancedBrowserWarning: string;
  backupNcryptsecTitle: string;
  backupPasswordPlaceholder: string;
  exportNcryptsecBtn: string;
  importNcryptsecPlaceholder: string;
  importNcryptsecBtn: string;
  importNcryptsecSuccess: string;
  confirmationCodeLabel: string;
  confirmationCodeHint: string;
  checkRelayPolicyBtn: string;
  policyLabels: {
    unknown: string;
    'free-usable': string;
    'payment-required': string;
    'write-restricted': string;
    'quota-exceeded': string;
    'pow-required': string;
    unreachable: string;
  };
  onlineBudgetLabel: string;
  gracefulFallbackTitle: string;
  gracefulFallbackBody: string;
  gracefulFallbackExportLink: string;
  syncVaultProofsToggle: string;
  syncVaultProofsBtn: string;
  syncVaultProofsSuccess: string;
}

export interface DevicePairingTranslations {
  navItem: string;
  title: string;
  subtitle: string;
  helpLabel: string;
  helpTitle: string;
  helpPoints: [string, string, string, string];
  myIdSectionTitle: string;
  myIdEmptyDesc: string;
  goToKeysBackupBtn: string;
  quickCreateIdLabel: string;
  quickCreateIdPlaceholder: string;
  quickCreateIdPassPlaceholder: string;
  quickCreateIdBtn: string;
  thisDeviceTitle: string;
  thisDeviceRevokedAlert: string;
  regenerateDeviceIdBtn: string;
  createSeparateDeviceIdBtn: string;
  alreadyPairedBadge: string;
  alreadyPairedUnderOwnersLabel: string;
  alreadyPairedStep1Note: string;
  approveNextDeviceBtn: string;
  ownerInAddTabHint: string;
  switchToApproveTabBtn: string;
  addDeviceTab: string;
  approveDeviceTab: string;
  registryTab: string;
  // Step 1: New device
  step1Heading: string;
  step1Desc: string;
  deviceNameLabel: string;
  deviceNamePlaceholder: string;
  devicePassLabel: string;
  devicePassPlaceholder: string;
  generateRequestQrBtn: string;
  cancelRequestBtn: string;
  requestQrTitle: string;
  requestExpiresIn: string;
  requestExpiredBadge: string;
  downloadQrPngBtn: string;
  copyUrlBtn: string;
  copiedMsg: string;
  // Step 2 on new device
  step2NewHeading: string;
  step2NewDesc: string;
  scanCameraBtn: string;
  stopCameraBtn: string;
  cameraHint: string;
  cameraDeniedFallbackMsg: string;
  uploadQrImageLabel: string;
  pasteInputLabel: string;
  pasteInputPlaceholder: string;
  verifyCertBtn: string;
  step2WrongTypeRequestChild: string;
  step2WrongTypeRequestOwner: string;
  sendToApproveTabBtn: string;
  step2WrongTypeRegistry: string;
  step2RevocationAppliedMsg: string;
  step2RevokedDeviceError: string;
  step2AlreadyRegisteredError: string;
  approveWrongTypeCert: string;
  approveWrongTypeRevocation: string;
  approveRevokedDeviceError: string;
  approveAlreadyRegisteredError: string;
  approveCameraHint: string;
  approveNoOwnerTitle: string;
  approveNoOwnerDesc: string;
  approveNoOwnerGoAddBtn: string;
  approveNoOwnerGoKeysBtn: string;
  // PC -> New Device Invitation QR (Nostr NIP-59 assisted 1-scan pairing)
  inviteSectionTitle: string;
  inviteSectionDesc: string;
  createInviteQrBtn: string;
  cancelInviteBtn: string;
  inviteQrTitle: string;
  inviteWaitingStatus: string;
  inviteCheckNowBtn: string;
  inviteReceivedFromRelayMsg: string;
  inviteApprovalSentMsg: string;
  inviteManualDivider: string;
  inviteAcceptHeading: string;
  inviteAcceptDesc: string;
  inviteFromOwnerLabel: string;
  inviteRelayNotice: string;
  inviteAcceptSendBtn: string;
  inviteSendingBtn: string;
  inviteCancelReceiveBtn: string;
  inviteSentWaitingTitle: string;
  inviteSentWaitingDesc: string;
  inviteManualFallbackSummary: string;
  inviteExpiredError: string;
  inviteAlreadyPairedNote: string;
  confirmOwnerCheckbox: string;
  completePairingBtn: string;
  pairingCompletedTitle: string;
  pairingCompletedDesc: string;
  ownerUnverifiedWarning: string;
  ownerConfirmedBadge: string;
  // Step 2 on existing owner device
  approveHeading: string;
  approveDesc: string;
  selectOwnerIdLabel: string;
  ownerPassphraseLabel: string;
  ownerPassphrasePlaceholder: string;
  confirmDialogTitlePrefix: string;
  confirmDialogTitleSuffix: string;
  confirmDeviceNameLabel: string;
  confirmOwnerIdLabel: string;
  confirmPermissionLabel: string;
  confirmPermissionValue: string;
  confirmApproveBtn: string;
  confirmCancelBtn: string;
  approvalQrReadyTitle: string;
  approvalQrReadyDesc: string;
  // Device list & revocation
  registeredDevicesTitle: string;
  noDevicesYet: string;
  offlineSyncWarning: string;
  statusActiveTrusted: string;
  statusActiveUnverified: string;
  statusRevoked: string;
  statusConflict: string;
  confirmOwnerNowBtn: string;
  revokeDeviceBtn: string;
  revokeAndRemoveLabel: string;
  revokeConfirmTitle: string;
  removeDeviceBtn: string;
  removeLocalOnlyBtn: string;
  removeConfirmTitleRevoked: string;
  removeConfirmDescRevoked: string;
  removeConfirmTitleLocalOnly: string;
  removeConfirmDescLocalOnly: string;
  removeConfirmSubmitBtn: string;
  deviceRemovedMsg: string;
  revokeReasonLabel: string;
  revokeReasons: {
    'lost-device': string;
    'device-compromised': string;
    retired: string;
    other: string;
  };
  revokeNoteLabel: string;
  revokeNotePlaceholder: string;
  revokeConfirmSubmitBtn: string;
  revocationQrTitle: string;
  revocationQrDesc: string;
  importRevocationTitle: string;
  importRevocationBtn: string;
  revocationImportedMsg: string;
  // Registry backup export/import
  backupExportTitle: string;
  backupExportDesc: string;
  exportRegistryJsonBtn: string;
  exportRegistryCborBtn: string;
  importRegistryFileLabel: string;
  importRegistrySuccess: string;
  // Technical details & warnings
  technicalDetailsSummary: string;
  detailPublicKey: string;
  detailFingerprintShort: string;
  detailFingerprintFull: string;
  detailDeviceId: string;
  detailProtocol: string;
  detailStorageMode: string;
  detailIssuedAt: string;
  noRootKeyCopyNote: string;
  corruptRecordWarningTitle: string;
  clearCorruptRecordBtn: string;
  keysPageManageDevicesBtn: string;
  exchangePagePairingLink: string;
  docsPairingTitle: string;
  docsPairingBody: string;
  docsSyncTitle: string;
  docsSyncBody: string;
  sync: DecentralizedSyncTranslations;
}

const JA_DEVICE_PAIRING: DevicePairingTranslations = {
  navItem: '登録済みデバイス',
  title: 'デバイス連携・登録',
  subtitle: 'PC・スマホ・タブレットをサーバーなしで安全にマイIDへ結びつけます。',
  helpLabel: 'デバイス連携の仕組み（？）',
  helpTitle: '安全なデバイス連携について',
  helpPoints: [
    'サーバーやアカウント登録は一切使わず、オフラインでもQRコード2回だけで端末を結びつけられます。',
    '新しい端末には専用の鍵だけを新しく作り、大切なマイIDの秘密鍵はコピーしません。',
    'カメラが使えない環境でも、QR画像のアップロードやテキストの貼り付けで登録・解除できます。',
    '端末の機種変更や紛失時は、「登録済みデバイス・バックアップ」タブから解除・一覧削除ができます。',
  ],
  myIdSectionTitle: 'マイID（所有者ID）',
  myIdEmptyDesc: '新しい端末を承認するには、先にメイン端末でマイIDを作成またはバックアップ復元してください。',
  goToKeysBackupBtn: 'マイID作成・バックアップへ',
  quickCreateIdLabel: '新しくマイIDを作る（ペンネーム）',
  quickCreateIdPlaceholder: '例：YomiPlush',
  quickCreateIdPassPlaceholder: 'バックアップ用パスフレーズ（任意・8文字以上）',
  quickCreateIdBtn: 'マイIDを作成',
  thisDeviceTitle: 'この端末（デバイス）',
  thisDeviceRevokedAlert: 'この端末の鍵は解除（失効）されているため、そのままでは再登録できません。必要な場合は新しいデバイスIDを作り直してください。',
  regenerateDeviceIdBtn: '新しいデバイスIDを作り直す',
  createSeparateDeviceIdBtn: '別のデバイスIDを新しく作成',
  alreadyPairedBadge: '登録済み',
  alreadyPairedUnderOwnersLabel: '連携先のマイID',
  alreadyPairedStep1Note:
    'このブラウザはすでに登録済みです。3台目以降の別端末を追加する場合は、その端末のブラウザでこのページを開いてQRを作成してください。（同じブラウザで別の端末IDを新しく作り直したい場合のみ、上の「この端末」欄から新しいデバイスIDを作成できます）',
  approveNextDeviceBtn: '次の端末を承認する（表示をクリア）',
  ownerInAddTabHint:
    'このブラウザにはすでに「マイID」があります。スマホ・iPadなど別の端末を追加したい場合は、この画面ではなく「追加したい端末側」の /devices でステップ1（登録用QRコードを作成）を押し、それをこの端末の「QRを読み取って承認（既存端末）」タブで読み込んでください。',
  switchToApproveTabBtn: '「QRを読み取って承認」タブへ移動',
  addDeviceTab: 'デバイスを追加（新端末）',
  approveDeviceTab: 'QRを読み取って承認（既存端末）',
  registryTab: '登録済みデバイス・バックアップ',
  step1Heading: 'ステップ 1：この端末の登録QRを表示する',
  step1Desc: 'パソコンやタブレットなど、すでにマイIDがある端末でこのQRコードを読み取ってください。',
  deviceNameLabel: 'この端末の名前',
  deviceNamePlaceholder: '例：iPhone / iPad / サブPC',
  devicePassLabel: '端末保護パスフレーズ（対応外ブラウザのみ必須）',
  devicePassPlaceholder: '必要な場合のみ入力（8文字以上）',
  generateRequestQrBtn: '登録用QRコードを作成',
  cancelRequestBtn: 'このリクエストをキャンセル',
  requestQrTitle: '新しい端末の登録リクエストQR',
  requestExpiresIn: '有効期限（残り時間）',
  requestExpiredBadge: '期限切れ（作り直してください）',
  downloadQrPngBtn: 'QR画像を保存 (PNG)',
  copyUrlBtn: 'リンク / コードをコピー',
  copiedMsg: 'コピーしました',
  step2NewHeading: 'ステップ 2：既存端末の承認QRを読み取る',
  step2NewDesc: '既存端末で「承認する」を押した後に表示される承認QRコードをここで読み込みます。',
  scanCameraBtn: 'カメラでQRコードを読み取る',
  stopCameraBtn: 'カメラを停止',
  cameraHint: 'カメラで承認QRコードまたは解除QRコードを映してください。',
  cameraDeniedFallbackMsg: 'カメラを利用できませんでした。下の「QR画像を選ぶ」または「リンク・コードを貼り付け」をご利用ください。',
  uploadQrImageLabel: 'カメラが使えない場合：QR画像ファイル（PNG/JPEG/WebP）から読み込む',
  pasteInputLabel: 'またはリンク・コードを貼り付け',
  pasteInputPlaceholder: '承認QRのURL、画像読み取り文字、またはトークンを貼り付け',
  verifyCertBtn: '承認内容を確認',
  step2WrongTypeRequestChild:
    'これは「承認QR（#pair-cert=）」ではなく、新端末側の「登録リクエストQR（#pair-req=）」です。まず、追加したい端末（この端末）の「ステップ1」で登録用QRを作成し、それをマイIDがあるメイン端末（PC等）の「QRを読み取って承認（既存端末）」タブで読み取って承認QRを発行してください。',
  step2WrongTypeRequestOwner:
    'これは「承認QR」ではなく「登録リクエストQR（#pair-req=）」です。このブラウザにはマイIDがあるため、下のボタンから「QRを読み取って承認（既存端末）」タブへ移動して承認できます。',
  sendToApproveTabBtn: '「QRを読み取って承認」タブで開く',
  step2WrongTypeRegistry:
    'これはデバイス一覧バックアップ（.chdevreg）です。「登録済みデバイス・バックアップ」タブから読み込んでください。',
  step2RevocationAppliedMsg: '解除（失効）通知を検証し、この端末・ローカル登録簿へ反映しました。',
  step2RevokedDeviceError:
    'この端末の鍵はすでに解除（失効）されているため登録を完了できません。上の「この端末」欄で「新しいデバイスIDを作り直す」を押してからやり直してください。',
  step2AlreadyRegisteredError: 'この端末はすでにこのマイIDに登録済みです。',
  approveWrongTypeCert:
    'これは「登録リクエスト（#pair-req=）」ではなく、発行済みの「承認QR（#pair-cert=）」です。追加したい新端末の「デバイスを追加」タブ →「ステップ2」に読み込ませてください。',
  approveWrongTypeRevocation:
    'これは解除通知（#pair-rev=）です。「登録済みデバイス・バックアップ」タブの「別の端末で作った解除通知を取り込む」から読み込んでください。',
  approveRevokedDeviceError:
    'この端末の鍵はすでに解除（失効）されているため再登録できません。新しい端末側の「この端末」欄で「別のデバイスIDを新しく作成」を押してから、新しく登録用QRを作り直してください。',
  approveAlreadyRegisteredError:
    '二重登録ブロック：この端末はすでにこのマイIDに登録済みです。（再登録したい場合は「登録済みデバイス」から削除/解除するか、新端末側で別のデバイスIDを作成してください）',
  approveCameraHint: '新しい端末のステップ1に表示された「登録用QRコード」をカメラで映してください。',
  approveNoOwnerTitle: 'このブラウザには「マイID」がないため、承認を実行できません',
  approveNoOwnerDesc:
    '「承認する」を押すには、マイID（所有者鍵）を持っているメイン端末（PC等）でこの画面を開く必要があります。もし iPad 等の新端末を登録しようとしている場合は、「デバイスを追加（新端末）」タブでQRを作り、そのQRをマイIDがあるPC側で読み込んでください。（このブラウザにマイIDを復元する場合は /keys からインポートしてください）',
  approveNoOwnerGoAddBtn: '「デバイスを追加（新端末）」タブへ切替',
  approveNoOwnerGoKeysBtn: 'マイID作成・復元 (/keys) へ',
  inviteSectionTitle: 'PCに招待QRを出して、iPad・スマホを登録（PC → 新端末）',
  inviteSectionDesc:
    'PCにカメラがなくても、iPad・スマホのカメラで下のQRを読み取るだけで登録できます。無料の中継リレー（Nostr）で暗号化してやり取りします（秘密鍵や作品データは一切送信しません）。',
  createInviteQrBtn: '招待QRを表示する（PC → iPad / スマホ）',
  cancelInviteBtn: '招待QRを閉じる',
  inviteQrTitle: '新端末への招待QRコード（PC → iPad / スマホ）',
  inviteWaitingStatus:
    'iPad・スマホのカメラで読み取り、新端末側で「この端末を登録する」を押すと、ここに承認画面が自動で届きます…',
  inviteCheckNowBtn: '今すぐ受信を確認',
  inviteReceivedFromRelayMsg:
    '新端末から暗号化された登録リクエストを受信しました！確認コードを見比べて「承認する」を押してください。',
  inviteApprovalSentMsg:
    '承認証明書を新端末へ自動送信しました！新端末の画面が「登録が完了しました」に変わるのを確認してください。',
  inviteManualDivider: 'または：オフライン環境で新端末のQR・リンクを直接読み取って承認する',
  inviteAcceptHeading: 'PCからのデバイス登録招待',
  inviteAcceptDesc:
    'メイン端末（PC）からこの端末を登録するための招待が届きました。端末名を確認して送信してください。',
  inviteFromOwnerLabel: '登録先のマイID（招待元）',
  inviteRelayNotice:
    '無料の中継リレー（Nostr）を使ってPCへ暗号化した登録リクエストを送ります。秘密鍵や作品データは送信されません。',
  inviteAcceptSendBtn: 'この端末を登録する（PCへ送信）',
  inviteSendingBtn: '送信中…',
  inviteCancelReceiveBtn: 'この招待を閉じる',
  inviteSentWaitingTitle: 'PCへ登録リクエストを送信しました',
  inviteSentWaitingDesc:
    'PCの画面に同じ確認コードが表示されたら、PC側で「承認する」を押してください。承認されるとこの画面も自動で完了します（待機中…）。',
  inviteManualFallbackSummary: 'リレー経由で届かない場合：手動QR・リンクで完了する',
  inviteExpiredError: 'この招待QRコードは有効期限が切れています。PC側で「招待QRを表示する」を押し直してください。',
  inviteAlreadyPairedNote: 'このブラウザはすでに招待元のマイIDへ登録済みです。',
  confirmOwnerCheckbox: '既存端末に表示されているマイIDと同じであることを確認しました',
  completePairingBtn: '登録を完了する',
  pairingCompletedTitle: '登録が完了しました',
  pairingCompletedDesc: 'この端末はあなたのマイIDに正常に結びつけられました。',
  ownerUnverifiedWarning: 'まだこの端末側で「マイID本人確認」が完了していません。既存端末のIDと見比べて問題なければ確認ボタンを押してください。',
  ownerConfirmedBadge: 'マイID本人確認済み',
  approveHeading: '新しい端末を承認する（既存端末）',
  approveDesc: '新しい端末に表示されたQRコードを読み取り、内容を確認してから承認してください。QRを読み取っただけで自動登録されることはありません。',
  selectOwnerIdLabel: '使用するマイID',
  ownerPassphraseLabel: 'マイIDのパスフレーズ（設定している場合）',
  ownerPassphrasePlaceholder: '暗号化バックアップのパスフレーズ',
  confirmDialogTitlePrefix: '「',
  confirmDialogTitleSuffix: '」をあなたのデバイスとして登録しますか？',
  confirmDeviceNameLabel: 'デバイス名',
  confirmOwnerIdLabel: '登録先のマイID',
  confirmPermissionLabel: '登録先の権限',
  confirmPermissionValue: '端末の識別のみ（作品の代理署名・他端末の承認はできません）',
  confirmApproveBtn: '承認する',
  confirmCancelBtn: 'キャンセル',
  approvalQrReadyTitle: '承認QRコードができました',
  approvalQrReadyDesc: '新しい端末の「ステップ 2」でこのQRコードを読み取ると登録が完了します。',
  registeredDevicesTitle: '登録済みデバイス',
  noDevicesYet: 'まだ登録されているデバイスはありません。',
  offlineSyncWarning: 'サーバーを持たない設計のため、登録一覧や解除状態は分散型同期を有効にするまで他端末へ自動共有されません。オフライン環境では他端末で解除済みかどうかを自動判定できないため、この表示だけで「どこでも解除されていない」と保証することはできません。',
  statusActiveTrusted: '有効・確認済み',
  statusActiveUnverified: '有効（マイID未確認）',
  statusRevoked: '解除済み（失効）',
  statusConflict: '競合・要注意（自動停止）',
  confirmOwnerNowBtn: 'マイIDを本人確認して有効化',
  revokeDeviceBtn: 'この端末を解除・削除',
  revokeAndRemoveLabel: '解除と同時に登録済みデバイス一覧からも削除する（不正復活防止のため失効記録は内部に保持）',
  revokeConfirmTitle: 'この端末を本当に解除しますか？',
  removeDeviceBtn: '一覧から削除',
  removeLocalOnlyBtn: 'このブラウザから削除',
  removeConfirmTitleRevoked: 'この解除済み端末を一覧から削除しますか？',
  removeConfirmDescRevoked:
    '表示一覧とローカル同期相手からこの端末を削除します。暗号学的な失効記録は内部に保持されるため、古いバックアップファイルや同期の再送によって復活することはありません。',
  removeConfirmTitleLocalOnly: 'このブラウザからこの端末記録を削除しますか？',
  removeConfirmDescLocalOnly:
    'このブラウザにはマイID（所有者ルート鍵）がないため、他端末向けの署名付き解除通知は作成されません。このブラウザの一覧と同期相手設定からのみ削除されます。端末を紛失した場合は、マイIDがあるメイン端末から「解除」を実行してください。',
  removeConfirmSubmitBtn: '削除を実行する',
  deviceRemovedMsg: '登録済みデバイスを一覧から削除しました。',
  revokeReasonLabel: '解除の理由',
  revokeReasons: {
    'lost-device': '端末を紛失した',
    'device-compromised': '第三者に使われた可能性がある',
    retired: '機種変更・使わなくなった',
    other: 'その他',
  },
  revokeNoteLabel: 'メモ（任意）',
  revokeNotePlaceholder: '例：2026年11月 スマホ買い替え',
  revokeConfirmSubmitBtn: '署名付きで解除を実行する',
  revocationQrTitle: '端末の解除通知（他の端末へ共有）',
  revocationQrDesc: 'この端末が記録されました。オフラインの別端末にも解除を伝えるには、このQRまたはファイルを別端末で読み込んでください。',
  importRevocationTitle: '別の端末で作った解除通知を取り込む',
  importRevocationBtn: '解除通知を取り込む',
  revocationImportedMsg: '解除通知を検証し、ローカル登録簿を更新しました。',
  backupExportTitle: 'デバイス一覧・解除記録のバックアップ',
  backupExportDesc: '登録済みデバイス一覧と解除情報を署名付きファイルとして保存・読み込みできます。古い一覧を読み込んでも、一度解除した端末は復活しません。',
  exportRegistryJsonBtn: 'JSONバックアップを保存 (.chdevreg.json)',
  exportRegistryCborBtn: 'CBORバックアップを保存 (.chdevreg.cbor)',
  importRegistryFileLabel: 'バックアップファイル（.chdevreg.json / .chdevreg.cbor）を読み込む',
  importRegistrySuccess: '署名付きデバイス一覧ファイルを検証し、安全に統合しました。',
  technicalDetailsSummary: '詳細（公開情報・プロトコル確認）',
  detailPublicKey: '公開鍵',
  detailFingerprintShort: '識別コード（短縮）',
  detailFingerprintFull: 'SHA-256 フィンガープリント',
  detailDeviceId: 'デバイスID',
  detailProtocol: 'プロトコル',
  detailStorageMode: '鍵の保管方式',
  detailIssuedAt: '発行・記録時刻',
  noRootKeyCopyNote: 'v1では端末鍵だけで作品の代理署名はできません。作品への署名にはマイID本体（または暗号化バックアップ復元）を使います。',
  corruptRecordWarningTitle: '壊れたローカルデータが見つかりました（安全のため自動無効化）',
  clearCorruptRecordBtn: '壊れたレコードを削除',
  keysPageManageDevicesBtn: 'デバイスを追加・管理',
  exchangePagePairingLink: '自分のスマホ・タブレットを登録する場合は「登録済みデバイス」へ',
  docsPairingTitle: 'CHM Secure Device Pairing（CHM-DEVICE-PAIRING-v1）',
  docsPairingBody: 'サーバー・クラウドDB・アカウント登録を一切使わずに、PC・スマホ・タブレットを同じマイIDへ紐づける2段階QRプロトコルです。各端末で独立したEd25519デバイス鍵（Web Crypto non-extractable優先）を生成し、ルート秘密鍵は一切コピーしません。登録要求・承認証明書・端末解除通知・デバイス登録簿バックアップ（.chdevreg.json / .chdevreg.cbor）は決定的RFC 8949 CBOR＋ドメイン分離Ed25519署名で保護され、v1では端末鍵単体による作品の代理署名および他端末への委任承認を厳格に禁止しています。',
  docsSyncTitle: 'CHM Decentralized Device Sync（CHM-SYNC-v1 + Nostr NIP-44/NIP-59）',
  docsSyncBody: '任意のオプトイン分散同期レイヤーです（既定オフ）。有効化すると端末ごとに独立したsecp256k1同期鍵（CHM Ed25519鍵とは暗号学的に完全分離）を生成し、NIP-44 v2およびNIP-59 Gift Wrapによる端末単位の暗号化で登録・失効ログのみをWSSリレー経由で配送します。リレーに認証権限はなく、単調な失効ルール・因果連鎖検証・確認コードにより改ざん・巻き戻し・QR差し替えを防ぎます。作品の署名・検証はNostrやリレーなしでも常に完全動作します。',
  sync: {
    tabLabel: '分散型同期',
    sectionTitle: '分散型デバイス同期（任意・オフライン優先）',
    sectionSubtitle: '有効にした場合のみ、暗号化された端末登録・解除記録を端末間で受け渡します。作品の署名や検証は同期なし・完全オフラインでも常に動作します。',
    consentTitle: '有効化する前に確認してください',
    consentPoints: [
      '作品画像・制作データ・秘密鍵・個人情報は一切外部へ送信しません（端末リストと解除証明のみを暗号化してやり取りします）。',
      '接続先の中継サーバー（リレー）は暗号化済みデータの転送のみを行い、Certified Handmadeの認証権限は一切持ちません。',
      '通信時にはリレー運営者にIPアドレス・接続時刻・同期用公開IDなどの通信メタデータが観測されます。無料公開リレーの永続性・稼働保証はありません。',
      '有効化後でもいつでもオフにでき、解除済み端末は次回以降の同期暗号化の対象から自動的に除外されます。',
    ],
    consentCheckbox: '暗号化された端末同期の仕組みと通信メタデータの注意事項を理解したうえで、分散型同期を有効にします',
    enableBtn: '分散型同期を有効にする',
    disableBtn: '分散型同期を停止',
    syncNowBtn: '今すぐ同期',
    syncingLabel: '同期中…',
    statusLabels: {
      disabled: 'オフ（無効）',
      offline: 'オフライン（送信キュー待機中）',
      syncing: '同期中…',
      'synced-observable': '同期済み（到達可能なリレーと一致）',
      'partial-relays': '一部リレーのみ接続',
      'error-unreachable': 'リレーに接続できません',
    },
    honestGuaranteeNote: '※ 中継サーバーがイベントを削除・隠蔽する可能性や、オフライン中の他端末が存在する可能性があるため、「到達可能なリレーと一致」は世界全体の最新保証ではありません。確実な失効反映には解除QRまたは署名付きバックアップファイルも併用してください。',
    causalGapWarning: '同期ログの連続番号に欠落が検出されました（接続リレーが一部履歴を返していない可能性があります）。別のリレーを追加するか、.chdevreg バックアップの読み込みで確認してください。',
    queuedUpdatesLabel: '未送信キュー',
    lastSyncedLabel: '最終同期時刻',
    neverSyncedLabel: '未実行',
    peerCardTitle: '他の自分の端末と同期でつなぐ',
    peerCardDesc: '分散型同期を有効にした状態でQR登録すると自動連携されます。すでに登録済みの別端末とも同期したい場合は、下の同期カードをコピーして別端末に貼り付けてください。',
    copyPeerCardBtn: 'この端末の同期カードをコピー',
    importPeerCardLabel: '別端末の同期カードを取り込む',
    importPeerCardPlaceholder: 'chm-sync-bind:... を貼り付け',
    importPeerCardBtn: '同期相手を追加',
    importPeerCardSuccess: '暗号学的に検証された同期相手を登録しました。',
    relaysTitle: '利用する中継サーバー（WSSリレー）',
    relaysDesc: '通信には暗号化された wss:// のみ許可されます。独自のセルフホストリレーや好みの無料公開リレーを自由に追加・削除できます。',
    addRelayPlaceholder: 'wss://relay.example.com',
    addRelayBtn: 'リレーを追加',
    loadPresetsBtn: '推奨公開リレーを読み込む',
    resetRelaysBtn: 'デフォルトに戻す',
    presetGlobalTitle: 'Global（標準・IP制限なし）',
    presetGlobalAddBtn: 'Global 標準4件を追加',
    presetJapanTitle: 'Japan（日本向け・任意）',
    presetJapanAddBtn: 'Japan プリセットを追加',
    presetJapanIpNotice:
      '※ 一部の日本向けリレー（yabu.me / relay-jp.nostr.wirednet.jp）は、VPNや海外IPからの書き込みに失敗する場合があります。',
    presetRelayAdded: '追加済み',
    presetRelayAddOne: '追加',
    removeRelayBtn: '削除',
    advancedSummary: '高度な技術情報（Nostr・暗号鍵の詳細）',
    advancedNpubLabel: 'この端末の同期用公開ID（Nostr npub）',
    advancedKeyCustodyLabel: '同期用秘密鍵の保護方式（CHM Ed25519鍵とは完全分離）',
    advancedProtocolLabel: '利用仕様',
    advancedBrowserWarning: 'ブラウザ環境では同一オリジン上のXSSや悪意あるブラウザ拡張機能からWebストレージへの干渉を受けるリスクがあります。重要な作者ルート鍵（.chkey.json）は必ずオフライン保管してください。',
    backupNcryptsecTitle: '同期鍵の暗号化バックアップ（NIP-49 ncryptsec）',
    backupPasswordPlaceholder: '保護パスワード（8文字以上推奨）',
    exportNcryptsecBtn: '暗号化バックアップを表示',
    importNcryptsecPlaceholder: 'ncryptsec1... を貼り付け',
    importNcryptsecBtn: 'バックアップから復元',
    importNcryptsecSuccess: 'NIP-49バックアップからこの端末の同期鍵を復元しました。',
    confirmationCodeLabel: '確認コード',
    confirmationCodeHint: '新端末と既存端末で同じ8文字コードが表示されているか見比べてください（QR差し替え対策）。',
    checkRelayPolicyBtn: '無料ポリシー確認',
    policyLabels: {
      unknown: '未確認',
      'free-usable': '無料利用可 (NIP-11)',
      'payment-required': '有料リレー拒否済み (¥0保護)',
      'write-restricted': '書込制限あり',
      'quota-exceeded': '容量上限到達',
      'pow-required': '高負荷PoW必須',
      unreachable: '接続不可',
    },
    onlineBudgetLabel: '30日間 同期データ上限（ソフト上限）',
    gracefulFallbackTitle: 'ローカル保存モードで継続中（無料・オフライン完全対応）',
    gracefulFallbackBody: 'リレーが有料化・満杯・到達不能、または月間データ上限に達しても、作品証明の作成・検証・QR生成・ローカル保管庫は一切制限なく動作します。下のローカル保管庫からJSONバックアップも利用できます。',
    gracefulFallbackExportLink: '証明保管庫 (Vault) でバックアップ / 管理',
    syncVaultProofsToggle: '保管庫で選択した作品証明も端末間へ暗号化同期する（画像本体は送信しません）',
    syncVaultProofsBtn: '選択中の証明を同期',
    syncVaultProofsSuccess: '選択中の証明を暗号化キューへ追加・同期しました。',
  },
};

const EN_DEVICE_PAIRING: DevicePairingTranslations = {
  navItem: 'Paired Devices',
  title: 'Device Pairing & Management',
  subtitle: 'Link your PC, smartphone, and tablet to your CHM Identity locally and offline with no central server.',
  helpLabel: 'How Device Pairing Works (?)',
  helpTitle: 'About Secure Device Pairing',
  helpPoints: [
    'Works 100% serverless and offline via a 2-step QR handshake—no accounts, relays, or cloud storage.',
    'Each device generates its own dedicated Ed25519 device key; your root author private key is never copied.',
    'If camera access is unavailable, you can upload QR PNG/JPEG/WebP images or paste tokens/URLs.',
    'When replacing or losing a device, revoke or remove it from the “Paired Devices & Backup” tab.',
  ],
  myIdSectionTitle: 'My ID (CHM Owner Identity)',
  myIdEmptyDesc: 'To approve a new device, create or restore a CHM Identity first.',
  goToKeysBackupBtn: 'Go to Keys & Backup',
  quickCreateIdLabel: 'Quick-Create My ID (Artist Name)',
  quickCreateIdPlaceholder: 'e.g. YomiPlush',
  quickCreateIdPassPlaceholder: 'Backup passphrase (optional, 8+ chars)',
  quickCreateIdBtn: 'Create My ID',
  thisDeviceTitle: 'This Device',
  thisDeviceRevokedAlert: 'This local device key has been revoked and cannot be re-used. Generate a new Device Identity if you intentionally want to re-enroll.',
  regenerateDeviceIdBtn: 'Generate New Device Identity',
  createSeparateDeviceIdBtn: 'Generate New Separate Device ID',
  alreadyPairedBadge: 'Paired',
  alreadyPairedUnderOwnersLabel: 'Linked to My ID',
  alreadyPairedStep1Note:
    'This browser is already registered. To add a 3rd+ device, open this page on that new device’s browser to create its pairing QR. (If you intentionally need a separate Device ID in this browser, generate a new one in the “This Device” card above.)',
  approveNextDeviceBtn: 'Approve Another Device (Clear)',
  ownerInAddTabHint:
    'This browser already holds a My ID. To add another device (such as your iPad or phone), open /devices on THAT new device to create the Step 1 Pairing QR, then approve it here under “Approve a Device (Existing)”.',
  switchToApproveTabBtn: 'Go to “Approve a Device” Tab',
  addDeviceTab: 'Add This Device (New)',
  approveDeviceTab: 'Approve a Device (Existing)',
  registryTab: 'Paired Devices & Backup',
  step1Heading: 'Step 1: Show This Device’s Pairing QR',
  step1Desc: 'Scan this QR code with an existing device (such as your PC) that already holds your CHM Identity.',
  deviceNameLabel: 'Device Display Name',
  deviceNamePlaceholder: 'e.g. iPhone / iPad / Studio PC',
  devicePassLabel: 'Device Key Passphrase (only needed on fallback browsers)',
  devicePassPlaceholder: 'Required only if browser lacks Web Crypto Ed25519 (8+ chars)',
  generateRequestQrBtn: 'Create Pairing QR Code',
  cancelRequestBtn: 'Cancel Request',
  requestQrTitle: 'New Device Pairing Request QR',
  requestExpiresIn: 'Expires in',
  requestExpiredBadge: 'Expired (create a new QR)',
  downloadQrPngBtn: 'Save QR Image (PNG)',
  copyUrlBtn: 'Copy Link / Code',
  copiedMsg: 'Copied',
  step2NewHeading: 'Step 2: Scan Approval QR from Existing Device',
  step2NewDesc: 'After tapping Approve on your existing device, scan or import the Approval QR code shown there.',
  scanCameraBtn: 'Scan QR with Camera',
  stopCameraBtn: 'Stop Camera',
  cameraHint: 'Point your camera at the Approval QR or Revocation QR.',
  cameraDeniedFallbackMsg: 'Camera unavailable. Please upload a QR image or paste the approval link/code below.',
  uploadQrImageLabel: 'No camera? Upload QR image file (PNG/JPEG/WebP)',
  pasteInputLabel: 'Or paste approval URL / code',
  pasteInputPlaceholder: 'Paste approval URL (#pair-cert=...) or token',
  verifyCertBtn: 'Inspect Approval',
  step2WrongTypeRequestChild:
    'This is a Pairing Request (#pair-req=), not an Approval Certificate (#pair-cert=). Create the Step 1 request QR on THIS new device first, then scan or paste it in the “Approve a Device (Existing)” tab on your main device holding My ID.',
  step2WrongTypeRequestOwner:
    'This is a Pairing Request (#pair-req=), not an Approval Certificate (#pair-cert=). Because this browser holds a My ID, you can open it directly in the “Approve a Device (Existing)” tab below.',
  sendToApproveTabBtn: 'Open in “Approve a Device” Tab',
  step2WrongTypeRegistry:
    'This is a device registry backup (.chdevreg). Import it from the “Paired Devices & Backup” tab.',
  step2RevocationAppliedMsg: 'Verified revocation notice and updated local device status.',
  step2RevokedDeviceError:
    'This device has been revoked and cannot complete registration. Generate a new Device ID under “This Device” above and start over.',
  step2AlreadyRegisteredError: 'This device is already registered under this CHM Identity.',
  approveWrongTypeCert:
    'This is an issued Approval Certificate (#pair-cert=), not a Pairing Request (#pair-req=). Scan or paste it into Step 2 on the new device you are adding.',
  approveWrongTypeRevocation:
    'This is a device revocation notice (#pair-rev=). Import it under “Paired Devices & Backup”.',
  approveRevokedDeviceError:
    'This device key has been revoked and cannot be registered. On the new device, click “Generate New Separate Device ID” under This Device and create a fresh pairing QR.',
  approveAlreadyRegisteredError:
    'Double-registration blocked: this device is already registered under your My ID.',
  approveCameraHint: 'Point your camera at the Pairing Request QR displayed on your new device.',
  approveNoOwnerTitle: 'Approval is disabled because this browser does not hold a My ID',
  approveNoOwnerDesc:
    'To tap Approve, open this page on your main browser holding My ID (e.g. your PC) and scan/paste the new device’s Step 1 QR there. If you are setting up THIS device as a new child device, switch to “Add This Device (New)”. (Or restore/create a My ID in Keys & Backup.)',
  approveNoOwnerGoAddBtn: 'Switch to “Add This Device (New)”',
  approveNoOwnerGoKeysBtn: 'Create / Restore My ID (/keys)',
  inviteSectionTitle: 'Invite a New Device from This PC (PC → iPad / Phone)',
  inviteSectionDesc:
    'Even without a PC webcam, display an invitation QR here and scan it with your iPad or phone camera. Encrypted end-to-end over free Nostr relays (private keys and artworks are never sent).',
  createInviteQrBtn: 'Show Invitation QR (PC → New Device)',
  cancelInviteBtn: 'Close Invitation QR',
  inviteQrTitle: 'Device Pairing Invitation QR',
  inviteWaitingStatus:
    'Scan with your iPad/phone camera and tap Register there. The approval confirmation will appear here automatically…',
  inviteCheckNowBtn: 'Check Now',
  inviteReceivedFromRelayMsg:
    'Encrypted pairing request received from your new device! Compare the confirmation code and tap Approve.',
  inviteApprovalSentMsg:
    'Encrypted approval sent back to your new device! Check that your new device updates to Registration Complete.',
  inviteManualDivider: 'Or: Approve offline by scanning or pasting a Step 1 QR directly',
  inviteAcceptHeading: 'Device Pairing Invitation from PC',
  inviteAcceptDesc:
    'An invitation from your main device (PC) was scanned. Confirm this device’s name and send the encrypted request.',
  inviteFromOwnerLabel: 'Target My ID (Inviter)',
  inviteRelayNotice:
    'Sends an encrypted pairing request back to your PC via free Nostr relays. Private keys and artworks are never sent.',
  inviteAcceptSendBtn: 'Register This Device (Send to PC)',
  inviteSendingBtn: 'Sending…',
  inviteCancelReceiveBtn: 'Dismiss Invitation',
  inviteSentWaitingTitle: 'Pairing Request Sent to PC',
  inviteSentWaitingDesc:
    'Verify that the confirmation code matches on your PC and click Approve there. This screen will complete automatically…',
  inviteManualFallbackSummary: 'Relay delayed? Complete manually via QR / link',
  inviteExpiredError: 'This invitation QR has expired. Generate a new Invitation QR on your PC.',
  inviteAlreadyPairedNote: 'This browser is already paired under this inviting My ID.',
  confirmOwnerCheckbox: 'I verified this Owner ID matches the one displayed on my existing device',
  completePairingBtn: 'Complete Registration',
  pairingCompletedTitle: 'Registration Complete',
  pairingCompletedDesc: 'This device is now paired to your CHM Identity.',
  ownerUnverifiedWarning: 'This Owner ID has not been confirmed yet on this device. Compare it with your existing device and confirm trust.',
  ownerConfirmedBadge: 'Owner Confirmed',
  approveHeading: 'Approve a New Device (Existing Device)',
  approveDesc: 'Scan the new device’s QR code, inspect its details, and explicitly confirm before signing.',
  selectOwnerIdLabel: 'Select My ID',
  ownerPassphraseLabel: 'Key Passphrase (if encrypted fallback)',
  ownerPassphrasePlaceholder: 'Enter passphrase to unlock My ID',
  confirmDialogTitlePrefix: 'Register "',
  confirmDialogTitleSuffix: '" as your device?',
  confirmDeviceNameLabel: 'Device Name',
  confirmOwnerIdLabel: 'Owner CHM Identity',
  confirmPermissionLabel: 'Granted Permissions',
  confirmPermissionValue: 'Device identity only (cannot sign artworks or approve other devices)',
  confirmApproveBtn: 'Approve',
  confirmCancelBtn: 'Cancel',
  approvalQrReadyTitle: 'Approval QR Ready',
  approvalQrReadyDesc: 'Scan this QR code in Step 2 on the new device to finish pairing.',
  registeredDevicesTitle: 'Paired Devices',
  noDevicesYet: 'No paired devices recorded on this browser yet.',
  offlineSyncWarning: 'Because there is no central server, device lists and revocations do NOT share automatically unless Decentralized Sync is enabled. Even with sync, an offline device cannot prove a key is unrevoked elsewhere—share the revocation QR or signed registry backup to update offline devices.',
  statusActiveTrusted: 'Active · Verified Owner',
  statusActiveUnverified: 'Active · Owner Unconfirmed',
  statusRevoked: 'Revoked',
  statusConflict: 'Conflict (Disabled)',
  confirmOwnerNowBtn: 'Confirm Owner Identity',
  revokeDeviceBtn: 'Revoke / Remove Device',
  revokeAndRemoveLabel: 'Also remove from the paired devices list after revoking (revocation proof stays stored locally)',
  revokeConfirmTitle: 'Revoke this device permanently?',
  removeDeviceBtn: 'Remove from List',
  removeLocalOnlyBtn: 'Remove from Browser',
  removeConfirmTitleRevoked: 'Remove this revoked device from the list?',
  removeConfirmDescRevoked:
    'Deletes this entry and any local sync peer binding from the list. The cryptographic revocation record stays stored locally so stale backups or sync replays cannot reactivate this device.',
  removeConfirmTitleLocalOnly: 'Remove this device entry from this browser?',
  removeConfirmDescLocalOnly:
    'This browser does not hold your My ID (Owner root key), so it cannot sign a cryptographic revocation for other devices. This removes the entry and local sync peer binding from this browser only. If a device was lost, revoke it from your main browser holding My ID.',
  removeConfirmSubmitBtn: 'Confirm Removal',
  deviceRemovedMsg: 'Removed device entry from the local list.',
  revokeReasonLabel: 'Reason',
  revokeReasons: {
    'lost-device': 'Lost device',
    'device-compromised': 'Possible compromise',
    retired: 'Retired / replaced',
    other: 'Other',
  },
  revokeNoteLabel: 'Note (optional)',
  revokeNotePlaceholder: 'e.g. Replaced phone Nov 2026',
  revokeConfirmSubmitBtn: 'Generate Signed Revocation',
  revocationQrTitle: 'Signed Revocation Notice (Share to Other Devices)',
  revocationQrDesc: 'Recorded locally. Scan or import this QR/token on your other devices to propagate the revocation offline.',
  importRevocationTitle: 'Import Revocation Notice from Another Device',
  importRevocationBtn: 'Import Revocation',
  revocationImportedMsg: 'Verified revocation notice and updated local device registry.',
  backupExportTitle: 'Signed Device Registry Backup',
  backupExportDesc: 'Export or import your paired device list and revocations as signed files. Re-importing stale snapshots never rolls back known revocations.',
  exportRegistryJsonBtn: 'Export JSON (.chdevreg.json)',
  exportRegistryCborBtn: 'Export CBOR (.chdevreg.cbor)',
  importRegistryFileLabel: 'Import signed backup (.chdevreg.json / .chdevreg.cbor)',
  importRegistrySuccess: 'Verified signed device registry and reconciled monotonically.',
  technicalDetailsSummary: 'Details (Public Keys, Fingerprints & Protocol)',
  detailPublicKey: 'Public Key',
  detailFingerprintShort: 'Short Fingerprint',
  detailFingerprintFull: 'SHA-256 Fingerprint',
  detailDeviceId: 'Device ID',
  detailProtocol: 'Protocol',
  detailStorageMode: 'Key Custody',
  detailIssuedAt: 'Issued At',
  noRootKeyCopyNote: 'In v1, paired devices cannot sign artworks on behalf of your root author key. Keep using your root key (or encrypted .chkey.json backup) to sign artworks.',
  corruptRecordWarningTitle: 'Corrupt local storage records detected and quarantined',
  clearCorruptRecordBtn: 'Delete Corrupt Entry',
  keysPageManageDevicesBtn: 'Add & Manage Devices',
  exchangePagePairingLink: 'Pairing your own phone/tablet? Open Paired Devices',
  docsPairingTitle: 'CHM Secure Device Pairing (CHM-DEVICE-PAIRING-v1)',
  docsPairingBody: 'A 100% serverless, offline 2-step QR protocol that pairs PCs, smartphones, and tablets to a CHM Identity without accounts, relays, or copying root private keys. Each device generates its own Ed25519 keypair (Web Crypto non-extractable preferred) and receives an owner-signed deterministic RFC 8949 CBOR enrollment certificate, with signed revocations and monotonic registry backups (.chdevreg.json / .chdevreg.cbor). In v1, paired device keys hold device-identity scope only—delegated artwork signing and delegated approvals are prohibited.',
  docsSyncTitle: 'CHM Decentralized Device Sync (CHM-SYNC-v1 + Nostr NIP-44/NIP-59)',
  docsSyncBody: 'An optional, opt-in decentralized transport layer (OFF by default). Each device generates an isolated secp256k1 Nostr keypair (strictly separated from CHM Ed25519 keys), binds it with dual signatures (Ed25519 + BIP-340 Schnorr PoP), and exchanges only device enrollment/revocation operations encrypted per recipient via NIP-44 v2 + NIP-59 Gift Wrap over wss:// relays. Relays hold zero authority and never receive artworks, private keys, or personal data; revocation monotonicity and missing-sequence causal gap detection protect against withholding and replay, while core artwork signing and verification remain 100% independent of relays.',
  sync: {
    tabLabel: 'Decentralized Sync',
    sectionTitle: 'Decentralized Device Sync (Optional · Local-First)',
    sectionSubtitle: 'Optionally exchanges encrypted device registration and revocation records across your paired devices. Core artwork signing and verification always work offline without sync.',
    consentTitle: 'Before You Enable Decentralized Sync',
    consentPoints: [
      'Artwork files, PSD/layer data, private keys, and personal information are NEVER uploaded—only signed device metadata wrapped with per-device encryption is synced.',
      'Relay servers are untrusted external storage/transport only and hold zero CHM signing or approval authority.',
      'Relay operators can still observe connection IP addresses, timestamps, and routing metadata; free public relays carry no uptime or retention guarantee.',
      'You can disable sync at any time. Revoked devices are automatically excluded from all subsequent encrypted sync envelopes.',
    ],
    consentCheckbox: 'I understand how encrypted device sync works and that relay servers can observe connection metadata (IP address and timestamps)',
    enableBtn: 'Enable Decentralized Sync',
    disableBtn: 'Disable Sync',
    syncNowBtn: 'Sync Now',
    syncingLabel: 'Syncing…',
    statusLabels: {
      disabled: 'Off (Disabled)',
      offline: 'Offline (Updates queued locally)',
      syncing: 'Syncing…',
      'synced-observable': 'Synced with reachable relays',
      'partial-relays': 'Partial relays reachable',
      'error-unreachable': 'Relays unreachable',
    },
    honestGuaranteeNote: 'Note: Relays may drop or withhold events and offline devices cannot check updates immediately. Sync cannot guarantee global instant revocation—keep sharing revocation QRs or .chdevreg backups for offline certainty.',
    causalGapWarning: 'Missing sequence numbers detected in sync history. A reachable relay may be withholding earlier events; verify via another relay or import a .chdevreg backup.',
    queuedUpdatesLabel: 'Queued Updates',
    lastSyncedLabel: 'Last Synced',
    neverSyncedLabel: 'Never',
    peerCardTitle: 'Link Another Paired Device for Sync',
    peerCardDesc: 'Devices paired via QR while sync is enabled exchange peer sync cards automatically. For already-paired devices, copy this device’s Sync Peer Card and import it on your other device.',
    copyPeerCardBtn: 'Copy This Device’s Sync Card',
    importPeerCardLabel: 'Import Peer Sync Card from Another Device',
    importPeerCardPlaceholder: 'Paste chm-sync-bind:... token',
    importPeerCardBtn: 'Add Sync Peer',
    importPeerCardSuccess: 'Verified and saved peer sync binding.',
    relaysTitle: 'Configured Relays (WSS Only)',
    relaysDesc: 'Only encrypted wss:// relays are permitted. You can add self-hosted relays, toggle relays, or remove defaults at any time.',
    addRelayPlaceholder: 'wss://relay.example.com',
    addRelayBtn: 'Add Relay',
    loadPresetsBtn: 'Load Default Public Relays',
    resetRelaysBtn: 'Reset to Defaults',
    presetGlobalTitle: 'Global (Standard · No IP restriction)',
    presetGlobalAddBtn: 'Add Global Standard (4)',
    presetJapanTitle: 'Japan (Optional)',
    presetJapanAddBtn: 'Add Japan Presets',
    presetJapanIpNotice:
      'Note: Some Japan relays (yabu.me / relay-jp.nostr.wirednet.jp) restrict writes to Japan IPs and may fail over VPN or overseas IPs.',
    presetRelayAdded: 'Added',
    presetRelayAddOne: 'Add',
    removeRelayBtn: 'Remove',
    advancedSummary: 'Advanced Technical Info (Nostr & Key Separation)',
    advancedNpubLabel: 'Device Sync Public ID (Nostr npub)',
    advancedKeyCustodyLabel: 'Sync Secret Key Protection (Strictly isolated from CHM Ed25519 keys)',
    advancedProtocolLabel: 'Sync Protocols',
    advancedBrowserWarning: 'Browser storage remains exposed to same-origin XSS or malicious browser extensions. Keep your primary Artist Root Key (.chkey.json) backed up offline.',
    backupNcryptsecTitle: 'Encrypted Sync Key Backup (NIP-49 ncryptsec)',
    backupPasswordPlaceholder: 'Backup password (8+ chars recommended)',
    exportNcryptsecBtn: 'Show Encrypted Backup',
    importNcryptsecPlaceholder: 'Paste ncryptsec1... string',
    importNcryptsecBtn: 'Restore from ncryptsec',
    importNcryptsecSuccess: 'Restored device sync key from NIP-49 encrypted backup.',
    confirmationCodeLabel: 'Confirmation Code',
    confirmationCodeHint: 'Compare this 8-character code on both devices to guard against QR swapping.',
    checkRelayPolicyBtn: 'Check Free Policy',
    policyLabels: {
      unknown: 'Unchecked',
      'free-usable': 'Free Usable (NIP-11)',
      'payment-required': 'Paid Relay Blocked (¥0 Guard)',
      'write-restricted': 'Write Restricted',
      'quota-exceeded': 'Relay Quota Full',
      'pow-required': 'High PoW Required',
      unreachable: 'Unreachable',
    },
    onlineBudgetLabel: '30-Day Online Data Budget (Soft Cap)',
    gracefulFallbackTitle: 'Continuing in Free Local-First Mode',
    gracefulFallbackBody: 'Even if relays require payment, hit quota limits, or go offline, local signing, verification, QR generation, and your Proof Vault keep working with zero interruptions.',
    gracefulFallbackExportLink: 'Open Proof Vault for JSON Backup',
    syncVaultProofsToggle: 'Also sync vault proofs selected for cross-device backup (never uploads artwork images)',
    syncVaultProofsBtn: 'Sync Selected Proofs',
    syncVaultProofsSuccess: 'Encrypted selected vault proofs for paired devices.',
  },
};

const EXTRA_NAV_LABELS: Record<Exclude<SupportedLocale, 'en' | 'ja'>, string> = {
  'zh-CN': '已配对设备',
  'zh-TW': '已配對裝置',
  ko: '등록된 기기',
  ru: 'Мои устройства',
  uk: 'Мої пристрої',
  es: 'Dispositivos',
  fr: 'Appareils',
  de: 'Geräte',
  pt: 'Dispositivos',
  it: 'Dispositivi',
  ar: 'الأجهزة المقترنة',
};

export const DEVICE_PAIRING_I18N: Record<SupportedLocale, DevicePairingTranslations> = {
  en: EN_DEVICE_PAIRING,
  ja: JA_DEVICE_PAIRING,
  'zh-CN': { ...EN_DEVICE_PAIRING, navItem: EXTRA_NAV_LABELS['zh-CN'] },
  'zh-TW': { ...EN_DEVICE_PAIRING, navItem: EXTRA_NAV_LABELS['zh-TW'] },
  ko: { ...EN_DEVICE_PAIRING, navItem: EXTRA_NAV_LABELS.ko },
  ru: { ...EN_DEVICE_PAIRING, navItem: EXTRA_NAV_LABELS.ru },
  uk: { ...EN_DEVICE_PAIRING, navItem: EXTRA_NAV_LABELS.uk },
  es: { ...EN_DEVICE_PAIRING, navItem: EXTRA_NAV_LABELS.es },
  fr: { ...EN_DEVICE_PAIRING, navItem: EXTRA_NAV_LABELS.fr },
  de: { ...EN_DEVICE_PAIRING, navItem: EXTRA_NAV_LABELS.de },
  pt: { ...EN_DEVICE_PAIRING, navItem: EXTRA_NAV_LABELS.pt },
  it: { ...EN_DEVICE_PAIRING, navItem: EXTRA_NAV_LABELS.it },
  ar: { ...EN_DEVICE_PAIRING, navItem: EXTRA_NAV_LABELS.ar },
};

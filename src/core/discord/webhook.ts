const DISCORD_WEBHOOK_STORAGE_KEY = 'chm_discord_webhook_v1';

const DISCORD_WEBHOOK_URL_REGEX =
  /^https:\/\/(?:(?:ptb|canary)\.)?(?:discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+(?:\?.*)?$/;

export interface DiscordWebhookSettings {
  webhookUrl: string;
  autoSendOnCertify: boolean;
}

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbedPayload {
  title: string;
  description?: string;
  color?: number;
  fields?: DiscordEmbedField[];
  footer?: { text: string };
  timestamp?: string;
}

export interface DiscordWebhookBody {
  username?: string;
  content?: string;
  embeds?: DiscordEmbedPayload[];
}

export function validateDiscordWebhookUrl(rawUrl: string): {
  valid: boolean;
  normalized: string;
} {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, normalized: '' };
  }
  return {
    valid: DISCORD_WEBHOOK_URL_REGEX.test(trimmed),
    normalized: trimmed,
  };
}

export function loadDiscordSettings(): DiscordWebhookSettings {
  if (typeof window === 'undefined') {
    return { webhookUrl: '', autoSendOnCertify: false };
  }
  try {
    const raw = window.localStorage.getItem(DISCORD_WEBHOOK_STORAGE_KEY);
    if (!raw) return { webhookUrl: '', autoSendOnCertify: false };
    const parsed = JSON.parse(raw) as Partial<DiscordWebhookSettings>;
    return {
      webhookUrl: typeof parsed.webhookUrl === 'string' ? parsed.webhookUrl : '',
      autoSendOnCertify: Boolean(parsed.autoSendOnCertify),
    };
  } catch {
    return { webhookUrl: '', autoSendOnCertify: false };
  }
}

export function saveDiscordSettings(settings: DiscordWebhookSettings): void {
  if (typeof window === 'undefined') return;
  const trimmedUrl = settings.webhookUrl.trim();
  if (trimmedUrl) {
    const { valid } = validateDiscordWebhookUrl(trimmedUrl);
    if (!valid) {
      throw new Error('INVALID_WEBHOOK_URL');
    }
  }
  window.localStorage.setItem(
    DISCORD_WEBHOOK_STORAGE_KEY,
    JSON.stringify({
      webhookUrl: trimmedUrl,
      autoSendOnCertify: Boolean(settings.autoSendOnCertify),
    }),
  );
}

export function clearDiscordSettings(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(DISCORD_WEBHOOK_STORAGE_KEY);
}

export interface DiscordWebhookErrorMessages {
  invalidUrlError: string;
  networkError: string;
  httpErrorPrefix: string;
}

export function formatDiscordWebhookError(
  err: unknown,
  messages: DiscordWebhookErrorMessages,
): string {
  const code = err instanceof Error ? err.message : '';
  if (code === 'INVALID_WEBHOOK_URL') return messages.invalidUrlError;
  if (code.startsWith('HTTP_ERROR:')) {
    return `${messages.httpErrorPrefix} (HTTP ${code.split(':')[1]})`;
  }
  return messages.networkError;
}

export async function sendDiscordWebhookPayload(
  webhookUrl: string,
  body: DiscordWebhookBody,
): Promise<void> {
  const { valid, normalized } = validateDiscordWebhookUrl(webhookUrl);
  if (!valid) {
    throw new Error('INVALID_WEBHOOK_URL');
  }

  let response: Response;
  try {
    response = await fetch(normalized, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'Certified Handmade',
        ...body,
      }),
    });
  } catch {
    throw new Error('NETWORK_ERROR');
  }

  if (!response.ok) {
    throw new Error(`HTTP_ERROR:${response.status}`);
  }
}

export async function sendDiscordTestMessage(
  webhookUrl: string,
  locale: 'ja' | 'en' = 'en',
): Promise<void> {
  const isJa = locale === 'ja';
  await sendDiscordWebhookPayload(webhookUrl, {
    embeds: [
      {
        title: isJa
          ? '✅ Certified Handmade Webhook 接続テスト成功'
          : '✅ Certified Handmade Webhook Test Succeeded',
        description: isJa
          ? 'ブラウザローカルからのDiscord Webhook送信が正常に動作しています。Webhook URLはお使いのブラウザ内にのみ保存されます。'
          : 'Your browser-local Discord Webhook integration is working. Your Webhook URL stays strictly in your browser.',
        color: 0x38bdf8,
        timestamp: new Date().toISOString(),
        footer: { text: 'Certified Handmade · 100% Local-First' },
      },
    ],
  });
}

export interface DiscordProofLogParams {
  title?: string;
  authorName?: string;
  artworkHashHex: string;
  signedAtIso: string;
  fingerprintShort: string;
  discordHandle?: string;
}

export async function sendDiscordProofLog(
  webhookUrl: string,
  params: DiscordProofLogParams,
): Promise<void> {
  const shortHash =
    params.artworkHashHex.length > 20
      ? `${params.artworkHashHex.slice(0, 12)}…${params.artworkHashHex.slice(-8)}`
      : params.artworkHashHex;

  const fields: DiscordEmbedField[] = [
    {
      name: 'Title',
      value: params.title?.trim() || '(Untitled)',
      inline: true,
    },
    {
      name: 'Artist',
      value: params.authorName?.trim() || '(Anonymous)',
      inline: true,
    },
    {
      name: 'Artwork Hash (SHA-256 / ID)',
      value: `\`${shortHash}\``,
      inline: false,
    },
    {
      name: 'Author Key Fingerprint',
      value: `\`${params.fingerprintShort}\``,
      inline: true,
    },
    {
      name: 'Signed At',
      value: params.signedAtIso,
      inline: true,
    },
  ];

  if (params.discordHandle) {
    fields.push({
      name: 'Linked Discord',
      value: params.discordHandle,
      inline: true,
    });
  }

  await sendDiscordWebhookPayload(webhookUrl, {
    embeds: [
      {
        title: '🛡️ Artwork Certified — Proof Log',
        description:
          'Metadata & cryptographic proof hash only. Original artwork image was NOT transmitted.',
        color: 0x10b981,
        fields,
        timestamp: params.signedAtIso,
        footer: { text: 'Certified Handmade · Local-First Provenance Log' },
      },
    ],
  });
}

export interface DiscordPublicKeyBackupParams {
  label: string;
  publicKeyBase64Url: string;
  fingerprintHex: string;
  fingerprintShort: string;
  exportBundleJson: string;
}

export async function sendDiscordPublicKeyBackup(
  webhookUrl: string,
  params: DiscordPublicKeyBackupParams,
): Promise<void> {
  const truncatedJson =
    params.exportBundleJson.length > 900
      ? `${params.exportBundleJson.slice(0, 900)}…`
      : params.exportBundleJson;

  await sendDiscordWebhookPayload(webhookUrl, {
    embeds: [
      {
        title: `🔑 Public Key Backup — ${params.label}`,
        description: 'Public Ed25519 verification key (safe to share for artwork verification).',
        color: 0x3b82f6,
        fields: [
          {
            name: 'Short Fingerprint',
            value: `\`${params.fingerprintShort}\``,
            inline: true,
          },
          {
            name: 'Ed25519 Public Key',
            value: `\`${params.publicKeyBase64Url}\``,
            inline: false,
          },
          {
            name: 'Verification JSON',
            value: `\`\`\`json\n${truncatedJson}\n\`\`\``,
            inline: false,
          },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'Certified Handmade · Public Key Backup' },
      },
    ],
  });
}

export interface DiscordEncryptedKeyBackupParams {
  label: string;
  fingerprintShort: string;
  encryptedBackupJson: string;
}

export async function sendDiscordEncryptedKeyBackup(
  webhookUrl: string,
  params: DiscordEncryptedKeyBackupParams,
): Promise<void> {
  const truncatedJson =
    params.encryptedBackupJson.length > 1500
      ? `${params.encryptedBackupJson.slice(0, 1500)}…`
      : params.encryptedBackupJson;

  await sendDiscordWebhookPayload(webhookUrl, {
    embeds: [
      {
        title: `⚠️ Encrypted Private Key Backup (.chkey.json) — ${params.label}`,
        description:
          'Passphrase-encrypted recovery backup. Keep this channel strictly private!',
        color: 0xf59e0b,
        fields: [
          {
            name: 'Key Fingerprint',
            value: `\`${params.fingerprintShort}\``,
            inline: true,
          },
          {
            name: 'Encrypted Backup JSON',
            value: `\`\`\`json\n${truncatedJson}\n\`\`\``,
            inline: false,
          },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'Certified Handmade · Encrypted Key Recovery' },
      },
    ],
  });
}

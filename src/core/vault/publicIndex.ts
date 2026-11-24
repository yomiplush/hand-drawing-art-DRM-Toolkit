import { base64UrlDecode } from '../crypto/sha256';
import { createSignedNostrEvent, type NostrEvent, verifyNostrEvent } from '../nostr/nip01';
import { validateRelayUrl, type WebSocketFactory, type WebSocketLike } from '../sync/relayManager';
import type { RelayConfig } from '../sync/types';
import type { VaultProofRecord } from './types';
import { verifyAndBuildVaultProofRecord } from './vaultStore';

export const CHM_PUBLIC_PROOF_EVENT_KIND = 30078;
export const CHM_PUBLIC_PROOF_PROTOCOL_ID = 'CHM-PUBLIC-PROOF-v1';
export const CHM_PUBLIC_PROOF_TAG = 'certified-handmade-proof';

export interface PublicProofWireContent {
  protocol: typeof CHM_PUBLIC_PROOF_PROTOCOL_ID;
  proofBase64Url: string;
  authorFingerprintHex: string;
  creationMethod?: string;
}

export function buildPublicProofIndexEvent(params: {
  proofRecord: VaultProofRecord;
  secretKey: Uint8Array;
  createdAtUnix?: number;
}): NostrEvent {
  const payload: PublicProofWireContent = {
    protocol: CHM_PUBLIC_PROOF_PROTOCOL_ID,
    proofBase64Url: params.proofRecord.proofBase64Url,
    authorFingerprintHex: params.proofRecord.authorFingerprintHex,
    creationMethod: params.proofRecord.creationMethod,
  };

  return createSignedNostrEvent(
    {
      kind: CHM_PUBLIC_PROOF_EVENT_KIND,
      created_at: params.createdAtUnix,
      tags: [
        ['d', `chm-proof:${params.proofRecord.id}`],
        ['t', CHM_PUBLIC_PROOF_TAG],
        ['chm_author', params.proofRecord.authorFingerprintHex],
      ],
      content: JSON.stringify(payload),
    },
    params.secretKey,
  );
}

export async function parseAndVerifyPublicProofEvent(
  rawEvent: unknown,
): Promise<{ record: VaultProofRecord; nostrEvent: NostrEvent }> {
  const verifiedEv = verifyNostrEvent(rawEvent, {
    expectedKind: CHM_PUBLIC_PROOF_EVENT_KIND,
    maxContentChars: 16_384,
  });
  if (!verifiedEv.valid) {
    throw new Error(verifiedEv.error);
  }

  const parsed = JSON.parse(verifiedEv.event.content) as Partial<PublicProofWireContent>;
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed) ||
    parsed.protocol !== CHM_PUBLIC_PROOF_PROTOCOL_ID ||
    typeof parsed.proofBase64Url !== 'string' ||
    parsed.proofBase64Url.length === 0 ||
    parsed.proofBase64Url.length > 8192
  ) {
    throw new Error('Invalid CHM public proof event payload');
  }

  const record = await verifyAndBuildVaultProofRecord({
    proofInput: base64UrlDecode(parsed.proofBase64Url),
    creationMethod:
      typeof parsed.creationMethod === 'string' ? parsed.creationMethod.slice(0, 64) : undefined,
    publicIndexOptIn: true,
  });

  return { record, nostrEvent: verifiedEv.event };
}

export async function queryPublicProofsFromRelays(params: {
  relays: RelayConfig[];
  authorFingerprintHex?: string;
  limit?: number;
  timeoutMs?: number;
  webSocketFactory?: WebSocketFactory;
  allowInsecureLocalWsForTest?: boolean;
}): Promise<{
  records: VaultProofRecord[];
  queriedRelays: number;
  rejectedCount: number;
}> {
  const readRelays = params.relays.filter(
    (r) => r.enabled && r.read && r.policyStatus !== 'payment-required',
  );
  if (readRelays.length === 0) {
    return { records: [], queriedRelays: 0, rejectedCount: 0 };
  }

  const wsFactory: WebSocketFactory =
    params.webSocketFactory ??
    ((url: string) => new globalThis.WebSocket(url) as unknown as WebSocketLike);
  const timeoutMs = params.timeoutMs ?? 5000;
  const limit = Math.max(1, Math.min(100, params.limit ?? 30));
  const rawEvents: unknown[] = [];

  await Promise.allSettled(
    readRelays.map(async (relay) => {
      const validUrl = validateRelayUrl(relay.url, {
        allowInsecureLocalWsForTest: params.allowInsecureLocalWsForTest,
      });
      await new Promise<void>((resolve) => {
        let ws: WebSocketLike | undefined;
        let settled = false;
        const subBytes = new Uint8Array(6);
        globalThis.crypto.getRandomValues(subBytes);
        const subId = `pub-${Array.from(subBytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;

        const finish = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          try {
            ws?.close();
          } catch {
            // ignore
          }
          resolve();
        };

        const timer = setTimeout(finish, timeoutMs);

        try {
          ws = wsFactory(validUrl);
        } catch {
          finish();
          return;
        }

        const onOpen = () => {
          const filter: Record<string, unknown> = {
            kinds: [CHM_PUBLIC_PROOF_EVENT_KIND],
            '#t': [CHM_PUBLIC_PROOF_TAG],
            limit,
          };
          ws?.send(JSON.stringify(['REQ', subId, filter]));
        };

        const onMessage = (evt: unknown) => {
          const data = (evt as { data?: unknown })?.data;
          if (typeof data !== 'string' || data.length > 131_072) return;
          try {
            const msg = JSON.parse(data) as unknown[];
            if (!Array.isArray(msg)) return;
            if (msg[0] === 'EVENT' && msg[1] === subId && msg[2]) {
              if (rawEvents.length < limit * readRelays.length) {
                rawEvents.push(msg[2]);
              }
            } else if ((msg[0] === 'EOSE' || msg[0] === 'CLOSED') && msg[1] === subId) {
              finish();
            }
          } catch {
            // Ignore malformed frame
          }
        };

        ws.addEventListener('open', onOpen);
        ws.addEventListener('message', onMessage);
        ws.addEventListener('error', finish);
        ws.addEventListener('close', finish);
      });
    }),
  );

  const fpFilter = params.authorFingerprintHex?.trim().toLowerCase();
  const dedup = new Map<string, VaultProofRecord>();
  let rejectedCount = 0;

  for (const raw of rawEvents) {
    try {
      const { record } = await parseAndVerifyPublicProofEvent(raw);
      if (fpFilter && !record.authorFingerprintHex.toLowerCase().startsWith(fpFilter)) {
        continue;
      }
      if (!dedup.has(record.id)) {
        dedup.set(record.id, record);
      }
    } catch {
      rejectedCount++;
    }
  }

  return {
    records: Array.from(dedup.values()).sort((a, b) => b.issuedAt - a.issuedAt),
    queriedRelays: readRelays.length,
    rejectedCount,
  };
}

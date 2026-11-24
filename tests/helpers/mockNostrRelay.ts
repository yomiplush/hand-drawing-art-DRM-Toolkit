import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import type { Duplex } from 'node:stream';
import os from 'node:os';
import path from 'node:path';
import { verifyNostrEvent } from '../../src/core/nostr/nip01';
import type { NostrEvent } from '../../src/core/nostr/nip01';
import { verifyNip42AuthEvent } from '../../src/core/nostr/nip42';

const WS_MAGIC_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export interface MockRelayOptions {
  tls?: boolean;
  requireAuth?: boolean;
  rejectConnections?: boolean;
  nip11Document?: Record<string, unknown>;
  rejectEventsWithReason?: string;
  rejectReqWithReason?: string;
}

interface ClientSession {
  socket: Duplex;
  buffer: Buffer;
  authenticated: boolean;
  authChallenge: string;
  subscriptions: Map<string, Record<string, unknown>[]>;
}

function encodeWsFrame(opcode: number, payload: Buffer): Buffer {
  const len = payload.length;
  let header: Buffer;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | opcode;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function matchesFilter(event: NostrEvent, filter: Record<string, unknown>): boolean {
  if (Array.isArray(filter.kinds) && !filter.kinds.includes(event.kind)) {
    return false;
  }
  if (Array.isArray(filter.authors) && !filter.authors.includes(event.pubkey)) {
    return false;
  }
  if (Array.isArray(filter.ids) && !filter.ids.includes(event.id)) {
    return false;
  }
  if (typeof filter.since === 'number' && event.created_at < filter.since) {
    return false;
  }
  if (typeof filter.until === 'number' && event.created_at > filter.until) {
    return false;
  }
  for (const [k, rawVals] of Object.entries(filter)) {
    if (k.startsWith('#') && k.length === 2 && Array.isArray(rawVals)) {
      const tagName = k.slice(1);
      const eventVals = event.tags.filter((t) => t[0] === tagName).map((t) => t[1]);
      if (!rawVals.some((v) => typeof v === 'string' && eventVals.includes(v))) {
        return false;
      }
    }
  }
  return true;
}

export class MockNostrRelay {
  private server: http.Server | https.Server | null = null;
  private tempCertDir: string | null = null;
  private clients = new Set<ClientSession>();
  private events: NostrEvent[] = [];
  private receivedAuthEvents: NostrEvent[] = [];

  public url = '';
  public readonly requireAuth: boolean;
  public rejectConnections: boolean;
  public withholdEventIds = new Set<string>();
  public reverseDeliveryOrder = false;
  public injectRawFramesOnReq: string[] = [];
  public acceptInvalidSignatures = false;
  public nip11Document: Record<string, unknown>;
  public rejectEventsWithReason: string | null;
  public rejectReqWithReason: string | null;

  constructor(private readonly options: MockRelayOptions = {}) {
    this.requireAuth = Boolean(options.requireAuth);
    this.rejectConnections = Boolean(options.rejectConnections);
    this.nip11Document = options.nip11Document ?? {
      name: 'CHM Mock Free Relay',
      supported_nips: [1, 11, 42, 59],
      limitation: {
        payment_required: false,
        restricted_writes: false,
        max_message_length: 131_072,
      },
    };
    this.rejectEventsWithReason = options.rejectEventsWithReason ?? null;
    this.rejectReqWithReason = options.rejectReqWithReason ?? null;
  }

  async start(): Promise<string> {
    if (this.server) return this.url;

    const handler = (req: http.IncomingMessage, res: http.ServerResponse) => {
      const accept = String(req.headers.accept ?? '');
      if (accept.includes('application/nostr+json')) {
        res.writeHead(200, {
          'Content-Type': 'application/nostr+json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify(this.nip11Document));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('CHM Mock Nostr Relay');
    };

    if (this.options.tls) {
      this.tempCertDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chm-mock-relay-'));
      const keyPath = path.join(this.tempCertDir, 'key.pem');
      const certPath = path.join(this.tempCertDir, 'cert.pem');
      execFileSync(
        'openssl',
        [
          'req',
          '-x509',
          '-newkey',
          'ec',
          '-pkeyopt',
          'ec_paramgen_curve:prime256v1',
          '-keyout',
          keyPath,
          '-out',
          certPath,
          '-days',
          '1',
          '-nodes',
          '-subj',
          '/CN=127.0.0.1',
          '-addext',
          'subjectAltName=IP:127.0.0.1,DNS:localhost',
        ],
        { stdio: 'pipe' },
      );
      const key = fs.readFileSync(keyPath);
      const cert = fs.readFileSync(certPath);
      this.server = https.createServer({ key, cert }, handler);
    } else {
      this.server = http.createServer(handler);
    }

    this.server.on('upgrade', (req, socket) => {
      this.handleUpgrade(req, socket);
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(0, '127.0.0.1', () => {
        const addr = this.server!.address();
        if (!addr || typeof addr === 'string') {
          reject(new Error('Failed to bind mock relay'));
          return;
        }
        const proto = this.options.tls ? 'wss' : 'ws';
        this.url = `${proto}://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    return this.url;
  }

  async stop(): Promise<void> {
    for (const c of this.clients) {
      try {
        c.socket.destroy();
      } catch {
        // ignore
      }
    }
    this.clients.clear();

    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.server = null;
    }
    if (this.tempCertDir) {
      fs.rmSync(this.tempCertDir, { recursive: true, force: true });
      this.tempCertDir = null;
    }
  }

  getStoredEvents(): NostrEvent[] {
    return [...this.events];
  }

  getReceivedAuthEvents(): NostrEvent[] {
    return [...this.receivedAuthEvents];
  }

  getActiveClientCount(): number {
    return this.clients.size;
  }

  clearEvents(): void {
    this.events = [];
  }

  injectEventDirect(ev: NostrEvent): void {
    this.events.push(ev);
  }

  private sendText(client: ClientSession, data: string): void {
    if (client.socket.destroyed) return;
    const frame = encodeWsFrame(0x1, Buffer.from(data, 'utf8'));
    client.socket.write(frame);
  }

  private sendJson(client: ClientSession, payload: unknown[]): void {
    this.sendText(client, JSON.stringify(payload));
  }

  private handleUpgrade(req: http.IncomingMessage, socket: Duplex): void {
    if (this.rejectConnections) {
      socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    const key = req.headers['sec-websocket-key'];
    if (typeof key !== 'string') {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }
    const accept = crypto
      .createHash('sha1')
      .update(key + WS_MAGIC_GUID)
      .digest('base64');

    socket.write(
      [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${accept}`,
        '',
        '',
      ].join('\r\n'),
    );

    const client: ClientSession = {
      socket,
      buffer: Buffer.alloc(0),
      authenticated: !this.requireAuth,
      authChallenge: crypto.randomBytes(16).toString('hex'),
      subscriptions: new Map(),
    };
    this.clients.add(client);

    socket.on('data', (chunk: Buffer) => {
      client.buffer = Buffer.concat([client.buffer, chunk]);
      this.drainFrames(client);
    });
    socket.on('close', () => {
      this.clients.delete(client);
    });
    socket.on('error', () => {
      this.clients.delete(client);
    });

    if (this.requireAuth) {
      this.sendJson(client, ['AUTH', client.authChallenge]);
    }
  }

  private drainFrames(client: ClientSession): void {
    while (client.buffer.length >= 2) {
      const b0 = client.buffer[0];
      const b1 = client.buffer[1];
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let payloadLen = b1 & 0x7f;
      let offset = 2;

      if (payloadLen === 126) {
        if (client.buffer.length < 4) return;
        payloadLen = client.buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        if (client.buffer.length < 10) return;
        payloadLen = Number(client.buffer.readBigUInt64BE(2));
        offset = 10;
      }

      const maskBytes = masked ? 4 : 0;
      if (client.buffer.length < offset + maskBytes + payloadLen) return;

      let maskKey: Buffer | null = null;
      if (masked) {
        maskKey = client.buffer.subarray(offset, offset + 4);
        offset += 4;
      }

      const payload = Buffer.from(client.buffer.subarray(offset, offset + payloadLen));
      if (maskKey) {
        for (let i = 0; i < payload.length; i++) {
          payload[i] ^= maskKey[i % 4];
        }
      }

      client.buffer = client.buffer.subarray(offset + payloadLen);

      if (opcode === 0x8) {
        // Close
        try {
          client.socket.write(encodeWsFrame(0x8, Buffer.alloc(0)));
          client.socket.end();
        } catch {
          // ignore
        }
        return;
      }
      if (opcode === 0x9) {
        // Ping -> Pong
        client.socket.write(encodeWsFrame(0x0a, payload));
        continue;
      }
      if (opcode === 0x1 || opcode === 0x0) {
        this.handleClientMessage(client, payload.toString('utf8'));
      }
    }
  }

  private handleClientMessage(client: ClientSession, rawText: string): void {
    let msg: unknown;
    try {
      msg = JSON.parse(rawText);
    } catch {
      this.sendJson(client, ['NOTICE', 'Invalid JSON frame']);
      return;
    }
    if (!Array.isArray(msg) || msg.length < 2) {
      this.sendJson(client, ['NOTICE', 'Malformed NIP-01 frame']);
      return;
    }

    const type = msg[0];
    if (type === 'AUTH') {
      const rawEv = msg[1];
      const verified = verifyNip42AuthEvent({
        rawEvent: rawEv,
        expectedRelayUrl: this.url,
        expectedChallenge: client.authChallenge,
      });
      if (!verified.valid) {
        const id =
          rawEv && typeof rawEv === 'object' && 'id' in rawEv ? String((rawEv as { id: unknown }).id) : '';
        this.sendJson(client, ['OK', id, false, `invalid: ${verified.error}`]);
        return;
      }
      client.authenticated = true;
      this.receivedAuthEvents.push(verified.event);
      this.sendJson(client, ['OK', verified.event.id, true, '']);
      return;
    }

    if (type === 'EVENT') {
      const rawEv = msg[1];
      const rawEvId =
        rawEv && typeof rawEv === 'object' && 'id' in rawEv ? String((rawEv as { id: unknown }).id) : '';
      if (this.rejectEventsWithReason) {
        this.sendJson(client, ['OK', rawEvId, false, this.rejectEventsWithReason]);
        return;
      }
      if (!client.authenticated) {
        const id =
          rawEv && typeof rawEv === 'object' && 'id' in rawEv ? String((rawEv as { id: unknown }).id) : '';
        this.sendJson(client, ['OK', id, false, 'auth-required: authenticate with NIP-42 first']);
        return;
      }
      if (this.acceptInvalidSignatures && rawEv && typeof rawEv === 'object') {
        const ev = rawEv as NostrEvent;
        this.events.push(ev);
        this.sendJson(client, ['OK', ev.id, true, '']);
        return;
      }
      const verified = verifyNostrEvent(rawEv);
      if (!verified.valid) {
        const id =
          rawEv && typeof rawEv === 'object' && 'id' in rawEv ? String((rawEv as { id: unknown }).id) : '';
        this.sendJson(client, ['OK', id, false, `invalid: ${verified.error}`]);
        return;
      }
      if (!this.events.some((e) => e.id === verified.event.id)) {
        this.events.push(verified.event);
      }
      this.sendJson(client, ['OK', verified.event.id, true, '']);
      return;
    }

    if (type === 'REQ') {
      const subId = typeof msg[1] === 'string' ? msg[1] : '';
      if (this.rejectReqWithReason) {
        this.sendJson(client, ['CLOSED', subId, this.rejectReqWithReason]);
        return;
      }
      if (!client.authenticated) {
        this.sendJson(client, ['CLOSED', subId, 'auth-required: authenticate with NIP-42 first']);
        return;
      }
      const filters = msg
        .slice(2)
        .filter((f): f is Record<string, unknown> => Boolean(f && typeof f === 'object'));
      client.subscriptions.set(subId, filters);

      for (const rawInjected of this.injectRawFramesOnReq) {
        const expanded = rawInjected.replace(/__SUB_ID__/g, subId);
        this.sendText(client, expanded);
      }

      const matched = new Map<string, NostrEvent>();
      for (const ev of this.events) {
        if (this.withholdEventIds.has(ev.id)) continue;
        if (filters.length === 0 || filters.some((f) => matchesFilter(ev, f))) {
          matched.set(ev.id, ev);
        }
      }

      let delivery = Array.from(matched.values());
      if (this.reverseDeliveryOrder) {
        delivery = delivery.reverse();
      }

      for (const ev of delivery) {
        this.sendJson(client, ['EVENT', subId, ev]);
      }
      this.sendJson(client, ['EOSE', subId]);
      return;
    }

    if (type === 'CLOSE') {
      const subId = typeof msg[1] === 'string' ? msg[1] : '';
      client.subscriptions.delete(subId);
    }
  }
}

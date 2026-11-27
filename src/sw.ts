/// <reference types="vite/client" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import type { PrecacheEntry } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

interface SwGlobalScope {
  __WB_MANIFEST: Array<PrecacheEntry | string>;
  skipWaiting(): Promise<void>;
  clients: {
    claim(): Promise<void>;
  };
  addEventListener(type: 'message', listener: (event: SwMessageEvent) => void): void;
  addEventListener(type: 'activate', listener: (event: SwExtendableEvent) => void): void;
  addEventListener(type: 'fetch', listener: (event: SwFetchEvent) => void): void;
}

interface SwExtendableEvent extends Event {
  waitUntil(promise: Promise<unknown>): void;
}

interface SwMessageEvent extends SwExtendableEvent {
  data?: { type?: string } | null;
}

interface SwFetchEvent extends SwExtendableEvent {
  request: Request;
  respondWith(response: Response | Promise<Response>): void;
}

const SHARE_TARGET_CACHE_NAME = 'chm-share-target-v1';
const SHARE_TARGET_CACHE_KEY = '/__shared-artwork__';

cleanupOutdatedCaches();
precacheAndRoute((self as unknown as SwGlobalScope).__WB_MANIFEST);
void (self as unknown as SwGlobalScope).skipWaiting();

registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/assets\//],
  }),
);

(self as unknown as SwGlobalScope).addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void (self as unknown as SwGlobalScope).skipWaiting();
  }
});

(self as unknown as SwGlobalScope).addEventListener('activate', (event) => {
  event.waitUntil((self as unknown as SwGlobalScope).clients.claim());
});

function extractProofFragment(formData: FormData): string {
  const candidates = [formData.get('url'), formData.get('text'), formData.get('title')];
  for (const val of candidates) {
    if (typeof val !== 'string') continue;
    const match = val.match(/#?proof=([A-Za-z0-9_-]+)/);
    if (match && match[1]) {
      return `#proof=${match[1]}`;
    }
  }
  return '';
}

function findSharedImageFile(formData: FormData): File | null {
  const primary = formData.get('image');
  if (primary instanceof File && primary.size > 0) {
    return primary;
  }
  for (const value of formData.values()) {
    if (value instanceof File && value.size > 0) {
      return value;
    }
  }
  return null;
}

(self as unknown as SwGlobalScope).addEventListener('fetch', (event) => {
  const reqUrl = new URL(event.request.url);
  if (
    event.request.method === 'POST' &&
    reqUrl.origin === self.location.origin &&
    reqUrl.pathname === '/share-target'
  ) {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const imageFile = findSharedImageFile(formData);
          const proofHash = extractProofFragment(formData);

          if (imageFile) {
            const cache = await caches.open(SHARE_TARGET_CACHE_NAME);
            const encodedName = encodeURIComponent(imageFile.name || 'shared-artwork.png');
            await cache.put(
              SHARE_TARGET_CACHE_KEY,
              new Response(imageFile, {
                headers: {
                  'Content-Type': imageFile.type || 'image/png',
                  'X-Shared-Filename': encodedName,
                },
              }),
            );
            return Response.redirect(`/verify?shared=1${proofHash}`, 303);
          }

          return Response.redirect(`/verify${proofHash}`, 303);
        } catch {
          return Response.redirect('/verify', 303);
        }
      })(),
    );
  }
});

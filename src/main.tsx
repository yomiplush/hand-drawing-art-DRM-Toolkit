import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { buildCanonicalRedirectUrl } from './core/google/config';
import './index.css';

const APEX_CLEANUP_TIMEOUT_MS = 1500;

async function leaveApexForCanonicalOrigin(canonicalUrl: string): Promise<void> {
  const cleanup = (async () => {
    if (!('serviceWorker' in navigator)) return;
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  })();

  await Promise.race([
    cleanup.catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, APEX_CLEANUP_TIMEOUT_MS)),
  ]);

  window.location.replace(canonicalUrl);
}

const canonicalUrl = buildCanonicalRedirectUrl(window.location.href);

if (canonicalUrl) {
  void leaveApexForCanonicalOrigin(canonicalUrl);
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

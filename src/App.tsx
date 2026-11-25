import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { CookieConsentBanner } from './components/CookieConsentBanner';
import { Layout } from './components/Layout';
import { PreferencesProvider } from './components/PreferencesContext';
import { Ps3WaveBackground } from './components/Ps3WaveBackground';
import { SeoHead } from './components/SeoHead';
import {
  getConsentStatus,
  resetConsentStatus,
  setConsentStatus,
} from './core/storage/consent';
import type { ConsentStatus } from './core/storage/consent';
import { I18nProvider } from './i18n';
import { useI18n } from './i18n/context';
import { HomePage } from './pages/HomePage';

const CreateCertificatePage = lazy(() =>
  import('./pages/CreateCertificatePage').then((m) => ({ default: m.CreateCertificatePage })),
);
const VerifyCertificatePage = lazy(() =>
  import('./pages/VerifyCertificatePage').then((m) => ({ default: m.VerifyCertificatePage })),
);
const KeysPage = lazy(() => import('./pages/KeysPage').then((m) => ({ default: m.KeysPage })));
const DevicesPage = lazy(() =>
  import('./pages/DevicesPage').then((m) => ({ default: m.DevicesPage })),
);
const VaultPage = lazy(() => import('./pages/VaultPage').then((m) => ({ default: m.VaultPage })));
const ExchangePage = lazy(() =>
  import('./pages/ExchangePage').then((m) => ({ default: m.ExchangePage })),
);
const DocsPage = lazy(() => import('./pages/DocsPage').then((m) => ({ default: m.DocsPage })));
const TutorialPage = lazy(() =>
  import('./pages/TutorialPage').then((m) => ({ default: m.TutorialPage })),
);
const PrivacyPolicyPage = lazy(() =>
  import('./pages/PrivacyPolicyPage').then((m) => ({ default: m.PrivacyPolicyPage })),
);

function RouteLoadingFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto max-w-xl py-16 text-center ga-text-muted text-sm"
    >
      <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-[var(--ga-border-strong)] border-t-[var(--ga-accent)]" />
      <span>Loading…</span>
    </div>
  );
}

function AppRoutes() {
  const location = useLocation();
  const { locale } = useI18n();

  const [offlineReady, setOfflineReady] = useState(false);
  const [needRefresh, setNeedRefresh] = useState(false);
  const updateSwRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);

  const [consentStatus, setConsentState] = useState<ConsentStatus>(() => getConsentStatus());
  const [bannerOpen, setBannerOpen] = useState<boolean>(() => getConsentStatus() === 'unset');

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    updateSwRef.current = registerSW({
      immediate: true,
      onOfflineReady() {
        setOfflineReady(true);
      },
      onNeedRefresh() {
        setNeedRefresh(true);
      },
    });
  }, []);

  useEffect(() => {
    if (location.hash.toLowerCase() === '#privacypolicy') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [location.pathname, location.hash]);

  const handleUpdateSw = () => {
    if (updateSwRef.current) {
      void updateSwRef.current(true);
    }
  };

  const handleAcceptConsent = () => {
    setConsentStatus('accepted', locale);
    setConsentState('accepted');
    setBannerOpen(false);
  };

  const handleRejectConsent = () => {
    setConsentStatus('rejected');
    setConsentState('rejected');
    setBannerOpen(false);
  };

  const handleResetConsent = () => {
    resetConsentStatus();
    setConsentState('unset');
    setBannerOpen(true);
  };

  const privacyElement = (
    <PrivacyPolicyPage
      consentStatus={consentStatus}
      onAcceptConsent={handleAcceptConsent}
      onRejectConsent={handleRejectConsent}
      onResetConsent={handleResetConsent}
      onOpenBanner={() => setBannerOpen(true)}
    />
  );

  const isHashPrivacyRoute = location.hash.toLowerCase() === '#privacypolicy';

  return (
    <>
      <SeoHead />
      <Ps3WaveBackground />

      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route
            element={
              <Layout
                offlineReady={offlineReady}
                needRefresh={needRefresh}
                onUpdateSw={handleUpdateSw}
                onOpenCookieSettings={() => setBannerOpen(true)}
                bannerOpen={bannerOpen}
              />
            }
          >
            <Route path="/" element={isHashPrivacyRoute ? privacyElement : <HomePage />} />
            <Route path="/privacypolicy" element={privacyElement} />
            <Route path="/tutorial" element={<TutorialPage />} />
            <Route path="/create" element={<CreateCertificatePage />} />
            <Route path="/qr-studio" element={<Navigate to="/create?mode=studio" replace />} />
            <Route path="/verify" element={<VerifyCertificatePage />} />
            <Route path="/keys" element={<KeysPage />} />
            <Route path="/devices" element={<DevicesPage />} />
            <Route path="/vault" element={<VaultPage />} />
            <Route path="/storage" element={<VaultPage focusStorage />} />
            <Route path="/exchange" element={<ExchangePage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>

      <CookieConsentBanner
        open={bannerOpen}
        status={consentStatus}
        onAccept={handleAcceptConsent}
        onReject={handleRejectConsent}
        onClose={() => setBannerOpen(false)}
      />
    </>
  );
}

export function App() {
  return (
    <I18nProvider>
      <PreferencesProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </PreferencesProvider>
    </I18nProvider>
  );
}

export default App;

import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { CookieConsentBanner } from './components/CookieConsentBanner';
import { Layout } from './components/Layout';
import { Ps3WaveBackground } from './components/Ps3WaveBackground';
import {
  getConsentStatus,
  resetConsentStatus,
  setConsentStatus,
} from './core/storage/consent';
import type { ConsentStatus } from './core/storage/consent';
import { I18nProvider } from './i18n';
import { useI18n } from './i18n/context';
import { CreateCertificatePage } from './pages/CreateCertificatePage';
import { DocsPage } from './pages/DocsPage';
import { HomePage } from './pages/HomePage';
import { KeysPage } from './pages/KeysPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { TutorialPage } from './pages/TutorialPage';
import { VerifyCertificatePage } from './pages/VerifyCertificatePage';

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
      <Ps3WaveBackground />

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
          <Route path="/verify" element={<VerifyCertificatePage />} />
          <Route path="/keys" element={<KeysPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>

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
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </I18nProvider>
  );
}

export default App;

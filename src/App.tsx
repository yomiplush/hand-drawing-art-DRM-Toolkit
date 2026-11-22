import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { Layout } from './components/Layout';
import { I18nProvider } from './i18n';
import { CreateCertificatePage } from './pages/CreateCertificatePage';
import { DocsPage } from './pages/DocsPage';
import { HomePage } from './pages/HomePage';
import { KeysPage } from './pages/KeysPage';
import { VerifyCertificatePage } from './pages/VerifyCertificatePage';

export function App() {
  const [offlineReady, setOfflineReady] = useState(false);
  const [needRefresh, setNeedRefresh] = useState(false);
  const updateSwRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);

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

  const handleUpdateSw = () => {
    if (updateSwRef.current) {
      void updateSwRef.current(true);
    }
  };

  return (
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route
            element={
              <Layout
                offlineReady={offlineReady}
                needRefresh={needRefresh}
                onUpdateSw={handleUpdateSw}
              />
            }
          >
            <Route path="/" element={<HomePage />} />
            <Route path="/create" element={<CreateCertificatePage />} />
            <Route path="/verify" element={<VerifyCertificatePage />} />
            <Route path="/keys" element={<KeysPage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  );
}

export default App;

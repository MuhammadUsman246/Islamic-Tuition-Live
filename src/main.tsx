import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.tsx';
import { runFirebaseDiagnostic } from './firebase/diagnostic.ts';
import './index.css';

// Run Firebase diagnostic on boot
runFirebaseDiagnostic().catch(console.error);

// Dev Previewer Safety: Unregister any stale Service Worker in development to prevent blank preview screens
if (import.meta.env.DEV && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister().catch(() => {});
    }
  }).catch(() => {});
}

// Production PWA Service Worker Registration
if (import.meta.env.PROD && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({
      immediate: true,
      onNeedRefresh() {
        console.log('New portal update available');
      },
      onOfflineReady() {
        console.log('Portal ready for offline usage');
      },
    });
  }).catch(() => {});
}

// Global runtime error handlers to catch unhandled errors cleanly
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.warn('Unhandled Promise Rejection caught safely:', event.reason);
  });
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
}

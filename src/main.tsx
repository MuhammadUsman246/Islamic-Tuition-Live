import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.tsx';
import { runFirebaseDiagnostic } from './firebase/diagnostic.ts';
import './index.css';

// Run Firebase diagnostic on boot
runFirebaseDiagnostic().catch(console.error);

// Automatically register and update the PWA service worker smoothly
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('New content available, auto-updating portal in background...');
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);


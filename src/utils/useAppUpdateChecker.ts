import { useState, useEffect, useCallback, useRef } from 'react';

interface VersionResponse {
  status: string;
  version: string;
  bootTime: number;
  timestamp: number;
}

export function useAppUpdateChecker() {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState<boolean>(false);
  const [newVersion, setNewVersion] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const initialBootTimeRef = useRef<number | null>(null);
  const isCheckingRef = useRef<boolean>(false);

  const checkForUpdate = useCallback(async () => {
    if (isCheckingRef.current || typeof window === 'undefined') return;
    isCheckingRef.current = true;

    try {
      const res = await fetch(`/api/version?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (res.ok) {
        const data: VersionResponse = await res.json();
        if (data && typeof data.bootTime === 'number') {
          if (initialBootTimeRef.current === null) {
            initialBootTimeRef.current = data.bootTime;
          } else if (data.bootTime > initialBootTimeRef.current) {
            setIsUpdateAvailable(true);
            setNewVersion(data.version || 'New Update');
          }
        }
      }
    } catch {
      // Non-fatal if offline
    } finally {
      isCheckingRef.current = false;
    }
  }, []);

  useEffect(() => {
    // Initial check
    checkForUpdate();

    // Check periodically every 25 seconds
    const interval = setInterval(checkForUpdate, 25000);

    // Also check when tab becomes active / gains focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdate();
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    // Listen to ServiceWorker updates if PWA is registered
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setIsUpdateAvailable(true);
      });
    }

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [checkForUpdate]);

  const applyUpdate = useCallback(() => {
    setIsUpdating(true);
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }
    // Instant reload from local cache - takes < 500ms and consumes 0 Firestore reads!
    setTimeout(() => {
      window.location.reload();
    }, 150);
  }, []);

  const dismissUpdate = useCallback(() => {
    setIsUpdateAvailable(false);
  }, []);

  return {
    isUpdateAvailable,
    newVersion,
    isUpdating,
    applyUpdate,
    dismissUpdate,
    checkForUpdate
  };
}

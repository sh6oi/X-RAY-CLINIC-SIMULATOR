import {useCallback, useEffect, useRef, useState} from 'react';

interface RemoteVersionPayload {
  version?: string;
  builtAt?: string;
}

export type UpdateCheckOutcome = 'update' | 'up-to-date' | 'error';

export interface AppUpdateState {
  currentVersion: string;
  currentBuiltAt: string;
  remoteVersion: string | null;
  remoteBuiltAt: string | null;
  updateAvailable: boolean;
  isBannerVisible: boolean;
  checking: boolean;
  lastCheckedAt: number | null;
  lastOutcome: UpdateCheckOutcome | null;
  checkForUpdates: (manual?: boolean) => Promise<UpdateCheckOutcome>;
  applyUpdate: () => Promise<void>;
  dismissBanner: () => void;
}

const CHECK_INTERVAL_MS = 45_000;
const INITIAL_DELAY_MS = 1_500;
const MIN_FOCUS_INTERVAL_MS = 10_000;

export function useAppUpdate(): AppUpdateState {
  const currentVersion =
    typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
  const currentBuiltAt =
    typeof __APP_BUILT_AT__ === 'string' ? __APP_BUILT_AT__ : '';

  const [remoteVersion, setRemoteVersion] = useState<string | null>(null);
  const [remoteBuiltAt, setRemoteBuiltAt] = useState<string | null>(null);
  const [checking, setChecking] = useState<boolean>(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [lastOutcome, setLastOutcome] = useState<UpdateCheckOutcome | null>(
    null
  );

  const lastFetchTimestampRef = useRef<number>(0);
  const checkingRef = useRef<boolean>(false);

  const checkForUpdates = useCallback(
    async (_manual = false): Promise<UpdateCheckOutcome> => {
      if (checkingRef.current) {
        return remoteVersion && remoteVersion !== currentVersion
          ? 'update'
          : 'up-to-date';
      }

      checkingRef.current = true;
      setChecking(true);

      try {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker
            .getRegistrations()
            .then((regs) => Promise.all(regs.map((r) => r.update())))
            .catch(() => {});
        }

        const res = await fetch(`./version.json?t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
          },
        });

        if (!res.ok) {
          setLastOutcome('error');
          return 'error';
        }

        const data = (await res.json()) as RemoteVersionPayload;
        const serverVer =
          typeof data?.version === 'string' ? data.version.trim() : '';

        if (!serverVer) {
          setLastOutcome('error');
          return 'error';
        }

        const now = Date.now();
        lastFetchTimestampRef.current = now;
        setLastCheckedAt(now);
        setRemoteVersion(serverVer);
        setRemoteBuiltAt(
          typeof data.builtAt === 'string' ? data.builtAt : null
        );

        if (serverVer !== currentVersion) {
          setLastOutcome('update');
          return 'update';
        }

        setLastOutcome('up-to-date');
        return 'up-to-date';
      } catch {
        setLastOutcome('error');
        return 'error';
      } finally {
        checkingRef.current = false;
        setChecking(false);
      }
    },
    [currentVersion, remoteVersion]
  );

  const applyUpdate = useCallback(async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.unregister()));
      }
    } catch {
      // Ignore service worker unregister errors
    }

    try {
      if ('caches' in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((key) => window.caches.delete(key)));
      }
    } catch {
      // Ignore CacheStorage errors
    }

    try {
      await fetch(window.location.href, {cache: 'reload'});
    } catch {
      // Ignore prefetch errors
    }

    window.location.reload();
  }, []);

  const dismissBanner = useCallback(() => {
    // Updates are mandatory and cannot be dismissed.
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      if (document.visibilityState === 'visible') {
        void checkForUpdates(false);
      }
    }, INITIAL_DELAY_MS);

    const pollTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void checkForUpdates(false);
      }
    }, CHECK_INTERVAL_MS);

    const handleVisibilityOrOnline = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastFetchTimestampRef.current >= MIN_FOCUS_INTERVAL_MS) {
        void checkForUpdates(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrOnline);
    window.addEventListener('online', handleVisibilityOrOnline);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', handleVisibilityOrOnline);
      window.removeEventListener('online', handleVisibilityOrOnline);
    };
  }, [checkForUpdates]);

  const updateAvailable =
    remoteVersion !== null && remoteVersion !== currentVersion;
  const isBannerVisible = updateAvailable;

  return {
    currentVersion,
    currentBuiltAt,
    remoteVersion,
    remoteBuiltAt,
    updateAvailable,
    isBannerVisible,
    checking,
    lastCheckedAt,
    lastOutcome,
    checkForUpdates,
    applyUpdate,
    dismissBanner,
  };
}

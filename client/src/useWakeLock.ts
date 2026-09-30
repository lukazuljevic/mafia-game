import { useEffect } from 'react';

// Keeps the phone screen on while a game is open, so the socket isn't dropped by the device sleeping.
export function useWakeLock(active = true) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) {
          lock.release();
        } else {
          sentinel = lock;
        }
      } catch {
        // Denied (e.g. battery saver); the game still works without it.
      }
    };

    // The browser drops the lock whenever the tab is hidden.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') request();
    };

    request();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      sentinel?.release().catch(() => {});
    };
  }, [active]);
}

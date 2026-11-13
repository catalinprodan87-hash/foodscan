import { useEffect, useState } from 'react';
import { subscribeInstall } from './installPrompt.js';
import { onNeedRefresh } from './pwa.js';

export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

export function useInstallPrompt() {
  const [state, setState] = useState({ canInstall: false, installed: false });
  useEffect(() => subscribeInstall(setState), []);
  return state;
}

export function useNeedRefresh() {
  const [need, setNeed] = useState(false);
  useEffect(() => onNeedRefresh(setNeed), []);
  return need;
}

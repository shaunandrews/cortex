import { useState, useEffect, useCallback, useMemo } from 'react';

type Preference = 'system' | 'dark' | 'light';
type ResolvedTheme = 'dark' | 'light';

const STORAGE_KEY = 'cortex_color_scheme';

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readPreference(): Preference {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light' || stored === 'system') {
    return stored;
  }
  return 'system';
}

export function useColorScheme() {
  const [preference, setPreferenceState] = useState<Preference>(readPreference);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);

  // Watch system preference changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const resolvedTheme: ResolvedTheme = preference === 'system' ? systemTheme : preference;

  // Set color-scheme on <html> so scrollbars/form controls match
  useEffect(() => {
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const setPreference = useCallback((pref: Preference) => {
    localStorage.setItem(STORAGE_KEY, pref);
    setPreferenceState(pref);
  }, []);

  const themeColors = useMemo(
    () =>
      resolvedTheme === 'dark'
        ? { bg: '#1e1e1e', primary: '#3858e9' }
        : { bg: '#fcfcfc', primary: '#3858e9' },
    [resolvedTheme],
  );

  return { preference, resolvedTheme, setPreference, themeColors };
}

// Copyright (c) 2026 SCTG Development - Ronan Le Meillat (MIT License)
// See the LICENSE file in the project root.

import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.setAttribute('data-theme', theme);
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  useEffect(() => { apply(theme); }, [theme]);
  const toggle = useCallback(() => {
    setTheme((t) => {
      const next: Theme = t === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('theme', next); } catch { /* ignore */ }
      return next;
    });
  }, []);
  return [theme, toggle];
}

import { useEffect, useSyncExternalStore } from 'react';
import { THEMES, useThemeStore, type Theme } from '@/store/theme';

function useHydrated(): boolean {
  return useSyncExternalStore(
    (cb) => useThemeStore.persist.onFinishHydration(cb),
    () => useThemeStore.persist.hasHydrated(),
    () => false,
  );
}

/**
 * The current KubeNest theme + setter. Keeps `<html data-theme>` in sync with the
 * persisted store once hydrated (the bootstrap script in app/layout.tsx handles
 * the very first paint to avoid a flash on dark themes).
 */
export function useTheme() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const hydrated = useHydrated();

  useEffect(() => {
    if (hydrated) document.documentElement.dataset.theme = theme;
  }, [theme, hydrated]);

  return { theme, setTheme, hydrated, themes: THEMES as { value: Theme; label: string; hint: string }[] };
}

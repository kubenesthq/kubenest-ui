import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'mc' | 'blueprint';

export const THEMES: { value: Theme; label: string; hint: string }[] = [
  { value: 'light', label: 'Light', hint: 'Operational, Linear/Vercel-ish' },
  { value: 'mc', label: 'Mission Control', hint: 'True dark, electric blue + lime' },
  { value: 'blueprint', label: 'Blueprint', hint: 'Navy + cyan, architectural' },
];

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'kn-theme' }, // must match the bootstrap script in app/layout.tsx
  ),
);

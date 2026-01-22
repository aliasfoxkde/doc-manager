import { create } from 'zustand';

interface ThemeState {
  theme: 'dark' | 'light' | 'system';
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  resolvedTheme: 'dark' | 'light';
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: (localStorage.getItem('doc-manager-theme') as 'dark' | 'light' | 'system') || 'system',
  setTheme: (theme) => {
    localStorage.setItem('doc-manager-theme', theme);
    set({ theme });
  },
  resolvedTheme: (() => {
    const stored = localStorage.getItem('doc-manager-theme') || 'system';
    if (stored === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return stored as 'dark' | 'light';
  })()
}));

import { create } from 'zustand';

interface ThemeState {
  theme: 'dark' | 'light' | 'system';
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  resolvedTheme: 'dark' | 'light';
  initializeThemeListener: () => () => void;
}

const getResolvedTheme = (theme: 'dark' | 'light' | 'system'): 'dark' | 'light' => {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
};

const applyTheme = (theme: 'dark' | 'light') => {
  document.documentElement.setAttribute('data-theme', theme);
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: (localStorage.getItem('doc-manager-theme') as 'dark' | 'light' | 'system') || 'system',
  resolvedTheme: getResolvedTheme(
    (localStorage.getItem('doc-manager-theme') as 'dark' | 'light' | 'system') || 'system'
  ),

  setTheme: (theme) => {
    localStorage.setItem('doc-manager-theme', theme);
    const resolved = getResolvedTheme(theme);
    set({ theme, resolvedTheme: resolved });
    applyTheme(resolved);
  },

  initializeThemeListener: () => {
    // Apply initial theme
    const { theme, resolvedTheme } = get();
    applyTheme(resolvedTheme);

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      const currentTheme = get().theme;
      if (currentTheme === 'system') {
        const resolved = e.matches ? 'dark' : 'light';
        set({ resolvedTheme: resolved });
        applyTheme(resolved);
      }
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    // Legacy support
    else {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }
}));

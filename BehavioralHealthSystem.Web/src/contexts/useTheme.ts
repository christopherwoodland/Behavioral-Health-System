import { useContext } from 'react';
import { ThemeContext } from './ThemeContext';
import type { ThemeContextType } from './ThemeContext';

// Hook to use the theme context (kept in its own module so ThemeContext.tsx only exports components)
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

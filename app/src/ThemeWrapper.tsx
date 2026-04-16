import type { ReactNode } from 'react';
import { ThemeProvider } from '@wp-internal/theme-provider';
import { useColorScheme } from './hooks/useColorScheme';

export function ThemeWrapper({ children }: { children: ReactNode }) {
  const { themeColors } = useColorScheme();

  return (
    <ThemeProvider color={themeColors} isRoot>
      {children}
    </ThemeProvider>
  );
}

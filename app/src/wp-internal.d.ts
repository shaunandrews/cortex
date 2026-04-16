declare module '@wp-internal/theme-provider' {
  import type { ReactNode } from 'react';

  export const ThemeProvider: React.FC<{
    children: ReactNode;
    color?: { primary?: string; bg?: string };
    density?: 'default' | 'compact' | 'comfortable';
    cursor?: { control?: 'default' | 'pointer' };
    isRoot?: boolean;
  }>;
}

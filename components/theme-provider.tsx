'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="llm"
      themes={['llm', 'human']}
      enableSystem={false}
      storageKey="track0-mode"
    >
      {children}
    </NextThemesProvider>
  );
}

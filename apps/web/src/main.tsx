import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from './auth/AuthContext';
import { App } from './App';
import { PrintPage, readPrintPageHandoff } from './PrintPage';
import { sweepExpiredPrintHandoffs } from './workspace/printHandoff';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

const root = createRoot(container);
try {
  sweepExpiredPrintHandoffs(window.localStorage);
} catch {
  // Storage can be unavailable in restricted browser contexts.
}
const themeProviderProps = {
  attribute: 'class' as const,
  defaultTheme: 'system',
  enableSystem: true,
  disableTransitionOnChange: true,
};

if (window.location.pathname === '/print') {
  const handoff = readPrintPageHandoff();
  root.render(
    <ThemeProvider {...themeProviderProps}>
      <PrintPage handoff={handoff} />
    </ThemeProvider>,
  );
} else {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, refetchOnWindowFocus: false },
    },
  });

  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider {...themeProviderProps}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}

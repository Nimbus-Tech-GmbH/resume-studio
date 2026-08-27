import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { PrintPage } from './PrintPage';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

const isPrint = window.location.pathname === '/print';

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {isPrint ? <PrintPage /> : <App />}
    </QueryClientProvider>
  </StrictMode>,
);

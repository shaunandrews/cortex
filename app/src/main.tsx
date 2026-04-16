import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import type { Persister } from '@tanstack/react-query-persist-client';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './auth/AuthContext';
import App from './App';
import './App.css';

const CACHE_KEY = 'cortex-query-cache';

const persister: Persister = {
  persistClient: (client) => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(client));
  },
  restoreClient: () => {
    const data = localStorage.getItem(CACHE_KEY);
    return data ? JSON.parse(data) : undefined;
  },
  removeClient: () => {
    localStorage.removeItem(CACHE_KEY);
  },
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 30 * 60 * 1000 }}
    >
      <BrowserRouter>
        <AuthProvider>
          <App />
          <ReactQueryDevtools initialIsOpen={false} />
        </AuthProvider>
      </BrowserRouter>
    </PersistQueryClientProvider>
  </StrictMode>,
);

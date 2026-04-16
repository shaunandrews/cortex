import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './auth/AuthContext';
import { SyncProvider } from './sync/SyncProvider';
import { ThemeWrapper } from './ThemeWrapper';
import App from './App';
import '@wordpress/theme/design-tokens.css';
import './App.css';

// Clean up old localStorage cache from PersistQueryClientProvider
const OLD_CACHE_KEY = 'cortex-query-cache';
const OLD_VERSION_KEY = 'cortex-cache-version';
if (localStorage.getItem(OLD_CACHE_KEY)) {
  localStorage.removeItem(OLD_CACHE_KEY);
  localStorage.removeItem(OLD_VERSION_KEY);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeWrapper>
          <AuthProvider>
            <SyncProvider>
              <App />
            </SyncProvider>
          </AuthProvider>
        </ThemeWrapper>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);

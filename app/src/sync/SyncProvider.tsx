/* eslint-disable react-refresh/only-export-components -- context + hooks pattern requires exporting both */
/**
 * SyncProvider — React context that owns the SyncBridge.
 *
 * Responsibilities:
 * - Creates and manages the SyncBridge instance
 * - Forwards auth token and starred sites to the bridge
 * - Handles tab visibility changes
 * - Exposes useSyncStatus() and useSyncBridge() hooks
 */

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { useStarredSites } from '../hooks/useStarredSites';
import { SyncBridge, type SyncStatus } from './bridge';
import { registerSyncWorker } from './register';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const SyncContext = createContext<SyncBridge | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function SyncProvider({ children }: { children: ReactNode }) {
  const { token, isAuthed } = useAuth();
  const { starredIds } = useStarredSites();
  const queryClient = useQueryClient();
  const bridgeRef = useRef<SyncBridge | null>(null);
  const [, setReady] = useState(false); // trigger re-render when bridge is set

  // Register the Service Worker on mount (no-op in dev)
  useEffect(() => {
    registerSyncWorker();
  }, []);

  // Create bridge and start syncing when authenticated
  useEffect(() => {
    if (!isAuthed || !token) return;

    const mode = import.meta.env.DEV ? 'direct' : 'worker';
    const bridge = new SyncBridge(queryClient, mode as 'direct' | 'worker');
    bridgeRef.current = bridge;
    setReady(true);

    bridge.hydrateFromStore().then(() => {
      bridge.start(token, [...starredIds]);
    });

    return () => {
      bridge.stop();
      bridgeRef.current = null;
      setReady(false);
    };
    // Only re-create when auth changes, not on every starredIds change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, token, queryClient]);

  // Forward starred sites changes to the bridge
  useEffect(() => {
    bridgeRef.current?.updateStarredSites([...starredIds]);
  }, [starredIds]);

  // Tab visibility
  useEffect(() => {
    const handler = () => {
      bridgeRef.current?.setTabVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // Keep Service Worker alive (production only)
  useEffect(() => {
    if (import.meta.env.DEV) return;
    const timer = setInterval(() => bridgeRef.current?.sendKeepalive(), 20_000);
    return () => clearInterval(timer);
  }, []);

  return <SyncContext.Provider value={bridgeRef.current}>{children}</SyncContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Access the SyncBridge instance directly. */
export function useSyncBridge(): SyncBridge | null {
  return useContext(SyncContext);
}

/** Subscribe to sync engine status (phase, progress, per-site freshness). */
export function useSyncStatus(): SyncStatus {
  const bridge = useContext(SyncContext);
  const [status, setStatus] = useState<SyncStatus>(
    () =>
      bridge?.getStatus() ?? {
        phase: 'idle',
        progress: { fetched: 0, total: 0 },
        siteStatuses: {},
        lastPollAt: null,
      },
  );

  useEffect(() => {
    if (!bridge) return;
    return bridge.onStatusChange(setStatus);
  }, [bridge]);

  return status;
}

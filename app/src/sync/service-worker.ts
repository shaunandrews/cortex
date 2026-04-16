/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

/**
 * Service Worker shell for the SyncEngine.
 * Thin wrapper: lifecycle events + message routing.
 * All logic lives in the SyncEngine class.
 */

import { SyncEngine } from './engine';
import type { BridgeMessage, WorkerMessage } from './protocol';

const sw = self as unknown as ServiceWorkerGlobalScope & typeof globalThis;

let engine: SyncEngine | null = null;

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

sw.addEventListener('install', () => {
  sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(sw.clients.claim());
});

// ---------------------------------------------------------------------------
// Message handling
// ---------------------------------------------------------------------------

sw.addEventListener('message', (event: ExtendableMessageEvent) => {
  const msg = event.data as BridgeMessage;

  // Create engine on first AUTH_TOKEN
  if (!engine && msg.type === 'AUTH_TOKEN') {
    engine = new SyncEngine();
    engine.onMessage(broadcastToClients);
  }

  engine?.handleMessage(msg);
});

// ---------------------------------------------------------------------------
// Broadcast to all connected tabs
// ---------------------------------------------------------------------------

function broadcastToClients(msg: WorkerMessage): void {
  sw.clients.matchAll({ type: 'window' }).then((clients) => {
    for (const client of clients) {
      client.postMessage(msg);
    }
  });
}

# Cortex

An AI-native workspace prototype for Automattic. Cortex is a client-side React SPA that surfaces P2 site data — posts, comments, cross-posts, and unread tracking — through a fast, dense interface built for power users.

## Getting Started

### Prerequisites

- Node.js 18+
- A WordPress.com OAuth2 application (implicit flow)

### Setup

```bash
cd app
npm install
cp .env.example .env  # then fill in your OAuth credentials
npm run dev
```

### Environment Variables

| Variable | Description |
|---|---|
| `VITE_WPCOM_CLIENT_ID` | WordPress.com OAuth app client ID |
| `VITE_WPCOM_CLIENT_SECRET` | WordPress.com OAuth app client secret |
| `VITE_WPCOM_REDIRECT_URI` | OAuth callback URL — must be `http://localhost:5176/callback` (port is fixed) |

## Architecture

Cortex is a single-page app with no backend. Authentication tokens and user preferences live in localStorage. Data is fetched from the WordPress.com REST API and kept fresh by a background sync engine that prefetches all P2 sites and polls for changes.

### Stack

- **React 19** + **TypeScript** — UI framework
- **Vite** — build tool and dev server
- **React Router** — client-side routing
- **TanStack React Query** — server state management
- **Background sync engine** — prefetches all P2 data, polls for changes, persists to IndexedDB
- **@wordpress/ui** + **@wordpress/theme** — design system components and tokens
- **react-resizable-panels** — three-panel layout (sidebar, feed, detail)
- **Vitest** — test runner

### Directory Structure

```
app/src/
  api/          # WP.com REST API client and TypeScript types
  auth/         # OAuth2 implicit flow (AuthContext, Callback)
  hooks/        # React Query hooks for data fetching and mutations
  lib/          # Utilities (relative time, x-post helpers, query client)
  sync/         # Background sync engine (scheduler, fetcher, store, bridge)
  views/        # Page-level components (AuthedHome, UnauthHome)
  App.tsx       # Router
  App.css       # All styles (plain CSS, no modules)
  main.tsx      # Entry point
```

See [docs/api.md](docs/api.md) for WP.com API details, [docs/features.md](docs/features.md) for feature documentation, [docs/data-system.md](docs/data-system.md) for the sync engine architecture.

## Development

```bash
cd app
npm run dev          # Start dev server (port 5176)
npm run build        # TypeScript check + production build
npm run lint         # ESLint
npm run test         # Run all tests
npm run test:watch   # Watch mode
```

## License

Private — Automattic internal use only.

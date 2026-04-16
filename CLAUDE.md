# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Cortex is an AI-native workspace prototype for Automattic. It's a client-side React SPA that authenticates via WordPress.com OAuth2 (implicit flow) and surfaces P2 site data from the WP.com REST API. No backend — tokens live in localStorage.

## Commands

All commands run from the `app/` directory:

```bash
cd app
npm run dev        # Start Vite dev server (DO NOT RUN — see Rules)
npm run build      # TypeScript check + Vite production build
npm run lint       # ESLint
npm run test       # Run all tests (vitest run)
npm run test:watch # Run tests in watch mode (vitest)
npm run preview    # Preview production build
```

Dev server is pinned to port 5176 (`strictPort: true` in vite.config.ts) — the WP.com OAuth app has this as the registered callback URL. Port is reserved via `portman reserve 5176 -n "cortex"`.

## Architecture

### Auth Flow

`UnauthHome` → WP.com OAuth2 authorize (implicit, `response_type=token`) → redirect to `/callback` → `Callback` parses hash fragment, validates state, calls `AuthContext.login()` → stores token in localStorage + fetches `/me` → redirects to `/` → `AuthedHome`.

### Key Wiring

- `main.tsx` wraps the app in `BrowserRouter` > `QueryClientProvider` > `ThemeWrapper` > `AuthProvider` > `SyncProvider` > `App`
- `App.tsx` is the router: `/` renders `UnauthHome` or `AuthedHome` based on `useAuth().isAuthed`, `/callback` renders the OAuth handler. Agentation dev tool renders in dev mode only.
- `AuthContext.tsx` is the single source of truth for auth state — provides `token`, `user`, `isAuthed`, `isLoading`, `login()`, `logout()` via React context
- `api/wpcom.ts` is a thin fetch wrapper around the WP.com REST API (v1.1, v1.2, wpcom/v2). All requests use Bearer token auth.

### Layout

Three-panel resizable layout (`react-resizable-panels`):
1. **Sidebar** — user-defined groups (Favorites + Sites are defaults), per-group sort, drag-and-drop, right-click context menus. See `docs/features.md` → "Sidebar Groups".
2. **Feed** — posts for the selected site, with x-post detection and image galleries
3. **Detail** (collapsible) — full post content, likes, comments

### API Layer

- `api/types.ts` — TypeScript interfaces for all WP.com API responses
- `api/wpcom.ts` — fetch functions for sites, posts, comments, likes, following, seen-posts
- Three API base URLs: v1.1 (most endpoints), v1.2 (Reader following), wpcom/v2 (seen-posts)
- See `docs/api.md` for endpoint details

### Data Flow & Sync Engine

Data is managed by a background sync engine (`sync/`) that prefetches all P2 sites and keeps them fresh. See `docs/data-system.md` for full architecture.

- **SyncEngine** (`sync/engine.ts`) — portable class that runs in main thread (dev) or Service Worker (prod). Composes Scheduler, Fetcher, and Store.
- **SyncBridge** (`sync/bridge.ts`) — translates engine events into `queryClient.setQueryData()` calls. Hydrates React Query from IndexedDB on startup.
- **SyncProvider** (`sync/SyncProvider.tsx`) — React context that owns the bridge. Forwards auth token, starred sites, and tab visibility.
- **IndexedDB** — persistent storage for sites, posts (lightweight), post content, sync state, and following data. Replaces the old localStorage cache.

Hooks still work as before — they read from React Query. The sync engine populates the cache in the background so data is ready when a hook mounts. If the sync engine hasn't reached a site, hooks fall back to their normal fetch.

Key hooks:
- `hooks/useP2Sites` — P2 sites (filtered from `/me/sites` by `is_wpforteams_site`)
- `hooks/useP2Posts` / `useP2Post` — post lists and single posts
- `hooks/useFollowing` — Reader subscriptions with `unseen_count` per site
- `hooks/useMarkAsSeen` — mutation to mark posts as read (optimistic update)
- `hooks/usePostComments` / `useToggleLike` — comments and like toggle
- `hooks/useSidebarGroups` — groups, membership, sort, drag state; the sidebar's single source of truth. Writes to `cortex_sidebar_groups`, `cortex_sidebar_membership`, and `cortex_sidebar_last_group` in localStorage.
- `hooks/useStarredSites` — thin reader over the sidebar membership storage. Returns `starredIds` (sites in the Favorites group). Consumed by `SyncProvider` to prioritize prefetch.

### X-Posts

Cross-posts are detected by the `p2-xpost` tag and origin metadata (`xpost_origin`, `_xpost_original_permalink`). Helpers in `lib/xpost.ts`. In the feed, x-posts render compactly and clicking them loads the original post in the detail panel.

### Environment Variables (in `app/.env`)

- `VITE_WPCOM_CLIENT_ID` — WP.com OAuth app client ID
- `VITE_WPCOM_CLIENT_SECRET` — WP.com OAuth app client secret
- `VITE_WPCOM_REDIRECT_URI` — OAuth callback URL (`http://localhost:5176/callback` — must match the registered redirect in the WP.com OAuth app, do not change the port)

## Testing

- **Vitest** with jsdom environment, globals enabled. Config in `vitest.config.ts` (separate from `vite.config.ts`).
- Tests live next to source files: `Foo.tsx` → `Foo.test.tsx`.
- Run a single test file: `npx vitest run src/path/to/file.test.tsx`
- `@wordpress/ui` and `@wordpress/icons` are aliased to mocks in `src/test/mocks/` during tests — they bundle React 18 which conflicts with React 19. The mocks render simple HTML equivalents. If you add new `@wordpress/ui` components to production code, add matching mocks.
- **Always write tests for new functionality.** Always run `npm run test` after changes and fix any failures before reporting done.

## Rules

- **NEVER start, restart, or stop the dev server.** Shaun always has it running. Do not run `npm run dev`, `npx vite`, or anything that starts a server.
- **NEVER open or control the browser.** Do not use chrome-devtools MCP tools. Do not navigate pages, take screenshots, or interact with the browser. If visual verification is needed, ask Shaun.

## Conventions

- Plain CSS in `App.css` (no CSS modules, no Tailwind)
- WPDS design tokens for colors, spacing, typography, borders (`--wpds-*` custom properties)
- Display font: Bricolage Grotesque 800 (Google Fonts) — **only** for the wordmark (`.header-wordmark`) and the unauthed homepage title (`.unauth-title`). Everything else uses the system font stack.
- Body/UI font: WPDS system font stack via `--wpds-typography-font-family-body`
- P2 sites filtered from `/me/sites` by `options.is_wpforteams_site`
- **Avatar shapes:** People (gravatars) are always circular (`border-radius: 50%`). Sites (blavatars/icons) are always rounded-rect (`border-radius: var(--wpds-border-radius-xs)` or similar). Never mix these up.
- HTML entities in API responses must be decoded with `decodeEntities()` before rendering
- `blog_ID` from the Reader API may be a string — always coerce with `Number()` when comparing to site IDs

## WordPress Packages

This project uses three packages from the WordPress Gutenberg monorepo. When in doubt, reference the source:

- **`@wordpress/ui`** — React UI components (Button, Icon, Text, Popover, etc.). Source: https://github.com/WordPress/gutenberg/tree/trunk/packages/ui
- **`@wordpress/icons`** — SVG icon library. Source: https://github.com/WordPress/gutenberg/tree/trunk/packages/icons
- **`@wordpress/theme`** — WPDS design tokens as CSS custom properties (`--wpds-*`). Source: https://github.com/WordPress/gutenberg/tree/trunk/packages/theme

### Usage rules

- **Always use `@wordpress/ui` components** for interactive elements. Never use raw `<button>`, `<input>`, or other native elements when a component exists (Button, IconButton, Text, Icon, etc.).
- **Always use `@wordpress/icons`** for icons. Never use emoji or text characters (✓, ★, ↻, etc.) as icons. Browse the icon library at `node_modules/@wordpress/icons/src/library/` for available icons.
- **Do not guess component APIs.** Before using any `@wordpress/ui` component, read its type definitions at `node_modules/@wordpress/ui/build-types/<component>/types.d.ts` to understand the actual props. Check the package source links above if more context is needed.

### Key components

- **`Button`** — Standard button. Variants: `"solid"`, `"outline"`, `"minimal"`, `"unstyled"`. Tones: `"brand"`, `"neutral"`. Sizes: `"default"`, `"compact"`, `"small"`. Has a `Button.Icon` sub-component for rendering icons inside it.
- **`IconButton`** — Icon-only button. Takes `icon` (from `@wordpress/icons`) and `label` (required, used for tooltip + accessibility). Same variant/tone/size options as Button. Use this instead of Button when the button has no text label.
- **`Icon`** — Renders an SVG icon. Takes `icon` (from `@wordpress/icons`) and optional `size` (default 24).
- **`Text`** — Typography component. Takes `variant` for sizing and `render` to control the HTML element.

### Test mocks

- `@wordpress/ui` and `@wordpress/icons` are aliased to mocks in `src/test/mocks/` during tests (React 18/19 conflict).
- When adding new `@wordpress/ui` components or `@wordpress/icons` icons to production code, add matching exports in the test mocks.

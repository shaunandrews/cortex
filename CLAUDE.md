# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Cortex is an AI-native workspace prototype for Automattic. It's a client-side React SPA that authenticates via WordPress.com OAuth2 (implicit flow) and surfaces P2 site data from the WP.com REST API. No backend — tokens live in localStorage.

## Commands

All commands run from the `app/` directory:

```bash
cd app
npm run dev      # Start Vite dev server
npm run build    # TypeScript check + Vite production build
npm run lint     # ESLint
npm run preview  # Preview production build
```

Use Port Keeper for the dev server port — see global CLAUDE.md.

## Architecture

**Auth flow:** `UnauthHome` → WP.com OAuth2 authorize (implicit, `response_type=token`) → redirect to `/callback` → `Callback` parses hash fragment, validates state, calls `AuthContext.login()` → stores token in localStorage + fetches `/me` → redirects to `/` → `AuthedHome`.

**Key wiring:**
- `main.tsx` wraps the app in `BrowserRouter` > `AuthProvider` > `App`
- `App.tsx` is the router: `/` renders `UnauthHome` or `AuthedHome` based on `useAuth().isAuthed`, `/callback` renders the OAuth handler
- `AuthContext.tsx` is the single source of truth for auth state — provides `token`, `user`, `isAuthed`, `isLoading`, `login()`, `logout()` via React context
- `api/wpcom.ts` is a thin fetch wrapper around the WP.com REST API v1.1 (`/me`, `/me/sites`), all requests use Bearer token auth

**Environment variables** (in `app/.env`):
- `VITE_WPCOM_CLIENT_ID` — WP.com OAuth app client ID
- `VITE_WPCOM_CLIENT_SECRET` — WP.com OAuth app client secret
- `VITE_WPCOM_REDIRECT_URI` — OAuth callback URL (e.g. `http://localhost:5176/callback`)

## Rules

- **NEVER start, restart, or stop the dev server.** Shaun always has it running. Do not run `npm run dev`, `npx vite`, or anything that starts a server.
- **NEVER open or control the browser.** Do not use chrome-devtools MCP tools. Do not navigate pages, take screenshots, or interact with the browser. If visual verification is needed, ask Shaun.

## Conventions

- Plain CSS in `App.css` (no CSS modules, no Tailwind)
- Dark theme (`#0a0a0a` background, `#fafafa` text)
- System font stack (`-apple-system, BlinkMacSystemFont, 'SF Pro Display', ...`)
- P2 sites are filtered from `/me/sites` by `options.is_wpforteams_site`

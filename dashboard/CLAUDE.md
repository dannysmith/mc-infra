# Dashboard

Server-rendered web dashboard using Hono (JSX) + HTMX + Tailwind CSS, running on Bun.

## Running

Runs as a systemd service (`mc-dashboard`). After code changes:

```sh
cd /opt/minecraft/dashboard
bun run build:css          # only if Tailwind classes changed
sudo systemctl restart mc-dashboard
```

Live at `https://dashboard.mc.danny.is` (nginx reverse proxy with basic auth).

## Project structure

```
src/
  index.tsx              # Hono app — all routes defined here
  manifest.ts            # Reads manifest.yml, returns typed server info
  docker.ts              # Docker API via Bun's native fetch({ unix })
  components/            # Reusable JSX components (server-side only)
    Layout.tsx           # HTML shell — <html>, <head>, HTMX/Tailwind includes, nav
    StatusBadge.tsx      # running/exited/not_created badge
    TierBadge.tsx        # permanent/semi-permanent/ephemeral badge
    ServerRows.tsx       # Table rows for the server list (used by overview + partial)
  routes/                # Page-level components (rendered inside Layout)
    overview.tsx         # Server list table
    detail.tsx           # Single server detail page
  styles/
    input.css            # Tailwind source (theme variables defined here)
    output.css           # Built CSS (gitignored, built by `bun run build:css`)
```

## How rendering works

There is no client-side framework. Hono's built-in JSX (`hono/jsx`) renders HTML on the server. All `.tsx` files are server-side templates, not React components. They use the same JSX syntax but run only on the server.

Pages return full HTML via `c.html(<Layout><Page /></Layout>)`. HTMX partials return HTML fragments without the layout wrapper.

## Routing

All routes are in `src/index.tsx`. Two types:

- **Pages** (`GET /`, `GET /servers/:name`) — return full HTML wrapped in `<Layout>`.
- **Partials** (`GET /partials/...`) — return HTML fragments for HTMX to swap in. These reuse the same components as pages but skip the layout.

`hx-boost="true"` is set on `<body>`, so `<a>` links between pages behave like SPA navigation (HTMX fetches the page and swaps the body). External links (BlueMap etc.) need `hx-boost="false"`.

## HTMX patterns

HTMX is loaded via CDN in `Layout.tsx`. Use `hx-` attributes directly in JSX.

- **Polling**: `hx-get="/partials/..." hx-trigger="every 10s" hx-swap="innerHTML"` on a container element. The partial route returns just the inner content.
- **Actions** (future): `hx-post="/api/..." hx-target="#result" hx-swap="innerHTML"` on buttons.
- **WebSocket** (future): HTMX WebSocket extension for log streaming.

When adding a new dynamic section, create a partial route that returns a fragment, then point an `hx-get` at it from the page component.

## Styling

Tailwind CSS v4. Theme colours are defined in `src/styles/input.css` using `@theme`. Use them as utility classes: `bg-bg`, `text-text-muted`, `border-border`, `text-green`, `text-link`, etc.

No hand-written CSS — use Tailwind utility classes in JSX. After adding new classes, rebuild with `bun run build:css`.

## Adding a new page

1. Create a page component in `src/routes/`.
2. Add a `GET` route in `src/index.tsx` that renders it inside `<Layout>`.
3. If it needs auto-refreshing sections, add a `GET /partials/...` route returning the fragment.
4. Link to it from other pages — `hx-boost` handles the navigation.

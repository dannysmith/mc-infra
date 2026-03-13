# Optional: Dashboard & Polish

Lightweight web dashboard for server status, probably at `dashboard.mc.danny.is`.

## Pages & Features

### Overview Page (dashboard home)

**Host health:**
- CPU load, RAM usage, disk usage (current values; sparklines/history deferred to later)
- Service health: Nginx status, all Docker containers (including non-MC ones like acme-dns, mc-router)
- Collapsible full process list for debugging (spotting unexpected resource hogs)

**Server list (moderate detail):**
- Name, status (running/stopped/unhealthy), tier badge
- Player count (if running)
- CPU%, RAM usage, uptime (if running)
- Clickable to detail page

### Server Detail Page

**Config & info (from manifest.yml):**
- Name, type, version, mode, tier, memory allocation, MOTD
- Mod groups + individual mods (what's configured)
- Backup config (interval, retention)
- BlueMap URL (link to `map-<name>.mc.danny.is` if enabled)
- Created date

**Runtime data (from Docker API, on page load):**
- Container status, CPU%, RAM, uptime
- Disk usage of `servers/<name>/data/` (total)
- Disk usage per dimension (overworld, nether, end)
- Actually installed mods (from filesystem, not just manifest — what JARs are in the mods folder)

**Log viewer (live via WebSocket):**
- Auto-scrolling log stream from the MC server container
- Pause on scroll-up, resume on scroll-to-bottom
- Simple and focused for v1 (search/filter and color coding deferred)

**RCON buttons (manual trigger):**
- "Check TPS" — runs RCON command, shows result
- "Check BlueMap status" — runs `/bluemap` via RCON
- "Check DH status" — runs `/dh debug` via RCON
- "Player list" — runs `list` via RCON

**MC world data (lower priority, but cheap to add via prismarine-nbt):**
- level.dat info: world spawn, seed, gamerules, version, day/time, weather
- Player data: position, dimension, game mode, health, XP (from playerdata/*.dat)
- Player stats: play time, blocks mined, mobs killed etc. (from stats/*.json — plain JSON)
- Player advancements: progress (from advancements/*.json — plain JSON)
- Chunk count per dimension (from .mca region files via prismarine-provider-anvil)
- Current entity count (via RCON or from entity region files)

## Other Key Points

- Read-only for v1 (no server start/stop/config changes from the dashboard).
- No polling or background data collection — near-zero resources when idle.
- Auth via Nginx basic auth (trusted users only: Danny + maybe Cam).
- App lives in `dashboard/` at repo root.

---

## Architectural Decisions

### Stack

- **Backend**: Hono on Bun (TypeScript). Server-rendered HTML via Hono's JSX + WebSocket for log streaming.
- **Frontend**: HTMX + Tailwind CSS. No client-side framework — Hono renders HTML server-side using JSX as a templating engine. HTMX handles partial page updates, polling, and WebSocket log streaming. Tailwind handles styling. Minimal custom JS only where needed (log viewer scroll behavior).
- **Deployment**: Host process managed by systemd (not a Docker container). Same pattern as Nginx — a system service that monitors/supports the Docker stack.
- **Reverse proxy**: Nginx at `dashboard.mc.danny.is` with basic auth + SSL (wildcard cert already covers it). Proxies to Hono on a localhost port.

### Why host process (not Docker container)

- The dashboard is a monitoring tool — running inside the thing it monitors adds friction.
- Direct access to host `/proc` for system CPU/RAM/disk stats (inside a container, `/proc` shows the container's cgroup view, not the host).
- Direct filesystem access to `manifest.yml`, `servers/*/data/` (world sizes, mods, `.dat` files) without volume mount juggling.
- Docker socket access is simpler from the host (danny is already in the docker group).
- If Docker goes down, a host process can still report that. A container would be dead too.
- Bun is already installed on the server.

### Data sources

| Source | What it provides | Access method |
|--------|-----------------|---------------|
| Docker API (Unix socket) | Container states, per-container CPU/RAM, uptime, exec (RCON) | HTTP over `/var/run/docker.sock` |
| RCON (via Docker exec) | TPS, player count, `/bluemap` status, `/dh debug` | Docker API exec endpoint |
| `manifest.yml` | Server config, tier, mods, mod groups | File read |
| Disk reads | World size, dimension sizes, installed mod JARs, `.dat` files | Filesystem |
| Host `/proc` | System CPU, RAM, disk | File read |
| Docker logs API | Server log streaming | Docker API (WebSocket to browser) |

### Data strategy

- No polling or background data collection — fetch on demand when a user loads a page.
- Metrics (CPU, RAM, TPS, etc.) are snapshot: fetched on page load, with a manual refresh button.
- Log tailing is live via WebSocket — streams only while a user is viewing it.
- RCON commands issued via Docker API exec endpoint (equivalent to `docker exec <name> rcon-cli <cmd>` but without subprocess overhead).

### What's rewritten vs reused

- Data-gathering logic is rewritten in TypeScript for the web app (reading manifest, querying Docker, parsing `.dat` files, etc.).
- Existing Python scripts (`mc-status`, `mclib.py`) remain untouched for CLI use. The web app is an independent codebase.

### Key libraries

| Library | Purpose | Notes |
|---------|---------|-------|
| `htmx.org` | Client-side interactivity | ~14KB gzipped. Partial page updates, polling (`hx-trigger="every 5s"`), WebSocket extension for log streaming. |
| `tailwindcss` | Utility-first CSS | Build-time CSS generation from class names in JSX templates. No hand-written CSS needed. |
| N/A (Bun native `fetch({ unix })`) | Docker Engine API | Container states, stats, logs, exec. Bun's native unix socket support replaces dockerode entirely. |
| `rcon-client` | Minecraft RCON protocol (deferred) | TS-native, 19k/month. Not needed for v1 — using Docker exec to run `rcon-cli` inside containers instead (simpler, no port mapping needed). Can switch to direct RCON later if exec overhead becomes noticeable. |
| `prismarine-nbt` | Parse NBT .dat files | 27k/month, PrismarineJS ecosystem. `readFile` + `parse()` + `simplify()` = JSON. Handles gzip automatically. Gives us level.dat, player data, etc. |
| `prismarine-provider-anvil` | Read .mca region files | For counting generated chunks. `getAllChunksInRegion()`. |
| N/A (plain JSON) | Player stats + advancements | `world/stats/<uuid>.json` and `world/advancements/<uuid>.json` are standard JSON files. |

### MC world data file layout

```
servers/<name>/data/world/
├── level.dat                    # NBT (gzipped) — world settings, spawn, seed, gamerules
├── playerdata/<uuid>.dat        # NBT (gzipped) — position, inventory, health, XP
├── stats/<uuid>.json            # Plain JSON — play time, blocks mined, mobs killed
├── advancements/<uuid>.json     # Plain JSON — advancement progress
├── region/r.X.Z.mca             # Anvil region files — overworld terrain chunks
├── entities/r.X.Z.mca           # Entity data by region (1.17+)
├── DIM-1/region/                # Nether
└── DIM1/region/                 # End
```

NBT parsing is trivial with prismarine-nbt. This means MC data features (player info, chunk counts, level.dat details) are low-effort to add.

---

## Implementation Plan

Development happens on the server (not locally) — Claude Code runs via SSH. The app must be live at a real URL from the start since there's no local `bun run dev` workflow.

### Phase 0: Scaffold & deploy skeleton ✅

Get a "hello world" Hono app live at `dashboard.mc.danny.is`:

1. ✅ **Init project** — `dashboard/` with Bun + Hono + TypeScript. Single `GET /` returning a basic HTML page.
2. ✅ **systemd unit** — `mc-dashboard.service` running `bun run dashboard/src/index.ts` on port 3100. Restart on failure, start after network.
3. ✅ **Nginx server block** — `nginx/conf.d/dashboard.conf` (manually managed, not generated). Proxies `dashboard.mc.danny.is` → `localhost:3100` with SSL + basic auth + WebSocket upgrade headers.
4. ✅ **Basic auth** — `htpasswd` file for Danny (+ Cam later).

After this phase: visiting `dashboard.mc.danny.is` shows a page. We can iterate on everything else with just `systemctl restart mc-dashboard`.

### Phase 1: Manifest API + server list ✅

Prove manifest reading and basic API structure:

1. ✅ **`GET /api/servers`** — reads `manifest.yml`, returns server definitions as JSON (name, tier, version, mode, memory, mods, bluemap URL, created date).
2. ✅ **Basic HTML/JS page** (no React yet) — fetches `/api/servers` and renders a table. Proves the full round trip.

### Phase 2: Docker container status ✅

Prove Docker API access:

1. ✅ **Extend `/api/servers`** — for each server, query Docker API via unix socket for container state (running/stopped/not created), CPU%, memory usage, uptime.
2. ✅ **Update the page** — show status badges, resource usage alongside manifest data.

Decision: Bun's native `fetch({ unix })` covers list + inspect + stats cleanly. No dockerode needed.

### Phase 3: Frontend scaffold ✅

Replaced inline HTML with server-rendered Hono JSX + HTMX + Tailwind CSS.

- ✅ Tailwind CSS v4 with custom dark theme (`src/styles/input.css`), built via `bun run build:css`.
- ✅ Hono JSX (`jsxImportSource: "hono/jsx"`) for server-side templating.
- ✅ Shared layout (`Layout.tsx`) with HTMX via CDN, Tailwind CSS, nav header, `hx-boost` on body.
- ✅ Reusable components: `StatusBadge`, `TierBadge`, `ServerRows`.
- ✅ Overview page with server table, auto-refreshing every 10s via `hx-get="/partials/servers"`.
- ✅ Server detail page (`/servers/:name`) with config, mods, and runtime sections (runtime auto-refreshes).
- ✅ Partial routes for HTMX polling (`/partials/servers`, `/partials/servers/:name/runtime`).
- ✅ `dashboard/CLAUDE.md` with project structure, routing, styling, and HTMX patterns.

Decision: React + shadcn/ui was overkill. HTMX + Hono JSX gives partial page updates, polling, and SPA-like navigation with zero client framework. Tailwind handles styling. Only custom JS needed in future is ~20 lines for log viewer scroll behavior.

### Phase 4: Host metrics ✅

1. ✅ **`GET /api/host`** — CPU load, RAM usage, disk usage from `/proc/loadavg`, `/proc/meminfo`, `statvfs`.
2. ✅ **Service health** — list all Docker containers (not just MC servers) with status.
3. ✅ **Add to overview page** — host health section above server list.

### Phase 5: RCON + filesystem data ✅

1. ✅ **`POST /api/servers/:name/rcon`** — execute RCON command via Docker exec API. Returns command output.
2. ✅ **RCON buttons on detail page** — Check TPS, player list, BlueMap status, DH status.
3. ✅ **Filesystem data** — disk usage per server (`servers/<name>/data/`), per dimension, installed mod JARs.

### Phase 6: Log streaming ✅

1. ✅ **WebSocket endpoint** — `/ws/servers/:name/logs`. Streams Docker container logs to browser via Hono's `createBunWebSocket()`. Demuxes Docker's 8-byte multiplexed stream frames.
2. ✅ **Log viewer component** — auto-scroll, pause on scroll-up, resume on scroll-to-bottom. Reconnects on disconnect, caps at 1000 lines, cleans up on HTMX page navigation.

### Phase 7: MC world data

1. **NBT parsing** — `prismarine-nbt` for level.dat (spawn, seed, gamerules, version, day/time, weather) and playerdata (position, dimension, health, XP).
2. **JSON reads** — player stats (play time, blocks mined, mobs killed) and advancements from `stats/*.json` and `advancements/*.json`.
3. **Chunk counts** — `prismarine-provider-anvil` for region file analysis (generated chunk count per dimension).

### Deployment notes

- **Port**: 3100 (avoids conflict with BlueMap's 8100+ range).
- **Nginx config**: manually created in `nginx/conf.d/dashboard.conf` — not generated by `mc-generate` since the dashboard isn't a manifest-driven service.
- **Restart workflow**: edit code → `bun run build:css` (if Tailwind classes changed) → `systemctl restart mc-dashboard` → refresh browser. No hot reload needed for a personal tool.
- **Build step**: only Tailwind CSS compilation (`bun run build:css`). No JS bundling — Hono JSX renders server-side. Could add CSS build to systemd ExecStartPre or a small deploy script.

### Phase 8: Documentation & setup

Update internal docs and `setup.sh` to cover dashboard-specific manual setup steps for a fresh server:

1. **`setup.sh`** — install `mc-dashboard.service` systemd unit (symlink + enable), create `nginx/.htpasswd` file.
2. **Developer docs** — document the dashboard architecture, restart workflow, and nginx config in relevant docs files.
3. **README.md** — add dashboard to the project overview if not already covered.

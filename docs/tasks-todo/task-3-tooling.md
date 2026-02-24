# Phase 3: Tooling

Server manifest system, composable modpacks, and management scripts for rapid server creation/teardown.

## Current State

As of Phase 2/2b, creating a new server requires manual edits to:
- `docker-compose.yml` — new service block, mc-router MAPPING entry, BlueMap port if needed
- `nginx/conf.d/bluemap.conf` — new server block for `map-<name>.mc.danny.is` (if BlueMap enabled)
- `servers/<name>/env` — placeholder env file
- BlueMap EULA acceptance after first start (`config/bluemap/core.conf`)
- Nginx reload

No DNS or SSL changes needed (wildcard A record + wildcard cert cover all subdomains automatically). See `docs/dns-and-routing.md` for the full reference.

BlueMap ports are sequential on localhost: 8100 (creative), 8101 (test), 8102 (next), etc.

The test server currently running is ephemeral — can be destroyed once tooling is in place.

---

## Architecture

### Manifest-Driven Server Management

A **server manifest** (`manifest.yml`) is the single source of truth for all server definitions. A generator script (`mc-generate`) produces `docker-compose.yml` and `nginx/conf.d/bluemap.conf` from this manifest plus modpack definitions.

**Why:** Adding a server currently requires coordinated edits across 3-4 files. A manifest + generator ensures consistency and makes server creation scriptable.

**What's generated:**
- `docker-compose.yml` — complete file (static services + mc-router MAPPING + all MC server blocks)
- `nginx/conf.d/bluemap.conf` — server blocks for all BlueMap-enabled servers

**What's user-editable (never generated over):**
- `manifest.yml` — server definitions (edited by scripts or manually)
- `servers/<name>/env` — per-server Minecraft settings (difficulty, view distance, command blocks, level type, etc.)
- `shared/modpacks/<name>/manifest.yml` — modpack definitions

**Workflow for MC-specific settings:** Since `docker-compose.yml` is generated, Minecraft settings like `VIEW_DISTANCE`, `DIFFICULTY`, `LEVEL_TYPE`, `GENERATOR_SETTINGS` etc. go in `servers/<name>/env` (which is referenced via `env_file:` in the generated compose). This keeps the generated compose clean and gives each server a dedicated settings file. The `env` file is pre-populated from a template with common options commented out for discoverability.

### Composable Modpack System

Modpacks are defined as YAML manifests in `shared/modpacks/<name>/manifest.yml`. Each lists Modrinth project slugs and can **include** other modpacks for composition.

A server in the manifest can reference **multiple modpacks** plus additional **per-server mods**. The generator resolves all includes, deduplicates, and produces a single `MODRINTH_PROJECTS` list. This means mods are downloaded by the itzg container on startup (auto-cleanup of removed mods, auto-updates for unpinned versions).

**Composition examples:**
- `modpacks: [fabric-standard]` — gets all of fabric-standard (which includes fabric-base)
- `modpacks: [fabric-base], extra_mods: [bluemap]` — perf mods + just BlueMap
- `modpacks: [], extra_mods: [fabric-api, some-experimental-mod]` — fully custom, no shared packs
- `modpacks: [fabric-standard, extra-fancy-pack]` — multiple packs combined

### Scripts

- **Python** (stdlib + PyYAML via `apt install python3-yaml`) for complex scripts: `mc-create`, `mc-destroy`, `mc-archive`, `mc-generate`
- **Bash** for simple wrappers: `mc-start`, `mc-stop`, `mc-status`, `mc-logs`, `mc-console`
- All scripts live in `shared/scripts/` and are added to PATH via `/opt/minecraft/shared/scripts` in `.bash_aliases`

### File Layout

```
manifest.yml                          # Server definitions (source of truth)
docker-compose.yml                    # Generated — do not edit directly
nginx/conf.d/bluemap.conf             # Generated — do not edit directly
shared/
  modpacks/
    fabric-base/manifest.yml          # Core performance mods
    fabric-standard/manifest.yml      # Full setup (includes fabric-base)
    vanilla/manifest.yml              # No mods
  scripts/
    mc-create                         # Python — create server
    mc-destroy                        # Python — remove server
    mc-generate                       # Python — regenerate compose + nginx from manifest
    mc-archive                        # Python — archive and remove server
    mc-start                          # Bash — start server(s)
    mc-stop                           # Bash — stop server(s)
    mc-status                         # Bash — show all servers
    mc-logs                           # Bash — tail server logs
    mc-console                        # Bash — RCON console
  templates/
    server-env.template               # Default env file for new servers
servers/
  <name>/
    env                               # User-editable MC settings
    data/                             # World data (gitignored)
```

---

## Manifest Formats

### Server Manifest (`manifest.yml`)

```yaml
servers:
  creative:
    type: FABRIC
    version: LATEST
    mode: creative
    memory: 4G
    tier: permanent
    modpacks: [fabric-standard]
    extra_mods: []
    modrinth_version_type: beta
    bluemap: true
    bluemap_port: 8100
    svc: true
    seed: null
    motd: "Creative Server"
    created: 2026-02-22

  test:
    type: FABRIC
    version: LATEST
    mode: creative
    memory: 2G
    tier: ephemeral
    modpacks: [fabric-base]
    extra_mods: [bluemap]
    bluemap: true
    bluemap_port: 8101
    svc: false
    seed: "-4172144997902289642"
    motd: "Test Server"
    created: 2026-02-22
```

**Fields:**

| Field | Default | Description |
|-------|---------|-------------|
| `type` | `FABRIC` | Server type: FABRIC, VANILLA, PAPER |
| `version` | `LATEST` | Minecraft version (e.g. `1.21.4`, `LATEST`, `25w08a`) |
| `mode` | `creative` | Game mode: creative, survival, adventure, spectator |
| `memory` | tier-based | Java heap size (e.g. `2G`, `4G`) |
| `tier` | `ephemeral` | Protection level: ephemeral, semi-permanent, permanent |
| `modpacks` | `[fabric-standard]` | Modpack names to include (resolved recursively) |
| `extra_mods` | `[]` | Additional Modrinth slugs (supports `slug:version` pinning) |
| `modrinth_version_type` | `release` | Modrinth release channel: release, beta, alpha |
| `bluemap` | auto-detected | Whether BlueMap is enabled (inferred from resolved mods if not set) |
| `bluemap_port` | auto-assigned | Localhost port for BlueMap web UI (8100, 8101, ...) |
| `svc` | `false` | Whether Simple Voice Chat UDP port is mapped to this server |
| `seed` | `null` | World seed (quote negative values) |
| `motd` | `"<Name> Server"` | Server MOTD |
| `created` | auto-set | Creation date (set by mc-create) |

**Default memory by tier** (when `memory` not specified):
- ephemeral: `2G`
- semi-permanent: `3G`
- permanent: `4G`

**Resource limits** (auto-calculated, not in manifest):
- Memory limit: `memory` + 1G overhead
- CPU limit: permanent=2.0, semi-permanent=1.5, ephemeral=1.0

**Constants** (always set by generator, not configurable per-server):
- `EULA=TRUE`
- `WHITELIST_ENABLED=true`, `ENFORCE_WHITELIST=true`
- `OPS=d2683803`, `WHITELIST=d2683803`
- `RCON_PASSWORD=${RCON_PASSWORD}` (resolved at runtime by `op run`)
- `ENABLE_CHEATS=true`

### Modpack Manifests

```yaml
# shared/modpacks/fabric-base/manifest.yml
name: fabric-base
description: Core Fabric performance mods
mods:
  - fabric-api
  - lithium
  - ferrite-core
  - c2me-fabric
  - scalablelux
  - noisium
```

```yaml
# shared/modpacks/fabric-standard/manifest.yml
name: fabric-standard
description: Full Fabric setup (perf + maps + voice + LOD)
includes:
  - fabric-base
mods:
  - distanthorizons
  - bluemap
  - simple-voice-chat
```

```yaml
# shared/modpacks/vanilla/manifest.yml
name: vanilla
description: No mods
mods: []
```

**Resolution example:** A server with `modpacks: [fabric-standard], extra_mods: [some-addon]` resolves to:
`fabric-api, lithium, ferrite-core, c2me-fabric, scalablelux, noisium, distanthorizons, bluemap, simple-voice-chat, some-addon`

Mods support Modrinth version pinning syntax: `lithium:0.12.0` or `iris:beta`.

### Server Env Template

New servers get a `servers/<name>/env` pre-populated from `shared/templates/server-env.template`:

```env
# Minecraft settings for <name>
# Edit these, then restart: mc-stop <name> && mc-start <name>
# Reference: https://docker-minecraft-server.readthedocs.io/en/latest/configuration/server-properties/

DIFFICULTY=normal
ENABLE_COMMAND_BLOCK=true
# MAX_PLAYERS=20
# VIEW_DISTANCE=10
# SIMULATION_DISTANCE=10
# SPAWN_PROTECTION=0
# LEVEL_TYPE=minecraft:normal
# GENERATOR_SETTINGS=
# FORCE_GAMEMODE=true
# ALLOW_FLIGHT=true
# PVP=true
```

---

## Phase 3a: Core Infrastructure

The foundation. After this phase, servers can be created and destroyed via scripts.

### Steps

1. Install dependency: `apt install python3-yaml` on VPS (add to setup.sh)
2. Update `configure-bash.sh` to add `/opt/minecraft/shared/scripts` to PATH
3. Define modpack manifests (`fabric-base`, `fabric-standard`, `vanilla`)
4. Create `shared/templates/server-env.template`
5. Create `manifest.yml` with entries matching current creative + test servers
6. Write `mc-generate` — reads manifest + modpacks, produces compose + nginx
7. Write `mc-create` — adds to manifest, runs mc-generate, creates server dir + env
8. Write `mc-destroy` — removes from manifest, runs mc-generate, cleans up
9. Implement BlueMap EULA auto-acceptance
10. Migrate: run mc-generate, diff against current compose, verify functional equivalence, commit

### mc-generate

Python script that:
1. Reads `manifest.yml` and all referenced modpack manifests
2. Resolves modpack `includes` chains (recursive, deduplicated)
3. Generates complete `docker-compose.yml`:
   - Static services (acme-dns — from a hardcoded template in the script)
   - mc-router with `MAPPING` built from all servers
   - One MC server block per manifest entry (with resolved MODRINTH_PROJECTS, ports, volumes, resource limits, env_file reference)
4. Generates `nginx/conf.d/bluemap.conf` for all servers with `bluemap: true`
5. Validates with `docker compose config --quiet` before overwriting
6. Adds a header comment to generated files: `# Generated by mc-generate — edit manifest.yml instead`

Can be run standalone (after manual manifest edits) or called internally by mc-create/mc-destroy.

### mc-create

```
mc-create --name <name> [options]
```

**Flags:**

| Flag | Default | Description |
|------|---------|-------------|
| `--name` | (required) | Server name (lowercase alphanumeric + hyphens) |
| `--type` | `FABRIC` | FABRIC, VANILLA, PAPER |
| `--version` | `LATEST` | Minecraft version |
| `--modpack` | `[fabric-standard]` | Modpack name(s), repeatable |
| `--extra-mods` | `[]` | Additional Modrinth slugs, comma-separated |
| `--memory` | tier-based | Heap size |
| `--tier` | `ephemeral` | ephemeral, semi-permanent, permanent |
| `--mode` | `creative` | creative, survival, adventure, spectator |
| `--seed` | none | World seed |
| `--motd` | `"<Name> Server"` | Server MOTD |
| `--no-bluemap` | — | Disable BlueMap even if modpack includes it |
| `--svc` | — | Enable SVC port mapping (validates no other server has it) |

**Does NOT start the server.** The user reviews/edits `servers/<name>/env` first, then runs `mc-start <name>`.

**Steps:**
1. Validate name (format, uniqueness)
2. If `--svc`: check no other server has `svc: true`, error if conflict
3. Assign next available `bluemap_port` (if BlueMap enabled)
4. Add entry to `manifest.yml`
5. Run `mc-generate`
6. Create `servers/<name>/` directory
7. Create `servers/<name>/env` from template
8. If BlueMap enabled: launch background EULA acceptance handler (see below)
9. Print summary: connection address, BlueMap URL, env file path, next steps

### mc-destroy

```
mc-destroy <name> [--confirm] [--force]
```

**Tier enforcement:**
- `ephemeral` — destroys immediately
- `semi-permanent` — requires `--confirm`
- `permanent` — refuses (must change tier in manifest first)

**Steps:**
1. Check tier, enforce protection level
2. Stop the server if running (`docker compose stop <name>`)
3. Remove entry from `manifest.yml`
4. Run `mc-generate`
5. Remove stopped container (`docker compose rm -f <name>`)
6. Recreate mc-router to drop old mapping (`op run ... docker compose up -d mc-router`)
7. Reload nginx (if BlueMap was enabled)
8. Remove `servers/<name>/` directory

### BlueMap EULA Auto-Acceptance

When a server with BlueMap starts for the first time, BlueMap generates `config/bluemap/core.conf` with `accept-download: false` and refuses to render until changed.

**Approach:** When mc-create detects BlueMap in the resolved mods, it launches a background process that:
1. Polls for `servers/<name>/data/config/bluemap/core.conf` to appear (sleep + check loop)
2. When found: edits `accept-download: false` → `accept-download: true`
3. Sends a BlueMap reload via RCON: `docker exec <name> rcon-cli bluemap reload`
4. If RCON isn't ready yet: falls back to `docker compose restart <name>`

This is non-blocking — mc-create returns immediately and the handler runs in the background.

**Alternative approach (test during implementation):** Pre-create `servers/<name>/data/config/bluemap/` with a minimal `core.conf` containing `accept-download: true` before first start. If BlueMap respects a partial config, this is simpler. If it overwrites the file, use the polling approach.

---

## Phase 3b: Lifecycle Scripts

Simple wrappers for day-to-day management. All bash.

### mc-start

```bash
mc-start <name>       # Start one server (+ recreate mc-router for MAPPING)
mc-start              # Start all MC servers
```

Wraps: `op run --env-file=.env.tpl -- docker compose up -d <name> mc-router`

The `mc-router` is included so it picks up any MAPPING changes. `docker compose up -d` is idempotent — unchanged services aren't restarted.

### mc-stop

```bash
mc-stop <name>        # Stop one server
mc-stop               # Stop all MC servers
```

Wraps: `docker compose stop <name>`

No `op run` needed — Docker handles graceful shutdown internally (sends RCON `/stop`, waits up to 60s).

### mc-status

```
mc-status
```

Output:
```
SERVER        TIER            STATE     MEMORY    PLAYERS  ADDRESS
creative      permanent       running   3.2G/4G   1/20     creative.mc.danny.is
test          ephemeral       stopped   -         -        test.mc.danny.is
survival      semi-permanent  running   1.8G/2G   0/20     survival.mc.danny.is
```

Reads from `manifest.yml` + `docker compose ps` + `docker stats --no-stream`.

Player count via RCON query (if server is running): `docker exec <name> rcon-cli list`

### mc-logs

```bash
mc-logs <name>                # Tail last 100 lines
mc-logs <name> --follow       # Follow live
mc-logs <name> -n 500         # Last 500 lines
```

Wraps: `docker compose logs [--follow] [--tail N] <name>`

### mc-console

```bash
mc-console <name>
```

Wraps: `docker exec -it <name> rcon-cli`

Uses the rcon-cli bundled in itzg containers. Provides an interactive RCON shell — type MC commands directly, Ctrl+C to exit.

---

## Phase 3c: Advanced Features

### mc-archive

```bash
mc-archive <name>
```

1. Stop the server
2. Tar + compress `servers/<name>/data/` to `shared/backups/<name>-<date>.tar.gz`
3. Run `mc-destroy` to clean up (removes from manifest, regenerates compose, etc.)
4. Print archive location

### World Import

Add to mc-create:

```bash
mc-create --name n19-copy --world ./N19-world.zip
mc-create --name creative-v2 --world-from creative
```

- `--world <path-or-url>` — extract archive into `servers/<name>/data/` before first start. The itzg container's `WORLD` env var could also handle this, but pre-extracting gives more control.
- `--world-from <server>` — copy `servers/<source>/data/world/` to the new server. Source server should be stopped (or at minimum, a save-all issued via RCON first).

### Protection Level Enforcement

Already described in mc-destroy. Additionally:
- `mc-status` should show tier prominently
- `mc-archive` should warn for permanent-tier servers (suggest using proper backup system from Phase 4 instead)

---

## Dependencies

- `python3-yaml` — PyYAML for reading/writing YAML manifests and generating compose (install via `apt install python3-yaml`, add to `setup.sh`)
- All other tools already installed (Docker, nginx, rcon-cli in containers)

## Open Questions

- Should `mc-generate` also regenerate `servers/<name>/env` files, or only create them on `mc-create`? (Leaning: only on create — env files are user-edited and should never be overwritten.)
- Exact HOCON format needed for BlueMap `core.conf` pre-creation (test during implementation).
- Should we validate that the SVC port (24454) isn't mapped to a stopped server? (Probably not — the port binding only matters when the container is running.)

## Done When

### Phase 3a
- `manifest.yml` and modpack manifests defined and committed
- `mc-generate` produces a working `docker-compose.yml` + nginx config
- `mc-create` creates a fully functional server from a single command
- `mc-destroy` removes a server cleanly
- Existing creative and test servers migrated to manifest-based generation
- BlueMap EULA handled automatically
- Scripts on PATH

### Phase 3b
- All lifecycle scripts work: start, stop, status, logs, console
- `mc-status` gives a clear overview of all servers

### Phase 3c
- Can archive a server's world data before destroying
- Can import worlds from files/URLs/other servers
- Protection levels enforced on destroy

# Phase 3: Tooling

Server manifest system and management scripts for rapid server creation/teardown.

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

A **server manifest** (`manifest.yml`) is the single source of truth for all server definitions. A generator script (`mc-generate`) produces `docker-compose.yml` and `nginx/conf.d/bluemap.conf` from this manifest.

**Why:** Adding a server currently requires coordinated edits across 3-4 files. A manifest + generator ensures consistency and makes server creation scriptable.

**What's generated:**
- `docker-compose.yml` — complete file (static services + mc-router MAPPING + all MC server blocks)
- `nginx/conf.d/bluemap.conf` — server blocks for all BlueMap-enabled servers

**What's user-editable (never generated over):**
- `manifest.yml` — server definitions and mod groups (edited by scripts or manually)
- `servers/<name>/env` — per-server Minecraft settings (difficulty, view distance, command blocks, level type, etc.)

**Workflow for MC-specific settings:** Since `docker-compose.yml` is generated, Minecraft settings like `VIEW_DISTANCE`, `DIFFICULTY`, `LEVEL_TYPE`, `GENERATOR_SETTINGS` etc. go in `servers/<name>/env` (which is referenced via `env_file:` in the generated compose). This keeps the generated compose clean and gives each server a dedicated settings file. The `env` file is pre-populated from a template with common options commented out for discoverability.

**Important: `environment:` overrides `env_file:`.** Settings in the generated compose `environment:` block (mode, memory, type, version, seed, motd, modrinth config) always take precedence over `servers/<name>/env`. To change these, edit `manifest.yml` and run `mc-generate`. The env file is for settings NOT managed by the manifest.

### Mod System

Three ways to get mods onto a server, all configurable per-server in `manifest.yml`:

**1. Mod groups** — named shorthand lists of Modrinth slugs, defined once at the top of `manifest.yml`. Avoids re-listing common mods for every server. Currently just one group (`fabric-base`), but more can be added.

**2. Modrinth mods** — individual Modrinth project slugs listed per-server. Supports version pinning (`slug:version`).

**3. JAR mods** — filenames from `shared/mods/`, a single flat directory of JAR files. Used for non-Modrinth mods, dev builds, specific versions, or mods you want to update in one place across servers. The directory is mounted read-only into containers that need it.

The generator combines mod groups + modrinth mods into `MODRINTH_PROJECTS`, and JAR mods into volume mounts + the `MODS` env var.

### Scripts

- **Python** (stdlib + PyYAML via `apt install python3-yaml`) for complex scripts: `mc-create`, `mc-destroy`, `mc-archive`, `mc-generate`, `mc-status`
- **Bash** for simple wrappers: `mc-start`, `mc-stop`, `mc-logs`, `mc-console`
- All scripts live in `shared/scripts/` and are added to PATH via `/opt/minecraft/shared/scripts` in `.bash_aliases`
- Shared logic in `mclib.py` — testable with pytest (see `docs/python-and-testing.md`)

### File Layout

```
manifest.yml                          # Server definitions + mod groups (source of truth)
docker-compose.yml                    # Generated — do not edit directly
nginx/conf.d/bluemap.conf             # Generated — do not edit directly
shared/
  mods/                               # Shared JAR files (dev builds, non-Modrinth mods, etc.)
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

## Manifest Format

### Full Example (`manifest.yml`)

```yaml
players:
  ops: [d2683803]
  whitelist: [d2683803, Kam93]

mod_groups:
  fabric-base:
    - fabric-api
    - lithium
    - ferrite-core
    - c2me-fabric
    - scalablelux
    - noisiumforked

servers:
  creative:
    type: FABRIC
    version: LATEST
    mode: creative
    memory: 4G
    tier: permanent
    mod_groups: [fabric-base]
    modrinth_mods: [distanthorizons, bluemap, simple-voice-chat]
    jar_mods: []
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
    mod_groups: [fabric-base]
    modrinth_mods: [bluemap]
    jar_mods: []
    bluemap: true
    bluemap_port: 8101
    svc: false
    seed: "-4172144997902289642"
    motd: "Test Server"
    created: 2026-02-22
```

### Server Fields

| Field                   | Default           | Description                                                         |
| ----------------------- | ----------------- | ------------------------------------------------------------------- |
| `type`                  | `FABRIC`          | Server type: FABRIC, VANILLA, PAPER                                 |
| `version`               | `LATEST`          | Minecraft version (e.g. `1.21.4`, `LATEST`, `25w08a`)               |
| `mode`                  | `creative`        | Game mode: creative, survival, adventure, spectator                 |
| `memory`                | tier-based        | Java heap size (e.g. `2G`, `4G`)                                    |
| `tier`                  | `ephemeral`       | Protection level: ephemeral, semi-permanent, permanent              |
| `mod_groups`            | `[fabric-base]`   | Which named mod groups to include                                   |
| `modrinth_mods`         | `[]`              | Additional Modrinth slugs (supports `slug:version` pinning)         |
| `jar_mods`              | `[]`              | Filenames from `shared/mods/`                                       |
| `modrinth_version_type` | `release`         | Modrinth release channel: release, beta, alpha                      |
| `bluemap`               | auto-detected     | Whether BlueMap is enabled (inferred from resolved mods if not set) |
| `bluemap_port`          | auto-assigned     | Localhost port for BlueMap web UI (8100, 8101, ...)                 |
| `svc`                   | `false`           | Whether Simple Voice Chat UDP port is mapped to this server         |
| `seed`                  | `null`            | World seed (quote negative values)                                  |
| `motd`                  | `"<Name> Server"` | Server MOTD                                                         |
| `created`               | auto-set          | Creation date (set by mc-create)                                    |

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
- `OPS` and `WHITELIST` — populated from the `players` block in manifest.yml
- `RCON_PASSWORD=${RCON_PASSWORD}` (resolved at runtime by `op run`)

### Server Env Template

New servers get a `servers/<name>/env` pre-populated from `shared/templates/server-env.template`:

```env
# Minecraft settings for <name>
# Edit these, then restart: mc-stop <name> && mc-start <name>
# Reference: https://docker-minecraft-server.readthedocs.io/en/latest/configuration/server-properties/
#
# NOTE: Settings managed by manifest.yml (mode, memory, type, version, seed,
# motd, mods) cannot be overridden here. Edit manifest.yml and run mc-generate.

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

## Phase 3a: Core Infrastructure ✅

The foundation. After this phase, servers can be created and destroyed via scripts.

### Steps

1. ✅ Install dependency: `apt install python3-yaml` on VPS (add to setup.sh)
2. ✅ Update `configure-bash.sh` to add `/opt/minecraft/shared/scripts` to PATH
3. ✅ Create `shared/mods/` directory (with `.gitkeep`; JARs gitignored)
4. ✅ Create `shared/templates/server-env.template`
5. ✅ Create `manifest.yml` with mod groups + entries matching current creative + test servers
6. ✅ Write `mc-generate` — reads manifest, produces compose + nginx
7. ✅ Write `mc-create` — adds to manifest, runs mc-generate, creates server dir + env
8. ✅ Write `mc-destroy` — removes from manifest, runs mc-generate, cleans up
9. ✅ Implement BlueMap EULA auto-acceptance (pre-creates core.conf + background poller fallback)
10. ✅ Migrate: run mc-generate, diff against current compose, verify functional equivalence, commit

### mc-generate

Python script that:
1. Reads `manifest.yml` (mod groups + all server definitions)
2. For each server, resolves mod groups + modrinth_mods into a combined list
3. Generates complete `docker-compose.yml`:
   - Static services (acme-dns — from a hardcoded template in the script)
   - mc-router with `MAPPING` built from all servers
   - One MC server block per server (with MODRINTH_PROJECTS, MODS + volume mounts for jar_mods, ports, resource limits, env_file reference)
4. Generates `nginx/conf.d/bluemap.conf` for all servers with `bluemap: true`
5. Validates with `docker compose config --quiet` before overwriting
6. Adds a header comment to generated files: `# Generated by mc-generate — edit manifest.yml instead`

Can be run standalone (after manual manifest edits) or called internally by mc-create/mc-destroy.

### mc-create

```
mc-create --name <name> [options]
```

**Flags:**

| Flag              | Default           | Description                                                |
| ----------------- | ----------------- | ---------------------------------------------------------- |
| `--name`          | (required)        | Server name (lowercase alphanumeric + hyphens)             |
| `--type`          | `FABRIC`          | FABRIC, VANILLA, PAPER                                     |
| `--version`       | `LATEST`          | Minecraft version                                          |
| `--mod-group`     | `[fabric-base]`   | Mod group(s), repeatable                                   |
| `--modrinth-mods` | `[]`              | Modrinth slugs, comma-separated                            |
| `--jar-mods`      | `[]`              | Filenames from shared/mods/, comma-separated               |
| `--memory`        | tier-based        | Heap size                                                  |
| `--tier`          | `ephemeral`       | ephemeral, semi-permanent, permanent                       |
| `--mode`          | `creative`        | creative, survival, adventure, spectator                   |
| `--seed`          | none              | World seed                                                 |
| `--motd`          | `"<Name> Server"` | Server MOTD                                                |
| `--no-bluemap`    | —                 | Disable BlueMap even if mods include it                    |
| `--svc`           | —                 | Enable SVC port mapping (validates no other server has it) |

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

## Phase 3b: Lifecycle Scripts ✅

Simple wrappers for day-to-day management. All bash (except mc-status which is Python).

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

### mc-archive ✅

```bash
mc-archive <name> [--confirm] [--force]
```

1. ✅ Stop the server
2. ✅ Tar + compress `servers/<name>/data/` to `shared/backups/<name>-<date>.tar.gz`
3. ✅ Run `mc-destroy` to clean up (removes from manifest, regenerates compose, etc.)
4. ✅ Print archive location

### Protection Level Enforcement ✅

- ✅ `mc-destroy`: ephemeral=immediate, semi-permanent=--confirm, permanent=refuses
- ✅ `mc-status`: shows tier prominently in output
- ✅ `mc-archive`: warns for permanent-tier servers (suggests backup system instead)
- ✅ `mc-archive` passes `--confirm`/`--force` through to `mc-destroy`

### World Import

Add to mc-create:

```bash
mc-create --name n19-copy --world ./N19-world.zip
mc-create --name creative-v2 --world-from creative
```

**Research notes:**

- Vanilla/Fabric worlds are structurally identical between singleplayer and server (same `level.dat`, `region/`, `DIM-1/`, `DIM1/`, etc.)
- Bukkit/Paper/Spigot splits dimensions into separate top-level folders (`world/`, `world_nether/`, `world_the_end/`). We don't handle this — if importing from Paper to Fabric, the user should restructure the zip manually first. (In practice, Paper-to-Paper imports won't need this.)
- The itzg image has a built-in `WORLD` env var that accepts a URL or local path to a ZIP/tar.gz. It searches the archive for `level.dat`, extracts the containing directory as the world. Supports `WORLD_INDEX` if multiple `level.dat` files exist. Only runs when data volume is empty (first start).

**Approach: delegate to itzg `WORLD` env var rather than custom extraction code.**

- `--world <path>` — mount the archive into the container and set `WORLD` env var pointing to it. Let itzg handle `level.dat` detection and extraction. For URLs, itzg handles download natively.
- `--world-from <server>` — copy `servers/<source>/data/` contents to the new server's data dir. Source server should be stopped first. This is simple file ops, no archive handling needed.

---

## Dependencies

- `python3-yaml` — PyYAML for reading/writing YAML manifests and generating compose (install via `apt install python3-yaml`, add to `setup.sh`)
- All other tools already installed (Docker, nginx, rcon-cli in containers)

## Open Questions (Resolved)

- **Env file regeneration**: Only on create. `mc-generate` never touches env files. ✅
- **BlueMap core.conf format**: A simple `accept-download: true\n` one-liner works. We pre-create it and also run a background poller as fallback in case BlueMap overwrites it. ✅
- **SVC port on stopped servers**: No validation needed — the port binding only matters when the container is running. ✅
- **MODRINTH_PROJECTS + MODS coexistence**: Not yet tested on a live server (needs a server with both modrinth mods and jar mods). To verify during Phase 3c or when first needed.

## Done When

### Phase 3a ✅
- ✅ `manifest.yml` defined and committed with mod groups + existing server entries
- ✅ `mc-generate` produces a working `docker-compose.yml` + nginx config
- ✅ `mc-create` creates a fully functional server from a single command
- ✅ `mc-destroy` removes a server cleanly
- ✅ Existing creative and test servers migrated to manifest-based generation
- ✅ BlueMap EULA handled automatically
- ✅ Scripts on PATH
- ✅ 80 passing tests covering all core logic

### Phase 3b ✅
- ✅ All lifecycle scripts work: start, stop, status, logs, console
- ✅ `mc-status` gives a clear overview of all servers

### Phase 3c ✅
- ✅ Can archive a server's world data before destroying
- ✅ Can import worlds from files/URLs/other servers (delegated to itzg WORLD env var)
- ✅ Protection levels enforced on destroy and archive
- ✅ 105 passing tests covering all core logic

---

## Manual Steps on the Server

After pulling this commit onto the VPS, run the following to bring the server in sync with the repo. Assumes you're SSH'd in as `danny` and working from `/opt/minecraft`.

### 1. Install python3-yaml

```bash
sudo apt-get install -y python3-yaml
```

(This was added to `setup.sh` but we can't re-run setup.sh on an existing server.)

### 2. Update bash environment (scripts on PATH)

`configure-bash.sh` is idempotent — re-run it to pick up the new PATH addition:

```bash
sudo bash /opt/minecraft/configure-bash.sh danny
```

Then reload your shell:

```bash
source ~/.bash_aliases
```

Verify scripts are on PATH:

```bash
which mc-generate
# Should print: /opt/minecraft/shared/scripts/mc-generate
```

### 3. Make scripts executable (if git didn't preserve permissions)

```bash
chmod +x /opt/minecraft/shared/scripts/mc-{generate,create,destroy,start,stop,status,logs,console}
```

### 4. Verify the generated compose matches what's deployed

The compose in the repo was generated by `mc-generate` and has some intentional differences from the previous hand-written version:

- `noisiumforked` mod added to creative (via fabric-base group)
- `Kam93` added to whitelist on all servers
- test server gets fabric-base mods, `MODE: creative`, `env_file`, and 3g memory limit (was 2560m)
- `DIFFICULTY` and `ENABLE_COMMAND_BLOCK` moved from compose to `servers/<name>/env` files

To apply the new compose and restart:

```bash
cd /opt/minecraft
op run --env-file=.env.tpl -- docker compose up -d
sudo nginx -t && sudo systemctl reload nginx
```

This will recreate containers that have changed config. The `creative` server will pick up noisiumforked on next mod download. The `test` server will get its new settings.

### 5. Verify

```bash
mc-status
mc-logs creative -n 20
mc-logs test -n 20
```

Check that both servers start and the BlueMap UIs are accessible at `https://map-creative.mc.danny.is` and `https://map-test.mc.danny.is`.

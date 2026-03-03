# Manifest System & Management Scripts

How servers are defined, how config files are generated, and how to use the `mc-*` commands.

## How It Works

`manifest.yml` is the single source of truth for all server definitions. The `mc-generate` script reads it and produces two generated files:

- `docker-compose.yml` — all Docker services (acme-dns, mc-router, MC servers)
- `nginx/conf.d/bluemap.conf` — reverse proxy config for BlueMap web UIs

**Never edit the generated files directly.** Edit `manifest.yml` (or use `mc-create`/`mc-destroy`), then run `mc-generate`.

The one thing the manifest does NOT control is per-server Minecraft settings like difficulty, view distance, command blocks, etc. Those go in `servers/<name>/env`, which is referenced via `env_file:` in the generated compose. The env file is created from a template when you run `mc-create` and is yours to edit freely.

**Important:** `environment:` in the compose overrides `env_file:`. Settings managed by the manifest (mode, memory, type, version, seed, motd, mods) are set in the compose `environment:` block and always win. Don't try to override them via the env file — edit `manifest.yml` and run `mc-generate` instead.

## Manifest Format

See the live `manifest.yml` at the repo root for the current state. The structure is:

```yaml
players:
  ops: [d2683803]
  whitelist: [d2683803, Kam93]

mod_groups:
  fabric-base:
    - fabric-api
    - lithium
    # ...

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
    # ...
```

### Players

The `players` block defines ops and whitelisted players for all servers. Usernames are Minecraft usernames. These are set as `OPS` and `WHITELIST` environment variables in every MC server container.

### Mod Groups

Named lists of Modrinth project slugs. Defined once, referenced by multiple servers. Avoids repeating the same mod list everywhere. Currently one group (`fabric-base` — performance mods), but more can be added.

### Server Fields

| Field                   | Default           | Description                                                 |
| ----------------------- | ----------------- | ----------------------------------------------------------- |
| `type`                  | `FABRIC`          | Server type: FABRIC, VANILLA, PAPER                         |
| `version`               | `LATEST`          | Minecraft version (e.g. `1.21.4`, `LATEST`, `25w08a`)       |
| `mode`                  | `creative`        | Game mode: creative, survival, adventure, spectator         |
| `memory`                | tier-based        | Java heap size (e.g. `2G`, `4G`)                            |
| `tier`                  | `ephemeral`       | Protection level (see below)                                |
| `mod_groups`            | `[]`              | Which named mod groups to include                           |
| `modrinth_mods`         | `[]`              | Additional Modrinth slugs (supports `slug:version` pinning) |
| `jar_mods`              | `[]`              | Filenames from `shared/mods/`                               |
| `modrinth_version_type` | `release`         | Modrinth release channel: release, beta, alpha              |
| `bluemap`               | auto-detected     | Whether BlueMap is enabled (inferred from mods if not set)  |
| `bluemap_port`          | auto-assigned     | Localhost port for BlueMap web UI (8100, 8101, ...)         |
| `svc`                   | `false`           | Whether Simple Voice Chat UDP port is mapped to this server |
| `seed`                  | `null`            | World seed (quote negative values)                          |
| `motd`                  | `"<Name> Server"` | Server MOTD                                                 |
| `backup`                | none              | Backup config (see Backups below). Auto-added for permanent tier by mc-create |
| `created`               | auto-set          | Creation date (set by mc-create)                            |

### Tiers

Tiers control resource defaults and deletion protection:

| Tier             | Default Memory | CPU Limit | Deletion                                  |
| ---------------- | -------------- | --------- | ----------------------------------------- |
| `ephemeral`      | 2G             | 1.0       | Immediate                                 |
| `semi-permanent` | 3G             | 1.5       | Requires `--confirm`                      |
| `permanent`      | 4G             | 2.0       | Refuses (change tier first, or `--force`) |

Container memory limit is always heap + 1G overhead (e.g. 4G heap = 5G limit).

### Mods

Three ways to get mods onto a server:

1. **Mod groups** — reference a named group from `mod_groups:`. The group's mods are expanded into the server's `MODRINTH_PROJECTS`.
2. **Modrinth mods** — individual Modrinth slugs in `modrinth_mods:`. Supports version pinning with `slug:version`.
3. **JAR mods** — filenames from `shared/mods/` in `jar_mods:`. The directory is mounted read-only into the container. Used for non-Modrinth mods, dev builds, or specific versions.

The generator merges groups + modrinth mods into `MODRINTH_PROJECTS`, and sets up volume mounts + `MODS` env var for JAR mods.

### Backups

Servers with a `backup:` block in the manifest get an `itzg/docker-mc-backup` sidecar container generated in `docker-compose.yml`. The sidecar handles scheduling, safe save coordination, compression, and pruning.

```yaml
servers:
  creative:
    backup:
      interval: 24h   # How often to back up (supports: 1h, 6h, 1d, etc.)
      keep: 3          # Number of backups to retain
```

**How it works:** The backup sidecar shares the MC server's `/data` volume (read-only) and uses RCON to safely pause writes during backup (`save-off` -> `save-all` -> backup -> `save-on`). Backups are compressed `.tgz` archives stored in `backups/<server-name>/`. JARs, cache, logs, and tmp files are excluded by default.

**Defaults from mc-create:** When creating a server with `--tier permanent`, backup config is auto-added (`interval: 24h, keep: 3`). Other tiers don't get backups by default — add a `backup:` block manually in the manifest if needed.

**Restoring from a backup:**

1. Stop the server: `mc-stop <name>`
2. Remove current data: `rm -rf servers/<name>/data/*`
3. Extract: `tar xzf backups/<name>/<backup-file>.tgz -C servers/<name>/data/ --strip-components=1`
4. Start the server: `mc-start <name>`

---

## Management Scripts

All scripts live in `shared/scripts/` and are on PATH via `~/.bash_aliases`. Python scripts use `mclib.py` for shared logic.

### mc-create

Create a new server. Adds to manifest, generates compose/nginx, creates server directory and env file.

```
mc-create --name <name> [options]
```

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
| `--world`         | none              | Import world from local file or URL (uses itzg WORLD env)  |
| `--world-from`    | none              | Copy world data from another server                        |

Does NOT start the server. Review `servers/<name>/env` first, then `mc-start <name>`.

If BlueMap is enabled, the EULA is pre-accepted automatically (with a background poller as fallback).

**Example:**

```bash
mc-create --name survival --mode survival --tier semi-permanent --modrinth-mods bluemap,simple-voice-chat --svc
# Review servers/survival/env, then:
mc-start survival
```

**World import examples:**

```bash
# Import from a URL (itzg downloads on first start)
mc-create --name n19-copy --world https://example.com/N19-world.zip

# Import from a local file (copied into server dir, itzg extracts on first start)
mc-create --name n19-copy --world ./N19-world.zip

# Copy world data from an existing server (source should be stopped)
mc-create --name creative-v2 --world-from creative
```

### mc-destroy

Remove a server with tier-based protection.

```
mc-destroy <name> [--confirm] [--force]
```

- Ephemeral servers: destroyed immediately
- Semi-permanent: requires `--confirm`
- Permanent: refuses unless `--force`

Stops the container, removes from manifest, regenerates compose/nginx, cleans up the server directory.

### mc-generate

Regenerate `docker-compose.yml` and `nginx/conf.d/bluemap.conf` from `manifest.yml`. Run this after manually editing the manifest.

```
mc-generate
```

Validates the generated compose with `docker compose config` before overwriting.

### mc-start / mc-stop

```bash
mc-start <name>       # Start one server (+ recreate mc-router for MAPPING)
mc-start              # Start all MC servers

mc-stop <name>        # Stop one server
mc-stop               # Stop all MC servers (not acme-dns or mc-router)
```

`mc-start` uses `op run` to inject secrets. `mc-stop` doesn't need it — Docker handles graceful shutdown.

### mc-status

Show status of all servers defined in the manifest.

```
mc-status
```

```
SERVER        TIER            STATE     MEMORY    PLAYERS  ADDRESS
creative      permanent       running   3.2G      1/20     creative.mc.danny.is
test          ephemeral       stopped   -         -        test.mc.danny.is
```

### mc-logs

```bash
mc-logs <name>                # Tail last 100 lines
mc-logs <name> --follow       # Follow live
mc-logs <name> -n 500         # Last 500 lines
```

### mc-archive

Archive a server's world data to a tarball, then destroy the server.

```bash
mc-archive <name> [--confirm] [--force]
```

Stops the server, compresses `servers/<name>/data/` to `shared/backups/<name>-<date>.tar.gz`, then runs `mc-destroy` to clean up. The `--confirm` and `--force` flags are passed through to `mc-destroy` for tier enforcement.

Warns if the server is permanent tier (suggests using the backup system instead).

### mc-console

Open an interactive RCON shell for a running server.

```bash
mc-console <name>
```

Type Minecraft commands directly, Ctrl+C to exit.

---

## Common Workflows

### Add a server

```bash
mc-create --name my-world --mode survival --tier ephemeral
# Edit servers/my-world/env if needed
mc-start my-world
```

### Change a server's mods or settings

Edit `manifest.yml`, then:

```bash
mc-generate
mc-stop my-world
mc-start my-world
```

### Remove a server

```bash
mc-destroy my-world              # ephemeral: immediate
mc-destroy my-world --confirm    # semi-permanent: needs confirmation
```

### Archive and remove a server

```bash
mc-archive my-world
# Archive saved to shared/backups/my-world-2026-03-02.tar.gz
```

### Change Minecraft settings (difficulty, view distance, etc.)

Edit `servers/<name>/env`, then restart:

```bash
mc-stop my-world && mc-start my-world
```

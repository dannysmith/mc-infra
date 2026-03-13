# mc-infra

> [!WARNING]
> This is a personal project for managing my own Minecraft servers. It's public for transparency and reference, but it's not designed for others to use. There's no support, no guarantees, and things may change or break without notice.

Self-hosted Minecraft server infrastructure on a single Hetzner Cloud VPS. Runs multiple Fabric servers via Docker, with subdomain-based routing, automatic mod management via Modrinth, BlueMap web UIs, automated backups, and a manifest-driven config system that generates everything from a single YAML file.

## Architecture

A single ARM VPS (Hetzner, Debian) running Docker Compose with:

- **MC servers** — [itzg/minecraft-server](https://github.com/itzg/docker-minecraft-server) containers (Fabric, vanilla, etc.)
- **Routing** — [itzg/mc-router](https://github.com/itzg/mc-router) routes Minecraft connections by subdomain on port 25565
- **Maps** — [BlueMap](https://bluemap.bluecolored.de/) web UIs served via Nginx reverse proxy with SSL
- **Backups** — [itzg/docker-mc-backup](https://github.com/itzg/docker-mc-backup) sidecars for scheduled world backups
- **SSL** — Wildcard Let's Encrypt cert via self-hosted [acme-dns](https://github.com/joohoi/acme-dns)

Players connect to `<server>.mc.danny.is:25565`. BlueMap UIs are at `https://map-<server>.mc.danny.is`. A web dashboard lives at `https://dashboard.mc.danny.is`.

## Project Structure

```
├── manifest.yml                    # Source of truth for all server definitions
├── docker-compose.yml              # Generated — do not edit directly
├── .env.tpl                        # 1Password secret references (resolved by op run)
├── setup.sh                        # Host provisioning (idempotent, run on fresh Debian)
├── setup-ssl.sh                    # SSL cert setup via acme-dns
├── servers/
│   └── <name>/
│       ├── env                     # Per-server Minecraft settings (editable)
│       └── data/                   # Bind-mounted container data (gitignored)
├── shared/
│   ├── scripts/                    # mc-* management commands (on PATH via .bash_aliases)
│   │   └── mclib.py                # Shared Python library for all scripts
│   ├── mods/                       # Shared JARs for non-Modrinth mods
│   └── templates/                  # Templates for new server creation
├── nginx/conf.d/
│   ├── bluemap.conf                # Generated — Nginx reverse proxy for BlueMap UIs
│   └── ssl.conf                    # SSL certificate paths
├── dashboard/                      # Web dashboard (Hono/Bun, systemd service)
├── acme-dns/                       # Self-hosted acme-dns (Dockerfile + config)
├── docs/                           # Architecture docs and task tracking
└── tests/                          # pytest suite
```

## Management Commands

All scripts live in `shared/scripts/` and are on PATH on the server. Python scripts use `mclib.py` for shared logic.

| Command                          | Description                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| `mc-create --name <name> [opts]` | Create a new server (adds to manifest, generates config, sets up directories)       |
| `mc-destroy <name>`              | Remove a server (tier-enforced — permanent servers require `--force`)               |
| `mc-archive <name>`              | Archive world data to tarball, then destroy the server                              |
| `mc-generate`                    | Regenerate `docker-compose.yml` and `nginx/conf.d/bluemap.conf` from `manifest.yml` |
| `mc-start [name]`                | Start one or all servers (injects secrets via `op run`)                             |
| `mc-stop [name]`                 | Stop one or all servers                                                             |
| `mc-status`                      | Show status, memory, player count, and address for all servers                      |
| `mc-logs <name>`                 | Tail server logs (`--follow` for live)                                              |
| `mc-console <name>`              | Interactive RCON shell                                                              |
| `mc-nether-roof [name]`          | Create BlueMap Nether Roof map config for one or all servers                        |
| `mc-cleanup`                     | Prune unused Docker images and build cache (runs weekly via cron)                   |

See [Manifest System & Scripts](docs/manifest-and-scripts.md) for full usage and options.

## Manifest System

`manifest.yml` is the single source of truth. It defines players, mod groups, and all server configurations. Running `mc-generate` reads the manifest and produces `docker-compose.yml` and `nginx/conf.d/bluemap.conf` — you never edit those generated files directly.

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
    tier: permanent
    memory: 4G
    mod_groups: [fabric-base]
    modrinth_mods: [bluemap, distanthorizons, simple-voice-chat]
    svc: true
    backup:
      interval: 24h
      keep: 3
```

Servers have three tiers controlling resource defaults and deletion protection:

| Tier             | Default Memory | Deletion                 |
| ---------------- | -------------- | ------------------------ |
| `ephemeral`      | 2G             | Immediate                |
| `semi-permanent` | 3G             | Requires `--confirm`     |
| `permanent`      | 4G             | Refuses unless `--force` |

Per-server Minecraft settings (difficulty, view distance, command blocks, etc.) go in `servers/<name>/env`, which is created from a template by `mc-create` and yours to edit. Settings managed by the manifest (mode, memory, type, version, mods) always override the env file.

## Fabric Modpack and JVM Flags

All servers use [Aikar's JVM flags](https://docs.papermc.io/paper/aikars-flags) (via `USE_AIKAR_FLAGS=true`) for optimised garbage collection.

The `fabric-base` mod group is a shared performance modpack applied to all Fabric servers:

- [Fabric API](https://modrinth.com/mod/fabric-api) — required by most Fabric mods
- [Lithium](https://modrinth.com/mod/lithium) — general server optimisation
- [FerriteCore](https://modrinth.com/mod/ferrite-core) — memory usage optimisation
- [C2ME](https://modrinth.com/mod/c2me-fabric) — concurrent chunk generation
- [ScalableLux](https://modrinth.com/mod/scalablelux) — multithreaded lighting engine
- [Noisium](https://modrinth.com/mod/noisiumforked) — faster world generation

Mods are downloaded from Modrinth automatically on container start. `REMOVE_OLD_MODS=TRUE` ensures stale JARs are cleaned up each restart. Non-Modrinth mods can be placed in `shared/mods/` and referenced via the `jar_mods` field.

## BlueMap

Servers with BlueMap in their mod list automatically get:

- A localhost port binding (8100, 8101, ...) for the BlueMap web server
- An Nginx reverse proxy block serving it at `https://map-<name>.mc.danny.is` with SSL, gzip, WebSocket support, and browser caching
- BlueMap's EULA pre-accepted so it starts without manual intervention

### Nether Roof Maps

`mc-nether-roof` creates a custom BlueMap map config that renders the nether from y=107 upward, showing builds on top of the bedrock ceiling. It writes a `world_nether_roof.conf` into the server's BlueMap maps directory. Run it after BlueMap has started at least once (so the maps directory exists).

## World Pre-generation

Servers with a `pregen` block get [Chunky](https://modrinth.com/mod/chunky) auto-installed and RCON lifecycle hooks that pre-generate chunks while a player is connected:

```yaml
servers:
  n19:
    pregen:
      radius: 1500  # blocks from world spawn
```

Chunky parameters are set on startup via RCON. Generation starts when the first player connects and pauses when they disconnect. On reconnect, it resumes. This works well with [Distant Horizons](https://modrinth.com/mod/distanthorizons) — DH builds LODs from the pre-generated chunks while you're connected.

## Backups

Servers with a `backup` block get an [itzg/docker-mc-backup](https://github.com/itzg/docker-mc-backup) sidecar that handles scheduling, safe save coordination (pause writes via RCON), compression, and pruning. Permanent-tier servers get daily backups by default when created with `mc-create`.

## Dashboard

A read-only web dashboard at `https://dashboard.mc.danny.is` for monitoring server status without SSH. Shows:

- **Overview** — host CPU/RAM/disk, all Docker container health, server list with status and resource usage
- **Server detail** — manifest config, runtime stats, disk usage breakdown by dimension, world data (seed, spawn, day/time, gamerules), per-player stats (position, health, play time, mobs killed, advancements), RCON command buttons, and live log streaming via WebSocket

Built with Hono (JSX) + HTMX + Tailwind CSS, running on Bun as a host systemd service (`mc-dashboard`), not a Docker container — this gives it direct access to host `/proc`, the Docker socket, and server filesystem. Nginx reverse-proxies with basic auth and SSL.

See `dashboard/CLAUDE.md` for the full project structure and development workflow.

## Mod Development

A dev workspace at `~/dev/` on the server supports Fabric mod development. Build mods with Gradle, copy the JAR into a test server's mods directory, restart, and iterate. When ready, either publish to Modrinth or add the JAR to `shared/mods/`.

See [Dev Workflow](docs/dev-workflow.md) for the full lifecycle.

## Quick Start

```bash
# Provision a Hetzner CAX21 (Debian 13) via Cloud Console, then:
git clone git@github.com:dannysmith/mc-infra.git /opt/minecraft
sudo /opt/minecraft/setup.sh
# Configure 1Password service account, update DNS A records if needed
cd /opt/minecraft && op run --env-file=.env.tpl -- docker compose up -d
sudo /opt/minecraft/setup-ssl.sh  # interactive on first run
```

## Docs

- [Manifest System & Scripts](docs/manifest-and-scripts.md) — full manifest reference and command usage
- [DNS, Routing & SSL](docs/dns-and-routing.md) — how connections, BlueMap, and cert renewal work
- [Server Details](docs/server-details.md) — VPS specs, network, installed software
- [Dev Workflow](docs/dev-workflow.md) — Fabric mod development lifecycle
- [Python & Testing](docs/python-and-testing.md) — test setup and conventions

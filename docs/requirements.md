# Minecraft VPS - Requirements & Plan

> Living document. The plan for setting up and managing a self-hosted Minecraft VPS alongside the existing WiseHosting "N19 Server".

## Context

The **N19 Server** stays on WiseHosting ($16.97/mo). It works, it's managed, no reason to move it.

This VPS is for **everything else**: creative worlds, experimentation, mod/plugin development, snapshot testing, copies of N19 for creative building, throwaway servers, etc. Max 1-2 concurrent players. Primarily Danny, occasionally Cam.

---

## 1. Hosting

### Decision: Hetzner Cloud

**Plan**: Start with **CAX21** (ARM, 4 vCPU, 8GB RAM, 80GB SSD, ~€6.49/mo) or **CCX13** (dedicated x86, 2 vCPU, 8GB RAM, 80GB SSD, ~€12.49/mo).

**Location**: Helsinki, Finland (hel1-dc2). ~40-50ms from UK - fine for 1-2 players. CAX21 was unavailable in Falkenstein/Nuremberg at time of provisioning.

### Decisions & Notes

**x86 vs ARM**: Research confirmed that `itzg/minecraft-server` supports ARM (`linux/arm64`), most Fabric mods are pure Java (no ARM issues), and Simple Voice Chat's `opus4j` has aarch64 native binaries. One caveat: C2ME's native math acceleration is disabled on aarch64 (falls back to pure Java — functional but slower chunk generation). Pre-generating worlds with Chunky mitigates this.

**Server family choice** — Geekbench 6 single-core scores (Minecraft is single-thread-bound):

| Plan | Type | GB6 Single-Core | Price |
|------|------|-----------------|-------|
| CCX13 | 2 dedicated x86 (AMD EPYC) | ~1396 | €12.49/mo |
| CAX21 | 4 shared ARM (Ampere Altra) | ~779 | €6.49/mo |
| CX33 | 4 shared x86 (Intel) | ~626 | €5.49/mo |

**CX (shared x86) is the worst option** — slower per-core than ARM and subject to noisy-neighbor variability. Skip it entirely.

**Decision: Start with CAX21 (ARM, €6.49/mo).** All mods work, the price is right for an experimentation server, and 4 cores helps with BlueMap rendering and chunk gen parallelism. If tick performance is a problem under load, **Rescale to CCX13** (dedicated x86, ~79% faster single-thread) — takes ~30s downtime, data preserved, fully reversible.

> **CRITICAL: Never upgrade disk size during a rescale operation.** Always select "CPU and RAM only". Upgrading the disk locks you out of downgrading to a smaller plan permanently. This is a one-way operation that Hetzner cannot reverse.

**Storage**: 80GB is fine for now. Structure directories so that data-heavy paths (worlds, BlueMap tiles, backups) can be trivially moved to a Hetzner Volume later without restructuring. Volumes are separate mount points at ~€0.044-0.052/GB/mo (min 10GB, max 10TB, same datacenter only, can resize upward only).

**Domain**: `mc.danny.is` subdomains via DNSimple. DNSimple supports API-based DNS management, which enables certbot DNS-01 challenges for wildcard SSL certs (`*.mc.danny.is`). Servers accessible as `creative.mc.danny.is`, maps as `map-creative.mc.danny.is`, etc.

---

## 2. OS & Base System

### Decision: Debian 13 (Trixie)

Leaner than Ubuntu, recommended by setupmc.com, available as a Hetzner one-click image. All the tooling we need (Docker, Nginx, JDK 21, etc.) is well-supported on Debian. Debian 13 was the current stable at time of provisioning.

### Base Setup

- SSH key auth only (disable password auth)
- Non-root user with sudo
- Automatic security updates (`unattended-upgrades`)
- Timezone set to UTC (simpler for logs/cron)
- Basic monitoring: at minimum, disk space alerts

### OS Maintenance

- `unattended-upgrades` handles security patches automatically
- Periodic manual `apt upgrade` for non-security updates (monthly-ish)
- Hetzner snapshots before major OS upgrades as a safety net
- Consider a simple script/alias that shows system status: disk usage, RAM, running containers, uptime

### Reproducibility: Setup Script, Not IaC

No Terraform or Ansible — overkill for a single server. The host-level config (packages, firewall, directory structure) is ~50 lines of setup. Instead:

- A single **`setup.sh`** script, version-controlled alongside `docker-compose.yml`
- Idempotent (safe to re-run): `apt install -y`, `ufw allow`, `mkdir -p` are all naturally re-runnable
- If the server needs rebuilding: provision a fresh Debian box in Hetzner Console, `scp setup.sh`, run it
- **Docker Compose is the IaC for the application layer** — that's where all the complexity lives

This gives reproducibility without the overhead of learning/maintaining IaC tooling. If host config changes become frequent, Ansible is a natural upgrade path later.

---

## 3. Firewall & Networking

### Firewall (UFW)

Whitelist only what's needed:

| Port | Service | Exposure |
|---|---|---|
| 22 (or custom) | SSH | Restricted to known IPs if practical, otherwise open |
| 25565 | Minecraft (mc-router) | Public |
| 80/443 | Nginx (BlueMap web UIs, panel) | Public |
| 24454 | Simple Voice Chat (UDP) | Public |

All other ports blocked by default. Internal Docker networking handles container-to-container communication.

### Reverse Proxy (Nginx)

- Nginx as reverse proxy for all HTTP services
- Let's Encrypt via certbot for automatic SSL
- Subdomains for each BlueMap instance: `map-creative.mc.danny.is`, `map-n19copy.mc.danny.is`, etc.
- Rate limiting on public BlueMap endpoints (they serve static tiles, but we don't want them hammered)
- Optional: Basic auth or IP whitelisting on any admin-facing web UIs

### Minecraft Routing (mc-router)

- `itzg/mc-router` container routes Minecraft connections by subdomain on port 25565
- Players connect to `creative.mc.danny.is`, `test.mc.danny.is`, etc.
- mc-router config should be auto-generated from the list of active servers (not manually maintained)
- Simple Voice Chat uses UDP on port 24454. Only one server will have SVC active at a time, so a single port suffices.

### Decisions & Notes

**DDoS**: Not a concern. Hetzner's included basic DDoS protection is sufficient for a whitelisted server with 1-2 players.

**Simple Voice Chat**: Only one server will have SVC active at a time, so a single UDP port (24454) is sufficient. No complex port mapping needed.

---

## 4. Software Stack

### Core (installed on host via apt/official repos)

- **Docker Engine + Docker Compose** (from Docker's official repo, not Ubuntu's)
- **Nginx** (reverse proxy - runs on host, not in Docker, for simplicity)
- **certbot** (Let's Encrypt SSL)
- **UFW** (firewall)
- **git**
- **1Password CLI (`op`)** (secrets management)
- **curl, wget, jq, htop, tmux** (standard utilities)

### Development Tools (installed on host)

- **Python 3** (comes with Ubuntu/Debian) + **uv** (preferred over pip/pipx)
- **Bun** (preferred over Node.js for personal projects)
- **JDK 21** (for Fabric mod development / Gradle builds)
- **gh** (GitHub CLI)
- **Claude Code** (for remote management and development)

### In Docker (not on host)

- `itzg/minecraft-server` (MC server instances)
- `itzg/mc-backup` (backup sidecars)
- `itzg/mc-router` (Minecraft connection routing)

### Secrets Management: 1Password

All secrets managed via **1Password** with the `op` CLI. Secrets are fetched at runtime and never stored on disk (except Claude Code's `auth.json` — see below).

**Setup:**
1. Create a **"MC Server"** vault in 1Password
2. Store secrets there: GH PAT, DNSimple API token, RCON passwords, etc.
3. Create a [service account](https://developer.1password.com/docs/service-accounts/) scoped to that vault
4. Install `op` CLI on the VPS, set `OP_SERVICE_ACCOUNT_TOKEN` (the one secret that does live on disk, in `~/.secrets/op` with `chmod 600`)
5. Use `op run --env-file=.env.tpl` to inject secrets at runtime

Example `.env.tpl`:
```
GH_TOKEN=op://MC Server/github-pat/credential
DNSIMPLE_TOKEN=op://MC Server/dnsimple/api-token
RCON_PASSWORD=op://MC Server/rcon/password
```

See [vps-auth-research.md](./vps-auth-research.md) for full background research.

### CLI Authentication

**Claude Code (Max plan)**: Authenticate locally with `claude /login`, then transfer `~/.config/claude-code/auth.json` to the VPS via `scp`. This uses the Max subscription (no API charges). The token is not machine-bound but may expire periodically, requiring re-transfer. This is the one credential that must live on disk as a file — everything else goes through `op`.

**GitHub CLI**: Fine-grained PAT stored in 1Password, injected via `op run` into `GH_TOKEN`. Scope to only needed repos, set 90-day expiry.

---

## 5. Minecraft Server Setup

### Architecture: Docker Compose with itzg/minecraft-server

Each Minecraft "server" is a service in a Docker Compose file. The entire setup is defined in YAML and version-controlled.

### Directory Structure (proposed)

```
/opt/minecraft/
  docker-compose.yml          # Single compose file: all servers, mc-router, backup sidecars
  servers/
    creative/
      data/                   # Mounted as /data in container (world, mods, configs)
      env                     # Environment overrides for this server
    n19-copy/
      data/
      env
    test-snapshot/
      data/
      env
  shared/
    modpacks/
      default-fabric/         # The "standard" mod collection (see section 6)
      vanilla/                # No mods
      heavy/                  # Default + extra heavy mods
    scripts/                  # Management scripts (mc-create, mc-status, etc.)
    backups/                  # Local backup storage (easy to move to a Volume later)
    templates/                # Server templates for quick setup
  nginx/
    conf.d/                   # Auto-generated Nginx configs per server
  dev/                        # Mod/plugin development projects (see section 13)
```

> **Volume migration note**: The `servers/`, `shared/backups/`, and BlueMap tile directories are the likely candidates for moving to a Hetzner Volume if 80GB gets tight. The directory structure above keeps them isolated for easy migration.

### Server Lifecycle

- **Create**: Run a setup script that copies a template, sets env vars, optionally loads a world file, and adds the server to the compose setup
- **Start**: `docker compose up -d <server-name>` (or a wrapper script)
- **Stop**: `docker compose stop <server-name>`
- **Destroy**: Script that stops the server, optionally archives the data, removes the compose entry
- **Archive**: Compress world data + configs to a tarball, move to archive storage

### Server Configuration via Environment

Each server's `env` file controls:
- `TYPE` (FABRIC, PAPER, VANILLA, etc.)
- `VERSION` (1.21.4, latest snapshot, etc.)
- `MEMORY` (2G, 4G, etc.)
- `MODPACK` or mod list reference
- `WORLD` (path to world data if importing)
- Custom JVM flags (Aikar's flags by default, or MeowIce's updated flags for Java 17+ - see setupmc.com recommendations)
- `JVM_OPTS` / `JVM_XX_OPTS` env vars for additional JVM tuning

### Decisions & Notes

**Compose structure**: Single `docker-compose.yml` with all servers and shared services (mc-router, etc.) defined together. Resource limits per container to prevent one runaway server from exhausting host resources. This is simpler to manage than multiple compose files while still allowing per-server configuration via env files.

**Docker networking**: All MC server containers on a shared `minecraft-net` bridge network so mc-router can reach them.

**Resource limits**: Yes — set `mem_limit` and `cpus` per container. Example: a standard server gets `mem_limit: 5g` (4G heap + ~1G overhead) and `cpus: 2.0`. Ephemeral/test servers get tighter limits.

---

## 6. Mod Management

### The "Default Modpack" Concept

A curated set of mods shared by most servers. Stored in `shared/modpacks/default-fabric/` and symlinked or copied into each server's `data/mods/` directory.

**Default Fabric Modpack (proposed)**:
- Fabric API
- Lithium (general optimization)
- FerriteCore (memory optimization)
- Noisium (world gen optimization)
- ScalableLux (lighting optimization)
- C2ME (chunk loading optimization - not currently on N19 but recommended)
- Distant Horizons (server-side LOD generation)
- BlueMap (web map)
- Simple Voice Chat

**Variant packs**:
- `vanilla` - no mods at all
- `perf-only` - just the performance mods (no DH, BlueMap, SVC)
- `default-fabric` - the full standard set above
- `heavy` - default + any experimental/heavy mods
- Custom per-server overrides (add/remove individual mods)

### Mod Version Management

- Keep a `mod-versions.json` or similar manifest that tracks mod name, version, Modrinth/CurseForge ID, and target MC version for each modpack
- Script to check for mod updates via Modrinth API and report available upgrades
- Script to download/update mods for a given pack
- When upgrading MC version, the script should check compatibility of all mods in the pack

### Mod Installation Mechanics

`itzg/minecraft-server` supports several mod installation approaches:
- `MODS` env var: comma-separated URLs to mod JARs (downloaded on startup)
- `MODRINTH_PROJECTS` env var: list of Modrinth project slugs (auto-downloaded)
- Volume mount: mount a local `mods/` directory into the container
- Modpack files: CurseForge/Modrinth modpack zip files

**Proposed approach**: Volume-mount a mods directory for each server. The mods directory is populated by a setup script from the chosen modpack template, with per-server overrides applied on top. This gives us full control and avoids re-downloading on every container restart.

### Open Questions

- [ ] **Symlinks vs copies for shared mods?** Symlinks are cleaner (update once, affects all servers) but Docker volume mounts and symlinks can be finicky. Hard links might work. Or just copy and accept slight duplication.
- [ ] **Mod config files**: Many mods have configs in `config/`. Should modpack templates include default configs (e.g. BlueMap render distance, DH thread count)?
- [ ] **Client-side mod sync**: When Cam or Danny connects, they need matching client-side mods. AutoModpack can sync these automatically. Worth including in the default pack?

---

## 7. Backups

### Strategy: Tiered Based on World Importance

| Tier | Description | Example | Local Backup | Off-site | Retention |
|---|---|---|---|---|---|
| **Permanent** | Worlds we care about | Creative World, N19 Copy | Every 6h | Daily to B2 | 30 days local, 90 days off-site |
| **Semi-permanent** | Experimental but worth keeping | Long-running test world | Daily | Weekly to B2 | 7 days local, 30 days off-site |
| **Ephemeral** | Throwaway / testing | Snapshot test, mod test | None (or manual) | None | N/A |

### Implementation

- **itzg/docker-mc-backup** sidecar for each "permanent" and "semi-permanent" server
  - Uses RCON to coordinate save-off/save-all/save-on
  - Tar archives with compression
  - Configurable schedule and retention
- **Off-site**: rclone to Backblaze B2 (~$0.005/GB/month) on a cron schedule
  - Only for permanent/semi-permanent tiers
  - Incremental with restic for storage efficiency
- **Config backups**: Separate cron job that backs up:
  - All docker-compose files
  - All env files
  - Nginx configs
  - Scripts directory
  - The entire `/opt/minecraft/shared/` directory
  - This is small data - can go to B2 daily or even to a git repo

### Storage Efficiency

- Use tar.gz compression for local backups
- Consider restic for deduplicated incremental backups (great for Minecraft worlds which change incrementally)
- Set world borders on non-ephemeral worlds to limit growth
- BlueMap tile compression enabled by default
- Periodic cleanup of old DH LOD data (`distant_horizons/` folder in world data)
- Script to report storage usage by server/component

### Decisions & Notes

Backup strategy accepted as proposed above. Details to finalise during implementation (choice of B2 vs Hetzner object storage, whether to git-version configs, backup restoration testing).

---

## 8. Routing & Port Exposure

### Minecraft Connections (mc-router)

```
Player connects to creative.mc.danny.is:25565
  -> mc-router (listening on 25565)
  -> routes to creative-server container on internal Docker network
```

- mc-router configuration should be **auto-generated** from active server definitions
- When a server is started/stopped, the routing config updates
- mc-router supports `MAPPING` env var or API-based config

### Web Services (Nginx)

```
Browser visits https://map-creative.mc.danny.is
  -> Nginx (443)
  -> reverse proxy to creative-server's BlueMap on internal port 8100
```

- Each server with BlueMap gets a subdomain
- Nginx config auto-generated alongside mc-router config
- SSL via Let's Encrypt wildcard cert for `*.mc.danny.is` (simplest approach)

### Simple Voice Chat

- UDP port 24454 — only one server has SVC active at a time
- Needs to be exposed directly (can't be proxied through mc-router)
- SVC config inside each server must match the externally exposed port

### Decisions & Notes

**Wildcard SSL**: DNSimple supports API-based DNS challenges. Use certbot with the `certbot-dns-dnsimple` plugin for automatic wildcard cert issuance/renewal for `*.mc.danny.is`. Store the DNSimple API token in `~/.secrets/`.

**mc-router dynamic config**: To be validated during implementation. mc-router supports both `MAPPING` env var and API-based config — the API approach allows updates without restart.

---

## 9. Web Panel / Dashboard (Deferred)

**Status: Deferred.** Use CLI commands (`mc-status`, `mc-logs`, etc.) initially. Revisit as an optional final phase once everything else is working.

### Concept (for when we get to it)

Lightweight, custom, read-mostly dashboard. Not Pterodactyl/Crafty (overkill). Likely a small Bun/Hono server or Python script that queries the Docker API and RCON, served by Nginx behind basic auth. Details to be designed when the time comes.

---

## 10. Server Templates & Rapid Experimentation

### Goal: Spin Up a New MC Server in Under a Minute

A setup script (e.g. `mc-create`) that:

```bash
mc-create --name test-snapshot \
          --type FABRIC \
          --version 25w08a \
          --modpack default-fabric \
          --memory 3G \
          --tier ephemeral
```

This would:
1. Create the directory structure under `servers/test-snapshot/`
2. Add a service entry to the main `docker-compose.yml`
3. Generate the `env` file with server-specific overrides
4. Copy mods from the specified modpack into `data/mods/`
5. Optionally import a world file (from local path, URL, or existing server)
6. Register with mc-router (add routing entry)
7. Generate Nginx config if BlueMap is in the modpack
8. Print the connection address and management commands

### Corresponding Teardown Script

```bash
mc-destroy test-snapshot              # Removes everything
mc-archive test-snapshot              # Archives world data first, then removes
mc-stop test-snapshot                 # Just stops it, keeps everything
```

### Protection Levels

- **Ephemeral**: Can be destroyed without confirmation
- **Semi-permanent**: Requires `--confirm` flag to destroy
- **Permanent**: Requires `--confirm --force` and prints a warning. Cannot be destroyed via `mc-destroy` at all - must be manually downgraded first

### Importing Worlds

- From a local file: `mc-create --name n19-copy --world ./N19-world-download.zip`
- From the WiseHosting N19 server: Script that SFTPs the world data from WiseHosting (if accessible) or instructions for manual download
- From another server on this VPS: `mc-create --name creative-v2 --world-from creative`

### Open Questions

- [ ] **Script language?** Bash is simplest but gets unwieldy. Python with click/typer would be cleaner. Could also be a Makefile-based approach.
- [ ] **Server naming conventions?** Alphanumeric + hyphens, used for Docker container names, subdomains, and directory names.

---

## 11. Maintenance Tooling

### Server Management Scripts

| Script | Purpose |
|---|---|
| `mc-create` | Create a new server from template |
| `mc-destroy` / `mc-archive` | Remove or archive a server |
| `mc-start` / `mc-stop` / `mc-restart` | Server lifecycle |
| `mc-status` | Show status of all servers |
| `mc-logs <server>` | Tail logs for a server |
| `mc-console <server>` | Attach to server console (RCON) |
| `mc-backup <server>` | Trigger an immediate backup |
| `mc-update-mods <modpack>` | Check for and apply mod updates |
| `mc-disk-report` | Storage usage breakdown by server/component |

### OS Maintenance

| Script | Purpose |
|---|---|
| `mc-host-status` | System health: disk, RAM, CPU, Docker status, uptime |
| `mc-host-update` | Run apt upgrade (with confirmation), restart if needed |
| `mc-host-cleanup` | Docker image prune, old backup cleanup, log rotation |

### Data Cleanup

- **Distant Horizons LOD data** can grow large. Script to identify and clean DH data for worlds that are archived or no longer active
- **BlueMap tiles** for old/removed worlds should be cleaned up
- **Docker images**: Old MC server images accumulate. Periodic `docker image prune`
- **Backup rotation**: Enforce retention policies, delete expired backups

### Claude Code Integration

- These scripts should be well-documented so Claude Code can discover and use them
- Consider a CLAUDE.md in `/opt/minecraft/` that describes the setup and available tools
- Claude Code sessions on the VPS can help with: troubleshooting, config changes, mod updates, writing new scripts, reading logs

### Open Questions

- [ ] **RCON access**: itzg/minecraft-server exposes RCON. We should have a consistent RCON password strategy (per-server or shared?) and a simple wrapper for sending RCON commands.
- [ ] **Log aggregation**: Docker logs are per-container. Do we want a unified log view? Probably overkill initially - `docker compose logs -f` works.
- [ ] **Alerting**: Do we want notifications (Discord webhook? Email?) if a server crashes or disk gets full?

---

## 12. Security

### Server Hardening (Standard VPS Stuff)

- SSH key-only auth (no passwords)
- Non-root user for daily operations
- UFW firewall with minimal open ports (see section 3)
- fail2ban for SSH brute-force protection
- Automatic security updates via unattended-upgrades
- Regular review of open ports / running services

### Minecraft Security

- All servers whitelisted by default (`WHITELIST=true`, `ENFORCE_WHITELIST=true`)
- RCON not exposed externally (Docker internal network only)
- Server console not exposed externally
- `OPS` list tightly controlled

### Web Security

- BlueMap web UIs: public is fine (read-only map data), but rate-limited via Nginx
- Dashboard/panel: behind basic auth at minimum, ideally IP-restricted or behind Tailscale
- No admin functionality exposed to the public internet
- HTTPS everywhere (Let's Encrypt)

### Docker Security

- Don't run containers as root where avoidable (itzg images handle this)
- Keep Docker and images updated
- Don't mount the Docker socket into containers (unless absolutely necessary)
- Resource limits on containers to prevent a single server from exhausting host resources

### Open Questions

- [ ] **Tailscale**: Would simplify a lot of security (SSH only via Tailscale, dashboard only via Tailscale). Adds a dependency but is very low-friction. Worth considering.
- [ ] **Hetzner firewall**: Hetzner offers cloud firewall rules at the infrastructure level (before packets hit the VPS). Should we use this as an additional layer?

---

## 13. Mod & Plugin Development

### Overview

Developing server-side Fabric mods and BlueMap plugins is done with standard Java/Gradle tooling. The typical workflow is:

1. **Scaffold** a project using the [Fabric template generator](https://fabricmc.net/develop/template/)
2. **Edit code** (locally with IntelliJ, or remotely via SSH/Claude Code)
3. **Build** with `./gradlew build` (produces a JAR)
4. **Deploy** by copying the JAR to a test server's `mods/` directory
5. **Test** by restarting the server and connecting with a Minecraft client
6. For BlueMap addons: `/bluemap reload` re-triggers addon initialization without full restart

### Development on the VPS

This is practical and has some advantages:

- **JDK 21** installed on the host (see section 4)
- Gradle builds work headless (`./gradlew build` from SSH/Claude Code)
- First build downloads MC jars + mappings (~1-2 min), subsequent builds ~10-15s
- Deploy to a running test server on the same machine: copy JAR, restart container
- Connect a Minecraft client from local machine to the VPS to test
- BlueMap web UI accessible via browser to verify map addons

### Development Workflow (Proposed)

```
/opt/minecraft/dev/
  my-bluemap-addon/          # Gradle project
    src/
    build.gradle.kts
    ...
  my-fabric-mod/
    src/
    build.gradle.kts
    ...
```

- Dev projects live in `/opt/minecraft/dev/`
- Each has its own git repo
- A dev-test server in `servers/dev-test/` is configured for rapid iteration
- Script: `mc-dev-deploy my-bluemap-addon dev-test` - builds the project and copies the JAR to the test server's mods dir, then restarts the server

### Faster Iteration

- **JVM Hot Swap**: For method-body-only changes, attach a remote debugger (JDWP) and hot-swap classes without restart
- **Enhanced Class Redefinition**: Using JetBrains Runtime JDK with `-XX:+AllowEnhancedClassRedefinition` allows adding/removing methods without restart
- **BlueMap-specific**: `/bluemap reload` re-triggers `onEnable`/`onDisable` callbacks, re-creating all markers without server restart
- **Data pack changes**: `/reload` command reloads recipes, loot tables, tags without restart

### BlueMap API Specifics

- Add as `compileOnly` dependency (never bundle it):
  ```kotlin
  dependencies {
      compileOnly("de.bluecolored:bluemap-api:2.7.7")
  }
  ```
- Entry point: `BlueMapAPI.onEnable(api -> { ... })`
- Markers are non-persistent - must be recreated on every enable
- Multiple maps per world are possible - don't assume 1:1
- Reference: [BlueMap-Essentials](https://github.com/pop4959/BlueMap-Essentials)

### Open Questions

- [ ] **Local vs remote development?** For serious mod development, a local IntelliJ setup with `./gradlew runServer` is probably smoother (debugger, autocomplete, etc.). The VPS is better for integration testing and running a persistent dev server. Both workflows should be supported.
- [ ] **CI/CD?** Overkill for personal mods, but a git hook that auto-builds and deploys to the dev-test server on push would be neat.
- [ ] **Fabric Game Test Framework**: For server-side mods, Fabric supports automated testing without a client. Worth exploring for anything non-trivial.

---

## 14. Implementation Phases

A rough ordering of how to bring this up. Not committing to timescales.

### Phase 1: Foundation
- Provision Hetzner VPS (CAX21, Debian 12, Falkenstein or Nuremberg)
- Write `setup.sh`: OS hardening, firewall, Docker, Nginx, dev tools, 1Password CLI, directory structure
- Run `setup.sh` on the fresh box
- Configure 1Password vault + service account
- Domain DNS configured (`mc.danny.is` via DNSimple)
- First test: single Fabric server running with default mods, connectable from local client

### Phase 2: Multi-Server & Routing
- mc-router setup
- Nginx reverse proxy + SSL
- BlueMap accessible via web
- Second server to prove multi-server works
- Simple Voice Chat port mapping tested

### Phase 3: Tooling
- `mc-create` / `mc-destroy` / `mc-archive` scripts
- Modpack template system
- Basic `mc-status` reporting
- World import working (local file, WiseHosting download)

### Phase 4: Backups & Resilience
- itzg/mc-backup configured for permanent worlds
- Off-site backup to B2 via rclone/restic
- Config backup to git or B2
- Backup restoration tested

### Phase 5: Development Setup
- JDK 21 + Gradle on host
- Dev project directory structure
- `mc-dev-deploy` script
- Test with a simple BlueMap addon

### Phase 6 (Optional): Dashboard & Polish
- Web dashboard (deferred — use CLI scripts initially)
- Mod update checking automation
- Disk usage reporting
- Documentation (CLAUDE.md for the VPS)

---

## Appendix: Project Research Documents

- [Hosting Provider Research](./minecraft-hosting-research.md) — Comparison of VPS and MC-specific hosting providers
- [VPS Auth Research](./vps-auth-research.md) — Claude Code, gh CLI, and secrets management on headless Linux

## Appendix: Reference Links

- [itzg/minecraft-server Docker Hub](https://hub.docker.com/r/itzg/minecraft-server)
- [itzg/minecraft-server docs](https://itzg.github.io/docker-minecraft-docs/)
- [itzg/mc-router GitHub](https://github.com/itzg/mc-router)
- [itzg/docker-mc-backup GitHub](https://github.com/itzg/docker-mc-backup)
- [BlueMap Wiki](https://bluemap.bluecolored.de/wiki/)
- [BlueMap API Wiki](https://github.com/BlueMap-Minecraft/BlueMapAPI/wiki)
- [Fabric Mod Dev Setup](https://docs.fabricmc.net/develop/getting-started/setting-up)
- [Fabric Template Generator](https://fabricmc.net/develop/template/)
- [SetupMC Java Server Configurator](https://setupmc.com/java-server/)
- [SetupMC: Hetzner Cloud Setup Guide](https://setupmc.com/guides/minecraft-server-with-docker-on-hetzner-cloud/)
- [SetupMC: Backup Guide](https://setupmc.com/backup-guide/)
- [Hetzner Cloud](https://www.hetzner.com/cloud/)
- [Aikar's JVM Flags](https://docs.papermc.io/paper/aikars-flags)

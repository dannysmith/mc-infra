# MC Infrastructure

Self-hosted Minecraft server infrastructure on Hetzner Cloud (Debian 12, Docker Compose).

## What This Is

A single VPS running multiple Minecraft servers via Docker. Used for creative worlds, experimentation, mod/plugin development, and throwaway servers. Max 1-2 concurrent players.

The existing "N19 Server" on WiseHosting is separate and not managed here.

## Architecture

- **Host**: Hetzner Cloud CAX21 (ARM, Debian 12)
- **MC servers**: `itzg/minecraft-server` containers (Fabric, vanilla, etc.)
- **Routing**: `itzg/mc-router` routes by subdomain on port 25565
- **Web**: Nginx reverse proxy for BlueMap UIs, SSL via Let's Encrypt wildcard for `*.mc.danny.is`
- **Backups**: `itzg/docker-mc-backup` sidecars + offsite via rclone
- **Secrets**: 1Password CLI (`op run` with `.env.tpl`)

## Key Files

- `setup.sh` — Host provisioning script (idempotent, run on fresh Debian box)
- `docker-compose.yml` — All services: mc-router, MC servers, backup sidecars
- `.env.tpl` — 1Password secret references (resolved at runtime by `op run`)
- `servers/<name>/env` — Per-server environment overrides
- `shared/scripts/` — Management scripts (`mc-create`, `mc-status`, etc.)
- `shared/modpacks/` — Mod collections with manifests
- `shared/templates/` — Templates for new server creation
- `nginx/conf.d/` — Auto-generated Nginx configs per server
- `docs/` — Requirements doc, research, reference material

## Task Management

Tasks live in `docs/tasks-todo/` and `docs/tasks-done/`.

- **Pending tasks**: `docs/tasks-todo/task-<priority>-<slug>.md` — priority is a number (1 = highest) or `x` for unprioritised
- **Completed tasks**: `docs/tasks-done/<ISO-date>-task-<slug>.md` — prefixed with completion date, moved from tasks-todo

Work through tasks in priority order (lowest number first). When completing a task, prefix the filename with today's ISO date and move it to `docs/tasks-done/`.

## Management Scripts

All scripts live in `shared/scripts/` and are symlinked into PATH during setup.

| Script | Purpose |
|--------|---------|
| `mc-create` | Create a new server from template |
| `mc-destroy` / `mc-archive` | Remove or archive a server |
| `mc-start` / `mc-stop` | Server lifecycle |
| `mc-status` | Show status of all servers |
| `mc-logs <server>` | Tail logs for a server |
| `mc-console <server>` | Attach to server console (RCON) |
| `mc-backup <server>` | Trigger an immediate backup |
| `mc-update-mods <modpack>` | Check for and apply mod updates |

## Conventions

- Server names: lowercase alphanumeric + hyphens (used as Docker container names, subdomains, and directory names)
- Server tiers: `ephemeral` (no backups, easy delete), `semi-permanent` (daily backups), `permanent` (6h backups, deletion safeguards)
- All MC servers share a `minecraft-net` Docker bridge network
- Resource limits set per container in docker-compose.yml
- Secrets never stored in plain text — use 1Password (`op run`) or `auth.json` for Claude Code

# MC Infrastructure

Self-hosted Minecraft server infrastructure on Hetzner Cloud (Debian 13, Docker Compose).

## What This Is

A single VPS running multiple Minecraft servers via Docker. Used for creative worlds, experimentation, mod/plugin development, and throwaway servers. Max 1-2 concurrent players.

The existing "N19 Server" on WiseHosting is separate and not managed here.

## Architecture

- **Host**: Hetzner Cloud CAX21 (ARM, Debian 13 Trixie)
- **MC servers**: `itzg/minecraft-server` containers (Fabric, vanilla, etc.)
- **Routing**: `itzg/mc-router` routes by subdomain on port 25565
- **Web**: Nginx reverse proxy for BlueMap UIs, SSL via Let's Encrypt wildcard for `*.mc.danny.is`
- **SSL**: Self-hosted acme-dns for DNS-01 cert renewal (no DNS provider credentials on VPS)
- **Backups**: `itzg/docker-mc-backup` sidecars + offsite via rclone
- **Secrets**: 1Password CLI (`op run` with `.env.tpl`)

## Key Files

- `manifest.yml` — **Source of truth** for all server definitions and mod groups
- `docker-compose.yml` — **Generated** by `mc-generate` from manifest (do not edit directly)
- `nginx/conf.d/bluemap.conf` — **Generated** by `mc-generate` (do not edit directly)
- `setup.sh` — Host provisioning script (idempotent, run on fresh Debian box)
- `setup-ssl.sh` — SSL cert setup via acme-dns (interactive on first run)
- `.env.tpl` — 1Password secret references (resolved at runtime by `op run`)
- `servers/<name>/env` — Per-server Minecraft settings (user-editable, not generated)
- `acme-dns/` — Dockerfile (builds from source for ARM) and config for self-hosted acme-dns
- `shared/scripts/mclib.py` — Shared Python library for all management scripts
- `shared/scripts/` — Management scripts (`mc-create`, `mc-generate`, etc.)
- `shared/mods/` — Shared JAR files for non-Modrinth mods
- `shared/templates/` — Templates for new server creation
- `nginx/conf.d/` — Nginx reverse proxy and SSL configs
- `docs/` — Reference docs (see `docs/manifest-and-scripts.md` for the manifest system, `docs/dns-and-routing.md` for routing/SSL)

## Task Management

Tasks live in `docs/tasks-todo/` and `docs/tasks-done/`.

- **Pending tasks**: `docs/tasks-todo/task-<priority>-<slug>.md` — priority is a number (1 = highest) or `x` for unprioritised
- **Completed tasks**: `docs/tasks-done/<ISO-date>-task-<slug>.md` — prefixed with completion date, moved from tasks-todo

Work through tasks in priority order (lowest number first). When completing a task, prefix the filename with today's ISO date and move it to `docs/tasks-done/`.

## Management Scripts

All scripts live in `shared/scripts/` and are on PATH via `~/.bash_aliases`. Python scripts use `mclib.py` for shared logic. See `docs/manifest-and-scripts.md` for full usage details.

| Script                 | Language | Purpose                                                        |
| ---------------------- | -------- | -------------------------------------------------------------- |
| `mc-generate`          | Python   | Regenerate compose + nginx from manifest                       |
| `mc-create`            | Python   | Create a new server (adds to manifest, generates, sets up dir) |
| `mc-destroy`           | Python   | Remove a server (tier-enforced deletion)                       |
| `mc-archive`           | Python   | Archive world data to tarball, then destroy                    |
| `mc-status`            | Python   | Show status of all servers                                     |
| `mc-start` / `mc-stop` | Bash     | Start/stop servers                                             |
| `mc-logs <server>`     | Bash     | Tail logs for a server                                         |
| `mc-console <server>`  | Bash     | Attach to server console (RCON)                                |

## Players

| Player | Username   | UUID                                   |
| ------ | ---------- | -------------------------------------- |
| Danny  | `d2683803` | `ee7ca56d-5238-4226-89a3-9db69f2800f5` |
| Cam    | `Kam93`    | `6476f3d3-13ca-4c7d-84b8-dab9c317184b` |

Danny is OP on all servers. Both players are whitelisted on all servers. Managed via `players` block in `manifest.yml`.

## Conventions

- Server names: lowercase alphanumeric + hyphens (used as Docker container names, subdomains, and directory names)
- Server tiers: `ephemeral` (no backups, easy delete), `semi-permanent` (daily backups), `permanent` (6h backups, deletion safeguards)
- All MC servers share a `minecraft-net` Docker bridge network
- Resource limits auto-calculated from tier (set in generated docker-compose.yml)
- Secrets never stored in plain text — use 1Password (`op run`) or `auth.json` for Claude Code
- Tests: `pytest` in a local `.venv/` (see `docs/python-and-testing.md`)

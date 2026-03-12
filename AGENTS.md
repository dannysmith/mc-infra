# MC Infrastructure

See [README.md](README.md) for a full overview of the project, architecture, manifest system, and features.

This file covers additional context for AI agents working on this codebase.

## Key Files

- `manifest.yml` — **Source of truth** for all server definitions and mod groups
- `docker-compose.yml` — **Generated** by `mc-generate` from manifest (do not edit directly)
- `nginx/conf.d/bluemap.conf` — **Generated** by `mc-generate` (do not edit directly)
- `.env.tpl` — 1Password secret references (resolved at runtime by `op run`)
- `servers/<name>/env` — Per-server Minecraft settings (user-editable, not generated)
- `servers/<name>/data/` — Bind-mounted container filesystem (world data, mods, configs, logs, etc. — live access to running server internals)
- `shared/scripts/mclib.py` — Shared Python library for all management scripts
- `shared/scripts/` — Management scripts (`mc-create`, `mc-generate`, etc.)
- `shared/templates/` — Templates for new server creation (including `dev-claude.md` for `~/dev/CLAUDE.md`)

## Reference Docs

- `docs/reference/itzg-docker-minecraft-server.md` — **Generated** full documentation for the `itzg/minecraft-server` Docker image. Regenerate with `scripts/fetch-itzg-docs`. Gitignored — run the script locally or on the server to create it. Use this as a comprehensive reference for all available environment variables, server types, mod/plugin configuration, and features.
- `docs/dev-workflow.md` — Fabric mod development workflow (dev → test → production lifecycle)
- `docs/manifest-and-scripts.md` — Full manifest reference and all `mc-*` command usage
- `docs/dns-and-routing.md` — DNS, routing, and SSL architecture

## Task Management

Tasks live in `docs/tasks-todo/` and `docs/tasks-done/`.

- **Pending tasks**: `docs/tasks-todo/task-<priority>-<slug>.md` — priority is a number (1 = highest) or `x` for unprioritised
- **Completed tasks**: `docs/tasks-done/<ISO-date>-task-<slug>.md` — prefixed with completion date, moved from tasks-todo

Work through tasks in priority order (lowest number first). When completing a task, prefix the filename with today's ISO date and move it to `docs/tasks-done/`.

## Scripts

**Management scripts** (`shared/scripts/`) — on PATH via `~/.bash_aliases`. Python scripts use `mclib.py` for shared logic.

**Development scripts** (`scripts/`) — tooling for working on this repo (e.g. `fetch-itzg-docs`). Not deployed to the server PATH.

| Script                 | Language | Purpose                                                            |
| ---------------------- | -------- | ------------------------------------------------------------------ |
| `mc-generate`          | Python   | Regenerate compose + nginx from manifest                           |
| `mc-create`            | Python   | Create a new server (adds to manifest, generates, sets up dir)     |
| `mc-destroy`           | Python   | Remove a server (tier-enforced deletion)                           |
| `mc-archive`           | Python   | Archive world data to tarball, then destroy                        |
| `mc-status`            | Python   | Show status of all servers                                         |
| `mc-start` / `mc-stop` | Bash     | Start/stop servers                                                 |
| `mc-logs <server>`     | Bash     | Tail logs for a server                                             |
| `mc-console <server>`  | Bash     | Attach to server console (RCON)                                    |
| `mc-nether-roof`       | Python   | Create BlueMap Nether Roof map for one or all servers              |
| `mc-cleanup`           | Bash     | Prune unused Docker images and build cache (runs weekly via cron)  |

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

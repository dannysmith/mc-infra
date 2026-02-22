# mc-infra

Self-hosted Minecraft server infrastructure on Hetzner Cloud. Runs alongside the existing WiseHosting "N19 Server" — this VPS handles creative worlds, experimentation, mod development, and throwaway servers.

## Quick Start

```bash
# 1. Provision a Hetzner CAX21 (Debian 12) via Cloud Console
# 2. Clone this repo onto the server
git clone git@github.com:danny/mc-infra.git /opt/minecraft
# 3. Run the setup script
sudo /opt/minecraft/setup.sh
# 4. Configure 1Password service account (see docs/requirements.md, section 4)
# 5. Start the stack
cd /opt/minecraft && docker compose up -d
```

## Structure

```
setup.sh                 # Host provisioning (run once on fresh Debian box)
docker-compose.yml       # All MC servers, mc-router, backup sidecars
.env.tpl                 # 1Password secret references for `op run`
servers/<name>/env       # Per-server environment overrides
shared/
  modpacks/              # Mod collections (manifests + configs)
  scripts/               # mc-create, mc-status, etc.
  templates/             # Server templates
nginx/conf.d/            # Reverse proxy configs for BlueMap
docs/                    # Requirements, research, reference
```

## Key Commands

```bash
mc-create --name <name> --type FABRIC --version 1.21.4 --modpack default-fabric --tier ephemeral
mc-destroy <name>
mc-status
mc-logs <name>
mc-console <name>
mc-backup <name>
```

## Domain

Servers: `<name>.mc.danny.is` (port 25565 via mc-router)
Maps: `map-<name>.mc.danny.is` (HTTPS via Nginx)

## Tasks

Pending tasks in [`docs/tasks-todo/`](docs/tasks-todo/). Completed tasks moved to [`docs/tasks-done/`](docs/tasks-done/) with date prefix.

## Docs

- [Requirements & Plan](docs/requirements.md)
- [Hosting Research](docs/minecraft-hosting-research.md)
- [Auth & Secrets Research](docs/vps-auth-research.md)

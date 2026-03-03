# mc-infra

Self-hosted Minecraft server infrastructure on Hetzner Cloud. Runs alongside the existing WiseHosting "N19 Server" — this VPS handles creative worlds, experimentation, mod development, and throwaway servers.

## Quick Start

```bash
# 1. Provision a Hetzner CAX21 (Debian 13) via Cloud Console
# 2. Clone this repo onto the server
git clone git@github.com:dannysmith/mc-infra.git /opt/minecraft
# 3. Run the setup script (as root)
sudo /opt/minecraft/setup.sh
# 4. Configure 1Password service account (see docs/server-details.md)
# 5. If VPS IP changed, update A records in DNSimple:
#    mc.danny.is, *.mc.danny.is, acme.mc.danny.is → <new-ip>
# 6. Start the stack (as danny)
cd /opt/minecraft && op run --env-file=.env.tpl -- docker compose up -d
# 7. Set up SSL certificate
sudo /opt/minecraft/setup-ssl.sh
# 8. Transfer Claude Code auth.json
scp ~/.config/claude-code/auth.json danny@<ip>:~/.config/claude-code/
```

Step 7 is interactive on first run — it registers with acme-dns and asks you to add a CNAME in DNSimple. On subsequent runs (re-provisioning with existing acme-dns data), it skips registration and just renews the cert.

## Structure

```
setup.sh                 # Host provisioning (run once on fresh Debian box)
setup-ssl.sh             # SSL cert setup via acme-dns (interactive on first run)
manifest.yml             # Source of truth for all server definitions
docker-compose.yml       # Generated from manifest (do not edit directly)
.env.tpl                 # 1Password secret references for `op run`
servers/<name>/env       # Per-server environment overrides
acme-dns/
  Dockerfile             # Builds acme-dns from source (ARM-compatible)
  config/config.cfg      # acme-dns configuration
nginx/conf.d/            # Nginx reverse proxy + SSL configs
shared/
  scripts/               # mc-create, mc-status, etc.
  templates/             # Server templates
docs/                    # Architecture docs, task tracking, reference
```

## Key Commands

```bash
mc-create --name <name> --type FABRIC --version 1.21.4 --mod-group fabric-base --tier ephemeral
mc-destroy <name>
mc-archive <name>
mc-status
mc-logs <name>
mc-console <name>
```

## Domain

Servers: `<name>.mc.danny.is` (port 25565 via mc-router)
Maps: `map-<name>.mc.danny.is` (HTTPS via Nginx)

See [DNS, Routing & SSL](docs/dns-and-routing.md) for the full architecture reference.

## Tasks

Pending tasks in [`docs/tasks-todo/`](docs/tasks-todo/). Completed tasks moved to [`docs/tasks-done/`](docs/tasks-done/) with date prefix.

## Docs

- [Manifest System & Scripts](docs/manifest-and-scripts.md)
- [DNS, Routing & SSL](docs/dns-and-routing.md)
- [Server Details](docs/server-details.md)
- [Dev Workflow](docs/dev-workflow.md)
- [Python & Testing](docs/python-and-testing.md)

Older planning and research docs are in [`docs/archive/`](docs/archive/).

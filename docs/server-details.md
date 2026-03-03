# Server Details

## Hetzner VPS

| Field       | Value                     |
| ----------- | ------------------------- |
| Name        | minecraft-vps             |
| ID          | #121769373                |
| Project     | Minecraft                 |
| Plan        | CAX21 (ARM, Ampere Altra) |
| Data Centre | hel1-dc2 (Helsinki)       |
| Zone        | eu-central                |
| OS          | Debian 13 (Trixie)        |
| CPU         | 4 vCPU (shared)           |
| RAM         | 8 GB                      |
| Disk        | 80 GB SSD                 |
| Traffic Out | 20 TB/mo                  |
| Price       | €7.19/mo                  |

### Network

| Type | Address                 |
| ---- | ----------------------- |
| IPv4 | 89.167.86.134           |
| IPv6 | 2a01:4f9:c014:408a::/64 |

### DNS

Managed via DNSimple on the `danny.is` domain. See `docs/dns-and-routing.md` for the full DNS, routing, and SSL reference.

Servers are addressed as `<name>.mc.danny.is` (e.g. `creative.mc.danny.is`). BlueMap UIs as `map-<name>.mc.danny.is`.

### SSH Access

```
ssh danny@89.167.86.134
```

(`root@89.167.86.134` was disabled by `setup.sh`)

### Rescale Warning

**Never upgrade disk size during a rescale operation.** Always select "CPU and RAM only". Upgrading the disk permanently locks you out of downgrading to a smaller plan.


## 1Password

| Field           | Value                                                                       |
| --------------- | --------------------------------------------------------------------------- |
| Vault           | MC Server                                                                   |
| Service Account | Scoped to the MC Server vault only                                          |
| Token Location  | `OP_SERVICE_ACCOUNT_TOKEN` env var on VPS (in `~/.secrets/op`, `chmod 600`) |

Secrets are referenced in `.env.tpl` using `op://MC Server/...` URIs and injected at runtime via `op run --env-file=.env.tpl`.

## Installed Software

`setup.sh` is the primary reference for everything installed on the host. Key components:

**Infrastructure:**
- Docker Engine + Docker Compose (from Docker's official Debian repo)
- Nginx (reverse proxy for BlueMap UIs, SSL termination)
- certbot (via pipx) + self-hosted acme-dns for `*.mc.danny.is` wildcard cert renewal
- UFW (firewall — ports 22, 53, 80, 443, 25565/tcp, 24454/udp)
- fail2ban (SSH brute-force protection)
- unattended-upgrades (automatic security patches)
- 1Password CLI (`op`)

**Development:**
- OpenJDK 21 (headless — for Fabric mod development / Gradle)
- Bun, uv, GitHub CLI, Claude Code (installed as user `danny`)
- `~/dev/` — mod development workspace with `CLAUDE.md` (see `docs/dev-workflow.md`)

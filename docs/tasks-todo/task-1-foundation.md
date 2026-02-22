# Phase 1: Foundation

Get a working VPS with a single Minecraft server connectable from a local client.

## Steps

### 1. Provision Hetzner VPS

- Create a CAX21 (ARM, 4 vCPU, 8GB RAM, 80GB SSD) in Falkenstein or Nuremberg
- Debian 12 image
- Add SSH key during provisioning
- **Do not upgrade the disk during any future rescale operations** (see requirements.md section 1)

### 2. Write `setup.sh`

Idempotent script that configures a fresh Debian 12 box. Should handle:

- Create non-root user with sudo (if not done by Hetzner's provisioning)
- SSH hardening: disable password auth, disable root login
- Install and configure UFW: allow SSH (22), MC (25565), HTTP/HTTPS (80/443), SVC UDP (24454)
- Install and configure fail2ban for SSH
- Enable unattended-upgrades for automatic security patches
- Set timezone to UTC
- Install Docker Engine + Docker Compose (from Docker's official repo)
- Install Nginx
- Install certbot + certbot-dns-dnsimple plugin
- Install dev tools: uv, bun, JDK 21, gh, Claude Code
- Install 1Password CLI (`op`)
- Install standard utilities: curl, wget, jq, htop, tmux
- Create directory structure under `/opt/minecraft/` (or wherever the repo is cloned)
- Symlink management scripts from `shared/scripts/` into PATH

### 3. Run `setup.sh` on the VPS

- Clone the repo onto the server
- Run the setup script
- Verify: SSH key-only, firewall active, Docker running, all tools installed

### 4. Configure secrets

- Create "MC Server" vault in 1Password
- Create a service account scoped to that vault
- Install service account token on VPS (`OP_SERVICE_ACCOUNT_TOKEN`)
- Store initial secrets: DNSimple API token, RCON password
- Transfer Claude Code `auth.json` from local machine
- Set up `GH_TOKEN` via 1Password

### 5. DNS

- Create `mc.danny.is` A record pointing to VPS IP (via DNSimple)
- Create wildcard `*.mc.danny.is` A record pointing to VPS IP
- Verify DNS resolution

### 6. First MC server

- Write initial `docker-compose.yml` with a single Fabric server (no mc-router yet, just direct port 25565)
- Use the default-fabric modpack mods (or at least a subset: Fabric API + Lithium + FerriteCore)
- Start it up, connect from local Minecraft client, verify it works
- Verify mods are loaded, world generates correctly on ARM

## Done when

- VPS is provisioned and hardened
- `setup.sh` is committed and tested
- 1Password secrets pipeline works
- DNS resolves `mc.danny.is` to the VPS
- A Fabric MC server is running and connectable from a local client

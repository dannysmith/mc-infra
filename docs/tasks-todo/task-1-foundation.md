# Phase 1: Foundation

Get a working VPS with a single Minecraft server connectable from a local client.

## Steps

### 1. Provision Hetzner VPS

- ~~Create a CAX21 (ARM, 4 vCPU, 8GB RAM, 80GB SSD) in Helsinki (hel1-dc2)~~ DONE
- ~~Debian 13 (Trixie) image~~ DONE
- ~~Add SSH key during provisioning~~ DONE
- **Do not upgrade the disk during any future rescale operations** (see requirements.md section 1)

### 2. Write `setup.sh`

~~Idempotent script that configures a fresh Debian 13 box.~~ DONE

### 3. Run `setup.sh` on the VPS

~~Run the setup script, verify: SSH key-only, firewall active, Docker running, all tools installed.~~ DONE

### 4. Configure secrets

- ~~Create "MC Server" vault in 1Password~~ DONE
- ~~Create a service account scoped to that vault~~ DONE
- ~~Install service account token on VPS (`OP_SERVICE_ACCOUNT_TOKEN`)~~ DONE
- Store initial secrets: DNSimple API token, RCON password
- ~~Authenticate Claude Code on VPS via `claude login`~~ DONE
- Set up `GH_TOKEN` via 1Password

### 5. DNS

- ~~Create `mc.danny.is` A record pointing to VPS IP (via DNSimple)~~ DONE
- ~~Create wildcard `*.mc.danny.is` A record pointing to VPS IP~~ DONE
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

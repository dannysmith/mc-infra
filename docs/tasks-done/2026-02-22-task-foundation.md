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
- ~~Store RCON password in 1Password~~ DONE
- ~~Store DNSimple API token in 1Password~~ DONE
- ~~Authenticate Claude Code on VPS via `claude login`~~ DONE
- ~~Set up `GH_TOKEN` via 1Password~~ DONE

### 5. DNS

- ~~Create `mc.danny.is` A record pointing to VPS IP (via DNSimple)~~ DONE
- ~~Create wildcard `*.mc.danny.is` A record pointing to VPS IP~~ DONE
- ~~Verify DNS resolution~~ DONE

### 6. First MC server

- ~~Write initial `docker-compose.yml` with a single Fabric server (no mc-router yet, just direct port 25565)~~ DONE
- ~~Start it up, verify mods are loaded, world generates correctly on ARM~~ DONE
- ~~Connect from local Minecraft client, verify it works~~ DONE

#### Notes from first startup

- **MC 1.21.11** (latest at time of setup), Fabric Loader 0.18.4
- **8 mods loaded** (Noisium dropped — no Fabric 1.21.11 support): fabric-api, lithium, ferrite-core, c2me, scalablelux, distanthorizons (beta), bluemap, simple-voice-chat
- **C2ME native math disabled on ARM** — expected, falls back to pure Java. Chunk gen will be slower; pre-generating with Chunky mitigates this (see requirements.md)
- **BlueMap needs EULA accepted** — edit `config/bluemap/core.conf` in the server data to accept the resource download. Deferred to Phase 2 when Nginx is set up
- **Distant Horizons recommends ZGC** over G1 GC for less stuttering. Could add `-XX:+UseZGC` via `JVM_XX_OPTS` if needed. Low priority for a 1-2 player server

## Done when

- VPS is provisioned and hardened
- `setup.sh` is committed and tested
- 1Password secrets pipeline works
- DNS resolves `mc.danny.is` to the VPS
- A Fabric MC server is running and connectable from a local client

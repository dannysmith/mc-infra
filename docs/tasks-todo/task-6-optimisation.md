# Task 6: Optimisation

Performance, resource usage, and housekeeping for the server and infrastructure.

## What's already in good shape

Reviewed during planning — no work needed here:

- **Minecraft performance mods** — `fabric-base` group (lithium, ferrite-core, c2me-fabric, scalablelux, noisiumforked) is already the gold standard for Fabric server optimisation. Nothing missing for 1-2 players.
- **Native auto-pause** — Since MC 1.21.2, `pause-when-empty-seconds` (default: 60) natively pauses the server when empty. Already active on `VERSION: LATEST`. Replaces the older itzg `ENABLE_AUTOPAUSE` feature.
- **OS maintenance** — `unattended-upgrades` with `AutocleanInterval 7` handles security patches and apt cache cleanup. fail2ban and UFW already configured.
- **Docker resource limits** — Per-tier CPU and memory limits already generated from manifest.
- **View/simulation distance** — MC defaults (10/10) are fine for 1-2 players.

## Phase 1: Docker Housekeeping

Prevent disk usage from growing unbounded on the 80GB SSD.

### Log rotation
Docker's default `json-file` log driver has no size limits. Container logs (especially MC server output) will grow unbounded. Configure the Docker daemon default log driver with rotation limits (e.g. `max-size: 10m`, `max-file: 3`).

### Image pruning
The itzg image updates frequently and old images accumulate. Add a cron job (e.g. weekly `docker image prune -f`) to clean up unused images. The cron job should be defined as code in this repo (e.g. a script in `shared/scripts/` installed by `setup.sh`).

### REMOVE_OLD_MODS
When Modrinth downloads updated mod JARs, old versions can linger in the mods folder, potentially causing conflicts or wasting disk. Add `REMOVE_OLD_MODS=TRUE` to the generated compose environment for all servers.

## Phase 2: Resource Tuning

### Memory overcommit
Creative (5G container limit) + Test (3G limit) = 8G — exactly the box's RAM. With OS, Docker, nginx, acme-dns, mc-router, and backup sidecars on top, this is overcommitted if both servers run simultaneously. Options:

- Reduce the ephemeral tier default (currently 2G heap / 3G container — could be 1G heap / 2G container)
- Accept the risk and document that not all servers should run simultaneously
- Or just be aware of it and revisit if we hit OOM kills

### JVM flags
Currently using itzg defaults (no GC tuning flags). The itzg image supports `USE_AIKAR_FLAGS=true` (proven, well-understood G1GC tuning) and `USE_MEOWICE_FLAGS=true` (modern successor for Java 17+, better benchmarks but less battle-tested). For 1-2 players the impact is marginal, but it's free to enable.

Add `USE_AIKAR_FLAGS=true` as a hardcoded default for all MC server containers in the compose generator.

## Phase 3: Nginx Optimisation

Current BlueMap nginx config is a basic reverse proxy with no compression or caching. BlueMap serves map tile data that benefits from both.

- Add gzip compression for web assets (JS, CSS, JSON)
- Add browser cache headers for static tile data
- Consider `gzip_static` if serving pre-compressed BlueMap tiles

Low priority for 1-2 users but straightforward to add to the generated `bluemap.conf`.

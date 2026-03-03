# Task 6: Optimisation

Performance, resource usage, and housekeeping for the server and infrastructure.

## What's already in good shape

Reviewed during planning — no work needed:

- **Minecraft performance mods** — `fabric-base` group (lithium, ferrite-core, c2me-fabric, scalablelux, noisiumforked) is already the gold standard for Fabric server optimisation. Nothing missing for 1-2 players.
- **Native auto-pause** — Since MC 1.21.2, `pause-when-empty-seconds` (default: 60) natively pauses the server when empty. Already active on `VERSION: LATEST`. Replaces the older itzg `ENABLE_AUTOPAUSE` feature.
- **OS maintenance** — `unattended-upgrades` with `AutocleanInterval 7` handles security patches and apt cache cleanup. fail2ban and UFW already configured.
- **Docker resource limits** — Per-tier CPU and memory limits already generated from manifest.
- **View/simulation distance** — MC defaults (10/10) are fine for 1-2 players.

## What was done

### Docker Housekeeping

- **Log rotation** — Configured Docker daemon default log driver with rotation limits (`max-size: 10m`, `max-file: 3`) in `setup.sh` via `/etc/docker/daemon.json`.
- **Image pruning** — Added `mc-cleanup` script (`shared/scripts/`) that prunes unused Docker images and build cache older than 7 days. Installed as a weekly cron job (`/etc/cron.d/mc-infra`, Sunday 04:00 UTC) by `setup.sh`.
- **REMOVE_OLD_MODS** — Added `REMOVE_OLD_MODS=TRUE` to all MC server containers in the compose generator, so old mod JARs are cleaned up on server start.

### JVM Flags

- Added `USE_AIKAR_FLAGS=true` as a hardcoded default for all MC server containers. Aikar's flags provide well-understood G1GC tuning for Minecraft. Marginal impact for 1-2 players but free to enable.

### Nginx Optimisation

- Added gzip compression for BlueMap web assets (JS, CSS, JSON, SVG).
- Added browser cache headers (`expires 1h`, `Cache-Control: public, no-transform`) for map tile data.

### Not changed (conscious decisions)

- **Memory overcommit** — Total container limits (8G) match the box's RAM exactly. Accepted as-is; revisit if OOM kills occur. Running all servers simultaneously is unlikely given the use case.

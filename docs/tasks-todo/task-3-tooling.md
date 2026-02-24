# Phase 3: Tooling

Management scripts and modpack template system for rapid server creation/teardown.

## Current State

As of Phase 2/2b, creating a new server requires manual edits to:
- `docker-compose.yml` — new service block, mc-router MAPPING entry, BlueMap port if needed
- `nginx/conf.d/bluemap.conf` — new server block for `map-<name>.mc.danny.is` (if BlueMap enabled)
- `servers/<name>/env` — placeholder env file
- BlueMap EULA acceptance after first start (`config/bluemap/core.conf`)
- Nginx reload

No DNS or SSL changes needed (wildcard A record + wildcard cert cover all subdomains automatically). See `docs/dns-and-routing.md` for the full reference including the "Adding a New Server" section.

BlueMap ports are sequential on localhost: 8100 (creative), 8101 (test), 8102 (next), etc.

The test server currently running is ephemeral — can be destroyed once tooling is in place.

## Steps

- Write `mc-create` script: creates server dir, adds to docker-compose, copies modpack, registers routing
  - Should auto-generate nginx server block for BlueMap (if enabled)
  - Should assign next available BlueMap port
  - Should accept BlueMap EULA automatically
  - Should reload nginx after config changes
- Write `mc-destroy` / `mc-archive` scripts with protection level enforcement
- Write `mc-start` / `mc-stop` / `mc-status` / `mc-logs` / `mc-console` wrappers
- Build modpack template system (default-fabric, vanilla, perf-only)
- Mod manifest files with version tracking
- World import support (from local file, from another server)
- Decide on script language (bash vs Python with click/typer)

## Done when

- Can create a new server from template in under a minute
- Can destroy/archive servers with appropriate safeguards
- Modpack system works — new servers get the right mods

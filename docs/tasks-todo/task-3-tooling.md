# Phase 3: Tooling

Management scripts and modpack template system for rapid server creation/teardown.

## Steps

- Write `mc-create` script: creates server dir, adds to docker-compose, copies modpack, registers routing
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

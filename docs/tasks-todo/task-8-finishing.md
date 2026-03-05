# Task: Finishing Up - Testing

## Phase 2 - Manual Testing on the Server

When phase 1 is done we'll push/pull to the server. We should then test out our various `mc-` commands, especially `mc-create` with various options. This should also include some testing of manually editing both the manifest and the individual server's `env` files.

KEY POINT: Neither of the two servers which currently exist in the manifest are important to me. I'm fine for both to be removed/destroyed as part of this testing process.

### End State

Three servers in the manifest (all latest MC version/Fabric with fabric-base mod group):

1. **Creative** — Permanent, superflat sandstone (~100 blocks deep, no structures), Bluemap, DH, SVC, backups enabled
2. **N19** — Semi-permanent, seed `493527618652710797`, Bluemap, DH, pregen (default radius)
3. **BMDev** — Ephemeral, random seed, Bluemap, with dev JAR from [mc-bluemap-structures](https://github.com/dannysmith/mc-bluemap-structures) copied to `data/mods/`

### Per-Server Verification Checklist

For each server we create, verify:

- [ ] `manifest.yml` entry looks correct
- [ ] `docker-compose.yml` service looks correct (env vars, ports, volumes, resource limits)
- [ ] If BlueMap: `nginx/conf.d/bluemap.conf` has the right server block
- [ ] `mc-logs <name>` shows clean startup, all mods loaded
- [ ] `mc-status` shows the server running with correct tier/address
- [ ] `mc-console <name>` works (run `list` to check RCON)
- [ ] Connect in Minecraft client via `<name>.mc.danny.is` — verify world type, game mode, seed
- [ ] If BlueMap: `map-<name>.mc.danny.is` loads in browser and renders after exploring
- [ ] If DH: Distant Horizons LODs start building while connected
- [ ] Ops and whitelist are working (Danny is OP, both players whitelisted)

### Commands Tested

- [x] `mc-create` (basic) — smoketest server
- [x] `mc-create` with `--seed`, `--pregen`, `--modrinth-mods`, `--tier` — N19 server
- [x] `mc-start <name>` (single server)
- [x] `mc-stop <name>` (single server)
- [x] `mc-status`
- [x] `mc-logs <name>`
- [x] `mc-console <name>`
- [ ] `mc-generate` (after manual manifest edit)
- [x] `mc-archive <name>` — smoketest archived successfully
- [ ] `mc-destroy` tier enforcement (semi-permanent without `--confirm`, permanent without `--force`)
- [x] `mc-destroy <name>` (ephemeral, immediate) — tested during Phase A
- [ ] Manual env file edit + restart

---

### Step-by-step Plan

#### Phase A: Preparation

1. Push any local changes and pull on the server — **DONE**
2. Change the default pregen radius in `mc-create` from 3000 to 1500 blocks (commit + push) — **DONE**
3. Run `mc-cleanup` on the server to prune unused Docker images — **DONE** (reclaimed 1.5GB build cache)
4. Destroy both existing servers — **DONE**
   - `mc-destroy creative --force` (permanent tier)
   - `mc-destroy test` (ephemeral tier)
   - Also cleaned up 3 stale containers (`creative`, `test`, `creative-backups`) left behind by destroy
5. Verify manifest is empty, compose regenerated, nginx reloaded — **DONE**

**Note on resources:** The server has 8GB RAM. Running all three target servers simultaneously would exceed this (5g + 4g + 3g = 12g in container limits). Stop running servers before starting new ones during testing. If you want multiple servers running long-term, upgrade the Hetzner plan.

#### Phase B: Smoke Test — Basic Lifecycle

Purpose: quickly validate the core create/start/stop/archive loop before building real servers.

1. Create a minimal ephemeral server — **DONE**
2. Review `manifest.yml` and `docker-compose.yml` — **DONE**, all correct
3. Start it: `mc-start smoketest` — **DONE**
4. Check logs — **DONE**, clean startup
5. Check status: `mc-status` — **DONE**
6. Test RCON: `mc-console smoketest` — **DONE**
7. Connect in Minecraft client — **DONE**, creative mode, normal world
8. Stop it: `mc-stop smoketest` — **DONE**
9. Archive it: `mc-archive smoketest` — **DONE**
10. Verify archive — **DONE** (148MB archive in `shared/backups/`, server removed from manifest and compose)

#### Phase C: N19 Server (Semi-permanent)

Purpose: test seed, pregen, semi-permanent tier, mod groups + extra modrinth mods, bluemap + DH.

1. Create — **DONE**
2. Review generated files — **DONE**, all correct (manifest, compose, nginx)
3. Reload nginx — **DONE**
4. Start: `mc-start n19` — **DONE**
5. Check logs — **DONE**, mods loaded (BlueMap needed manual EULA fix — see bugs below), Chunky pregen running
6. Run per-server verification checklist — **IN PROGRESS** (seed confirmed via RCON, RCON working, mc-status correct, BlueMap rendering)
7. Connect in Minecraft — **DONE**, waiting for Chunky pregen + DH LODs
8. Check `map-n19.mc.danny.is` — **DONE**, working
9. **Test tier enforcement** — skipped (not worth risking active world)
10. **Test world persistence + manual manifest edit** — moved to Phase D (creative server). Too risky here — a bad outcome would lose all the Chunky pregen progress.

#### Phase D: Creative Server (Permanent, Superflat)

Purpose: test permanent tier, backup sidecar, SVC port mapping, env file customisation for superflat world.

1. Create:
   ```
   mc-create --name creative --tier permanent --modrinth-mods bluemap,distanthorizons,simple-voice-chat --svc
   ```
2. Edit `servers/creative/env` — add superflat settings:
   ```
   LEVEL_TYPE=minecraft:flat
   GENERATE_STRUCTURES=false
   GENERATOR_SETTINGS={"layers":[{"block":"minecraft:bedrock","height":1},{"block":"minecraft:sandstone","height":99}],"biome":"minecraft:desert"}
   ```
3. Review generated files — specifically check:
   - Backup sidecar (`creative-backups`) exists in `docker-compose.yml`
   - SVC UDP port 24454 is mapped
   - BlueMap port assigned
4. Reload nginx: `sudo nginx -t && sudo systemctl reload nginx`
5. Start: `mc-start creative`
6. Check logs: `mc-logs creative` — verify mods loaded, backup sidecar healthy
7. Run per-server verification checklist
8. Connect in Minecraft — verify it's a superflat sandstone world with deep ground, creative mode
9. Check `map-creative.mc.danny.is` in browser
10. Verify backup sidecar is running: `docker compose ps creative-backups`
11. **Test tier enforcement:** try `mc-destroy creative` — should refuse (permanent)
12. **Test env file edit:** change a setting in `servers/creative/env` (e.g. `DIFFICULTY=peaceful`), restart (`mc-stop creative && mc-start creative`), verify the change via logs or in-game
13. **Test world persistence + manual manifest edit** (moved from Phase C): Place a few recognisable blocks in the world. Then edit `manifest.yml` to add or remove a mod from creative's `modrinth_mods`, run `mc-generate`, restart (`mc-stop creative && mc-start creative`), check logs to verify the mod change took effect, reconnect and confirm your placed blocks are still there. Do a couple more stop/start cycles to be sure. Then revert the manifest edit, re-generate, and restart.

#### Phase E: BMDev Server (Ephemeral, Dev Workflow)

Purpose: test the dev mod workflow — building a mod on the server and loading it into a server.

1. On the server, clone the mod:
   ```
   cd ~/dev
   git clone https://github.com/dannysmith/mc-bluemap-structures
   ```
2. Build:
   ```
   cd ~/dev/mc-bluemap-structures
   ./gradlew build
   ```
3. Create the server:
   ```
   mc-create --name bmdev --modrinth-mods bluemap
   ```
4. Copy the built JAR into the server's mods directory:
   ```
   cp ~/dev/mc-bluemap-structures/build/libs/*.jar /opt/minecraft/servers/bmdev/data/mods/
   ```
5. Reload nginx: `sudo nginx -t && sudo systemctl reload nginx`
6. Start: `mc-start bmdev`
7. Check logs: `mc-logs bmdev` — check whether the mod loaded (it may fail, that's fine — we're testing the workflow, not the mod)
8. Run per-server verification checklist
9. Connect in Minecraft, verify bluemap works
10. Check `map-bmdev.mc.danny.is` in browser

#### Phase F: Final Checks

1. `mc-status` — all three servers (n19, creative, bmdev) showing as running
2. All three BlueMap URLs working in browser
3. Verify `manifest.yml` looks clean with exactly three servers
4. Verify `docker-compose.yml` has all expected services (acme-dns, mc-router, 3 MC servers, creative-backups)
5. Quick check that `mc-stop` and `mc-start` work for individual servers (pick one, stop/start cycle)

---

### Bugs Found During Testing

1. **BlueMap EULA auto-accept is broken.** The background poller spawned by `mc-create` starts its 5-minute window at creation time, but the server is usually started later with `mc-start`, so the poller expires before BlueMap ever writes `core.conf`. The pre-created file also gets overwritten by BlueMap on first start. Fix options: (a) find a more reliable way to auto-accept, or (b) remove the automatic code entirely and add a simple manual script like `mc-accept-bluemap <server>` that patches `core.conf` and reloads BlueMap.

# Task 8: World Pre-Generation

Automated chunk pre-generation for new worlds, with integration for Distant Horizons LODs and BlueMap rendering.

## Background

When creating a new world, entering it for the first time involves waiting for chunks to generate around you. For worlds with DH and BlueMap, there's also the question of LOD generation and map rendering. Pre-generating a radius of chunks before the first login gives a much better first experience — a substantial area is already loaded when you enter spectator mode to explore.

## How it works

### Chunky (the pre-gen tool)

[Chunky](https://modrinth.com/mod/chunky) is the standard Fabric server-side pre-generation mod. It generates real Minecraft chunks via RCON commands (`chunky radius 5000`, `chunky start`). No client installation needed. It uses the server's normal worldgen pipeline, so all our fabric-base performance mods (C2ME, NoisiumForked, ScalableLux, etc.) accelerate the generation.

### itzg RCON hooks

The itzg Docker image provides environment variables that fire RCON commands at specific lifecycle events:

- `RCON_CMDS_STARTUP` — after the server is fully started and accepting RCON
- `RCON_CMDS_FIRST_CONNECT` — when the first player joins
- `RCON_CMDS_LAST_DISCONNECT` — when the last player leaves

These are the mechanism for triggering and managing pre-gen automatically.

### pause-when-empty-seconds

Since MC 1.21.2, the server natively pauses its tick loop when no players are online (default: 60 seconds). This would prevent Chunky from running headless. During pre-gen, this needs to be disabled by setting `pause-when-empty-seconds` to `-1` in server.properties (via the env file or compose environment).

### DH LOD generation

When DH is installed server-side and Chunky generates real chunks, DH will automatically create LODs from those chunks — no special configuration needed. The LODs are stored server-side in SQLite databases within the world directory.

### BlueMap rendering

BlueMap auto-detects new chunks and renders them incrementally. After Chunky finishes, a `bluemap force-update` via RCON ensures all new chunks are rendered. BlueMap should be gradually rendering throughout the pre-gen process anyway.

## Manifest format

New optional `pregen` block on servers:

```yaml
servers:
  creative:
    pregen:
      radius: 5000        # blocks from spawn centre
    # ...
```

- `radius` — pre-gen radius in blocks from world spawn. Required if `pregen` is present.
- If `pregen` is omitted, no pre-gen happens (current behaviour).

### Defaults

A sensible default radius should be offered by `mc-create` (probably via a `--pregen` flag that accepts a radius, or `--pregen` with no value for a default). The default radius needs testing — somewhere around **2000-5000 blocks** feels right for a "substantial area loaded in spectator mode" experience. Start with 3000 and adjust based on real-world testing.

## What mc-generate should produce

When a server has a `pregen` block:

1. **Add `chunky` to `MODRINTH_PROJECTS`** — automatically, alongside existing mods.

2. **Add RCON command environment variables** to the compose service:
   ```yaml
   RCON_CMDS_STARTUP: |-
     chunky center 0 0
     chunky radius <radius>
     chunky start
   RCON_CMDS_FIRST_CONNECT: |-
     chunky pause
   RCON_CMDS_LAST_DISCONNECT: |-
     chunky continue
   ```

3. **Handle `pause-when-empty-seconds`** — set it to `-1` while pre-gen is configured. This could be added to the compose `environment` block (via a server.properties override) or documented as a required env file edit.

4. **BlueMap trigger** — if BlueMap is present, append `bluemap force-update` to `RCON_CMDS_STARTUP` after the chunky commands. BlueMap will also render incrementally during pre-gen.

## Workflow

Typical usage after this is implemented:

```bash
# Create a new world with pre-gen
mc-create --name survival --mode survival --pregen 5000

# Or with default radius
mc-create --name creative --pregen

# Start the server — pre-gen begins automatically
mc-start survival

# Pre-gen runs headless. When you join, it pauses. When you leave, it resumes.
# Once complete, Chunky stops on its own.
```

### Post-completion cleanup

Once pre-gen finishes, the `pregen` block in the manifest is no longer needed. Options:

1. **Leave it** — Chunky's startup command is idempotent; if all chunks are generated, it finishes instantly. The `pause-when-empty-seconds=-1` is the only concern (server won't auto-pause when empty).
2. **Manual cleanup** — user removes the `pregen` block from manifest, runs `mc-generate`, and restarts. This re-enables auto-pause.
3. **Automated** — a script or RCON hook detects completion and removes the config. Probably over-engineered for now.

Option 2 (manual cleanup with a note in the docs) is probably right to start. Document it clearly.

## Open questions

- **Default radius**: needs real-world testing. 3000 blocks = ~188 chunks radius = ~111,000 chunks in a square. On the CAX21 with our mod stack, how long does this take? Start small and test.
- **CPU contention**: Chunky + DH LOD generation + BlueMap rendering all running concurrently could be heavy on the CAX21. May need to tune thread counts or accept that pre-gen is a "leave it overnight" operation.
- **Chunky config file**: Chunky has `continue-on-restart: true` in its config. Should we pre-create this config, or rely on `RCON_CMDS_STARTUP` re-issuing the start command on every restart? The RCON approach is simpler and doesn't require managing Chunky's config file.
- **RCON_CMDS interaction with user customisation**: if a user wants their own `RCON_CMDS_STARTUP` commands (e.g. gamerule changes), how do we merge them with the pre-gen commands? This may need thought — perhaps the env file can append to compose-level RCON commands, or we document that custom RCON commands go in the env file while pre-gen ones are in compose.
- **Chunky Extension mod**: the [chunky-extension](https://modrinth.com/mod/chunky-extension) companion mod auto-starts Chunky when the server empties and pauses on join — similar to what we achieve with RCON hooks. Worth evaluating whether it's simpler than RCON hooks, but RCON hooks are more transparent and don't require an extra mod.

## Done when

- `pregen` block in manifest triggers Chunky installation and RCON hook generation
- `mc-create` supports a `--pregen [radius]` flag
- Pre-gen runs headless after `mc-start` with no player login required
- Pre-gen pauses when a player joins and resumes when they leave
- BlueMap force-update fires on startup if BlueMap is present
- DH LOD generation happens naturally from the pre-generated chunks
- `pause-when-empty-seconds` is handled correctly (disabled during pre-gen, documented for re-enabling)
- Documentation updated (manifest-and-scripts.md)
- Tests pass

## Deferred

- **Per-dimension pre-gen** (Nether/End) — Chunky supports it but adds complexity. Add later if needed.
- **Progress monitoring** — Chunky logs progress to console (`mc-logs`). A dashboard integration (task-x-dashboard) could surface this later.
- **Automated post-completion cleanup** — manual removal of `pregen` block is fine for now.
- **Chunky trim** — Chunky can delete chunks outside a radius. Useful for world size management but separate from initial pre-gen.

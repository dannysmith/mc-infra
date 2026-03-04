# Task 8: World Pre-Generation

Automated chunk pre-generation for new worlds, with integration for Distant Horizons LODs and BlueMap rendering.

## Background

When creating a new world, entering it for the first time involves waiting for chunks to generate around you. For worlds with DH and BlueMap, there's also the question of LOD generation and map rendering. Pre-generating a radius of chunks gives a much better experience — a substantial area is already loaded when you explore in spectator mode.

## Design decision: player-present pre-gen only

We considered headless pre-gen (running Chunky with no player online) but it requires disabling `pause-when-empty-seconds` and then remembering to re-enable it after completion. This adds complexity and a manual cleanup step for marginal benefit.

Instead, pre-gen runs **only while a player is logged in**. The workflow for a new world is: log in, go into spectator mode, wait for Chunky to finish. While you're connected, DH also builds LODs from your client's render distance, and BlueMap renders incrementally. Everything works naturally with no special configuration or cleanup.

`pause-when-empty-seconds` is untouched — the server auto-pauses normally when empty.

## How it works

### Chunky (the pre-gen tool)

[Chunky](https://modrinth.com/mod/chunky) is the standard Fabric server-side pre-generation mod. It generates real Minecraft chunks via RCON commands (`chunky radius 5000`, `chunky start`). No client installation needed. It uses the server's normal worldgen pipeline, so all our fabric-base performance mods (C2ME, NoisiumForked, ScalableLux, etc.) accelerate the generation.

### itzg RCON hooks

The itzg Docker image provides environment variables that fire RCON commands at specific lifecycle events:

- `RCON_CMDS_STARTUP` — after the server is fully started and accepting RCON
- `RCON_CMDS_FIRST_CONNECT` — when the first player joins
- `RCON_CMDS_LAST_DISCONNECT` — when the last player leaves

### DH LOD generation

The DH server plugin generates LODs based on connected clients' render distances. While you're logged in during the pre-gen session, DH will build LODs from the chunks Chunky is generating. Both processes run concurrently — Chunky generates chunks, DH builds LODs from them, all while you're in spectator mode.

### BlueMap rendering

BlueMap auto-detects new chunks and renders them incrementally. No special trigger is needed — BlueMap will gradually render chunks as Chunky generates them during the session. If you want to ensure everything is fully rendered after pre-gen completes, run `bluemap force-update` manually via `mc-console`.

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
     chunky spawn
     chunky radius <radius>
   RCON_CMDS_FIRST_CONNECT: |-
     chunky start
   RCON_CMDS_LAST_DISCONNECT: |-
     chunky pause
   ```

### RCON command design notes

- **`chunky spawn`** (not `chunky center 0 0`) — world spawn isn't always at 0,0. `chunky spawn` uses the actual spawn point.
- **`RCON_CMDS_STARTUP` only sets parameters** — it configures the center and radius but doesn't start generation. This avoids the restart problem entirely: parameters are re-set on every boot, but no task is created or destroyed.
- **`RCON_CMDS_FIRST_CONNECT` starts generation** — Chunky begins when the first player joins.
- **`RCON_CMDS_LAST_DISCONNECT` pauses** — Chunky pauses when the last player leaves. On next connect, `chunky start` resumes or starts fresh as appropriate.

**Restart mid-pregen:** If the server restarts while a player is connected (crash, etc.), the task parameters are re-set on startup via `RCON_CMDS_STARTUP`, and `chunky start` fires again on reconnect. Need to test whether `chunky start` resumes a partially-completed task with the same parameters or starts from scratch. If it starts from scratch, we may want to use `chunky continue` in `RCON_CMDS_FIRST_CONNECT` instead, with a fallback. This needs testing during implementation.

## Workflow

```bash
# Create a new world with pre-gen
mc-create --name survival --mode survival --pregen 5000

# Or with default radius
mc-create --name creative --pregen

# Start the server
mc-start survival

# Log in, go to spectator mode, wait for Chunky to finish.
# DH builds LODs and BlueMap renders while you're connected.
# If you disconnect, Chunky pauses. Reconnect to resume.
```

### Post-completion cleanup

Once pre-gen finishes, the `pregen` block is harmless — Chunky's `start` command is a no-op when all chunks exist, and there's no `PAUSE_WHEN_EMPTY_SECONDS` override to worry about. You can optionally remove the `pregen` block and re-generate to clean up the RCON hooks and remove Chunky from the mod list, but there's no urgency.

## Open questions

- **Default radius**: needs real-world testing. 3000 blocks = ~188 chunks radius = ~111,000 chunks in a square. On the CAX21 with our mod stack, how long does this take? Start small and test.
- **CPU contention**: Chunky + DH LOD generation + BlueMap rendering all running concurrently while a player is connected could be heavy on the CAX21. May need to tune thread counts or accept that pre-gen is a "leave it running for a while" operation.
- **`chunky start` vs `chunky continue` on reconnect**: does `chunky start` with the same parameters resume a paused task or create a new one? Determines whether `RCON_CMDS_FIRST_CONNECT` should use `start` or `continue`. Needs testing.
- **RCON_CMDS interaction with user customisation**: if a user wants their own `RCON_CMDS_FIRST_CONNECT` commands, how do we merge them with the pre-gen commands? May need thought — perhaps document that custom RCON commands go in the env file while pre-gen ones are in compose.

## Done when

- `pregen` block in manifest triggers Chunky installation and RCON hook generation
- `mc-create` supports a `--pregen [radius]` flag
- Pre-gen starts when first player connects and pauses when they disconnect
- Post-completion state is harmless (no manual cleanup required)
- Documentation updated (manifest-and-scripts.md)
- Tests pass

## Deferred

- **Headless pre-gen** — running Chunky with no player online. Would require managing `PAUSE_WHEN_EMPTY_SECONDS`. Revisit if the player-present approach proves too annoying.
- **Per-dimension pre-gen** (Nether/End) — Chunky supports it but adds complexity. Add later if needed.
- **Progress monitoring** — Chunky logs progress to console (`mc-logs`). A dashboard integration (task-x-dashboard) could surface this later.
- **Chunky trim** — Chunky can delete chunks outside a radius. Useful for world size management but separate from initial pre-gen.

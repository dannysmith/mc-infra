# Task: Player Kit / Default Inventory System

## Requirements

I want to define a "standard kit" — my normal survival inventory — and have it available across all servers. The motivation: I'm often in spectator/creative on these worlds, but regularly switch to survival to test things, and it's nice to have my full loadout ready.

The kit includes:

- Full enchanted netherite armour and tools
- Specific items in specific hotbar/inventory slots
- Ender chest full of shulker boxes containing various items (some of which would be bundles inside shulkers)

The kit definition **must live in this repo** so it's shared across all servers. The format doesn't matter much (YAML, JSON, NBT file, whatever works best) as long as it's version-controlled and reasonably human-readable.

Ideally there's an in-game command to reset/reapply the kit (e.g. after dying or switching from creative to survival).

## Research

### How inventory is stored on disk

Player data lives in `world/playerdata/<uuid>.dat` — binary NBT (gzipped). In our setup: `servers/<name>/data/world/playerdata/<uuid>.dat`.

The NBT structure supports everything we need:

- **Inventory**: slots 0-8 (hotbar), 9-35 (main), 100-103 (armour), -106 (offhand)
- **Ender chest**: separate `EnderItems` tag (27 slots), stored per-player
- **Shulker contents**: nested via `minecraft:container` component
- **Bundle contents**: nested via `minecraft:bundle_contents` component
- **Enchantments**: `minecraft:enchantments` component with level map

The item format changed significantly in 1.20.5 (old `tag` compound replaced by `components` system), so any tooling needs to match the MC version.

Python libraries like `nbtlib` (v1.12.1) can read/write these files programmatically.

### The ender chest problem

**Vanilla commands cannot set ender chest contents.** `/data modify entity` is blocked for players by design. No `/item replace` slot namespace exists for ender chest. This limitation affects every approach except direct NBT file editing.

Options for ender chest specifically:

1. NBT file editing — works but only offline / before first join
2. A custom or existing mod that explicitly supports it
3. Accept the limitation and place a chest near spawn with "put these in your ender chest"
4. Write a tiny custom Fabric mod that adds an `/resetenderchest` command

### Possible approaches

#### A. Hybrid: YAML definition + generated datapack (strongest fit)

Define the kit in YAML in this repo (e.g. `shared/kits/danny.yml`). A Python script generates a datapack with `.mcfunction` files using `/item replace entity @s <slot> with ...` commands for exact slot placement. `mc-create`/`mc-generate` drops it into each server's `world/datapacks/`. A trigger system allows in-game reset via `/trigger reset_kit`.

- Kit lives in the repo as readable YAML, no mods, exact slot control, in-game reset
- Integrates with existing Python tooling (`mclib.py`, `mc-generate`)
- Can't set ender chest contents (vanilla limitation)
- Medium dev effort to build the YAML-to-mcfunction generator

Could be extended (Option B variant) to also generate/patch playerdata `.dat` files for ender chest contents, but that only works before first join or with the server stopped.

#### B. Fabric mod (Kits or Save and Load Inventories)

Best candidates:

- **[Kits](https://modrinth.com/mod/kits)** (John-Paul-R) — actively maintained, server-side only, Fabric. Equip yourself, `/kit add mykit`, players claim with `/kit claim mykit`. Supports permissions/cooldowns. Full NBT serialisation. But kit definitions are **binary NBT files** — not easily version-controlled.
- **[Save and Load Inventories](https://modrinth.com/mod/save-and-load-inventories)** (Serilum) — `/saveinventory mykit` / `/loadinventory mykit`. Stores as **text files** (potentially version-controllable). Requires Collective library. OP-only.

Neither handles ender chest contents. Mod dependency could lag behind MC version updates.

#### C. Hand-written datapack

Skip the YAML abstraction, hand-write `.mcfunction` files with all the `/item replace` commands. Keep in `shared/datapacks/` and copy into servers.

- Simplest starting point, no tooling to build
- Verbose and painful for 27-slot shulkers with enchanted contents
- Error-prone to maintain, no ender chest

#### D. Direct NBT playerdata generation

Define kit in YAML, Python script generates full `<uuid>.dat` files placed into `world/playerdata/` before server starts.

- Full coverage including ender chest
- Fragile: must replicate the full playerdata structure correctly, format tied to MC version
- No in-game reset (requires server stop or companion mechanism)
- If a player has already joined, their existing `.dat` takes precedence

### How the approaches compare

| Criteria | YAML + Datapack (A) | Fabric Mod (B) | Hand-written (C) | NBT Generation (D) |
|---|---|---|---|---|
| No mod dependencies | Yes | No | Yes | Yes |
| Version-controlled definition | Yes (YAML) | Difficult | Yes (mcfunction) | Yes (YAML) |
| Nested items (shulkers/bundles) | Yes (verbose output) | Yes (native) | Yes (verbose) | Yes |
| Ender chest | No | No | No | Yes |
| In-game reset | Yes (trigger) | Yes (commands) | Possible | No |
| Auto-apply on new server | Yes | Needs config copy | Yes | Yes |
| MC version resilience | Moderate | Depends on mod | Moderate | Fragile |
| Fits existing tooling | Strong | Moderate | Low | Strong |
| Dev effort | Medium | Low | Low | Medium |

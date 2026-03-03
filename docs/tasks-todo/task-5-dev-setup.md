# Phase 5: Development Setup

Ability to develop Fabric mods and test them on our servers.

## Context

- All mod dev tooling (JDK 21, Gradle via wrapper, Fabric Loom) is pure JVM — ARM on Hetzner is a non-issue
- A Fabric mod build produces a single JAR that goes into a server's `mods/` directory
- The itzg image's auto-removal only cleans up files it placed (Modrinth downloads, MODS env var) — manually-placed JARs in `data/mods/` are safe across restarts
- No deploy script needed — the workflow is just: copy JAR into `servers/<name>/data/mods/`, restart server
- Dev repos live in `~/dev/` on the server (separate from mc-infra)
- BlueMap addons are just regular Fabric mods that depend on BlueMapAPI — no special setup needed, skip for now
- Use existing `test` server (ephemeral) for dev iteration

## Implementation Plan

### Step 1: Create `~/dev/CLAUDE.md` template

**New file:** `shared/templates/dev-claude.md`

AI-assistant instructions for working in `~/dev/` on the server:

```markdown
# Minecraft Mod Development

Dev workspace for Fabric mods and plugins. The MC server infrastructure lives at `/opt/minecraft/` (separate repo).

## Scaffold a New Fabric Mod

Generate a project at https://fabricmc.net/develop/template/ or clone the example:

    git clone https://github.com/FabricMC/fabric-example-mod.git my-mod
    cd my-mod
    rm -rf .git && git init

Update `gradle.properties` with your mod ID, name, and target Minecraft version.

## Build

    cd ~/dev/my-mod
    ./gradlew build

Output JAR is in `build/libs/` (use the one without `-sources` or `-dev` suffix).

## Deploy to a Server

    # Copy JAR to server's mods directory
    cp build/libs/my-mod-1.0.0.jar /opt/minecraft/servers/<server>/data/mods/

    # Restart the server
    mc-stop <server> && mc-start <server>

    # Check it loaded
    mc-logs <server>

Manually-placed JARs in `data/mods/` survive server restarts — the itzg image only auto-removes its own Modrinth downloads.

## Graduating a Mod to Production

When a mod is ready for permanent use on a server:

**Private/custom mods:** Copy the JAR to `/opt/minecraft/shared/mods/`, add the filename to the server's `jar_mods` list in `manifest.yml`, run `mc-generate`, and restart.

**Published mods:** Publish to Modrinth, add the slug to `modrinth_mods` in `manifest.yml`, run `mc-generate`, and restart.

## Notes

- JDK 21 is installed system-wide. Gradle comes bundled with each project (./gradlew).
- Build output is platform-independent — build on Mac, run on ARM Linux, no issues.
- BlueMap addons are just regular Fabric mods that depend on BlueMapAPI (`compileOnly`).
- ~3-5 GB for a first project's Gradle/Loom caches. Additional projects share caches (~200-500 MB each).
```

### Step 2: Add `~/dev/` setup to `setup.sh`

New section 13 (before "Configure bash environment", renumbering that to 14 and "Summary" to 15). Follows existing idempotency patterns.

```bash
# ---------------------------------------------------------------------------
# 13. Dev workspace
# ---------------------------------------------------------------------------

echo "==> Setting up dev workspace..."
DANNY_DEV_DIR="/home/danny/dev"
mkdir -p "$DANNY_DEV_DIR"
cp "$SCRIPT_DIR/shared/templates/dev-claude.md" "$DANNY_DEV_DIR/CLAUDE.md"
chown -R danny:danny "$DANNY_DEV_DIR"
echo "    Created ~/dev/ with CLAUDE.md"
```

### Step 3: Add dev workflow docs to mc-infra

**New file:** `docs/dev-workflow.md`

Covers:
- What `~/dev/` is for and where it lives
- The dev → test → production mod lifecycle
- How manually-placed JARs interact with the itzg image (safe, not auto-removed)
- How `jar_mods` in the manifest works for production mods
- Reference to `~/dev/CLAUDE.md` for the hands-on workflow

### Step 4: Update existing docs

- `docs/server-details.md` — add `~/dev/` to directory layout
- `AGENTS.md` — add `~/dev/` and `docs/dev-workflow.md` to Key Files / Reference Docs sections

### Step 5: Verify on the server (manual)

SSH in and run these commands as `danny`:

```bash
# Pull latest changes
cd /opt/minecraft && git pull

# Set up ~/dev/ (what setup.sh would do on a fresh box)
mkdir -p ~/dev
cp /opt/minecraft/shared/templates/dev-claude.md ~/dev/CLAUDE.md

# Verify JDK 21
java --version

# Clone and build a test mod
git clone https://github.com/FabricMC/fabric-example-mod.git ~/dev/hello-fabric
cd ~/dev/hello-fabric
./gradlew build

# Deploy to test server
cp build/libs/fabric-example-mod-*.jar /opt/minecraft/servers/test/data/mods/
mc-stop test && mc-start test
mc-logs test
# Look for the mod in the loaded mods list

# Restart again — confirm the JAR wasn't auto-removed
mc-stop test && mc-start test
ls /opt/minecraft/servers/test/data/mods/fabric-example-mod-*.jar

# Clean up
rm -f /opt/minecraft/servers/test/data/mods/fabric-example-mod-*.jar
mc-stop test && mc-start test
rm -rf ~/dev/hello-fabric
```

## Files to Change

| File | Action |
|------|--------|
| `shared/templates/dev-claude.md` | **New** — CLAUDE.md template for ~/dev/ |
| `setup.sh` | **Edit** — add ~/dev/ creation section |
| `docs/dev-workflow.md` | **New** — dev workflow documentation |
| `docs/server-details.md` | **Edit** — mention ~/dev/ directory |
| `AGENTS.md` | **Edit** — add ~/dev/ and dev-workflow.md references |

## Done when

- Can build a Fabric mod on the VPS
- Can deploy and load a custom mod on the test server
- Dev workflow is documented (in mc-infra `docs/` and in `~/dev/CLAUDE.md`)
- `setup.sh` creates `~/dev/` with CLAUDE.md on fresh servers

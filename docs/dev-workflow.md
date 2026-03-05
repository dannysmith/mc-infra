# Dev Workflow

Developing and testing Fabric mods on the MC infrastructure.

## Overview

Dev repos live in `~/dev/` on the server, separate from the mc-infra repo at `/opt/minecraft/`. A `CLAUDE.md` in `~/dev/` provides AI-assistant context for mod development (placed by `setup.sh` from `shared/templates/dev-claude.md`).

The `test` server (ephemeral tier) is used for dev iteration.

## Mod Lifecycle

### 1. Develop

Scaffold a new Fabric mod project in `~/dev/` — either via the [Fabric template generator](https://fabricmc.net/develop/template/) or by cloning `fabric-example-mod`. Build with `./gradlew build`.

All tooling is pure JVM (JDK 21 + Gradle wrapper + Fabric Loom), so ARM on Hetzner is a non-issue. Build output is a platform-independent JAR.

### 2. Test

Copy the built JAR into a server's mods directory and restart:

```
cp build/libs/my-mod-1.0.0.jar /opt/minecraft/servers/test/data/mods/
mc-stop test && mc-start test
mc-logs test
```

**Important:** `REMOVE_OLD_MODS=TRUE` (set on all servers) deletes **all** `.jar` files from `data/mods/` on startup, then re-downloads Modrinth-managed mods. Manually-placed JARs will be wiped unless excluded. Add this to the server's `env` file:

```
REMOVE_OLD_MODS_EXCLUDE=my-mod-*.jar
```

Multiple patterns can be comma-separated. Without this, you'll need to re-copy your JAR after every restart.

### 3. Graduate to production

When a mod is ready for permanent use:

- **Private/custom mods:** Copy the JAR to `shared/mods/`, add the filename to the server's `jar_mods` list in `manifest.yml`, run `mc-generate`, and restart. The generator handles copying the JAR into the server's `data/mods/` directory.

- **Published mods:** Publish to Modrinth, then add the slug to `modrinth_mods` in `manifest.yml`, run `mc-generate`, and restart.

## Disk Usage

First Gradle/Loom project download: ~3-5 GB for caches. Additional projects share caches and add ~200-500 MB each.

## BlueMap Addons

BlueMap addons are regular Fabric mods that depend on BlueMapAPI as a `compileOnly` dependency. No special setup beyond a standard Fabric mod project.

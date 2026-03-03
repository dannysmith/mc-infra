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

# Optional: Dashboard & Polish

Lightweight web dashboard for server status, probably at `dashboard.mc.danny.is`.

## Basic Health Data

- Total CPU Load, Ram Usage & Disk Usage (on the box itself)
- Running Processes (from `ps`?)
- Status of all services running:
  - nginx - runs directly on boz
  - docker-compose status including services which are not inecraft worlds (acme-dns etc)

## Minecraft Servers

For each minecraft world we should show status, CPU/RAM usage, Disk usage, Uptime etc and basic info (name, minecraft version, various configs, backups, bluemap URL (if present) etc)

Clicking into a minecraft server should let us see:

- More detailed details
- The mods which are actually installed
- Size of the world (in GB on disk) and size of each dimension
- A running tail of the MC server log

Plus some MC data would be cool, extracted from various `.dat` files etc:

- Players and player positions/advancements etc
- Number of chunks generated
- Current number of entities loaded etc

It'd also be cool to be able to see live data from the `/bluemap` command (to see if bluemap is generating new map data) and `/dh debug` to see if Distant Horizons is generating Chunks and/or LODs

There may be some other cool stuff we could include as well. 

## Rough idea

- Queries Docker API for container states, RCON for TPS/player count, direct disk reads etc?
- Served by Nginx behind basic auth

## Other Key Points

- This whole thing can be read-only to begin with.
- Ideally, it would take up almost no resources when running idle (so as not to steal from the other processes) - so probably no polling etc when a uuser isn't actually using it.

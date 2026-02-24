# Phase 6: Optimisation

This task is all about performance and optimization on the server. I feel like this should probably include the following phases (not nececarrily in this order):

1. Minecraft Optimisations (ie how the game is set up, mods, mod config etc)
2. Java/Runtime/Minecraft/`itzg/minecraft-server` optimisation - The versions of Java that Minecraft uses, the flags we use to run it. optimizations for allocating resources intelligently. Especially if we have multiple servers running on this box. Maybe we could even do some intelligent stuff to you know allocate more resources or less res resources. I I don't know. Let's just look into this.
3. Docker optimization - Anything we can do to make Docker itself and/or docker-compose run better. Likewise the other services we're having docker-compose run. This may actually be a couple of phases, one for Docker itself and one for the non Minecraft services that are running in it. 
4. Optimising the box itself - This includes services we're running not via Docker (nginx?), the OS itself and the VPS itself.
5. Cron Jobs - Should we have certain cron jobs or other automated jobs which periodically do things like restart the server, clean out old docker nonsense, clean out any stuff which tends to build up over time etc. This probably applies both at the OS level and at the "minecraft server" level.

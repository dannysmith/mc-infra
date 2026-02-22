# Optional: Dashboard & Polish

Lightweight web dashboard for server status. Deferred — use CLI scripts initially.

## Rough idea

- Small Bun/Hono server or Python script
- Queries Docker API for container states, RCON for TPS/player count
- Served by Nginx behind basic auth
- Mod update checking automation
- Disk usage reporting
- Better documentation (CLAUDE.md improvements, runbooks)

## Not prioritised

This is a nice-to-have. Only tackle once everything else is stable and the CLI workflow feels limiting.

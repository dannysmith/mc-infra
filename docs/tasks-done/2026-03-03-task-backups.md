# Phase 4: Backups

Automated local backups for permanent-tier servers using `itzg/docker-mc-backup` sidecars.

## Requirements

- Backup config lives in `manifest.yml` per-server, under a `backup:` key
- `mc-create` auto-adds backup defaults for permanent tier: `interval: 24h`, `keep: 3`
- Other tiers get no backup by default (can be opted in manually via manifest)
- `mc-generate` produces a `<name>-backups` sidecar service in `docker-compose.yml` for each server with a `backup:` block
- Backups stored locally at `backups/<server-name>/`
- Pruning handled natively by docker-mc-backup via `PRUNE_BACKUPS_COUNT`

## Manifest format

```yaml
servers:
  creative:
    tier: permanent
    backup:
      interval: 24h   # BACKUP_INTERVAL (supports sleep format: 1h, 6h, 1d, etc.)
      keep: 3          # PRUNE_BACKUPS_COUNT (number of backups to retain)
    # ...
```

Servers without a `backup:` key get no backup sidecar.

## How it works

The `itzg/docker-mc-backup` sidecar:

1. Shares the MC server's `/data` volume (read-only)
2. Connects via RCON to coordinate safe backups (`save-off` -> `save-all` -> `sync` -> backup -> `save-on`)
3. Creates compressed `.tgz` archives in the backup destination
4. Automatically prunes old backups based on `PRUNE_BACKUPS_COUNT`
5. Default excludes: `*.jar`, `cache`, `logs`, `*.tmp` (backs up world data + configs, not downloadable files)

## Restoring from a backup

To restore a server from a backup:

1. Stop the server: `mc-stop <name>`
2. Remove the current data: `rm -rf servers/<name>/data/*`
3. Extract the backup: `tar xzf backups/<name>/<backup-file>.tgz -C servers/<name>/data/ --strip-components=1`
4. Start the server: `mc-start <name>`

Alternatively, docker-mc-backup provides a `restore-tar-backup` entrypoint that can be used as a Docker init container. This could be wired up as an `mc-restore` script in a future phase.

## Done when

- `creative` server backed up every 24h with 3 backups retained
- `mc-create --tier permanent` auto-adds backup config
- Backup sidecars generated in docker-compose.yml from manifest
- Tests pass
- Documentation updated

## Deferred

- **Offsite storage**: B2 or Hetzner Object Storage via rclone/restic (add `BACKUP_METHOD=rclone` later)
- **Cron infrastructure**: Not needed for this phase (docker-mc-backup handles scheduling + pruning). Revisit when we need host-level scheduled tasks.
- **Disk usage monitoring**: Future phase
- **`mc-restore` script**: Future convenience wrapper around the manual restore steps above
- **Semi-permanent tier defaults**: Can be added to mc-create later if needed

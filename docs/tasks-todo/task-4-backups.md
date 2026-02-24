# Phase 4: Backups & Resilience

Automated tiered backup system with offsite storage.

## Steps

- Configure itzg/docker-mc-backup sidecars for permanent/semi-permanent servers
- Set up offsite backup destination (B2 or Hetzner object storage) via rclone/restic
- Test backup restoration: spin up a server from a backup, verify it works
- Storage monitoring and disk usage reporting?

## Done when

- Permanent worlds backed up every 6h locally, daily offsite
- Semi-permanent worlds backed up daily locally, weekly offsite
- Backup restoration tested and documented

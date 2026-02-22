# Server Details

## Hetzner VPS

| Field       | Value                     |
| ----------- | ------------------------- |
| Name        | minecraft-vps             |
| ID          | #121769373                |
| Project     | Minecraft                 |
| Plan        | CAX21 (ARM, Ampere Altra) |
| Data Centre | hel1-dc2 (Helsinki)       |
| Zone        | eu-central                |
| OS          | Debian 13 (Trixie)        |
| CPU         | 4 vCPU (shared)           |
| RAM         | 8 GB                      |
| Disk        | 80 GB SSD                 |
| Traffic Out | 20 TB/mo                  |
| Price       | €7.19/mo                  |

### Network

| Type | Address                 |
| ---- | ----------------------- |
| IPv4 | 89.167.86.134           |
| IPv6 | 2a01:4f9:c014:408a::/64 |

### SSH Access

```
ssh root@89.167.86.134
```

After setup.sh runs, use the non-root user instead.

### Rescale Warning

**Never upgrade disk size during a rescale operation.** Always select "CPU and RAM only". Upgrading the disk permanently locks you out of downgrading to a smaller plan.

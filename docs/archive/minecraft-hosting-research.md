# Minecraft Server Hosting Research

> For Danny - Feb 2026. Researching alternatives to WiseHosting for hosting multiple worlds with more control.

## Current Setup (Baseline)

- **WiseHosting "Slime"**: 5GB RAM, 400% CPU, 100GB storage, extra backup
- **Cost**: $16.97/month
- **Mods**: Fabric + perf mods (Lithium, FerriteCore, Noisium, ScalableLux) + SimpleVoiceChat + DistantHorizons + BlueMap
- **What it gives you**: Custom Pterodactyl panel, one-click modpack installs, live player management, integrated backups, 24/7 support, AMD Ryzen/DDR5/NVMe hardware
- **What it lacks**: SSH access, ability to easily host multiple worlds, scripting/automation, cost-effective experimentation

---

## Part 1: VPS / Cloud Providers (Full Control)

These give you a blank Linux box with root SSH access. You manage everything yourself.

### Hetzner Cloud (Best Value - Strongly Recommended)

| Plan | vCPU | RAM | Storage | Price |
|---|---|---|---|---|
| CX33 (shared) | 4 shared | 8GB | 80GB SSD | ~€5.49/mo (~£4.70) |
| CPX32 (perf shared) | 4 shared | 8GB | 160GB NVMe | ~€10.99/mo (~£9.40) |
| CCX13 (dedicated) | 2 dedicated | 8GB | 80GB SSD | ~€12.49/mo (~£10.70) |
| CCX23 (dedicated) | 4 dedicated | 16GB | 160GB SSD | ~€21.99/mo (~£18.80) |

- **Locations**: Nuremberg & Falkenstein (Germany), Finland - **no UK datacenter**
- Germany is ~20-30ms latency from UK, absolutely fine for Minecraft
- Excellent reputation in the self-hosting community. Budget king for Europeans
- CCX13 Geekbench 6 single-core: ~1906 (solid for MC's single-threaded needs)
- **Pros**: Cheapest quality option, great performance, clean interface, hourly billing, 20TB+ traffic included
- **Cons**: No UK datacenter (Germany is close enough), CX33 only has 80GB storage (tight for BlueMap)
- **Sweet spot**: CCX13 (~£10.70/mo) - 2 dedicated cores means one for MC's main thread, one for DH/BlueMap background work. Add a 100GB volume (~€4.50/mo extra) if 80GB is tight for BlueMap tiles

### Contabo (Cheapest Raw Specs)

- **Cloud VPS M**: 6 vCPU, 16GB RAM, 200GB NVMe - **~€8/month** (~£7)
- **Has a UK datacenter in Portsmouth** (3ms latency to London)
- Known for generous specs at low prices
- **Pros**: Insane RAM-per-pound, actual UK location
- **Cons**: Mixed reputation for performance consistency, support can be slow, "you get what you pay for" is a common refrain. The CPUs are often oversubscribed. For Minecraft's single-thread needs, Hetzner's faster cores likely outperform Contabo despite lower specs on paper

### OVHcloud

- **VPS range**: Starts ~€4/month, an 8GB plan runs ~€13-18/month
- **Has UK datacenter (London)**
- Good DDoS protection (built-in)
- **Pros**: UK location, good bandwidth, DDoS protection
- **Cons**: Pricing has increased recently, UI/UX is not as clean as Hetzner, mixed support reviews

### DigitalOcean

- **8GB Shared CPU**: $48/month - **too expensive for this use case**
- Has a London datacenter
- Great developer experience but premium pricing
- **Verdict**: Skip - paying 3x Hetzner for similar specs

### Linode / Akamai Cloud

- **8GB Shared**: $48/month - same problem as DigitalOcean
- London datacenter available
- **Verdict**: Skip - same overpricing issue

### Vultr

- Similar to DigitalOcean pricing range
- London datacenter
- **Verdict**: Skip for the same cost reasons

### Oracle Cloud Free Tier (The Wild Card)

- **Always Free**: 4 OCPUs + 24GB RAM on ARM (Ampere A1), 200GB block storage - **literally free forever**
- UK London region exists
- Oracle themselves published a guide for running MC on this tier; community tutorials exist for Fabric/modded
- **The catches**:
  - **Idle reclaim**: Oracle reclaims instances below 20% CPU over 7 days. A MC server with no players online may trigger this. Fix: upgrade to Pay-As-You-Go (still free within limits) to prevent reclaim
  - **ARM architecture**: Fabric runs fine on ARM with Java 21+. Most mods work. But single-thread performance is weaker than x86 (Geekbench 6 single-core ~1100-1200 vs ~1900 for Hetzner CCX)
  - **Capacity**: ARM instances are frequently out of stock in popular regions. Getting one in London may require repeated attempts or scripting
  - **Oracle's UI** is enterprise-grade (i.e., confusing)
- **Verdict**: Absolutely worth trying first since it costs nothing. 24GB RAM is incredible for modded MC. If ARM performance is acceptable with DH+BlueMap and you can get an instance provisioned, it's unbeatable. If not, you've lost nothing

### VPS Recommendation

**Hetzner CX32 or CPX31** is the clear winner. ~€8-15/month for 8GB RAM with good single-thread CPU performance. The Germany location adds negligible latency for UK players. If you absolutely need a UK datacenter, OVH or Contabo are options, but Hetzner's quality-to-price ratio is hard to beat.

---

## Part 2: MC-Specific Hosting Providers (More Control Than WiseHosting)

The key finding here: **no managed Minecraft host offers full SSH access on their game server plans**. They all sandbox you. SSH is only available on their VPS/dedicated tiers, at which point you're basically self-hosting anyway.

### Bloom.host (Best Managed Option)

- **Performance 8GB**: **$10/month** (Ryzen 9 3900/3950X, 2 dedicated logical cores)
- **Performance+ 8GB**: **~$24/month** (Ryzen 9 7950X, 4 dedicated cores, 3 server splits, 150GB NVMe)
- **Killer feature: Server Splitting** - divide your plan into multiple independent sub-servers. Run survival + creative + test servers from one plan, splitting the RAM allocation between them
- Panel: DuckPanel (custom, modern, well-regarded)
- **Locations**: Germany (Falkenstein), US locations. No UK
- **SSH**: No on managed plans. Yes on their VPS tier ($11/mo for 4GB, $22/mo for 8GB)
- **Verdict**: The server splitting is genuinely unique and handles your "multiple worlds" requirement without SSH. DuckPanel covers scheduling, backups, restarts. If you can live without shell scripting, this is the best managed option

### PebbleHost (Best UK Managed Option)

- **Budget 5GB**: ~$5/month (Intel i9-9900k / Ryzen 5700X)
- **Premium 5GB**: ~$11.25/month (Ryzen 7900, DDR5)
- **Location: UK (Coventry)** - best latency of any researched provider
- No server splitting. Multiple worlds via plugins (Multiverse) or separate purchases
- **SSH**: No on managed plans. Available on VPS ($5+/mo) and Managed Dedicated ($19.95+/mo from Coventry with Pterodactyl)
- **Verdict**: Cheapest UK option. Good if you only need one world at a time and want low latency

### Sparked Host (Best Budget)

- **Budget 5GB**: **$6/month** ($0.50/GB - cheapest per-GB researched)
- Panel: Apollo Panel (modern, custom)
- **Locations**: Paris (closest to UK), Helsinki, Vienna. No UK
- No server splitting, no SSH on managed plans
- **Verdict**: Great value if you want cheap and cheerful with a nice panel

### BisectHosting

- **Premium 5GB**: ~$24.95/month
- Panel: Starbase (heavily customized Multicraft)
- London location exists but frequently out of stock
- Instance switching feature (somewhat like Bloom's splitting)
- **Verdict**: Expensive for what you get. The London location being unreliable is a problem

### Apex Hosting

- No SFTP (FTP only), no SSH, dated Multicraft panel
- **Verdict**: Not recommended for your use case at all

---

## Part 3: Self-Hosting Practicalities

### What You'd Need to Manage Yourself

| Task | Difficulty | Frequency |
|---|---|---|
| Initial VPS setup (OS, Docker, firewall) | Medium | Once |
| Setting up Minecraft server | Easy (with Docker) | Once per world |
| Java/Fabric/mod updates | Easy-Medium | Every few weeks |
| OS security updates | Easy (`apt upgrade`) | Weekly-ish |
| Backups | Easy (automated) | Set once, runs itself |
| Troubleshooting when things break | Variable | Occasional |
| SSL certs for BlueMap web UI | Easy (certbot auto-renews) | Set once |

### The Docker Approach (Recommended)

The `itzg/minecraft-server` Docker image is the gold standard for self-hosting. It handles Fabric, Forge, Paper, vanilla, and modpacks natively. Your entire setup lives in a single `docker-compose.yml`:

```yaml
services:
  survival:  # Your N19-equivalent world
    image: itzg/minecraft-server
    environment:
      TYPE: FABRIC
      VERSION: "1.21.4"
      EULA: "TRUE"
      MEMORY: "4G"
    ports:
      - "25565:25565"
    volumes:
      - ./survival-data:/data

  creative:  # Your creative world
    image: itzg/minecraft-server
    environment:
      TYPE: FABRIC
      VERSION: "1.21.4"
      EULA: "TRUE"
      MEMORY: "2G"
    ports:
      - "25566:25565"
    volumes:
      - ./creative-data:/data

  backups:  # Automated backup sidecar
    image: itzg/mc-backup
    volumes:
      - ./survival-data:/data:ro
      - ./backups:/backups
```

Starting/stopping worlds: `docker compose up -d survival` / `docker compose stop creative`

### Multi-Server Routing (mc-router)

`itzg/mc-router` lets you run multiple servers all on port 25565, routed by subdomain. Players connect to `survival.mc.yourdomain.com` or `creative.mc.yourdomain.com` - no ugly port numbers. Requires owning a domain.

### Web Panels (If You Want a UI)

| Panel | Type | Setup Effort | Best For |
|---|---|---|---|
| **None (just docker-compose + SSH)** | CLI | Trivial | Your use case honestly |
| **Crafty Controller** | Free, open-source | Easy (shell script) | MC-only, simple UI |
| **AMP (CubeCoders)** | Paid (~$10-20 licence) | Easy | Polished "just works" experience |
| **Pterodactyl / Pelican** | Free, open-source | High (multi-component) | Overkill unless scaling |

For 1-2 players with a handful of worlds, **skipping a panel entirely** and just using docker-compose + SSH is the simplest path. Claude Code can help you manage configs and troubleshoot over SSH directly.

### Performance Requirements for Your Mod Setup

| Component | RAM | Notes |
|---|---|---|
| Base Fabric server (1-2 players) | 2-3 GB | With your perf mods |
| Distant Horizons (server-side LODs) | +1-2 GB | Configurable thread count |
| BlueMap (during active rendering) | +1-3 GB | Spikes during initial render, lighter after |
| OS + Docker overhead | ~0.5-1 GB | |
| **Total recommended** | **6-8 GB** | |

**CPU**: Single-thread performance matters most (3.5+ GHz). MC main loop is single-threaded. DH and BlueMap rendering use extra threads, so 2-4 cores is ideal.

**Storage**: 40-80GB NVMe minimum. BlueMap tiles can grow - enable compression and set a world border. A 3k x 3k map with compression uses ~1GB; without limits it can balloon to hundreds of GB.

### Backup Strategy

With Docker, use `itzg/docker-mc-backup` as a sidecar container. It automatically:
- Pauses writes via RCON (`save-off`)
- Flushes data (`save-all`)
- Takes the backup (tar, rsync, restic, or rclone to cloud)
- Resumes writes (`save-on`)

For off-site: rclone to Backblaze B2 (~$0.005/GB/month) gives you disaster recovery.

### BlueMap Web Interface

BlueMap's built-in web server (port 8100) can be exposed via Nginx reverse proxy with a clean URL like `map.yourdomain.com` with free Let's Encrypt SSL. BlueMap docs have ready-made Nginx configs.

---

## Part 4: Comparison & Recommendations

### Cost Comparison

| Option | Monthly Cost | RAM | SSH | Multi-World | UK/Near-UK |
|---|---|---|---|---|---|
| **Oracle Cloud Free** | FREE | 24GB (ARM) | Yes | Yes | UK (London) |
| **WiseHosting (current)** | $16.97 (~£13.50) | 5GB | No | No | UK |
| **Hetzner CX33 (shared)** | ~€5.49 (~£4.70) | 8GB | Yes | Yes | Germany |
| **Hetzner CPX32 (perf shared)** | ~€10.99 (~£9.40) | 8GB | Yes | Yes | Germany |
| **Hetzner CCX13 (dedicated)** | ~€12.49 (~£10.70) | 8GB | Yes | Yes | Germany |
| **Contabo VPS M** | ~€8.49 (~£7.25) | 16GB | Yes | Yes | UK (Portsmouth) |
| **Bloom Performance 8GB** | $10 (~£8) | 8GB | No | Yes (splits) | Germany |
| **Bloom Performance+ 8GB** | $24 (~£19) | 8GB | No | Yes (3 splits) | Germany |
| **PebbleHost Budget 5GB** | $5 (~£4) | 5GB | No | No | UK (Coventry) |

### My Recommendations (In Order)

#### 1. Hetzner CCX13 + Docker (Best Overall)

**~£10.70/month** (or CX33 at ~£4.70 if you want to go cheaper with shared CPUs)

- Get a CCX13 from Hetzner (Falkenstein or Nuremberg) - 2 dedicated vCPUs, 8GB RAM
- Install Docker + Docker Compose
- Use `itzg/minecraft-server` for each world
- Use `itzg/docker-mc-backup` for automated backups
- Use Nginx for BlueMap reverse proxy
- Manage everything via SSH + docker-compose
- Claude Code can help with all of this directly over SSH
- If 80GB storage is tight for BlueMap, add a volume (~€4.50/mo for 100GB)

**Trade-off**: No web panel (unless you install one), no 24/7 support, Germany not UK (but ~20ms latency is fine). You need to be comfortable with basic Linux or willing to learn.

**Why dedicated vCPU matters**: MC's main game loop is single-threaded. With shared vCPUs, a noisy neighbour on the same physical core can cause tick lag. Dedicated cores (CCX) guarantee consistent performance. That said, the CX33 at £4.70/mo is worth trying first - if performance is fine, save the money.

#### 2. Bloom.host Performance 8GB (Best Managed)

**~£8/month** - if you don't want to self-manage but still want multiple worlds.

- Server splitting handles multiple worlds from one plan
- DuckPanel is modern and handles most management tasks
- Germany location
- No SSH, but SFTP + panel covers most needs
- Won't work for mod/plugin development or advanced scripting

**Trade-off**: No SSH means no Claude Code on the server, no custom scripting, limited experimentation capability.

#### 3. Keep WiseHosting for N19 + Hetzner VPS for Experimentation

**~£7.30 + £13.50 = ~£21/month total** - belt and suspenders approach.

- Keep your N19 world on WiseHosting where it's stable and managed
- Get a cheap Hetzner VPS purely for creative worlds, experimentation, mod development
- No risk to your main world while you learn self-hosting
- Can migrate N19 to the VPS later once you're confident

This is probably the most sensible starting point if you don't want to risk disrupting your existing setup.

---

## Key Sources

- [Hetzner Cloud Pricing](https://www.hetzner.com/cloud/)
- [Contabo UK VPS](https://contabo.com/en/vps-uk/)
- [Bloom.host Plans](https://bloom.host/compare-plans/)
- [PebbleHost](https://pebblehost.com/)
- [itzg/minecraft-server Docker](https://hub.docker.com/r/itzg/minecraft-server)
- [itzg/mc-router (subdomain routing)](https://github.com/itzg/mc-router)
- [itzg/docker-mc-backup](https://github.com/itzg/docker-mc-backup)
- [BlueMap Nginx Reverse Proxy](https://bluemap.bluecolored.de/wiki/webserver/NginxProxy.html)
- [Pterodactyl Panel](https://pterodactyl.io/)
- [Crafty Controller](https://craftycontrol.com/)
- [Oracle Cloud Free Tier](https://www.oracle.com/uk/cloud/free/)
- [GetDeploying VPS Price Comparison](https://getdeploying.com/reference/compute-prices)

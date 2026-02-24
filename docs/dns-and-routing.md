# DNS, Routing & SSL

How Minecraft connections, BlueMap web UIs, and SSL certificate renewal all work together. Reference this when adding or removing servers.

## Domain Structure

Everything lives under `*.mc.danny.is`, managed via DNSimple on the `danny.is` domain.

- **MC servers**: `<name>.mc.danny.is` (e.g. `creative.mc.danny.is`)
- **BlueMap UIs**: `map-<name>.mc.danny.is` (e.g. `map-creative.mc.danny.is`)

A wildcard A record (`*.mc.danny.is → 89.167.86.134`) means no DNS changes are needed when adding or removing servers. All subdomains resolve to the VPS automatically.

## DNS Records on DNSimple

| Type | Name | Value | Purpose |
|------|------|-------|---------|
| A | `mc.danny.is` | `89.167.86.134` | Apex subdomain (HTTPS redirect) |
| A | `*.mc.danny.is` | `89.167.86.134` | All MC server and BlueMap subdomains |
| A | `acme.mc.danny.is` | `89.167.86.134` | Points to acme-dns nameserver |
| NS | `acme.mc.danny.is` | `acme.mc.danny.is.` | Delegates DNS authority to acme-dns |
| CNAME | `_acme-challenge.mc.danny.is` | `<uuid>.acme.mc.danny.is.` | Routes ACME challenges to acme-dns |
| CAA | `mc.danny.is` | `0 issue "letsencrypt.org"` | Only Let's Encrypt can issue certs |

These are all static. The only time you'd touch DNSimple is if the VPS IP changes or you need to re-register with acme-dns (new UUID for the CNAME).

## Traffic Flow

### Minecraft connections (TCP 25565)

```
Player connects to creative.mc.danny.is:25565
  → *.mc.danny.is A record → VPS (89.167.86.134)
  → mc-router container (listening on host port 25565)
  → inspects SNI hostname → routes to "creative" container on minecraft-net
  → creative:25565 (internal Docker network)
```

**mc-router** (`itzg/mc-router`) handles subdomain-based routing. It reads the Minecraft handshake packet to determine which hostname the player connected to, then forwards to the correct backend container. Config is a static `MAPPING` env var in docker-compose.yml:

```yaml
MAPPING: |
  creative.mc.danny.is=creative:25565
  test.mc.danny.is=test:25565
```

All MC servers listen on internal port 25565 but never expose it to the host — mc-router is the only entry point. Servers communicate via the `minecraft-net` Docker bridge network.

### BlueMap web UIs (HTTPS 443)

```
Browser visits https://map-creative.mc.danny.is
  → *.mc.danny.is A record → VPS
  → Nginx (on host, port 443) → matches server_name
  → proxy_pass to 127.0.0.1:8100
  → creative container's BlueMap web server
```

**Nginx** runs on the host (not in Docker). Each server with BlueMap gets:
1. A host port binding in docker-compose: `127.0.0.1:8100:8100` (localhost only, not public)
2. A `server` block in `nginx/conf.d/bluemap.conf` mapping `map-<name>.mc.danny.is` to that port

BlueMap ports are sequential: 8100, 8101, 8102, etc. They're bound to `127.0.0.1` so they're only accessible via Nginx, not directly from the internet.

Nginx also handles HTTP → HTTPS redirect for all `*.mc.danny.is` requests.

### Simple Voice Chat (UDP 24454)

```
Player's SVC client → mc.danny.is:24454/udp
  → VPS → directly mapped to one MC container
```

SVC uses UDP, which mc-router can't route (it only handles TCP). Port 24454 is mapped directly from the host to whichever server has SVC enabled. Only one server can have SVC at a time.

### SSL certificate renewal (ACME DNS-01)

```
certbot renew
  → acme-dns-auth.py hook → POST http://127.0.0.1:8053/update (acme-dns API)
  → acme-dns stores TXT record

Let's Encrypt validates:
  → queries _acme-challenge.mc.danny.is
  → CNAME → <uuid>.acme.mc.danny.is
  → NS delegation → acme-dns container on port 53
  → acme-dns responds with TXT record
  → validation passes → cert issued
```

See "Why acme-dns" below for why this is set up this way.

## Port Summary

| Port | Protocol | Exposed to | Service | Notes |
|------|----------|-----------|---------|-------|
| 25565 | TCP | Public | mc-router | Routes to MC servers by subdomain |
| 443 | TCP | Public | Nginx | SSL termination, BlueMap reverse proxy |
| 80 | TCP | Public | Nginx | HTTP → HTTPS redirect only |
| 53 | TCP+UDP | Public | acme-dns | DNS server for ACME challenges |
| 24454 | UDP | Public | SVC | Direct to one MC server only |
| 8053 | TCP | Localhost | acme-dns API | Hook script updates TXT records |
| 8100+ | TCP | Localhost | BlueMap | One port per server, Nginx proxies to these |

## SSL Certificates

A single wildcard cert covers `mc.danny.is` and `*.mc.danny.is`. Managed by certbot with auto-renewal via systemd timer.

- **Cert location**: `/etc/letsencrypt/live/mc.danny.is/`
- **Nginx SSL config**: `nginx/conf.d/ssl.conf` (included by each server block)
- **Renewal hook**: `/etc/letsencrypt/acme-dns-auth.py`
- **Credentials**: `/etc/letsencrypt/acmedns.json`
- **Post-renewal**: `/etc/letsencrypt/renewal-hooks/post/reload-nginx.sh` reloads Nginx

### Why acme-dns

Wildcard certs require DNS-01 validation — the CA needs a TXT record at `_acme-challenge.mc.danny.is`. The obvious approach is to use a DNSimple API token to create that record automatically. But DNSimple tokens have zone-level granularity at best — a token that can write `_acme-challenge.mc.danny.is` can also write MX records, A records, and anything else in the `danny.is` zone. If the VPS is compromised, an attacker could hijack email, redirect the apex domain, etc.

**acme-dns** solves this by running a tiny purpose-built DNS server that can only serve TXT records for ACME challenges. A CNAME in DNSimple (set once, via the UI) delegates `_acme-challenge.mc.danny.is` to acme-dns. The only credentials on the VPS are acme-dns credentials that can update a single TXT record — they can't touch `danny.is` at all.

The CAA record on `mc.danny.is` adds a second layer: even if someone could manipulate the ACME challenges, only Let's Encrypt is authorized to issue certs for `mc.danny.is` and its subdomains. This doesn't affect other subdomains of `danny.is`.

## Adding a New Server

When creating a new MC server (e.g. `survival`), the routing-related changes are:

### 1. mc-router mapping (docker-compose.yml)

Add the new hostname to the `MAPPING` env var:

```yaml
MAPPING: |
  creative.mc.danny.is=creative:25565
  survival.mc.danny.is=survival:25565
```

No new ports needed — mc-router handles it internally.

### 2. BlueMap (if enabled)

Add a localhost port binding in docker-compose.yml for the new server (next sequential port):

```yaml
ports:
  - "127.0.0.1:8101:8100"
```

Add a new `server` block in `nginx/conf.d/bluemap.conf`:

```nginx
server {
    listen 443 ssl;
    server_name map-survival.mc.danny.is;

    include /opt/minecraft/nginx/conf.d/ssl.conf;

    location / {
        proxy_pass http://127.0.0.1:8101;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Then `sudo nginx -t && sudo systemctl reload nginx`.

### 3. DNS

Nothing. The wildcard A record (`*.mc.danny.is`) already covers all subdomains.

### 4. SSL

Nothing. The wildcard cert (`*.mc.danny.is`) already covers all subdomains.

## If the VPS IP Changes

Update the A record in `acme-dns/config/config.cfg`:

```ini
records = [
    "acme.mc.danny.is. A <new-ip>",
    ...
```

Then update DNS A records in DNSimple (via UI):
- `mc.danny.is` → new IP
- `*.mc.danny.is` → new IP
- `acme.mc.danny.is` → new IP

Restart acme-dns and verify: `docker compose restart acme-dns`

Also update `docs/server-details.md` with the new IP.

## If the Domain Changes

If moving from `mc.danny.is` to a different domain, update these files:

| File | What to change |
|------|---------------|
| `acme-dns/config/config.cfg` | `domain`, `nsname`, `nsadmin`, `records` |
| `docker-compose.yml` | mc-router `MAPPING` hostnames |
| `nginx/conf.d/bluemap.conf` | `server_name` directives |
| `nginx/conf.d/ssl.conf` | Certificate paths |
| `setup-ssl.sh` | `DOMAIN` variable |

You'll also need to:
1. Set up new DNS records (A, NS, CNAME, CAA) for the new domain
2. Re-register with acme-dns (`setup-ssl.sh` handles this)
3. Obtain a new wildcard cert for the new domain

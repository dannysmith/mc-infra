# Phase 2b: SSL Hardening — acme-dns + CAA

Eliminate the DNSimple API token from the VPS by switching to self-hosted acme-dns for cert renewal, then add CAA records to restrict cert issuance for mc.danny.is.

## Why

Phase 2 left a DNSimple API token on the VPS (`~/.secrets/dnsimple.ini`). That token has full write access to the entire `danny.is` zone — MX records, A records, everything. If the VPS is compromised, an attacker could redirect email, hijack the apex domain, etc. The MC worlds are expendable; `danny.is` is not.

DNSimple's scoped tokens only support zone-level granularity (not subdomain or record type), and require their $29/mo Teams plan. Even scoped to the `danny.is` zone, an attacker could still modify MX records. CNAME delegation to a self-hosted acme-dns is the standard solution.

## Architecture

Before (insecure):
```
certbot → DNSimple API (full zone access) → creates TXT at _acme-challenge.mc.danny.is
```

After (secure):
```
certbot → acme-dns-certbot hook → acme-dns API (localhost:8053) → serves TXT via DNS
Let's Encrypt → queries _acme-challenge.mc.danny.is → CNAME → <uuid>.acme.mc.danny.is → acme-dns:53
```

No DNS provider credentials on the VPS. acme-dns credentials can only update a single TXT record.

## Part 1: acme-dns Migration

### DNS records (one-time, via DNSimple UI)

| Type | Name | Value | Purpose |
|------|------|-------|---------|
| A | `acme.mc.danny.is` | `89.167.86.134` | Points to acme-dns server |
| NS | `acme.mc.danny.is` | `acme.mc.danny.is.` | Delegates DNS authority to acme-dns |
| CNAME | `_acme-challenge.mc.danny.is` | `775c7448-6d4d-47c0-b526-54b7d4b97c07.acme.mc.danny.is.` | Redirects ACME challenges to acme-dns |

Also deleted the two leftover TXT records at `_acme-challenge.mc.danny.is` from the previous DNSimple-based certbot run.

### docker-compose.yml — acme-dns service

The official `joohoi/acme-dns` Docker Hub image is x86 only. Our VPS is ARM (Hetzner CAX21), so we build from source via a custom Dockerfile at `acme-dns/Dockerfile`.

```yaml
acme-dns:
  build: ./acme-dns
  container_name: acme-dns
  ports:
    - "53:53"
    - "53:53/udp"
    - "127.0.0.1:8053:80"
  volumes:
    - ./acme-dns/config:/etc/acme-dns:ro
    - ./acme-dns/data:/var/lib/acme-dns
  restart: unless-stopped
```

API on `127.0.0.1:8053` (localhost only — not public). DNS on port 53 (must be public for Let's Encrypt to query).

### Custom Dockerfile (`acme-dns/Dockerfile`)

The upstream Dockerfile uses `CGO_ENABLED=0`, which silently excludes the SQLite driver (`glebarez/go-sqlite` requires CGo). Our Dockerfile removes that flag and adds `gcc musl-dev` to the Alpine builder stage so the SQLite driver compiles.

```dockerfile
FROM golang:alpine AS builder
RUN apk add --update git gcc musl-dev
ENV GOPATH /tmp/buildcache
RUN git clone https://github.com/joohoi/acme-dns /tmp/acme-dns
WORKDIR /tmp/acme-dns
RUN go build

FROM alpine:latest
WORKDIR /root/
COPY --from=builder /tmp/acme-dns .
RUN mkdir -p /etc/acme-dns /var/lib/acme-dns
RUN apk --no-cache add ca-certificates && update-ca-certificates
VOLUME ["/etc/acme-dns", "/var/lib/acme-dns"]
ENTRYPOINT ["./acme-dns"]
EXPOSE 53 80 443
EXPOSE 53/udp
```

### acme-dns config (`acme-dns/config/config.cfg`)

```ini
[general]
listen = "0.0.0.0:53"
protocol = "both"
domain = "acme.mc.danny.is"
nsname = "acme.mc.danny.is"
nsadmin = "admin.mc.danny.is"
records = [
    "acme.mc.danny.is. A 89.167.86.134",
    "acme.mc.danny.is. NS acme.mc.danny.is."
]
debug = false

[database]
engine = "sqlite"
connection = "/var/lib/acme-dns/acme-dns.db"

[api]
ip = "0.0.0.0"
port = "80"
tls = "none"
disable_registration = true

[logconfig]
loglevel = "info"
logtype = "stdout"
```

Note: `engine = "sqlite"` (not `"sqlite3"`). The `glebarez/go-sqlite` driver registers as `"sqlite"`.

Registration is disabled after initial setup. To re-register, temporarily set `disable_registration = false` and restart.

### certbot hook script

The `acme-dns-certbot-joohoi` hook script handles registration and TXT record updates.

```bash
sudo curl -o /etc/letsencrypt/acme-dns-auth.py https://raw.githubusercontent.com/joohoi/acme-dns-certbot-joohoi/master/acme-dns-auth.py
sudo chmod 0700 /etc/letsencrypt/acme-dns-auth.py
```

Two manual fixes needed after download:
- Set `ACMEDNS_URL = "http://127.0.0.1:8053"` (default points to public instance)
- Change shebang from `#!/usr/bin/env python` to `#!/usr/bin/env python3` (Debian 13 has no `python` binary)

Credentials are stored at `/etc/letsencrypt/acmedns.json`.

### What we actually did (migration steps)

The original plan had us manually registering with acme-dns first, then configuring the hook. In practice, the hook script self-registers on first run, which is simpler but means the CNAME must be set after the first certbot run, not before.

Corrected order:

1. Added acme-dns to docker-compose with custom Dockerfile, created config directory and config.cfg
2. Built from source on VPS: `docker compose up -d --build acme-dns`
3. Opened port 53 in UFW (`sudo ufw allow 53`)
4. In DNSimple UI: created A and NS records for `acme.mc.danny.is` (CNAME comes later)
5. Installed certbot hook script (with python3 shebang fix and ACMEDNS_URL fix)
6. Ran certbot with hook — script self-registered and stored credentials in `/etc/letsencrypt/acmedns.json`:
   ```bash
   sudo /root/.local/bin/certbot certonly --manual \
     --manual-auth-hook /etc/letsencrypt/acme-dns-auth.py \
     --preferred-challenges dns \
     -d 'mc.danny.is' \
     -d '*.mc.danny.is' \
     --force-renewal
   ```
7. Added CNAME in DNSimple using the UUID from the hook's registration (visible in acmedns.json)
8. Set `disable_registration = true` in config.cfg, restarted acme-dns
9. Verified auto-renewal: `sudo /root/.local/bin/certbot renew --dry-run`
10. Cleaned up:
    - Deleted DNSimple credentials from VPS: `rm -f ~/.secrets/dnsimple.ini`
    - Uninstalled certbot-dns-dnsimple plugin: `sudo pipx runpip certbot uninstall certbot-dns-dnsimple -y`
    - Removed `DNSIMPLE_TOKEN` from `.env.tpl`
    - Cycled the DNSimple API token (revoked old, generated new, stored in personal 1Password vault — not the "MC Server" vault accessible from the VPS)

### Gotchas encountered

- **`certbot --force-renewal` can mask broken hooks**: Let's Encrypt caches authorizations, so `--force-renewal` succeeded even with a broken hook script. Only `certbot renew --dry-run` (which uses the staging server) actually tests the hook end-to-end.
- **Hook script filename**: The download URL uses hyphens (`acme-dns-auth.py`), not underscores. The wrong URL returns a 14-byte 404 page that's easy to miss.
- **Manual registration is redundant**: No need to `curl POST /register` manually. The hook script registers its own account on first run. Doing both creates two accounts with different UUIDs, requiring a CNAME update.

## Part 2: CAA Records

### What CAA does

CAA records tell Certificate Authorities which CAs are allowed to issue certs for a domain. A CAA record on `mc.danny.is` restricts `mc.danny.is` and everything under it, without affecting `danny.is` or sibling subdomains.

The lookup algorithm walks up the DNS tree and stops at the first CAA record found. So `mc.danny.is CAA` does not interfere with `foo.danny.is` or `danny.is` itself.

### Record added (via DNSimple UI)

| Type | Name | Value |
|------|------|-------|
| CAA | `mc.danny.is` | `0 issue "letsencrypt.org"` |

This allows Let's Encrypt (and only Let's Encrypt) to issue certs for `mc.danny.is` and `*.mc.danny.is`. All other CAs are blocked.

No `issuewild` needed — when only `issue` is present, it governs both regular and wildcard certs.

## Done when

- [x] acme-dns running as a container, serving DNS-01 challenges
- [x] certbot uses acme-dns hook for renewal (no DNSimple plugin)
- [x] No DNSimple credentials on the VPS (no token in `.env.tpl`, no `.ini` file, token not in "MC Server" vault)
- [x] Old DNSimple API token revoked and cycled
- [x] CAA record on `mc.danny.is` restricting issuance to Let's Encrypt
- [x] `certbot renew --dry-run` passes

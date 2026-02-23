# Phase 2b: SSL Hardening — acme-dns + CAA

Eliminate the DNSimple API token from the VPS by switching to self-hosted acme-dns for cert renewal, then add CAA records to restrict cert issuance for mc.danny.is.

## Why

Phase 2 left a DNSimple API token on the VPS (`~/.secrets/dnsimple.ini`). That token has full write access to the entire `danny.is` zone — MX records, A records, everything. If the VPS is compromised, an attacker could redirect email, hijack the apex domain, etc. The MC worlds are expendable; `danny.is` is not.

## Architecture

Current (insecure):
```
certbot → DNSimple API (full zone access) → creates TXT at _acme-challenge.mc.danny.is
```

Target (secure):
```
certbot → acme-dns-certbot hook → acme-dns API (localhost) → serves TXT via DNS
Let's Encrypt → queries _acme-challenge.mc.danny.is → CNAME → <uuid>.acme.mc.danny.is → acme-dns:53
```

No DNS provider credentials on the VPS. acme-dns credentials can only update a single TXT record.

## Part 1: acme-dns Migration

### DNS records (one-time, via DNSimple UI)

| Type | Name | Value | Purpose |
|------|------|-------|---------|
| A | `acme.mc.danny.is` | `<vps-ip>` | Points to acme-dns server |
| NS | `acme.mc.danny.is` | `acme.mc.danny.is.` | Delegates DNS authority to acme-dns |
| CNAME | `_acme-challenge.mc.danny.is` | `<uuid>.acme.mc.danny.is.` | Redirects ACME challenges to acme-dns (uuid comes from registration step) |

### docker-compose.yml — add acme-dns service

```yaml
acme-dns:
  image: joohoi/acme-dns
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

### acme-dns config (`acme-dns/config/config.cfg`)

```ini
[general]
listen = "0.0.0.0:53"
protocol = "both"
domain = "acme.mc.danny.is"
nsname = "acme.mc.danny.is"
nsadmin = "admin.mc.danny.is"
records = [
    "acme.mc.danny.is. A <vps-ip>",
    "acme.mc.danny.is. NS acme.mc.danny.is."
]
debug = false

[database]
engine = "sqlite3"
connection = "/var/lib/acme-dns/acme-dns.db"

[api]
ip = "0.0.0.0"
port = "80"
tls = "none"
disable_registration = false

[logconfig]
loglevel = "info"
logtype = "stdout"
```

After initial registration, set `disable_registration = true` to lock down the API.

### certbot hook script

Install `acme-dns-certbot-joohoi` hook:
```bash
sudo curl -o /etc/letsencrypt/acme-dns-auth.py https://raw.githubusercontent.com/joohoi/acme-dns-certbot-joohoi/master/acme_dns_auth.py
sudo chmod +x /etc/letsencrypt/acme-dns-auth.py
```

Edit the script: set `ACMEDNS_URL = "http://127.0.0.1:8053"`.

### Migration steps

1. Add acme-dns to docker-compose, create config directory and config.cfg
2. Open port 53 in UFW (`sudo ufw allow 53`)
3. `docker compose up -d acme-dns`
4. Register with acme-dns: `curl -s -X POST http://127.0.0.1:8053/register | jq .`
   - Note the `fulldomain` (uuid) and `subdomain` values
5. In DNSimple UI: create the A, NS, and CNAME records (using the uuid from registration)
6. Wait for DNS propagation
7. Set `disable_registration = true` in config.cfg, restart acme-dns
8. Run certbot with the new hook (first run uses `--debug-challenges` to pause and verify):
   ```bash
   sudo /root/.local/bin/certbot certonly --manual \
     --manual-auth-hook /etc/letsencrypt/acme-dns-auth.py \
     --preferred-challenges dns \
     --debug-challenges \
     -d 'mc.danny.is' \
     -d '*.mc.danny.is' \
     --force-renewal
   ```
9. Verify cert renewed: `sudo /root/.local/bin/certbot certificates`
10. Reload Nginx: `sudo systemctl reload nginx`
11. Delete DNSimple credentials from VPS: `rm -f ~/.secrets/dnsimple.ini`
12. Cycle the DNSimple API token (revoke the old one in DNSimple account settings, generate a new one, update 1Password)
13. Uninstall the certbot-dns-dnsimple plugin: `sudo pipx runpip certbot uninstall certbot-dns-dnsimple`
14. Verify auto-renewal works: `sudo /root/.local/bin/certbot renew --dry-run`

## Part 2: CAA Records

Separate from Part 1 — can be done before or after.

### What CAA does

CAA records tell Certificate Authorities which CAs are allowed to issue certs for a domain. A CAA record on `mc.danny.is` restricts `mc.danny.is` and everything under it, without affecting `danny.is` or sibling subdomains.

The lookup algorithm walks up the DNS tree and stops at the first CAA record found. So `mc.danny.is CAA` does not interfere with `foo.danny.is` or `danny.is` itself.

### Before adding CAA records

Audit: check if any other service issues certs for subdomains of `mc.danny.is`. (There shouldn't be — this subdomain is new and only used for MC infrastructure.) If any future service needs certs from a different CA, add that CA to the CAA record.

### Records to add (via DNSimple UI)

| Type | Name | Value |
|------|------|-------|
| CAA | `mc.danny.is` | `0 issue "letsencrypt.org"` |

This allows Let's Encrypt (and only Let's Encrypt) to issue certs for `mc.danny.is` and `*.mc.danny.is`. All other CAs are blocked.

No `issuewild` needed — when only `issue` is present, it governs both regular and wildcard certs.

### Verify

```bash
dig mc.danny.is CAA
```

Should show the CAA record. Then test that cert issuance still works:

```bash
sudo /root/.local/bin/certbot renew --dry-run
```

## Done when

- acme-dns running as a container, serving DNS-01 challenges
- certbot uses acme-dns hook for renewal (no DNSimple plugin)
- No DNSimple credentials on the VPS
- Old DNSimple API token revoked and cycled
- CAA record on `mc.danny.is` restricting issuance to Let's Encrypt
- `certbot renew --dry-run` passes

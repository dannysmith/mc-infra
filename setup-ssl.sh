#!/usr/bin/env bash
#
# setup-ssl.sh — Set up SSL wildcard cert for *.mc.danny.is via acme-dns.
#
# Run with sudo after setup.sh and docker compose up -d (acme-dns must be running).
# Interactive — requires adding a CNAME record in DNSimple on first run.
#
# Safe to re-run: skips registration if credentials already exist, and
# --force-renewal ensures a fresh cert regardless of expiry.
#
# See docs/dns-and-routing.md for full architecture details.
#

set -euo pipefail

CERTBOT="/root/.local/bin/certbot"
HOOK_SCRIPT="/etc/letsencrypt/acme-dns-auth.py"
ACMEDNS_CREDS="/etc/letsencrypt/acmedns.json"
ACMEDNS_URL="http://127.0.0.1:8053"
ACMEDNS_CONFIG="/opt/minecraft/acme-dns/config/config.cfg"
DOMAIN="mc.danny.is"
EMAIL="hi@danny.is"

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------

if [[ $EUID -ne 0 ]]; then
  echo "Error: This script must be run with sudo." >&2
  exit 1
fi

if ! curl -sf "$ACMEDNS_URL/health" &>/dev/null && ! curl -sf -X POST "$ACMEDNS_URL/register" -o /dev/null 2>/dev/null; then
  # Try a simple connection test instead
  if ! curl -sf --connect-timeout 3 "$ACMEDNS_URL/" &>/dev/null 2>&1; then
    echo "Error: acme-dns is not responding at $ACMEDNS_URL" >&2
    echo "Make sure docker compose is running: docker compose up -d acme-dns" >&2
    exit 1
  fi
fi

if [[ ! -f "$HOOK_SCRIPT" ]]; then
  echo "Error: certbot hook script not found at $HOOK_SCRIPT" >&2
  echo "Run setup.sh first." >&2
  exit 1
fi

if [[ ! -f "$CERTBOT" ]]; then
  echo "Error: certbot not found at $CERTBOT" >&2
  echo "Run setup.sh first." >&2
  exit 1
fi

echo "==> SSL setup for *.$DOMAIN"

# ---------------------------------------------------------------------------
# 1. acme-dns registration (first time only)
# ---------------------------------------------------------------------------

if [[ -f "$ACMEDNS_CREDS" ]]; then
  echo "==> Existing acme-dns credentials found at $ACMEDNS_CREDS"
  echo "    Skipping registration (delete this file to re-register)"
else
  echo "==> No existing credentials — registering with acme-dns..."

  # Temporarily enable registration if it's locked down
  REGISTRATION_WAS_DISABLED=false
  if grep -q 'disable_registration = true' "$ACMEDNS_CONFIG" 2>/dev/null; then
    REGISTRATION_WAS_DISABLED=true
    sed -i 's/disable_registration = true/disable_registration = false/' "$ACMEDNS_CONFIG"
    docker restart acme-dns
    sleep 2
    echo "    Temporarily enabled registration"
  fi

  # The hook script handles registration on first run of certbot.
  # But we need to do a manual registration first to get the CNAME value,
  # because the CNAME must exist before Let's Encrypt can validate.
  echo ""
  echo "    Running certbot (the hook will register and tell you the CNAME to add)..."
  echo ""

  # First attempt — will register with acme-dns and likely fail validation
  # because the CNAME doesn't exist yet. That's expected.
  set +e
  $CERTBOT certonly --manual \
    --manual-auth-hook "$HOOK_SCRIPT" \
    --preferred-challenges dns \
    -d "$DOMAIN" \
    -d "*.$DOMAIN" \
    --agree-tos \
    --non-interactive \
    --email "$EMAIL" \
    --force-renewal 2>&1
  CERTBOT_EXIT=$?
  set -e

  if [[ $CERTBOT_EXIT -ne 0 ]] && [[ -f "$ACMEDNS_CREDS" ]]; then
    # Registration succeeded but validation failed (expected — CNAME not set yet)
    FULLDOMAIN=$(python3 -c "import json; d=json.load(open('$ACMEDNS_CREDS')); print(list(d.values())[0]['fulldomain'])")

    echo ""
    echo "============================================"
    echo "  MANUAL STEP REQUIRED"
    echo "============================================"
    echo ""
    echo "Add this CNAME record in DNSimple (danny.is zone):"
    echo ""
    echo "  Type:  CNAME"
    echo "  Name:  _acme-challenge.$DOMAIN"
    echo "  Value: $FULLDOMAIN."
    echo ""
    echo "If this record already exists, update it to the value above."
    echo ""
    echo "Wait for DNS propagation, then press ENTER to continue..."
    read -r

    # Verify DNS
    echo "==> Verifying DNS..."
    RESOLVED=$(dig +short "_acme-challenge.$DOMAIN" CNAME 2>/dev/null | sed 's/\.$//')
    if [[ "$RESOLVED" == "$FULLDOMAIN" ]]; then
      echo "    CNAME resolves correctly"
    else
      echo "    WARNING: CNAME resolves to '$RESOLVED', expected '$FULLDOMAIN'"
      echo "    DNS may still be propagating. Continuing anyway..."
    fi
  elif [[ $CERTBOT_EXIT -eq 0 ]]; then
    echo "==> Certificate issued successfully on first attempt"
  else
    echo "Error: certbot failed and no credentials were saved." >&2
    echo "Check the logs: /var/log/letsencrypt/letsencrypt.log" >&2
    exit 1
  fi

  # Re-disable registration
  if [[ "$REGISTRATION_WAS_DISABLED" == true ]] || [[ -f "$ACMEDNS_CREDS" ]]; then
    sed -i 's/disable_registration = false/disable_registration = true/' "$ACMEDNS_CONFIG"
    docker restart acme-dns
    echo "    Registration locked down"
  fi
fi

# ---------------------------------------------------------------------------
# 2. Issue/renew certificate
# ---------------------------------------------------------------------------

echo "==> Requesting certificate for $DOMAIN and *.$DOMAIN..."
$CERTBOT certonly --manual \
  --manual-auth-hook "$HOOK_SCRIPT" \
  --preferred-challenges dns \
  -d "$DOMAIN" \
  -d "*.$DOMAIN" \
  --agree-tos \
  --non-interactive \
  --email "$EMAIL" \
  --force-renewal

echo "==> Reloading Nginx..."
systemctl reload nginx

# ---------------------------------------------------------------------------
# 3. Verify
# ---------------------------------------------------------------------------

echo "==> Verifying auto-renewal..."
$CERTBOT renew --dry-run

echo ""
echo "============================================"
echo "  SSL setup complete!"
echo "============================================"
echo ""
echo "Certificate: /etc/letsencrypt/live/$DOMAIN/"
echo "Auto-renewal: certbot systemd timer + acme-dns hook"
echo ""
echo "Test:"
echo "  - Visit https://map-creative.$DOMAIN in a browser"
echo "  - Run: $CERTBOT certificates"
echo ""

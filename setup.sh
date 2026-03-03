#!/usr/bin/env bash
#
# setup.sh — Provision a fresh Debian 13 (Trixie) VPS for Minecraft server hosting.
# Run as root. Idempotent (safe to re-run).
#

set -euo pipefail

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------

if [[ $EUID -ne 0 ]]; then
  echo "Error: This script must be run as root." >&2
  exit 1
fi

if [[ ! -f /etc/debian_version ]]; then
  echo "Error: This script is intended for Debian." >&2
  exit 1
fi

ARCH=$(dpkg --print-architecture)
echo "==> Running on Debian $(cat /etc/debian_version), arch: $ARCH"

# ---------------------------------------------------------------------------
# 1. System update
# ---------------------------------------------------------------------------

echo "==> Updating system packages..."
apt-get update
apt-get upgrade -y

# ---------------------------------------------------------------------------
# 2. Create user 'danny' with sudo + SSH keys
# ---------------------------------------------------------------------------

echo "==> Setting up user 'danny'..."
if ! id danny &>/dev/null; then
  adduser --disabled-password --gecos "" danny
  echo "    Created user danny"
else
  echo "    User danny already exists"
fi

usermod -aG sudo danny

# Passwordless sudo
if [[ ! -f /etc/sudoers.d/danny ]]; then
  echo "danny ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/danny
  chmod 440 /etc/sudoers.d/danny
  echo "    Configured passwordless sudo"
fi

# Copy SSH authorized_keys from root
DANNY_SSH_DIR="/home/danny/.ssh"
mkdir -p "$DANNY_SSH_DIR"
if [[ -f /root/.ssh/authorized_keys ]]; then
  cp /root/.ssh/authorized_keys "$DANNY_SSH_DIR/authorized_keys"
  chown -R danny:danny "$DANNY_SSH_DIR"
  chmod 700 "$DANNY_SSH_DIR"
  chmod 600 "$DANNY_SSH_DIR/authorized_keys"
  echo "    Copied SSH keys from root"
fi

# ---------------------------------------------------------------------------
# 3. SSH hardening
# ---------------------------------------------------------------------------

echo "==> Hardening SSH..."
cat > /etc/ssh/sshd_config.d/99-hardening.conf <<'SSHEOF'
PermitRootLogin no
PasswordAuthentication no
SSHEOF

systemctl restart sshd
echo "    SSH hardened (root login disabled, password auth disabled)"

# ---------------------------------------------------------------------------
# 4. Timezone
# ---------------------------------------------------------------------------

echo "==> Setting timezone to UTC..."
timedatectl set-timezone UTC

# ---------------------------------------------------------------------------
# 5. Install apt packages
# ---------------------------------------------------------------------------

echo "==> Installing apt packages..."
apt-get install -y \
  curl wget jq htop tmux git unzip tree \
  ufw fail2ban \
  unattended-upgrades apt-listchanges \
  nginx \
  pipx \
  python3-yaml \
  openjdk-21-jdk-headless

# Ensure pipx path is available for root (certbot will be installed here)
pipx ensurepath
export PATH="/root/.local/bin:$PATH"

# ---------------------------------------------------------------------------
# 6. Install Docker (from Docker's official repo)
# ---------------------------------------------------------------------------

echo "==> Installing Docker..."
if ! command -v docker &>/dev/null; then
  # Add Docker GPG key
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc

  # Add Docker repo (DEB822 format for Trixie)
  cat > /etc/apt/sources.list.d/docker.sources <<DOCKEREOF
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: trixie
Components: stable
Architectures: $ARCH
Signed-By: /etc/apt/keyrings/docker.asc
DOCKEREOF

  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  echo "    Docker installed"
else
  echo "    Docker already installed"
fi

usermod -aG docker danny

# ---------------------------------------------------------------------------
# 7. Install external tools
# ---------------------------------------------------------------------------

echo "==> Installing external tools..."

# --- certbot (via pipx) ---
if ! command -v certbot &>/dev/null; then
  echo "    Installing certbot via pipx..."
  pipx install certbot
  echo "    certbot installed"
else
  echo "    certbot already installed"
fi

# --- 1Password CLI ---
if ! command -v op &>/dev/null; then
  echo "    Installing 1Password CLI..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://downloads.1password.com/linux/keys/1password.asc -o /etc/apt/keyrings/1password.asc
  chmod a+r /etc/apt/keyrings/1password.asc

  cat > /etc/apt/sources.list.d/1password.sources <<OPEOF
Types: deb
URIs: https://downloads.1password.com/linux/debian/$ARCH
Suites: stable
Components: main
Signed-By: /etc/apt/keyrings/1password.asc
OPEOF

  apt-get update
  apt-get install -y 1password-cli
  echo "    1Password CLI installed"
else
  echo "    1Password CLI already installed"
fi

# --- GitHub CLI ---
if ! command -v gh &>/dev/null; then
  echo "    Installing GitHub CLI..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /etc/apt/keyrings/github-cli.gpg
  chmod a+r /etc/apt/keyrings/github-cli.gpg

  cat > /etc/apt/sources.list.d/github-cli.sources <<'GHEOF'
Types: deb
URIs: https://cli.github.com/packages
Suites: stable
Components: main
Signed-By: /etc/apt/keyrings/github-cli.gpg
GHEOF

  apt-get update
  apt-get install -y gh
  echo "    GitHub CLI installed"
else
  echo "    GitHub CLI already installed"
fi

# --- Bun (as danny) ---
if [[ ! -f /home/danny/.bun/bin/bun ]]; then
  echo "    Installing Bun..."
  sudo -iu danny bash -c 'curl -fsSL https://bun.sh/install | bash'
  echo "    Bun installed"
else
  echo "    Bun already installed"
fi

# --- uv (as danny) ---
if [[ ! -f /home/danny/.local/bin/uv ]]; then
  echo "    Installing uv..."
  sudo -iu danny bash -c 'curl -LsSf https://astral.sh/uv/install.sh | sh'
  echo "    uv installed"
else
  echo "    uv already installed"
fi

# --- Claude Code (as danny) ---
if ! sudo -iu danny bash -c 'command -v claude' &>/dev/null; then
  echo "    Installing Claude Code..."
  sudo -iu danny bash -c 'curl -fsSL https://claude.ai/install.sh | bash'
  echo "    Claude Code installed"
else
  echo "    Claude Code already installed"
fi

# ---------------------------------------------------------------------------
# 8. Configure UFW
# ---------------------------------------------------------------------------

echo "==> Configuring UFW..."
ufw allow 22/tcp    # SSH
ufw allow 53        # DNS (acme-dns for ACME challenges)
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 25565/tcp # Minecraft
ufw allow 24454/udp # Simple Voice Chat
ufw --force enable
echo "    UFW configured and enabled"

# ---------------------------------------------------------------------------
# 9. Configure fail2ban
# ---------------------------------------------------------------------------

echo "==> Configuring fail2ban..."
if [[ ! -f /etc/fail2ban/jail.local ]]; then
  cat > /etc/fail2ban/jail.local <<'F2BEOF'
[sshd]
enabled = true
F2BEOF
  echo "    fail2ban SSH jail configured"
fi

systemctl enable fail2ban
systemctl restart fail2ban

# ---------------------------------------------------------------------------
# 10. Configure unattended-upgrades
# ---------------------------------------------------------------------------

echo "==> Configuring unattended-upgrades..."
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'UUEOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
UUEOF

systemctl enable unattended-upgrades
systemctl restart unattended-upgrades
echo "    Unattended-upgrades configured"

# ---------------------------------------------------------------------------
# 11. Configure Nginx for mc-infra
# ---------------------------------------------------------------------------

echo "==> Configuring Nginx..."
NGINX_CONF="/etc/nginx/nginx.conf"
MC_INCLUDE="include /opt/minecraft/nginx/conf.d/*.conf;"
if ! grep -q "/opt/minecraft/nginx" "$NGINX_CONF"; then
  # Add our include line after the existing conf.d include
  sed -i "/include \/etc\/nginx\/conf.d\/\*.conf;/a\\        $MC_INCLUDE" "$NGINX_CONF"
  echo "    Added mc-infra include to nginx.conf"
else
  echo "    mc-infra include already in nginx.conf"
fi

# ---------------------------------------------------------------------------
# 12. Install certbot hook for acme-dns
# ---------------------------------------------------------------------------

echo "==> Installing certbot acme-dns hook..."
HOOK_SCRIPT="/etc/letsencrypt/acme-dns-auth.py"
if [[ ! -f "$HOOK_SCRIPT" ]]; then
  mkdir -p /etc/letsencrypt
  curl -fsSL -o "$HOOK_SCRIPT" \
    https://raw.githubusercontent.com/joohoi/acme-dns-certbot-joohoi/master/acme-dns-auth.py
  # Fix shebang for Debian (no 'python' binary, only 'python3')
  sed -i '1s|#!/usr/bin/env python$|#!/usr/bin/env python3|' "$HOOK_SCRIPT"
  # Point at local acme-dns instance
  sed -i 's|ACMEDNS_URL = "https://auth.acme-dns.io"|ACMEDNS_URL = "http://127.0.0.1:8053"|' "$HOOK_SCRIPT"
  chmod 0700 "$HOOK_SCRIPT"
  echo "    Installed acme-dns-auth.py"
else
  echo "    acme-dns-auth.py already installed"
fi

# Nginx reload hook for cert renewals
RENEWAL_HOOK="/etc/letsencrypt/renewal-hooks/post/reload-nginx.sh"
if [[ ! -f "$RENEWAL_HOOK" ]]; then
  mkdir -p /etc/letsencrypt/renewal-hooks/post
  cat > "$RENEWAL_HOOK" <<'HOOKEOF'
#!/bin/bash
systemctl reload nginx
HOOKEOF
  chmod +x "$RENEWAL_HOOK"
  echo "    Installed Nginx renewal hook"
else
  echo "    Nginx renewal hook already installed"
fi

# ---------------------------------------------------------------------------
# 13. Configure bash environment
# ---------------------------------------------------------------------------

echo "==> Configuring bash environment for danny..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/configure-bash.sh" danny

# ---------------------------------------------------------------------------
# 14. Summary
# ---------------------------------------------------------------------------

echo ""
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo ""
echo "Installed:"
echo "  - Docker:          $(docker --version 2>/dev/null || echo 'check manually')"
echo "  - Docker Compose:  $(docker compose version 2>/dev/null || echo 'check manually')"
echo "  - Nginx:           $(nginx -v 2>&1 || echo 'check manually')"
echo "  - Java:            $(java --version 2>&1 | head -1 || echo 'check manually')"
echo "  - 1Password CLI:   $(op --version 2>/dev/null || echo 'check manually')"
echo "  - GitHub CLI:      $(gh --version 2>/dev/null | head -1 || echo 'check manually')"
echo "  - certbot:         $(certbot --version 2>/dev/null || echo 'check manually')"
echo ""
echo "User-level tools (installed for danny):"
echo "  - Bun:             $(sudo -iu danny bash -c 'bun --version' 2>/dev/null || echo 'check manually')"
echo "  - uv:              $(sudo -iu danny bash -c 'uv --version' 2>/dev/null || echo 'check manually')"
echo "  - Claude Code:     $(sudo -iu danny bash -c 'claude --version' 2>/dev/null || echo 'check manually')"
echo ""
echo "Security:"
echo "  - SSH:             root login disabled, password auth disabled"
echo "  - UFW:             $(ufw status | head -1)"
echo "  - fail2ban:        $(systemctl is-active fail2ban 2>/dev/null)"
echo "  - Unattended upgrades: $(systemctl is-active unattended-upgrades 2>/dev/null)"
echo ""
echo "Configuration:"
echo "  - Timezone:        $(timedatectl show -p Timezone --value)"
echo "  - Nginx:           mc-infra include added"
echo "  - Certbot:         acme-dns hook + nginx renewal hook installed"
echo "  - Bash:            colored prompt, git branch, Ghostty TERM support"
echo ""
echo "⚠  NEXT STEPS:"
echo "  1. TEST SSH as danny before closing this root session:"
echo "     ssh danny@$(hostname -I | awk '{print $1}')"
echo "  2. Set up 1Password service account token"
echo "  3. Transfer Claude Code auth.json:"
echo "     scp ~/.config/claude-code/auth.json danny@<ip>:~/.config/claude-code/"
echo "  4. If VPS IP changed, update DNS A records in DNSimple:"
echo "     mc.danny.is, *.mc.danny.is, acme.mc.danny.is → $(hostname -I | awk '{print $1}')"
echo "  5. Start the stack (as danny):"
echo "     cd /opt/minecraft && op run --env-file=.env.tpl -- docker compose up -d"
echo "  6. Set up SSL certificate (as danny):"
echo "     sudo /opt/minecraft/setup-ssl.sh"
echo ""

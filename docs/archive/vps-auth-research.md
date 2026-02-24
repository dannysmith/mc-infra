# Authenticating CLI Tools on a Remote VPS (Headless Linux)

Research compiled 2026-02-22.

---

## 1. Claude Code on a Headless Remote VPS

### The Problem

Claude Code's OAuth flow requires a browser redirect back to the machine running the CLI. On a headless VPS (no browser), this breaks. If you have a Max plan (not API billing), there is **no first-class device-code flow yet** -- [an open feature request (issue #22992)](https://github.com/anthropics/claude-code/issues/22992) asks for RFC 8628 device-code auth (like `gh auth login` or `az login --use-device-code`), but it remains unimplemented as of February 2026.

### Your Options

#### Option A: Transfer `auth.json` from Local Machine (Use Max Plan Remotely)

This is the most practical way to use your Max subscription on a remote server.

1. On your **local machine** (with a browser), run:
   ```bash
   claude /login
   ```
2. This creates `~/.config/claude-code/auth.json`
3. Transfer it to your VPS:
   ```bash
   # Create target directory
   ssh user@your-vps "mkdir -p ~/.config/claude-code"

   # Securely copy the credential file
   scp ~/.config/claude-code/auth.json user@your-vps:~/.config/claude-code/auth.json

   # Lock down permissions on the remote
   ssh user@your-vps "chmod 600 ~/.config/claude-code/auth.json"
   ```

**Security considerations:**
- The `auth.json` contains a bearer token -- treat it like a password.
- If the VPS is compromised, immediately revoke the token at [claude.ai/settings/account](https://claude.ai/settings/account) under "Active Connections."
- The token is not believed to be machine-bound (no IP pinning), so it works across machines.
- Set restrictive file permissions (`chmod 600`).

**Downsides:**
- Token may expire/need re-auth periodically (you will need to repeat the transfer).
- Not officially documented by Anthropic -- it is a community-discovered workaround.

#### Option B: SSH Port Forwarding (Use Max Plan Remotely)

Forward the auth callback port from the VPS to your local machine:

1. Connect with port forwarding:
   ```bash
   ssh -L 8080:localhost:8080 user@your-vps
   ```
2. On the remote session, run:
   ```bash
   claude /login
   ```
3. Copy the `http://localhost:8080/...` URL and open it in your **local** browser.
4. Complete the OAuth flow; the token transmits back through the tunnel.

**Downsides:**
- May not work if `AllowTcpForwarding no` is set in the server's sshd_config.
- The exact port Claude Code uses may vary -- check the CLI output.
- Slightly fiddly but more "correct" than file transfer.

#### Option C: Use an API Key Instead (Separate Billing)

If you are willing to pay per-token on the API (separate from your Max subscription):

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

- This bypasses OAuth entirely -- no browser needed.
- **Important:** Claude Code prioritizes `ANTHROPIC_API_KEY` over subscription auth. If this env var is set, you are billed at API rates, not against your Max plan.
- Generate keys at [console.anthropic.com](https://console.anthropic.com).
- Store the key securely (see Section 3 below).

**When to choose this:** If you run Claude Code in CI/CD, automation, or heavily on the VPS and want clean separation from your personal Max usage.

### Recommendation

**For personal VPS use: Option A (auth.json transfer) or Option B (SSH tunnel).** Both let you use your Max plan remotely at no additional cost. Option A is simpler and more reliable. Re-transfer when the token expires.

If you need automation or CI/CD: Option C (API key) is the standard approach.

---

## 2. GitHub CLI (`gh`) on a Headless VPS

### The Problem

`gh auth login` defaults to a browser-based OAuth flow, which does not work on headless servers.

### Your Options

#### Option A: Personal Access Token via Environment Variable (Recommended)

This is the officially recommended approach for headless environments.

1. Create a token at [github.com/settings/tokens](https://github.com/settings/tokens):
   - **Fine-grained token** (preferred): Scope to specific repos, set expiration (90 days is reasonable), grant only needed permissions.
   - **Classic token** (if fine-grained causes issues): Minimum scopes: `repo`, `read:org`, `gist`.

2. On your VPS, set the environment variable:
   ```bash
   export GH_TOKEN="ghp_xxxxxxxxxxxx"
   ```

3. Verify:
   ```bash
   gh auth status
   ```

**Why `GH_TOKEN` over `--with-token`:**
- Fine-grained PATs can behave inconsistently with `gh auth login --with-token`.
- `GH_TOKEN` is the [officially recommended method](https://cli.github.com/manual/gh_auth_login) for headless use.
- It works without storing anything in `gh`'s credential store.

#### Option B: Device Code Flow

`gh` does support device code auth, which works on headless servers:

```bash
gh auth login --web
```

This prints a code and URL. You open the URL on any device, enter the code, and authorize. This works well but requires manual interaction each time the token expires.

#### Option C: SSH Key Authentication

If you primarily `git clone`/`push`/`pull` rather than use `gh` API features:

```bash
gh auth login --hostname github.com --git-protocol ssh
```

Or just configure git to use SSH directly with a deploy key. This does not help with `gh pr`, `gh issue`, etc. -- those still need a token.

### Secure Storage of the PAT

Do **not** put the token in your `.bashrc` or `.zshrc` (those are often world-readable and end up in shell history). Instead:

```bash
# Create a dedicated secrets file
touch ~/.secrets/github
chmod 600 ~/.secrets/github
# Add: export GH_TOKEN="ghp_xxxxxxxxxxxx"

# Source it in your shell profile
echo 'source ~/.secrets/github' >> ~/.bashrc
```

Or use one of the secrets management approaches from Section 3.

### Recommendation

**Use a fine-grained PAT stored in `GH_TOKEN`.** Set it to expire in 90 days, scope it to only the repos you need, and store it in a file with `chmod 600` permissions. Rotate it before expiry.

---

## 3. General Secrets Management on a Personal VPS

For a single-user personal VPS, you want something that is practical without being enterprise-overkill. Here is a tiered approach from simplest to most robust.

### Tier 1: Encrypted `.env` Files with Restrictive Permissions (Minimum Viable)

The simplest approach that is still responsible:

```bash
# Create a secrets directory
mkdir -p ~/.secrets
chmod 700 ~/.secrets

# Store secrets in individual files
echo 'export ANTHROPIC_API_KEY="sk-ant-..."' > ~/.secrets/anthropic
echo 'export GH_TOKEN="ghp_..."' > ~/.secrets/github
chmod 600 ~/.secrets/*

# Source what you need in .bashrc
source ~/.secrets/github
source ~/.secrets/anthropic
```

**Hardening:**
- Ensure your VPS user account has a strong password and SSH key-only login.
- Disable password auth in sshd_config (`PasswordAuthentication no`).
- The secrets are protected by Unix file permissions -- only your user can read them.
- Back up the secrets directory encrypted (e.g., `gpg -c` or in your password manager).

**Risks:**
- Anyone with root or your user account has full access.
- Secrets are plaintext on disk (encrypted only if the VPS uses full-disk encryption).
- Environment variables can leak via `/proc/<pid>/environ`, debug endpoints, or crash dumps.

**Verdict:** Acceptable for a single-user VPS where you trust the hosting provider and keep the server patched. This is what most individual developers actually do.

### Tier 2: 1Password CLI (`op`) / Bitwarden CLI (`bw`)

If you already use a password manager, this is the sweet spot for personal use.

**1Password CLI approach:**

```bash
# Install op CLI on VPS
# Create a service account (scoped to a specific vault)
# Set the service account token
export OP_SERVICE_ACCOUNT_TOKEN="..."

# Inject secrets at runtime (never written to disk)
op run --env-file=.env.tpl -- claude -p "do something"
```

Where `.env.tpl` contains references like:
```
ANTHROPIC_API_KEY=op://DevVault/anthropic/api-key
GH_TOKEN=op://DevVault/github/pat
```

**Key benefits:**
- Secrets are **never stored on the VPS disk** -- they are fetched at runtime from 1Password's servers.
- `op run` automatically masks secrets in stdout.
- Centralized rotation: update the secret in 1Password, all machines pick it up.
- Service accounts can be scoped to specific vaults.

**Bitwarden CLI** offers similar functionality with `bw get password` but is slightly less ergonomic for env-var injection.

**Verdict:** Best balance of security and usability for a personal setup. Strongly recommended if you already pay for 1Password/Bitwarden.

### Tier 3: systemd Credentials (`systemd-creds`)

If your secrets are used by systemd services (not interactive shell sessions):

```bash
# Encrypt a secret (uses TPM2 if available, otherwise host key)
echo -n "sk-ant-..." | sudo systemd-creds encrypt - /etc/credstore.encrypted/anthropic-key

# Reference in a service unit
[Service]
SetCredentialEncrypted=anthropic-key:/etc/credstore.encrypted/anthropic-key
```

The secret is decrypted only when the service starts and is available at `$CREDENTIALS_DIRECTORY/anthropic-key`.

**Benefits:**
- Secrets encrypted at rest with AES256-GCM.
- If TPM2 is available, secrets are bound to the physical hardware.
- No external dependencies.
- Built into modern Linux (systemd 250+).

**Limitations:**
- Only useful for systemd-managed services, not interactive shell sessions.
- Most VPS providers do not offer TPM2 (you get host-key encryption only).

**Verdict:** Great for daemon-style services. Not useful for interactive CLI tool auth.

### Tier 4: HashiCorp Vault / SOPS / age

**Overkill for single-user**, but mentioned for completeness:

- **HashiCorp Vault**: Full-featured secrets engine. Requires running a server. Absolutely overkill for personal use.
- **SOPS + age**: Encrypt files with `age` keys, decrypt at deploy time. Good for infrastructure-as-code, less useful for interactive CLI auth.
- **`age`/`gpg` encrypted files**: Manually decrypt secrets when you need them. Annoying but secure.

### What About SSH Agent Forwarding?

SSH agent forwarding lets you use your local SSH keys on the remote server without copying them. However:

- **Security risk**: Anyone with root on the VPS can use your forwarded agent to authenticate as you to other servers.
- **Mitigations**: Use `ssh-add -x` to lock the agent with a password; use dedicated keys per security domain; prefer `ProxyJump` (`-J`) over agent forwarding when possible.
- **Use case**: Fine for jumping through bastion hosts. Not a general secrets management solution.

**Verdict:** Use it selectively (e.g., to `git push` to GitHub without storing keys on the VPS), but do not rely on it as your primary secrets strategy.

---

## Practical Recommendation Summary

For a **single-user personal VPS** where security matters but enterprise tooling is overkill:

| Tool | Auth Method | Storage |
|------|-------------|---------|
| **Claude Code** | Transfer `auth.json` from local machine (keeps Max plan billing) | `~/.config/claude-code/auth.json` with `chmod 600` |
| **GitHub CLI** | Fine-grained PAT in `GH_TOKEN` env var | `~/.secrets/github` with `chmod 600` |
| **Other API keys** | Env vars sourced from protected files | `~/.secrets/` directory with `chmod 700` |

**Level up with 1Password CLI** if you already use 1Password:
- Store all secrets in a dedicated vault.
- Use `op run` to inject them at runtime.
- Never store secrets on the VPS disk at all.

**General hardening:**
- SSH key-only auth (disable password login).
- Keep the server updated (`unattended-upgrades`).
- Use `fail2ban` or similar.
- Do not run services as root.
- Consider full-disk encryption if your VPS provider supports it.
- Rotate tokens regularly (set calendar reminders for PAT expiry).

---

## Sources

- [Claude Code Issue #22992 - Device-code auth flow request](https://github.com/anthropics/claude-code/issues/22992)
- [Claude Code Issue #7100 - Headless/remote authentication documentation](https://github.com/anthropics/claude-code/issues/7100)
- [Claude Code Official Docs - Run Claude Code programmatically](https://code.claude.com/docs/en/headless)
- [Using Claude Code with your Pro or Max plan](https://support.claude.com/en/articles/11145838-using-claude-code-with-your-pro-or-max-plan)
- [Managing API key environment variables in Claude Code](https://support.claude.com/en/articles/12304248-managing-api-key-environment-variables-in-claude-code)
- [gh auth login - Official docs](https://cli.github.com/manual/gh_auth_login)
- [GitHub CLI Issue #12592 - Headless server auth](https://github.com/cli/cli/issues/12592)
- [GitHub - Managing personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [1Password CLI - Load secrets into environment](https://developer.1password.com/docs/cli/secrets-environment-variables/)
- [1Password CLI - op run reference](https://developer.1password.com/docs/cli/reference/commands/run/)
- [systemd Credentials documentation](https://systemd.io/CREDENTIALS/)
- [systemd-creds - ArchWiki](https://wiki.archlinux.org/title/Systemd-creds)
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [SSH Agent Best Practices - Teleport](https://goteleport.com/blog/how-to-use-ssh-agent-safely/)
- [Safer SSH Agent Forwarding](https://vincent.bernat.ch/en/blog/2020-safer-ssh-agent-forwarding)

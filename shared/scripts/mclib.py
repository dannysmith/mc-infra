#!/usr/bin/env python3
"""Shared library for mc-infra management scripts.

All core logic for manifest parsing, compose generation, and nginx generation
lives here. CLI scripts (mc-generate, mc-create, mc-destroy) are thin wrappers.
"""

import copy
import os
import re

import yaml


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULTS = {
    'type': 'FABRIC',
    'version': 'LATEST',
    'mode': 'creative',
    'tier': 'ephemeral',
    'mod_groups': [],
    'modrinth_mods': [],
    'jar_mods': [],
    'modrinth_version_type': 'release',
    'svc': False,
    'seed': None,
    'motd': None,
}

MEMORY_BY_TIER = {
    'ephemeral': '2G',
    'semi-permanent': '3G',
    'permanent': '4G',
}

CPU_BY_TIER = {
    'ephemeral': '1.0',
    'semi-permanent': '1.5',
    'permanent': '2.0',
}

MEMORY_OVERHEAD_MB = 1024

BLUEMAP_PORT_BASE = 8100

SERVER_NAME_RE = re.compile(r'^[a-z][a-z0-9-]*[a-z0-9]$|^[a-z]$')


# ---------------------------------------------------------------------------
# YAML helpers — custom representers for compose output
# ---------------------------------------------------------------------------

class LiteralStr(str):
    """String dumped as a YAML literal block scalar (|)."""


class QuotedStr(str):
    """String dumped with double quotes."""


def _literal_representer(dumper, data):
    return dumper.represent_scalar('tag:yaml.org,2002:str', data, style='|')


def _quoted_representer(dumper, data):
    return dumper.represent_scalar('tag:yaml.org,2002:str', data, style='"')


yaml.add_representer(LiteralStr, _literal_representer)
yaml.add_representer(QuotedStr, _quoted_representer)


# ---------------------------------------------------------------------------
# Manifest I/O
# ---------------------------------------------------------------------------

def load_manifest(path):
    """Load manifest.yml from disk."""
    with open(path) as f:
        return yaml.safe_load(f)


def save_manifest(manifest, path):
    """Write manifest to disk."""
    with open(path, 'w') as f:
        yaml.dump(manifest, f, default_flow_style=False, sort_keys=False,
                  allow_unicode=True)


# ---------------------------------------------------------------------------
# Mod resolution
# ---------------------------------------------------------------------------

def resolve_mods(server, mod_groups):
    """Expand mod_groups + modrinth_mods into a flat list of Modrinth slugs."""
    mods = []
    for group_name in server.get('mod_groups', []):
        mods.extend(mod_groups[group_name])
    mods.extend(server.get('modrinth_mods', []))
    return mods


# ---------------------------------------------------------------------------
# Defaults and validation
# ---------------------------------------------------------------------------

def apply_defaults(name, config):
    """Apply default values to a server config, returning a new dict."""
    result = {}
    for key, default in DEFAULTS.items():
        result[key] = config.get(key, copy.deepcopy(default))

    # Memory defaults to tier-based value
    if 'memory' not in config:
        result['memory'] = MEMORY_BY_TIER[result['tier']]
    else:
        result['memory'] = config['memory']

    # MOTD defaults to titlecased name
    if result['motd'] is None:
        result['motd'] = f"{name.replace('-', ' ').title()} Server"

    # Carry through any extra fields not in DEFAULTS
    for key in config:
        if key not in result:
            result[key] = config[key]

    return result


def validate_server_name(name):
    """Check if a server name is valid (lowercase alphanumeric + hyphens)."""
    if not name:
        return False
    return bool(SERVER_NAME_RE.match(name))


# ---------------------------------------------------------------------------
# Memory calculations
# ---------------------------------------------------------------------------

def parse_memory(mem_str):
    """Parse memory string (e.g. '4G', '512M') to megabytes."""
    mem_str = mem_str.strip().upper()
    if mem_str.endswith('G'):
        return int(float(mem_str[:-1]) * 1024)
    elif mem_str.endswith('M'):
        return int(mem_str[:-1])
    else:
        raise ValueError(f"Unknown memory format: {mem_str}")


def memory_limit(mem_str):
    """Calculate container memory limit: heap + 1G overhead."""
    mb = parse_memory(mem_str) + MEMORY_OVERHEAD_MB
    if mb % 1024 == 0:
        return f"{mb // 1024}g"
    else:
        return f"{mb}m"


# ---------------------------------------------------------------------------
# BlueMap port assignment
# ---------------------------------------------------------------------------

def next_bluemap_port(servers):
    """Find the next available BlueMap port starting from 8100."""
    used = set()
    for s in servers.values():
        port = s.get('bluemap_port')
        if port is not None:
            used.add(port)
    port = BLUEMAP_PORT_BASE
    while port in used:
        port += 1
    return port


# ---------------------------------------------------------------------------
# Compose generation
# ---------------------------------------------------------------------------

def _build_acme_dns():
    """Static acme-dns service definition."""
    return {
        'build': './acme-dns',
        'container_name': 'acme-dns',
        'ports': [
            QuotedStr('53:53'),
            QuotedStr('53:53/udp'),
            QuotedStr('127.0.0.1:8053:80'),
        ],
        'volumes': [
            './acme-dns/config:/etc/acme-dns:ro',
            './acme-dns/data:/var/lib/acme-dns',
        ],
        'restart': 'unless-stopped',
    }


def _build_mc_router(servers):
    """mc-router service with MAPPING built from all servers."""
    mapping_lines = []
    for name in servers:
        mapping_lines.append(f"{name}.mc.danny.is={name}:25565")
    return {
        'image': 'itzg/mc-router',
        'container_name': 'mc-router',
        'ports': [QuotedStr('25565:25565')],
        'environment': {
            'MAPPING': LiteralStr('\n'.join(mapping_lines) + '\n'),
        },
        'networks': ['minecraft-net'],
        'restart': 'unless-stopped',
    }


def _build_mc_server(name, server, mod_groups, players):
    """Build a single MC server service definition."""
    config = apply_defaults(name, server)
    resolved_mods = resolve_mods(config, mod_groups)

    ops_str = ','.join(players.get('ops', []))
    whitelist_str = ','.join(players.get('whitelist', []))

    # Environment block
    env = {}
    env['EULA'] = QuotedStr('TRUE')
    env['TYPE'] = config['type']
    env['VERSION'] = config['version']
    env['MEMORY'] = config['memory']

    if config.get('modrinth_version_type', 'release') != 'release':
        env['MODRINTH_ALLOWED_VERSION_TYPE'] = config['modrinth_version_type']

    if resolved_mods:
        env['MODRINTH_PROJECTS'] = LiteralStr('\n'.join(resolved_mods) + '\n')

    if config.get('seed'):
        env['SEED'] = QuotedStr(str(config['seed']))

    env['WHITELIST_ENABLED'] = QuotedStr('true')
    env['ENFORCE_WHITELIST'] = QuotedStr('true')
    env['OPS'] = ops_str
    env['WHITELIST'] = whitelist_str
    env['MOTD'] = QuotedStr(config['motd'])
    env['MODE'] = config['mode']
    env['RCON_PASSWORD'] = '${RCON_PASSWORD}'

    # Ports
    ports = []
    if config.get('svc'):
        ports.append(QuotedStr('24454:24454/udp'))

    has_bluemap = config.get('bluemap')
    if has_bluemap is None:
        has_bluemap = 'bluemap' in resolved_mods
    if has_bluemap:
        bm_port = config.get('bluemap_port', BLUEMAP_PORT_BASE)
        ports.append(QuotedStr(f'127.0.0.1:{bm_port}:8100'))

    # Volumes
    volumes = [f'./servers/{name}/data:/data']
    if config.get('jar_mods'):
        volumes.append('./shared/mods:/shared-mods:ro')
        env['MODS'] = ','.join(f'/shared-mods/{jar}' for jar in config['jar_mods'])

    # Build service dict
    service = {
        'image': 'itzg/minecraft-server',
        'container_name': name,
        'env_file': [f'servers/{name}/env'],
        'environment': env,
    }
    if ports:
        service['ports'] = ports
    service['volumes'] = volumes
    service['networks'] = ['minecraft-net']
    service['deploy'] = {
        'resources': {
            'limits': {
                'memory': memory_limit(config['memory']),
                'cpus': QuotedStr(CPU_BY_TIER[config['tier']]),
            }
        }
    }
    service['restart'] = 'unless-stopped'

    return service


def generate_compose(manifest):
    """Generate complete docker-compose.yml content from manifest."""
    servers = manifest['servers']
    players = manifest['players']
    mod_groups = manifest.get('mod_groups', {})

    compose = {'services': {}}

    # Static services
    compose['services']['acme-dns'] = _build_acme_dns()
    compose['services']['mc-router'] = _build_mc_router(servers)

    # MC servers
    for name, server in servers.items():
        compose['services'][name] = _build_mc_server(
            name, server, mod_groups, players
        )

    # Networks
    compose['networks'] = {
        'minecraft-net': {'driver': 'bridge'},
    }

    header = '# Generated by mc-generate — edit manifest.yml instead\n\n'
    body = yaml.dump(compose, default_flow_style=False, sort_keys=False,
                     allow_unicode=True)
    return header + body


# ---------------------------------------------------------------------------
# Nginx generation
# ---------------------------------------------------------------------------

_NGINX_HTTP_REDIRECT = """\
server {
    listen 80;
    server_name mc.danny.is *.mc.danny.is;
    return 301 https://$host$request_uri;
}
"""

_NGINX_BLUEMAP_BLOCK = """\
server {{
    listen 443 ssl;
    server_name map-{name}.mc.danny.is;

    include /opt/minecraft/nginx/conf.d/ssl.conf;

    location / {{
        proxy_pass http://127.0.0.1:{port};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # BlueMap uses WebSockets for live updates
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }}
}}
"""


def generate_nginx(manifest):
    """Generate nginx/conf.d/bluemap.conf for all BlueMap-enabled servers."""
    servers = manifest['servers']
    mod_groups = manifest.get('mod_groups', {})

    header = '# Generated by mc-generate — edit manifest.yml instead\n\n'
    parts = [header, _NGINX_HTTP_REDIRECT]

    for name, server in servers.items():
        config = apply_defaults(name, server)
        resolved_mods = resolve_mods(config, mod_groups)

        has_bluemap = config.get('bluemap')
        if has_bluemap is None:
            has_bluemap = 'bluemap' in resolved_mods

        if has_bluemap:
            port = config.get('bluemap_port', BLUEMAP_PORT_BASE)
            parts.append(_NGINX_BLUEMAP_BLOCK.format(name=name, port=port))

    return '\n'.join(parts)


# ---------------------------------------------------------------------------
# Server management (mc-create / mc-destroy)
# ---------------------------------------------------------------------------

def add_server(manifest, name, config):
    """Add a new server to the manifest. Mutates manifest in-place."""
    if not validate_server_name(name):
        raise ValueError(f"Invalid server name: {name}")
    if name in manifest['servers']:
        raise ValueError(f"Server '{name}' already exists")

    # SVC conflict check
    if config.get('svc'):
        for existing_name, existing in manifest['servers'].items():
            if existing.get('svc'):
                raise ValueError(
                    f"SVC port already mapped to '{existing_name}'"
                )

    # Apply defaults
    full = apply_defaults(name, config)

    # Auto-assign bluemap port if needed
    mod_groups = manifest.get('mod_groups', {})
    resolved_mods = resolve_mods(full, mod_groups)
    has_bluemap = full.get('bluemap')
    if has_bluemap is None:
        has_bluemap = 'bluemap' in resolved_mods
    if has_bluemap and full.get('bluemap') is not False:
        if 'bluemap_port' not in config:
            full['bluemap_port'] = next_bluemap_port(manifest['servers'])
    elif full.get('bluemap') is False:
        full.pop('bluemap_port', None)

    # Set creation date
    if 'created' not in full:
        from datetime import date
        full['created'] = str(date.today())

    manifest['servers'][name] = full


def remove_server(manifest, name, confirm=False, force=False):
    """Remove a server from the manifest. Mutates manifest in-place."""
    if name not in manifest['servers']:
        raise ValueError(f"Server '{name}' not found")

    server = manifest['servers'][name]
    tier = server.get('tier', 'ephemeral')

    if tier == 'permanent' and not force:
        raise ValueError(
            f"Server '{name}' is permanent — change tier in manifest first, "
            "or use --force"
        )
    if tier == 'semi-permanent' and not confirm and not force:
        raise ValueError(
            f"Server '{name}' is semi-permanent — use --confirm to proceed"
        )

    del manifest['servers'][name]


def setup_server_dir(project_root, name, template_path):
    """Create servers/<name>/ directory and env file from template.

    Will NOT overwrite an existing env file.
    """
    server_dir = os.path.join(project_root, 'servers', name)
    os.makedirs(server_dir, exist_ok=True)

    env_path = os.path.join(server_dir, 'env')
    if not os.path.exists(env_path):
        with open(template_path) as f:
            template = f.read()
        content = template.replace('{name}', name)
        with open(env_path, 'w') as f:
            f.write(content)


def setup_bluemap_eula(project_root, name):
    """Pre-create BlueMap config dir with accept-download: true.

    BlueMap generates config/bluemap/core.conf on first start with
    accept-download: false. Pre-creating it avoids the manual step.
    If BlueMap overwrites it, the polling fallback in mc-create handles it.
    """
    bluemap_dir = os.path.join(
        project_root, 'servers', name, 'data', 'config', 'bluemap'
    )
    os.makedirs(bluemap_dir, exist_ok=True)
    core_conf = os.path.join(bluemap_dir, 'core.conf')
    if not os.path.exists(core_conf):
        with open(core_conf, 'w') as f:
            f.write('accept-download: true\n')


BLUEMAP_EULA_POLL_SCRIPT = '''\
#!/usr/bin/env bash
# Background poller: wait for BlueMap to write core.conf, then fix it.
CONF="servers/{name}/data/config/bluemap/core.conf"
for i in $(seq 1 60); do
  sleep 5
  if [ -f "$CONF" ] && grep -q "accept-download: false" "$CONF" 2>/dev/null; then
    sed -i 's/accept-download: false/accept-download: true/' "$CONF"
    # Try RCON reload, fall back to container restart
    docker exec {name} rcon-cli bluemap reload 2>/dev/null || \
      docker compose restart {name} 2>/dev/null
    exit 0
  fi
done
'''

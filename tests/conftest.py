import sys
import os

# Add shared/scripts to path so tests can import mclib
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'shared', 'scripts'))

import pytest


@pytest.fixture
def sample_manifest():
    """Manifest matching the task-3 doc example (current creative + test servers)."""
    return {
        'players': {
            'ops': ['d2683803'],
            'whitelist': ['d2683803', 'Kam93'],
        },
        'mod_groups': {
            'fabric-base': [
                'fabric-api',
                'lithium',
                'ferrite-core',
                'c2me-fabric',
                'scalablelux',
                'noisiumforked',
            ],
        },
        'servers': {
            'creative': {
                'type': 'FABRIC',
                'version': 'LATEST',
                'mode': 'creative',
                'memory': '4G',
                'tier': 'permanent',
                'mod_groups': ['fabric-base'],
                'modrinth_mods': ['distanthorizons', 'bluemap', 'simple-voice-chat'],
                'jar_mods': [],
                'modrinth_version_type': 'beta',
                'bluemap': True,
                'bluemap_port': 8100,
                'svc': True,
                'seed': None,
                'motd': 'Creative Server',
                'backup': {'interval': '24h', 'keep': 3},
                'created': '2026-02-22',
            },
            'test': {
                'type': 'FABRIC',
                'version': 'LATEST',
                'mode': 'creative',
                'memory': '2G',
                'tier': 'ephemeral',
                'mod_groups': ['fabric-base'],
                'modrinth_mods': ['bluemap'],
                'jar_mods': [],
                'bluemap': True,
                'bluemap_port': 8101,
                'svc': False,
                'seed': '-4172144997902289642',
                'motd': 'Test Server',
                'created': '2026-02-22',
            },
        },
    }


@pytest.fixture
def tmp_project(tmp_path):
    """Temporary project directory with the expected structure."""
    (tmp_path / 'servers').mkdir()
    (tmp_path / 'nginx' / 'conf.d').mkdir(parents=True)
    (tmp_path / 'shared' / 'mods').mkdir(parents=True)
    (tmp_path / 'shared' / 'templates').mkdir(parents=True)
    return tmp_path

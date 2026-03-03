"""Tests for mc-create and mc-destroy logic."""

import os
import yaml
import pytest
import mclib


# ---------------------------------------------------------------------------
# mc-create: add_server
# ---------------------------------------------------------------------------

class TestAddServer:
    def test_adds_to_manifest(self, sample_manifest):
        mclib.add_server(sample_manifest, 'survival', {
            'mode': 'survival',
            'tier': 'semi-permanent',
        })
        assert 'survival' in sample_manifest['servers']

    def test_applies_defaults(self, sample_manifest):
        mclib.add_server(sample_manifest, 'survival', {
            'mode': 'survival',
        })
        server = sample_manifest['servers']['survival']
        assert server['type'] == 'FABRIC'
        assert server['version'] == 'LATEST'
        assert server['tier'] == 'ephemeral'

    def test_rejects_duplicate_name(self, sample_manifest):
        with pytest.raises(ValueError, match='already exists'):
            mclib.add_server(sample_manifest, 'creative', {})

    def test_rejects_invalid_name(self, sample_manifest):
        with pytest.raises(ValueError, match='Invalid'):
            mclib.add_server(sample_manifest, 'My Server', {})

    def test_assigns_bluemap_port(self, sample_manifest):
        mclib.add_server(sample_manifest, 'survival', {
            'modrinth_mods': ['bluemap'],
        })
        server = sample_manifest['servers']['survival']
        # 8100 and 8101 taken by creative and test
        assert server['bluemap_port'] == 8102

    def test_svc_conflict(self, sample_manifest):
        # creative already has svc: true
        with pytest.raises(ValueError, match='already mapped'):
            mclib.add_server(sample_manifest, 'survival', {'svc': True})

    def test_svc_allowed_when_no_conflict(self, sample_manifest):
        # Remove svc from creative first
        sample_manifest['servers']['creative']['svc'] = False
        mclib.add_server(sample_manifest, 'survival', {'svc': True})
        assert sample_manifest['servers']['survival']['svc'] is True

    def test_sets_created_date(self, sample_manifest):
        mclib.add_server(sample_manifest, 'survival', {})
        server = sample_manifest['servers']['survival']
        assert 'created' in server
        # Should be an ISO date string
        assert len(server['created']) == 10

    def test_no_bluemap_flag(self, sample_manifest):
        mclib.add_server(sample_manifest, 'survival', {
            'modrinth_mods': ['bluemap'],
            'bluemap': False,
        })
        server = sample_manifest['servers']['survival']
        assert server['bluemap'] is False
        assert 'bluemap_port' not in server

    def test_backup_config_preserved(self, sample_manifest):
        """Backup config passed via mc-create is preserved in manifest."""
        mclib.add_server(sample_manifest, 'survival', {
            'tier': 'permanent',
            'backup': {'interval': '24h', 'keep': 3},
        })
        server = sample_manifest['servers']['survival']
        assert server['backup'] == {'interval': '24h', 'keep': 3}

    def test_ephemeral_no_backup(self, sample_manifest):
        """Ephemeral servers don't get backup config by default."""
        mclib.add_server(sample_manifest, 'survival', {
            'tier': 'ephemeral',
        })
        server = sample_manifest['servers']['survival']
        assert 'backup' not in server


# ---------------------------------------------------------------------------
# mc-destroy: remove_server
# ---------------------------------------------------------------------------

class TestRemoveServer:
    def test_removes_from_manifest(self, sample_manifest):
        mclib.remove_server(sample_manifest, 'test')
        assert 'test' not in sample_manifest['servers']

    def test_nonexistent_raises(self, sample_manifest):
        with pytest.raises(ValueError, match='not found'):
            mclib.remove_server(sample_manifest, 'nonexistent')

    def test_permanent_refuses(self, sample_manifest):
        with pytest.raises(ValueError, match='permanent'):
            mclib.remove_server(sample_manifest, 'creative')

    def test_permanent_with_force(self, sample_manifest):
        mclib.remove_server(sample_manifest, 'creative', force=True)
        assert 'creative' not in sample_manifest['servers']

    def test_semi_permanent_needs_confirm(self, sample_manifest):
        sample_manifest['servers']['test']['tier'] = 'semi-permanent'
        with pytest.raises(ValueError, match='confirm'):
            mclib.remove_server(sample_manifest, 'test')

    def test_semi_permanent_with_confirm(self, sample_manifest):
        sample_manifest['servers']['test']['tier'] = 'semi-permanent'
        mclib.remove_server(sample_manifest, 'test', confirm=True)
        assert 'test' not in sample_manifest['servers']

    def test_ephemeral_no_confirm_needed(self, sample_manifest):
        mclib.remove_server(sample_manifest, 'test')
        assert 'test' not in sample_manifest['servers']


# ---------------------------------------------------------------------------
# Integration: create server directory + env file
# ---------------------------------------------------------------------------

class TestSetupServerDir:
    def test_creates_dir_and_env(self, tmp_project):
        template = tmp_project / 'shared' / 'templates' / 'server-env.template'
        template.write_text(
            '# Minecraft settings for {name}\nDIFFICULTY=normal\n'
        )
        mclib.setup_server_dir(str(tmp_project), 'survival', str(template))
        env_path = tmp_project / 'servers' / 'survival' / 'env'
        assert env_path.exists()
        content = env_path.read_text()
        assert 'survival' in content
        assert 'DIFFICULTY=normal' in content

    def test_idempotent(self, tmp_project):
        template = tmp_project / 'shared' / 'templates' / 'server-env.template'
        template.write_text('# {name}\n')
        mclib.setup_server_dir(str(tmp_project), 'test', str(template))
        # Write custom content to env
        env_path = tmp_project / 'servers' / 'test' / 'env'
        env_path.write_text('CUSTOM=value\n')
        # Running again should NOT overwrite
        mclib.setup_server_dir(str(tmp_project), 'test', str(template))
        assert env_path.read_text() == 'CUSTOM=value\n'


# ---------------------------------------------------------------------------
# BlueMap EULA
# ---------------------------------------------------------------------------

class TestBluemapEula:
    def test_creates_core_conf(self, tmp_project):
        mclib.setup_bluemap_eula(str(tmp_project), 'creative')
        conf = tmp_project / 'servers' / 'creative' / 'data' / 'config' / 'bluemap' / 'core.conf'
        assert conf.exists()
        assert 'accept-download: true' in conf.read_text()

    def test_idempotent(self, tmp_project):
        mclib.setup_bluemap_eula(str(tmp_project), 'creative')
        conf = tmp_project / 'servers' / 'creative' / 'data' / 'config' / 'bluemap' / 'core.conf'
        conf.write_text('accept-download: true\ncustom: setting\n')
        mclib.setup_bluemap_eula(str(tmp_project), 'creative')
        assert 'custom: setting' in conf.read_text()

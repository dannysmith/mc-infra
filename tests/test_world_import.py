"""Tests for world import functionality."""

import os
import shutil
import yaml
import pytest
import mclib


# ---------------------------------------------------------------------------
# is_url helper
# ---------------------------------------------------------------------------

class TestIsUrl:
    def test_http(self):
        assert mclib.is_url('http://example.com/world.zip') is True

    def test_https(self):
        assert mclib.is_url('https://example.com/world.zip') is True

    def test_local_path(self):
        assert mclib.is_url('/tmp/world.zip') is False

    def test_relative_path(self):
        assert mclib.is_url('./world.zip') is False


# ---------------------------------------------------------------------------
# setup_world_import — copy local file to server's world-import dir
# ---------------------------------------------------------------------------

class TestSetupWorldImport:
    def test_copies_file(self, tmp_project):
        # Create a source zip
        src = tmp_project / 'my-world.zip'
        src.write_bytes(b'fake zip content')

        result = mclib.setup_world_import(str(tmp_project), 'survival', str(src))

        dest = tmp_project / 'servers' / 'survival' / 'world-import' / 'my-world.zip'
        assert dest.exists()
        assert dest.read_bytes() == b'fake zip content'
        # Returns the container-internal path
        assert result == '/world-import/my-world.zip'

    def test_creates_server_dir_if_needed(self, tmp_project):
        src = tmp_project / 'world.zip'
        src.write_bytes(b'data')

        mclib.setup_world_import(str(tmp_project), 'newserver', str(src))

        assert (tmp_project / 'servers' / 'newserver' / 'world-import' / 'world.zip').exists()

    def test_raises_for_missing_source(self, tmp_project):
        with pytest.raises(ValueError, match='not found'):
            mclib.setup_world_import(str(tmp_project), 'survival', '/nonexistent/world.zip')


# ---------------------------------------------------------------------------
# copy_world_from — copy another server's data dir
# ---------------------------------------------------------------------------

class TestCopyWorldFrom:
    def test_copies_data(self, tmp_project):
        # Set up source server with world data
        src_data = tmp_project / 'servers' / 'creative' / 'data'
        src_data.mkdir(parents=True)
        (src_data / 'level.dat').write_bytes(b'level data')
        (src_data / 'region').mkdir()
        (src_data / 'region' / 'r.0.0.mca').write_bytes(b'region data')

        mclib.copy_world_from(str(tmp_project), 'creative', 'survival')

        dest_data = tmp_project / 'servers' / 'survival' / 'data'
        assert (dest_data / 'level.dat').read_bytes() == b'level data'
        assert (dest_data / 'region' / 'r.0.0.mca').read_bytes() == b'region data'

    def test_raises_if_source_has_no_data(self, tmp_project):
        (tmp_project / 'servers' / 'empty').mkdir(parents=True)
        with pytest.raises(ValueError, match='No data directory'):
            mclib.copy_world_from(str(tmp_project), 'empty', 'new')

    def test_raises_if_dest_data_exists(self, tmp_project):
        src_data = tmp_project / 'servers' / 'creative' / 'data'
        src_data.mkdir(parents=True)
        (src_data / 'level.dat').write_bytes(b'data')

        dest_data = tmp_project / 'servers' / 'survival' / 'data'
        dest_data.mkdir(parents=True)
        (dest_data / 'level.dat').write_bytes(b'existing')

        with pytest.raises(ValueError, match='already has data'):
            mclib.copy_world_from(str(tmp_project), 'creative', 'survival')


# ---------------------------------------------------------------------------
# Compose generation — WORLD env var
# ---------------------------------------------------------------------------

class TestComposeWorldImport:
    def _manifest_with_world(self, world_value):
        return {
            'players': {'ops': ['d2683803'], 'whitelist': ['d2683803']},
            'mod_groups': {},
            'servers': {
                'imported': {
                    'type': 'FABRIC',
                    'version': 'LATEST',
                    'mode': 'survival',
                    'memory': '2G',
                    'tier': 'ephemeral',
                    'mod_groups': [],
                    'modrinth_mods': [],
                    'jar_mods': [],
                    'svc': False,
                    'seed': None,
                    'motd': 'Imported Server',
                    'world': world_value,
                },
            },
        }

    def test_url_sets_world_env(self):
        manifest = self._manifest_with_world('https://example.com/world.zip')
        compose = yaml.safe_load(mclib.generate_compose(manifest))
        env = compose['services']['imported']['environment']
        assert env['WORLD'] == 'https://example.com/world.zip'

    def test_url_no_extra_volume(self):
        manifest = self._manifest_with_world('https://example.com/world.zip')
        compose = yaml.safe_load(mclib.generate_compose(manifest))
        volumes = compose['services']['imported']['volumes']
        # Only the data volume, no world-import mount
        assert len(volumes) == 1
        assert './servers/imported/data:/data' in volumes

    def test_local_path_sets_world_env(self):
        manifest = self._manifest_with_world('/world-import/my-world.zip')
        compose = yaml.safe_load(mclib.generate_compose(manifest))
        env = compose['services']['imported']['environment']
        assert env['WORLD'] == '/world-import/my-world.zip'

    def test_local_path_adds_volume_mount(self):
        manifest = self._manifest_with_world('/world-import/my-world.zip')
        compose = yaml.safe_load(mclib.generate_compose(manifest))
        volumes = compose['services']['imported']['volumes']
        assert './servers/imported/world-import:/world-import:ro' in volumes

    def test_no_world_field_no_world_env(self, sample_manifest):
        compose = yaml.safe_load(mclib.generate_compose(sample_manifest))
        env = compose['services']['creative']['environment']
        assert 'WORLD' not in env

    def test_null_world_no_world_env(self):
        manifest = self._manifest_with_world(None)
        compose = yaml.safe_load(mclib.generate_compose(manifest))
        env = compose['services']['imported']['environment']
        assert 'WORLD' not in env

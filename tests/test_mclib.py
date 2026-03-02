"""Tests for mclib — manifest parsing, mod resolution, and config defaults."""

import mclib


# --- Mod Resolution ---

class TestResolveMods:
    def test_expands_mod_groups(self, sample_manifest):
        server = sample_manifest['servers']['creative']
        mod_groups = sample_manifest['mod_groups']
        mods = mclib.resolve_mods(server, mod_groups)
        assert mods == [
            'fabric-api', 'lithium', 'ferrite-core', 'c2me-fabric',
            'scalablelux', 'noisium',
            'distanthorizons', 'bluemap', 'simple-voice-chat',
        ]

    def test_no_groups(self):
        server = {'mod_groups': [], 'modrinth_mods': ['fabric-api', 'bluemap']}
        mods = mclib.resolve_mods(server, {})
        assert mods == ['fabric-api', 'bluemap']

    def test_empty_mods(self):
        server = {'mod_groups': [], 'modrinth_mods': []}
        assert mclib.resolve_mods(server, {}) == []

    def test_missing_group_raises(self):
        server = {'mod_groups': ['nonexistent'], 'modrinth_mods': []}
        import pytest
        with pytest.raises(KeyError):
            mclib.resolve_mods(server, {})

    def test_multiple_groups(self):
        server = {'mod_groups': ['perf', 'tools'], 'modrinth_mods': ['extra']}
        groups = {
            'perf': ['lithium', 'ferrite-core'],
            'tools': ['bluemap'],
        }
        mods = mclib.resolve_mods(server, groups)
        assert mods == ['lithium', 'ferrite-core', 'bluemap', 'extra']


# --- Memory Calculations ---

class TestMemory:
    def test_parse_memory_gigabytes(self):
        assert mclib.parse_memory('4G') == 4096

    def test_parse_memory_megabytes(self):
        assert mclib.parse_memory('512M') == 512

    def test_parse_memory_lowercase(self):
        assert mclib.parse_memory('2g') == 2048

    def test_parse_memory_invalid(self):
        import pytest
        with pytest.raises(ValueError):
            mclib.parse_memory('4T')

    def test_memory_limit_4g(self):
        # 4G heap + 1G overhead = 5G
        assert mclib.memory_limit('4G') == '5g'

    def test_memory_limit_2g(self):
        # 2G heap + 1G overhead = 3G
        assert mclib.memory_limit('2G') == '3g'

    def test_memory_limit_3g(self):
        # 3G heap + 1G overhead = 4G
        assert mclib.memory_limit('3G') == '4g'

    def test_memory_limit_non_round(self):
        # 512M + 1024M = 1536M (not a clean GB)
        assert mclib.memory_limit('512M') == '1536m'


# --- Default Application ---

class TestApplyDefaults:
    def test_minimal_config(self):
        result = mclib.apply_defaults('test', {})
        assert result['type'] == 'FABRIC'
        assert result['version'] == 'LATEST'
        assert result['mode'] == 'creative'
        assert result['tier'] == 'ephemeral'
        assert result['memory'] == '2G'  # ephemeral default
        assert result['motd'] == 'Test Server'
        assert result['svc'] is False
        assert result['seed'] is None

    def test_memory_default_by_tier(self):
        assert mclib.apply_defaults('x', {'tier': 'ephemeral'})['memory'] == '2G'
        assert mclib.apply_defaults('x', {'tier': 'semi-permanent'})['memory'] == '3G'
        assert mclib.apply_defaults('x', {'tier': 'permanent'})['memory'] == '4G'

    def test_explicit_memory_overrides_tier(self):
        result = mclib.apply_defaults('x', {'tier': 'ephemeral', 'memory': '6G'})
        assert result['memory'] == '6G'

    def test_motd_default_from_name(self):
        assert mclib.apply_defaults('creative', {})['motd'] == 'Creative Server'
        assert mclib.apply_defaults('my-world', {})['motd'] == 'My World Server'

    def test_explicit_values_preserved(self):
        result = mclib.apply_defaults('x', {
            'type': 'PAPER',
            'version': '1.21.4',
            'mode': 'survival',
        })
        assert result['type'] == 'PAPER'
        assert result['version'] == '1.21.4'
        assert result['mode'] == 'survival'

    def test_extra_fields_preserved(self):
        result = mclib.apply_defaults('x', {
            'created': '2026-03-01',
            'bluemap_port': 8100,
        })
        assert result['created'] == '2026-03-01'
        assert result['bluemap_port'] == 8100


# --- Server Name Validation ---

class TestValidateServerName:
    def test_valid_names(self):
        assert mclib.validate_server_name('creative') is True
        assert mclib.validate_server_name('test') is True
        assert mclib.validate_server_name('my-server') is True
        assert mclib.validate_server_name('server1') is True

    def test_invalid_names(self):
        assert mclib.validate_server_name('') is False
        assert mclib.validate_server_name('My Server') is False
        assert mclib.validate_server_name('server_one') is False
        assert mclib.validate_server_name('UPPER') is False
        assert mclib.validate_server_name('-leading') is False
        assert mclib.validate_server_name('trailing-') is False
        assert mclib.validate_server_name('has.dot') is False


# --- BlueMap Port Assignment ---

class TestNextBluemapPort:
    def test_first_server(self):
        assert mclib.next_bluemap_port({}) == 8100

    def test_sequential_assignment(self):
        servers = {
            'a': {'bluemap_port': 8100},
            'b': {'bluemap_port': 8101},
        }
        assert mclib.next_bluemap_port(servers) == 8102

    def test_fills_gaps(self):
        servers = {
            'a': {'bluemap_port': 8100},
            'c': {'bluemap_port': 8102},
        }
        assert mclib.next_bluemap_port(servers) == 8101

    def test_ignores_servers_without_port(self):
        servers = {
            'a': {'bluemap_port': 8100},
            'b': {},  # no bluemap
        }
        assert mclib.next_bluemap_port(servers) == 8101


# --- Manifest I/O ---

class TestManifestIO:
    def test_roundtrip(self, tmp_path, sample_manifest):
        path = tmp_path / 'manifest.yml'
        mclib.save_manifest(sample_manifest, str(path))
        loaded = mclib.load_manifest(str(path))
        assert loaded == sample_manifest

    def test_load_preserves_types(self, tmp_path, sample_manifest):
        path = tmp_path / 'manifest.yml'
        mclib.save_manifest(sample_manifest, str(path))
        loaded = mclib.load_manifest(str(path))
        assert isinstance(loaded['servers']['creative']['svc'], bool)
        assert isinstance(loaded['servers']['creative']['bluemap_port'], int)
        assert loaded['servers']['creative']['seed'] is None

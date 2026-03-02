"""Tests for mc-archive logic."""

import os
import tarfile
import pytest
import mclib


class TestArchiveServer:
    """Test the archive_server function that creates a tarball of world data."""

    def _make_server_data(self, tmp_project, name):
        """Create a fake server with world data."""
        data_dir = tmp_project / 'servers' / name / 'data'
        world_dir = data_dir / 'world'
        world_dir.mkdir(parents=True)
        (world_dir / 'level.dat').write_text('fake level data')
        (world_dir / 'region').mkdir()
        (world_dir / 'region' / 'r.0.0.mca').write_bytes(b'\x00' * 100)
        (data_dir / 'server.properties').write_text('motd=Test')
        return data_dir

    def test_creates_tarball(self, tmp_project):
        self._make_server_data(tmp_project, 'test')
        backups_dir = tmp_project / 'shared' / 'backups'
        backups_dir.mkdir(parents=True, exist_ok=True)

        path = mclib.archive_server_data(
            str(tmp_project), 'test', str(backups_dir)
        )

        assert os.path.exists(path)
        assert path.endswith('.tar.gz')
        assert 'test-' in os.path.basename(path)

    def test_tarball_contains_data(self, tmp_project):
        self._make_server_data(tmp_project, 'test')
        backups_dir = tmp_project / 'shared' / 'backups'
        backups_dir.mkdir(parents=True, exist_ok=True)

        path = mclib.archive_server_data(
            str(tmp_project), 'test', str(backups_dir)
        )

        with tarfile.open(path, 'r:gz') as tar:
            names = tar.getnames()
            # Should contain world data relative to data/
            assert any('world/level.dat' in n for n in names)
            assert any('world/region/r.0.0.mca' in n for n in names)
            assert any('server.properties' in n for n in names)

    def test_tarball_name_includes_date(self, tmp_project):
        self._make_server_data(tmp_project, 'test')
        backups_dir = tmp_project / 'shared' / 'backups'
        backups_dir.mkdir(parents=True, exist_ok=True)

        path = mclib.archive_server_data(
            str(tmp_project), 'test', str(backups_dir)
        )

        basename = os.path.basename(path)
        # Format: test-YYYY-MM-DD.tar.gz
        assert basename.startswith('test-')
        assert basename.endswith('.tar.gz')
        # Date part should be 10 chars (YYYY-MM-DD)
        date_part = basename[len('test-'):-len('.tar.gz')]
        assert len(date_part) == 10

    def test_missing_data_dir_raises(self, tmp_project):
        # Server dir exists but no data/
        (tmp_project / 'servers' / 'test').mkdir(parents=True)
        backups_dir = tmp_project / 'shared' / 'backups'
        backups_dir.mkdir(parents=True, exist_ok=True)

        with pytest.raises(ValueError, match='No data directory'):
            mclib.archive_server_data(
                str(tmp_project), 'test', str(backups_dir)
            )

    def test_creates_backups_dir(self, tmp_project):
        self._make_server_data(tmp_project, 'test')
        backups_dir = tmp_project / 'shared' / 'backups'
        # Don't create it — archive_server_data should

        path = mclib.archive_server_data(
            str(tmp_project), 'test', str(backups_dir)
        )

        assert os.path.exists(path)


class TestArchiveTierWarning:
    """Test that archive warns for permanent-tier servers."""

    def test_permanent_warns(self, sample_manifest):
        # creative is permanent
        warnings = mclib.check_archive_warnings(
            sample_manifest, 'creative'
        )
        assert any('permanent' in w.lower() for w in warnings)

    def test_ephemeral_no_warning(self, sample_manifest):
        warnings = mclib.check_archive_warnings(
            sample_manifest, 'test'
        )
        assert len(warnings) == 0

    def test_semi_permanent_no_warning(self, sample_manifest):
        sample_manifest['servers']['test']['tier'] = 'semi-permanent'
        warnings = mclib.check_archive_warnings(
            sample_manifest, 'test'
        )
        assert len(warnings) == 0

    def test_nonexistent_raises(self, sample_manifest):
        with pytest.raises(ValueError, match='not found'):
            mclib.check_archive_warnings(sample_manifest, 'nope')

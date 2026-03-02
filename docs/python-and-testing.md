# Python & Testing

How the Python code is structured and how to run tests.

## Python Setup

The management scripts (`mc-generate`, `mc-create`, `mc-destroy`, `mc-status`) are Python 3 and depend on PyYAML.

**On the VPS:** PyYAML is installed system-wide via `apt install python3-yaml` (in `setup.sh`). Scripts use `#!/usr/bin/env python3` and run against the system Python. No venv needed on the server.

**For local development:** The system Python on macOS doesn't have PyYAML, so tests run inside a venv:

```bash
python3 -m venv .venv
.venv/bin/pip install pyyaml pytest
```

The `.venv/` directory is gitignored.

## Code Structure

```
shared/scripts/
  mclib.py              # Shared library — all core logic
  mc-generate           # CLI: reads manifest, writes compose + nginx
  mc-create             # CLI: adds server to manifest, runs generate
  mc-destroy            # CLI: removes server, runs generate, cleans up
  mc-status             # CLI: shows server status table
  mc-start              # Bash wrapper
  mc-stop               # Bash wrapper
  mc-logs               # Bash wrapper
  mc-console            # Bash wrapper
```

`mclib.py` contains all the testable logic: manifest I/O, mod resolution, default application, compose generation, nginx generation, server add/remove, directory setup, and BlueMap EULA handling. The CLI scripts are thin wrappers that parse args and call into mclib.

## Running Tests

```bash
.venv/bin/pytest tests/ -v
```

Or for a quick check:

```bash
.venv/bin/pytest tests/ -q
```

## Test Structure

```
tests/
  conftest.py               # Fixtures (sample manifest, temp project dirs)
  test_mclib.py             # Unit tests: mod resolution, memory calcs, defaults,
                            #   name validation, port assignment, manifest I/O
  test_generate.py          # Compose + nginx generation tests
  test_create_destroy.py    # add_server, remove_server, dir setup, BlueMap EULA
```

Tests use `tmp_path` fixtures for file operations and a `sample_manifest` fixture that mirrors the real manifest structure. No Docker or network access needed — all tests run locally and fast.

## Adding Tests

When adding new functionality to `mclib.py`:

1. Write a failing test in the appropriate test file
2. Implement in `mclib.py`
3. Run `pytest` to verify

For new CLI scripts, put the logic in `mclib.py` (testable) and keep the script itself as a thin CLI wrapper (arg parsing + calling mclib functions).

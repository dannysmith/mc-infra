# Task: Finishing Up - Cleanup & Testing

## Phase 1 - Cleanup

- [ ] Check for any files or directories in this repo which we don't need anymore.
- [ ] Review all code for "cleanness" - anything we can tody up without affecting hwo things work?
- [ ] Review all docs in `docs/` plus README.md and AGENTS.md for correctness and coherence with each other.
- [ ] Anything else to clean up in this repo?

## Phase 2 - Manual Testing on the Server

When phase 1 is done we'll push/pull to the server. We should then test out our various `mc-` commands, especially `mc-create` with various options. This should also include some testing of manually editing both the manifest and the individual server's `env` files.

KEY POINT: Neither of the two servers which currently exist in the manifest are important to me. I'm fine for both to be removed/destroyed as part of this testing process.

We should test with various seeds and minecraft settings, and also with and without the fabric-base mod-group, and with and without bluemap and distant horizons.
We should also test with an "in-dev" mod (ie cloned into `~/dev/<modname>` and the built jar copied direct to the data/mods of a server). I have a very WIP (and possibly broken) bluemap Mod at https://github.com/dannysmith/mc-bluemap-structures which we can clone for this test.

There'll be a bunch ofother things we should test too.

For each NEW world we create we should certainally:

- Check the manifest.yml and docker-compose.yml look right, and also any other generated files (eg bluemap nginx)
- Check the logs using our `mc-logs` command.
- Actually connect in minecraft using the correct URL/subdomain
- If bluemap is included, check the `<name>-map.mc.danny.is` works ok.
- If any server mods bar the standard ones, DH and bluemap are incuded, check that they load properly and seem t work.
- Check our various `mc-` commands work (logs, start etc)

### End State

Let's aim to end up with three worlds in the manifest (all latest MC version/Fabric with our standard plugin set):

1. Creative - Fabric, Permenant, Superflat world made from sandstone with ~100 blocks of ground and no structures (with Bluemap and DH)
2. N19 Seed - Fabric, semi-permenant, seed 493527618652710797 with bluemap & DH on.
3. BMDev - Fabric, ephemeral, random seed with bluemap on & the latest jar from https://github.com/dannysmith/mc-bluemap-structures copied to its `mods/`.

### Checklist: Commands Tested

- [ ] TBD

### Step-by-step Plan

TBD

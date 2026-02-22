# Phase 2: Multi-Server & Routing

Set up mc-router for subdomain-based routing, Nginx reverse proxy with SSL for BlueMap, and prove multi-server works.

## Steps

- Add `itzg/mc-router` to docker-compose.yml, configure subdomain routing
- Move MC server off direct port 25565 — all traffic goes through mc-router
- Add a second MC server to prove routing works (e.g. `creative.mc.danny.is` and `test.mc.danny.is`)
- Set up Nginx reverse proxy for BlueMap web UIs
- Obtain wildcard SSL cert via certbot DNS-01 challenge with DNSimple
- Verify BlueMap accessible at `map-<name>.mc.danny.is`
- Test Simple Voice Chat on one server (UDP port 24454)

## Done when

- Two MC servers running, each accessible via their own subdomain
- BlueMap web UI accessible via HTTPS
- SVC working on one server

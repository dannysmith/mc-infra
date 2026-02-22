# Phase 5: Development Setup

Fabric mod and BlueMap plugin development environment on the VPS.

## Steps

- Verify JDK 21 + Gradle work on ARM (already installed by setup.sh)
- Set up dev project directory structure (`dev/`)
- Write `mc-dev-deploy` script: build project, copy JAR to test server, restart
- Create a dedicated dev-test server for rapid iteration
- Test the full workflow: scaffold a Fabric mod, build, deploy, test in-game
- Test with a simple BlueMap addon

## Done when

- Can develop, build, and deploy a Fabric mod from the VPS
- `mc-dev-deploy` script works end-to-end

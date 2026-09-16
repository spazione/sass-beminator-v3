# Sass BEMinator v3

Infrastructure for a from-scratch rewrite. No BEM core is implemented yet.

Use Node.js 22.19+ on the 22 LTS line or Node.js 24 LTS, then run `npm ci`.
The `.nvmrc` selects Node 22; supported release schedules are documented by
[Node.js](https://github.com/nodejs/Release#release-schedule).

- `npm test`: standalone Sass infrastructure tests; no legacy checkout needed.
- `npm run test:watch`: watch those standalone tests.
- `npm run test:legacy`: explicitly run the sibling v2 reference smoke tests.
- `npm run test:characterization`: run the historical v2 cases and state-isolation comparisons.

`test:legacy` now includes the characterization suite as well as the smoke tests.
Observed behavior, known leaks, and review questions are recorded in
[the v2 behavior inventory](docs/CHARACTERIZATION-v2.md). These observations are
not approved v3 requirements.

The harness uses the official Dart Sass
[`compileString()` API](https://sass-lang.com/documentation/js-api/functions/compilestring/).
See [legacy setup](docs/LEGACY.md), [architecture](docs/ARCHITECTURE.md), and
[contributor rules](AGENTS.md). The package is private and has no runtime dependencies.

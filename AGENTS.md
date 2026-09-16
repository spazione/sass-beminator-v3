# Sass BEMinator v3

## Project goal

This is a from-scratch implementation based on the public behavior of the legacy
library. The goal is not to refactor or port v2. Use its implementation only to
discover and verify behavior; do not copy its internal architecture.

## Legacy repository

The sibling `../sass-beminator` is the v2 behavioral reference and is READ ONLY.
Do not modify, refactor, format, update dependencies, or commit there. All new
files and changes belong in this v3 repository. Legacy compilation uses the v3
development dependency on Dart Sass, without installing anything in v2.

## Initial core API candidates

The eventual initial core contains only `block`, `element`, `modifier`,
`selector`, and `extend`. None may be implemented during this bootstrap task.
Keep `src/` empty until separately authorized core implementation work begins.

## Architecture rules

- Prefer modern Dart Sass APIs.
- Evaluate native modules such as `sass:selector` before custom selector manipulation.
- Avoid global mutable state whenever reasonably possible.
- Keep internal implementation details out of the public API.
- Every public behavior must eventually have an automated test.
- Specify new behavior before implementing it.
- Do not copy the internal architecture of v2.

## Non-core functionality

Themed button mixins, project-specific theme paths, Eurobet-specific conventions,
Atomic Design helpers/presets, and unrelated CSS utilities are excluded from the
initial core. They may become addons, plugins, or presets once the core API is stable.

## Testing rule

The eventual workflow is:

1. SCSS fixture → compile with legacy v2 → observed expected CSS.
2. Review the behavior and explicitly approve the v3 expectation.
3. Same SCSS behavior → compile with v3 → compare against approved expected CSS.

V2 output is historical evidence, not automatically the v3 specification. Report
known bugs and questionable behavior rather than blindly reproducing them.
Bootstrap smoke tests are not exhaustive characterization or API approval.

Use ES modules, Dart Sass's modern JavaScript API, and `node:test`. Keep the
generic compiler in `helpers/compile-scss.js` free of BEMinator logic. Isolate
legacy entry points and setup in `helpers/legacy.js`. Resolve paths from this
project, never the caller's working directory or a developer-specific absolute path.
Importing path helpers and running normal unit tests must not require v2.

Run `npm test` and `npm run test:legacy` for harness changes. Do not suppress
warnings or errors to make tests pass. Keep dependencies minimal; no bundler or
third-party test runner is needed. The package must remain private during bootstrap.

The first v2 characterization inventory is in `docs/CHARACTERIZATION-v2.md`.
`npm run test:legacy` includes it; `npm run test:characterization` runs it alone.
Fixtures and captured CSS/errors live under `characterization/v2`. Known state
leaks are explicitly named evidence tests, not v3 requirements. Never silently
update snapshots or infer API approval from a passing characterization test.

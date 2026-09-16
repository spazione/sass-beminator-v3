# Legacy behavioral reference

The expected layout is two sibling projects:

```text
parent/
  sass-beminator/     # read-only v2 reference
  sass-beminator-v3/  # all rewrite work
```

`helpers/project-paths.js` derives `projectRoot` from its module URL and resolves
`legacyRoot` as `../sass-beminator`. Validation happens only when a legacy check
or compilation is requested. Missing directories or entry points produce a
diagnostic containing the expected path. No legacy checkout is needed for `npm test`.

## Entry points and tooling

The inspected package is `@front-end-developer/sass-beminator` version `2.0.1`.
Its `main` points to `src/scss/tools/mixins/tool.beminator.scss`. That module
directly exposes mixins through Sass `@use`; use `bem.block(...)` with the `bem`
namespace. It also exposes non-private helper mixins and module variables, so
visibility alone is not evidence that a symbol belongs in the v3 public API.

The source tree contains settings, tools/functions, tools/mixins, components,
objects, and clientlibs. `src/scss/tools/tools.scss` forwards the main module with
a theme ID and uses a Webpack `@scss` alias. The demo build entry is
`src/scss/clientlibs/clientlib.main.scss`; it loads sample objects and CSS layers
and uses `/src/...` imports. Neither is needed for the adapter.

V2 declares `sass: ^1.83.4`, with `1.83.4` in its lockfile. Its `npm test` invokes
Webpack (configured to watch), using sass-loader, css-loader, and
mini-css-extract-plugin. Webpack supplies the `src/scss` include path, an `@scss`
alias, and a theme variable. The minimal direct module use requires none of
that setup, no additional load paths, and no v2 Node dependencies.

The bootstrap harness pins Dart Sass **1.104.1** and was validated on Node.js
**22.19.0**. The legacy smoke compilation emits two `if-function` deprecation
warnings, from `tool.beminator.scss:289` and `tool.list-to-string.scss:20`.
They are not suppressed or fixed in v2; compilation still succeeds.

## Adapter and smoke test

After `npm ci` in v3, run `npm run test:legacy`. It runs `tests/legacy` through
`node:test`, checks the sibling directory, reads `fixtures/legacy/block.scss`,
and calls `compileLegacy(source)` from `helpers/legacy.js`.

It also runs `tests/characterization`, including exact historical CSS/error
observations and explicit state-isolation comparisons. Use
`npm run test:characterization` for those checks alone. See
[CHARACTERIZATION-v2.md](CHARACTERIZATION-v2.md) for the recorded revision,
source inventory, known violations, and review questions. Baselines are historical
evidence, not approved v3 expectations. Tests never regenerate them.

The adapter checks the entry file and prepends:

```scss
@use "./src/scss/tools/mixins/tool.beminator.scss" as bem;
```

It gives `compileString()` a synthetic file URL at the legacy root so that the
relative module URL resolves consistently. It writes no source file there.
The module's transitive dependencies resolve relative to their own files.
Fixtures contain only behavior using the stable `bem` namespace:

```scss
@include bem.block('smoke-block') {
  color: red;
}
```

The smoke expectation is:

```css
.smoke-block {
  color: red;
}
```

The generic helper uses expanded CSS, disables charset/BOM emission and source
maps, and normalizes line endings to LF without sorting or rewriting CSS.
Sass exceptions propagate with their diagnostics and warnings remain visible.
Prepended setup adds one line to fixture diagnostics. Each call is a fresh Sass
compilation, so module state is not shared between fixtures.

The legacy repository is **read only**. It is a temporary development reference
for rewriting and characterization, not a runtime dependency of v3.

## Observations and decisions before characterization

V2 combines selector generation with mutable module globals, CSS layers, theme
loading, Atomic Design helpers, and project-specific paths. Its wrapper and demo
depend on bundler conventions that the direct smoke case avoids. These are
architectural observations, not a claim that all affected behavior is buggy.

Before expanding coverage, agree on the reference Git revision and compiler
version, which historical behaviors should become v3 requirements, how to
record approved CSS versus known bugs, and the scope of configuration and error
behavior. The v3 lockfile fixes the harness compiler; it does not recreate v2's
entire original build environment. Do not automatically regenerate approved
expectations when either reference or compiler changes.

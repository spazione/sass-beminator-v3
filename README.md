# Sass BEMinator v3

A from-scratch rewrite. The stable v3 core implements `block`, `element`,
`modifier`, `selector`, `extend`, and optional `css-layers` through `src/_index.scss`.
The core API is stable; the package remains private and has not been published.

```scss
@use 'sass-beminator' as bem;

@include bem.block("card") {
  @include bem.element("title") {
    @include bem.modifier("large") { font-size: 2rem; }
  }
}
// .card__title--large { font-size: 2rem; }
```

Optional layers use `block($name, $layer: null)` and the configurable flat
`$css-layers` registry:

```scss
@use 'sass-beminator' as bem;

@include bem.css-layers();
@include bem.block('card', $layer: 'molecules') {
  color: red;
}
```

Emit `@include bem.css-layers();` at stylesheet root before the first layered
CSS in the **final effective CSS ordering**. BEMinator cannot guarantee that order
after bundler/framework splitting, extraction, concatenation, or runtime injection.
Consumers may instead place this manual declaration before all layered CSS:

```css
@layer generic, elements, atoms, molecules, organisms, templates, pages, utilities;
```

Nested blocks inherit the outer layer when the argument is omitted/null; explicit
nested selection is rejected. Ordering is never emitted automatically.

See [the production subset contract](docs/PRODUCTION-v3.md) for argument limits,
supported nesting, private context architecture, and work still out of scope.
The [adopted core contract](docs/CORE-STABILITY-v3.md) closes D03/D05/D08/D09/D10/D11.
Evaluated BEM names match `[A-Za-z_][A-Za-z0-9_-]*`; variables/interpolation use the
same rule. Semantic failure categories are stable; exact diagnostic wording and
Sass-owned diagnostics are not API.

The sole supported entrypoint is `src/_index.scss`, exported as the package root
of `sass-beminator`. The bare imports above assume a configured package resolver.
With Dart Sass's NodePackageImporter enabled, use:

```scss
@use 'pkg:sass-beminator' as bem;
```

For a local stylesheet at the repository root, use `@use './src' as bem;`.
`npm run test:package` verifies the actual packed artifact through the package
importer. Deep imports have no compatibility promise. Namespaced usage is
preferred; custom namespaces and `as *` remain valid, with collisions owned by
the consumer. The finalized distribution name does not mean publication occurred.

Tested media/supports/container wrappers and flat CSS Layers are supported.
BEM integration in keyframes, font-face, property, page, scope, unknown/custom
at-rules, or caller-authored at-root queries is not guaranteed; unrelated CSS
using them is permitted. Raw leaf rules inside complete BEM rules are supported,
but BEM re-entry through raw `&:hover`, `.wrapper`, or similar selectors is
unsupported and can lose conditions. Use `selector(':hover')` with an
`element()` child for context-preserving scoped descendants. Qualified bodies
also support nested qualifiers and blocks outside extend ancestry; direct
modifier, pending-relation, and extend children remain deferred.
Deferred relationships and functional pseudos remain outside the stable API
with no future implementation promised.

Use Node.js 22.19+ on the 22 LTS line or Node.js 24 LTS, then run `npm ci`.
The `.nvmrc` selects Node 22; supported release schedules are documented by
[Node.js](https://github.com/nodejs/Release#release-schedule).

- `npm test`: standalone Sass infrastructure and production tests; no legacy checkout needed.
- `npm run test:watch`: watch those standalone tests.
- `npm run test:production`: run only the production entrypoint tests.
- `npm run test:package`: pack offline and verify the public Sass API in an isolated consumer (requires npm and tar).
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

# Sass BEMinator v3

A from-scratch rewrite. The approved core implements `block`, `element`,
`modifier`, `selector`, `extend`, and optional `css-layers` through `src/_index.scss`; the package remains private.

```scss
@use "./src" as bem;

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
@use "./src" as bem;

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

Use Node.js 22.19+ on the 22 LTS line or Node.js 24 LTS, then run `npm ci`.
The `.nvmrc` selects Node 22; supported release schedules are documented by
[Node.js](https://github.com/nodejs/Release#release-schedule).

- `npm test`: standalone Sass infrastructure and production tests; no legacy checkout needed.
- `npm run test:watch`: watch those standalone tests.
- `npm run test:production`: run only the production entrypoint tests.
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

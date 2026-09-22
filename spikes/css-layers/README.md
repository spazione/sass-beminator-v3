# Disposable CSS Layers experiment

This is evidence for maintainer review, not a production API. `_proof.scss`
wraps the unchanged production `block()` with the legacy-compatible `$layer`
argument and forwards the other core operations/settings. It does not copy or
modify the core. `layer()` is secondary comparative evidence, not a proposed
replacement for `block($name, $layer: ...)`.

Run with the project's supported Node version:

```sh
node --test --experimental-test-isolation=none spikes/css-layers/probes.test.js
```

57 tests compare literal expanded CSS (including wrapper order and whitespace)
or expected errors. Expected CSS is constructed from literal selectors/wrappers,
not compiler snapshots. The suite writes source and CSS to ignored
`tmp/css-layers/`. Invalid-input tests assert diagnostics. No dependencies added.

The experiment probes an eagerly validated, nonempty flat registry, strict
lookup, ASCII simple names, explicit order emission, automatic module emission,
and per-call order emission. These are candidates, not approved policy. Quoted
and unquoted string keys/arguments are equivalent; map values are ignored.
Automatic emission is isolated in `_automatic.scss`; the two consumer modules
prove canonical Sass module CSS deduplication. It does not use an emitted flag.

Natural nested layer output is measured, **not approved** as an inner override.
Calling the order mixin inside a style rule does not hoist it; intended use is at
stylesheet root, before rules from any layer are emitted. Ordering first requires
care when `@use` dependencies themselves emit CSS.

Source checks confirm this proof adds no mutable globals or `@at-root` boundary.
It relies on the core's one mutable stack and one emission boundary, with no
layer metadata in BEM contexts. Registry configuration is a load-time input.

See [the design report](../../docs/CSS-LAYERS-DESIGN-v3.md) for findings,
limitations, recommendations, and outstanding maintainer decisions.

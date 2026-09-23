# Qualified selector scope spike

Isolated proposal; production and its public API are unchanged. See
[the design and decision matrix](../../docs/SELECTOR-SCOPE-DESIGN-v3.md).

`_proof.scss` adapts the current production core with only a qualified transition
entry and element-scope condition changed. `_index.scss` retains the six-mixin,
three-setting surface. The tests include injected, in-memory frame assertions;
no debug API is exported by this entrypoint.

From the project root with Node 22.19.0:

```sh
node --test --experimental-test-isolation=none spikes/selector-scope/probes.test.js
```

`performance.mjs` is a small completed sanity check, not a performance project.
Its raw evidence is `results/sanity.json`; the runner refuses to overwrite it.

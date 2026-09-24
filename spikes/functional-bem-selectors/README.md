# Functional BEM selector spike

Design and feasibility only; no production feature or API approval.
See [the design and decision matrix](../../docs/FUNCTIONAL-BEM-SELECTORS-DESIGN-v3.md).

With the project's supported Node selected (verified on 22.19.0):

```sh
node --test --experimental-test-isolation=none spikes/functional-bem-selectors/probes.test.js
```

Dart Sass is pinned to 1.104.1. Paths resolve from the test module, independent
of the caller's working directory. The custom importer appends `_experiment.scss`
to the unchanged core in memory. The fragment is not a standalone module or a
production export. `game-card.scss` requires that importer.

Eleven tests cover exact CSS and native selector capabilities, legal mixin names,
the four API anchors, relation and provenance boundaries, existing qualified
scope propagation, separators, layers and stack restoration. Extra block,
modified-target and filtering-list examples establish feasibility only; they do
not broaden the recommended first feature beyond same-owner-element `has()`.

There are no new evolving globals, context fields, parser changes or emission
boundaries. A source hash guard intentionally fails if the audited core changes;
review this historical spike's assumptions before updating that guard.

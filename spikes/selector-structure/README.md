# Structural selector experiment

Disposable proof only. Nothing here changes production exports, semantics,
SPEC-v3, separator configuration, or layers. Functional pseudos are inspected as
Sass values but rejected by the proof mixin. No conditional-selector API exists.

```sh
node spikes/selector-structure/inspect.js
node --test --experimental-test-isolation=none spikes/selector-structure/probes.test.js
```

`inspect.js` records raw parse/simple-selector/append observations, including
malformed and intentionally excluded inputs, under ignored
`tmp/selector-structure/primitives.json`. It also records native construction
of relations/chains. Successful CSS is not evidence of browser validity or API
approval. Errors are retained rather than suppressed.

`_proof.scss` uses one private mutable stack and one emission boundary, with pure
structural classification and context derivation. It imports only pure helpers
from the original selector-engine spike. Its public-looking proof mixins and
`classify`/`assert-depth` are experiment helpers, never production exports.

The 16 separate tests cover 44 qualifier/context outputs, all three relations,
scopes and modifiers on right-hand elements, extend ancestry, pending-declaration
errors, exact stack restoration, representative sibling orders, raw-input
boundaries, attribute delimiters, and chaining construction. They do not increase
the counts of the existing 100 production / 42 original spike / 162 project tests.

See [SELECTOR-DESIGN-v3.md](../../docs/SELECTOR-DESIGN-v3.md) for the recommendation
and unapproved boundaries. No production code may import this experiment.

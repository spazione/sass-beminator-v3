# Disposable selector/context proofs

These files are experiments, not production BEMinator mixins. Nothing is
exported by the v3 package or placed in `src/`. The generic `proof` module
constructs selector values and explicitly supplied frames; it is not a finished
engine and is not a proposed public API. It has no automatic operation dispatcher.

Run from the project root:

```sh
node --test spikes/selector-engine/spikes.test.js
```

For individual-test output in the current managed environment:

```sh
node --test --experimental-test-isolation=none spikes/selector-engine/spikes.test.js
```

The 27 tests cover A–H, counterexamples for native nesting and ambient context,
three-valued nesting classification, compiler rejection proofs, and map-value
isolation. Expected selectors are derived from `docs/SPEC-v3.md`; these are
not regenerated v2 baselines. Comparisons retain selector text and rule order.
Generated proof CSS goes only into ignored `tmp/selector-engine/`.

- A: BEM suffixes.
- B: two independently suffixed subjects joined into a conjunction.
- C: contextual single/double modifiers followed by element targeting.
- D: recursive block descendants, including equal names.
- E: nested component's element and modifier naming.
- F: `:before` and `+` followed by an element.
- G: approved block-scoped extend forms only.
- H: minimal leak and complete six-rule regression, both alone and after a sibling.
- I: native `&` limitations, double nesting without `@at-root`, and lexical content arguments.
- J: expected undefined-variable error when a separately defined mixin tries to
  read a context argument it was not passed.

Names are fixed simple identifiers; escaping, arbitrary selectors, deferred
relationships, Q07, and production input validation are not implemented.
The validation proof reports `deferred` without granting support. Actual error
wording in its rejection checks is deliberately a spike-only label.
Static fixture constants and H's compile-time input switches do not change during
callbacks. There is no evolving module-global context and no `!global` assignment.

See [implementation design](../../docs/IMPLEMENTATION-DESIGN-v3.md) for the
recommended architecture, its API tradeoff, and the limits of these proofs.

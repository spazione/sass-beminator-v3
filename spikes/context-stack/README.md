# Disposable private-context-stack spike

This experiment preserves context-free nested calls using exactly one private
mutable stack. It is not production v3 and does not finalize public signatures.
`src/` and SPEC-v3 are untouched.

```scss
@use 'stack' as s;
@include s.proof-block('card') {
  @include s.proof-element('title') {
    @include s.proof-modifier('large') { font-size: 2rem; }
  }
}
```

`_stack.scss` reuses the selector-engine spike's pure value helpers. All context
derivation is pure; push/pop are the only global writes. Every successful entry
asserts exact stack contents and restores the saved immutable list. `assert-depth`
is disposable test instrumentation; consumers cannot access stack values/helpers.
Deferred inputs stop at a spike-only diagnostic without specifying future behavior.

Run with the project's supported Node version:

```sh
node --test --experimental-test-isolation=none spikes/context-stack/spikes.test.js
```

The 15 tests compare 25 approved outputs against normative expectations and the
explicit-transport spike; exercise both historical regressions, 240 mixed sibling
sequences, six element-child orders, recursion/depth/root isolation, six invalid
paths, privacy, and compiler reuse after both validation and caller errors.
Generated CSS goes to ignored `tmp/context-stack/`. No snapshots are updated.

See the [design decision](../../docs/IMPLEMENTATION-DESIGN-v3.md#13-implicit-private-stack-versus-explicit-content-arguments)
for the transport comparison, abort findings, boundaries, and recommendation.

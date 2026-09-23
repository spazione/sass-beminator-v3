# Qualified selector scopes: design and behavior spike

Status: isolated design proposal, **not production support or API approval**.
Production, selector grammar, signatures, configuration and performance
optimizations remain unchanged. Functional pseudos are outside this investigation.

## Decisions specified before implementation

Use the existing immutable context map. A qualified frame retains its owner and
existing scope while appending its qualifier to the local subject. When an element
is derived from that frame, use the parent's **completed selector** as the child's
scope and construct the element subject from the unchanged owner. Do not eagerly
put the completed qualified selector into its own scope: the existing emission
boundary would then nest the subject twice.

| Parent before qualification | Child after selector | Spike decision |
| --- | --- | --- |
| block | element | VALID |
| element | element | VALID |
| modifier | element | VALID |
| element modifier | element | VALID |
| block (or any other qualified origin) | modifier | UNSUPPORTED/DEFERRED |
| qualified selector | qualified selector | VALID, separate composition decision |
| qualified selector, outside extend ancestry | nested block | VALID, separate new-owner decision |
| extend → element | element | VALID |
| qualified selector + pending relation | element | UNSUPPORTED/DEFERRED |
| any qualified selector under extend ancestry | nested block | INVALID |
| qualified selector | extend | UNSUPPORTED/DEFERRED |

Nested blocks have an unambiguous existing derivation: start a new owner and
inherit the completed parent's scope. Nested qualified selectors also have an
unambiguous local operation: append another already-supported qualifier to the
same subject, retaining owner and outer scope. The spike explicitly chooses to
exercise both candidates; neither is automatically approved for production.

A direct modifier is deferred: appending a BEM suffix to a qualified subject is
not the desired `.card:hover.card--active` operation, and the current frame does
not retain a separate unqualified subject. Reconstructing one from selector text
would violate the provenance model. Qualify an existing modifier before entering
the selector, or create an element child and modify that child instead.

A relation immediately under a qualified frame is deferred. Mechanically its
left selector can be completed, but allowing it solely by `kind: qualified` would
also admit formerly unsupported block/modifier origins. Recovering original
provenance is a separate decision, not a reason to broaden relation semantics.

The only proposed derivation change is treating `qualified` like `modifier` or
`extend` when deriving an element's scope. The static qualified-transition entry
can then allow `element`, `block`, and `qualified`. No context field, mutable
global, stack mechanism, emission boundary or selector parser needs changing.

## Context model and scope rule

Production and the spike use these facts:

| Fact | Meaning and lifecycle |
| --- | --- |
| `owner` | Native Sass selector for the BEM naming owner, e.g. `.card`. Blocks and extend targets replace it; elements, modifiers and qualifiers preserve it. Never inferred from ambient `&` or serialized selectors. |
| `subject` | The local selector being styled: owner, element, modified subject, or qualified subject. It excludes the already accumulated outer scope. |
| `scope` | Ordered comma-separated arguments used before `subject` in `selector.nest(scope..., subject)`. Usually empty or a singleton containing a completed ancestor selector. A resolved pending relation can temporarily use `(completed-left, combinator)` as scope. It is not a list of BEM names. |
| `kind` | Immediate semantic role for validation/derivation: root, block, element, modifier, qualified, pending-relation or extend. `qualified` does not record which role was qualified. |
| `under-extend` | Immutable ancestry flag propagated to every descendant, independent of kind. Blocks are rejected whenever it is true, before other relationship checks. |
| `relation` | An extra key present only on pending frames. It holds `+`, `>` or `~`; the pending frame retains the left subject/scope, and an element resolves the relationship. It is not global state. |

The clean rule is: **a qualifier transforms the current subject while preserving
owner and outer scope; a BEM descendant which establishes a new subject promotes
the completed qualified parent into its own scope.** This is a small adjustment
to the proposed eager-scope formulation, required by the existing emission model.

For the baseline, context transitions are exactly:

| Frame | Owner | Subject | Scope | Kind |
| --- | --- | --- | --- | --- |
| block | `.card` | `.card` | `()` | block |
| selector `:hover` | `.card` | `.card:hover` | `()` | qualified |
| element `title` | `.card` | `.card__title` | `(.card:hover,)` | element |

Scope cells above use readable selector notation; actual values are native Sass
selector lists, nested in the scope argument list. Native `selector.append` and
`selector.nest` perform construction, with no string-based ownership recovery.
Terminal declarations still emit `.card:hover` once. An element child emits
`.card:hover .card__title`. Setting the qualified frame's scope to `.card:hover`
while retaining that subject would incorrectly duplicate it at emission.

## Verified behavior

The isolated implementation is
[`spikes/selector-scope/_proof.scss`](../spikes/selector-scope/_proof.scss), adapted
from optimized production SHA-256
`3a73cbdbb227f0f7a0d1d7a092eea4c47510694b3361378f234ddc2921cce6cd`.
[`_index.scss`](../spikes/selector-scope/_index.scss) exposes the same six mixins
and three settings, with zero public functions. Test-only frame assertions are
injected into an in-memory module, not exported by that entrypoint.

[`probes.test.js`](../spikes/selector-scope/probes.test.js) passes **112 tests** on
Node 22.19.0 / Dart Sass 1.104.1. Exact CSS assertions include selector ordering,
native attribute serialization, declarations before/after children, and no
unintended ancestor duplication. The first test run corrected four assertions:
two expected an extra blank line Sass does not emit, and two incorrectly expected
an extra owner-class ancestor before an element. The implementation did not change
to satisfy those mistaken expectations.

| Composition | Exact resulting selector |
| --- | --- |
| block → `:hover` → element(title) | `.card:hover .card__title` |
| element(item) → `:hover` → element(icon) | `.card__item:hover .card__icon` |
| modifier(active) → `:hover` → element(icon) | `.card--active:hover .card__icon` |
| element(item) → modifier(active) → `:hover` → element(icon) | `.card__item--active:hover .card__icon` |
| block → `:hover` → element(title) → modifier(large) | `.card:hover .card__title--large` |
| block → `:hover` → block(icon) | `.card:hover .icon` |
| block → `:hover` → block(icon) → element(glyph) | `.card:hover .icon__glyph` |
| block → `:hover` → `:focus` → element(title) | `.card:hover:focus .card__title` |
| extend(icon, active) → element(label) → `:hover` → element(glyph) | `.card .icon--active .icon__label:hover .icon__glyph` |

The generated parent/qualifier matrix tests block, element, block modifier,
element modifier, extend element and nested-block parents with each of `:hover`,
`:focus`, `:hover:focus`, `[disabled]`, `[disabled]:hover`,
`[data-state="open"]:focus`, `:hover[aria-expanded="true"]` and `:focus::before`.
Sass serializes the simple attribute values as `open` and `true` without quotes.
The broad qualifier matrix uses `title`; a separate test checks the exact requested
`icon` cases under element, modifier and element-modifier parents.

All those terminal forms remain byte-identical to production. The unchanged
parser rejects classes, IDs, type/universal/placeholder selectors, complex
selectors, selector lists, parent references and mixed arbitrary selectors listed
in the request. Functional pseudos, including escaped spellings, still fail.
This does not add browser-semantic validation: a descendant after `::before` is
serializable by Sass but does not imply an ordinary DOM child of a pseudo-element.
Accepting that qualifier follows the existing grammar, not a new matching guarantee.

### Nested blocks and nested selectors

Nested blocks are an explicit **VALID spike decision** because existing block
derivation already creates a new owner and scopes it under the completed parent.
The nested block's element is constructed from the new owner and retains that
outer scope. It does not automatically require an additional `.icon` ancestor;
that is existing block/element behavior. Equal-name nested blocks work the same
way. Direct element→block remains deferred; the new qualified frame explicitly
establishes a scoped descendant boundary. Blocks anywhere beneath extend remain
**INVALID**, including qualified and deeper qualified-element paths and explicit
layer requests. No ancestry rule is weakened.

Nested qualifiers are a separate **VALID spike decision**: they use the existing
qualified derivation to append to the same subject, not to create another
descendant scope. `.card:hover` plus `:focus` becomes `.card:hover:focus`;
an outer `.page` appears only once. A following sibling child of the first scope
still emits under `.card:hover`, without the inner `:focus`. This requires only
allowing the transition, not another context fact or helper. Each selector argument
still independently passes the unchanged structural validator.

### Pending relations and extend

`element → selector(':hover') → selector('>') → element` remains deferred, as do
the analogous `+` and `~` paths. A completed qualified subject would be a coherent
left operand for native nesting, but permitting this from every `qualified` frame
would also admit block/modifier origins contrary to the existing relation gate.
The five context facts preserve enough information for emission, but not the
original kind needed for that conditional authorization. No new provenance field,
stack scan, global flag or broadened relation gate is introduced.

Already-approved relation paths remain composable **after an element is derived**:

```css
/* block → :hover → element(item) → > → element(child) */
.card:hover .card__item > .card__child { color: red; }

/* element(item) → > → element(child) → :hover → element(glyph) */
.card__item > .card__child:hover .card__glyph { color: red; }
```

The same assertions cover `+` and `~`. Pending frames still emit no rule, reject
bare declarations through Sass, and accept only an element child. Qualified
children of an unresolved pending frame stay deferred.

Extend replaces the naming owner with the target `.icon`, retains `.card` in
outer composition, and supplies `.icon--active` as its subject. Its element has
scope `.card .icon--active`; qualifying that element and deriving another element
promotes the whole completed selector once. The final owner remains `.icon`, not
`.card` or `.icon__label`. All descendants retain `under-extend: true`. Direct
extend→qualified and qualified→extend remain deferred.

### Raw Sass and restoration

Raw `&:hover` changes Sass's ambient selector, not the BEMinator context. Since
the BEM emission boundary uses its own complete selector at `@at-root`, the raw
re-entry example emits `.card__title`, losing hover in both production and spike.
The explicit selector mixin creates a context frame and preserves hover. The raw
output is a contrast/evidence test, not a supported re-entry contract.

Every call saves the previous immutable stack locally, pushes its derived frame,
executes content through the existing boundary and restores the saved stack.
Tests compare **the entire saved stack and complete context maps**, not merely
matching CSS. They exercise nested qualifiers, element and nested-block owners,
pending-frame relation keys and extend ancestry. Empty qualified branches,
empty children and empty nested scopes emit no stray CSS. Sibling scopes and
elements, later top-level blocks and repeated root names stay independent:

```css
.card:hover .card__title { color: red; }
.card__body { color: blue; }
.card:focus .card__body { color: green; }
.other__title { color: black; }
.card__title { color: red; }
```

Custom separators, double modifiers, root CSS Layers, conditional wrappers and
the root-only explicit-layer rule are also checked. Direct element→element and
modifier→modifier remain invalid; qualification introduces a deliberate scoped
descendant boundary rather than silently changing those direct relationships.

## Recommended production change, subject to approval

For the complete proposed matrix, production would need only these two rule edits:

1. Change the immutable `qualified` transition entry from `()` to
   `(element, block, qualified)`.
2. When deriving an element, include `parent-kind == qualified` alongside the
   existing modifier/extend condition that promotes `-complete-selector($parent)`
   to the new scope.

For an element-only rollout, the first entry can instead be `(element,)`; nested
blocks and nested qualifiers are independent approval choices and require no
additional derivation changes. In either case, keep direct modifier, extend and
pending-relation children deferred. Preserve parser, context layout, ancestry
check precedence, stack lifecycle, native selector operations and emission code.
The spike source guard proves all production source outside those two rules is
identical (apart from the spike provenance header). There remains **one evolving
mutable global** (`$-context-stack`) and **one BEM emission boundary**. The private
transition map remains immutable lookup data.

Production tests that currently assert qualified-child rejection would need
explicitly approved expectation updates in a later implementation task. Nothing
in this spike edits those tests or turns proposed behavior into the stable API.

## Small performance sanity check

[`performance.mjs`](../spikes/selector-scope/performance.mjs) uses the same spike
core for both paths, 1,000 distinct blocks per compile, two warmups and five
measured rounds per lane with alternating order. Fixture construction and exact
CSS checks are outside the compile timer; no warnings or outliers are suppressed.
Node 22.19.0 / Dart Sass 1.104.1, Intel Core Ultra 5 238V. Raw samples, source
hashes and output sizes are in
[`results/sanity.json`](../spikes/selector-scope/results/sanity.json).

| Path | Public calls | Median ms | Mean ms | Min–max ms |
| --- | ---: | ---: | ---: | ---: |
| 1,000 block → element | 2,000 | 252.72 | 251.63 | 242.79–259.94 |
| 1,000 block → `:hover` → element | 3,000 | 408.14 | 410.16 | 397.58–428.87 |

The median ratio is **1.615×** with 50% more public calls, qualifier parsing and
more CSS output. This small sample shows no obviously pathological multiplier.
It is not a scaling study, attribution of propagation-only cost, or a reason to
optimize any path. Every compile matched its independently generated expected CSS.

## Production integrity and reproduction

Production source SHA-256 is unchanged at the value above. `npm test` passes;
its no-isolation detail check reports **510 passing individual tests**. The
isolated spike reports **112 passing tests**. `git diff --check` and whitespace
checks of the new files pass. Production tests and shared compiler helpers were
not edited; no historical spike or runtime-profile experiment was rerun.

With Node 22.19.0 selected, run from the project root:

```sh
node --test --experimental-test-isolation=none spikes/selector-scope/probes.test.js
npm test
```

The sanity runner refuses to overwrite its saved results; its completed samples
are evidence for this report, not work that needs repeating. No production support,
functional pseudo behavior or performance optimization was implemented. Adoption
of any VALID proposal row remains a separate maintainer decision.

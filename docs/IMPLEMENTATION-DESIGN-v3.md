# Implementation design and selector spikes

## 1. Goals and recommendation

Recommend a **minimal hybrid**: pure construction of selector/context values,
explicit lexical context passing, and one controlled `@at-root` emission boundary.
Sass content blocks provide authoring nesting and declaration bodies. Selector
meaning and nesting validation come from the supplied context, not from guessing
the call history from `&`.

**Zero evolving module-global context is feasible for the approved semantics.**
The feasibility proof requires an explicit context-passing interface. It does
not prove that unchanged, context-free v2-style calls can achieve the same result.
The maintainer must choose the context transport/API ergonomics before production
wrappers are implemented. No production mixin is implemented by this design task.

The goal is the smallest design that satisfies [SPEC-v3.md](SPEC-v3.md), including
isolation and rejection, not a general selector engine or a reproduction of v2.

## 2. Constraints from the specification

- Block nesting is descendant composition at recursive depths. Equal names take
  the ordinary path; `.icon .icon` is valid.
- An element's naming owner and its required ancestor scope are distinct. Under
  `block(a) → block(b)`, its element is `.a .b__item`, not `.a .b .b__item`.
- Modifiers qualify the current subject. Two arguments in one call create two
  conjunctive classes; direct nested modifier calls are rejected.
- An element under a contextual modifier is a descendant of that modifier's
  selector but remains named for the enclosing component.
- Only `:before` and the tested `+ → element` selector forms are approved.
- Extend under a block changes the target name and introduces modifier scope;
  blocks are rejected anywhere below extend. Native Sass extension is not its contract.
- Direct element/element and modifier/modifier relationships are rejected.
- Completed sibling calls cannot affect later selectors or validation context.
- DEFERRED entries, including top-level/nested extend and Q07's full composite
  output, are not solved or approved here. No themes/addons are implemented.

Historical CSS/error artifacts and the intentional specification are unchanged.
The [compiler comparison](COMPILER-BASELINE-v2.md) establishes the prior v2
baseline; these new proofs use the installed v3 Dart Sass 1.104.1.

## 3. Sass primitives evaluated

| Primitive | Finding | Use in recommended design |
| --- | --- | --- |
| `selector.append()` | Produces suffixes, same-target conjunctions, and `:before` without adding descendants | Essential |
| `selector.nest()` | Composes ancestor selectors and the approved adjacent-sibling operands | Essential |
| `selector.parse()` | Gives a consistent selector-value representation at the class-name boundary | Useful small constructor; not strictly required because other functions accept strings |
| `selector.unify()` | Intersection/search behavior is not needed for these known class compounds | Unnecessary; no unification engine/spike added |
| `selector.extend()` / `replace()` | Do not describe the approved BEMinator extend behavior | Unnecessary |
| `&` | Useful for natural SCSS and observing the ambient selector, but cannot identify public call provenance | Not the authoritative naming/validation context |
| `@at-root` | Prevents an already complete interpolated selector from acquiring its Sass rule ancestors again | Required at controlled emission boundary |
| `@content(value)` / `using(value)` | Carries a value into the caller's lexical content scope | Required for the proposed context transport |
| `sass:map`, `sass:list` | Represent derived context values and selector operands | Small value utilities; no mutable registry |

The [official selector documentation](https://sass-lang.com/documentation/modules/selector/)
describes append as combination without descendant whitespace and nest as Sass
nesting composition; selector values are structured lists. Parse is a representation
conversion, not a BEM identifier validator. Our literal-identifier proofs confirm
the needed suffix and combinator forms. Unify's general overlap operation adds no
benefit to these fixed class conjunctions.

String interpolation remains appropriate only at token boundaries here:
`'.#{$name}'`, `'__#{$element}'`, and `'--#{$modifier}'`. The proof does not split
serialized selectors to recover names, remove ancestors, or trim suffixes.
Public name validation/escaping must be decided before accepting arbitrary input.

The [official at-root documentation](https://sass-lang.com/documentation/at-rules/at-root/)
explains why interpolation of a computed selector still needs an explicit escape
from ordinary Sass rule nesting. The proof reproduces that extra-nesting hazard.

## 4. Executable spike results

All proof code is under [spikes/selector-engine](../spikes/selector-engine/README.md).
Its generic functions construct values and its generic mixins emit content; none
is a production `block`, `element`, `modifier`, `selector`, or `extend` mixin.
Frames are deliberately assembled at the call sites, exposing the assumptions
instead of hiding a complete experimental engine behind five wrappers.

| Spike | Question answered / observed CSS |
| --- | --- |
| A — [suffix](../spikes/selector-engine/a-suffix.scss) | `.block` → `.block__element`, `.block--modifier`, `.block__element--modifier` |
| B — [conjunction](../spikes/selector-engine/b-conjunction.scss) | `.block--a.block--b`, `.block__element--a.block__element--b`; outer scope appears once in `.outer .block--a.block--b` |
| C — [contextual element](../spikes/selector-engine/c-contextual-element.scss) | `.block--active .block__child`, `.block__item--active .block__child`; double forms retain the conjunction before the descendant |
| D — [recursive block](../spikes/selector-engine/d-recursive-block.scss) | `.a .b`, `.a .b .c`; a single recursion path emits two, three, and four `.icon` descendants without name comparisons |
| E — [nested naming](../spikes/selector-engine/e-nested-naming.scss) | `.standard-object .icon__label`, `.standard-object .icon--active`, `.standard-object .icon__label--active` |
| F — [selectors](../spikes/selector-engine/f-selectors.scss) | `.block__item:before`, `.block__item + .block__other`; no incomplete combinator rule emitted |
| G — [extend](../spikes/selector-engine/g-extend.scss) | `.a .b--m`, `.a .b--x.b--y`, and their descendant `.b__item` forms; no top-level/nested extend or block beneath extend emitted |
| H — [isolation](../spikes/selector-engine/h-isolation.scss) | B alone equals the B portion of A+B for the minimal sibling case and all six historical regression rules, including declarations/order |

The H minimal result is `.standard-object__after` in both cases. The preceding
`.standard-object .icon` rule remains A's output and never prefixes B. The larger
proof emits the six normative selectors in SPEC-v3 in order, beginning with
`.standard-object__gigi--fatherdMod`; neither run adds a leading `.standard-object`.
This is the active regression only, not the deferred Q07 branch.

Additional proofs establish limits:

- I: naive `&__child` inside a modified element gives
  `.natural__item--active__child`, the wrong BEM target.
- I: interpolating a complete selector without `@at-root` emits
  `.ambient .ambient .target`; the controlled form emits `.ambient .target`.
- I: two contexts can expose identical `&` (`.outer .icon--m`) while one is a
  modifier on a nested block and the other is an extend target. The first permits
  a child block; the second rejects it. CSS alone cannot determine that permission.
- I/J: content arguments are lexical, not implicit arguments to other mixins.
- Validation proofs classify 14 representative relationships, throw for five
  explicit invalid cases, and retain DEFERRED results as unapproved. A derived
  element then modifier retains the extend-ancestor restriction.
- A map derivation leaves its original parent value unchanged.

The [test runner](../spikes/selector-engine/spikes.test.js) contains **27 tests**.
Expected selectors come from the intentional specification, not rewritten legacy
snapshots. Tests retain exact selector text, combinators, declarations, and rule
order while ignoring only whitespace between the flat identifying rules.
Generated CSS is written under ignored `tmp/selector-engine/`.

## 5. Architecture alternatives

| Criterion | 1: mainly native nesting and `&` | 2: explicit selector calculation/emission | 3: minimal hybrid — recommended |
| --- | --- | --- | --- |
| Correctness | Good simple suffixes/blocks; fails contextual element naming if inferred from `&` alone | Explicit owner/scope give correct selectors | Same explicit construction, plus lexical content bodies |
| Isolation | Native nesting is scoped, but does not supply missing BEM provenance | Pure values isolate calculations | Parent values remain lexical while child bodies execute |
| Complexity/readability | Very short until selector parsing or ambient metadata is added | Small functions, but a flat explicit call tree is verbose | Small functions plus one emission/content boundary; explicit context passing remains visible |
| Mutable state | Needed for missing implicit metadata unless extra inputs are introduced | None with explicit inputs | None with explicit inputs |
| Nesting validation | `&` cannot distinguish identical CSS from different public operations | Available from provenance values | Same validation before lexical child entry |
| Nested blocks | Easy descendants; element naming still needs owner/scope | Correct recursive composition | Correct recursive composition with ordinary content nesting |
| Modifier → element | Parent suffix alone targets the wrong naming base | Explicit owner plus contextual prefix | Same |
| Accidental Sass nesting | High once computed selectors are mixed in | Low with consistent `@at-root` | Low if all completed frames use one emission boundary |
| Testing | Simple examples easy; provenance problems hard to observe directly | Pure construction and output tests | Pure calculations plus nested body/isolation tests |

These were evaluated with small examples, not three complete engines. Strategy 3
adds lexical content transport to strategy 2; it does not mix two competing
sources of selector truth. No mutable-state fallback is recommended here.

## 6. Context transport: important API consequence

Sass [content blocks are lexically scoped](https://sass-lang.com/documentation/at-rules/mixin/#content-blocks):
they see their caller's variables, not locals in the receiving mixin. The
documented content-argument mechanism can deliver a child context, but a separately
defined nested mixin still needs that value passed explicitly. I/J prove both facts.

The proposed transport is schematically:

```text
operation(arguments, parent-context) using (child-context) {
  next-operation(arguments, child-context) using (next-context) { ... }
  sibling-operation(arguments, child-context) { ... }
}
```

This is a design sketch, not an approved public signature. A root call would
create its initial context; nested callers would receive/pass opaque contexts.
Ordinary declarations in the content block use the emitted selector naturally.
Context values should not require consumers to know their internal fields.

This choice needs maintainer acceptance because it is more explicit than v2's
implicit context-free call style. Merely declaring a local variable in a wrapper
does not make it available to nested module mixins. Neither `&` nor `@at-root`
provides hidden public ancestry. Preserving implicit syntax would require a
different, explicitly justified transport design; it must not be claimed as a
zero-state property already established by these proofs.

## 7. Minimal conceptual context model

Five facts suffice for the tested construction and local rejection rules:

| Field | Meaning / approved behavior that requires it |
| --- | --- |
| `owner` | Bare component selector, e.g. `.icon`; element naming must survive modified subjects and switch inside nested blocks/extend targets |
| `subject` | Current target compound, e.g. `.icon__label` or `.icon--a.icon--b`; modifiers apply to this target, not the entire ancestor selector |
| `scope` | List of selector operands preceding the subject; separates `.standard-object` from `.icon`, permits replacing icon by icon's element, and holds `(left-selector, '+')` for adjacent targeting |
| `kind` | Nearest public operation; distinguishes direct element/modifier rejection and permitted child contexts. The two approved selector forms use distinct proof kinds `before` and `adjacent` |
| `under-extend` | Immutable inherited boolean: a block remains forbidden even through intervening element/modifier calls below extend |

The complete selector is derived, not stored again:
`selector.nest(scope operands..., subject)`. An empty scope selects the subject
alone. Selector values are kept intact inside the operand list.

No separate mutable current selector, modifier flag, saved previous block,
extend-name field, or context history is needed. `kind` selects the applicable
relationship; `owner` already identifies the extend target. Before/adjacent are
two fixed operations, not an extensible arbitrary-selector state machine.

Each entry derives a new value from its parent. Children retain immutable
ancestor facts such as `under-extend`; only root creation starts it as false.
Sass [maps are immutable values](https://sass-lang.com/documentation/values/maps/#immutability),
so a map operation returns a new value. Local variable assignment may bind that
new value, but cannot change the parent's value. Returning to an enclosing content
block naturally exposes the same parent variable; there is nothing to pop/reset.

The spike's public frame constructor is a disposable convenience for assembling
proof data. Production context construction would be private and derived from
parent values, so wrappers do not accidentally reset ancestor facts to defaults.
Fixture constants and H's compile-time configuration switches are read-only during
callbacks; they are not evolving runtime context.

## 8. Selector construction rules

These rules use only approved relationships; validate before deriving a child.

| Entering operation | Derivation |
| --- | --- |
| Root block | Parse its class as owner and subject; empty scope |
| Nested block | New owner/subject; scope is the complete parent's selector |
| Element under block | Subject is owner with `__name`; retain the block's scope, so its own class is replaced by its element rather than duplicated as an ancestor |
| Element under modifier or approved extend | Subject is owner with `__name`; scope becomes the complete parent's selector |
| Modifier | Suffix the unmodified parent's subject with `--name`; retain owner/scope |
| Double modifier | Independently suffix the same original subject twice, then append those compounds; retain owner/scope |
| `:before` | Append `:before` to subject; retain owner/scope |
| `+` followed by element | Keep the left context as a pending value without emitting a rule; resolve the element with scope `(complete-left, '+')` and the owner's element subject |
| Approved extend under block | New owner for the target; subject is its single/double modifier compound; scope is the complete enclosing block selector; inherit/set extend ancestry true |

For example, the conjunction uses:

```scss
selector.append(
  selector.append('.block', '--a'),
  selector.append('.block', '--b')
)
// .block--a.block--b
```

Append operates on the subject, not on two complete ancestor-prefixed selectors.
The outer scope is composed exactly once. Adjacent resolution similarly uses
`selector.nest('.block__item', '+', '.block__other')` only when its right target
is available; no standalone trailing-combinator CSS is emitted.

## 9. Validation strategy

Classify parent/child relationships as VALID, INVALID, or DEFERRED according to
SPEC-v3 before emission. Required rejection is derived from context values:

1. Child block with inherited `under-extend: true` is INVALID regardless of the
   immediate parent. This check precedes local/deferred relationship handling.
2. Parent kind element + child element is INVALID.
3. Parent kind modifier + child modifier is INVALID.
4. Other relationships use the approved matrix and the two selector-form variants.

Entering a new element/block permits its own modifier where approved; no blanket
ban on every descendant modifier is inferred from an older modifier ancestor.
The proof's `relation()` returns classifications; test-only checks turn INVALID
into a Sass compilation error. Production wrappers must enforce the classification
before constructing/emitting a child. Error wording is not finalized here.

DEFERRED is not converted into supported CSS by the validation proofs. No code
generates top-level extend, nested extend, blocks below extend, arbitrary selectors,
or Q07. How the public implementation reports deferred usage remains unresolved.
Pairwise validation does not claim approval of Q07's complete selector outcome;
no special Q07 history-tracking field has been invented to solve that open decision.

## 10. Lexical isolation and prevention of the known leaks

Every selector operation receives its parent value explicitly; every child is a
separate derived value. No operation reads a previously completed sibling. All
emissions use the constructed full selector through the same `@at-root` boundary,
so ambient Sass selector interpolation cannot add an accidental ancestor.

H opens the outer frame once, emits an optional nested icon sibling using a child
frame, and then derives B again from the unchanged outer value. The larger case
opens the modified gigi context, emits icon and its inner modifiers/elements,
then targets pippo/test-ele from the original gigi context. This preserves the
six specified selectors without cleanup code. The tests compare B-alone with
the B portion of A+B, and also assert the specified outputs, not just equality.

This prevents stale module-state leakage within the proposed architecture.
It does not magically prevent a caller passing the wrong explicit context or
using unapproved raw Sass nesting. Opaque transport and appropriate wrapper
validation must be designed; CSS equality of `&` alone cannot verify provenance.

## 11. Proposed production module boundaries — not created

Start with two cohesive modules rather than one file per mixin:

```text
src/
  _index.scss       PUBLIC ENTRY: explicit forward allowlist only
  core/
    _bem.scss       five public mixins; private value/validation/emission helpers
```

The proposed entrypoint would forward only
`block, element, modifier, selector, extend` from `core/bem`. The remaining
selector/context helpers can initially be private members in the same cohesive
module, with Sass-private names. This keeps context derivation, validation, and
the emission boundary together and avoids publicly forwarding utilities.
An `internal/` module is unnecessary until a real shared utility boundary emerges.

Sass's [forward visibility controls](https://sass-lang.com/documentation/at-rules/forward/#controlling-visibility)
support an explicit `show` allowlist. Public wrappers remain available while
private helpers stay outside the API. If helpers are later split across modules,
do not wildcard-forward the internal module; deep-importable files should not be
mistaken for supported entrypoints. No proposed files were added to `src/`.

## 12. Risks, open questions, and validation

The main unresolved **technical/API decision** is acceptance of explicit lexical
context transport. The approved semantics are feasible without mutable module
state, but unchanged implicit invocation syntax plus reliable ancestry validation
is not established. Do not begin wrappers without resolving that contract.

Other limits:

- Literal names only were proved. Identifier validation, escaping, selector-list
  inputs, unsupported arities, and configurable separators remain unspecified.
- Q07's composite output and all other DEFERRED semantics remain unapproved.
- Raw CSS selector wrappers, user `@at-root`, context-token misuse, and whether
  to allow manual selector changes inside content need integration rules.
- Default `@at-root` removes style-rule nesting, not all enclosing at-rules.
  No at-rule/addon integration contract is established by these flat proofs.
- Future wrappers must consistently inherit ancestry metadata and pass contexts;
  the proof intentionally does not implement that production API or its ergonomics.
- Production forwarding/privacy and error-path behavior need tests once production
  modules exist. No performance conclusions are drawn from these small spikes.

Run the disposable tests with:

```sh
node --test spikes/selector-engine/spikes.test.js
```

The detailed run in this managed environment uses
`--experimental-test-isolation=none` before the test path, exposing individual
results; each Sass compilation is still fresh. Existing `npm test`,
`npm run test:legacy`, and `npm run test:characterization` must remain green.
No dependency installation or legacy/artifact changes are required.

Completed validation: **27/27 spike tests passed**, with no spike warnings;
`npm test`, `npm run test:legacy`, and `npm run test:characterization` all passed.
The detailed characterization run confirmed **58/58** passing tests. Existing
v2 `if-function` warnings remain visible in that run. Logs are under ignored
`tmp/selector-spikes.log` and `tmp/design-v3-*.log`. Integrity checks confirmed
that characterization artifacts, historical evidence documents, legacy sources,
dependency metadata, and the unimplemented `src/` tree were unchanged.

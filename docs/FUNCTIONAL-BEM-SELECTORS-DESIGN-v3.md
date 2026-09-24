# BEM-aware functional selectors: design and API spike

Status: **proposal and executable feasibility evidence, not API approval**.
Production support is not implemented. This investigation does not change the
selector parser, context schema, relationships, exports or performance behavior.

## Recommendation

Start with **A: only `has()`**, for one same-owner element target:

```scss
@include has($type: element, $name: 'details', $relation: '+') { /* styles */ }
// Preferred everyday spelling:
@include has(element, 'details', $relation: '+') { /* styles */ }
```

Proposed signature: `has($type, $name, $relation: null)`. Initially `$type` accepts
only `element`; `null` means descendant, with `>`, `+`, and `~` also supported.
All four relations have the same construction and validation cost and demonstrated
meaning (contained details, direct child details, adjacent details, later details).
Do not add a `$modifier` parameter in the first feature.

Use a small pure private target builder within that feature, not a separately
shipped builder project (option D). The anchor does not require B, `has + not`,
or C, all four. Those would add own-subject provenance and list policies before
they are needed. Keep the other three as designed candidates:

| Future mixin signature | Target contract | Example |
| --- | --- | --- |
| `not($type, $name)` | own modifier; scalar or homogeneous nonempty list | `not(modifier, 'disabled')` |
| `is($type, $name)` | own modifier; scalar or homogeneous nonempty list | `is(modifier, ('compact', 'dense'))` |
| `where($type, $name)` | own modifier; scalar or homogeneous nonempty list | `where(modifier, 'compact')` |

Here `$type` accepts only `modifier`. Keep `$name` consistent across mixins and
document that filters can take a list of names. No `$relation` on filters, no raw
selector argument, and no speculative optional parameters. These signatures
are recommendations for a later approved feature, not new production contracts.

**List support in v1:** no multi-target `has()` in the first production feature.
When filtering mixins are introduced, support homogeneous modifier-name lists
from their first release: the spike demonstrates that this is small and gives
`is()` its principal usefulness. Defer heterogeneous target lists entirely.

## Problem and real usage

The thumbnail of a game card loses its lower rounded corners when followed by
the same card's details element. Writing `&:has(+ .game-card__details)` embeds
both an owner and its separator in consumer code. Renaming the owner or changing
the configured separator can then silently break the relationship. Raw Sass
qualification also does not update BEMinator's context for later BEM re-entry.

The primary candidate, executed in the spike with all surrounding declarations:

```scss
@include block('game-card', $layer: 'molecules') {
  display: flex;
  flex-direction: column;
  height: 100%;

  @include element('thumbnail') {
    border-radius: 12px;
    overflow: hidden;
    position: relative;

    @include has(element, 'details', $relation: '+') {
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
    }
  }
}
```

The relevant output is inside `@layer molecules`:

```css
.game-card__thumbnail:has(+ .game-card__details) {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}
```

The naming owner supplies `.game-card`, the configured separator supplies `__`,
and the argument supplies `details`. No owner is discovered from serialized `&`.
The current local subject supplies the left side of `:has()`.

## Two semantic families

`has` constructs a target related to the current subject. A modifier of the
current subject and a modifier of a related element are different requests.
The user must identify that related element; `has(modifier, 'active')` should
not silently choose the block, current element, or any active element.

`not`, `is`, and `where` qualify the current subject itself. Defining `modifier`
as **the direct subject's own modifier** makes `.card:not(.card--disabled)` and
`.card__item:not(.card__item--disabled)` unambiguous. The base class remains in
the outer selector, so these expressions require that base class in the DOM;
production `modifier()` normally replaces it with the modified class. This is
a meaningful consumer markup requirement, not a reason to reject the API.

`:is()` offers alternatives; `:not()` excludes every listed alternative;
`:where()` offers the same matching alternatives with zero specificity for its
argument. For these class-only examples, `.card:where(.card--compact)` retains
specificity `(0,1,0)`, while `.card:is(.card--compact, .card--dense)` has `(0,2,0)`.
The outer `.card` is never made zero-specificity. Nested `:has()` inside a
`:has()` argument is invalid. These are native CSS rules, not library rewrites.
See [Selectors Level 4: relational pseudo](https://www.w3.org/TR/selectors-4/#relational)
and [specificity](https://www.w3.org/TR/selectors-4/#specificity-rules).

`where()` is useful for defaults conditioned on a state class which should
remain easy to override. It is not merely an alias for `is()`. Single-target
`is()` is expressible but offers little over an ordinary class conjunction;
shipping it alone would omit the strongest use case.

## Private target model

A shared private **concept** is viable: a pure function takes explicit context,
target kind, validated name, and configured separators, and returns a native
Sass selector. It does not emit CSS or read/write the stack. Separate pseudo
policy decides whether that target is appropriate before constructing a qualifier.

| Conceptual descriptor | Construction | Availability and value |
| --- | --- | --- |
| element + name | append element suffix to `owner` | clear same-owner target; first feature |
| block + name | parse class from validated name | independent component presence, e.g. footer; useful but not needed for anchor |
| own modifier + name | append modifier suffix to direct `subject` | clear only for direct block/element filtering |
| element + name + modifier | owner → element suffix → modifier suffix | useful selected-item presence, `.card:has(.card__item--selected)` |
| block + name + modifier | named block → modifier suffix | constructible, but additional scope beyond anchor |

The experiment uses function arguments; that is not a decision to expose maps,
tuples or descriptors. A private map might become worthwhile with more target
variants, but is unnecessary for one target. Relation belongs to `has` argument
assembly, not to the BEM target's identity. List assembly belongs to filter
policy, not to the single-target builder. Sharing construction does not require
identical public signatures or identical allowed target kinds.

`has(block, 'footer')` and `has(block, 'footer', $relation: '+')` can yield
`.card:has(.footer)` and `.card:has(+ .footer)` without any provenance recovery.
Defer their API support for first-feature focus, not because they violate BEM.

`has(element, 'item', $modifier: 'selected')` reads clearly and represents a
useful later extension. The experiment proves it, including custom separators.
Do not approve the parameter yet: decide separately whether one modified class
or a base-and-modifier conjunction is the desired documented target. The
experiment uses the single modified class, consistent with current modifier
emission. Multi-modifier conjunctions on a target are deferred.

`has(modifier, 'active')` is not mathematically impossible. A convention such as
“a related instance of the direct subject with this modifier” could resolve it
at a direct block/element. But that convention is not supplied by the call and
would fail uniformly across modifier/qualified origins. Classify the unspecified
relational intent as AMBIGUOUS; do not claim direct frames lack all provenance.
Prefer an explicit named element/block target if this use case is requested.

## Context audit and provenance

The audited production file is `src/core/_bem.scss`, SHA-256
`7379354cda28ad2ae5a002f441a75d548ecc2b8aa76166cc5355be4ce4edf5be`.

| Fact | Relevant guarantee |
| --- | --- |
| `owner` | native selector created from a validated block/extend name; retained across element, modifier and qualified frames |
| `subject` | local current selector; direct block/element subjects are known base classes, later subjects may be modified/qualified |
| `scope` | ancestors applied at completion, not part of target names |
| `kind` | immediate role only; no original base role on modifier/qualified frames |
| `under-extend` | inherited ancestry restriction; remains intact |
| `relation` | only on pending frames; an unfinished outer relationship, unrelated to the inner `has` relation |

Same-owner element construction needs `owner`, not the original role of
`subject`. Therefore `has(element, ...)` can qualify direct block, element,
modifier (including two modifiers), and qualified subjects. In particular,
`.card:has(+ .card__details)` is a valid candidate. No DOM-structure orthodoxy
rule should prohibit it.

Own-modifier filtering needs a known unmodified base subject. That exists at
direct `block` and `element` frames, even with outer scope or extend ancestry.
It does not exist generically at `modifier` or `qualified`. Their owner cannot
substitute for the missing element base; suffixing their current subject can
create the wrong target. Do not strip suffixes, remove pseudo tokens, scan the
stack for an ancestor, or infer base role from class text. Even a qualified frame
known to a human to originate from a block stays deferred under the uniform API.

Direct `extend → qualified` remains deferred by the existing transition table.
Its owner is available, so this is an existing relationship boundary, not an
inherent impossibility. `extend → element → has` works with the extend target
owner, e.g. `.card .icon--active .icon__label:has(.icon__details)`. An element
there can also build its own filter target. All descendants retain
`under-extend`; nested blocks beneath extend remain forbidden.

A pending outer relation has no completed new subject to qualify. Keep it
deferred until an element resolves it. A root has no subject at all: invalid.
No new context fields or mutable globals are required for any proposed valid row.

## Decision matrix

VALID CANDIDATE means semantically safe and eligible for later approval, not
implemented. UNSUPPORTED/DEFERRED distinguishes unavailable provenance, existing
relationship restrictions, and optional first-feature exclusions in the notes.
`*` below means an otherwise supported completed parent; it never overrides
root, pending, extend or pseudo-element restrictions.

| Pseudo | Parent | Target | Status | Reason / first-feature scope |
| --- | --- | --- | --- | --- |
| has | block | same-owner element | VALID CANDIDATE | owner sufficient; include |
| has | element | same-owner element | VALID CANDIDATE | anchor; include |
| has | modifier | same-owner element | VALID CANDIDATE | owner survives; include |
| has | qualified | same-owner element | VALID CANDIDATE | origin unnecessary; include for element subjects without pseudo-elements |
| has | extend | element | UNSUPPORTED/DEFERRED | existing direct qualification gate |
| has | pending-relation | element | UNSUPPORTED/DEFERRED | resolve outer relation first |
| has | root | any | INVALID | no subject |
| has | * | block | VALID CANDIDATE | explicit identity; defer from first feature for scope |
| has | * | modifier alone | AMBIGUOUS | related base target unspecified |
| has | * | element + modifier | VALID CANDIDATE | useful selected-item case; syntax deferred from first feature |
| has | * | block + modifier | VALID CANDIDATE | explicit identity; deferred from first feature |
| not | block | own modifier | VALID CANDIDATE | direct base subject |
| not | element | own modifier | VALID CANDIDATE | direct base subject |
| not | qualified | modifier | UNSUPPORTED/DEFERRED | unmodified subject unavailable |
| not | modifier | own modifier | UNSUPPORTED/DEFERRED | base unavailable; do not append another suffix |
| is | block | own modifier(s) | VALID CANDIDATE | list adds useful alternatives |
| is | element | own modifier(s) | VALID CANDIDATE | direct base subject |
| where | block | own modifier(s) | VALID CANDIDATE | lower-specificity condition |
| where | element | own modifier(s) | VALID CANDIDATE | direct base subject |
| is / where | qualified / modifier | own modifier(s) | UNSUPPORTED/DEFERRED | no separate base subject |
| not / is / where | extend / pending-relation | own modifier(s) | UNSUPPORTED/DEFERRED | current qualification gate and/or unresolved subject |
| not / is / where | root | any | INVALID | no subject |
| all | extend → element | supported target for that pseudo | VALID CANDIDATE | direct element plus retained owner and ancestry |
| filters | block / element | explicit other block/element | UNSUPPORTED/DEFERRED | co-class filtering is constructible, but outside demonstrated own-state cases |
| has | qualified pseudo-element | same-owner element | INVALID | pseudo-element cannot be the has anchor |
| filters | qualified pseudo-element | own modifier | UNSUPPORTED/DEFERRED | no known base, no general pseudo-element policy |
| has | * | nested has argument | INVALID | CSS restriction; no target syntax supplied |
| is | block / element | only one modifier, as sole feature scope | NOT USEFUL | technically valid; too little value to motivate a separate scalar-only rollout |

Unusual BEM layouts are not errors. Future explicit co-class filtering may be
useful and is not ruled out on BEM-style grounds. No unrelated deferred
relationships are reopened by this matrix.

## Qualified frame reuse and ordering

Construct a native pseudo qualifier and pass it to existing qualified derivation:

```text
new subject = selector.append(parent.subject, constructed pseudo)
owner, scope, under-extend = unchanged
kind = qualified
```

Use the existing entry/emission boundary and its saved stack restoration. Do not
route generated pseudos through the public `selector()` parser, which deliberately
rejects functional pseudos. A trusted private construction path is distinct from
accepting arbitrary new public selector strings. No distinct private kind is needed.

| Composition | Exact selector / decision |
| --- | --- |
| thumbnail → has(element, details, +) → selector(:hover) | `.game-card__thumbnail:has(+ .game-card__details):hover` |
| thumbnail → selector(:hover) → has(element, details, +) | `.game-card__thumbnail:hover:has(+ .game-card__details)` |
| block(card) → has(element, details) → element(title) | `.card:has(.card__details) .card__title` |
| block(card) → not(modifier, disabled) → selector(:hover) | `.card:not(.card--disabled):hover` |
| block(card) → is(modifier, (compact, dense)) → selector(:hover) | `.card:is(.card--compact, .card--dense):hover` |
| block(card) → where(modifier, compact) → selector(:hover) | `.card:where(.card--compact):hover` |
| block/element → selector(:hover) → own-modifier filter | UNSUPPORTED/DEFERRED; apply filter before qualification |
| modifier → own-modifier filter | UNSUPPORTED/DEFERRED; no recovered base |

Both `has` orders are safe because owner survives qualification; they have the
same matching meaning in these examples. Filters must precede `selector()` or
another qualifying operation. This documented ordering is preferable to adding
base-subject provenance. Ordinary pseudo-elements are an exception to arbitrary
qualifier commutation: `has → ::before` qualifies the element then selects its
pseudo-element; `::before → has` is invalid, not an alternative order.

BEM re-entry uses existing qualified scope propagation: deriving an element
promotes the completed qualified parent into scope once, and constructs the new
element from owner. The same rule applies after all four pseudos. Outer ancestors
remain outside functional arguments; `.page` must not leak into `.card__details`.
The experiment checks exact frame equality and restoration, sibling output,
outer scope, custom separators, layers and extend ancestry.

This does not approve general pseudo nesting. Appending separate qualifications
to one subject is distinct from nesting a pseudo inside another pseudo's
argument. No arbitrary functional-argument construction is exposed. Existing
qualified re-entry rules remain the only descendants; direct modifier, pending
relation and extend children are still deferred.

## API ergonomics: all four anchors

The following bodies are placed inside `block('game-card') → element('thumbnail')`
for the first row, and `block('card')` for the other rows. Each body includes the
declarations to emit in its content block.

### A: explicit pseudo mixins, positional targets

```scss
@include has(element, 'details', $relation: '+') { color: red; }
@include not(modifier, 'disabled') { color: red; }
@include is(modifier, ('compact', 'dense')) { color: red; }
@include where(modifier, 'compact') { color: red; }
```

These correspond exactly to the four requested selectors. Readable native names,
little syntax, explicit target category, no inferred relational base. A pure
builder and thin pseudo-specific policies suffice. Later named target modifiers
can be considered without redefining the type/name positions. **Recommended.**

### B: named target arguments

```scss
@include has($type: element, $name: 'details', $relation: '+') { color: red; }
@include not($type: modifier, $name: 'disabled') { color: red; }
@include is($type: modifier, $name: ('compact', 'dense')) { color: red; }
@include where($type: modifier, $name: 'compact') { color: red; }
```

Equivalent code, with exactly the same tested output. Helpful in long calls,
but verbose for short BEM phrases. This is already Sass keyword syntax for A,
not a separate API or implementation. Parameter names become compatibility
commitments. Prefer A's positional identity and named relation in examples.

### C: generic functional condition

```scss
@include condition('has', element, 'details', $relation: '+') { color: red; }
@include condition('not', modifier, 'disabled') { color: red; }
@include condition('is', modifier, ('compact', 'dense')) { color: red; }
@include condition('where', modifier, 'compact') { color: red; }
```

Exact equivalent output is tested. Feasible, but adds an argument and a generic
name to every call. It implies a uniform argument space where relations actually
belong only to has, and admits invalid pseudo/target/option combinations requiring
runtime validation. New pseudos would grow that conditional interface. Useful
as an experimental private dispatcher, weaker as the public API.

### D: content-driven targets

```scss
@include has('+') { @include element('details'); }
@include not() { @include modifier('disabled'); }
// Hypothetical capture syntax, not working alternatives:
@include is() { @include modifier('compact'); @include modifier('dense'); }
@include where() { @include modifier('compact'); }
```

These do **not** have equivalent executable code under the current architecture.
The single content block is consumed by target declarations, leaving no separate
place for the styles to emit. Existing element/modifier mixins enter the BEM
emission boundary and restore the stack; they do not return target values.
Empty calls yield no capturable target. Normal `element` under an element is
also invalid, so the anchor would already require a changed meaning in this mode.

Sass content executes in caller lexical scope; a callee-local capture variable
cannot turn ordinary target mixins into returned values. Sass functions can
return selectors but cannot execute these CSS-emitting mixins as a value factory.
See [Sass content blocks](https://sass-lang.com/documentation/at-rules/mixin/#content-blocks)
and [functions](https://sass-lang.com/documentation/at-rules/function/).

Even reusing the single stack for a capture sentinel needs a capture mode,
emission suppression and contextual reinterpretation of existing mixins. A
second mutable global is not the only problematic cost. Callback/`using` syntax
could pass explicit values, but would replace these calls with a different,
more verbose function API and still need a styling-body convention. Parsing
emitted CSS is out of scope. D's apparent brevity does not justify these costs;
no implementation was attempted.

## Lists without a mini-DSL

`is(modifier, ('compact', 'dense'))` is an ordinary Sass comma list in one
argument. Normalize a scalar to one item, validate every name, reject empty/nested
lists, and build each target from the same direct base subject. Quoted names
avoid accidental Sass value types. Prefer documenting comma lists; no special
list parser is needed (the feasibility loop also accepts space lists).

`is(modifier, 'compact', 'dense')` could use varargs but complicates optional
arguments and suggests parity with existing two-modifier conjunction semantics.
In contrast, `(compact, dense)` explicitly conveys alternatives. Existing
`modifier('compact', 'dense')` means conjunction, not this list's OR.

The conceptual `is(modifier: (...))` is not Sass keyword-argument syntax. It
would require a map `is((modifier: (...)))` or an actual `$modifier:` parameter.
Both introduce a second target encoding without a demonstrated benefit. Repeated
tuples/maps would allow heterogeneous targets but create a mini-language; defer.

Repeated `is` calls qualify conjunctively, so they are not an OR substitute.
Sibling calls duplicate rules rather than creating the requested functional
selector. Multiple `not` qualifications may have equivalent exclusion matching
but different specificity from one list. Do not rewrite lists as multiple calls.

## Dart Sass 1.104.1 findings and validation ownership

All outputs below are executable observations in `probes.test.js`, not assumptions
about browsers. Native selector operations are described in the
[official Sass selector module](https://sass-lang.com/documentation/modules/selector/).

| Primitive | Observed result | Role |
| --- | --- | --- |
| `parse(':has(+ .card__details)')` | native selector containing `:has(+ .card__details)` | validate/construct controlled pseudo |
| `append('.card', '__details')` | `.card__details` | BEM suffix from known owner |
| `nest('+', '.card__details')` | `+ .card__details` | relative argument without fake anchor |
| `append('.card', ':where(.card--compact)')` | `.card:where(.card--compact)` | local qualification, preserves pseudo |
| `nest(scope..., subject)` | existing complete selector | emission and re-entry, not argument ownership |
| `replace('.card:hover', '.card', '.tile')` | `.tile:hover` | works but unnecessary; do not use for provenance |
| `unify('.card', '.card--compact')` | `.card.card--compact` | conjunction, not pseudo alternatives; unnecessary |
| `simple-selectors('.card:has(+ .card__details)')` | `.card`, `:has(+ .card__details)` | whole pseudo token, not parsed inner provenance |

Native `parse`, `append`, and `nest` are sufficient for selector construction.
Sass has no needed dedicated functional-pseudo constructor here: controlled
interpolation serializes the known target selector into `:has(...)` etc., then
native parsing supplies the selector value. This is creation, not inspection or
reverse engineering of arbitrary selectors. Native comma-list values retain
alternatives inside one pseudo; appending the target list directly to the outer
subject instead would create an outer selector list with different meaning.

The native experiment also records that Sass accepts `:has(:has(.x))` and
`.card::before:has(.x)`. It rejects malformed `:has(`. Consequently:

- BEMinator owns target kind/name, allowed relation, available provenance,
  supported composition and deliberately narrow target grammar.
- Sass owns selector parsing and serialization wherever possible. Sass
  acceptance does not guarantee browser-valid selectors or matching DOM nodes.
- CSS semantic restrictions still constrain the API. Controlled BEM targets
  cannot contain pseudos or nested has. A qualified pseudo-element parent needs
  an explicit rejection for has. The experiment inspects native simple tokens
  for `::` and legacy `:before/:after/:first-line/:first-letter`; it never
  recovers ownership and never changes the existing selector parser.
- The experiment conservatively rejects pseudo-element parents for all four;
  it is not a complete CSS validator or approval of all pseudo-element filters.
  Future implementation must specify that narrow gate, including any accepted
  escaped spelling, without building a CSS parser.

`has`, `not`, `is`, and `where` all compile as mixin names, including qualified
calls `bem.not(...)`. The SassScript `not` operator is not a collision in this
mixin position. Generic dispatch quotes `'not'` as a value. Native CSS names are
clearer than `has-bem`/`not-bem`, which repeat the library's purpose, `matches`,
which obscures is, or `zero-specificity`, which falsely suggests the outer
selector loses specificity. Use module namespaces to handle consumer name
collisions. Sass mixin naming and keywords are documented in
[the mixin reference](https://sass-lang.com/documentation/at-rules/mixin/).

## Isolated evidence and production integrity

Files added:

- This document.
- `spikes/functional-bem-selectors/_experiment.scss`: test-only pure target and
  qualifier functions, candidate A/B/C wrappers, frame/restoration assertions.
- `spikes/functional-bem-selectors/game-card.scss`: complete primary fixture.
- `spikes/functional-bem-selectors/probes.test.js`: pinned compiler/source guard,
  exact selector output and bounded semantic/composition probes.
- `spikes/functional-bem-selectors/README.md`: execution and isolation notes.

The runner loads the unchanged production source and appends the experiment
fragment **in memory only**, through a custom importer. It neither writes nor
patches production source. Existing private derive/enter/validation functions
remain exactly as read, including the selector parser. The fragment has no
mutable global and no emission boundary: all experimental calls reuse the one
existing stack and boundary. It is not a new production entrypoint or public API.

Run with Node 22.19.0 (the shell's default Node 16 is below this project's engine):

```sh
node --test --experimental-test-isolation=none spikes/functional-bem-selectors/probes.test.js
npm test
git diff --check
sha256sum src/core/_bem.scss
```

Verified: **11 isolated spike tests pass**, including grouped relation/parent
and API-spelling cases. `npm test` passes. The core hash is unchanged at the
value recorded above. `git diff --check` passes, with new-file whitespace checked
separately. Existing tests, compiler helpers, package metadata, dependencies and
all production files remain unchanged. No legacy harness change, snapshot update,
performance benchmark or optimization was made.

Deferred: production implementation/approval, block and modified-element targets,
filter rollout, heterogeneous/relative target lists, additional own-base provenance,
general functional nesting, arbitrary CSS targets, direct extend qualification,
pending-relation qualification, unrelated relationship expansion, and browser
conformance testing beyond the documented native CSS semantics. Passing spike
experiments does not approve these as v3 requirements.

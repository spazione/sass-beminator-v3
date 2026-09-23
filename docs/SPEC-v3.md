# Sass BEMinator v3 — intentional behavior specification

This specification records the maintainer-approved initial core semantics.
It specifies observable selectors, nesting validity, and isolation, not how to
implement them. The approved subset is implemented in production; later
maintainer approvals below include the structural selector model. The
[adopted stability contract](CORE-STABILITY-v3.md) closes D03/D05/D08/D09/D10/D11
without broadening these semantics. The core API is stable; publication has not
been performed.

Authority and evidence:

- [Decision record](V3-BEHAVIOR-REVIEW.md): intentional PRESERVE / CHANGE /
  REJECT / DEFER dispositions.
- [Historical characterization](CHARACTERIZATION-v2.md): v2 observations, including
  bugs and permissive nesting that this specification rejects.
- [Compiler baseline](COMPILER-BASELINE-v2.md): identical behavior for all 79
  inputs under Sass 1.104.1 and 1.83.4. Compiler agreement does not approve a bug.

Existing characterization artifacts remain historical evidence. In particular,
their known-leak assertions and permissive ERROR-case snapshots are not v3
acceptance criteria. Future v3 tests must express the decisions below separately.

## Scope and notation

The stable public core is `block`, `element`, `modifier`, `selector`, `extend`,
and the ordering mixin `css-layers`. Examples use conceptual calls such as `block('a') → element('item')`;
the exact public signatures and exports are fixed in the adopted stability contract. `→` means lexical nesting, not consecutive
sibling invocations. Separate consecutive calls are siblings unless nested.

The default BEM separators are `__` for elements and `--` for modifiers.
The approved load-time configuration accepts nonempty strings containing only
`-` and `_`, including equal separators; consumers own naming collisions.
See PRODUCTION-v3 for usage and the Sass explicit-null/default limitation.
Descendant composition, same-element class conjunction, and the pending
relations `+`, `>`, `~` are distinct semantics and must not be interchanged. Preserve the selectors, declaration
values, and semantically relevant rule ordering of the approved examples.
This does not prescribe incidental whitespace or serialization formatting.

Themed buttons, Atomic Design helpers, project-specific paths/conventions, and
Eurobet-specific behavior are excluded from the core; if retained, they belong
to future plugins/presets. Optional flat CSS Layers are approved as specified below.
Legacy automatic theme/path discovery and its injection plumbing are retired;
theme loading belongs outside BEMinator. Historical `atoms` wrappers and theme
options do not become core requirements through the selector fixtures.

## Optional flat CSS Layers

The public block signature is `block($name, $layer: null)`. A non-null selection
must be a configured top-level name in the ordered `$css-layers` map; it wraps
the complete root block subtree in that layer without changing BEM selectors.
Null/omitted adds no wrapper and does not escape an existing lexical layer.
Nested blocks inherit naturally, but explicit non-null layer selection on any
nested BEM block is rejected, even beneath an unlayered root. Blocks beneath
extend remain invalid regardless of layer selection.

The registry is a nonempty load-time Sass map. Values have no semantics and nested
values are not interpreted. Keys are case-sensitive evaluated strings using the
conservative ASCII name domain documented in PRODUCTION-v3; reserved keywords,
empty names, whitespace, dots, commas, arbitrary CSS, and non-strings are rejected.
Quoted/unquoted equivalent strings match. Duplicate normalized names are invalid;
Sass may diagnose duplicates before module validation. Explicit null configuration
is subject to Sass's documented default substitution. Unknown selection is an error.

`css-layers()` emits configured top-level key order at its call site. No ordering
CSS is automatic; repeats emit repeats. Consumers may instead write the statement
manually. Final order must precede layered CSS; external framework/bundler ordering
is outside BEMinator's guarantee. There is no mutable layer/order state.

Layer propagation through `@media`, `@supports`, and `@container` is approved in
both lexical wrapper orders, including conditional wrappers around pending RHS
elements. This does not approve raw selector re-entry or arbitrary at-rules.
See [PRODUCTION-v3](PRODUCTION-v3.md#optional-css-layers) for configuration,
exact signatures, validation domain, examples, and integration responsibilities.

## Nesting contract

- **VALID**: approved relationship in the stated supported context.
- **INVALID**: reject during compilation; do not silently accept the nesting or
  produce a successful CSS result for it. Semantic failure categories are stable;
  exact diagnostic text and Sass-owned diagnostics are not public API.
- **UNSUPPORTED / DEFERRED**: outside the stable API, with no future semantics
  or implementation promised. Production rejects these matrix calls today.
  No matrix completion is required for core stability.

“Parent” is the nearest enclosing public core mixin. A plain declaration or Sass
control-flow construct does not establish a new public parent. VALID entries
assume valid ancestors and the named arguments/forms specified below.

| Parent ↓ / child → | block | element | modifier | selector | extend |
| --- | --- | --- | --- | --- | --- |
| Top level | VALID | DEFERRED | DEFERRED | DEFERRED | DEFERRED |
| block | VALID | VALID | VALID | VALID¹ | VALID |
| element | DEFERRED | INVALID | VALID | VALID¹ | DEFERRED |
| modifier | VALID² | VALID | INVALID | VALID¹ | DEFERRED |
| qualified selector | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED |
| pending-relation selector | DEFERRED | VALID¹ | DEFERRED | DEFERRED | DEFERRED |
| extend | INVALID³ | VALID | DEFERRED | DEFERRED | DEFERRED |

1. Qualified compounds are valid under block, element, and modifier. Pending
   relations `+`, `>`, `~` are valid only under element, with element children.
   Qualified bodies support declarations, not public BEM children. Multiple
   qualifier tokens in one call are not selector-context chaining; nested selector
   calls remain DEFERRED. See the structural input contract below.
2. Includes the approved historical `block → element → modifier → block`
   composition. A later modifier inside that block targets the inner block.
3. A block is INVALID **anywhere beneath an extend**, even with intervening
   public mixins. This ancestor prohibition overrides other matrix entries.
   Thus `block → extend → block`, `extend → block`,
   `extend → extend → block`, and `extend → block → block` are all INVALID.
   A deferred ancestor does not weaken an explicit prohibition.

Direct `element → element` and direct `modifier → modifier` are INVALID.
An intervening approved element, block, or selector relationship is meaningful:
`element → modifier → element`, `modifier → element → modifier`, and
`modifier → block → modifier` are not the rejected direct nesting forms.
Rejecting every path with any outer modifier would contradict the approved
historical regression. The same distinction allows the tested
`element → selector('+') → element` despite direct element nesting being invalid.

The matrix is not blanket approval of every composite selector outcome.
Q07's complete commented combination has no approved whole-output contract;
its individually approved relationships are not revoked. Q07 remains archival
evidence outside the stable contract, not a release-blocking decision. No runtime
history detector rejects otherwise valid primitive compositions. Additional
ordinary block depths and equal-name nesting are explicitly approved, however.

## Core invariant: lexical/context isolation

**A completed sibling mixin invocation must not alter the selector generated
by a subsequent sibling invocation under the same public lexical ancestors.**

For valid A and B in the same public ancestor context, the rules attributable to
B in `A; B` must have the same selectors as B alone in that context. B retains
its declared values and its own meaningful rule order. A may emit its own CSS;
this invariant does not claim that adding A leaves the whole stylesheet or its
cascade unchanged. Returning from a nested call must likewise leave later
sibling calls governed by their enclosing public context.

The invariant applies to all five BEM composition mixins and independent top-level
calls. The stateless ordering mixin does not alter their context.
Names, modifier targeting, combinators, and ancestor scope may not depend on
previous completed siblings. It is an observable guarantee only.

Required correction C02:

```text
block('standard-object') → element('after')
  .standard-object__after

block('standard-object') {
  block('icon') { ... }
  element('after') { ... }
}
  the later element still selects .standard-object__after
```

The later element must not acquire `.standard-object` as an ancestor. The v2
leak changes matching and specificity from `(0,1,0)` to `(0,2,0)` and is CHANGE.

Required correction C03: placing the preceding sibling icon block before the
complete historical regression must not add `.standard-object` to any of its
six selectors. In either sequence, that regression selects, in order:

```css
.standard-object__gigi--fatherdMod .icon
.standard-object__gigi--fatherdMod .icon--mod
.standard-object__gigi--fatherdMod .icon__nested-element--nestedMod
.standard-object__gigi--fatherdMod .standard-object__pippo
.standard-object__gigi--fatherdMod .standard-object__pippo--mod
.standard-object__gigi--fatherdMod .standard-object__test-ele
```

This is a selector list for reference, not a comma-separated CSS rule. Preserve
the corresponding identifying declarations from the isolated regression. The
historical full-sequence snapshot stays unchanged as evidence of v2's bug.

Evidence: review C01–C03; `state-isolation/sibling-element-after-block`,
`state-isolation/regression-after-sibling-block`, `regression/complete`,
`regression/historical-active-sequence`, and `regression/sibling-elements`.

## block

**Purpose:** declare a named component and compose nested components by descendant
relationship. Standalone `block('a')` selects `.a`.

**Valid parents:** top level, another block, or the approved contextual modifier
composition. A block directly under an element or selector is DEFERRED. Any
extend ancestor makes it INVALID.

**Valid children:** block, element, modifier, and the approved single/double
extend forms, plus qualified selectors. Pending relations under block are DEFERRED.

**Selector semantics:**

- `block('a') → block('b')` selects `.a .b`.
- Composition may continue: `block('a') → block('b') → block('c')` selects
  `.a .b .c`.
- Names need not differ: `block('icon') → block('icon')` legitimately selects
  `.icon .icon`. No special same-name prohibition or special feature is implied.
- Inside `block('a') → block('b')`, a modifier on b selects `.a .b--m`;
  an element x with modifier m selects `.a .b__x--m`.
- Under a contextual modified element, the nested component is a descendant:
  `block('a') → element('item') → modifier('m') → block('b')` selects
  `.a__item--m .b`. Its own elements use the b naming base.
- Repeated independent top-level block declarations are supported. Later calls
  with the same name are independent; they do not inherit earlier inner names,
  modifiers, or ancestor requirements.

**Isolation:** completing an inner block must not add its name or its enclosing
block selector to subsequent siblings; the core invariant applies. In the
regression, closing icon leaves later pippo/test-ele named for standard-object.

**Invalid nesting:** any block beneath extend. Other unapproved parent/child
relations remain DEFERRED as shown in the matrix.

Evidence: B01–B05, Q06; `core/block/basic`, `core/combinations/block-block`,
`core/combinations/element-modifier-block`, both `nested-block-*` fixtures,
`core/element/subsequent-block`, and `exploratory/block-block-block`.

## element

**Purpose:** select a named element belonging to the current public component,
with the explicitly enclosing contextual relationships.

**Valid parents:** block, modifier, approved extend, or a pending-relation
selector (`+`, `>`, `~`). **Valid children:** modifier and both structural selector families.
Direct child element is INVALID; block and extend children are DEFERRED.

**Selector semantics:**

- `block('a') → element('item')` selects `.a__item`, without a required `.a`
  ancestor. Under a nested b component in a, its element selects `.a .b__item`.
- `block('a') → modifier('m') → element('item')` selects
  `.a--m .a__item`.
- `block('a') → element('item') → modifier('m') → element('other')` selects
  `.a__item--m .a__other`. The second element belongs to a, not to a new
  `a__item__other` naming hierarchy.
- With two modifiers in the enclosing invocation, the same element relationship
  follows their conjunctive selector, e.g. `.a--x.a--y .a__item`.
- Under extend, the element uses the extended component's name and retains the
  extend modifier scope; see the extend contract.

**Invalid nesting:** direct `element → element` must fail rather than emit v2's
duplicate element rules. An intervening valid modifier or tested selector does
not constitute direct element nesting.

**Isolation:** subsequent elements depend only on their lexical/public ancestors,
including after nested blocks or contextual operations complete. C02/C03 apply.

Evidence: E01–E02, N01; `core/element/basic`, the four
`core/modifier/*-element` cases, `core/selector/adjacent-element`, and both
`invalid/block-element-element*` cases.

## modifier

**Purpose:** qualify the targeted component or element with one modifier class,
or a conjunction of two modifier classes on the same target.

**Valid parents:** block or element, including an inner block/element reached
through the approved regression nesting. **Valid children:** element or nested
block composition, or qualified selector. Direct child modifier is INVALID;
pending relations, extend children, and modifier directly under extend remain DEFERRED.

**Selector semantics:** one modifier yields `.a--m` on block a or `.a__item--m`
on its element. A nested block preserves its outer composition, e.g.
`.a .b--m`. Two arguments in one invocation require both classes on the same
target, in argument order:

```text
VALID: block('card') → modifier('a', 'b')
  .card--a.card--b

VALID: block('card') → element('item') → modifier('a', 'b')
  .card__item--a.card__item--b

INVALID: modifier('a') { modifier('b') { ... } }
  direct nested modifier calls must fail compilation
```

The double-argument form is not a chained `.card--a--b` suffix and not a
descendant selector. Nested calls cannot be used as an alternative way to
request this conjunction. Modifier → element descendant semantics are specified
under element; an intervening element/block permits its own modifier target.

**Isolation:** a completed modifier cannot affect later unmodified siblings or
change the target or scope of their modifiers. Applicable outer lexical
relationships remain in force when an inner call completes.

Evidence: M01–M03, E02, N02; `core/modifier/block-single`, `element-single`,
`block-double`, `element-double`, both `invalid/block-modifier-modifier*`
cases, and the complete historical regression.

## selector

`selector($name)` requires a Sass string in one of two approved structural families.

### Qualified compound

A qualifier appends to the current subject, retaining BEM owner, enclosing scope,
and extend ancestry. Valid parents are **block, element, modifier**, including an
already-valid element descendant of extend. Examples:

```css
.button:hover
.button:focus:hover
.card__button:focus-visible
.card__button--active[disabled]:hover
.card .icon--large .icon__label:hover
```

The input must parse as exactly **one complex selector containing one compound**,
with **one or more simple selectors**, every one either a non-functional pseudo
or an attribute selector. Sass owns parsing; normalized simple-token family
checks impose this subset without a pseudo-name registry or attribute grammar.

Approved examples include `:hover`, `:focus`, `:focus-visible`, `:active`,
`:disabled`, `:before`, `:after`, `::before`, `::after`, `[disabled]`,
`[data-state="open"]`, `:hover:focus`, `:focus-visible:hover`,
`:placeholder:hover`, `:focus::before`, `[disabled]:hover`,
`[data-state="open"]:focus`, and `:hover[aria-expanded="true"]`.
Punctuation inside a valid attribute value is literal data, not BEM selector syntax.

BEMinator validates the **supported structural family**, not browser support,
element applicability, usefulness of combinations, or every CSS specification's
pseudo-element ordering. Unknown syntactically accepted non-functional pseudos
such as `:made-up` are allowed. Preserve `:before` versus `::before`; Sass may
normalize other equivalent serialization, including attribute quotes and escapes.

Bodies support declarations. All public BEM children beneath qualified contexts
remain **DEFERRED**, including selector → selector. A compound `:hover:focus`
in **one call** is approved; nested `selector(':hover') → selector(':focus')`
is selector-context chaining and remains deferred. An inherited block-beneath-extend
prohibition still takes precedence over deferred relationships.

### Pending relation

Exact strings **`+`, `>`, `~`** are pending relations. Only
**element → pending relation → element** is approved:

```css
.card__item + .card__other
.card__item > .card__child
.card__item ~ .card__other
```

The right element uses the same BEM owner as the left, including under nested
blocks and extend descendants. Enclosing scope is retained once. Ordinary RHS
modifiers work; multiple RHS element siblings resolve independently. No incomplete
combinator rule is emitted, and an empty branch emits nothing.

Direct declarations have no target and fail with Sass's “Declarations may only
be used within style rules.” They must not attach to the left selector. Raw Sass
wrappers remain a separate integration question, not an approved workaround.
Other pending parents/children remain DEFERRED.

### Excluded forms and isolation

Class, ID, type, universal, placeholder, parent-reference, list, and complex
selector inputs are outside this subset, including `.foo`, `#foo`, `button`, `*`,
`%placeholder`, `.foo:hover`, `button:hover`, `.foo .bar`, `:hover .foo`,
`:hover, :focus`, `.theme &`, and `&:hover`. Other relation strings such as `||`
are unsupported. Malformed selectors may report Sass parser diagnostics.

All functional pseudos remain **DEFERRED**, including `:has(...)`, `:not(...)`,
`:is(...)`, `:where(...)`, `:nth-child(...)`, and compounds containing them such
as `:hover:has(.foo)` or `[disabled]:not(.foo)`. No argument interpretation or
BEM-aware functional API is approved.

Completing either structural family restores the exact parent context; later
siblings acquire no qualifier, relation, owner, scope, or ancestry from it.
Existing `:before` and `+` expectations remain unchanged. Historical evidence:
S01–S02 and the derived `state-isolation/after-selector--*` comparisons. Expanded
approval and production coverage are recorded in [SELECTOR-DESIGN-v3.md](SELECTOR-DESIGN-v3.md).

## extend

**Purpose:** target a named descendant component with one or two modifier classes,
and optionally target that component's elements within the modifier scope.
This is the observed BEMinator mixin contract; no equivalence to native Sass
`@extend` or inheritance is specified.

**Valid parent:** block. Top-level extend and extend → extend are explicitly
DEFERRED. Other untested parents remain DEFERRED.

**Valid child:** element. A block anywhere beneath extend is INVALID.
Modifier and selector children are DEFERRED, as is another extend.

**Selector semantics:**

| Approved pattern inside block a | Selector |
| --- | --- |
| extend('b', 'm') | `.a .b--m` |
| extend('b', 'x', 'y') | `.a .b--x.b--y` |
| extend('b', 'm') → element('item') | `.a .b--m .b__item` |
| extend('b', 'x', 'y') → element('item') | `.a .b--x.b--y .b__item` |

The extended component's modifier conjunction targets one element; its named
element is a descendant. An extend invocation with no modifier or additional
modifier arguments is not specified by these approvals.

**Invalid nesting:** reject `block → extend → block` as v2 already does; also
reject the successful v2 exploratory `extend → block`,
`extend → extend → block`, and `extend → block → block` combinations.

**Isolation:** after extend completes, later siblings use their own public
lexical context, not its component name, modifiers, or ancestor scope.

Evidence: X01–X03, N03, Q01–Q05; the four `core/extend/*` fixtures,
both `invalid/block-extend-block*` cases, and the corresponding exploratory
extend/block fixtures. Deferred experimental successes are not v3 requirements.

## Adopted release policy and unsupported future semantics

[CORE-STABILITY-v3.md](CORE-STABILITY-v3.md) is the adopted stable contract for
D03, D05, D08, D09, D10, and D11. BEM names are evaluated Sass strings matching
`[A-Za-z_][A-Za-z0-9_-]*`; variables, interpolation, and normalized escapes use
that same rule. Already-BEM-looking names are opaque. Diagnostic categories are
stable; exact wording and Sass-owned diagnostics are not API.

The sole public entrypoint is `src/_index.scss`, exposed through the package root.
Deep imports have no compatibility promise. At-rule integration guarantees cover
tested media/supports/container forms and flat CSS Layers only. Keyframes,
font-face, property, page, scope, custom/unknown at-rules, and caller-authored
at-root queries are outside the BEM integration guarantee, not prohibited CSS.

Raw leaf rules inside a complete BEM rule are supported as ordinary Sass styling.
Raw selectors do not establish BEM context; BEM re-entry through them is
unsupported and can silently lose lexical conditions. Qualified selector bodies
still cannot contain BEM children, so they are not a conditional-descendant
workaround.

Root extend (Q01), nested extend (Q02), Q07's complete historical output, other
DEFERRED entries, functional pseudos, and selector-context chaining remain outside
the stable subset with no future implementation promised. Addons, nested CSS
Layers, broader identifiers, and additional at-rule integrations are non-blocking
future topics. Publication is separate from this stable core declaration.

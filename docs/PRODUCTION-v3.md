# Approved production core

The public entrypoint is `src/_index.scss`. It exports only `block($name)`,
`element($name)`, `modifier($mod1, $mod2: null)`, `selector($name)`, and
`extend($name, $mod1, $mod2: null)` as mixins. Calls nest without context arguments
or `using` clauses. These are the five mixin exports; the only public variables
are `$element-separator` and `$modifier-separator`. Helpers remain private.

The core implements the approved relationships in
[SPEC-v3.md](SPEC-v3.md), including recursive/equal-name blocks, single and
conjunctive double modifiers, contextual elements, and sibling isolation.
Direct element/element and modifier/modifier calls fail compilation. Top-level
element/modifier and element/block are deferred and report “not implemented in
this slice”; that boundary does not decide their future semantics. Q07 remains
unapproved as a complete combination; no special history tracking is introduced.

Block, element, modifier, and extend target/modifier names are nonempty quoted or unquoted
strings starting with an ASCII letter or underscore, followed by ASCII letters,
digits, underscores or hyphens. Examples include `card`, `standard-object`, and `fatherdMod`. Whitespace,
selector lists, escapes, arbitrary selectors, numbers, and other name forms are
outside this slice and rejected. This conservative input policy is not a general
CSS identifier validator or the final input-domain decision. A modifier accepts
one required name and an optional second name (`null` means absent). Zero or
more than two arguments fail through Sass's fixed mixin signature.

## Modifier keyword compatibility

The supported signature is `modifier($mod1, $mod2: null)`, consistent with
`extend($name, $mod1, $mod2: null)`. These calls are equivalent in pairs:

```scss
@include bem.modifier('active') { color: red; }
@include bem.modifier($mod1: 'active') { color: red; }

@include bem.modifier('active', 'large') { color: red; }
@include bem.modifier($mod1: 'active', $mod2: 'large') { color: red; }
```

Omitting `$mod2` is equivalent to `$mod2: null`. Empty strings are still invalid
names. The initial, unreleased v3 `$name`/`$second` modifier keywords have no
compatibility aliases. Other public signatures and all selector semantics are
unchanged.

## Approved configuration and retired machinery

Separator configuration is available through normal Sass module configuration at
load time. The two public construction settings default to:

```scss
$element-separator: '__' !default;
$modifier-separator: '--' !default;
```

Using the consumer's BEMinator module path (package/import naming remains D10):

```scss
@use 'sass-beminator' as bem with (
  $element-separator: '-',
  $modifier-separator: '_'
);
```

Both values must be nonempty Sass strings containing only `-` and `_`. Equal
separators are allowed; naming collisions are the consumer's responsibility.
Invalid values fail at module load with a BEMinator diagnostic naming the setting,
even when no BEM mixin is called. No selector parser is needed for this validation.

**Sass limitation:** explicit `null` in `with (...)` is treated by Sass as unset;
Sass substitutes the `!default` value before BEMinator can inspect it. Therefore
BEMinator cannot reject an explicitly configured null with these standard default
variables. This is a documented implementation limitation relative to the requested
null rejection, not a new supported separator value. Tests record the actual
fallback behavior; other non-string values are rejected.

| With element `-`, modifier `_` | Selector |
| --- | --- |
| card → element title | `.card-title` |
| card → modifier active,large | `.card_active.card_large` |
| card → element button → modifier active → qualifier `:hover` | `.card-button_active:hover` |
| card → element item → relation `>` → element child | `.card-item > .card-child` |
| card → extend icon,a,b → element item | `.card .icon_a.icon_b .icon-item` |

With element `--` and modifier `-`, the last example instead emits
`.card .icon-a.icon-b .icon--item`. Double modifiers remain conjunctive classes;
only construction suffixes change. Nested blocks, extend descendants, and all
pending relations use the same settings. Default settings preserve existing CSS.

The supported lifetime is **load-time configuration only**. Sass public variables
can technically be reassigned, but execution-time reassignment is outside the
contract. There are no setter mixins, per-block arguments, separator snapshots,
or separator fields in context values. Configuration is read only where names
are constructed; the only evolving runtime state remains the private stack.

Legacy debug, `:where()` specificity controls, automatic theme discovery/path
construction, theme arguments, and their CSS-variable/theme injection plumbing
are retired. Theme loading belongs outside BEMinator through normal Sass/build
mechanisms. These are not future addon candidates absent a new use case.
**CSS Layers are kept as an optional future v3 capability**, not implemented or
designed here; BEMinator must remain usable without layers. See the explicit
[maintainer decisions](CORE-HARDENING-v3.md). Six hardening decision groups
remain open; the whole API is not yet stable.

## Selector forms and declarations

`selector($name)` takes one Sass string in either of two structural families:

| Family | Input | Valid parent | Body |
| --- | --- | --- | --- |
| Qualified | One compound of one or more non-functional pseudos/attributes | block, element, modifier | Declarations; public BEM children deferred |
| Pending relation | Exact `+`, `>`, or `~` | element | Element children resolve the right target |

```scss
@include bem.block('card') {
  @include bem.selector(':hover:focus') { color: red; }
  @include bem.element('item') {
    @include bem.selector(':before') { content: 'before'; }
    @include bem.selector('[disabled]:hover') { color: gray; }
    @include bem.selector('>') {
      @include bem.element('other') { color: blue; }
    }
  }
}
// .card:hover:focus
// .card__item:before
// .card__item[disabled]:hover
// .card__item > .card__other
```

Qualified input is parsed by Sass as exactly one complex selector with one compound.
Every simple token must be a non-functional pseudo or attribute. There is no
pseudo-name whitelist. Supported examples include `:hover`, `:focus`,
`:focus-visible`, `:active`, `:disabled`, `:before`, `:after`, `::before`, `::after`,
`[disabled]`, `[data-state="open"]`, and compounds `:hover:focus`,
`:focus-visible:hover`, `:placeholder:hover`, `:focus::before`,
`[disabled]:hover`, `[data-state="open"]:focus`, `:hover[aria-expanded="true"]`.
Sass parses attribute grammar; selector-like punctuation in values stays data.

A qualifier changes only the subject, retaining owner, scope, and extend ancestry.
It also works beneath an element descendant of extend or on a modified subject:
`.card .icon--large .icon__label:hover`, `.card__button--active[disabled]:hover`.
BEMinator validates shape, not browser support, element applicability, useful
combinations, or pseudo-element ordering across CSS specifications. Unknown
non-functional pseudos such as `:made-up` may pass. `:before` and `::before` remain
distinct; arbitrary source-text fidelity is not promised (e.g. attribute quotes).

Multiple tokens in **one call** are approved. Nested selector calls remain
**DEFERRED**, as do every other public BEM child of a qualified context. The
stronger prohibition against blocks anywhere under extend still applies.

A pending relation retains the complete left selector until an element child
supplies the right subject from the same owner. Nested-block/extend ownership,
ordinary RHS modifiers, and multiple independent RHS siblings are preserved.
Empty branches emit nothing; no incomplete combinator rule is emitted. Pending
parents other than element and children other than element remain deferred.
Direct element/element and modifier/modifier rejection is unchanged.

Direct declarations in any pending relation fail with Dart Sass's diagnostic:
**“Declarations may only be used within style rules.”** The single emission
boundary removes enclosing style rules while executing pending content, so bare
properties cannot accidentally attach to the left subject. This includes custom
properties and declarations after a completed child. A child element emits a
complete selector through that same boundary. No extra state or cleanup is needed.
Raw user-created rules/at-rule wrappers remain outside this body contract; this
is not a general content-AST validator. Diagnostic wording policy remains under
hardening review, while the direct-declaration rejection contract is approved.

Non-string arguments, targets such as `.foo`, `#foo`, `button`, `*`, `%placeholder`,
compounds containing those targets, selector lists/complex selectors, parent
references, and unsupported relations such as `||` are outside this subset.
Sass owns malformed-syntax diagnostics; BEMinator checks parsed shape/families.

**All functional pseudos remain deferred**, including static `:has(...)`,
`:not(...)`, `:is(...)`, `:where(...)`, `:nth-child(...)` and compounds containing
them. BEM-aware functional/conditional selectors remain a separate future API-design
phase. There is no reference helper, BEM-target argument, or public AST API.

After either family completes, siblings receive the exact saved parent context.
Tests cover compounds, repeated calls, alternate sibling orders, independent roots,
nested-block and extend ownership, and all existing `:before`/`+` regressions.

## Extend: scoped target construction

`extend($name, $mod1, $mod2: null)` is supported directly under a block only.
It creates a new BEM owner from `$name`, qualifies that target with one or two
modifiers, and uses the complete enclosing block selector as its scope. All
three names use the existing literal-name policy. `$mod1` is required and cannot
be null; `$mod2: null` means absent. Omitting the required modifier or supplying
more than two modifiers fails compilation. Positional and named arguments work.

The four approved forms inside `block('standard-object')` are:

| Invocation | Complete selector |
| --- | --- |
| `extend('icon', 'mod1')` | `.standard-object .icon--mod1` |
| `extend('icon', 'mod1', 'mod2')` | `.standard-object .icon--mod1.icon--mod2` |
| Single extend → `element('nested-element')` | `.standard-object .icon--mod1 .icon__nested-element` |
| Double extend → `element('nested-element')` | `.standard-object .icon--mod1.icon--mod2 .icon__nested-element` |

Double modifiers are conjunctive classes on the same target. Modifier and extend
share the same pure subject-qualification helper; the ancestor scope is composed
only once. Child elements use the extend owner, with the qualified extend target
as contextual scope. Ordinary element modifiers continue to work, for example
`.standard-object .icon--mod1 .icon__label--active`.

**This is selector construction, not native Sass extension.** The implementation
uses no native `@extend`, `selector.unify()`, `selector.extend()`, or
`selector.replace()`. Existing rules are neither merged nor extended. Tests check
both the independent emitted rules and the absence of these source primitives.

An immutable `under-extend` fact is set on entry and inherited by every derived
context, including element, modifier, and both selector contexts. A block is
forbidden anywhere beneath extend, even after valid intervening calls. This
ancestry check precedes local/deferred relationship checks and reports
“invalid nesting: block is forbidden beneath extend.” It needs no global boolean.

Top-level extend and extend → extend remain **DEFERRED**, reporting the existing
“deferred; not implemented in this slice” diagnostic. Extend under element,
modifier, or selector is likewise unimplemented. Direct modifier/selector children
of extend remain deferred; the only approved immediate child is element. Once
that element exists, its already-approved modifier and selector relationships
apply without new syntax. An attempted deferred ancestor is stopped on entry;
tests do not execute its content to invent unsupported ancestry paths.

Completing extend restores the exact saved parent stack, including its prior
ancestry fact. Subsequent normal elements keep the original owner, and subsequent
nested blocks are permitted normally. Tests cover all four approved historical
artifacts, repeated calls, empty calls, independent roots, ancestry errors through
six paths, and representative sibling sequences mixing all five operations in
valid contexts. Existing selector behavior and both historical leak corrections
remain unchanged.

## Private architecture and verification

The core keeps five immutable context facts: `owner`, `subject`, `scope`, `kind`,
and `under-extend`. Root contexts start with `under-extend: false`; entering extend
sets it to true and derivation inherits it. There is exactly **one mutable
module-global value**, the private context stack. Private push/restore helpers are its only writers. One
entry boundary validates, derives, pushes, emits with `@at-root`, and restores
the exact saved stack list after successful content. `kind` distinguishes normal
elements, `qualified` subjects, and `pending-relation` frames. Pending
frames add only immutable `relation` data and retain the left subject/scope;
element derivation adds that relation operand and
right-hand subject. No pending-selector variable or history exists outside the
stack. Pure helpers never read ambient `&` or the stack. Production has no spike assertions or debugging exports.
As proven in the spike, an error aborts evaluation; the next compilation starts
fresh even if the JavaScript compiler instance is reused.

Tests under `tests/production` import the public entrypoint. They use intentional
expected CSS, with the approved isolated historical regression and four extend
artifacts as additional cross-checks. No tests require a legacy checkout. Public-output tests
verify parent/root restoration without introducing private test hooks. The
existing spike retains the direct depth and exact-stack assertions.

Run `npm run test:production` alone, or `npm test` for unit and production tests.
`npm run test:watch` watches both. Characterization and disposable spike suites
remain separate and unchanged. No dependencies or runtime configuration APIs are added.

The approved v3 core behavior subset is implemented. Whole-API stabilization
still has six open hardening decision groups. This does not settle top-level/nested extend, Q07, broader argument
policy, deferred selector forms, or raw CSS/at-rule integration. All remain outside
this contract; addon/plugin work has not begun.

Relative to the spike, approved selector outputs are unchanged. Production adds
safe rejection of bare declarations in a pending `+` by executing pending content
outside style rules. It retains the existing pure derivation and saved-stack
restoration architecture, with no production depth assertions or debug exports.
It imports no spike or legacy code.

Extend-slice validation, before keyword stabilization, on Node 22.19.0 / Dart Sass
1.104.1: **93 production tests passed**
(42 core, 23 selector, 28 extend tests). The 27 selector-engine and 15 context-stack
spike tests also passed. `npm run test:production`, `npm test`,
`npm run test:characterization`, and `npm run test:legacy` passed. The detailed
combined project run confirmed **155 passing tests** with legacy warnings
unsuppressed. Logs are under ignored `tmp/extend-slice-*.log`. Source inspection
and the architecture test confirm one private mutable module global, two
centralized writes to that stack, one emission boundary, and no prohibited
native selector-extension primitives. SPEC-v3, historical artifacts, legacy
sources, and disposable spikes were not changed for this slice.


Keyword-stabilization validation: **100 production tests**, **42 spike tests**,
and **162 combined project tests** pass. Modifier now uses `$mod1`/`$mod2` without
changing any selector output or validation rule. No separator configuration or
CSS Layers implementation was added. Architecture remains one private mutable
context stack, one emission boundary, and five public mixins with no public
functions or variables. Logs are `tmp/stabilization-*.log`.


Structural-selector stabilization validation: **139 production tests** (39 added),
**42 original spike tests** (27 selector-engine + 15 context-stack), **16 unchanged
structural experiment tests**, and **201 combined project tests** pass on Node
22.19.0 / Dart Sass 1.104.1. Production, both original spikes, the structural
experiment, characterization, normal project, and legacy commands all pass.
Detailed runs disable Node test-process isolation to report individual test
counts rather than file totals. Logs are `tmp/structural-selector-*.log`;
production detail is `tmp/structural-production-initial.log`.

Source/API guards confirm **one mutable module global**, **one emission boundary**,
and exactly five public mixins with no public functions or variables. Existing
block/element/modifier/extend outputs and original `:before`/`+` output regressions
remain green. Six hardening groups remain open; no separator configuration,
CSS Layers, functional pseudo API, or selector-context chaining was implemented.


Separator implementation adds only the two approved public settings. All five
mixin signatures, structural selector semantics, immutable context facts, and
centralized stack restoration remain unchanged. Source guards distinguish these
two load-time inputs from the **one evolving mutable stack** and still enforce
**one emission boundary**. CSS Layers and functional selectors remain unimplemented;
retired legacy configuration is not restored.


Separator validation: **172 production tests** (33 added), **234 combined project
tests**, and **58 spike tests** (27 selector-engine, 15 context-stack, 16 structural)
pass on Node 22.19.0 / Dart Sass 1.104.1. Normal project, characterization, and
legacy commands pass with legacy warnings unsuppressed. Default CSS regressions
remain unchanged; custom settings cover conjunctions, extend ancestry, selector
integration, sibling restoration, invalid load-time values, and compiler reuse.
Logs: `tmp/separators-*.log`. There is still one evolving mutable module global
and one emission boundary; public configuration adds two load-time inputs only.
Six hardening decision groups remain open; the explicit-null/default limitation
is documented above rather than counted as a new design decision.

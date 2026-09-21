# Approved production core

The public entrypoint is `src/_index.scss`. It exports only `block($name)`,
`element($name)`, `modifier($mod1, $mod2: null)`, `selector($name)`, and
`extend($name, $mod1, $mod2: null)` as mixins. Calls nest without context arguments
or `using` clauses. These are the five explicit exports; helpers remain private.

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

Separator configuration is approved for a future implementation through Sass
module configuration at load time, defaulting to element `__` and modifier `--`.
Separators must be non-empty strings containing only `-` and `_`; equal separators
are allowed. Naming collisions are the consumer's responsibility, and runtime
separator changes are unsupported. **Configuration is not implemented yet:**
production still exports only the five mixins and uses the default separators.

Legacy debug, `:where()` specificity controls, automatic theme discovery/path
construction, theme arguments, and their CSS-variable/theme injection plumbing
are retired. Theme loading belongs outside BEMinator through normal Sass/build
mechanisms. These are not future addon candidates absent a new use case.
**CSS Layers are kept as an optional future v3 capability**, not implemented or
designed here; BEMinator must remain usable without layers. See the explicit
[maintainer decisions](CORE-HARDENING-v3.md). Seven hardening decision groups
remain open; the whole API is not yet stable.

## Selector forms and declarations

`selector($name)` accepts exactly `':before'` and `'+'` (equivalent Sass string
quoting is accepted). Other values report “selector form is not supported in this
slice”; they are not declared permanently invalid by SPEC-v3. Fixed arity requires
one argument. No arbitrary-selector parser or BEM-reference API is provided.

```scss
@include bem.block('card') {
  @include bem.element('item') {
    @include bem.selector(':before') { content: 'before'; }
    @include bem.selector('+') {
      @include bem.element('other') { color: red; }
    }
  }
}
// .card__item:before { content: 'before'; }
// .card__item + .card__other { color: red; }
```

Both selector forms are supported only directly under an element. `:before`
qualifies that element's subject, retains its enclosing scope, and preserves the
single colon exactly. Declarations are valid; core-mixin children remain deferred.

`+` is a pending relation, not a style rule. An element child resolves its right
side using the same BEM owner, including inside nested blocks. The resolved
element may receive its approved modifier children. Multiple right-hand element
siblings resolve independently from the same left context. Empty pending branches
emit no CSS; no incomplete trailing combinator is emitted. Other core children
of `+`, and other selector parents, remain deferred/unimplemented. Direct
element/element and modifier/modifier rejection is unchanged.

Direct declarations in `selector('+')` are rejected with Dart Sass's diagnostic:
**“Declarations may only be used within style rules.”** The central emission
boundary removes enclosing style rules before executing pending content, so a
bare declaration has no target. This also rejects custom properties, declarations
in control flow or helper mixins, and declarations after a completed child. A
child element emits through the same boundary with a complete selector. No
content-string inspection, second mutable state, or selector-specific cleanup is
needed. A compilation error aborts the fixture; no successful partial CSS is
returned. Raw user-created rule/at-rule wrappers remain outside this subset's
integration contract; this is not a general content-body validator.

After either selector call, siblings receive the exact saved parent context.
Tests cover repeated calls, alternate modifier/selector orders, nested block
ownership, independent roots, and compiler reuse after a pending-declaration error.

**BEM-aware functional/conditional selectors are deferred to a separate future
API-design phase.** This includes `:has(...)`, BEM-aware `:not(...)`, `:is(...)`,
`:where(...)`, and other functional selectors containing dynamically generated
BEM targets, such as `.block__item:has(.block__featured)`. This slice supports none
of these forms and introduces no reference helper, special argument, or future
API proposal.

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
elements, `before` qualified subjects, and `adjacent` pending relations. Pending
frames retain the left subject/scope; element derivation adds the `+` operand and
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
remain separate and unchanged. No dependencies or runtime configuration are added.

The approved v3 core behavior subset is implemented. Whole-API stabilization
still has seven open hardening decision groups. This does not settle top-level/nested extend, Q07, broader argument
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

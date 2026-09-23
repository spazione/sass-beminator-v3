# Adopted stable v3 core contract

**Core API: stable. Package publication: not yet performed.**
D03, D05, D08, D09, D10, and D11 are formally adopted. Future optional features
are outside core stability; no matrix completion or future implementation is
promised. The package remains private at version `0.0.0` until a separate release.

This adoption preserves selector semantics and architecture. Production changes
are limited to version-neutral diagnostic wording and a private comment. Focused
raw-leaf and packed-package regressions complete the pre-release follow-up.
Historical characterization and disposable spikes retain their original meaning.

## 1. Stable public API

One supported public module: `src/_index.scss`, imported as `./src` from the
repository root. It exports exactly six mixins and no public functions:

```scss
block($name, $layer: null)
element($name)
modifier($mod1, $mod2: null)
selector($name)
extend($name, $mod1, $mod2: null)
css-layers()
```

Exactly three public load-time configuration variables:

```scss
$element-separator: '__' !default;
$modifier-separator: '--' !default;
$css-layers: (
  generic: (),
  elements: (),
  atoms: (),
  molecules: (),
  organisms: (),
  templates: (),
  pages: (),
  utilities: (),
) !default;
```

Stable contract:

> Sass BEMinator v3 core guarantees the public module above, the approved nesting
> subset in SPEC-v3, and isolation of BEM owner, subject, scope, and ancestry across
> completed siblings and independent roots. Names are evaluated simple ASCII
> string tokens. Modifiers accept one or two names; extend constructs a scoped
> target directly beneath a block and requires at least one modifier. Selectors
> accept one compound of non-functional pseudos/attributes, or an element-owned
> pending `+`, `>`, or `~` resolved by element children. Configurable separators
> and optional flat CSS Layers retain their documented validation and ordering
> contracts. Unsupported matrix entries fail compilation without promising future
> semantics. BEMinator semantic failure categories are stable, exact diagnostic
> text is not; Sass-owned wording is never promised. Ordinary raw leaf styling
> is delegated to Sass, but raw selectors do not establish BEM context and BEM
> re-entry through them is unsupported. At-rule integration is limited to tested
> media/supports/container wrapper forms and documented CSS Layers behavior.
> Other contexts, deferred forms, and historical composites carry no additional
> compatibility promise. Stability does not mean reproducing every v2 behavior.

Separators remain nonempty strings of `-`/`_`; equal values and already-BEM-looking
names may collide, which is consumer responsibility. Configuration is load-time
only; direct public-variable reassignment during stylesheet execution is unsupported.
Sass substitutes defaults for explicit null configuration.

Layers remain a nonempty flat ordered registry with strict case-sensitive lookup,
quoted/unquoted string equivalence, ignored values, and the documented conservative
layer-name domain. Root-only explicit selection wraps the subtree; omitted/null
nested selection inherits. Explicit nested selection is rejected. `css-layers()`
emits ordering only when called, repeats literally, and never hoists/deduplicates.
Consumers may instead declare order manually. Either declaration must precede
layered CSS in the final effective order; external splitting, extraction,
concatenation, or runtime injection is outside BEMinator's guarantee.

Architecture remains exactly one evolving mutable module global (the private BEM
context stack), one BEM emission boundary, and immutable context derivation.
There is no layer field/stack/current-layer/order cache or theme/path/debug/legacy
`:where()` machinery. Neither broader syntax nor arbitrary raw ancestry requires
an architectural redesign merely to call the existing subset stable.

## 2. D03: lock the evaluated token domain

The adopted domain is **ASCII letter or underscore first, then ASCII letters, digits,
underscores, or hyphens**: `[A-Za-z_][A-Za-z0-9_-]*` on the evaluated Sass string.
The shared `-name()` validator applies to block/element names and every supplied
modifier/extend target/modifier argument. Required names cannot be null;
optional `$mod2: null` means absent. No string coercion is promised.

| Input family | Stable policy and reason |
| --- | --- |
| `card`, `card-item`, `_Card_2`, `card2`, `c-card` | Keep accepted; predictable BEM tokens, case retained |
| `-card`, `--card` | Keep rejected; some CSS conventions use these, but no demonstrated project requirement justifies expanding this API now |
| `café`, `卡片` | Keep rejected; international naming is a legitimate possible future need, not evidence this core needs a full CSS identifier domain |
| `31card`, `.foo`, `card:hover`, `foo bar`, `foo,bar` | Keep rejected; names are not serialized selectors |
| Utility-style `sm:card`, `w-1/2`, `!card`, bracketed syntax | Keep rejected; utility class syntax is a different input model, not a BEM requirement |
| `card__item--active` | Keep accepted as one opaque name; never parse its apparent BEM segments or infer provenance |
| Variables, concatenation, interpolation | Accept exactly when the evaluated string passes the same rule |
| Sass escapes | Validate the evaluated value, not source spelling; no source-preserving escape engine |

For example, quoted/unquoted `c\61 rd` can evaluate to `card` and pass; an escape
that yields a leading digit or colon does not bypass validation. This is existing
behavior, not new escaped-identifier support. Sass owns escape normalization and
string evaluation. See [Sass strings](https://sass-lang.com/documentation/values/strings/)
and [interpolation](https://sass-lang.com/documentation/interpolation/).
Unquoted tokens that evaluate to colors/numbers are not strings merely because
their source looks name-like; quoted examples avoid that ambiguity.

There is no compelling use case in the project evidence requiring expansion now.
D03 is closed with this domain. Broader identifiers require a concrete future
use case; do not add normalization, Unicode parsing, or spelling preservation.

## 3. D05: semantic categories, not error-string API

The stable contract requires rejection and a human-understandable reason for supported
validation categories. These are conceptual categories, **not machine-readable
codes**, exception classes, or a promise that clients can parse error strings.
Exact text, internal kind labels, stack traces, spans, and formatting are not API.
No diagnostic code registry or custom exception transport is needed.

Complete inventory of BEMinator-owned `@error` branches in `src/core/_bem.scss`:

| Semantic category | Current failures covered |
| --- | --- |
| Invalid BEM name | Non-string/empty, invalid initial character, invalid remaining character |
| Forbidden nesting | Direct element/element; direct modifier/modifier; block anywhere beneath extend |
| Unsupported relationship | Every call absent from the allowed context map, unless the stronger ancestry prohibition applies |
| Invalid/unsupported selector input | Non-string; not one compound; no qualifier; token other than non-functional pseudo/attribute; functional pseudo deferral |
| Invalid separator configuration | Non-string/empty or characters other than `-`/`_`, naming the affected setting |
| Invalid layer registry/name | Not a nonempty map; non-string/empty name; invalid initial/remaining character; reserved name; duplicate normalized key |
| Unknown layer | Valid name absent from configured top-level keys |
| Invalid explicit layer placement | Non-root BEM selection; existing nesting validation, especially extend ancestry, may reject first |

Sass-owned failures remain Sass-owned: malformed SCSS/selector syntax and escapes,
missing/extra/unknown mixin arguments, wrong content-block usage, inaccessible
private members, unavailable module configuration, duplicate literal map keys,
module reconfiguration, and bare declarations in pending relations. Malformed
selectors may fail in `selector.parse()` before BEMinator shape checks. A duplicate
map key may fail before the defensive BEMinator registry check. Do not promise
one owner or precedence for arbitrary inputs violating several constraints;
retain the already-approved block-under-extend precedence.

Completed diagnostic wording cleanup:

| Previous wording | Current wording |
| --- | --- |
| `is deferred; not implemented in this slice` | `is unsupported in the current BEMinator API` |
| `functional pseudo selectors are deferred; not implemented in this subset` | `functional pseudo selectors are unsupported in the current BEMinator API` |
| `expected a nonempty literal BEM name` | `expected a nonempty BEM name string` |

The private name-validation comment now says `Evaluated BEM token policy`.
Focused production assertions retain category-specific checks; no generic
error-only assertions replace them. These text changes do not alter rejection,
selector construction, or validation. Historical captures and disposable spikes
are not rewritten to match production wording. D05 is closed.

## 4. D10: one supported entrypoint, explicit resolver requirements

The sole supported public entrypoint is `src/_index.scss`. Deep imports of
`src/core/_bem.scss` or future internals have no compatibility promise, even when
technically accessible. There are no supported internal subpath exports.

The distribution name is finalized as **`sass-beminator`**. Repository inspection
found the temporary `sass-beminator-v3` package name only in package metadata and
documentation, not workflow/import dependencies. Renaming updates package.json
and both root lockfile name fields; it changes future artifact/package identity,
not the repository directory or the read-only sibling legacy path.

Preferred consumer examples use a namespace:

```scss
// With a consumer resolver configured for the package:
@use 'sass-beminator' as bem;
@include bem.block('card') { color: red; }
```

Custom namespaces and `as *` remain valid; ordinary name collisions are consumer
responsibility. From the repository root, `@use './src' as bem` loads the same
public entrypoint. The verified Dart Sass package-importer form is:

```scss
@use 'pkg:sass-beminator' as bem;
```

Enable `new NodePackageImporter(...)` in Dart Sass's modern JavaScript API (or
`--pkg-importer=node` on its CLI). A bare package name is resolver-dependent; it
is not made universal by the metadata. See the official
[NodePackageImporter documentation](https://sass-lang.com/documentation/js-api/classes/nodepackageimporter/).

The package now declares:

```json
{
  "name": "sass-beminator",
  "sass": "./src/_index.scss",
  "exports": {
    ".": { "sass": "./src/_index.scss" }
  }
}
```

The package file allowlist includes `src/`, documentation, and README; the artifact
contains both the public entrypoint and required private Sass implementation.
No bundler, runtime dependency, or extra entrypoint is added. Export metadata is
not a filesystem privacy boundary: deep imports remain unsupported, not necessarily
impossible. `private: true` and version `0.0.0` deliberately remain unchanged.

`npm run test:package` performs an offline `npm pack` with lifecycle scripts
disabled, extracts that actual artifact into an isolated consumer's `node_modules`,
and compiles via NodePackageImporter. It exercises all six mixins and all three
configuration variables, verifies zero public functions, checks exact CSS, and
asserts loaded library URLs belong only to the unpacked artifact. It requires npm
and tar, installs no dependencies, and cleans its temporary consumer/cache.
D10 is closed; publication itself remains a separate authorized release operation.

## 5. D11: a stable subset may retain DEFERRED entries

D11 is closed as a **release-scope decision**, without resolving the future
semantics of each entry. Existing runtime rejection is sufficient. DEFERRED means
unsupported in this API, with future meaning uncommitted; INVALID means a current
explicit semantic prohibition. Both fail compilation on entry today. Unsupported
relationships do not need semantics merely to make the matrix complete.

The classifications below retain future triage, not delivery commitments.
`UNSUPPORTED FOR v3 CORE` does not relabel historical DEFER records or permanently
forbid a future proposal.
Qualified and pending forms are separated to cover every deferred matrix cell.

| Relationship/form | Classification | Rationale |
| --- | --- | --- |
| root → element | UNSUPPORTED FOR v3 CORE | No BEM owner; no owner inference API |
| root → modifier | UNSUPPORTED FOR v3 CORE | No BEM subject |
| root → selector (either form) | NO KNOWN USE CASE | Free selectors already belong to Sass |
| root → extend (Q01) | KEEP DEFERRED | Historical evidence is not a modern requirement |
| block → pending relation | KEEP DEFERRED | Current relation contract belongs to elements |
| element → block | KEEP DEFERRED | Needs a demonstrated component/element scope requirement |
| element → extend | KEEP DEFERRED | No approved target-scoping use case |
| modifier → pending relation | KEEP DEFERRED | Needs an explicit modified-LHS contract |
| modifier → extend | KEEP DEFERRED | No demonstrated retargeting contract |
| qualified → block | NO KNOWN USE CASE | No raw-condition ancestry inference |
| qualified → element | LIKELY FUTURE FEATURE | Conditional descendant semantics need a dedicated design |
| qualified → modifier | LIKELY FUTURE FEATURE | Subject qualification order must be deliberate |
| qualified → selector (either form) | LIKELY FUTURE FEATURE | Selector-context chaining, not string concatenation |
| qualified → extend | NO KNOWN USE CASE | No conditional retargeting requirement |
| pending → block | UNSUPPORTED FOR v3 CORE | RHS is an element in the current contract |
| pending → modifier | UNSUPPORTED FOR v3 CORE | Resolve RHS element first, then modify it |
| pending → selector (either form) | KEEP DEFERRED | No complete RHS subject yet |
| pending → extend | NO KNOWN USE CASE | Retargeting and relation ownership are unspecified |
| extend → modifier | NO KNOWN USE CASE | Extend already accepts one/two target modifiers |
| extend → selector (either form) | LIKELY FUTURE FEATURE | Target-condition requirements need review |
| extend → extend (Q02) | KEEP DEFERRED | Nested retargeting lacks a demonstrated use case |
| Functional pseudos, including compounds containing them | LIKELY FUTURE FEATURE | Separate BEM-aware capability; no implementation here |
| Q07 complete historical composite | KEEP DEFERRED | Archival evidence, no approved whole-output requirement |

Direct element/element, modifier/modifier, and block beneath extend remain INVALID,
not candidates to broaden. Qualified bodies have no public BEM children; pending
bodies resolve element children and reject direct declarations.

Root extend and nested extend do not block release. Q07 needs no exact-output
approval for release either. It is not a runtime-detectable forbidden sequence:
a composition of individually valid calls may compile without making its historical
whole output a separately supported requirement. Do not add a Q07 history detector
or infer that all valid primitive relationships must be revoked.

Functional pseudos are a future feature topic, not a delivery commitment. Existing
pure owner/subject/scope derivation presents no demonstrated release blocker for
such future work. This contract does not promise their syntax, delivery, or matching semantics.

## 6. D08: bounded at-rule support

D08 is closed with the existing tested integrations:
`@media`, `@supports`, and `@container` around BEM composition and inside a layered
block, including conditional wrappers around pending RHS elements and sibling
restoration; plus the documented flat CSS Layers contract. This promises the
covered containment behavior, not arbitrary at-rule normalization or source-shaped
formatting. Sass may bubble/reorganize wrappers.

| Context | Release boundary |
| --- | --- |
| Tested media/supports/container forms | Supported as above; do not extrapolate to every combination/query |
| CSS Layers | Supported root explicit selection, lexical inheritance, registry and explicit ordering contract |
| `@keyframes` | BEM re-entry in animation steps unsupported; not BEM class-selector bodies |
| `@font-face`, `@property` | BEM re-entry in descriptor contexts unsupported |
| `@page` and margin contexts | Outside the BEM nesting contract |
| `@scope` | Potential useful future integration, but no approved production coverage; do not infer support from retained text |
| Unknown/custom at-rules | Outside the contract even if Sass preserves them |
| User-authored `@at-root` queries around BEM calls | Outside the contract; no guarantee of caller-directed scope/layer escape |

This concerns BEM mixin integration, not a prohibition on unrelated CSS in the
same stylesheet. No new probes or normalization implementation are required to
close the bounded contract. Add focused probes only when a consumer needs a
specific additional integration, particularly `@scope`.

## 7. D09: raw Sass leaf styling, no raw-selector BEM context

D09 permits ordinary raw rules as terminal styling inside an emitted
BEM rule, delegated to Sass:

```scss
@use 'sass-beminator' as bem;
@include bem.block('card') {
  > img { display: block; }
  &:hover { color: red; }
  @include bem.element('title') { color: blue; }
}
```

Raw selectors do not push a BEM context. BEM re-entry through `.wrapper`, `&:hover`,
or other arbitrary raw selector wrappers is unsupported, including a root block
under raw `.theme`. Existing output can drop the raw condition without an error;
unsupported does **not** promise automatic detection/rejection. Raw wrappers also
do not legitimize otherwise invalid BEM parent relationships.

Use `selector(':hover')` for supported qualification of the current subject, with
declarations in its body. **Do not** suggest `selector(':hover') { element(...) }`
as a workaround: qualified → element is itself unsupported. Conditional descendants
need a separately designed future capability; raw `&:has(...)` plus BEM re-entry is
not a supported substitute.

Do not promise incidental successful raw behaviors: `&__manual` does not acquire
BEM provenance; raw `.manual` or `&` inside pending relations does not resolve the
RHS; wrapper-loss outputs are observations, not frozen compatibility guarantees.
Raw leaf permission applies where a complete BEM style rule exists, not to pending
frames. Caller `@at-root` and arbitrary at-rules retain the exclusions above.

A focused production regression covers raw `> img` and `&:hover` leaves inside a
nested block, followed by an inner BEM element, an outer BEM element, and an
independent root. It verifies exact owner/scope restoration. Unsupported wrapper
loss is not frozen as production acceptance behavior. D09 is closed.

## 8. Adopted hardening decisions and publication status

| Group | Adopted stable policy | Completed hardening | Core blocker? | Future work |
| --- | --- | --- | --- | --- |
| D03 | Evaluated ASCII token domain | Existing validator retained; evaluated-string semantics documented | No | Broader names only on demand |
| D05 | Stable semantic categories, no exact-text/code API | Three diagnostic messages and private comment updated; focused assertions retained | No | Codes only for a demonstrated tooling need |
| D08 | Tested conditional wrappers and flat layers only | Explicit exclusions documented | No | Targeted integrations only on demand |
| D09 | Terminal raw styling; no raw-wrapper BEM re-entry | Focused leaf/sibling isolation regression | No | Conditional descendants only through a separately designed API |
| D10 | One public entrypoint, unrestricted Sass namespace choice | Final name, root metadata, file allowlist, packed-artifact test | No | Separate publication operation |
| D11 | Stable approved subset; unsupported future semantics unpromised | Runtime rejection retained; no matrix expansion | No | Use-case-driven extensions |

There are no remaining core stability blockers. The package has **not** been
published. A publication still needs an authorized release version, deliberate
removal of `private: true`, registry ownership/access, and appropriate licensing
metadata/terms (the repository currently supplies no license file or field).
Registry availability/credentials and licensing authorization were not inferred
from this local hardening task. These are distribution prerequisites, not reasons
to implement deferred features or redesign the core.

## 9. Post-core future features (non-blocking)

- BEM-aware functional selectors: `:has(...)`, `:not(...)`, `:is(...)`, `:where(...)`.
  This is distinct from the retired legacy `:where()` specificity machinery.
- Possible selector-context chaining and conditional descendants.
- Possible nested CSS Layers, with explicit ordering/selection semantics.
- Broader identifier support only for concrete use cases.
- Deferred relationships, including root/nested extend, only on demonstrated need.
- Focused additional at-rule integrations such as `@scope` when needed.
- Addons/presets for buttons or Atomic Design helpers, outside core semantics.

No feature on this list is begun by this adoption. Legacy theme/path/debug machinery
remains retired, not an implicit future backlog.

## 10. Verification

The pre-adoption review passed 203 production, 265 combined project, and 115 spike
tests. Adoption adds one production raw-leaf regression and one separate packed
package test. Final adoption validation on Node 22.19.0 / Dart Sass 1.104.1:

| Suite | Passing tests |
| --- | ---: |
| Production | 204 |
| Normal project (unit + production) | 206 |
| Characterization | 58 |
| Legacy (smoke + characterization) | 60 |
| Packed package entrypoint | 1 |
| Combined project, including package verification | 267 |
| Selector-engine spike | 27 |
| Context-stack spike | 15 |
| Structural-selector spike | 16 |
| CSS Layers spike | 57 |

Combined project counts include characterization once and exclude spikes (115
spike tests separately). Detailed counts use Node's non-isolated test runner;
ordinary isolated output in the managed environment can count files instead.
All required npm commands, the four spikes, and `git diff --check` pass. Logs are
under ignored `tmp/core-adoption-final-*.log`; legacy warnings are unsuppressed.
The packed test requires subprocess execution; in the managed sandbox it was run
with approval outside the sandbox after subprocess capture failed with EPERM.

Source and export guards confirm one evolving mutable module global, one BEM
emission boundary, immutable derivation, six mixins, three settings, and zero
public functions. No prohibited state or retired machinery was added.

The package remains private and unpublished. Production selector semantics,
legacy captures, and disposable spike source/tests are unchanged.

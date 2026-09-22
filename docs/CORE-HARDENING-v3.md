# Core API hardening: decisions for maintainer review

The approved selector subset is implemented, but the whole API is **not yet
stable**. Of the original 11 hardening decision groups, **6 remain unresolved**:
D03, D05, D08, D09, D10, and D11. Maintainer decisions resolve D01/D02
(separator policy), D04 (public signatures), D06 (retired debug machinery), and
D07 (pending body contract). D11 is partially settled by structural selector
approval; other deferred subset/release decisions remain open.
Optional flat CSS Layers are approved and implemented. D08 is partially resolved
for layers and their tested media/supports/container integration; the broader
at-rule envelope remains open. See [the layer contract](PRODUCTION-v3.md#optional-css-layers).

The original audit used Node 22.19.0 and Dart Sass 1.104.1, with 49 production
observations and 21 read-only legacy observations in the
[separate probes](../audits/core-hardening/README.md). Findings below remain
observations unless explicitly marked as maintainer decisions. This stabilization
records signature, structural-selector, separator, and CSS Layers stabilization. SPEC-v3 now approves
compound qualifiers and pending `+`, `>`, `~`; historical artifacts and existing
spikes remain unchanged. Browser
behavior and other Sass versions were not tested.

## 1. Legacy configuration: what belongs in the core contract?

Sources: legacy [core implementation](../../sass-beminator/src/scss/tools/mixins/tool.beminator.scss),
[shared settings](../../sass-beminator/src/scss/settings/settings.shared-beminator.scss),
[initial settings](../../sass-beminator/src/scss/settings/settings.beminator-init.scss),
[layer settings](../../sass-beminator/src/scss/settings/settings.shared-css-layers.scss),
and [project button settings](../../sass-beminator/src/scss/settings/settings.beminator-project.scss).
The core module is an observable Sass import surface; an exposed variable does
not by itself establish an intentionally documented long-term API.

| Legacy setting | Core relevance | v2 behavior | Needed in v3? | Maintainer decision / remaining work |
| --- | --- | --- | --- | --- |
| `$element-separator: "__" !default` | Direct naming input | Interpolated between owner and element; descendants of modifiers, selector branches, and extends use it | Implemented load-time configuration | D01/D02 RESOLVED: load-time module configuration; policy in section 2 |
| `$modifier-separator: "--" !default` | Direct naming input | Used for both single/double modifier construction, including extend via modifier | Implemented load-time configuration | D01/D02 RESOLVED: same policy |
| `$debug: false !default` | Observable output from core operations | `true` injects `checkProps` comments and multiple `content` declarations into generated rules, not Sass debug logging | No — RETIRED / REMOVE | D06 RESOLVED: do not restore CSS-polluting debug output |
| Error severity/validation toggle | No such dedicated core setting found | `validate-context` throws an unconditional `@error` for its narrow block/extend/block check, with an internal Eurobet URL; debug true/false both throw | Rejections are already mandatory in SPEC-v3; severity is not a compatibility feature | D05: stable diagnostic contract; do not infer a legacy error-disable option |
| `$where-prefix`, `$where-suffix`, `$where-mode` | Related specificity machinery, not BEM separators | Prefix/suffix are declared configurable; component/block setup resets them to empty and mode false. Object helpers set `:where(...)`. Mode originates in imported settings and is mutated internally | No — RETIRED / REMOVE | Old specificity strategy superseded by CSS Layers in real projects |
| `$context-stack: () !default` | Implementation state accidentally public | Stack and push/pop helpers are public; configurable initial stack could affect legacy rejection | No: v3 architecture requires a private stack, not user-supplied history | D10: document internals as unsupported migration surface |
| `$moduleFolder`, `$path-components`, `$path-objects`, `$path-modules`, `$beminator-theme-id` | Theme/path plumbing called from shared block implementation | Builds module/theme lookup paths; defaults are null/empty strings | No — RETIRED / REMOVE | Fragile folder-dependent theme plumbing; not an addon backlog item |
| `$cssLayers`, `$layer`, layer map `pathTheme`/`filePrefix` | Layer/Atomic Design/theme coupling | Layer lookup, wrapping, missing-layer errors and theme-path construction | CSS Layers KEEP as optional v3 capability | Flat registry, root block selection, and explicit ordering implemented; legacy theme-path map coupling is retired |
| `$theme`, `$include-theme`, `$css3Vars...` and related state | Non-core block/extend options and internal plumbing | Optional theme loading/CSS-variable injection; include-theme evolves internally | No — RETIRED / REMOVE for this legacy theme/injection system | No theme arguments or varargs restored; external Sass theme loading instead |
| `$btnSkins`, `$btnSizes`, button prefixes/paths, Atomic Design helpers | Buttons/presets/project conventions | Generates project-specific button CSS and helper behavior | No core dependency to preserve | Existing addon exclusion stands |
| `$block`, `$stored-block`, `$root`, `$wrapper`, `$modifier-check`, `$state-check`, `$nested`, `$state-wrapper`, etc. | Legacy mutable state, not legitimate configuration | Tracks selector history and contributes to legacy leaks | No | No new choice needed: authoritative v3 architecture replaces these |

Historically, the three directly relevant configurable inputs were the two
separators and debug.
The source declares separators/debug with `!default`, making initial module
configuration possible, and the probes also demonstrate public namespace
assignment before calls. No separator validation or formal allowed-value grammar
was found. Do not interpret unrestricted interpolation as a promise to support
arbitrary CSS fragments as separators.

Two nuances matter:

- `trim-parent-class` (around line 499) tests literal `--` and `__` instead of the
  configured separators. `isExtend` (around line 343) hardcodes `--` in a theme
  filename. Selected custom-separator cases pass; this is not proof that every
  legacy path honored separator settings correctly.
- The `where-overrides` probe assigns prefix/suffix but block setup still emits
  `.card__item`. Assigning `bem.$where-mode` separately reports “Undefined
  variable”: this imported binding is not exposed by that module namespace.
  Do not claim a coherent public specificity configuration from the declarations
  alone. The [legacy usage notes](../../sass-beminator/how-to-use.md) associate
  `:where` primarily with the excluded object/component distinction.

`checkProps` also mislabels separator values: its element-separator line uses
`$name`, and its modifier-separator line uses `$element-separator`. This debug
output is historical evidence, not a useful contract to copy.

### Explicit retirement and retention decisions

**RETIRED / REMOVE from v3:** `$debug`, `$where-prefix`, `$where-suffix`,
`$where-mode`, `$moduleFolder`, `$path-components`, `$path-objects`, `$path-modules`,
`$beminator-theme-id`, automatic theme-file discovery/loading, `$theme`,
`$include-theme`, and the legacy CSS-variable/theme injection plumbing tied to
that system. These are explicit maintainer decisions, not unresolved questions
or proposed future addons. Reconsideration would require a new use case.

Rationale: the old `:where()` machinery was an earlier specificity strategy
superseded in real projects by CSS Layers. `$debug` was a development aid from
before automated tests and polluted generated CSS. Automatic theme discovery and
path construction were fragile when project folder architecture changed. Theme
loading now belongs outside BEMinator, using ordinary Sass mechanisms such as
`meta.load-css()` and build-provided theme identifiers. No such loading machinery
is restored here.

**CSS Layers: KEEP — optional v3 capability — implemented.**
Consumers can continue using BEMinator without layers. The approved surface is
`block($name, $layer: null)`, `$css-layers`, and `css-layers()`. Explicit selection
is root-only; nested null/omitted selection inherits lexically. No legacy theme/path
coupling, enable switch, layer stack, current-layer global, or ordering cache returns.

## 2. Separators: approved configuration policy, implemented

**Finding: configurable separators appear architecturally feasible.** Names and
scope are already stored separately, and no production code splits selectors to
recover them. Construction-time separator values now feed suffix construction; immutable
contexts and centralized stack restoration remain unchanged. No evolving runtime context, extra context argument for consumers, or
selector parsing is needed. The approved two public configuration values are now implemented.

With element separator `--` and modifier separator `-`, the legacy probes observe:

| Operation | Result |
| --- | --- |
| block card | `.card` |
| card → element item | `.card--item` |
| card → modifier a,b | `.card-a.card-b` |
| card → element item → modifier a,b | `.card--item-a.card--item-b` |
| element item → selector `:before` | `.card--item:before` |
| element item → selector `+` → element other | `.card--item + .card--other` |
| card → extend icon,a,b | `.card .icon-a.icon-b` |
| same extend → element item | `.card .icon-a.icon-b .icon--item` |
| page → card → modifier active → element item | `.page .card-active .card--item` |

These illustrate the approved configuration policy's construction implications;
they were historical observations and now have production configuration coverage.
A single element modifier would become
`.card--item-active`. Bare block composition does not use a separator.

**D01 and D02 RESOLVED by the maintainer.** Configurable BEM separators are
approved through Sass module configuration at load time. Defaults remain:

```scss
$element-separator: '__';
$modifier-separator: '--';
```

Supported load-time usage (import/publication naming remains D10):

```scss
@use 'sass-beminator' with (
  $element-separator: '-',
  $modifier-separator: '_'
);
```

Both separators must be strings, non-empty, and contain only `-` and `_`.
Equal element/modifier separators are allowed. Naming collisions from custom
conventions are the consumer's responsibility. Changing separators during
stylesheet execution is outside the supported contract. Public Sass variables
can technically be reassigned; the supported contract is load-time configuration,
not intrinsic Sass constness.

Production exports these two separator variables plus `$css-layers` and six
mixins, without changing runtime context transport. Separators are validated at
module load with BEMinator-owned errors naming the setting. **Implementation
limitation:** Sass replaces explicit `null` configuration with the `!default` value
before validation, so null cannot be distinguished from omission or rejected under
this standard configuration surface. This limitation is documented/tested rather
than silently claimed as validation; all other invalid values are rejected. Import/publication details remain
D10; they do not reopen the approved separator surface or value policy.

Collisions need no parsing to detect their possibility. Even today,
`block('card__title')` and `block('card') → element('title')` can select the same
class. With element `--` / modifier `-`, `element('item-active')` and
`element('item') → modifier('active')` both yield `.card--item-active`. Equal
separators can collide between element and modifier names. These are naming-policy
ambiguities, not stack leakage or proof that configuration is infeasible.

## 3. Names and public argument compatibility

The current validator checks the **evaluated Sass string**, not source spelling.
This distinction is important for final documentation.

| Input family | Current observed result | Audit classification / pending choice |
| --- | --- | --- |
| `card-item`, `_Card_2`, `card2`, `c-card` | Accepted; case and characters preserved | A: should continue to work; existing literal-name contract |
| Variables containing valid strings | Accepted | A: ordinary Sass use; no reason to require source literals |
| `'title-#{$suffix}'`, unquoted `#{$base}-#{$suffix}` | Accepted when evaluated value is valid | A: interpolation is not a new selector feature |
| Null, empty string, numbers, lists/maps as names | Rejected (maps by type guard) | B: should fail this string-name API; no coercion requirement |
| Spaces, commas, `.class`, `card:hover` as raw name values | Rejected | B: selector fragments should not bypass the name boundary |
| Digit-only or digit-leading strings | Rejected | B for the current unescaped token API; escape-aware alternatives would require C policy |
| `-card`, `--card` | Rejected by first-character rule | C: decide whether leading-hyphen/custom naming conventions belong in the final domain |
| `café`, `卡片` | Rejected | C: ASCII-only simplicity versus real international identifier needs |
| Sass escape `c\61 rd`, quoted or unquoted | Accepted and normalized to `card` before validation | A for the resulting valid value; documentation must not claim every escape spelling is rejected |
| Escaped leading digit `\31 card` or escaped colon `card\:item` | Decoded value rejected | C if literal escaped CSS identifiers are wanted; requires an escaping policy, not relaxed interpolation |
| Already-BEM names such as `card__item--active` | Accepted | D02 resolved: naming collisions are consumer responsibility; broader identifier domain remains D03 |
| Framework conventions containing `:`, `/`, `!`, brackets, leading dashes | Generally rejected | C: require real use cases; a general CSS parser is not justified |

A/B/C are recommendations for review, not changed semantics. D03 should define
whether API names mean simple tokens, decoded identifier values, or literal
serialized CSS identifiers. Supporting source-level escape preservation would
be a different input model from today's evaluated Sass strings. Broad Unicode
or escaped-selector completeness is not a prerequisite to a useful core API.

**D04 RESOLVED: modifier keyword compatibility restored.** Legacy
`modifier($mod1, $mod2: '')` was documented with named calls in the
[legacy guide](../../sass-beminator/sass-beminator-guide.md) (around lines 220–275).
The audit found that the initial v3 `$name`/`$second` keyword names broke those
calls. Production now uses `$mod1`/`$mod2`, preserving all positional outputs.
The current six public signatures, including approved CSS Layers, are:

```scss
block($name, $layer: null)
element($name)
modifier($mod1, $mod2: null)
selector($name)
extend($name, $mod1, $mod2: null)
css-layers()
```

`modifier('active')` and `modifier($mod1: 'active')` are equivalent; the positional
and named two-modifier forms are likewise equivalent. Omitted `$mod2` equals null.
The legacy empty-string sentinel is not restored. Obsolete v3-only `$name` and
`$second` modifier keywords have no compatibility aliases. The audit probes now
label those calls as obsolete and the legacy-compatible names as supported.

Extend is unchanged and still requires `$mod1`. Element and selector signatures
are unchanged. Block adds the approved optional `$layer` argument. No legacy theme
arguments, varargs, wrapper mixins, or variadic argument parsing are introduced. Current fixed arity and
name validation remain in force. Broader name policy remains D03.

## 4. Diagnostics: stable categories versus compiler-owned wording

| Failure class | Current origin and diagnostic | Advisory stability treatment |
| --- | --- | --- |
| Direct element → element | BEMinator `invalid nesting: element -> element` | Stable BEMinator category worth retaining |
| Direct modifier → modifier | BEMinator `invalid nesting: modifier -> modifier` | Same |
| Block under extend, including indirect descendants | BEMinator `block is forbidden beneath extend` | Same; ancestry prohibition must stay distinguishable |
| Deferred top-level element/modifier/selector/extend | BEMinator `nesting root -> … is deferred; not implemented in this slice` | Stable “unsupported in current subset” category; avoid permanently rejecting the semantic possibility |
| Other deferred relationships | Same BEMinator policy; selector kinds appear as `qualified`/`pending-relation` | Prefer user-facing operation/form names over internal kinds if messages become public |
| Unsupported selector shape/type/family or functional pseudo | BEMinator string, compound-cardinality, token-family, or deferred-function errors; malformed selectors/parent references may fail in Sass parsing | Useful BEMinator categories; D05 still decides wording stability |
| Wrong type/empty name, invalid first character, invalid later character | Three BEMinator name errors | Useful stable categories; may add argument identity (target/mod1/mod2) later |
| Missing/extra/unknown keyword arguments | Sass signature validation | Sass normally gives useful call-site details; custom wrappers are not justified solely for exact wording |
| Obsolete v3-only modifier `$name`/`$second` keywords | Sass signature validation: missing `$mod1` or unknown `$second` | D04 RESOLVED: unsupported aliases; use `$mod1`/`$mod2` |
| Declaration directly inside pending `+`, `>`, `~` | Sass evaluator: `Declarations may only be used within style rules.` | D07 resolved: retain rejection; docs explain the required child element. Wording stability remains D05 |
| Malformed SCSS, invalid source escapes, inaccessible private members, unavailable configuration | Sass parser/module evaluator | Leave compiler-owned unless a concrete consumer need arises |

D05 should settle whether stability means error categories, exact text, codes,
source spans, or some combination. Recommend stable BEMinator-owned categories
for semantic misuse, without promising Sass stack-trace/text stability. Existing
messages say “this slice”; decide version-neutral language before declaring it
stable. No messages were rewritten.

**D07 RESOLVED:** pending `+`, `>`, `~` bodies support resolving element children;
empty bodies emit nothing and direct declarations must fail without acquiring the
left target. Structural-selector approval explicitly preserves this behavior.
Retain the native Sass style-rule diagnostic with actionable usage documentation.
Sass mixins cannot generally inspect content ASTs or catch/relabel evaluator errors;
no custom parser or cleanup machinery is introduced. Diagnostic stability remains
D05, and arbitrary raw wrapper behavior remains D09. This is not a promise that
every possible content block is inspected or sandboxed.

D06 is resolved: legacy `$debug` is retired. No debug/error setting is restored,
and SPEC-v3 mandatory rejection cannot be disabled as a compatibility fix.
Diagnostic-message policy remains D05, distinct from retired debug output.

## 5. At-rules: positive evidence, not blanket support

Probe IDs and full source/CSS are in `tmp/core-hardening/production.json`.

| Probes | Observation | Decision |
| --- | --- | --- |
| `media-outside`, `supports-outside`, `container-outside` | All five operations stay inside the enclosing at-rule; no duplicate selector scope | Approved layer integration; broader D08 remains open |
| Corresponding `*-inside` | At-rule within block content retains all inner output; following element emits outside it with the correct owner | Same |
| Corresponding `*-pending` | At-rule between pending `+` and right-hand element is retained; later modifier uses the original left element outside it | Same |
| `nested-media-supports` | Both wrappers preserved; later sibling remains in media only | Same; not a general at-rule normalization promise |
| `media-ancestry-error` | Extend ancestry survives media/supports and block rejection still occurs | Provenance is independent of at-rule nesting |

No intended wrapper escaped, no duplicate selector appeared, and no parent-context
leak was observed in these probes. Default `@at-root` strips style-rule ancestry
while retaining these at-rules. Ordinary Sass may reorganize/bubble wrappers;
this report records expanded output, not a guarantee of source-shaped formatting.

Layer production tests now cover media/supports/container in both wrapper orders
and around pending RHS elements, with sibling restoration. D08 still needs the
broader supported envelope; this does not generalize to keyframes, descriptor
at-rules, arbitrary directives, or user `@at-root` queries. A diagnostic
probe with pending `+` under `@font-face` also errors; it is not an endorsement of
mixing BEM style rules into descriptor at-rules.

## 6. Raw nesting: useful leaf rules, surprising re-entry

| Probe / pattern | Actual output or error | Assessment, not approval |
| --- | --- | --- |
| block card → raw `> img` | `.card > img`; following element `.card__after` | Useful and predictable raw leaf styling; decide whether documented support belongs in core |
| block card → raw `&:hover`, `&__manual` | `.card:hover`, `.card__manual` | Ordinary Sass leaf behavior; manual names bypass BEM provenance |
| raw `.theme` → root block card | `.card` (no `.theme`) | Surprising if wrapper was intended as scope |
| block card → raw `&:hover` → element title | `.card__title` (no hover) | Conditional selector silently lost; risky if assumed supported |
| block card → raw `.wrapper` → nested block icon / element title | `.card .icon` / `.card__title` (no `.wrapper`) | BEM ancestry is retained, raw ancestry is not |
| element item → raw `&:hover` → modifier active | `.card__item--active` | Same dropped condition |
| raw `&:has(.featured)` → BEM element | `.card__title` without `:has` | Not a solution for deferred conditional-selector work |
| element item → raw wrapper → element other | Direct element/element error | Raw rules do not create a public BEM parent |
| pending `+` → raw `.manual` | Global `.manual` | No adjacent relation; pending context alone is not a selector |
| pending `+` → raw `&` | `.card__item` | Sass lexical parent reference can recreate the left rule despite no emitted pending rule |
| pending `+` → direct declaration | Sass style-rule error | Current guard works for direct declarations, not arbitrary user-created rules |

The raw-wrapper losses follow the authoritative complete-selector boundary;
they are not mutable-stack failures. They can change matching dramatically, so
raw/BEM interleaving needs an explicit contract (D09). Do not infer support from
successful compilation. D07 now settles direct-declaration rejection and resolving
element children, but arbitrary raw wrappers are not sandboxed; that remaining
integration question belongs to D09.

The [legacy draft](../../sass-beminator/draft.md) (around lines 948–1004) discouraged
mixing manual classes and BEM mixins and discouraged raw HTML tags except WYSIWYG
use cases. That is historical guidance, not v3 approval or validation. Possible
maintainer choices include documenting raw leaf rules while excluding BEM
re-entry through raw wrappers, or requiring stronger restrictions later. No
choice is made and no architectural redesign is proposed here.

## 7. Import visibility and package policy

Sass `meta.module-mixins`, `meta.module-functions`, and `meta.module-variables`
confirm that the supported entrypoint exposes exactly **block, element, modifier,
selector, extend, css-layers**, with **zero public functions** and exactly three
public configuration variables: `$element-separator`, `$modifier-separator`,
and `$css-layers`.
The explicit forward allowlist exposes only the approved configuration and mixins,
with no debug helpers.
Private stack access is covered by production tests; the audit also confirms
private derivation cannot be called through a deep import. Context construction
is private derivation, not an exposed constructor.

Consumers can deep-import `src/core/_bem.scss` as a filesystem Sass module. It
exposes the same six mixins, not private helpers. Mixing entrypoint block with
deep-imported element uses the same canonical module instance and compiles
`.card__title`. There is no demonstrated accidental helper exposure, but file
access is not a package privacy boundary. D10 should identify the supported import
path, whether deep imports carry any compatibility promise, and the intended
publication/package entry policy before release. The package remains private;
packaging is unchanged; the approved layer surface is explicitly allowlisted.

Module inspection and source inspection retain exactly one evolving private
module-global value: the context stack. The public-variable surface tests both separator settings and the layer registry,
which are load-time construction inputs rather than evolving lexical state. D10 still covers stable import paths and publication policy.

## 8. Deferred matrix: triage, not new semantics

Every DEFERRED cell in the current matrix is covered below. Categories express
likely investigation priority, not an implementation decision. The extend-ancestor
block prohibition continues to override local deferral.

| Deferred relationship/form | Triage | Reason / evidence needed |
| --- | --- | --- |
| root → element | Likely unnecessary | No owner exists; require a concrete use before introducing owner inference |
| root → modifier | Likely unnecessary | No subject exists |
| root → selector | Requires real use case | Raw Sass already represents free selectors; no implicit BEM owner |
| root → extend (Q01) | Requires real use case | Historical experiment alone is insufficient |
| block → pending relation | Requires real use case | Qualified compounds are now approved here; pending parents remain element-only |
| element → block | Requires real use case | Need semantics for component scope relative to element |
| element → extend | Requires real use case | Need an explicit descendant-target contract |
| modifier → pending relation | Requires real use case | Modified-subject qualification is now approved; relation scope is not |
| modifier → extend | Requires real use case | No approved contextual extend contract |
| selector → block | Requires real use case | Pending versus complete selector semantics differ |
| selector → modifier | Tied to future conditional selector work | Which subject is qualified depends on selector form |
| selector → selector | Tied to future conditional selector work | Chaining/composition cannot be inferred from string concatenation |
| selector → extend | Requires real use case | Pending relation and extend scope require explicit meaning |
| extend → modifier | Likely unnecessary | Existing one/two modifiers already qualify target; element modifiers remain valid |
| extend → selector | Tied to future conditional selector work | Need target-condition scope contract |
| extend → extend (Q02) | Requires real use case | No approved nested retargeting semantics |
| qualified → element | Requires real use case | Qualified bodies support declarations only, regardless of their tokens |
| Functional pseudos and compounds containing them | Tied to future conditional selector work | Structural compound approval does not interpret functional arguments |
| Q07 complete composite outcome | Requires real use case | Constituent valid relationships do not approve this full historical branch |

Legacy automatic theme loading, paths, and their CSS-variable injection system
are **retired**, not addon candidates absent a new use case. CSS Layers are
**implemented as an optional flat capability**; broader at-rule review remains
under D08. Buttons and Atomic Design remain outside the core. None adds a core matrix
cell. D11 can retain deferred relationships while stabilizing the approved subset;
it need not solve them all.

## 9. Future BEM-aware conditions: architecture compatibility only

`:has(...)`, BEM-aware `:not(...)`, `:is(...)`, and `:where(...)` remain deferred.
No reference helper, conditional-selector argument, or final API is proposed.
The existing immutable `owner`/`subject`/`scope` separation provides the naming
facts a future dedicated solution would need. Pure construction can derive more
selector values without adding evolving module globals; ancestry and stack
restoration need not be reintroduced elsewhere.

This is a feasibility assessment, not proof of a future grammar, CSS specificity
policy, browser support, or complete Sass primitive coverage. A dedicated spike
will still be needed after use cases/API semantics are chosen. Raw-wrapper
re-entry demonstrably does not preserve conditions, so it must not be presented
as a workaround. No current architectural obstacle was identified.

## 10. Spike retention: evidence versus duplication

| Existing evidence | Production overlap | Later recommendation |
| --- | --- | --- |
| Selector-engine A–G selectors; H both leaks | Strong coverage by current core/selector/extend tests | Candidates to reduce or move representative examples into docs once stable; no immediate deletion |
| Selector-engine I natural `&` failure, accidental duplicate nesting, identical selector/different provenance | Explains why the architecture exists, beyond output regressions | Retain focused architectural evidence permanently or as executable documentation |
| Selector-engine I/J lexical content arguments and unavailable context | Unique evidence for explicit versus implicit transport tradeoff | Retain compact proof/docs; not ordinary production gating |
| Pure immutable-map and three-valued relationship tests | Some production behavior overlap, but explicit DEFER classification differs from runtime rejection | Retain a focused semantic/model explanation; avoid treating synthetic frames as public API |
| Stack approved outputs and historical leaks | Strong production overlap | Candidates to reduce after stability decision |
| Stack exact-list/depth assertions, recursion and 240 permutation sequences | Production checks isolation indirectly and samples fewer orders | Keep unique integrity/stress evidence; small runtime cost at present |
| Stack identical-CSS provenance proof | Production ancestry checks cover errors but not the entire architectural comparison | Keep focused example |
| Stack privacy/error/compiler reuse | Mostly duplicated by production tests | Potential later consolidation |

The spike's pending `+` runs content differently from production: production
moves pending content outside style rules to reject bare declarations. Do not
promote every spike behavior into production expectations. Spike docs still
contain historical statements such as “src remains empty”; preserve chronology
or add dated historical labeling in a future cleanup rather than rewriting the
experiment's conclusion as if it were current implementation status. No spike
was changed or deleted. Retention is a maintenance recommendation, not an extra
core API decision counted in D01–D11.

## 11. Explicit decisions before calling the API stable

There are **6 unresolved groups** from the original 11. Five are resolved as
recorded below; separator configuration is implemented with the explicit Sass
null-default limitation documented in section 2. The approved flat layer API and
conditional integration partially resolve D08 rather than creating a new group. The whole API is not yet stable.

| ID | Status | Decision or remaining review |
| --- | --- | --- |
| D01 | RESOLVED / IMPLEMENTED | Separator configuration through Sass module configuration at load time |
| D02 | RESOLVED / IMPLEMENTED with Sass limitation | Non-empty strings of `-`/`_` only; equal separators allowed; consumer owns naming collisions; runtime changes unsupported. Sass substitutes defaults for explicit null before validation |
| D03 | UNRESOLVED | Final evaluated-name domain: ASCII/Unicode, leading hyphens, escape treatment |
| D04 | RESOLVED / IMPLEMENTED | `modifier($mod1, $mod2: null)`; positional/named parity; no obsolete aliases or empty-string sentinel; other signatures unchanged |
| D05 | UNRESOLVED | Stable diagnostic categories/text/codes and compiler-owned boundaries |
| D06 | RESOLVED | Retire `$debug`; no legacy debug machinery restored |
| D07 | RESOLVED / IMPLEMENTED | Pending `+`, `>`, `~`: resolving elements, empty output, direct-declaration rejection with native Sass diagnostic; raw wrappers remain D09 |
| D08 | PARTIALLY RESOLVED / still open | Flat CSS Layers API and tested media/supports/container integration approved and implemented; broader at-rule envelope remains open |
| D09 | UNRESOLVED | Raw Sass leaf nesting and BEM re-entry through raw wrappers |
| D10 | UNRESOLVED | Stable import path, deep-import policy, and publication surface |
| D11 | PARTIALLY RESOLVED / still open | Compound qualifiers and three pending relations approved; functional pseudos and selector-context chaining deferred. Other deferred matrix/release boundaries including Q07 and root/nested extend still require review |

The legacy retirement decisions in section 1 also stand; they are not additional
unresolved groups. Structural selector policy is implemented; conditional-selector,
other deferred relationships, raw nesting, imports, and broader at-rules still require
review. Separator configuration and flat layers are implemented; conditional selectors
are not. Multiple qualifier tokens in one call are approved; nested selector
calls remain deferred. See [the selector design decision](SELECTOR-DESIGN-v3.md).

Historical audit validation (before signature stabilization):

`npm run test:production`, `npm test`,
`npm run test:characterization`, and `npm run test:legacy` all passed. Counts were
**93 production tests**, **42 spike tests** (27 selector-engine + 15 context-stack),
and **155 combined project tests**. Both standalone audit probe scripts completed;
expected failures are captured as observations. Existing legacy warnings remain
visible and unsuppressed. Suite logs are `tmp/hardening-*-tests.log`; probe logs
are `tmp/hardening-production.log` and `tmp/hardening-legacy.log`. No production
changes were made during that original audit; the D04 signature change and its focused tests belong to the subsequent stabilization recorded here.


Signature-stabilization validation: **100 production tests**, **42 spike tests**,
and **162 combined project tests** pass on the same Node/Sass versions. All six
requested suites passed, and the current audit probes completed. Seven new
signature tests cover positional/named equivalence, omitted/explicit null,
obsolete keyword rejection, retained empty-name rejection, and unchanged extend
keywords. The architecture guard confirms exactly **one mutable module global**,
**one emission boundary**, and no additional public helpers/functions/variables.
Logs are under ignored `tmp/stabilization-*.log`.


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


## CSS Layers stabilization: completed recovery verification

The interrupted working tree already contained the production implementation,
30 layer tests (202 production tests total), export/architecture guards, the
57-test CSS Layers spike, and the layer sections in SPEC and PRODUCTION.
Recovery completed README and hardening documentation, clarified historical
design decisions, added exact unnamespaced legacy usage coverage, and added
same-layer nested rejection coverage. No production source repair was needed.

Verified on Node 22.19.0 / Dart Sass 1.104.1:

| Suite | Passing tests |
| --- | ---: |
| Production | 203 |
| Normal project (unit + production) | 205 |
| Characterization | 58 |
| Legacy (smoke + characterization) | 60 |
| Combined project (unit + production + legacy + characterization) | 265 |
| Selector-engine spike | 27 |
| Context-stack spike | 15 |
| Structural-selector spike | 16 |
| CSS Layers spike | 57 |

All required npm scripts and all four spike suites pass. Detailed runs use
`--experimental-test-isolation=none` to count individual tests in this environment;
the default isolated reporter counts files. Combined project counts exclude spikes
and include characterization only once. Legacy warnings remain unsuppressed in
`tmp/layers-recovery-*.log`; no historical expected outputs were updated.

Source and export guards confirm six public mixins, three load-time configuration
variables, no public functions, exactly one evolving mutable module-global value
(the private BEM context stack), and exactly one BEM emission boundary. No layer
stack, mutable current-layer value, order history/cache, enable switch, or retired
theme/path/debug/`:where()` machinery exists in production.

Production tests verify strict flat registry lookup, quoted/unquoted string
equivalence, explicit repeatable ordering, lexical inheritance, nested explicit
selection rejection (including the same layer), all approved descendant forms,
custom separators, and media/supports/container integration. The root-only check
uses existing context provenance; no layer field was added.

Ordering belongs before the first layered CSS in the final effective CSS ordering.
Consumers may use `css-layers()` or a manual declaration; external CSS splitting,
extraction, concatenation, and runtime injection remain outside BEMinator's
guarantee. See [the ordering contract](PRODUCTION-v3.md#optional-css-layers).

This CSS Layers task is complete. Six broader hardening groups remain open:
D03 (BEM name domain), D05 (diagnostics), D08 (broader at-rule envelope),
D09 (raw nesting/re-entry), D10 (imports/publication), and D11 (deferred relationships,
functional selectors, Q07 and release scope). Flat layers and their tested
conditional integrations are implemented, not pending decisions.

# Core API hardening: decisions for maintainer review

The approved selector subset is implemented, but the whole API is **not yet
stable**. Of the original 11 hardening decision groups, **6 remain unresolved**:
D03, D05, D08, D09, D10, and D11. Maintainer decisions resolve D01/D02
(separator policy), D04 (public signatures), D06 (retired debug machinery), and
D07 (pending body contract). D11 is partially settled by structural selector
approval; other deferred subset/release decisions remain open.
CSS Layers are retained as a future optional capability; their API/integration
review remains under D08. Approval of a feature is distinct from implementation.

The original audit used Node 22.19.0 and Dart Sass 1.104.1, with 49 production
observations and 21 read-only legacy observations in the
[separate probes](../audits/core-hardening/README.md). Findings below remain
observations unless explicitly marked as maintainer decisions. This stabilization
records signature and structural-selector stabilization. SPEC-v3 now approves
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
| `$element-separator: "__" !default` | Direct naming input | Interpolated between owner and element; descendants of modifiers, selector branches, and extends use it | Approved configurable input; implementation pending | D01/D02 RESOLVED: load-time module configuration; policy in section 2 |
| `$modifier-separator: "--" !default` | Direct naming input | Used for both single/double modifier construction, including extend via modifier | Approved configurable input; implementation pending | D01/D02 RESOLVED: same policy |
| `$debug: false !default` | Observable output from core operations | `true` injects `checkProps` comments and multiple `content` declarations into generated rules, not Sass debug logging | No — RETIRED / REMOVE | D06 RESOLVED: do not restore CSS-polluting debug output |
| Error severity/validation toggle | No such dedicated core setting found | `validate-context` throws an unconditional `@error` for its narrow block/extend/block check, with an internal Eurobet URL; debug true/false both throw | Rejections are already mandatory in SPEC-v3; severity is not a compatibility feature | D05: stable diagnostic contract; do not infer a legacy error-disable option |
| `$where-prefix`, `$where-suffix`, `$where-mode` | Related specificity machinery, not BEM separators | Prefix/suffix are declared configurable; component/block setup resets them to empty and mode false. Object helpers set `:where(...)`. Mode originates in imported settings and is mutated internally | No — RETIRED / REMOVE | Old specificity strategy superseded by CSS Layers in real projects |
| `$context-stack: () !default` | Implementation state accidentally public | Stack and push/pop helpers are public; configurable initial stack could affect legacy rejection | No: v3 architecture requires a private stack, not user-supplied history | D10: document internals as unsupported migration surface |
| `$moduleFolder`, `$path-components`, `$path-objects`, `$path-modules`, `$beminator-theme-id` | Theme/path plumbing called from shared block implementation | Builds module/theme lookup paths; defaults are null/empty strings | No — RETIRED / REMOVE | Fragile folder-dependent theme plumbing; not an addon backlog item |
| `$cssLayers`, `$layer`, layer map `pathTheme`/`filePrefix` | Layer/Atomic Design/theme coupling | Layer lookup, wrapping, missing-layer errors and theme-path construction | CSS Layers KEEP as optional v3 capability | API not designed or implemented here; legacy theme-path map coupling is retired |
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

**CSS Layers: KEEP — optional v3 capability — not implemented in this task.**
Layers remain important to future v3 design, and consumers must be able to use
BEMinator without them. This does not preserve legacy `$layer` parameters or
`$cssLayers` theme/path coupling. The layer API has not been designed.

## 2. Separators: approved configuration policy, implementation pending

**Finding: configurable separators appear architecturally feasible.** Names and
scope are already stored separately, and no production code splits selectors to
recover them. Construction-time separator values could be passed to pure suffix
construction; immutable contexts and centralized stack restoration would remain
unchanged. No evolving runtime context, extra context argument for consumers, or
selector parsing is needed. No configurable-separator implementation was added.

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
they are historical observations, not implemented v3 configuration outputs.
A single element modifier would become
`.card--item-active`. Bare block composition does not use a separator.

**D01 and D02 RESOLVED by the maintainer.** Configurable BEM separators are
approved through Sass module configuration at load time. Defaults remain:

```scss
$element-separator: '__';
$modifier-separator: '--';
```

Intended usage once implemented (not currently available):

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

This task records the decision only. Production still uses fixed `__`/`--` and
exports no configuration variables. A later implementation must honor this policy
without changing runtime context transport. Import/publication details remain
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
The final five public signatures for this phase are:

```scss
block($name)
element($name)
modifier($mod1, $mod2: null)
selector($name)
extend($name, $mod1, $mod2: null)
```

`modifier('active')` and `modifier($mod1: 'active')` are equivalent; the positional
and named two-modifier forms are likewise equivalent. Omitted `$mod2` equals null.
The legacy empty-string sentinel is not restored. Obsolete v3-only `$name` and
`$second` modifier keywords have no compatibility aliases. The audit probes now
label those calls as obsolete and the legacy-compatible names as supported.

Extend is unchanged and still requires `$mod1`. Block, element, and selector
signatures are unchanged. No legacy theme/layer arguments, varargs, wrapper
mixins, or variadic argument parsing are introduced. Current fixed arity and
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
| `media-outside`, `supports-outside`, `container-outside` | All five operations stay inside the enclosing at-rule; no duplicate selector scope | D08: consider approving these ordinary conditional wrappers |
| Corresponding `*-inside` | At-rule within block content retains all inner output; following element emits outside it with the correct owner | Same |
| Corresponding `*-pending` | At-rule between pending `+` and right-hand element is retained; later modifier uses the original left element outside it | Same |
| `nested-media-supports` | Both wrappers preserved; later sibling remains in media only | Same; not a general at-rule normalization promise |
| `media-ancestry-error` | Extend ancestry survives media/supports and block rejection still occurs | Provenance is independent of at-rule nesting |

No intended wrapper escaped, no duplicate selector appeared, and no parent-context
leak was observed in these probes. Default `@at-root` strips style-rule ancestry
while retaining these at-rules. Ordinary Sass may reorganize/bubble wrappers;
this report records expanded output, not a guarantee of source-shaped formatting.

D08 should define the supported at-rule envelope and test it as production
semantics if approved. This audit does not generalize to keyframes, descriptor
at-rules, CSS layers, arbitrary directives, or user `@at-root` queries. A diagnostic
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
selector, extend**, with **zero public functions and zero public variables**.
The explicit forward allowlist does not leak configuration or debug helpers.
Private stack access is covered by production tests; the audit also confirms
private derivation cannot be called through a deep import. Context construction
is private derivation, not an exposed constructor.

Consumers can deep-import `src/core/_bem.scss` as a filesystem Sass module. It
exposes the same five mixins, not private helpers. Mixing entrypoint block with
deep-imported element uses the same canonical module instance and compiles
`.card__title`. There is no demonstrated accidental helper exposure, but file
access is not a package privacy boundary. D10 should identify the supported import
path, whether deep imports carry any compatibility promise, and the intended
publication/package entry policy before release. The package remains private;
no exports or packaging were changed.

Module inspection and source inspection retain exactly one evolving private
module-global value: the context stack. Introducing public configuration later
will change the currently tested public-variable surface when D01/D02 are
implemented. D10 still covers stable import paths and publication policy.

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
**kept as an optional future v3 capability**, with API review still pending under
D08. Buttons and Atomic Design remain outside the core. None adds a core matrix
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
recorded below; approved separator configuration remains implementation work,
not an unresolved policy decision. Layer API design is included in D08 rather
than counted as a new group. The whole API is not yet stable.

| ID | Status | Decision or remaining review |
| --- | --- | --- |
| D01 | RESOLVED | Approve separator configuration through Sass module configuration at load time; implementation pending |
| D02 | RESOLVED | Non-empty strings of `-`/`_` only; equal separators allowed; consumer owns naming collisions; runtime changes unsupported |
| D03 | UNRESOLVED | Final evaluated-name domain: ASCII/Unicode, leading hyphens, escape treatment |
| D04 | RESOLVED / IMPLEMENTED | `modifier($mod1, $mod2: null)`; positional/named parity; no obsolete aliases or empty-string sentinel; other signatures unchanged |
| D05 | UNRESOLVED | Stable diagnostic categories/text/codes and compiler-owned boundaries |
| D06 | RESOLVED | Retire `$debug`; no legacy debug machinery restored |
| D07 | RESOLVED / IMPLEMENTED | Pending `+`, `>`, `~`: resolving elements, empty output, direct-declaration rejection with native Sass diagnostic; raw wrappers remain D09 |
| D08 | UNRESOLVED | Supported at-rule envelope and optional CSS Layers API/integration; Layers KEEP is decided, API is not |
| D09 | UNRESOLVED | Raw Sass leaf nesting and BEM re-entry through raw wrappers |
| D10 | UNRESOLVED | Stable import path, deep-import policy, and publication surface |
| D11 | PARTIALLY RESOLVED / still open | Compound qualifiers and three pending relations approved; functional pseudos and selector-context chaining deferred. Other deferred matrix/release boundaries including Q07 and root/nested extend still require review |

The legacy retirement decisions in section 1 also stand; they are not additional
unresolved groups. Structural selector policy is implemented; conditional-selector,
other deferred relationships, raw nesting, import, and layer questions still require
review. No layer/separator configuration or conditional-selector implementation
is included. Multiple qualifier tokens in one call are approved; nested selector
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

# Core feature completeness and release readiness audit

Audit date: 2026-09-24. Baseline: `a14be1e` (`add BEM-aware has selector`).
Verdict: **CORE FEATURE COMPLETE** for the documented, bounded BEM composition
purpose. **Ready to freeze the core feature set; not yet ready to declare an
externally validated stable release or publish it.** No required missing core
feature or demonstrated production regression was found.

This is a scope/readiness assessment, not approval of deferred syntax. No new
feature, production behavior, performance optimization or architecture change
was implemented. The single immediate engineering recommendation is **one
representative real-project integration validation of the frozen candidate**.
That work was not started here.

## Purpose and evidence

BEMinator owns the construction of BEM class selectors from semantic names and
configured separators, and preserves naming owner, local subject, outer scope
and ancestry through approved Sass compositions. It makes component/state/
descendant styling predictable and independent of previously completed branches.
It also supports explicit flat layer organization and the demonstrated
same-owner-element presence/sibling condition without embedding BEM class strings.

It is not a general CSS selector language, BEM DOM linter, theme framework,
utility generator, browser compatibility layer, or v2 compatibility emulator.
Completeness means satisfying this purpose and the adopted relationships, not
exhausting every possible nesting pair or CSS pseudo-class.

Evidence reviewed:

- [README](../README.md), [SPEC](SPEC-v3.md), [production contract](PRODUCTION-v3.md),
  [stability contract](CORE-STABILITY-v3.md), and [hardening record](CORE-HARDENING-v3.md).
- [Production core](../src/core/_bem.scss) and [entrypoint](../src/_index.scss).
- Production suites for structure, scope, signatures, separators, layers, has,
  validation equivalence, exports and restoration; [packed consumer test](../tests/package/entrypoint.test.js).
- [V2 decisions](V3-BEHAVIOR-REVIEW.md), [characterization](CHARACTERIZATION-v2.md),
  [functional design](FUNCTIONAL-BEM-SELECTORS-DESIGN-v3.md), and historical spikes.
- [Runtime performance conclusions](PERFORMANCE-RUNTIME-PROFILE-v3.md), package
  metadata, and the two competitor projects' primary documentation below.

Current source and tests agree on seven mixins, three configuration variables,
zero public functions, one evolving mutable context stack and one BEM emission
boundary. The stack has two write sites (push/restore), not two mutable globals.
The relationship map is immutable; configuration variables are load-time inputs.
Context remains owner/subject/scope/kind/under-extend, plus relation when pending.

## Required-core criteria

A new capability is REQUIRED BEFORE CORE FREEZE only when a demonstrated ordinary
workflow within this purpose cannot be expressed acceptably without at least one
of these failures:

1. A common BEM relationship is missing, rather than merely lacking a shorthand.
2. Required naming ownership or qualification is lost during a common composition.
3. Consumers must duplicate BEM class construction/separators that the library
   claims to own for that supported workflow.
4. Supported separator or layer configuration fails to propagate correctly.
5. A stable operation has a material semantic hole or contradicts its contract.
6. The ordinary use case requires escaping the API in a way that defeats these
   guarantees, and no meaning-preserving supported composition exists.

Assess frequency and evidence, not just technical possibility. A plausible future
example can justify an optional backlog entry without establishing an ordinary
current requirement. Raw terminal CSS is an acceptable escape hatch; hardcoding
BEM classes is not presented as an equivalent context-aware solution. Convenience,
competitor parity and v2 presence alone are insufficient.

This criterion could overturn this verdict: a representative application needing
strict qualified child/sibling targeting repeatedly would provide evidence that
the currently deferred qualified-relation cell should be reconsidered. The audit
does not dismiss such evidence in advance.

## Feature-status matrix

"Core required?" distinguishes implemented responsibilities from proposed additions.
An optional-core classification is neither scheduled work nor syntax approval.

| Area | Current status | Core required? | Reason | Recommended timing |
| --- | --- | --- | --- | --- |
| block / element / modifier | Implemented, tested | Yes; satisfied | Own naming, single/double modifier construction and isolation | Freeze now |
| extend | Implemented for direct block parent and element descendants | Yes for adopted subset; satisfied | Scoped modified foreign component without owner leakage | Freeze subset |
| selector scope | Implemented for qualified compounds and element-owned pending relations | Yes; satisfied | Context-aware qualification and BEM re-entry | Freeze subset |
| has | One same-owner element, four relations | Yes for demonstrated game-card case; satisfied | Removes hardcoded owner/separator in that real use case | Freeze narrow API |
| not | Designed, not implemented | No; OPTIONAL CORE | Own-state exclusion has useful semantics but no demonstrated unmet current workflow | Only after concrete use case |
| is | Designed, not implemented | No; OPTIONAL CORE convenience | Alternatives can often use ordinary loops/shared declaration mixins | No freeze dependency |
| where | Designed, not implemented | No; OPTIONAL CORE | Exact specificity control is useful but not required to construct BEM relationships | No freeze dependency |
| qualified → modifier | Deferred | No; DEFERRED UNTIL REAL USE CASE | Modifier-first order expresses normal modified-subject qualification | Keep rejected |
| qualified → relation | Deferred | No demonstrated blocker; OPTIONAL CORE candidate | Exact strict relation is absent, but common descendant styling works | Revisit on actual strict-relation need |
| qualified → extend | Deferred | No; DEFERRED UNTIL REAL USE CASE | Qualified → block → modifier expresses common target styling | Keep rejected |
| CSS Layers | Flat registry, root selection, explicit order | Adopted responsibility satisfied | Deterministic library output; final bundle order belongs to consumer | Freeze flat model |
| Separator configuration | Validated load-time settings | Yes; satisfied | Same convention used by all naming operations, including has | Freeze |
| Identifier breadth | Evaluated ASCII token domain | Current domain sufficient | CSS identifier completeness is a separate scope expansion | Defer broader grammar |
| State/theme helpers | Not in core | No; ADDON/PRESET CANDIDATE | Project conventions beyond BEM identity; modifiers/attributes already cover many states | Optional, use-case-led |
| Atomic Design/project/button helpers | Excluded | No; ADDON/PRESET CANDIDATE | Design-system policy and styles, not selector correctness | Outside frozen core |
| Debug tooling | Tests/diagnostics; no runtime debug API | No additional core API needed | Inspection belongs in development tools, not emitted production CSS | Optional tooling |
| Real-project benchmark | Recommended, not recorded for current build | No feature requirement | Measures practical cost and integration confidence | Part of next validation, no synthetic tuning |

## Deferred and unsupported relationships

This inventory covers all unavailable cells in the current SPEC matrix. Status
below is audit disposition, not a change to the runtime VALID/INVALID/DEFERRED
classification. In particular, INTENTIONALLY UNSUPPORTED here does not silently
relabel a SPEC DEFERRED diagnostic category.

| Relationship or input | Audit classification | Reason / available alternative |
| --- | --- | --- |
| root → element / modifier | INTENTIONALLY UNSUPPORTED | No naming owner/subject; establish a block |
| root → selector (qualified or relation) | INTENTIONALLY UNSUPPORTED | No BEM subject; standalone raw Sass already supplies ordinary selectors |
| root → has | INTENTIONALLY UNSUPPORTED; SPEC INVALID | No subject to qualify |
| root → extend (Q01) | DEFERRED UNTIL REAL USE CASE | Standalone block → modifier expresses a standalone modified component |
| block → pending relation | DEFERRED UNTIL REAL USE CASE | Existing RHS relation contract is element-owned; block descendants use block/element composition |
| element → block | DEFERRED UNTIL REAL USE CASE | Direct cross-component placement has no approved current use case; do not insert a dummy qualifier just to bypass the gate |
| element → element | INTENTIONALLY UNSUPPORTED; INVALID | Prevent ambiguous element nesting; sibling declarations and approved scoped descendants already exist |
| element → extend | DEFERRED UNTIL REAL USE CASE | Would expand the target-scoping contract without demonstrated need |
| modifier → modifier | INTENTIONALLY UNSUPPORTED; INVALID | Use the existing two-name conjunction; do not chain suffixes |
| modifier → pending relation | DEFERRED UNTIL REAL USE CASE | Modified-LHS relation semantics are not approved; not needed by current fixtures |
| modifier → extend | DEFERRED UNTIL REAL USE CASE | Ordinary nested block → modifier covers common new-owner composition outside extend ancestry |
| qualified → modifier | DEFERRED UNTIL REAL USE CASE | See detailed assessment below |
| qualified → pending relation | OPTIONAL CORE | Useful missing exact expression, not a demonstrated freeze blocker |
| qualified → extend | DEFERRED UNTIL REAL USE CASE | Common equivalent composition exists; see below |
| pending → block / modifier / qualified / pending / extend / has | INTENTIONALLY UNSUPPORTED in current contract | Resolve RHS element first; pending has no new completed subject. No implicit resolution or selector guessing |
| extend → block at any depth | INTENTIONALLY UNSUPPORTED; INVALID | Explicit ancestry rule; no indirect workaround is approved |
| extend → modifier | DEFERRED UNTIL REAL USE CASE | Extend already accepts one/two target modifiers |
| extend → selector (qualified or relation) / has | DEFERRED UNTIL REAL USE CASE | Direct target qualification remains unavailable; extend → element establishes a supported subject |
| extend → extend (Q02) | DEFERRED UNTIL REAL USE CASE | New retargeting/ancestry semantics; use ordinary block composition when an extend ancestry contract is not needed |
| Q07 complete historical composite | DEFERRED UNTIL REAL USE CASE | No exact-output approval of the whole historical fixture; approved primitives are not revoked |
| raw functional strings in selector() | INTENTIONALLY UNSUPPORTED | Trusted has construction is not an arbitrary functional-selector parser |
| raw wrapper → BEM re-entry | INTENTIONALLY UNSUPPORTED | Raw Sass does not establish BEM context; may silently lose conditions |

No row is REQUIRED BEFORE CORE FREEZE. Rejection is a defined boundary, not an
implementation task merely because the corresponding CSS could exist.

### Qualified → modifier

Useful intent: "style the active card when hovered." Normal BEM modifier
construction makes `.card--active:hover` the natural output. It is not universally
obvious whether a reversed call should instead require `.card:hover.card--active`
(both base and modifier classes), preserve a previously modified subject, or
target an element's base. Those are distinct contracts.

The supported expression is already clean:

```scss
@include bem.block('card') {
  @include bem.modifier('active') {
    @include bem.selector(':hover') { color: red; }
  }
}
// .card--active:hover { color: red; }
```

The audit compiled this exact output. A qualified frame retains owner but no
separate unmodified element subject or original kind. Supporting arbitrary
qualified → own modifier with this representation would need unavailable
provenance or prohibited reconstruction; simply suffixing `.card:hover` is wrong.
Adding a provenance field is not justified by an ordering convenience. No blocker.
The example above does not claim equivalence if the consumer explicitly needs a
base-class conjunction; that would require a separate concrete use case.

### Qualified → relation

`.card__item:hover > .card__child` is coherent and can be useful. The exact
approved BEM-only spelling is missing. Changing to descendant produces
`.card__item:hover .card__child`, which is often the intended practical styling
and is already supported, but differs when grandchildren also match. Moving
hover to the RHS changes which element is hovered and is not an equivalent fix.
`has()` qualifies the left subject; it does not style the right child instead.

For terminal non-BEM descendants, `&:hover > img` is sufficient. For unqualified
BEM siblings/children, the existing element → relation → element path suffices.
For the exact qualified BEM target with strict `>`, `+` or `~`, raw terminal CSS
would need a known BEM class; that is an acknowledged limitation, not a clean
context-aware substitute.

Owner and completed subject suffice to construct the CSS, but qualified kind
does not retain the origin needed to preserve the current element-only relation
authorization. Broadening all qualified origins would be a semantic decision,
not just implementation plumbing. No actual fixture in the reviewed application
evidence requires that stricter relationship. Classify OPTIONAL CORE, and the
most important deferred cell to watch during real-project validation. Do not add
provenance or change the gate merely to complete a matrix.

### Qualified → extend

Conditionally styling another component is meaningful; it does not necessarily
require a dedicated extend path. This current composition was compiled:

```scss
@include bem.block('card') {
  @include bem.selector(':hover') {
    @include bem.block('icon') {
      @include bem.modifier('active') {
        @include bem.element('label') { color: red; }
      }
    }
  }
}
// .card:hover .icon--active .icon__label { color: red; }
```

This changes naming owner explicitly using a supported block, without parsing
the condition. It does not create extend's ancestry prohibition, so it is an
output alternative for this use case, not a replacement for every extend contract.
Direct qualified → extend would also need its future body/ancestry policy to be
approved. No common unmet case was found; no blocker.

## Has breadth and other functional pseudos

Current has solves the demonstrated game-card thumbnail/details case with
configurable separators and all four relations. Scope remains outside the
functional argument. Its qualifier and BEM re-entry reuse the stable qualified
mechanism. No further breadth is required to complete that feature.

| Candidate | Audit classification | Assessment |
| --- | --- | --- |
| has(block, footer) | DEFERRED UNTIL REAL USE CASE | Cross-component presence is plausible, but not demonstrated as a missing current requirement |
| has(element, item, modifier selected) | OPTIONAL CORE | Useful future selected-item presence; private construction is feasible, no concrete release requirement yet |
| has(block, modal, modifier open) | DEFERRED UNTIL REAL USE CASE | Combines two unapproved target extensions; possible is not required |
| has(modifier, active) | INTENTIONALLY UNSUPPORTED as an unspecified target | Does not identify the related base block/element; cannot guess |
| multi-target has | DEFERRED UNTIL REAL USE CASE | Needs OR/list versus repeated-condition semantics; current anchor needs one target |
| not(modifier, disabled) | OPTIONAL CORE | Strongest filtering use case, but no recorded unmet negative-state workflow |
| is(modifier, (compact, dense)) | OPTIONAL CORE convenience | Shared declarations can normally be looped across modifier calls; exact functional selector and specificity are not equivalent |
| where(modifier, compact) | OPTIONAL CORE | Useful low-specificity state filtering; layer ordering is not an exact substitute for zero argument specificity |
| Heterogeneous/functional selector lists | DEFERRED UNTIL REAL USE CASE | Introduces another target language without current necessity |
| Arbitrary raw targets / nested functional arguments | INTENTIONALLY UNSUPPORTED in this core | Beyond trusted BEM target construction; no generic CSS parser promise |

`not()` deserves separate consideration from its siblings. Defaults on the base
rule plus a disabled modifier override often express normal state styling; when
an actual exclusion is necessary, that cascade pattern is not logically identical.
Native attribute/pseudo states can be styled terminally without BEM class strings.
An exact own-modifier exclusion currently lacks a BEM-aware helper. If an actual
component repeatedly requires it, the spike provides a starting point; feasibility
alone does not make it a freeze blocker.

For `is()`, Sass loops or a shared declaration mixin under compact/dense modifier
branches avoid duplicated BEM strings. They produce separate selectors and may
not require the base class as `.card:is(.card--compact, .card--dense)` would.
Do not advertise them as exact selector/specificity replacements.

For `where()`, cascade strategy is a consumer choice. The precise zero-specificity
argument can matter; no such demonstrated contract is needed by this core's
current use cases. It remains optional rather than becoming structural merely
because specificity is important.

All three are **not CORE MISSING FEATURES**. Optional core semantics and optional
packaging are different questions: third-party addons cannot currently recover
private subject provenance. Do not claim these can immediately be implemented as
safe wrappers, expose internals for them, or add an extension API speculatively.
The historical design's direct-block/element restrictions still apply.

## Raw Sass, identifiers and layers

Safe terminal styling includes `&:hover`, `> img`, `&[data-state='open']`, or raw
descendant `[data-state='open']` rules. The `&` decides whether the attribute is
on the current subject; these forms are not interchangeable. Ordinary media,
supports and container wrappers have approved containment behavior, and do not
invent a BEM naming owner. No BEM mixin should re-enter beneath a raw selector.

The audit compiled raw hover → element and observed `.card__title`, losing hover,
while `selector(':hover') → element` preserves it. Context-aware attribute
qualification likewise gives `.card[data-state=open] .card__title`. This is a
well-documented boundary, not a supported call silently claimed to work. Together
with selector/has re-entry and ordinary terminal CSS, the escape-hatch rules are
sufficient for the current purpose. They are not a solution for every deferred
BEM-target relationship.

The evaluated name policy `[A-Za-z_][A-Za-z0-9_-]*` covers documented component
names, custom naming separators, variables and interpolation. Unicode and
leading-hyphen names can be legitimate consumer conventions, but no adopted
fixture requires them. Full CSS identifier grammar, utility-like punctuation and
escape-preserving spellings would add a different token/escaping contract.
Classify them DEFERRED UNTIL REAL USE CASE; utility-class interoperability is
primarily a consumer concern. No naming blocker was found. Equal separators and
already-BEM-looking tokens can collide; documented consumer responsibility is
sufficient, without reverse-parsing names.

Flat layers satisfy current needs. Nested layer maps and additional inheritance
models are optional proposals, not missing core behavior. Automatic order
emission/deduplication is intentionally excluded; it cannot guarantee final
bundler ordering and would add hidden state. Layer metadata and Atomic Design
labels belong in presets/tooling; current registry values are deliberately ignored.
Do not reinterpret them later without a compatibility decision. Root-only explicit
selection and inherited lexical layers are coherent. Consumers must establish
order in their final CSS; the library does not guarantee Next.js or another
bundler's final ordering. No bundler behavior was tested or changed here.

## V2 omissions

The decision record explicitly preserves ordinary BEM naming, conjunction,
scoped target elements and lexical component composition. It changes observed
state leaks instead of adopting every successful legacy compilation.

| V2-only behavior | Classification | Core risk |
| --- | --- | --- |
| C02/C03 sibling-induced extra ancestors | Legacy implementation artifact, deliberately corrected | Restoring it would violate isolation |
| Permissive element → element or modifier → modifier | Intentional removal/rejection | Conflicted with intended forbidden nesting; not a regression |
| Blocks reachable beneath deeper extend paths | Intentional removal/rejection | V3 consistently applies the ancestry prohibition |
| Root/nested extend and Q07 whole-output assumptions | Optional compatibility feature, presently deferred | Historical experiments are not current requirements |
| Theme-path discovery, implicit theme/CSS-variable injection | Intentional removal | Application setup, not BEM selector construction |
| Legacy where-prefix/mode machinery and CSS-polluting debug | Intentional removal | Not the future native where proposal; no revival needed |
| Public mutable parser/stack internals and context leaks | Legacy implementation artifact | Not a compatibility surface |
| Themed buttons, Atomic Design and Eurobet conventions | Intentional core exclusion; addon/preset possibility | No core dependency |
| Legacy coupled layer/theme registry | Intentional replacement | Flat explicit layers preserve the required organization without paths/themes |

**Possible core regression: none identified** in the reviewed approved behavior.
This is not a claim of exhaustive v2 parity; characterization remains bounded
historical evidence. Its output is not automatically the v3 specification.

## Prior art and addon boundary

No persisted dedicated prior-art comparison was located in the checked v3 or
sibling Markdown files. Rather than invent its contents, this audit checked the
named projects' primary READMEs. The comparison is about ideas, not current
maintenance, popularity, performance, or compatibility claims.

[sass-bem](https://github.com/zgabievi/sass-bem#readme) documents a parse/shortcode
DSL, namespace helpers, relation/state/pseudo helpers, and selector-inspection
functions. [BEM Constructor](https://github.com/danielguillan/bem-constructor#readme)
documents namespaced object/component/utility constructors, multiple-target
element/modifier calls, modifies-element, theme/state/scope/hack helpers,
responsive suffixes, immutability rules and a visual debugger.

The following dispositions are this audit's judgments, not competitor claims:

| Idea absent as a dedicated v3 API | Destination | Reason |
| --- | --- | --- |
| Object/component/utility namespace shortcuts | Addon/preset | Naming convention around existing block construction |
| State/theme helpers | Addon/preset or consumer concern | Modifiers/attributes cover basic state; tokens, theme loading and namespacing are application policy |
| modifies-element / ancestor-modifier helpers | Core need already satisfied for adopted cases | modifier → element supplies contextual element styling; no duplicate helper needed |
| Multi-element/alternative modifier calls | Optional convenience/addon candidate | Consumer loops/shared declaration mixins suffice for common repetition |
| Scope/hack helpers | Consumer concern or optional addon | Avoid confusing contextual raw wrappers with supported BEM re-entry |
| Responsive suffix conventions | Preset/consumer concern | Breakpoint naming is not BEM ownership |
| Selector parsing DSL / public provenance inspection | Not desirable in frozen core | Competing input language and reconstruction contradict current boundaries |
| Immutable-object redefinition enforcement | Not desirable in core | Independent repeated roots are an approved behavior |
| Visual debug/logging | Development tooling/addon | No production CSS side effects or new mutable context state |

Conceptually `core/`, `addons/`, and `presets/` is a sensible separation. It is
not a proposal to create those folders or export paths now. Core owns naming,
composition and isolation. Addons opt into related behavior; presets supply
conventions/styles; consumer tools own builds, diagnostics and deployment.
Wrappers must use supported public operations and preserve context semantics.
Any addon needing private provenance requires a separately justified extension
design, not deep imports or serialized-selector recovery. Migration compatibility
must never reintroduce legacy leaks into core. No addon interface is a prerequisite
to feature freeze.

## API freeze assessment

The seven mixins form a coherent bounded API. Identity arguments precede optional
configuration. `modifier($mod1, $mod2)` is consistent with extend's modifier names.
`has($type, $name, $relation)` is intentionally explicit even with one target kind.
`selector($name)` is less descriptive than `$selector`, and `extend` can be mistaken
for native Sass inheritance, but both are documented existing commitments; this
audit does not justify a breaking rename.

Before publishing a stable version, release documentation must preserve these
compatibility decisions explicitly:

- Parameter names are keyword-call API: `$name`, `$mod1`, `$mod2`, `$type`,
  `$relation`, `$layer`. Do not rename them during release cleanup.
- Two modifiers mean conjunction, not alternatives. Has takes one target; do not
  later reinterpret its relation position as another target or modifier.
- Null means omitted optional value; empty string is not an alias. Configuration
  null uses Sass defaults, and runtime variable reassignment is unsupported.
- `extend()` constructs a scoped target; it is not native `@extend` inheritance.
- `selector()` remains a restricted input API, not an arbitrary CSS promise.
- Registry values are ignored; deep imports and private helpers are unsupported.
- Semantic error categories are stable, exact diagnostic text is not.

No unresolved signature decision requires blocking the feature freeze. Optional
future functionality must respect these commitments; do not expand the present
7/3/0 surface solely to reserve names or extension hooks.

## Documentation and test completeness

The README and linked stable docs explain the purpose, entrypoint/resolver,
selector versus raw re-entry, has, invalid/deferred relationships, layer ordering
and configured separators. The detailed nesting matrix is discoverable in SPEC.

One actual documentation inconsistency was corrected: README-linked
`ARCHITECTURE.md` still said there was no implementation and listed only five
candidate mixins. Its opening now points to the current seven-mixin contract.
No historical design, snapshot, expectation or production behavior was changed.

Remaining release-documentation work (not feature blockers):

- A compact release/migration note consolidating intentional v2 differences,
  the raw-re-entry boundary and the meaning of extend.
- A consumer compatibility statement distinguishing the tested Dart Sass 1.104.1
  baseline, supported development Node engines, and the browser features emitted
  by has/layers. Do not imply arbitrary Sass/browser-version support.
- A concrete consumer setup example and browser/integration evidence for the
  intended host application; the resolver requirement is documented, but the
  repository's package smoke test is not a real application build.
- Licensing terms/metadata and release version notes. Stable docs contain
  historical reports as well as current contracts; mark release-facing material
  clearly rather than rewriting historical evidence.

| Coverage class | Audit finding |
| --- | --- |
| Must add before core feature freeze | None identified: every adopted major semantic family has production assertions |
| Existing production coverage | Exact naming/scope/conjunction, invalid transitions, named signatures, separators, layers/order, parser closure, has parents/relations/pseudo-element guard, empty branches, sibling/root/stack restoration, ancestry and compiler reuse |
| Architecture/public surface | Runtime Sass reflection and source guards cover 7/3/0, one evolving stack, one emission boundary, and unchanged old validation/parser/derivation outside approved additions |
| Package evidence | Existing offline packed consumer exercises all seven mixins, custom settings and importer URLs; prior adoption pass is recorded, not rerun in this documentation audit |
| Nice-to-have focused regressions | has combined with media/supports/container wrappers, direct consecutive has qualifications, and declarations surrounding a has child; generic emission/scope coverage already supports these, so no combinatorial suite expansion is warranted |
| Historical spike-only evidence | not/is/where, filter lists, block/modified-element targets and broader API experiments; no production coverage is owed for unapproved features |
| Release integration gap | No representative application/browser/build validation for the current candidate was found; tests compile selectors rather than validate rendered DOM behavior |

Bounded read-only audit compiles verified modifier-first qualification, qualified
block/modifier target composition, standalone block/modifier replacement for
root extend, qualified descendants, raw terminal/re-entry contrast, and attribute
scope. Three has + conditional-wrapper probes retained the expected target and
layer. These are audit observations, not newly approved behavior or a substitute
for maintained exact-CSS tests. The strict qualified-relation rejection was also
confirmed. No test files were added or changed.

Historical spikes with source-identity guards may intentionally stop matching
evolved production. Do not refresh them merely to make an all-files command pass;
the maintained npm test suite is the current production gate.

## Performance and release readiness

Synthetic performance work is complete for now. The runtime report recommends
real-build measurement before more tuning; it does not establish that the
remaining synthetic difference is a practical application problem. Its source
hash predates has, so do not present its measurements as a current-has benchmark.
No benchmark was run in this audit.

| Decision | Does absent real-project performance evidence block it? |
| --- | --- |
| Core feature freeze | No; performance evidence does not identify a missing semantic capability |
| Stable release sign-off | A representative integration/build check is recommended as a release gate; include observed build cost, not a standalone exhaustive benchmark campaign |
| npm publication | Not a registry technical prerequisite; follow the stable-release validation gate before publishing this as stable |

No performance threshold or cross-project guarantee is invented. A practical
problem, if observed, should be triaged on its evidence without reopening
synthetic tuning automatically.

| Readiness category | Finding / blocker | Disposition |
| --- | --- | --- |
| CORE FEATURE BLOCKERS | None demonstrated | Freeze the documented scope |
| STABLE RELEASE BLOCKERS | Representative consumer build/runtime validation absent | Recommended release-confidence gate; validate current subset, not new features |
| STABLE RELEASE BLOCKERS | Release version/notes and explicit consumer compatibility baseline not finalized | Prepare before declaring a stable distribution |
| STABLE RELEASE BLOCKERS | No license field or license file located | Maintainer must choose/authorize distribution terms; audit supplies no license decision |
| NPM PUBLICATION BLOCKERS | `private: true` | Deliberate publication gate; change only in an authorized release task |
| NPM PUBLICATION BLOCKERS | Version is `0.0.0` | Not intrinsically invalid for npm, but not the intended stable release version; align metadata/lockfile/tag |
| NPM PUBLICATION BLOCKERS | Registry name ownership/access/authentication unverified | Verify for release; no claim that access is unavailable |
| NPM PUBLICATION BLOCKERS | Stable-release gates above unfinished | Publication readiness must not be inferred from feature completeness |
| Nonblocking metadata follow-up | Repository/homepage/bugs links absent | Improve package discoverability in release preparation |

The package already has a coherent Sass entrypoint, conditional export, file
allowlist, private implementation included in the artifact, zero runtime
dependencies, and an offline packed consumer test. Those are positive readiness
evidence, not proof of registry access. The Node engine range includes 22.19+ on
22 and Node 24; this audit ran on Node 22.19.0 only. Validate any broader claimed
consumer toolchain during release preparation. No registry credentials, live
publication attempt, bundler install, licensing change or release mutation was
performed.

## Definition, verdict and one next action

**BEMinator v3 core is feature-complete when ordinary adopted BEM naming and
component/state/descendant composition can be expressed without reconstructing
ownership, supported conditions preserve context, configuration and isolation
hold across those operations, the demonstrated relational use case works, and
all remaining unsupported forms have explicit boundaries rather than concealed
semantic holes.**

The current repository meets that definition. Verdict: **CORE FEATURE COMPLETE**.
There are no remaining required core additions or must-add freeze tests found by
this audit. Qualified → relation and exact own-modifier filtering are known
limitations with potential future value, not evidence to silently broaden the
approved contract or postpone freeze indefinitely.

**Single immediate engineering action: perform one representative real-project
integration validation of the frozen candidate.** Use the existing API in an
actual component stylesheet/build, check emitted selectors/layer order and the
game-card DOM behavior, and record practical build cost. This is one validation
exercise, not a request to build an addon system, implement deferred pseudos or
launch another synthetic performance investigation. It was not executed here.

Later backlog, explicitly uncommitted: release metadata/licensing/notes; focused
consumer-discovered compatibility fixes; qualified relations or own-state filters
only with demonstrated need; selected-element has breadth only with an actual
case; optional convention/theme/state/debug/migration packages only after their
extension needs are clear. No folder layout or extension interface is created.

## Verification and production integrity

`npm test` passes on Node 22.19.0 / Dart Sass 1.104.1 (11 test files, zero failing
files; the sandbox runner summarizes isolated files rather than individual test
cases). Public API and architecture assertions pass within that suite.
`git diff --check` and a separate new-document whitespace check pass.

Before and after SHA-256 values are identical:

| File | SHA-256 |
| --- | --- |
| `src/core/_bem.scss` | `7ff98bb99d6101220d8674249e588a907c4ed09410b74a4809cac0ae9402f31f` |
| `src/_index.scss` | `3f7ef28ba32eab9b82fee471e9356aa3538e930381c9fc4f0c487fd6b6f7369a` |

Files changed by this audit: this new report and the small current-status
correction in `docs/ARCHITECTURE.md`. Source, API, tests, package metadata,
dependencies, historical spike evidence and the read-only legacy repository are
unchanged. No recommendation in this report has been implemented.

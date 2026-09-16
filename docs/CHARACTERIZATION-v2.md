# Sass BEMinator v2: first behavioral characterization

This is historical evidence, **not the v3 specification**. No core implementation
has been added. The legacy repository was only read and compiled; no legacy files
or dependencies were changed. No themes, buttons, or Atomic Design helpers were
characterized.

## Reference and method

The entire 230-line [historical playground](../../sass-beminator/src/scss/objects/standard-object/objects.standard-object.scss)
was read, including disabled branches and the stress tree. Source line numbers
below refer to that file at the captured revision, not generated fixture lines.

- Legacy revision: `18cf5ec052ae6acfafdca5ca6841dd37161a2032` (working tree clean at capture).
- Source SHA-256: `48835279637f06a7d0f9fbd312f249e4d16bafffb1a30e8a111c3350556e560f`.
- Compiler: Dart Sass `1.104.1` from the v3 lockfile, on Node.js `v22.19.0`.
- The legacy lockfile originally pinned Sass 1.83.4. These observations use the
  current harness compiler; they do not claim to reconstruct that earlier compiler.
- `helpers/legacy.js` supplies the direct module under `bem`. Imports at source
  lines 1–3 are replaced by that adapter. The project button maps and Webpack
  alias are unnecessary for these core cases.
- Atomic fixtures retain names and identifying `content` declarations, remove
  unrelated ancestors/siblings, and normally omit `$layer: 'atoms'`. The complete
  active-sequence fixture retains both original blocks, order, `$theme: false`,
  and the original `atoms` layer arguments. This preserves context without
  introducing theme/preset characterization. Differences are recorded, not erased.
- Successful output is stored as compiled expanded CSS with the helper's LF line
  normalization. No selector, combinator, specificity, or rule-order normalization
  is performed. Quotes/formatting reflect Sass output. No expected selector was
  handwritten. `.css` files may have no final newline, as returned by Sass.
- Failed compilations store the exact `sassMessage`, the captured Sass diagnostic,
  and whether the API returned CSS. Portable negative assertions compare the exact
  message and absence of returned CSS; diagnostic stack paths are for review,
  since Sass formats them relative to the working directory.

## Counts and source coverage

There are **24 active labelled rule-producing observations**: 17 classified
`ACTIVE_INTENTIONAL`, six inside the labelled fixed-bug section plus the final
independent-block observation classified `ACTIVE_REGRESSION` (the latter inferred).
This counts declaration-bearing scenarios, not every wrapper invocation. The
complete regression and complete active program are also tested as sequences;
they are not counted again as separate historical leaves.

The suite contains **37 fixture outcome tests**: 21 small core/atomic fixtures,
three regression sequences, six fixtures investigating three ERROR comments
(each alone and after history), and seven exploratory fixtures. A further
**21 state-isolation tests** give **58 characterization tests** in total.
The ERROR investigations yield two actual negative tests and four successful
compilations contradicting their comments. Seven exploratory investigations
include six bottom-stress extractions/controls and the disabled regression branch.
The 21 isolation tests include 18 top-level comparisons and three same-parent
sibling comparisons; two of the latter expose a leak.

### Every active historical observation

All outputs in this table are taken from the **complete active sequence**, so
its layer wrappers and preceding state are retained. Every rule is inside
`@layer atoms`; H24 is in the second emitted layer block. The final column notes
where isolated output differs. Patterns list public mixins and use `→` for nesting.
`modifier(2)` / `extend(2)` mean two modifier arguments; brackets denote siblings.
Every row is active code. Labels are preserved in the fixtures/snapshots.

| ID / source lines | Mixins / nesting | Apparent intent | Classification | Observed selector in complete program | Notes / uncertainty |
| --- | --- | --- | --- | --- | --- |
| H01 / 5-6 | block | Basic block declaration; label `content` | ACTIVE_INTENTIONAL | `.standard-object` | No discrepancy in extracted counterpart. |
| H02 / 14-15 | block → modifier | Single block modifier; label `single modifier applied to block` | ACTIVE_INTENTIONAL | `.standard-object--modifier` | No discrepancy in extracted counterpart. |
| H03 / 14-18 | block → modifier → element | Element under modified block; label `single modifier applied to elements change a nested-element` | ACTIVE_INTENTIONAL | `.standard-object--modifier .standard-object__nested-element` | No discrepancy in extracted counterpart. |
| H04 / 27-28 | block → modifier(2) | Conjunctive double block modifiers; label `double modifier applied to block` | ACTIVE_INTENTIONAL | `.standard-object--modifier-1.standard-object--modifier-2` | No discrepancy in extracted counterpart. |
| H05 / 27-31 | block → modifier(2) → element | Element under double-modified block; label `double modifier applied to block change a nested-element` | ACTIVE_INTENTIONAL | `.standard-object--modifier-1.standard-object--modifier-2 .standard-object__nested-element` | No discrepancy in extracted counterpart. |
| H06 / 40-41 | block → element | Basic element; label `element` | ACTIVE_INTENTIONAL | `.standard-object__element` | No discrepancy in extracted counterpart. |
| H07 / 49-50 | block → element → modifier | Single element modifier; label `single modifier applied to elements` | ACTIVE_INTENTIONAL | `.standard-object__element--modifier` | No discrepancy in extracted counterpart. |
| H08 / 49-53 | block → element → modifier → element | Modify another element under modified element; label `single modifier applied to elements change a nested-element` | ACTIVE_INTENTIONAL | `.standard-object__element--modifier .standard-object__nested-element` | No discrepancy in extracted counterpart. |
| H09 / 62-63 | block → element → modifier(2) | Double element modifiers; label `double modifier applied to elements` | ACTIVE_INTENTIONAL | `.standard-object__element--modifier-1.standard-object__element--modifier-2` | No discrepancy in extracted counterpart. |
| H10 / 62-66 | block → element → modifier(2) → element | Another element under double-modified element; label `double modifier applied to elements change a nested-element` | ACTIVE_INTENTIONAL | `.standard-object__element--modifier-1.standard-object__element--modifier-2 .standard-object__nested-element` | No discrepancy in extracted counterpart. |
| H11 / 75-77 | block → element → selector(':before') | Append pseudo-element selector; label `before` | ACTIVE_INTENTIONAL | `.standard-object__element:before` | No discrepancy in extracted counterpart. |
| H12 / 85-89 | block → element → selector('+') → element | Adjacent-sibling relation; label `element-2` | ACTIVE_INTENTIONAL | `.standard-object__element + .standard-object__element-2` | No discrepancy in extracted counterpart. |
| H13 / 98-100 | block → block | Nested block without extend modifier scope; label `BLOCK INSIDE BLOCK` | ACTIVE_INTENTIONAL | `.standard-object .icon` | No discrepancy in extracted counterpart. |
| H14 / 108-111 | block → element → modifier → block | Regression: nested icon; label `BLOCK INSIDE BLOCK` | ACTIVE_REGRESSION | `.standard-object .standard-object__gigi--fatherdMod .icon` | Isolated fixed-bug section lacks the leading `.standard-object`; preceding H13 changes it. Human review. |
| H15 / 108-113 | block → element → modifier → block → modifier | Regression: modifier on nested icon; label `BLOCK INSIDE BLOCK WITH SINGLE MODIFIER` | ACTIVE_REGRESSION | `.standard-object .standard-object__gigi--fatherdMod .icon--mod` | Isolated fixed-bug section lacks the leading `.standard-object`; preceding H13 changes it. Human review. |
| H16 / 108-124 | block → element → modifier → block → element → modifier | Regression: nested icon element modifier; label `nestedMod` | ACTIVE_REGRESSION | `.standard-object .standard-object__gigi--fatherdMod .icon__nested-element--nestedMod` | Isolated fixed-bug section lacks the leading `.standard-object`; preceding H13 changes it. Human review. |
| H17 / 126-127 | block → element → modifier → element | Regression: pippo after nested icon; label `pippo` | ACTIVE_REGRESSION | `.standard-object .standard-object__gigi--fatherdMod .standard-object__pippo` | Isolated fixed-bug section lacks the leading `.standard-object`; preceding H13 changes it. Human review. |
| H18 / 126-132 | block → element → modifier → element → modifier | Regression: modifier on pippo; label `mod` | ACTIVE_REGRESSION | `.standard-object .standard-object__gigi--fatherdMod .standard-object__pippo--mod` | Isolated fixed-bug section lacks the leading `.standard-object`; preceding H13 changes it. Human review. |
| H19 / 133-135 | block → element → modifier → element | Regression: next sibling test-ele; label `test-ele` | ACTIVE_REGRESSION | `.standard-object .standard-object__gigi--fatherdMod .standard-object__test-ele` | Isolated fixed-bug section lacks the leading `.standard-object`; preceding H13 changes it. Human review. |
| H20 / 148-150 | block → extend | Extend icon with one modifier; label `EXTENDED PATTERN WITH SINGLE MODIFIER` | ACTIVE_INTENTIONAL | `.standard-object .icon--mod1` | No discrepancy in extracted counterpart. |
| H21 / 152-156 | block → extend → element | Element scoped by single-modifier extend; label `EXTEND WITH SINGLE MODIFIER APPLIED to AN ELEMENT` | ACTIVE_INTENTIONAL | `.standard-object .icon--mod1 .icon__nested-element` | No discrepancy in extracted counterpart. |
| H22 / 158-160 | block → extend(2) | Extend icon with two modifiers; label `EXTENDED PATTERN WITH DOUBLE MODIFIER` | ACTIVE_INTENTIONAL | `.standard-object .icon--mod1.icon--mod2` | No discrepancy in extracted counterpart. |
| H23 / 162-166 | block → extend(2) → element | Element scoped by double-modifier extend; label `EXTEND WITH DOUBLE MODIFIER APPLIED to AN ELEMENT` | ACTIVE_INTENTIONAL | `.standard-object .icon--mod1.icon--mod2 .icon__nested-element` | No discrepancy in extracted counterpart. |
| H24 / 208-212 | second block → element | Independent block after previous complete block; label `ciao` | ACTIVE_REGRESSION | `.standard-object__ciao` | Isolation intent inferred from placement, not a comment. Standalone ciao output matches; original layer retained only in full sequence. |

### Commented cases and non-core setup

Commented code is treated as evidence, not obsolete code. These entries cover
all non-active code scenarios; decorative headings are associated with their
following cases rather than counted as independent behavior.

| ID / source lines | Mixins / nesting | Active? | Apparent intent | Classification | Observed result / notes |
| --- | --- | --- | --- | --- | --- | --- |
| C01 / 170–179 | block → extend → block | Commented | Explicit forbidden nesting | COMMENTED_EXPECTED_ERROR | BEMinator error, both isolated and after active prefix; no CSS returned. |
| C02 / 183–192 | block → element → element | Commented | Explicit forbidden nesting | COMMENTED_EXPECTED_ERROR | **Contradiction:** succeeds twice, emitting two identical `.standard-object__test-element` rules. |
| C03 / 196–205 | block → modifier → modifier | Commented | Explicit forbidden nesting | COMMENTED_EXPECTED_ERROR | **Contradiction:** succeeds twice; nested suffix becomes `--test-element--test-element`. |
| X01 / 114–118, ancestors 108–113 | block → element → modifier → block → modifier → element → modifier | Commented | Alternative nested-element location inside icon modifier | COMMENTED_EXPERIMENTAL | Apparently supported: `.standard-object__gigi--fatherdMod .icon--mod .icon__nested-element--nestedMod`. Intent of disabling it is unknown. |
| X02 / 216–219 | extend(2) → extend(2) | Commented | Nested extends stress test | COMMENTED_EXPERIMENTAL | Apparently supported: `.extend--mod1.extend--mod2 .icon--mod1.icon--mod2`. No support claim inferred. |
| X03 / 216–217, 224–225 | extend(2) → block | Commented | Plain block under extend | COMMENTED_EXPERIMENTAL | Apparently supported: `.extend--mod1.extend--mod2 .icon`. Unlike C01, no outer block. |
| X04 / 216–223 | extend(2) → extend(2) → block | Commented | Nested extend then block | COMMENTED_EXPERIMENTAL | Apparently supported; deepest `.extend--mod1.extend--mod2 .icon--mod1.icon--mod2 .icon`. C01's error does not generalize to all extend ancestors. |
| X05 / 216–217, 224–229 | extend(2) → block → block | Commented | Repeated icon nesting | COMMENTED_EXPERIMENTAL | Ambiguous repeated-name descendants: `.extend--mod1.extend--mod2 .icon .icon`. Compiles; repetition may be intentional. |
| X06 / derived from 224–228 | block → block → block | Derived from commented branch | Remove extend as a depth-control experiment | COMMENTED_EXPERIMENTAL | `.standard-object .icon .icon`; ambiguous intent. Outer plain block is an explicit derived control, not verbatim source. |
| X07 / 216–230 | extend → [extend → block, block → block] | Commented | Complete bottom stress sequence | COMMENTED_EXPERIMENTAL | Compiles all five declaration rules in order. Repeated-name descendants need review; no compiler/runtime failure. |
| N01 / 1–3 | module imports | Active | Alias-based library wrapper, project settings, Sass meta | NON_CORE | Adapter uses the direct public module; unused project button maps and meta import are omitted. No separate CSS behavior investigated. |
| N02 / 5, 208 | block options `$theme: false`, `$layer: 'atoms'` | Active | Playground layer context | NON_CORE (configuration aspect only) | Original options retained in complete sequence; no theme loading occurs. Two atoms layer blocks are emitted. Not a general layer/preset characterization. |
| N03 / 214 | meta.load-css(theme file) | Commented | Load themed companion | NON_CORE | Not compiled: explicitly outside this phase. |

No standalone source scenario needs `UNCLEAR` as its primary classification:
uncertainty about intent is recorded alongside `COMMENTED_EXPERIMENTAL` and the
inferred final-block regression. None is treated as obsolete.

## Historical regression: complete structure and observed discrepancy

`regression/complete.scss` preserves the entire active section at lines 108–138,
including the order of **both nested and sibling** calls:

```text
block standard-object
└─ element gigi
   └─ modifier fatherdMod
      ├─ block icon
      │  ├─ declaration
      │  ├─ modifier mod → declaration
      │  └─ element nested-element → modifier nestedMod → declaration
      ├─ element pippo
      │  ├─ declaration
      │  └─ modifier mod → declaration
      └─ element test-ele → declaration
```

The disabled element/modifier branch inside `icon → modifier` is a separate
exploratory fixture. The smaller nested-block fixtures and
`regression/sibling-elements.scss` isolate subcases. The full active-sequence
fixture also preserves earlier modifiers, selectors, the preceding `icon`,
subsequent extends, and the final second block. It is not reduced to atomic tests.

In the isolated complete regression, all six rules begin with
`.standard-object__gigi--fatherdMod`. After the preceding sibling `block('icon')`
from lines 98–100, every one acquires an additional `.standard-object` ancestor.
The dedicated sequence comparison reproduces this **without layers**, so this
difference cannot be dismissed as a layer-only artifact. The source comment says
a particular bug was resolved in 2.0, but does not identify its expected output.
We therefore cannot establish that this is the exact old bug or that the comment
is false. We can establish an observable, surviving context-isolation violation.

## State-isolation evidence

Each test compiles B alone and A followed by B in **separate fresh compilations**.
Within A+B the same legacy module instance is used. Eighteen tests vary six A
scenarios across plain block, element/modifier, and double-extend/element B probes.
Three additional tests use identical public ancestor calls and vary only a
preceding sibling A. No test reads or changes legacy internal variables.

Loud `@at-root` comment markers delimit B's emitted CSS. The comparison trims
only outer whitespace between the markers, preserving all rules, selectors,
combinators, and their order. Both entire CSS outputs and both composed SCSS
inputs are committed for review, and tests check them against their recipes.

Known violations are named **KNOWN STATE LEAK**, assert the recorded difference,
and retain exact before/after CSS. These are passing tests of historical evidence,
**not passing assertions of the desired isolation property** and not instructions
to reproduce the leak in v3. The other tests assert actual equality. There are no
skipped tests, TODO failures, or hidden compiler errors.

| ID | A before B / scope | B alone vs after A | Result | Human review |
| --- | --- | --- | --- | --- |
| `after-regression--plain-block` | `regression/complete.scss` → `state-isolation/probes/plain-block.scss`; independent top-level scenarios | Exact probe CSS equal. [compare artifacts](../characterization/v2/state-isolation/after-regression--plain-block/sequence.css) | Equivalent | No discrepancy observed |
| `after-regression--element-modifier` | `regression/complete.scss` → `state-isolation/probes/element-modifier.scss`; independent top-level scenarios | Exact probe CSS equal. [compare artifacts](../characterization/v2/state-isolation/after-regression--element-modifier/sequence.css) | Equivalent | No discrepancy observed |
| `after-regression--extend-element` | `regression/complete.scss` → `state-isolation/probes/extend-element.scss`; independent top-level scenarios | Exact probe CSS equal. [compare artifacts](../characterization/v2/state-isolation/after-regression--extend-element/sequence.css) | Equivalent | No discrepancy observed |
| `after-history--plain-block` | `regression/historical-active-sequence.scss` → `state-isolation/probes/plain-block.scss`; independent top-level scenarios | Exact probe CSS equal. [compare artifacts](../characterization/v2/state-isolation/after-history--plain-block/sequence.css) | Equivalent | No discrepancy observed |
| `after-history--element-modifier` | `regression/historical-active-sequence.scss` → `state-isolation/probes/element-modifier.scss`; independent top-level scenarios | Exact probe CSS equal. [compare artifacts](../characterization/v2/state-isolation/after-history--element-modifier/sequence.css) | Equivalent | No discrepancy observed |
| `after-history--extend-element` | `regression/historical-active-sequence.scss` → `state-isolation/probes/extend-element.scss`; independent top-level scenarios | Exact probe CSS equal. [compare artifacts](../characterization/v2/state-isolation/after-history--extend-element/sequence.css) | Equivalent | No discrepancy observed |
| `after-selector--plain-block` | `core/selector/adjacent-element.scss` → `state-isolation/probes/plain-block.scss`; independent top-level scenarios | Exact probe CSS equal. [compare artifacts](../characterization/v2/state-isolation/after-selector--plain-block/sequence.css) | Equivalent | No discrepancy observed |
| `after-selector--element-modifier` | `core/selector/adjacent-element.scss` → `state-isolation/probes/element-modifier.scss`; independent top-level scenarios | Exact probe CSS equal. [compare artifacts](../characterization/v2/state-isolation/after-selector--element-modifier/sequence.css) | Equivalent | No discrepancy observed |
| `after-selector--extend-element` | `core/selector/adjacent-element.scss` → `state-isolation/probes/extend-element.scss`; independent top-level scenarios | Exact probe CSS equal. [compare artifacts](../characterization/v2/state-isolation/after-selector--extend-element/sequence.css) | Equivalent | No discrepancy observed |
| `after-extend--plain-block` | `core/extend/double-element.scss` → `state-isolation/probes/plain-block.scss`; independent top-level scenarios | Exact probe CSS equal. [compare artifacts](../characterization/v2/state-isolation/after-extend--plain-block/sequence.css) | Equivalent | No discrepancy observed |
| `after-extend--element-modifier` | `core/extend/double-element.scss` → `state-isolation/probes/element-modifier.scss`; independent top-level scenarios | Exact probe CSS equal. [compare artifacts](../characterization/v2/state-isolation/after-extend--element-modifier/sequence.css) | Equivalent | No discrepancy observed |
| `after-extend--extend-element` | `core/extend/double-element.scss` → `state-isolation/probes/extend-element.scss`; independent top-level scenarios | Exact probe CSS equal. [compare artifacts](../characterization/v2/state-isolation/after-extend--extend-element/sequence.css) | Equivalent | No discrepancy observed |
| `after-stress--plain-block` | `exploratory/complete-stress-tree.scss` → `state-isolation/probes/plain-block.scss`; independent top-level scenarios | Exact probe CSS equal. [compare artifacts](../characterization/v2/state-isolation/after-stress--plain-block/sequence.css) | Equivalent | No discrepancy observed |
| `after-stress--element-modifier` | `exploratory/complete-stress-tree.scss` → `state-isolation/probes/element-modifier.scss`; independent top-level scenarios | Exact probe CSS equal. [compare artifacts](../characterization/v2/state-isolation/after-stress--element-modifier/sequence.css) | Equivalent | No discrepancy observed |
| `after-stress--extend-element` | `exploratory/complete-stress-tree.scss` → `state-isolation/probes/extend-element.scss`; independent top-level scenarios | Exact probe CSS equal. [compare artifacts](../characterization/v2/state-isolation/after-stress--extend-element/sequence.css) | Equivalent | No discrepancy observed |
| `after-triple-block--plain-block` | `exploratory/block-block-block.scss` → `state-isolation/probes/plain-block.scss`; independent top-level scenarios | Exact probe CSS equal. [compare artifacts](../characterization/v2/state-isolation/after-triple-block--plain-block/sequence.css) | Equivalent | No discrepancy observed |
| `after-triple-block--element-modifier` | `exploratory/block-block-block.scss` → `state-isolation/probes/element-modifier.scss`; independent top-level scenarios | Exact probe CSS equal. [compare artifacts](../characterization/v2/state-isolation/after-triple-block--element-modifier/sequence.css) | Equivalent | No discrepancy observed |
| `after-triple-block--extend-element` | `exploratory/block-block-block.scss` → `state-isolation/probes/extend-element.scss`; independent top-level scenarios | Exact probe CSS equal. [compare artifacts](../characterization/v2/state-isolation/after-triple-block--extend-element/sequence.css) | Equivalent | No discrepancy observed |
| `sibling-element-after-block` | `state-isolation/before-icon.scss` → `state-isolation/probes/sibling-element.scss`; independent siblings under identical public ancestors | Additional `.standard-object` ancestor after prior icon. [compare artifacts](../characterization/v2/state-isolation/sibling-element-after-block/sequence.css) | **KNOWN STATE LEAK** | Yes |
| `regression-after-sibling-block` | `state-isolation/before-icon.scss` → `state-isolation/probes/sibling-regression.scss`; independent siblings under identical public ancestors | Additional `.standard-object` ancestor after prior icon. [compare artifacts](../characterization/v2/state-isolation/regression-after-sibling-block/sequence.css) | **KNOWN STATE LEAK** | Yes |
| `pippo-after-nested-icon` | `state-isolation/before-icon-complex.scss` → `state-isolation/probes/sibling-pippo.scss`; independent siblings under identical public ancestors | Exact probe CSS equal. [compare artifacts](../characterization/v2/state-isolation/pippo-after-nested-icon/sequence.css) | Equivalent | No discrepancy observed |

The smallest surviving leak is:

```text
B alone in block standard-object:
  .standard-object__after

Sibling block icon, then the same B in block standard-object:
  .standard-object .standard-object__after
```

The additional ancestor changes matching and specificity. Eighteen top-level
comparisons are isolated, and `pippo`/`test-ele` after the nested icon are isolated
under their same `gigi → fatherdMod` ancestors. This bounded evidence does not
prove the absence of all other leaks or identify when the historical bug arose.

## Expected-error investigations

All three candidates include a real CSS rule before the attempted error. The
block/extend/block candidate also contains a declaration inside extend before
invoking its invalid nested block.

| Historical comment | Alone | After original active prefix | CSS available to caller | Matches comment? |
| --- | --- | --- | --- | --- |
| block → extend → block | Throws BEMinator `INVALID NESTING` | Same exact Sass message | No compile result or partial CSS returned | Yes |
| block → element → element | Compiles, two identical element rules | Compiles with same duplicate ending rules | Full CSS including prelude returned | No |
| block → modifier → modifier | Compiles, chained modifier suffix | Compiles with same chained ending suffix | Full CSS including prelude returned | No |

The exact error message, including its original URL and emoji, is recorded in
[the isolated error artifact](../characterization/v2/invalid/block-extend-block.error.json)
and [the contextual error artifact](../characterization/v2/invalid/block-extend-block-after-history.error.json).
Sass `sassMessage` includes surrounding quote characters. Both negative tests
compare the complete message verbatim. No `.css` artifact exists for failures.
“No CSS returned” describes the synchronous JavaScript API: it throws and does
not expose partial generated CSS. It does **not** assert that no internal rule
was ever evaluated before failure. Error-page output from a CLI is not tested.

The duplicate element rule and chained modifier name are suspicious relative to
the explicit comments. They are not silently promoted to supported behavior.
The bottom stress tree produces repeated `.icon .icon` descendants: valid CSS,
but unresolved naming intent. Its `extend → extend → block` compiles even though
`block → extend → block` throws. All exploratory support judgements are tentative.

## Running and maintaining the suite

```sh
npm test
npm run test:legacy
npm run test:characterization
```

Normal unit tests remain independent of the sibling checkout. `test:legacy`
runs the bootstrap smoke tests plus all characterization tests.
`test:characterization` runs only the 58 characterization tests. Tests never
write or regenerate expected output. Current capture logs are under ignored
`tmp/`; warnings are not suppressed by the compiler helper.

Validation completed with `npm test`, `npm run test:legacy`, and
`npm run test:characterization` all exiting successfully. A detailed run using
`node --test --experimental-test-isolation=none 'tests/characterization/**/*.test.js'`
confirmed 58 individual tests passed, with zero failures, skips, or TODOs.
The extra invocation avoids subprocess aggregation in this execution environment;
it does not change fixture isolation (each probe still calls Sass separately).
It recorded 158 warning occurrences: two existing deprecations per compilation
across 37 fixture compilations plus 42 isolation-probe compilations. The detailed
log is at `tmp/characterization-detailed.log` and is intentionally not committed.
The two named known-leak evidence tests do not claim that isolation holds.

For an explicitly reviewed *new* fixture, the capture commands are:

```sh
node scripts/record-v2-characterization.js --record-new
node scripts/record-v2-isolation.js --record-new
```

The scripts only capture missing cases; they never overwrite an existing
observation. Existing baseline changes require manual review, including the
reference revision/compiler and fixture change. `cases.json` carries fixture
provenance and observational classifications; `reference.json` identifies this
capture. Stable CSS storage also exists for exploratory output so it is reviewable
and reproducible, **not** because support has been approved.

Dart Sass emits the existing `if-function` deprecation warnings from
`tool.beminator.scss:289` and `tool.list-to-string.scss:20`. They appear repeatedly
because each fixture is a fresh compilation. No additional warning category or
unexpected Sass/compiler/runtime failure was observed in this suite.

## Decisions requiring human review

- The sibling state leak and its effect on the complete historical regression:
  decide expected selector scope independently of v2's mutable state strategy.
- The two ERROR comments contradicted by current output: decide intended nesting
  rules rather than treating permissive compilation as approval.
- All seven exploratory cases, particularly repeated-name descendants and the
  difference between `block → extend → block` and `extend → extend → block`.
- The exact historical fixed bug remains unidentified. The observed leak is a
  candidate related issue, not a proven identification of that bug.
- Confirm the reference revision and current Sass compiler as the baseline before
  expanding scope; comparing the old 1.83.4 toolchain would be a separate experiment.

No PRESERVE / CHANGE / REMOVE / PLUGIN decisions have been assigned.

## Behavior inventory summary

Each ID links to the fixture; its paired CSS/error artifact is the authoritative
output. Selector summaries below are extracted from the captured CSS in emitted
order. For long sequences, the table shows the ending rules and links the complete
output; it does not normalize or replace the stored CSS. State-isolation behaviors
and their review status are listed in the preceding 21-row table.

| ID | Nesting pattern | Resulting selector pattern / artifact | Status | Historical source lines | Appears intentional? | Human review? |
| --- | --- | --- | --- | --- | --- | --- |
| [core/block/basic](../characterization/v2/core/block/basic.scss) | block | `.standard-object` [CSS](../characterization/v2/core/block/basic.css) | apparently supported | 5-6 | Yes (active intent) | No discrepancy flagged |
| [core/element/basic](../characterization/v2/core/element/basic.scss) | block → element | `.standard-object__element` [CSS](../characterization/v2/core/element/basic.css) | apparently supported | 40-41 | Yes (active intent) | No discrepancy flagged |
| [core/modifier/block-single](../characterization/v2/core/modifier/block-single.scss) | block → modifier(single) | `.standard-object--modifier` [CSS](../characterization/v2/core/modifier/block-single.css) | apparently supported | 14-15 | Yes (active intent) | No discrepancy flagged |
| [core/modifier/block-double](../characterization/v2/core/modifier/block-double.scss) | block → modifier(double) | `.standard-object--modifier-1.standard-object--modifier-2` [CSS](../characterization/v2/core/modifier/block-double.css) | apparently supported | 27-28 | Yes (active intent) | No discrepancy flagged |
| [core/modifier/block-single-element](../characterization/v2/core/modifier/block-single-element.scss) | block → modifier(single) → element | `.standard-object--modifier; .standard-object--modifier .standard-object__nested-element` [CSS](../characterization/v2/core/modifier/block-single-element.css) | apparently supported | 14-19 | Yes (active intent) | No discrepancy flagged |
| [core/modifier/block-double-element](../characterization/v2/core/modifier/block-double-element.scss) | block → modifier(double) → element | `.standard-object--modifier-1.standard-object--modifier-2; .standard-object--modifier-1.standard-object--modifier-2 .standard-object__nested-element` [CSS](../characterization/v2/core/modifier/block-double-element.css) | apparently supported | 27-32 | Yes (active intent) | No discrepancy flagged |
| [core/modifier/element-single](../characterization/v2/core/modifier/element-single.scss) | block → element → modifier(single) | `.standard-object__element--modifier` [CSS](../characterization/v2/core/modifier/element-single.css) | apparently supported | 49-50 | Yes (active intent) | No discrepancy flagged |
| [core/modifier/element-double](../characterization/v2/core/modifier/element-double.scss) | block → element → modifier(double) | `.standard-object__element--modifier-1.standard-object__element--modifier-2` [CSS](../characterization/v2/core/modifier/element-double.css) | apparently supported | 62-63 | Yes (active intent) | No discrepancy flagged |
| [core/modifier/element-single-element](../characterization/v2/core/modifier/element-single-element.scss) | block → element → modifier(single) → element | `.standard-object__element--modifier; .standard-object__element--modifier .standard-object__nested-element` [CSS](../characterization/v2/core/modifier/element-single-element.css) | apparently supported | 49-54 | Yes (active intent) | No discrepancy flagged |
| [core/modifier/element-double-element](../characterization/v2/core/modifier/element-double-element.scss) | block → element → modifier(double) → element | `.standard-object__element--modifier-1.standard-object__element--modifier-2; .standard-object__element--modifier-1.standard-object__element--modifier-2 .standard-object__nested-element` [CSS](../characterization/v2/core/modifier/element-double-element.css) | apparently supported | 62-67 | Yes (active intent) | No discrepancy flagged |
| [core/selector/before](../characterization/v2/core/selector/before.scss) | block → element → selector(':before') | `.standard-object__element:before` [CSS](../characterization/v2/core/selector/before.css) | apparently supported | 75-77 | Yes (active intent) | No discrepancy flagged |
| [core/selector/adjacent-element](../characterization/v2/core/selector/adjacent-element.scss) | block → element → selector('+') → element | `.standard-object__element + .standard-object__element-2` [CSS](../characterization/v2/core/selector/adjacent-element.css) | apparently supported | 85-89 | Yes (active intent) | No discrepancy flagged |
| [core/combinations/block-block](../characterization/v2/core/combinations/block-block.scss) | block → block | `.standard-object .icon` [CSS](../characterization/v2/core/combinations/block-block.css) | apparently supported | 98-100 | Yes (active intent) | No discrepancy flagged |
| [core/combinations/element-modifier-block](../characterization/v2/core/combinations/element-modifier-block.scss) | block → element → modifier → block | `.standard-object__gigi--fatherdMod .icon` [CSS](../characterization/v2/core/combinations/element-modifier-block.css) | context-dependent CSS; see isolation leak | 108-111 | Yes (active intent) | Yes |
| [core/combinations/nested-block-modifier](../characterization/v2/core/combinations/nested-block-modifier.scss) | block → block → modifier | `.standard-object .icon--mod` [CSS](../characterization/v2/core/combinations/nested-block-modifier.css) | apparently supported | 110-113 | Yes (active intent) | No discrepancy flagged |
| [core/combinations/nested-block-element-modifier](../characterization/v2/core/combinations/nested-block-element-modifier.scss) | block → block → element → modifier | `.standard-object .icon__nested-element--nestedMod` [CSS](../characterization/v2/core/combinations/nested-block-element-modifier.css) | apparently supported | 110,120-124 | Yes (active intent) | No discrepancy flagged |
| [core/extend/single](../characterization/v2/core/extend/single.scss) | block → extend(single) | `.standard-object .icon--mod1` [CSS](../characterization/v2/core/extend/single.css) | apparently supported | 148-150 | Yes (active intent) | No discrepancy flagged |
| [core/extend/single-element](../characterization/v2/core/extend/single-element.scss) | block → extend(single) → element | `.standard-object .icon--mod1 .icon__nested-element` [CSS](../characterization/v2/core/extend/single-element.css) | apparently supported | 152-156 | Yes (active intent) | No discrepancy flagged |
| [core/extend/double](../characterization/v2/core/extend/double.scss) | block → extend(double) | `.standard-object .icon--mod1.icon--mod2` [CSS](../characterization/v2/core/extend/double.css) | apparently supported | 158-160 | Yes (active intent) | No discrepancy flagged |
| [core/extend/double-element](../characterization/v2/core/extend/double-element.scss) | block → extend(double) → element | `.standard-object .icon--mod1.icon--mod2 .icon__nested-element` [CSS](../characterization/v2/core/extend/double-element.css) | apparently supported | 162-166 | Yes (active intent) | No discrepancy flagged |
| [core/element/subsequent-block](../characterization/v2/core/element/subsequent-block.scss) | second block → element | `.standard-object__ciao` [CSS](../characterization/v2/core/element/subsequent-block.css) | apparently supported | 208-212 | Inferred from placement | No discrepancy flagged |
| [regression/complete](../characterization/v2/regression/complete.scss) | block → element → modifier → {block → [modifier, element → modifier], element → modifier, element} | `.standard-object__gigi--fatherdMod .icon; .standard-object__gigi--fatherdMod .icon--mod; .standard-object__gigi--fatherdMod .icon__nested-element--nestedMod; .standard-object__gigi--fatherdMod .standard-object__pippo; .standard-object__gigi--fatherdMod .standard-object__pippo--mod; .standard-object__gigi--fatherdMod .standard-object__test-ele` [CSS](../characterization/v2/regression/complete.css) | context-dependent CSS; see isolation leak | 104-138 | Yes (active intent) | Yes |
| [regression/historical-active-sequence](../characterization/v2/regression/historical-active-sequence.scss) | all active branches, followed by second independent block | `…; .standard-object .icon--mod1.icon--mod2; .standard-object .icon--mod1.icon--mod2 .icon__nested-element; .standard-object__ciao` [CSS](../characterization/v2/regression/historical-active-sequence.css) | context-dependent CSS; see isolation leak | 5-212 | Yes (active intent) | Yes |
| [regression/sibling-elements](../characterization/v2/regression/sibling-elements.scss) | block → element → modifier → [element → modifier, element] | `.standard-object__gigi--fatherdMod .standard-object__pippo; .standard-object__gigi--fatherdMod .standard-object__pippo--mod; .standard-object__gigi--fatherdMod .standard-object__test-ele` [CSS](../characterization/v2/regression/sibling-elements.css) | apparently supported | 126-135 | Yes (active intent) | No discrepancy flagged |
| [invalid/block-extend-block](../characterization/v2/invalid/block-extend-block.scss) | block → extend → block | No CSS; [exact error](../characterization/v2/invalid/block-extend-block.error.json) | expected error | 174-179 | Error intended; see observed result | Yes |
| [invalid/block-extend-block-after-history](../characterization/v2/invalid/block-extend-block-after-history.scss) | block → extend → block after active prefix | No CSS; [exact error](../characterization/v2/invalid/block-extend-block-after-history.error.json) | expected error | 5-166; 174-179 | Error intended; see observed result | Yes |
| [invalid/block-element-element](../characterization/v2/invalid/block-element-element.scss) | block → element → element | `.before-failure; .standard-object__test-element; .standard-object__test-element` [CSS](../characterization/v2/invalid/block-element-element.css) | contradicts ERROR comment | 187-192 | Error intended; see observed result | Yes |
| [invalid/block-element-element-after-history](../characterization/v2/invalid/block-element-element-after-history.scss) | block → element → element after active prefix | `…; .standard-object .icon--mod1.icon--mod2 .icon__nested-element; .standard-object__test-element; .standard-object__test-element` [CSS](../characterization/v2/invalid/block-element-element-after-history.css) | contradicts ERROR comment | 5-166; 187-192 | Error intended; see observed result | Yes |
| [invalid/block-modifier-modifier](../characterization/v2/invalid/block-modifier-modifier.scss) | block → modifier → modifier | `.before-failure; .standard-object--test-element; .standard-object--test-element--test-element` [CSS](../characterization/v2/invalid/block-modifier-modifier.css) | contradicts ERROR comment | 200-205 | Error intended; see observed result | Yes |
| [invalid/block-modifier-modifier-after-history](../characterization/v2/invalid/block-modifier-modifier-after-history.scss) | block → modifier → modifier after active prefix | `…; .standard-object .icon--mod1.icon--mod2 .icon__nested-element; .standard-object--test-element; .standard-object--test-element--test-element` [CSS](../characterization/v2/invalid/block-modifier-modifier-after-history.css) | contradicts ERROR comment | 5-166; 200-205 | Error intended; see observed result | Yes |
| [exploratory/regression-commented-branch](../characterization/v2/exploratory/regression-commented-branch.scss) | block → element → modifier → block → modifier → element → modifier | `.standard-object__gigi--fatherdMod .icon--mod .icon__nested-element--nestedMod` [CSS](../characterization/v2/exploratory/regression-commented-branch.css) | apparently supported | 108-118 | Uncertain | Yes |
| [exploratory/extend-extend](../characterization/v2/exploratory/extend-extend.scss) | extend(double) → extend(double) | `.extend--mod1.extend--mod2; .extend--mod1.extend--mod2 .icon--mod1.icon--mod2` [CSS](../characterization/v2/exploratory/extend-extend.css) | apparently supported | 216-219 | Uncertain | Yes |
| [exploratory/extend-block](../characterization/v2/exploratory/extend-block.scss) | extend(double) → block | `.extend--mod1.extend--mod2; .extend--mod1.extend--mod2 .icon` [CSS](../characterization/v2/exploratory/extend-block.css) | apparently supported | 216-217;224-225 | Uncertain | Yes |
| [exploratory/extend-extend-block](../characterization/v2/exploratory/extend-extend-block.scss) | extend(double) → extend(double) → block | `.extend--mod1.extend--mod2; .extend--mod1.extend--mod2 .icon--mod1.icon--mod2; .extend--mod1.extend--mod2 .icon--mod1.icon--mod2 .icon` [CSS](../characterization/v2/exploratory/extend-extend-block.css) | apparently supported | 216-223 | Uncertain | Yes |
| [exploratory/extend-block-block](../characterization/v2/exploratory/extend-block-block.scss) | extend(double) → block → block | `.extend--mod1.extend--mod2; .extend--mod1.extend--mod2 .icon; .extend--mod1.extend--mod2 .icon .icon` [CSS](../characterization/v2/exploratory/extend-block-block.css) | ambiguous repeated-name descendants | 216-217;224-229 | Uncertain | Yes |
| [exploratory/block-block-block](../characterization/v2/exploratory/block-block-block.scss) | block → block → block | `.standard-object .icon .icon` [CSS](../characterization/v2/exploratory/block-block-block.css) | ambiguous repeated-name descendants | 224-228 (derived) | Uncertain | Yes |
| [exploratory/complete-stress-tree](../characterization/v2/exploratory/complete-stress-tree.scss) | extend → [extend → block, block → block] | `.extend--mod1.extend--mod2; .extend--mod1.extend--mod2 .icon--mod1.icon--mod2; .extend--mod1.extend--mod2 .icon--mod1.icon--mod2 .icon; .extend--mod1.extend--mod2 .icon; .extend--mod1.extend--mod2 .icon .icon` [CSS](../characterization/v2/exploratory/complete-stress-tree.css) | ambiguous repeated-name descendants | 216-230 | Uncertain | Yes |

The absence of a review flag means no discrepancy was found in this bounded
investigation; it is not v3 behavior approval. Work stops here for manual review.

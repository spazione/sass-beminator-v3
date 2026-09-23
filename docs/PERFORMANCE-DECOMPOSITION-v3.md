# v3 performance decomposition

The sections below preserve the historical **diagnostic equivalent variants**
and ablations against **original stable v3**. The
[production adoption](#production-adoption-and-verification) at the end records
the later **optimized production v3**. Statements below that production was
unchanged or optimizations were future work describe the diagnostic stage.

Diagnostic spike, 22 September 2026. Production code and the read-only v2
checkout were not changed. This investigates the regression documented in
[the original performance report](PERFORMANCE-v2-v3.md), rather than replacing
its 21-row benchmark with a new full run.

## Common hot path

One component executes this tree:

```text
block('component-N')
  element('title')
    modifier('large') → font-size: 2rem
  element('body')     → color: red
  modifier('active')  → opacity: 1
```

Each public call delegates through `-enter`:

```text
-current-context → -validate → -name → -derive
  → save previous stack locally → -push-context
  → @at-root → -complete-selector → style rule → @content
  → -restore-context
```

`-derive` parses an owner for the block, appends an element suffix for each
of the two elements, and calls `-qualify` for each of the two modifiers.
`-qualify` performs one selector append for a single modifier. All scopes in
this fixture are empty. The block and title rules contain only nested mixin
calls; Sass omits their empty rules from output. The three declaration-bearing
rules retain their order. No functional-selector work is involved.

| Operation | Block ×1 | Elements ×2 | Modifiers ×2 | Per component |
| --- | ---: | ---: | ---: | ---: |
| Public mixin / `-enter` | 1 | 2 | 2 | 5 each |
| `-current-context` | 1 | 2 | 2 | 5 |
| `-validate` / transition map construction | 1 | 2 | 2 | 5 each |
| `-name` | 1 | 2 | 2 | 5 |
| `-derive` / child map construction | 1 | 2 | 2 | 5 each |
| `-push-context` / `-restore-context` | 1 | 2 | 2 | 5 each |
| `-qualify` | 0 | 0 | 2 | 2 |
| `selector.parse` | 1 | 0 | 0 | 1 |
| `selector.append` | 0 | 2 | 2 | 4 |
| `-complete-selector` / `selector.nest` | 1 | 2 | 2 | 5 each |
| `@at-root` / attempted style-rule emission | 1 | 2 | 2 | 5 each |

Additional stock counts per component:

- One root-context map plus five child maps and five transition maps: **11 map
  literal evaluations**. There is no `map.set` or `map.merge` on this common
  path. `map.set` in derivation is only for pending relationships, absent here.
- **46 `map.get` calls:** 11 in validation, 25 in derivation, 10 in completion.
  Validation's ancestry lookup runs only for the single block call, because
  `and` short-circuits. Five relationship `list.index` checks also run.
- **10 `list.append` calls:** five stack pushes and five completion argument
  lists. Current-context reads add five `list.length` and four `list.nth`
  calls. Maximum stack depth is three; it does not grow with component count.
- Two element-separator and two modifier-separator reads occur in suffix
  interpolation. These are variables in the same core module, not dynamic
  module imports. Public namespace resolution still occurs at each fixture call.
- Ten push/restore mixin dispatches and five public-to-private `@content`
  forwarding steps are additional lifecycle work.

For a valid name of length **L**, stock `-name` performs one `meta.type-of`,
 two `string.length`, **L+1 `string.slice`**, **L+1 `string.index`**, and **L
 alphabet concatenations**, plus L loop iterations. The first character is
 checked twice: once against letters/underscore, then again in the full-domain
 loop. With a d-digit component number, the five names total 30+d characters;
 therefore there are 35+d slice/index operations and 30+d concatenations and
 loop iterations per component. The check is exactly
 `[A-Za-z_][A-Za-z0-9_-]*`, applied to evaluated Sass strings.

Layer/separator configuration validation is startup work once per compilation:
`-validate-layers` once, `-layer-name` eight times for default layers, and
`-validate-separator` twice. It is not performed five times per component.
The temporary trace records private helper counts separately from these startup
calls; no tracing is present during timing.

## Method and diagnostic boundaries

The reusable script is [decompose-performance.mjs](../benchmarks/decompose-performance.mjs).
It reads the existing harness's pure generator, rule checker and statistics
functions without changing that harness. It writes transformed SCSS and raw
results only under `tmp/benchmarks/performance-decomposition/`. Each timing JSON
records source/script hashes, execution order, individual samples, compiler
versions and load averages. Existing timing output names are refused rather than
silently overwritten. No dependency was added.

Node 22.19.0 and Dart Sass 1.104.1 are pinned. Each group uses two warmup rounds
and six measured rounds with rotated starting lanes and reversed alternate
rounds. All v3 variants use the same in-memory module importer, expanded CSS,
no source map, and a silent logger. Fixture generation, transformations,
preflight CSS checks, output comparisons and file writes are outside timing.
Fresh `compileString` evaluation includes parsing, module evaluation, and CSS
serialization. GC is not forced. Measurements run sequentially; tests are not
run concurrently with timed experiments.

Every lane must emit byte-identical CSS to file-loaded production v3 and match
the original generator's independent ordered rules. Pure bypasses and
fixture-specialized representations are **diagnostic lower bounds only**.
They are not API-safe replacements. The combined variant includes no validation
bypass, no fixture-specific selector simplification, and no alternate stack
architecture. Exact invalid-input error messages are compared for equivalent
validation changes, not merely successful compilation of valid names.

Six samples can identify large effects but cannot establish tiny differences
reliably on this shared WSL machine. Each group has its own stock control;
absolute times from different groups must not be subtracted as if contemporaneous.
No additive cost model is assumed. Larger comparisons measure the combined
variant directly against stock and v2 in the same run.

## Relationship validation and static data

The `static-map` variant moves the **unchanged** transition-map literal before
`-validate` as `$-allowed-transitions`. The parent-kind, ancestry precedence,
explicit element→element/modifier→modifier errors, map lookup, list membership
check and unsupported-nesting error all remain. There is no new mutable state:
private immutable lookup data is compatible with one evolving mutable stack.

Common/1,000, relationship group:

| Variant | Median ms | Change from group stock | Median within-round change |
| --- | ---: | ---: | ---: |
| Stock | 1,192.99 | — | — |
| Static transition map | 1,143.19 | −4.17% | −4.8% |
| Fully bypassed relationship validation | 1,096.89 | −8.06% | −14.0% |

The static map beat stock in four of six rounds. This initial result indicates
small savings, with considerable uncertainty. In the independent combined
common/1,000 group its saving was 11.46%; larger-scale confirmation appears
below. Do not treat the two different percentages as a stable constant.

Static-map versus full bypass estimates the remaining checks' cost: their
median difference here is 46.30 ms, about 4.05% of static-map time. Both still
call `-validate`; only its body is bypassed in the lower bound. This is a
comparison of observed durations, not proof of an additive partition of the
original 17% nesting-validation ablation. No individual map-get/list-index
operation has been assigned a precise independent percentage.

## Name validation mechanics

First name group, common/1,000:

| Validator | Median ms | Change from group stock | Interpretation |
| --- | ---: | ---: | --- |
| Current full validator | 1,163.80 | — | Production control |
| First character, type and empty checks | 955.36 | −17.91% | Lower bound; missing tail validation |
| Type/empty checks only | 991.20 | −14.83% | Lower bound; missing character rules |
| Full bypass | 949.42 | −18.42% | Lower bound; no validation |
| Hoist combined alphabet once per name | 1,276.82 | +9.71% | Equivalent, no demonstrated benefit |
| Hoist alphabet and skip already-checked first character | 1,171.21 | +0.64% | Equivalent, no demonstrated benefit |

Type-only being slower than first-character-only is evidence of noise, not
negative first-character validation cost. First-character and type-only controls
beat stock in all six rounds; the full-bypass row has an outlier. The tail scan
as a whole is material; these data do not resolve the tiny type/first-check cost.

Second name group, common/1,000:

| Validator/control | Median ms | Change from group stock | Median within-round change |
| --- | ---: | ---: | ---: |
| Current full validator | 1,313.57 | — | — |
| Equivalent character-list validator | 1,139.33 | −13.26% | −8.6% |
| First checks + numeric loop + slices; no tail membership | 1,403.43 | +6.84% | +12.1% |
| First checks + numeric loop/local assignment only | 1,065.99 | −18.85% | −12.1% |
| Full bypass | 996.29 | −24.15% | −16.0% |

The equivalent variant retains the original type/nonempty and first-character
checks, then uses `@each $character in string.split($name, '')` and tests each
character with `string.index` against a literal complete alphabet. It returns
exactly the original name. It avoids L indexed slices, L alphabet concatenations
and numeric index-loop bookkeeping, replacing them with a native split and
list iteration. It **does not remove membership validation**. The initial
first-character slice/index remain, as does rechecking that character against
the full domain.

This preserves `[A-Za-z_][A-Za-z0-9_-]*`: every character in the evaluated
string must still be in the same alphabet and the first must still be in the
same stricter alphabet. Unsupported Unicode remains rejected. Error strings
and precedence are unchanged. The differential controls cover printable ASCII
in both first/tail positions, escaped strings, Unicode, empty/type errors,
one-character names and unquoted input: 205 cases compared against stock for
each equivalent name variant. They supplement the structural equivalence
argument; they are not an exhaustive test of every Sass string.

The slice-only row has large noise (including a 2,594 ms sample), and removing
membership did not produce a reliable win. Thus **character scan mechanics**
are demonstrated material work, but the experiment does not cleanly separate
slice cost, membership cost, concatenation and evaluator/GC interactions.
Alphabet hoisting alone is not justified by these measurements. The measured
beneficial replacement is the entire equivalent split/iteration implementation.

## Context maps and stack

Common/1,000, context group:

| Variant | Median ms | Change from group stock | Median within-round change |
| --- | ---: | ---: | ---: |
| Stock | 1,134.04 | — | — |
| Immutable root-context constant | 1,183.86 | +4.39% | −1.4% |
| Three-field context maps for common | 1,186.55 | +4.63% | +4.8% |
| Positional context lists instead of maps | 1,034.97 | −8.74% | −4.5% |
| One-frame list instead of stack append | 1,123.34 | −0.94% | +2.9% |
| Direct current-frame pointer and lexical restore | 1,218.44 | +7.44% | +3.2% |
| Inline unchanged push/restore operations | 1,260.74 | +11.17% | +7.0% |

The root constant removes one five-field map construction per component.
The minimal-map control omits empty scope and false ancestry fields and their
reads for common only. It still creates a fresh owner/subject/kind map at each
call. Neither produces a convincing improvement. The positional-list control
retains all frame information but changes construction **and** map getters to
positional list reads. Its modest saving cannot be attributed to map allocation
alone; it beats stock in four of six rounds. These controls do not show that
immutable context-map churn dominates the regression, nor establish it is free.
The construction-versus-access split remains unresolved.

Stack-singleton retains only the latest frame in a one-element list; each call
still saves/restores the previous value locally, retaining the known fixture's
lexical context. The pointer control also removes the list length/nth accesses.
The inline control keeps identical append/restore operations but removes ten
mixin dispatches per component. None shows a consistent benefit. This bounds
the practical case for replacing the stack architecture: **no material stack
bottleneck was demonstrated at depth three**. It does not measure arbitrary
deep recursion, which this fixture never exercises. These alternatives are
not proposed production architectures and are excluded from the combined run.

## Selectors, configuration and emission

Common/1,000, selector group:

| Variant | Median ms | Change from group stock | Median within-round change |
| --- | ---: | ---: | ---: |
| Stock | 1,141.83 | — | — |
| Direct interpolation for four appends | 1,131.25 | −0.93% | −3.1% |
| Return subject instead of empty-scope completion | 1,056.77 | −7.45% | −6.8% |
| All common selectors via strings, no selector APIs | 976.09 | −14.52% | −17.8% |
| Literal default separators | 1,211.79 | +6.13% | +1.5% |
| Skip two empty emission boundaries, retain all completions | 1,095.97 | −4.02% | −1.2% |

Append-only interpolation retains owner parsing and completion, which may parse
its new string inputs again. Its small result does not prove `selector.append`
itself is free. The all-string lower bound removes owner parsing, all four
appends and five completion nests together; it beats stock in every round.
This establishes material cost for the **whole selector representation and
construction pipeline**, but cannot allocate it precisely among APIs. Returning
subject skips the empty-scope `map.get(scope)`/list append/splat/nest work;
this is a modest completion-path opportunity, not evidence about nonempty scopes.
The earlier explicit-owner-parse-only experiment remains unpromising.

All string/empty-scope shortcuts here are restricted to the fixture's simple
single classes. They are not verified replacements for compound selectors,
multiple modifiers, qualified selectors, descendant scopes or configuration
variants. No recommendation to abandon native selector APIs follows.

Literal `__`/`--` substitutions retain configuration startup but replace four
suffix variable interpolations. They show **no measurable benefit**. This
cheap test does not measure every namespace/function/config lookup; those are
not separately resolved. It provides no reason to remove configurability.

The emission lower bound skips the known-empty block and title style rules and
their `@at-root` boundaries, while still executing **all five** original
`-complete-selector` calls. Three declaration-bearing emissions remain. The
added fixture-condition branch and target local are also timed. The median
saving is only 4.02%, with three of six rounds faster and a paired median saving
of 1.2%. This is no reliable evidence for a large empty-boundary cost. Removing
all `@at-root` boundaries would produce descendant selectors and invalidate
common output, so total emission-boundary cost is **unresolved**. The control
must not be generalized to blocks/elements that contain their own declarations.

## Other lifecycle work

An additional two-lane group copied the complete unchanged `-enter` body into
the three public mixins used by common. Name/relationship validation,
derivation, stack writes and selector completion remain. This removes five
private mixin calls and five `@content` forwarding steps per component, while
adding diagnostic parameter locals and increasing source size. It is a
fixture-only lower bound, not a proposal to duplicate the emission boundary.

Stock measured 1,133.84 ms; direct public lifecycles measured 1,289.83 ms
(**+13.76%**, paired median +9.51%; faster in only two of six rounds). Together
with the push/restore inlining experiment, this provides no evidence for
inlining helpers as an optimization. It cannot prove individual dispatches
have zero cost. The remaining generic derivation branches, function calls,
variable bindings, scope management, allocations and evaluator/GC interactions
are not individually resolved by this spike.

## Combined equivalent diagnostic

The combined source contains **only**:

1. The exact transition map constructed once as a private immutable module value.
2. The equivalent `string.split`/`@each` name validator, with every type,
   nonempty, first-character and character-membership check retained.

It retains the five-field maps, original stack push/restore, native selector
operations, configuration handling, helper boundaries and single emission
boundary. It does not incorporate the non-beneficial alphabet-only hoist,
root constant, tuple/pointer architecture, or any lower-bound bypass.

Correctness controls completed before the large runs:

- 205 name inputs, with exact CSS or exact Sass error-message comparison
  against stock for each of four equivalent name variants.
- All 84 combinations of seven parent kinds, six child kinds and two
  ancestry flags, with exact error messages/precedence or returned context
  comparison for the static-map and combined variants.
- 43 public fixture comparisons, including all five original workload
  families, double modifiers, pending relationships, attribute/pseudo
  qualification, layers, restoration after extend, and invalid nesting/names.
- An untimed temporary trace confirmed the helper counts above.
- Every warmup and measured compile must match stock CSS byte-for-byte.

The table below compares medians from each **new contemporaneous group**.
V3 sources use identical in-memory loading; v2 uses its original file entry
and real dependency graph. Both use the same compiler/options and fresh
module evaluation. This slightly different module I/O setup is retained
explicitly rather than pretending these are pure per-component CPU times.
The original historical medians are not reused as denominators for new savings.

| Workload | Stock v3 ms | Static map ms | Combined ms | v2 ms | Combined vs stock | Contemporary median gap recovered |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Common / 1,000 | 1,349.65 | 1,194.99 | 1,107.67 | 545.23 | −17.93% | 30.08% |
| Common / 5,000 | 3,837.23 | 3,690.64 | 3,483.82 | 1,521.64 | −9.21% | 15.26% |
| **Mixed / 1,000** | **1,909.74** | **1,750.69** | **1,668.19** | **1,105.81** | **−12.65%** | **30.05%** |

Gap recovery is `(stock − combined) / (stock − v2)`, calculated within each
row. These are measured combined results, not sums of individual savings.
Mixed receives greatest practical weight: combined is faster in all six rounds,
with median within-round reduction 11.77%, mean 1,671.25 versus 1,914.71 ms,
and population standard deviation 10.89 versus 46.20 ms. Its output is
324,249 bytes in every lane. Common outputs are likewise identical at 134,677
and 686,677 bytes for 1,000 and 5,000.

Static-map savings are 11.46%, 3.82% and 8.33% in these groups, respectively.
At 5,000 and mixed/1,000 it beats stock in all six rounds. Static data hoisting
is supported, but it accounts for a modest fraction of the whole regression.
The combined split validator adds measured benefit beyond static-map alone,
without removing required checks.

**Important large-run variability:** common/5,000 combined has one 6,535.25 ms
sample. Its median improves and it wins five of six rounds, but its mean is
**3,972.63 ms versus stock 3,887.61 ms (+2.19%)**, with population standard
 deviation 1,152.75 versus 161.30 ms. No sample was discarded. This spike does
not identify the outlier's cause or establish a throughput/long-tail improvement
at that scale. The 9.21% claim is specifically about medians. Mixed provides
cleaner evidence; a future optimization proposal needs repeat measurements
before claiming a reliable large-scale win.

## Residual unexplained gap

Even the equivalent combined variant remains **2.03× v2 on common/1,000,
2.29× on common/5,000, and 1.51× on mixed/1,000** in the new runs. Residual
median gaps are 562.44, 1,962.18 and 562.38 ms, respectively: approximately
70%, 85% and 70% of each contemporaneous original gap remains.

These fractions must not be applied mechanically to the historical
2,161.81/4,293.75 ms mixed or 2,411.07/6,642.10 ms common results. Both v2
and v3 ran faster in these later experiments; process warmup, machine state,
module-loading details and runtime noise changed. The old results remain
preserved and valid observations. This spike estimates plausibly recoverable
work with paired contemporary controls, not a retrospective rewrite of them.

The remaining gap is **not fully allocated to individual operations**. Lower
bounds demonstrate additional name-validation and whole-selector-pipeline
costs; neither can be removed wholesale while retaining the API. Context
representation showed only a modest noisy opportunity. Stack and dispatch
simplifications did not help. Generic Sass evaluation, derivation branches,
function environments, other variable accesses, allocations and GC remain
unseparated. There is no measured basis for calling the context-stack architecture
the global cause, or for adding the lower-bound savings to explain 100% of the gap.

## Hotspot classification and ranked recommendations

These labels describe observed removable cost on these fixtures, not universal
Sass primitive costs. **No single DOMINANT operation was demonstrated.** Name
character validation is the largest isolated family in the bypass experiments
(about 18–24% by medians); the whole selector pipeline is another material
family. Neither is a license to remove behavior.

| Operation/family | Classification | Evidence and limit |
| --- | --- | --- |
| Name character scanning | **MATERIAL** | 18–24% bypass bounds; equivalent split variant 13.26% in its group; combined validation changes help mixed |
| Transition-map recreation | **MATERIAL, modest** | 3.82–11.46% in confirmation groups; 8.33% on mixed; common/5,000 alone is a small effect |
| Remaining relationship checks | **UNRESOLVED, small signal** | Static-to-bypass median difference about 4%; noisy, checks not split further |
| Context-map construction alone | **UNRESOLVED** | Root constant and reduced maps did not improve; cannot allocate positional-list result to construction |
| Whole context representation | **SMALL, uncertain** | Tuple construction plus accesses −8.74%, paired −4.5%, only four rounds faster |
| Stack append/restore at depth ≤3 | **NEGLIGIBLE demonstrated opportunity** | Singleton −0.94%; pointer and inlining no improvement; not a proof of zero runtime cost |
| Whole selector construction pipeline | **MATERIAL** | All-string lower bound −14.52%, all six rounds faster; not production-equivalent |
| `selector.append` separately | **UNRESOLVED** | Append-only replacement −0.93%; downstream reparsing remains |
| Empty-scope completion | **SMALL** | −7.45% lower bound; nonempty-scope semantics not tested as an alternative |
| Separator/config variable reads | **NEGLIGIBLE demonstrated opportunity** | Literals did not improve; broader namespace lookup unmeasured |
| Emission boundary | **UNRESOLVED** | Skipping two empty emissions −4.02%, paired −1.2%, three rounds faster; total removal invalidates CSS |
| Helper/content forwarding dispatch | **NEGLIGIBLE demonstrated opportunity** | Neither push/restore inlining nor direct public lifecycles helped |
| Remaining evaluator/allocation/GC work | **UNRESOLVED** | No profiler-based allocation or per-operation attribution in this spike |

Minimal future production optimization sequence, **not implemented here**:

1. **Hoist the exact transition map to a private immutable constant.** This has
   the lowest semantic/architectural risk and repeatable mixed/large-common
   benefit. Preserve lookup logic, ancestry precedence and all error messages.
   Keep the data private and never mutate it. It adds no evolving global state.
2. **Evaluate the equivalent split/iteration name validator.** Retain every
   runtime check and original returned string. It has measured combined benefit,
   but creates a character list, so evaluate allocation and long-name behavior,
   escaped/Unicode inputs and large-run tails before adoption. The one large
   outlier is a reason to check, not evidence that the character list caused it.
3. **Only then investigate an equivalent empty-scope completion fast path.**
   The lower bound suggests a small opportunity. Prove native normalization,
   compound/multi-modifier selectors, pending relationships and nested scopes
   remain identical; retain the general native selector path. This spike did
   not establish a production-safe implementation.
4. **Leave context maps, stack architecture and emission structure intact
   unless stronger evidence appears.** No demonstrated return justifies a broad
   rewrite. Do not promote positional contexts, current-frame pointers, direct
   string selectors or duplicated public emission bodies based on these controls.

Alphabet-only hoisting, skipping one already-checked name character, replacing
separators with literals, and helper inlining are not recommended from this data.
The proposed first two steps preserve the stable API, diagnostics, all selector
semantics, one evolving mutable stack and one emission boundary. They are more
limited than the fixture-only lower bounds.

## What must not be weakened; external tooling

Do not remove type/nonempty/first-character/tail checks; widen the name domain;
remove nesting or ancestry checks; change error precedence/categories; hardcode
separators; infer ownership from string selectors; skip emissions that may have
declarations; or abandon native selector semantics based on simple-class tests.
No functional-selector work, addon/theme work or Node/PostCSS BEM construction
was started. The legacy repository was not modified.

Literal name and literal call-tree checks are **possible future external tooling
candidates** for early lint feedback: they are defensive/static analysis for
source that can be resolved statically. Dynamic Sass values, interpolation,
control flow and evaluated nesting still require runtime validation. The measured
validation cost does not justify removing those checks from the compiler path.
No external tooling was implemented and no performance saving from it is claimed.

## Reproduction, evidence and verification

With Node 22.19.0 selected:

```sh
node benchmarks/decompose-performance.mjs --group=controls
node benchmarks/decompose-performance.mjs --group=relationship
node benchmarks/decompose-performance.mjs --group=names
node benchmarks/decompose-performance.mjs --group=name-alternative
node benchmarks/decompose-performance.mjs --group=context
node benchmarks/decompose-performance.mjs --group=selectors
node benchmarks/decompose-performance.mjs --group=dispatch
node benchmarks/decompose-performance.mjs --group=combined
node benchmarks/decompose-performance.mjs --group=combined --scale=5000
node benchmarks/decompose-performance.mjs --group=combined --scenario=mixed
```

Use a new `--tag=...` to repeat a completed timing group; its existing JSON is
protected against overwrite. Controls and generated diagnostic SCSS are
regenerated in the temporary directory. The reviewable copies of raw data
are under [benchmarks/results/performance-decomposition](../benchmarks/results/performance-decomposition/):
`controls.json`, five individual timing groups (including both name groups),
`dispatch-common-1000.json`, and the three combined group files. More precisely,
there are **nine timed groups / 246 measured compilations**, plus their warmups
and untimed checks. The original 21-row benchmark and previous diagnostic
results were not rerun or overwritten. No additional mixed/5,000, memory,
custom-separator performance or 10,000-instance timings were run.

The production core hash before and after is
`805b444631498f9f5ba634605b289ab10fc6fee8a6083af1588a0338070346e7`.
All production files retain their starting contents; pre-existing working-tree
changes remain. Validation: `npm test`, the diagnostic script syntax check,
and `git diff --check` pass. Shared test/compiler infrastructure was untouched,
so no full legacy rerun was needed. No production optimization was performed.

## Production adoption and verification

The subsequent production task adopted exactly two equivalent optimizations in
`src/core/_bem.scss`: the exact relationship map is now private, immutable module
data, and the name character loop uses `string.split($name, '')` / `@each` with
the same alphabet. Type, empty-string, first-character and tail checks, original
returned string and quotedness, diagnostic precedence and messages are preserved.
Selector operations, context representation, stack lifecycle, separators, Layers,
emission and public signatures are unchanged. No additional optimization was made
during recovery on 23 September.

The preserved original stable core is
[`v3-before-validation.scss`](../benchmarks/references/v3-before-validation.scss),
SHA-256 `805b444631498f9f5ba634605b289ab10fc6fee8a6083af1588a0338070346e7`.
The optimized core is
`3a73cbdbb227f0f7a0d1d7a092eea4c47510694b3361378f234ddc2921cce6cd`.
Direct source comparison shows only the two changes above. This reference already
includes the stable-core diagnostic cleanup; comparing only with Git HEAD would
incorrectly attribute earlier adoption work to this optimization.

Optimization-specific test changes are
`tests/production/extend.test.js` (recognize the immutable map while guarding the
single evolving stack) and the new
`tests/production/validation-equivalence.test.js`. Its 304 cases comprise 219
evaluated-name cases, 84 parent/child/ancestry cases and one source-scope guard.
They compare frozen and current code, including Sass diagnostic quoting, all
printable ASCII characters, invalid types, Unicode, interpolation and normalized
escapes. All pass. Other pre-existing test edits belong to stable-core adoption:
`core.test.js`, `layers.test.js`, `selector-structure.test.js`, `selector.test.js`,
`separators.test.js`, `signatures.test.js`, diagnostic assertions in
`extend.test.js`, and `tests/package/entrypoint.test.js`. Recovery changed none of
these tests or any production source.

Architecture verification confirms **six public mixins, three public configuration
variables, zero public functions, one evolving mutable global (`$-context-stack`),
and one BEM emission boundary**. `$-allowed-transitions` is assigned once and is
not evolving state; the existing load-time settings remain configuration.

### Interrupted validation recovery

Implementation, the frozen reference and corrected test assertions were already
present. The saved `validation.json` claimed exit 0 for production, normal,
characterization and legacy, but all their logs were empty and counts were null.
The older targeted logs recorded failures before the assertion corrections;
their timestamps predate those fixes. They were not current failures.

A minimal process probe exposed the cause: sandboxed `spawnSync` returned
`error: EPERM`, empty streams **and status 0**. The old runner checked only status.
Those four summaries therefore were not conclusive successful executions and
could not safely be reused. They were completed outside the sandbox with actual
TAP summaries. Package and spike completion was not recorded before interruption.
The original benchmark/decomposition measurements were all preserved and not rerun.

`npm run test:package` passes against the packed artifact. Its extra no-isolation
detail invocation initially hit a Dart Sass entrypoint error with a relative CLI
glob; using an absolute test filename resolves that runner-only issue without
changing the test. No diagnostics were suppressed to pass tests.

| Suite | Passing individual tests | Failures / skipped |
| --- | ---: | ---: |
| Production | 508 | 0 / 0 |
| Normal project | 510 | 0 / 0 |
| Characterization | 58 | 0 / 0 |
| Legacy, including characterization | 60 | 0 / 0 |
| Packed package | 1 | 0 / 0 |
| Selector-engine spike | 27 | 0 / 0 |
| Context-stack spike | 15 | 0 / 0 |
| Structural-selector spike | 16 | 0 / 0 |
| CSS Layers spike | 57 | 0 / 0 |

Counts come from no-isolation detail runs; overlapping suites must not be summed.
All five npm commands also pass normally. `git diff --check` and syntax checking
of the focused timing script pass. Logs and recovery runners are in
`tmp/benchmarks/production-optimizations/`; the reviewable validation summary is
[`validation.json`](../benchmarks/results/production-optimizations/validation.json).

The [new production comparison](PERFORMANCE-v2-v3.md#optimized-production-v3)
measures all three lanes contemporaneously. Historical diagnostic variants remain
separate evidence and are not substituted for production measurements.

### Production outcome

With three warmups and ten rotating measured rounds per lane, optimized production
reduces median time by **13.45% Common/1,000, 12.54% Common/5,000 and 15.80%
Mixed/1,000** versus the frozen original stable v3. Recovered contemporaneous
v2-to-v3 median gaps are 21.68%, 20.42% and 32.51%. Residual optimized/v2 median
ratios are 2.281×, 2.266× and 1.638×. All three lanes produce byte-identical
expected CSS: 134,677, 686,677 and 324,249 bytes respectively.

The combined changes win 10/10, 7/10 and 6/10 paired rounds against old v3.
Mixed has greatest practical weight: its mean improves only 5.34%, while p95
increases 13.30% and population SD increases 44.43%. Common/5,000 mean and p95
improve 11.39% and 16.77%, but its absolute SD barely changes and SD/mean rises.
No outliers were dropped. Full medians, means, ranges, p95, population SD and
paired ratios are in the linked report and raw production JSON.

Retain both narrowly scoped, equivalent optimizations. The residual gap warrants
measurement on real builds, not an architectural rewrite based on these fixtures.
If further work is authorized, profile Mixed allocation/GC and tail variability
first. The proposed empty-scope path remains unimplemented and needs a separate
decision and equivalence proof. No additional investigation or optimization was
started in this recovery.

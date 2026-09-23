# v2 versus v3 compilation performance

The report below preserves the **original stable v3** baseline and diagnostic
results from 22 September. The [post-optimization comparison](#optimized-production-v3)
records the subsequent production changes and new contemporaneous measurements.
References to unchanged/current production in the historical sections describe
that earlier run, not the optimized source.

Measured 22 September 2026, using the current working tree. No production
optimization was performed. The realistic mixed fixture carries the most weight:
at 1,000 component instances its median compilation time was **2,161.81 ms in v2
versus 4,293.75 ms in v3 (+98.62%, 1.99× time)**. At 500 instances the increase
was 82.18%. This is a genuine regression for these workloads, although this
synthetic component composition is not a measurement of an actual application's
stylesheet or build system.

## Recovery and evidence

The interrupted agent's benchmark **finished successfully**: the existing
`tmp/benchmarks/core-v2-v3/results.json` records a start at
`2026-09-22T14:35:11.630Z` and completion at `2026-09-22T14:50:14.462Z`
(16:50:14 Europe/Rome). No benchmark Node process was visible on inspection;
the completion marker and complete result matrix are the stronger evidence.

All **21 saved rows / 420 measured compilations** were reused: baseline at 1;
block, common, nested and extend at 100/1,000/5,000; mixed and Layers at
10/100/500/1,000. Every row has ten finite positive samples per side, and
recomputed statistics match the stored statistics. All three recorded source
hashes match the current legacy entry, v3 entry and v3 core. The original run
does not record hashes of the legacy dependency graph or harness, so historical
identity of those files cannot be established from its metadata alone.

The original result file was preserved without modification. A reviewable copy
is [benchmarks/results/core-v2-v3.json](../benchmarks/results/core-v2-v3.json).
No original expensive measurements were rerun. Additional compilations were
limited to correctness/warning audits and targeted common-workload diagnostics.

## Method and field definitions

[The existing harness](../benchmarks/compile-performance.mjs) uses Node 22.19.0,
Dart Sass 1.104.1, synchronous modern `sass.compileString`, expanded CSS,
`charset: false`, no source maps, three warmup pairs and ten measured pairs
per scenario/scale, plus an untimed correctness preflight. The saved machine is
Linux/WSL2, Intel Core Ultra 5 238V, eight logical CPUs and approximately 16.5 GB
RAM. No baseline subtraction or forced GC is used.

The JSON does **not** store six unlabeled timing fields. Its outer two-element
arrays (`samplesMs`, `statsMs`, `cssBytes`) mean **[reference, candidate]**:
v2/v3 normally, v3 unlayered/v3 layered for Layers, and identical plain Sass
input in two timing lanes for baseline. Each inner `samplesMs` array contains
ten chronological measured compilation durations in milliseconds.

If rendered as a tuple in JSON property order, each `statsMs` object is
**(median, mean, min, max, p95, stddev)**, all in milliseconds. Median averages
the middle two sorted samples; p95 uses nearest rank (therefore equals max for
ten samples); standard deviation is population standard deviation. The
interruption's approximate 43.8/98.3 and 381.7/1039.2 values are the **minima**
for common at 100 and 1,000, respectively, not medians or complete tuples.

`deltaPercent = 100 × (candidate median / reference median − 1)`;
`speedup = reference median / candidate median` (less than one means slower).
Tables below instead show the intuitive candidate/reference **time ratio**.
`cssBytes` measures UTF-8 bytes of expanded CSS, without gzip.
`totalCalls` counts public fixture mixin invocations, not internal helper calls;
`callsPerInstance` is the per-component count. Layers additionally records one
`extraCandidateOrderingCalls` for `css-layers()`.

## Comparability audit

- **Workload:** v2 and v3 use the very same generated SCSS body, with only the
  module prelude differing. Counts were independently checked against literal
  `@include bem.` occurrences at every saved scale. Per instance: block 1;
  common 5 (one block, two elements, two modifiers); nested 3; extend 3;
  mixed 11. Internal helper counts intentionally differ between implementations.
- **Semantics:** each side is checked against independently constructed ordered
  selectors and declarations, preserving descendant whitespace, rule order,
  declaration order and values. Every timed result must also equal its own
  preflight CSS byte-for-byte. Fresh two-instance audit compiles additionally
  produced byte-identical v2/v3 output in every cross-version scenario.
  These simple fixtures need no general CSS equivalence engine.
- **Layers:** the candidate adds one order declaration and one `molecules`
  wrapper per root component. The harness verifies the order statement, wrapper
  count, and exact ordered rules after removing those known wrappers. Layers
  intentionally changes cascade behavior; this check establishes retained inner
  selectors/declarations, not universal cascade equivalence with unlayered CSS.
- **Warnings:** timed options use `sass.Logger.silent` on both sides; there is
  no terminal logging cost on either. An untimed verbose collecting logger found
  two legacy `if-function` deprecations per compile and no v3 warnings or debug
  messages. They originate in `agnosticBlock` and `tool.list-to-string`.
  Thus logger policy is equal, warning generation is not. The legacy warning
  work cannot explain why v3 is slower. Normal test warnings remain enabled.
- **Timing boundary:** fixture generation, expected CSS construction, preflight,
  output checking, statistics, console output and file writes are outside the
  timer. Sass parsing, module loading/evaluation and CSS serialization are inside.
- **Loading:** each side uses one `@use`, a root-relative file URL, the same
  installed compiler, and fresh module evaluation for every compilation. V3
  forwards its core once; it does not import modules or compile an additional
  fixture per component. The audit reports 14 loaded URLs for v2 and 3 for v3,
  including each synthetic entry URL (13 versus 2 dependency files). The native
  module graphs differ because these are the real entry points. V3 configuration
  validation executes once per compilation; name/nesting validation and selector
  derivation execute per mixin call. No theme loading is requested.
- **Order:** first side alternates across warmups/measured pairs and between
  scenario/scale rows. Ten measured pairs give each side five first positions.
  Scenario order itself is fixed, so cross-scenario absolute times should not be
  treated as controlled subtraction experiments.

## Realistic mixed workload — primary result

Each component has base declarations, a modified title, a body element, an icon
with `:before`, an active modifier, an extend/label composition, and a nested
badge/text composition: 11 public calls and seven emitted rules per instance.

| Instances | v2 median ms | v3 median ms | v3 delta | Time ratio | CSS bytes, each |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | 24.63 | 31.44 | +27.65% | 1.28× | 3,115 |
| 100 | 162.96 | 274.74 | +68.59% | 1.69× | 31,742 |
| 500 | 819.47 | 1,492.92 | +82.18% | 1.82× | 161,742 |
| 1,000 | 2,161.81 | 4,293.75 | +98.62% | 1.99× | 324,249 |

At 1,000, mean times are 2,517.34/4,497.53 ms and population standard
deviations 628.71/1,239.61 ms. There is substantial machine/runtime variability.
The median of the ten within-pair time ratios is 1.73×, distinct from the
1.99× ratio of separate medians. V3 is slower in all ten pairs at 100, 500 and
1,000. At 1,000, median paired ratios grouped by first side are 1.81× when v2
runs first and 1.60× when v3 runs first. The direction is robust to ordering;
the exact percentage is not a universal performance constant.

## Block and common workloads

| Workload | Instances | v2 median ms | v3 median ms | v3 delta | CSS bytes, each |
| --- | ---: | ---: | ---: | ---: | ---: |
| block | 100 | 39.59 | 30.93 | −21.88% | 3,290 |
| block | 1,000 | 344.25 | 427.46 | +24.17% | 33,891 |
| block | 5,000 | 1,350.35 | 1,316.24 | −2.53% | 173,891 |
| common | 100 | 46.02 | 110.23 | +139.54% | 13,174 |
| common | 1,000 | 872.68 | 1,352.83 | +55.02% | 134,677 |
| common | 5,000 | 2,411.07 | 6,642.10 | +175.48% | 686,677 |

Block-only is within roughly 3% at 5,000; its noisy 1,000-instance medians do
not establish a consistent block regression. Common is 2.40×/1.55×/2.75× by
ratio of medians. Common's median paired ratios are 2.33×/2.71×/2.74×; the
1,000-instance discrepancy reflects large timing shifts during that row, not
a change in what its stored fields mean. V3 is slower in all ten pairs at
every common scale. At 5,000 even the fastest v3 sample (5,552.49 ms) exceeds
the slowest v2 sample (4,652.94 ms); first-side groups have paired median
ratios 2.70× and 2.75×. Equal CSS size and balanced order rule out those
explanations for the large common regression.

## Nested blocks and extend

| Workload | Instances | v2 median ms | v3 median ms | v3 delta | CSS bytes, each |
| --- | ---: | ---: | ---: | ---: | ---: |
| nested | 100 | 92.44 | 77.50 | −16.17% | 4,590 |
| nested | 1,000 | 938.01 | 875.70 | −6.64% | 46,891 |
| nested | 5,000 | 4,531.86 | 4,143.35 | −8.57% | 238,891 |
| extend | 100 | 191.21 | 201.07 | +5.16% | 5,990 |
| extend | 1,000 | 886.83 | 985.47 | +11.12% | 60,891 |
| extend | 5,000 | 4,276.10 | 4,345.02 | +1.61% | 308,891 |

Nested uses a root block, nested card block and title element. Extend uses
root block → `extend('icon', 'active')` → label element; this API composes
selectors and is not Sass placeholder `@extend`. The small extend difference
at 5,000 is within the substantial observed variability.

## CSS Layers overhead

These are **paired v3 versus v3** measurements of the mixed fixture, not v2
comparisons. Use their unlayered lane as the baseline, not the separate mixed row.

| Instances | Unlayered median ms | Layered median ms | Time overhead | CSS bytes unlayered/layered |
| ---: | ---: | ---: | ---: | ---: |
| 10 | 61.27 | 68.86 | +12.39% | 3,115 / 3,770 |
| 100 | 582.93 | 610.06 | +4.65% | 31,742 / 37,527 |
| 500 | 1,514.56 | 1,703.59 | +12.48% | 161,742 / 190,327 |
| 1,000 | 3,206.73 | 3,380.99 | +5.43% | 324,249 / 381,334 |

At 1,000, expanded output grows by 57,085 bytes (+17.61%), including wrapper
indentation and the explicit layer-order statement. Median paired time overhead
is 7.20% at that scale. These noisy samples support modest overhead, not an
exact fixed percentage or a statistically established bound.

## Likely hotspot: validation cost

[The diagnostic script](../benchmarks/investigate-common.mjs) reuses the original
harness's pure fixture generator and checks, leaving the original harness and
production source untouched. It compiles common at 1,000 instances with two
warmup rounds and six measured rounds per variant, rotating the starting
variant and reversing alternate rounds. All variants load through the same
in-memory importer. Fixture generation, source transformations and output
assertions are outside timing. Every variant's CSS is byte-identical to stock
production v3 and matches the independent expected rules.

These are diagnostic ablations of valid-input work, **not safe alternative
implementations**. They remove behavior required for invalid inputs; the
selector-nest bypass asserts that the fixture's scope is empty. No modified
SCSS was written under `src/`. Temporary copies are under
`tmp/benchmarks/core-v2-v3-diagnostics/`; raw samples, exact source hashes and
the warning audit are preserved in
[the diagnostic results](../benchmarks/results/core-v2-v3-diagnostics.json).

| Diagnostic variant | Median ms | Change versus diagnostic stock |
| --- | ---: | ---: |
| Stock v3 | 1,095.22 | — |
| Bypass `-name` validation | 985.95 | −9.98% |
| Bypass `-validate` nesting validation | 906.25 | −17.25% |
| Bypass both validations | 723.89 | −33.91% |
| Replace explicit owner `selector.parse` with its class string | 1,177.73 | +7.53% |
| Return subject instead of `-complete-selector` nesting, empty scope only | 1,026.06 | −6.32% |

**Validation cost is the strongest directly demonstrated contributor.** Every
common component invokes name validation and nesting validation five times.
`-name` checks characters in a Sass loop; `-validate` constructs the allowed
transition map on every invocation and performs map/list checks. The latter
experiment removes both validation logic and that map construction, so it
does not separate their individual costs. Removing both is consistently
faster than stock across all six rounds. The reductions are not additive
cost-accounting estimates: runtime/GC interactions and sampling noise remain.

The explicit owner parse runs once per common component. Its bypass did not
help here; passing a string still permits downstream selector APIs to parse
it, so this does not prove that all parsing is free. Common uses four
`selector.append` operations and five `-complete-selector` calls per component;
the latter's empty-scope bypass produced only a modest observed reduction.
Selector manipulation remains a possible residual contributor, but there is
no evidence that the explicit owner parse is the dominant hotspot.

Immutable child-context map construction and stack append/restore still run
in all these variants and were not isolated. Their costs therefore remain
unquantified, as do individual module/config lookups. Common's stack depth is
bounded at three regardless of instance count; there is no fixture-driven
stack growth with scale. V2 element/modifier paths largely interpolate
selectors without v3's per-call validation and context lifecycle, which
explains why block-only performance need not predict common performance.
The evidence supports validation as a substantial part of the regression,
not a claim that it explains the entire gap.

Diagnostic stock timing is a new, smaller experiment with in-memory module
loading; do not substitute it for the original file-loaded v3 measurement or
subtract it from a v2 sample collected hours earlier. This investigation did
not optimize production code or change validation requirements.

## Reproduction and verification

Use Node 22.19.0 (the default shell in the resumed session selected Node 16,
so the installed Node 22.19.0 executable was explicitly selected). Existing
results are authoritative for this report; the following commands are for
future intentional reproductions, not necessary continuation work:

```sh
# Choose a NEW output name: the original harness overwrites its output JSON.
npm run benchmark:core -- --output=core-v2-v3-new-run
node benchmarks/investigate-common.mjs
npm test
npm run test:legacy
```

The diagnostic script writes its own separate output directory and never
touches `tmp/benchmarks/core-v2-v3/results.json`. The original harness was
retained without restart or redesign. The new diagnostic tooling uses only
Node built-ins and the existing Dart Sass dependency.

Verification completed successfully: `npm test` and `npm run test:legacy`
both exited 0 with no failures; `git diff --check` passed. The source hash
check after diagnostics confirms the production core is unchanged from the
reused benchmark. Existing unrelated working-tree changes were retained.

## Scope and limitations

All requested main scenarios completed in the existing run. Optional memory,
custom-separator and 10,000-instance measurements were skipped. Baseline plain
Sass medians were 1.89/1.86 ms; this excludes library imports and is not an
estimate of library startup cost. Results are warm-process compilation timings,
not cold Node process startup, Sass Embedded, incremental builds or browser
rendering performance. No confidence intervals were estimated from these ten
samples. Legacy output is evidence for these comparisons, not new v3 API approval.

## Optimized production v3

Measured 23 September 2026 after full regression validation. The two previously
implemented changes remain: a private immutable transition map and equivalent
`string.split()` / `@each` BEM name validation. No selector, context, stack,
emission, separator, layer or public API behavior changed. See
[adoption and recovery evidence](PERFORMANCE-DECOMPOSITION-v3.md#production-adoption-and-verification)
for exact source/test scope, hashes, equivalence coverage and validation counts.
No production or test source was edited during this resumed task.

The three lanes are **v2**, **original stable v3** (the preserved pre-optimization
core), and **optimized production v3**. The earlier diagnostic equivalent variants
are not timing substitutes for any lane. Each workload runs in one fresh Node
22.19.0 process with Dart Sass 1.104.1 on the same Intel Core Ultra 5 238V. All
lanes use `sass.compileString` and real file imports. Old v3 has the same public
entry/core file layout as current v3 in a temporary directory. V2 uses its own
legacy module layout; that unavoidable difference is included in compile time.

[`production-performance.mjs`](../benchmarks/production-performance.mjs) reuses
the original fixture generator, expected rules and statistical definitions.
Each lane gets **3 warmups and 10 measured rounds**, rotating the starting lane
and reversing alternate orders. Workloads run sequentially; no concurrent test
or timing suite is deliberately run. Timing includes synchronous compilation,
excluding fixture generation, assertions and file output. GC is not forced.
No sample is discarded. Reported p95 uses nearest rank (with ten samples, p95
equals max); standard deviation is population, not sample. Paired ratios divide
times from the same round and need not equal ratios of lane medians.

An untimed warning audit records two legacy `if()` deprecations and no warnings
from either v3 lane. Timed lanes all use the same quiet logger to exclude warning
I/O; warnings remain available in the raw JSON. Test diagnostics were not hidden.

Every lane matches independently generated expected selectors/declarations.
All three also produce byte-identical expanded CSS on these intentionally shared
Common and Mixed workloads, in preflight, warmups and every measured round.
This v2 equivalence claim does not extend to non-shared library semantics.

Raw chronological samples, execution order, hashes, warning audit, paired ratios
and full statistics are retained under
[`benchmarks/results/production-optimizations/`](../benchmarks/results/production-optimizations/).
The original benchmark and diagnostic JSON files remain unchanged. Results from
different dates are historical context only; all comparisons below use this run.

### Contemporaneous timings

All durations are milliseconds. “Old v3” means original stable v3.

| Workload | Lane | Median | Mean | Min | Max / p95 | Population SD |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Common / 1,000 | v2 | 343.59 | 343.14 | 278.67 | 399.94 | 28.93 |
| Common / 1,000 | Old v3 | 905.42 | 909.53 | 756.09 | 1,071.88 | 73.49 |
| Common / 1,000 | Optimized v3 | 783.63 | 779.75 | 691.66 | 835.16 | 37.50 |
| Common / 5,000 | v2 | 2,016.04 | 2,089.84 | 1,699.39 | 2,805.31 | 320.89 |
| Common / 5,000 | Old v3 | 5,223.01 | 5,177.74 | 4,108.32 | 6,852.22 | 768.79 |
| Common / 5,000 | Optimized v3 | 4,568.22 | 4,588.18 | 3,669.65 | 5,702.85 | 754.89 |
| Mixed / 1,000 | v2 | 1,053.38 | 1,131.01 | 976.88 | 1,454.27 | 164.58 |
| Mixed / 1,000 | Old v3 | 2,049.11 | 2,083.35 | 1,710.57 | 2,904.43 | 368.51 |
| Mixed / 1,000 | Optimized v3 | 1,725.44 | 1,972.09 | 1,498.99 | 3,290.67 | 532.23 |

### Median changes and paired consistency

Time reduction is `(old − optimized) / old`; the residual v2 gap is
`optimized / v2 − 1`; recovered gap is `(old − optimized) / (old − v2)`.
All three use contemporaneous lane medians, not historical medians.

| Workload | Time reduction vs old | Speedup vs old | Slower than v2 | Original median gap recovered | Faster pairs vs old / v2 | CSS bytes, each lane |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Common / 1,000 | 13.45% | 1.155× | 128.07% (2.281×) | 21.68% | 10/10 / 0/10 | 134,677 |
| Common / 5,000 | 12.54% | 1.143× | 126.59% (2.266×) | 20.42% | 7/10 / 0/10 | 686,677 |
| Mixed / 1,000 | 15.80% | 1.188× | 63.80% (1.638×) | 32.51% | 6/10 / 0/10 | 324,249 |

Paired ratio below 1 means optimized v3 was faster. Full per-round ratios are
in the linked raw JSON.

| Workload | Ratio denominator | Median | Mean | Min | Max / p95 | Population SD |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Common / 1,000 | Old v3 | 0.862 | 0.861 | 0.730 | 0.918 | 0.053 |
| Common / 1,000 | v2 | 2.328 | 2.283 | 2.010 | 2.482 | 0.150 |
| Common / 5,000 | Old v3 | 0.895 | 0.894 | 0.680 | 1.089 | 0.137 |
| Common / 5,000 | v2 | 2.180 | 2.204 | 1.703 | 2.600 | 0.249 |
| Mixed / 1,000 | Old v3 | 0.929 | 0.944 | 0.703 | 1.158 | 0.154 |
| Mixed / 1,000 | v2 | 1.639 | 1.741 | 1.131 | 2.329 | 0.341 |

### Mean and tail changes

Changes below compare optimized with old v3; positive means increased.

| Workload | Mean change | p95 change | Population SD change |
| --- | ---: | ---: | ---: |
| Common / 1,000 | -14.27% | -22.08% | -48.97% |
| Common / 5,000 | -11.39% | -16.77% | -1.81% |
| Mixed / 1,000 | -5.34% | +13.30% | +44.43% |

**Mixed / 1,000 carries the greatest practical weight.** Its median falls by
323.67 ms (15.80%; 1.188× speedup), recovering 32.51% of the contemporaneous
original v2-to-v3 median gap. Optimized v3 still takes 1.638× v2 time (+63.80%).
The benefit is not uniform: only six paired rounds improve, the median paired
ratio is 0.929, and mean time improves only 5.34%. Its worst/p95 compile rises
from 2,904.43 to 3,290.67 ms, with population SD rising 44.43%. Thus typical
time improves but observed tail variability worsens. Ten rounds cannot establish
whether this is repeatable or attribute it to split-list allocation or GC.

Common / 1,000 has the strongest consistency: all ten paired rounds improve,
with lower mean, p95 and SD. Common / 5,000 improves in seven paired rounds;
its median is 4,568.22 ms and mean 4,588.18 ms, versus 5,223.01 / 5,177.74 ms
in old v3. Its worst/p95 falls from 6,852.22 to 5,702.85 ms. No large sample
was removed, including the tails that motivated this check. Absolute SD improves
only 1.81% (768.79 to 754.89 ms); relative variability (SD/mean) increases from
14.85% to 16.45%. This is lower tail latency, not evidence that variability is
solved or that the historical diagnostic outlier can never recur.

**Keep both optimizations in production.** They preserve the tested contract and
architecture, improve all three medians and means, and recover a meaningful but
incomplete part of the regression. This combined production comparison does not
isolate each change's individual contribution; the historical equivalent-variant
experiments supply that supporting evidence. Optimized v3 remains slower than v2
in every paired round on all three workloads. The residual Common gap exceeds
2×, so no claim of v2 parity or universal speedup is justified.

Further investigation is reasonable if representative application builds are
affected; the next recommendation is profiling **Mixed workload allocation/GC
and tail variability** before deciding on more code changes. The earlier
empty-scope completion idea remains a separate decision requiring equivalence
evidence. No next investigation, fast path, string selector construction,
positional context, stack change, emission shortcut, external linting or functional
selector implementation was started. Legacy files were not modified.

To intentionally reproduce later, use new tags to preserve these results:

```sh
# With Node 22.19.0 selected; run sequentially.
node benchmarks/production-performance.mjs --scenario=mixed --scale=1000 --tag=mixed-1000-new
node benchmarks/production-performance.mjs --scenario=common --scale=1000 --tag=common-1000-new
node benchmarks/production-performance.mjs --scenario=common --scale=5000 --tag=common-5000-new
```

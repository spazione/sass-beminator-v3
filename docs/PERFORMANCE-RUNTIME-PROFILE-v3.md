# Mixed runtime profiling of optimized v3

Diagnostic investigation, 23 September 2026. Production and existing tests are
unchanged. The private static transition map and split/iteration name validator
remain in production. This report supplements, rather than replaces, the
[production performance comparison](PERFORMANCE-v2-v3.md#optimized-production-v3).

**Retain both production optimizations.** Slow Mixed samples recur, but the
earlier split-specific tail regression does not reproduce consistently. Split
uses less sampled allocation than either old v3 or numeric-static, and longer
names strengthen its advantage. GC contributes measurable time but does not
account for most of the remaining v2/v3 gap. Real application build measurement
should precede more synthetic tuning.

## Method and evidence

The isolated runner is
[`benchmarks/profile-mixed-runtime.mjs`](../benchmarks/profile-mixed-runtime.mjs).
Raw results and inspector profiles are under
[`benchmarks/results/runtime-profile/`](../benchmarks/results/runtime-profile/).
Every run has a unique tag, a completion marker, source hashes, execution order,
every warmup and measured sample, before/after memory and host observations, and
CSS correctness checks. Existing evidence cannot be overwritten by the runner.
Temporary transformed Sass is confined to `tmp/benchmarks/runtime-profile/`.

The primary lanes are v2, old stable v3 from the frozen reference, and optimized
production v3 (named `split` in the JSON). All use real file imports, the same
Node 22.19.0 / Dart Sass 1.104.1 environment, and the original Mixed/1,000 fixture
generator and expected CSS from the production benchmark. There are 11,000 public
calls and 324,249 expanded CSS bytes per compilation. All three lanes produce
byte-identical expected CSS in preflight, warmups and measured compiles.

Primary repeatability uses 5 warmups and 30 measured rounds per lane. Each round
rotates its starting lane and reverses alternate orders. Compilation alone is
timed; memory/CPU observations, CSS assertions and result I/O are outside its
timer. No forced GC, observer or inspector operates in this primary mode.
No sample is removed. Percentiles use nearest rank; population SD and SD/mean
(coefficient of variation, CV) describe the full distribution. With 30 samples,
p99 would merely select the maximum, so it is explicitly omitted.

All subsequent modes are separate processes/experiments. GC and forced-GC modes
use 5 warmups and 20 measured rounds per lane. Validator isolation uses the same
counts. Name-length and structural controls use 3 warmups and 8 measured rounds
per lane. CPU and sampled-allocation modes use 3 warmups and 3 measured rounds
per lane. These smaller diagnostic samples are not reliable tail quantiles.
No concurrent benchmark or test suite is deliberately run.

### GC and memory instrumentation

`PerformanceObserver` captures GC start times, durations and kinds. Because Sass
compiles synchronously, callbacks arrive later. The runner drains two event-loop
turns after each compile and again at completion, then assigns events by their
start timestamps within each compile interval. It retains all observed events,
including those outside compile windows. Kinds are 1=minor, 4=major,
8=incremental, 16=weak-callback. This follows the
[Node 22.19 performance hooks API](https://nodejs.org/download/release/v22.19.0/docs/api/perf_hooks.html).
GC count, summed duration and largest event are correlated with compile duration
using both Pearson and Spearman coefficients. Correlation alone is not causation:
a general slowdown can make both evaluator work and GC take longer.

GC event duration is not all concurrent collector CPU work. Summing it offers
an observed GC wall-time component, not complete allocation/GC cost accounting.
Timestamp attribution works in this environment; a trace-GC fallback is therefore
unnecessary. Primary timings contain no GC trace console I/O.

Memory observations include `heapUsed`, `heapTotal`, `rss`, `external`, and
`arrayBuffers` immediately before/after each compile. Instrumented modes also
observe memory after draining callbacks. Heap delta is a net live-heap change,
not temporary allocation volume; negative deltas can mean collection of earlier
compilations. RSS and heap capacity can remain reserved after collection.

The forced-GC mode uses `--expose-gc`, invokes `global.gc()` before each compile,
and drains those events before timing. These forced events are excluded from
per-compile GC totals. It is a variability experiment, not a production-mode
speed comparison. Do not compare its absolute median as though conditions were
identical to normal runtime.

### Controlled variants and profiler limits

The numeric-static variant replaces only `-name()` in a temporary copy of current
production with the frozen numeric-loop validator. Split uses current production.
Both retain the same static relationship map. A third variant bypasses name
validation completely; it is only a valid-input lower bound, never a production
candidate. All variants must produce the same expected CSS for these inputs.

Name-length controls rename all BEM names, including modifiers and extend targets,
to valid unique identifiers of exactly 5, 20 or 80 characters, while retaining
Mixed's 11,000 calls and structure. The qualifier `:before` is unchanged. Longer
names also lengthen selectors and output; this is not a pure allocation microtest.
The within-length numeric/split comparison isolates validator implementation.

The 5-character Mixed fixture also supplies the selector-heavy control (nested
blocks, modifiers, extend and qualifiers). Its companion uses 11,000 empty root
block calls with a 5-character valid name. Both execute public validation and
normal selector/context machinery; the latter has no emitted CSS or nested
composition. It cannot isolate validation from every selector operation because
even a root block constructs an owner selector.

CPU profiles use Node's built-in inspector with a 1 ms sampling interval around
individual compiles. Generated `sass.dart.js` frames do not directly identify
BEMinator private Sass helpers. Named self samples and stack-inclusive categories
are reported separately; inclusive categories overlap and must not be summed.
[Node inspector documentation](https://nodejs.org/download/release/v22.19.0/docs/api/inspector.html)
describes the built-in profiling interface.

Allocation profiles use inspector sampling at 32 KiB with both
`includeObjectsCollectedByMajorGC` and `includeObjectsCollectedByMinorGC` enabled.
They therefore include sampled temporary objects rather than just survivors.
The [DevTools heap profiling protocol](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/json/js_protocol.json)
defines these options. Reported sampled estimates are approximate JavaScript
allocation volume, not an exact byte counter or all native memory. Allocation
sampling perturbs execution, so its durations are not production timings.

Sass Embedded is not installed in this project. The optional experiment is
skipped; no dependency was installed or changed. All conclusions apply to the
current JavaScript-hosted Sass compiler, not to a comparison with Embedded.

## A. Repeatability

Primary `repeat-30`: 30 measured compiles per lane after 5 warmups.

| Lane | Median ms | Mean | Min | Max | p90 | p95 | Population SD | CV % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| v2 | 1,014.74 | 1,083.86 | 979.93 | 2,048.50 | 1,204.83 | 1,438.47 | 206.11 | 19.02 |
| old-v3 | 1,766.57 | 1,962.71 | 1,694.80 | 4,858.80 | 2,002.10 | 3,766.61 | 652.05 | 33.22 |
| split | 1,532.26 | 1,625.14 | 1,466.78 | 2,828.09 | 1,846.82 | 2,242.45 | 272.43 | 16.76 |

| Lane | >1.25× median | >1.50× median | >1.75× median |
| --- | --- | --- | --- |
| v2 | 3 | 1 | 1 |
| old-v3 | 3 | 2 | 2 |
| split | 3 | 1 | 1 |

| Paired ratio | Median | Mean | Min | Max | p95 | SD | Split faster |
| --- | --- | --- | --- | --- | --- | --- | --- |
| split/v2 | 1.51 | 1.51 | 0.95 | 2.11 | 1.71 | 0.16 | 1/30 |
| split/old-v3 | 0.86 | 0.86 | 0.40 | 1.47 | 1.07 | 0.16 | 28/30 |


## B. GC and forced-GC observations

Separate `gc-20` run, 20 measured compiles per lane. All times below are ms.

| Lane | Median ms | Mean | Min | Max | p90 | p95 | Population SD | CV % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| v2 | 1,116.03 | 1,154.05 | 1,066.53 | 1,369.65 | 1,275.49 | 1,326.98 | 84.28 | 7.30 |
| old-v3 | 1,904.71 | 1,955.95 | 1,854.02 | 2,345.25 | 2,072.50 | 2,166.49 | 118.19 | 6.04 |
| split | 1,712.92 | 1,764.29 | 1,636.75 | 2,342.35 | 1,867.61 | 2,019.29 | 163.34 | 9.26 |

| Lane | Events mean [min–max] | GC mean / p95 | Largest event | Mean GC / compile | Pearson r: time / count / largest | Spearman ρ: time / count / largest |
| --- | --- | --- | --- | --- | --- | --- |
| v2 | 88.75 [88–90] | 139.24 / 162.08 | 7.42 | 12.06% | 0.76 / 0.14 / 0.26 | 0.65 / 0.22 / 0.34 |
| old-v3 | 167.90 [167–169] | 214.19 / 246.22 | 9.07 | 10.96% | 0.56 / 0.21 / 0.05 | 0.51 / 0.31 / 0.28 |
| split | 148.20 [147–150] | 204.70 / 268.99 | 12.09 | 11.59% | 0.78 / -0.07 / 0.02 | 0.49 / 0.11 / 0.21 |

Forced-GC mode (`forced-20`) versus normal observer mode; absolute medians are not interchangeable.

| Lane | Normal CV % | Forced CV % | Normal p95/median | Forced p95/median | Forced GC mean ms | Forced tails >1.25 / 1.50 / 1.75 |
| --- | --- | --- | --- | --- | --- | --- |
| v2 | 7.30 | 19.83 | 1.19 | 1.49 | 130.06 | 3 / 1 / 1 |
| old-v3 | 6.04 | 18.24 | 1.14 | 1.39 | 194.17 | 6 / 1 / 0 |
| split | 9.26 | 17.47 | 1.18 | 1.33 | 180.57 | 3 / 0 / 0 |


## C. Memory distributions

Primary run, MiB. Each cell is median [minimum–maximum] over 30 observations; deltas are after minus before, not total allocation.

| Lane | Metric | Before | After | Delta |
| --- | --- | --- | --- | --- |
| v2 | heapUsed | 197.49 [111.70–365.34] | 209.09 [124.96–376.09] | 83.47 [-236.94–97.14] |
| v2 | heapTotal | 223.71 [153.42–395.91] | 236.18 [167.37–410.86] | 31.73 [-212.05–93.11] |
| v2 | rss | 534.77 [486.66–539.35] | 535.01 [484.96–539.40] | 2.09 [-5.49–2.17] |
| v2 | external | 7.77 [4.91–13.41] | 7.70 [4.84–13.41] | 2.78 [-8.57–2.78] |
| v2 | arrayBuffers | 5.75 [2.89–11.39] | 5.68 [2.82–11.39] | 2.78 [-8.57–2.78] |
| old-v3 | heapUsed | 209.16 [113.03–369.85] | 197.55 [112.36–366.92] | 78.49 [-255.66–81.16] |
| old-v3 | heapTotal | 235.68 [151.92–396.66] | 227.68 [177.92–396.41] | 26.80 [-218.74–81.66] |
| old-v3 | rss | 534.32 [486.86–539.40] | 534.86 [484.65–539.42] | 1.86 [-5.75–41.46] |
| old-v3 | external | 7.70 [4.84–13.42] | 7.70 [4.91–13.42] | 2.85 [-8.50–2.86] |
| old-v3 | arrayBuffers | 5.68 [2.82–11.39] | 5.68 [2.89–11.39] | 2.85 [-8.50–2.85] |
| split | heapUsed | 202.29 [112.42–376.09] | 195.18 [111.70–366.18] | 77.55 [-256.31–79.50] |
| split | heapTotal | 234.75 [177.92–410.86] | 223.71 [151.92–394.41] | 20.98 [-257.44–79.41] |
| split | rss | 534.95 [484.65–539.42] | 534.59 [486.66–538.88] | 1.86 [-5.84–2.41] |
| split | external | 7.70 [4.84–13.42] | 7.77 [4.92–13.42] | 2.86 [-8.50–2.86] |
| split | arrayBuffers | 5.68 [2.82–11.39] | 5.75 [2.89–11.39] | 2.86 [-8.50–2.86] |


## D. Isolated validator comparison

`validators-20`: 20 measured compiles each; static transition map identical in all lanes.

| Lane | Median ms | Mean | Min | Max | p90 | p95 | Population SD | CV % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| numeric-static | 1,752.30 | 1,820.69 | 1,669.04 | 2,254.41 | 2,180.65 | 2,236.56 | 176.64 | 9.70 |
| split | 1,705.44 | 1,749.08 | 1,598.25 | 2,190.40 | 1,948.88 | 1,958.52 | 151.81 | 8.68 |
| bypass-static | 1,470.35 | 1,521.96 | 1,433.44 | 1,869.48 | 1,659.65 | 1,690.58 | 111.21 | 7.31 |

| Lane | GC events mean | GC ms mean | Largest event ms | Heap delta MiB [range] | RSS delta MiB [range] |
| --- | --- | --- | --- | --- | --- |
| numeric-static | 156.25 | 221.74 | 7.06 | 76.65 [-303.44–91.37] | 1.62 [-5.96–1.88] |
| split | 147.90 | 208.02 | 7.14 | 77.87 [-226.62–92.19] | 1.66 [-5.60–1.88] |
| bypass-static | 130.55 | 192.23 | 8.55 | 80.35 [-232.07–84.71] | 1.62 [-6.09–82.73] |

| Paired ratio | Median | Mean | Split faster |
| --- | --- | --- | --- |
| split/numeric-static | 0.95 | 0.96 | 17/20 |
| split/bypass-static | 1.13 | 1.15 | 0/20 |


## E. Name-length and structural controls

8 measured compiles per lane per workload. Nearest-rank p95 equals max at this sample size.

| Workload | Lane | Median ms | Max ms | CV % | GC count mean | GC ms mean | Heap delta median MiB | RSS delta median MiB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| names-5 | numeric-static | 1,684.11 | 1,748.25 | 1.76 | 154.12 | 202.00 | 4.58 | 1.72 |
| names-5 | split | 1,597.06 | 1,697.91 | 2.30 | 146.38 | 197.83 | 84.28 | 1.74 |
| names-20 | numeric-static | 2,307.27 | 3,302.88 | 13.84 | 204.12 | 255.74 | 81.39 | 1.43 |
| names-20 | split | 1,993.10 | 2,592.80 | 11.20 | 175.12 | 235.63 | 44.38 | 0.70 |
| names-80 | numeric-static | 6,824.64 | 8,458.15 | 15.53 | 406.88 | 601.77 | -51.40 | 1.56 |
| names-80 | split | 4,132.53 | 5,152.63 | 13.18 | 289.25 | 425.70 | 110.06 | 1.88 |
| validation-heavy | numeric-static | 1,369.46 | 2,066.11 | 15.70 | 132.75 | 145.30 | 61.27 | 2.62 |
| validation-heavy | split | 1,340.72 | 1,567.07 | 6.05 | 126.00 | 140.95 | 27.39 | 1.30 |


## F. Inspector profiles

CPU profile figures below are weighted by sampled time across three measured compiles per lane. Inclusive stack categories overlap. They are heuristic categories based on visible generated function names, not exact attribution to BEMinator helpers.

| Category | Old v3 % | Split % |
| --- | --- | --- |
| self_sass_generated | 83.04 | 78.55 |
| self_inspector_post | 6.34 | 9.44 |
| self_gc | 10.59 | 11.97 |
| self_selector | 2.57 | 2.38 |
| self_string | 3.54 | 2.85 |
| self_list_map | 10.35 | 9.84 |
| self_evaluator | 19.82 | 16.70 |
| self_module | 0.00 | 0.00 |
| self_serialization | 0.34 | 0.48 |
| inclusive_selector | 12.02 | 12.99 |
| inclusive_string | 6.05 | 5.40 |
| inclusive_list_map | 42.49 | 38.88 |
| inclusive_evaluator | 80.64 | 75.93 |
| inclusive_module | 0.17 | 0.17 |
| inclusive_serialization | 1.41 | 1.57 |

Allocation sampling includes objects collected by both minor and major GC. Three independently sampled compiles per lane, estimates in MiB.

| Lane | Sample 1 | Sample 2 | Sample 3 |
| --- | --- | --- | --- |
| v2 | 1,305.63 | 1,312.74 | 1,317.20 |
| old-v3 | 2,570.80 | 2,560.30 | 2,571.20 |
| numeric-static | 2,366.38 | 2,392.44 | 2,374.35 |
| split | 2,272.48 | 2,237.14 | 2,259.79 |

`sampledEstimatedBytes` is the analyzer's sum of heap-profile node `selfSize`.
The exact estimates per compile, in chronological sample order, are:

| Lane | Sampled estimate 1 (bytes) | Estimate 2 | Estimate 3 | Mean estimate |
| --- | ---: | ---: | ---: | ---: |
| v2 | 1,369,054,984 | 1,376,508,376 | 1,381,188,056 | 1,375,583,805 |
| old-v3 | 2,695,674,112 | 2,684,664,464 | 2,696,098,976 | 2,692,145,851 |
| numeric-static | 2,481,324,928 | 2,508,651,320 | 2,489,687,400 | 2,493,221,216 |
| split | 2,382,863,272 | 2,345,807,960 | 2,369,562,472 | 2,366,077,901 |

These are **sampled estimates**, not exact total allocated bytes. Mean estimates
are rounded to a byte only to make the saved numeric fields identifiable; that
precision is not measurement accuracy. Across three samples, split's range is
2.346–2.383 GB, old v3's 2.685–2.696 GB, numeric-static's 2.481–2.509 GB, and v2's
1.369–1.381 GB (decimal GB). All three split samples are below every numeric-static
and old-v3 sample. Mean split allocation is **12.11% lower than old v3**, **5.10%
lower than numeric-static**, and **72.01% higher than v2** in this diagnostic mode.
Inspector overhead and only three samples limit generalization. Profile file
size is not allocation volume; the smaller numeric-static profile file is complete
and must not be interpreted as a much smaller allocation sample.

The CPU percentages include inspector `post` self samples (6.34% old, 9.44% split),
so their denominators are captured profile time, not pure compiler time. The
large generated-Sass shares (83.04% / 78.55%) and GC shares (10.59% / 11.97%)
should be read with that overhead visible. Representative sampled functions
include `internalSet$2`, `_evaluate0$_runBuiltInCallable$3`,
`_evaluate0$_evaluateArguments$1`, `visitMapExpression$1`, and
`scope$1$3$semiGlobal$when`. These support evaluator dispatch, argument evaluation
and container work as material activity. They do not map directly to individual
private BEMinator Sass functions.

One demonstrated analysis bug was corrected during recovery: the string-name
heuristic originally matched `compileString`, an ancestor of almost every Sass
sample. Excluding that compiler entry reduces inclusive string attribution from
83.06% / 78.57% to **6.05% / 5.40%**. No profile or measurement changed. Categories
remain heuristic: list/map/iterator stack presence is 42.49% / 38.88%, selector
presence 12.02% / 12.99%, evaluator presence 80.64% / 75.93%. They overlap.
Serialization (1.41% / 1.57% inclusive) and module-specific named frames (0.17%
each) have small visible shares here; zero rounded self samples do not prove zero
cost. The profiles do not demonstrate a single dominant selector operation.

## G. Answers, residual gap and limitations

1. **Do slow Mixed runs correlate with GC?** Yes, cumulative GC duration correlates
   with compile duration in the normal observer run: Pearson r is 0.764 v2,
   0.561 old v3 and 0.784 split; Spearman values are 0.651, 0.508 and 0.490.
   Counts barely vary (88–90, 167–169, 147–150), and their correlations are weak.
   The largest-event correlations are also weak, especially split (r=0.019).
   Most events are minor collections: 1,756 / 3,348 / 2,944 across the 20 compiles.
   This is evidence of cumulative GC cost, not proof that GC causes extreme tails.
   A shared slowdown can increase evaluator and collector durations together.

2. **Is GC large enough to explain the v2/v3 gap?** Observed GC intervals occupy
   about 11–12% of compile time in `gc-20`. Using means from that same experiment:

   | Comparison | Compile-time difference ms | GC-duration difference ms | Arithmetic GC share of gap | Difference after subtracting observed GC ms |
   | --- | ---: | ---: | ---: | ---: |
   | Old v3 minus v2 | 801.90 | 74.95 | 9.35% | 726.95 |
   | Split minus v2 | 610.24 | 65.45 | 10.73% | 544.79 |
   | Old v3 minus split | 191.65 | 9.49 | 4.95% | 182.16 |

   This arithmetic is not a causal decomposition: concurrent collector work and
   allocation/evaluator interactions remain. Still, the measured GC-duration
   difference is much smaller than the remaining gap. Forced GC did not rescue
   variability: split CV increased from 9.3% to 17.5% and p95/median from 1.18 to
   1.33. Its slowest forced-mode compile was 3,254 ms with 218 ms of in-compile
   GC and a largest event of 10.64 ms. The two modes ran sequentially, so host
   drift prevents interpreting that CV increase as a causal cost of forced GC.

3. **Does optimized v3 allocate more than old v3?** No evidence supports that:
   sampled mean allocation is 12.11% lower, with disjoint observed ranges. Net
   heap deltas alone would not reveal this. Primary before/after heap distributions
   overlap heavily, and all lanes share one process, so later RSS includes earlier
   compilations' heap capacity. Those snapshots are not per-lane retained-memory
   budgets or proof of a leak. The allocation experiment includes collected
   temporary objects but is still approximate and excludes some native allocation.

4. **Does split increase allocation pressure versus the numeric validator?** The
   controlled static-map pair points the other way: sampled allocation falls
   5.10%, mean GC time falls from 221.74 to 208.02 ms, and collection count falls
   from 156.25 to 147.90 per compile. Creating a character list does not establish
   greater *net* allocation than repeated numeric-loop evaluation and string work.
   The profiler cannot attribute every allocated object to `-name()` itself.

5. **Does split reproducibly worsen tails?** No. In the 30-round primary run it
   beat old v3 in 28/30 pairs, with median 1,532.26 versus 1,766.57 ms, lower p95
   (2,242.45 versus 3,766.61), and lower CV (16.76% versus 33.22%). In the static-map
   validator comparison it won 17/20 pairs and reduced p95 from 2,236.56 to
   1,958.52 ms. The primary split max was 2,828.09 ms (1.85× median), so slow tails
   themselves recur; an exact >3 s split sample did not occur in that primary run.
   Split exceeded 3 s in the separate forced-GC mode. Old v3 reached 4,858.80 ms
   in the primary run. The earlier ten-round split-specific p95 regression is
   therefore not a stable ranking. No outlier was discarded.

6. **Do longer names make split worse?** Both validators take longer, but split's
   relative advantage grows: median reductions are 5.17%, 13.62%, and 39.45% at
   5/20/80 characters. Paired wins are 8/8, 7/8, and 8/8. At 80 characters, split
   uses fewer GC events (289.25 versus 406.88) and less GC time (425.70 versus
   601.77 ms), with lower maximum time. The positive split heap delta and negative
   numeric heap delta there reflect collection phase, not contrary allocation
   evidence. Eight samples cannot characterize rare tails. Longer output and
   selector strings also contribute to scaling in both lanes.

7. **How much evidence points to shared host/runtime variability?** Same-round
   primary duration correlations are r=0.928 for v2/old v3, 0.448 old/split and
   0.588 v2/split. Primary rounds 28–29 slow down across all three lanes; another
   split tail occurs in round 5. There is no obvious Linux memory or load pressure:
   primary free memory stays above 13.78 GB and 1-minute load stays at or below
   1.16 on eight logical CPUs. CPU is Intel Core Ultra 5 238V, under WSL; full host
   observations and process RSS are in every sample. These checks cannot see all
   Windows-host contention, thermal/frequency effects, V8 tiering or scheduling.
   The common variation is observable; its specific external/runtime cause is
   unresolved. Process CPU time includes collector threads and cannot isolate
   descheduling by subtracting it from wall time.

8. **What does CPU profiling say?** Generated Sass evaluator/runtime work dominates
   the captured non-GC activity. List/map/iterator work and selector processing
   are visible; pure string work is not dominant after correcting the entrypoint
   misclassification. Module loading and serialization are small in these profiles.
   The empty-root control also costs less than short-name Mixed despite 11,000
   public calls: split medians are 1,340.72 versus 1,597.06 ms, with 140.95 versus
   197.83 ms mean GC. It has no emitted CSS and different context/selector work,
   so the difference cannot be assigned solely to selectors. Its numeric variant
   also has a slow sample without Mixed's selector structure. Tail variability
   therefore does not uniquely track name processing or selector-heavy structure.
   Our Sass code is executed by Dart Sass: these observations cannot separate
   “our Sass” from “Dart Sass internal work” as independent causal categories.

9. **What remains unexplained?** Optimized v3 still has a 51.00% median gap versus
   v2 in the contemporaneous primary run. It has 72.01% higher sampled allocation
   in the allocation experiment and more collections in `gc-20`. The largest
   remaining plausible source is extra non-GC evaluator and temporary-value/
   container work required by v3's validation, context and selector pipeline.
   The exact division among those Sass helpers, allocation setup, native selector
   algorithms and JIT/runtime effects is unresolved. The full name-validation
   bypass lowers its diagnostic median to 1,470.35 ms versus split's 1,705.44 ms,
   demonstrating remaining validation cost on valid inputs, not permission to
   remove validation. Neither that ablation nor sampling gives additive cost
   accounting or a production-safe next optimization.

## Recovery and production integrity

All ten result groups were already complete when recovery began:

| Group | Measured rounds per lane | Lanes | Saved completion (UTC, 2026-09-23) |
| --- | ---: | ---: | --- |
| repeat-30 | 30 | 3 | 08:08:48 |
| gc-20 | 20 | 3 | 08:11:10 |
| forced-20 | 20 | 3 | 08:14:16 |
| validators-20 | 20 | 3 | 08:16:28 |
| names-5 | 8 | 2 | 08:17:09 |
| validation-heavy | 8 | 2 | 08:17:44 |
| names-20 | 8 | 2 | 08:18:39 |
| names-80 | 8 | 2 | 08:20:46 |
| cpu-3 | 3 | 2 | 08:21:16 |
| allocation-3 | 3 | 4 | 08:22:42 |

**No profiling measurements were rerun.** Allocation completed after the last
visible intermediate progress: all 12 heap profiles are valid, as are the six
CPU profiles. There are 352 measured compiles, 102 warmups and 26 preflights.
Recovery verified completion markers, lane/round coverage, profile references,
saved medians and production/runner source hashes, then reran analysis only.
The one string-category analysis correction is documented above.

The production core SHA-256 remains
`3a73cbdbb227f0f7a0d1d7a092eea4c47510694b3361378f234ddc2921cce6cd`, matching
every experiment. `src/_index.scss` and the public API are unchanged. The saved
production-only check passed 508 tests. Final `npm test` passes; the direct
no-isolation detail run verifies 510 individual project tests, zero failures and
zero skips. `git diff --check` passes. No tests or shared compiler infrastructure
changed; historical spike suites were not rerun.

Derived analysis and table-generation scripts are retained alongside temporary
tooling under `tmp/benchmarks/runtime-profile/`. The final derived summary is
[`analysis-summary.json`](../benchmarks/results/runtime-profile/analysis-summary.json).
Raw profiles, GC events, individual memory observations, timing samples and
paired ratios remain unchanged. Use a new `--tag` for any future intentional
reproduction; the runner rejects existing tags. Do not combine timing distributions
from different modes into one production performance estimate.

## Evidence classification and decision

| Topic | Classification | Supported claim and limit |
| --- | --- | --- |
| GC contribution | STRONG EVIDENCE | Measurable 11–12% observed compile-time component; cumulative-duration correlation. Not enough observed GC difference to explain most of the gap or prove the extreme-tail cause. |
| Allocation pressure | STRONG EVIDENCE | Sampled JS allocation and collection counts remain higher than v2, but both optimizations reduce them relative to the relevant controls. Exact allocation totals and native costs remain unknown. |
| Split-validator tail effect | NO EVIDENCE | No reproducible detrimental effect in these controls; relative timing, sampled allocation and long-name scaling favor split. This is not proof about every workload. |
| Selector/evaluator CPU cost | STRONG EVIDENCE | Generated evaluator/runtime and container activity dominate visible non-GC work; selector activity is material but no specific operation is established as the dominant remaining cost. |
| Host/runtime noise | MODERATE EVIDENCE | Cross-lane temporal correlation and changing tail rankings support common effects; exact host, clock, JIT or scheduling causes are unresolved. |

**Directions A and F apply:** keep the current validator, and prioritize real
application build measurement over further synthetic tuning. The measured tails
are real benchmark observations, but their unstable ranking and synthetic context
do not establish a production problem worth another SassScript optimization.
**Direction E is conditional:** if real builds show a material problem, the
evaluator/container/selector pipeline is a better-supported investigation target
than blaming the split validator. The data do not justify direction C, nor the
claim in D that GC alone is the main explanation.

Keep both the immutable transition map and split/each validator. No production
code was edited, no further optimization was implemented, and the recommended
real-build measurement or subsequent investigation was not started. Empty-scope
completion, string selector construction, context/stack/emission changes, external
linting and functional pseudos remain untouched.

# V2 compiler-baseline comparison

**The existing Dart Sass 1.104.1 characterization is behaviorally compatible
with the historical Dart Sass 1.83.4 compiler for the tested scope.** All 79
compilation inputs produced identical CSS or the same exact Sass error message.
Both compilers also matched every existing captured behavioral artifact.
There are no affected characterization IDs with semantic differences.

This is compiler-baseline evidence only. It makes no decision about which
behaviors v3 should implement. No v3 implementation, dependency changes, legacy
changes, or characterization-artifact changes were made.

## Compiler and source provenance

| Item | Value |
| --- | --- |
| Compiler A | Dart Sass **1.104.1**, installed in the v3 project |
| Compiler B | Dart Sass **1.83.4**, already installed in the legacy project |
| B's resolved entry | `../sass-beminator/node_modules/sass/sass.node.js` |
| Node.js | 22.19.0 for both compilers |
| Legacy source revision | `18cf5ec052ae6acfafdca5ca6841dd37161a2032` |
| Historical playground SHA-256 | `48835279637f06a7d0f9fbd312f249e4d16bafffb1a30e8a111c3350556e560f` |

The experiment uses `createRequire()` rooted at the legacy project's
`package.json` to resolve its own installed Sass package. It verifies the
resolved package location and asserts that the compiler's `info` reports
`dart-sass\t1.83.4`. Compiler A's reported version is also asserted. Nothing was
installed. This compares the two Sass compilers through the same modern JS API;
it does not recreate the legacy Webpack pipeline or historical Node runtime.

## Scope and comparison method

The existing 58 characterization tests represent **79 compilation inputs**:

| Input group | Inputs per compiler | Equivalent results |
| --- | ---: | ---: |
| Core atomic fixtures | 21 | 21 |
| Regression sequences | 3 | 3 |
| Expected-error investigations, isolated and after history | 6 | 6 |
| Exploratory/commented cases | 7 | 7 |
| State isolation: 21 pairs of B-alone and A-then-B inputs | 42 | 42 |
| **Total** | **79** | **79** |

There were **158 compilations** across both versions. Each version produced
**77 successful CSS outputs and two expected compilation errors**.

Inputs were read directly from the existing `.scss` artifacts, including the
stored `alone.scss` and `sequence.scss` isolation inputs. Source hashes are
recorded in the temporary results. No fixtures were rewritten or reconstructed.
Both compilers received the exact same source, adapter `@use` prelude, synthetic
source URL, and compile options: SCSS syntax, expanded CSS, no additional load
paths, no charset/BOM emission, and no source maps. Each input was a fresh
compilation. A logger captured warnings separately from compilation results.

CSS comparisons use exact string equality after the existing helper's LF line
ending normalization. **No additional formatting or semantic normalization was
needed.** Selectors, combinators, selector ordering, rule ordering, declarations,
and layer structure are therefore identical. Each fresh result was also compared
with its currently captured 1.104.1 artifact, preventing an unnoticed baseline
change from being mistaken for compiler equivalence.

Error comparisons check error versus success, the complete exact `sassMessage`,
and the absence of returned CSS. Diagnostic rendering was recorded separately.
The two fresh compilers also produced identical full error diagnostics in this
execution environment. Warnings are excluded from behavioral equality and
reported below; an unexpected non-Sass failure would terminate the experiment.

## Known findings checked explicitly

| Finding / characterization IDs | Result under both compilers |
| --- | --- |
| `state-isolation/sibling-element-after-block` | Same state leak: B alone emits `.standard-object__after`; after sibling `block('icon')`, B emits `.standard-object .standard-object__after`. |
| `state-isolation/regression-after-sibling-block` | Same state leak: all six regression rules gain a leading `.standard-object` ancestor after the preceding sibling icon block. |
| `regression/complete` | All six rules and identifying declarations are identical between compilers. |
| `regression/historical-active-sequence` | Full active order, regression output in prior context, subsequent extends, second block, and both `@layer atoms` wrappers are identical. |
| `regression/sibling-elements` and `state-isolation/pippo-after-nested-icon` | Same sibling output; pippo/test-ele isolation holds under both versions. |
| `invalid/block-extend-block` and `invalid/block-extend-block-after-history` | Same BEMinator `INVALID NESTING` error, with the complete message unchanged. Neither compiler returns partial CSS. |
| `invalid/block-element-element` and `invalid/block-element-element-after-history` | Both succeed despite the historical ERROR comment, emitting duplicate `.standard-object__test-element` rules. |
| `invalid/block-modifier-modifier` and `invalid/block-modifier-modifier-after-history` | Both succeed despite the ERROR comment; the nested suffix remains `--test-element--test-element`. |
| `exploratory/extend-extend`, `exploratory/extend-block`, `exploratory/extend-extend-block` | Identical successful output; no compiler-specific nesting rejection. |
| `exploratory/extend-block-block`, `exploratory/block-block-block`, `exploratory/complete-stress-tree` | Identical successful output, including repeated `.icon .icon` descendants and their original rule order. |
| `exploratory/regression-commented-branch` | Identical `.standard-object__gigi--fatherdMod .icon--mod .icon__nested-element--nestedMod` rule and declaration. |

All **19 previously equivalent isolation comparisons remain equivalent**, and
both known leaks remain present. Their isolated/violating classifications match
the existing `result.json` observations under both compiler versions. Compiler
version does not explain the leaks or the two contradictory ERROR comments in
this tested scope. This does not identify the exact historical fixed bug.

## Error differences

**None.** The only throwing inputs are the two block/extend/block investigations.
The complete original messages, including quotes, emoji, and the original URL,
match the existing [isolated error artifact](../characterization/v2/invalid/block-extend-block.error.json)
and [contextual error artifact](../characterization/v2/invalid/block-extend-block-after-history.error.json).
There are no success-to-error or error-to-success transitions.

“No partial CSS” describes the synchronous JavaScript API's lack of a returned
compile result when it throws, not a claim about internal evaluation before the
error. Both fixtures contain CSS declarations before their invalid nesting.

## Warning differences

| Compiler | Warning category | Occurrences over 79 inputs |
| --- | --- | ---: |
| 1.104.1 | `if-function` deprecation | 158 |
| 1.83.4 | None observed | 0 |

Sass 1.104.1 reports the existing Sass `if()` syntax at
`tool.beminator.scss:289` and `tool.list-to-string.scss:20`, once per location per
compilation, including the two compilations that later fail with BEMinator's
nesting error. **These warnings do not occur under 1.83.4.** No other warning
category was observed. Warnings were captured with their messages/categories
and emitted to the experiment log; they were not silenced to obtain equality.
They have no effect on the CSS or error outcomes in this experiment.

## Reproduction and integrity

Run from v3, with both existing installations available:

```sh
node scripts/compare-v2-compilers.js
```

The script creates a fresh ignored `tmp/compiler-baseline-v2-*` directory. It
never invokes either recording script or writes to characterization artifacts.
It exits nonzero if behavioral outputs differ or either version disagrees with
the captured baseline. Version/source checks and unexpected infrastructure
errors also fail; warning differences alone do not fail the comparison.

This run's outputs are in `tmp/compiler-baseline-v2-XUfbOV/`:

- `summary.json`: every compared ID, baseline agreement, warnings, isolation
  results, and compiler provenance.
- `1.104.1/` and `1.83.4/`: per-input source hashes, full CSS or errors, and
  warning records, stored as JSON.
- `protected-hashes.json`: integrity hashes for the protected files.

The console/warning log is `tmp/compiler-baseline-run.log`. These temporary
outputs are intentionally ignored; this document and the comparison script
provide the durable report and reproduction method.

Before/after hashes verified that every characterization artifact, the existing
characterization document, both source trees, both package manifests/lockfiles,
and installed Sass package manifests remained unchanged. The historical source
fingerprint matched the recorded reference; the legacy Git working tree remained
clean. V3 `src/` remains unimplemented. No dependency was installed or changed.

The conclusion is limited to these 79 inputs and this reference source. It does
not establish compiler equivalence for untested Sass behavior or choose v3's
future semantics.

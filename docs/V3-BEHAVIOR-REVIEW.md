# V3 behavior review

Maintainer decision record. The intentional, observable contract is in
[SPEC-v3.md](SPEC-v3.md). Historical-output and status columns remain evidence
about v2; the decision column records v3 policy and takes precedence.
`PRESERVE` is limited to the stated semantics, not incidental legacy output.
`REJECT` rejects the nesting (including N03, whose rejection v2 already enforces).

Evidence: [v2 characterization](CHARACTERIZATION-v2.md) and
[compiler comparison](COMPILER-BASELINE-v2.md). Sass 1.104.1 and 1.83.4 agree on
all 79 inputs covering 58 tests, including errors and leaks. Warning differences
do not change those findings. No compiler preference is implied.

Source lines below refer to
[`objects.standard-object.scss`](../../sass-beminator/src/scss/objects/standard-object/objects.standard-object.scss)
at revision `18cf5ec052ae6acfafdca5ca6841dd37161a2032`.
Links identify fixtures relative to `characterization/v2/`; their paired CSS/error
artifacts contain complete outputs. Selector excerpts below omit declarations
only for readability. `→` means nesting; `;` separates emitted rules, not selectors
in a selector list. “Double” means two modifier arguments.

## Semantic families and review counts

| Family | Review rules |
| --- | --- |
| Block | B01–B05; exploratory repeated nesting Q06 |
| Element | E01–E02; historical nesting N01 |
| Modifier | M01–M03; historical nesting N02 |
| Selector | S01–S02 |
| Extend | X01–X03; historical nesting N03; exploratory Q01–Q05, Q07 |
| Context isolation | C01–C03 |

There are **six families and 28 decision rows**, not 58 repeated test entries:
**11 low-risk candidates**, four further block rules, three historical nesting
rules (**two contradictory**, one corroborated), three isolation rules (**two
implementation-leak cases**), and **seven exploratory rules**. Overlapping family
references are not counted twice. These are historical review categories.
Recorded outcomes: **17 PRESERVE, 6 REJECT, 2 CHANGE, 3 DEFER**. Q07 remains
unaddressed as a complete combination; its DEFER records lack of approval, not
a newly imposed prohibition on its individually approved relationships.

## Stable core semantics — PRESERVE

The maintainer approved these 11 semantic rules. Their selectors are preserved
under the lexical isolation invariant in the specification. C02/C03 remain bugs
to correct; preserving a rule never approves a previous sibling changing it.

### Block

| Rule / nesting | V2 observed output | Source / apparent intent | Evidence IDs | Decision |
| --- | --- | --- | --- | --- |
| B01 — standalone block | `.standard-object` | 5–6; active, intentional basic block | [core/block/basic](../characterization/v2/core/block/basic.scss) | V3 decision: PRESERVE |

### Element

| Rule / nesting | V2 observed output | Source / apparent intent | Evidence IDs | Decision |
| --- | --- | --- | --- | --- |
| E01 — block → element | `.standard-object__element` without a required block ancestor | 40–41; active, intentional element | [core/element/basic](../characterization/v2/core/element/basic.scss) | V3 decision: PRESERVE |
| E02 — block/element → modifier(single/double) → element | Descendant targeting: `.standard-object--modifier .standard-object__nested-element` or `.standard-object__element--modifier .standard-object__nested-element`. Double-modifier contexts use the conjunction in M03 before that descendant. The target keeps the block's element name, not an `__element__nested-element` chain. | 14–19, 27–32, 49–54, 62–67; active labels explicitly describe changing a nested element | core/modifier/[block-single-element](../characterization/v2/core/modifier/block-single-element.scss), [block-double-element](../characterization/v2/core/modifier/block-double-element.scss), [element-single-element](../characterization/v2/core/modifier/element-single-element.scss), [element-double-element](../characterization/v2/core/modifier/element-double-element.scss) | V3 decision: PRESERVE |

### Modifier

| Rule / nesting | V2 observed output | Source / apparent intent | Evidence IDs | Decision |
| --- | --- | --- | --- | --- |
| M01 — block → modifier(single) | `.standard-object--modifier` | 14–15; active, explicitly labelled single block modifier | [core/modifier/block-single](../characterization/v2/core/modifier/block-single.scss) | V3 decision: PRESERVE |
| M02 — block → element → modifier(single) | `.standard-object__element--modifier` | 49–50; active, explicitly labelled single element modifier | [core/modifier/element-single](../characterization/v2/core/modifier/element-single.scss) | V3 decision: PRESERVE |
| M03 — block/element → modifier(double) | `.standard-object--modifier-1.standard-object--modifier-2`; element counterpart `.standard-object__element--modifier-1.standard-object__element--modifier-2`. Both classes must match the same element; neither a descendant relation nor a chained suffix. | 27–28, 62–63; active, explicitly labelled double modifiers | core/modifier/[block-double](../characterization/v2/core/modifier/block-double.scss), [element-double](../characterization/v2/core/modifier/element-double.scss) | V3 decision: PRESERVE |

### Selector

| Rule / nesting | V2 observed output | Source / apparent intent | Evidence IDs | Decision |
| --- | --- | --- | --- | --- |
| S01 — element → selector(':before') | `.standard-object__element:before` | 75–77; active custom-selector example | [core/selector/before](../characterization/v2/core/selector/before.scss) | V3 decision: PRESERVE |
| S02 — element → selector('+') → element | `.standard-object__element + .standard-object__element-2` | 85–89; active custom selector with nested element | [core/selector/adjacent-element](../characterization/v2/core/selector/adjacent-element.scss) | V3 decision: PRESERVE |

S01/S02 establish only the tested pseudo-selector and adjacent-sibling forms,
not arbitrary selector strings or a general selector language.

### Extend

| Rule / nesting | V2 observed output | Source / apparent intent | Evidence IDs | Decision |
| --- | --- | --- | --- | --- |
| X01 — block → extend(single) | `.standard-object .icon--mod1` | 148–150; active “extended pattern with single modifier” | [core/extend/single](../characterization/v2/core/extend/single.scss) | V3 decision: PRESERVE |
| X02 — block → extend(double) | `.standard-object .icon--mod1.icon--mod2` | 158–160; active double-modifier extend | [core/extend/double](../characterization/v2/core/extend/double.scss) | V3 decision: PRESERVE |
| X03 — block → extend(single/double) → element | `.standard-object .icon--mod1 .icon__nested-element`; double form `.standard-object .icon--mod1.icon--mod2 .icon__nested-element` | 152–156, 162–166; active, explicitly labelled element under extend | core/extend/[single-element](../characterization/v2/core/extend/single-element.scss), [double-element](../characterization/v2/core/extend/double-element.scss) | V3 decision: PRESERVE |

These are observations of BEMinator's `extend` mixin. They do not establish a
contract equivalent to native Sass `@extend`, inheritance, or selector unification.

## Block composition semantics — PRESERVE

Block nesting represents descendant component composition, at additional depths
as well as two levels. Equal names are permitted (Q06). B04 preserves the lexical
composition, not the history-dependent extra ancestor. B03 preserves independent
repeated block declarations, not its incidental legacy layer wrappers.

| Rule / nesting | V2 observed output | Source / apparent intent | Status / evidence IDs | Decision |
| --- | --- | --- | --- | --- |
| B02 — block → block | `.standard-object .icon`: inner block is selected as a descendant of the outer block | 98–100; active “BLOCK INSIDE BLOCK”, apparently intentional | **Clean local output; suspicious subsequent interaction C02/C03.** [core/combinations/block-block](../characterization/v2/core/combinations/block-block.scss) | V3 decision: PRESERVE |
| B03 — repeated top-level block name, later block → element | First call emits its earlier rules; the second `standard-object` call emits `.standard-object__ciao` in a second `@layer atoms` wrapper. No `icon` ancestor survives into that element. | 5–206, 208–212; active repetition; isolation intent inferred from placement | **Clean for this sequence.** [core/element/subsequent-block](../characterization/v2/core/element/subsequent-block.scss), [regression/historical-active-sequence](../characterization/v2/regression/historical-active-sequence.scss). Repeating identical declarations or deduplicating rules was not tested. | V3 decision: PRESERVE |
| B04 — block → element → modifier → block | Isolated: `.standard-object__gigi--fatherdMod .icon`; in full history: `.standard-object .standard-object__gigi--fatherdMod .icon` | 104–111; active section labelled a bug fixed in 2.0; intended nesting appears deliberate, exact desired scope unspecified | **Suspicious: context-sensitive output.** [core/combinations/element-modifier-block](../characterization/v2/core/combinations/element-modifier-block.scss), [regression/complete](../characterization/v2/regression/complete.scss); see C03 | V3 decision: PRESERVE |
| B05 — nested block → modifier or element → modifier | Isolated controls emit `.standard-object .icon--mod` and `.standard-object .icon__nested-element--nestedMod`; the inner naming base is `icon` | 110–124; active regression branches, apparently intentional | **Clean isolated controls; full sequence scope is suspicious.** core/combinations/[nested-block-modifier](../characterization/v2/core/combinations/nested-block-modifier.scss), [nested-block-element-modifier](../characterization/v2/core/combinations/nested-block-element-modifier.scss). Controls omit the historical gigi/modifier ancestors; see C03. | V3 decision: PRESERVE |

## Historical contradictions and nesting prohibitions

All three nesting forms below are REJECTED. **There are two historical
contradictions, not three:** N03 confirms the intended rejection. N01 rejects
direct element nesting. N02 rejects direct nested modifier calls, not two
arguments to one invocation or a later modifier targeting an intervening element
or block in the approved regression. Each v2 case was checked alone and after history.

| Rule / nesting | Historical comment / apparent intent | Actual v2 output | Status / source / evidence IDs | Decision |
| --- | --- | --- | --- | --- |
| N01 — block → element → element | **ERROR**; intentional support is not indicated | Compiles; emits two `.standard-object__test-element` rules with the same identifying declaration | **Contradictory.** 183–192. invalid/[block-element-element](../characterization/v2/invalid/block-element-element.scss), [block-element-element-after-history](../characterization/v2/invalid/block-element-element-after-history.scss) | V3 decision: REJECT |
| N02 — block → modifier → modifier | **ERROR**; intentional support is not indicated | Compiles; `.standard-object--test-element` followed by `.standard-object--test-element--test-element` | **Contradictory.** 196–205. invalid/[block-modifier-modifier](../characterization/v2/invalid/block-modifier-modifier.scss), [block-modifier-modifier-after-history](../characterization/v2/invalid/block-modifier-modifier-after-history.scss) | V3 decision: REJECT |
| N03 — block → extend → block | **ERROR**; rejection appears intentional | Throws `INVALID NESTING`; no CSS returned by the compile API | **Clean agreement with comment; rejection now approved for v3.** 170–179. invalid/[block-extend-block](../characterization/v2/invalid/block-extend-block.scss), [block-extend-block-after-history](../characterization/v2/invalid/block-extend-block-after-history.scss); [exact error](../characterization/v2/invalid/block-extend-block.error.json) | V3 decision: REJECT |

N01/N02 change permissive v2 behavior into compile-time rejection. N03 retains
the v2 rejection. The maintainer additionally rejects blocks beneath any extend
for the initial core (Q03–Q05), despite successful exploratory v2 compilation.

## Context isolation — implementation evidence versus API semantics

**IMPLEMENTATION LEAK — CHANGE: LEXICAL ISOLATION REQUIRED**

For C02/C03, the same later SCSS under the same public ancestors changes output
solely because a preceding sibling block was invoked. That is strong evidence
of an implementation-state problem; the maintainer has classified both as bugs
that must not be preserved. The historical “fixed in 2.0” comment does not identify the exact old
bug, so these observations cannot conclusively identify it.

| Rule / sequence | V2 observed output | Source / apparent intent | Status / evidence IDs | Decision |
| --- | --- | --- | --- | --- |
| C01 — prior scenario A; independent B, and restoration to sibling elements after nested icon | All 18 top-level comparisons are equivalent. The same-parent pippo/test-ele comparison also matches: `.standard-object__gigi--fatherdMod .standard-object__pippo`, its `--mod` rule, then `.standard-object__gigi--fatherdMod .standard-object__test-ele`. | Derived top-level probes; 126–135 and 208–212 are active historical restoration evidence. Isolation intent is inferred. | **Clean within tested scope, not a universal guarantee.** `state-isolation/after-{regression,history,selector,extend,stress,triple-block}--{plain-block,element-modifier,extend-element}`; [pippo-after-nested-icon](../characterization/v2/state-isolation/pippo-after-nested-icon/sequence.scss), [regression/sibling-elements](../characterization/v2/regression/sibling-elements.scss). IDs enumerate the 18 combinations in the [manifest](../characterization/v2/state-isolation/cases.json). | V3 decision: PRESERVE |
| C02 — sibling block('icon'); then element under unchanged outer block | Without preceding sibling: `.standard-object__after`. After sibling: `.standard-object .standard-object__after`. | Derived minimal control from 98–110; no historical comment endorses this change | **Suspicious implementation leak.** [state-isolation/sibling-element-after-block](../characterization/v2/state-isolation/sibling-element-after-block/sequence.scss) | V3 decision: CHANGE |
| C03 — sibling block('icon'); then complete historical regression | All six regression rules gain a leading `.standard-object` ancestor; e.g. `.standard-object__gigi--fatherdMod .icon` becomes `.standard-object .standard-object__gigi--fatherdMod .icon` | 98–138; active deliberate regression sequence; intended exact selectors unspecified | **Suspicious implementation leak.** [state-isolation/regression-after-sibling-block](../characterization/v2/state-isolation/regression-after-sibling-block/sequence.scss), [regression/complete](../characterization/v2/regression/complete.scss), [regression/historical-active-sequence](../characterization/v2/regression/historical-active-sequence.scss) | V3 decision: CHANGE |

C02 changes matching: the element must now have a `.standard-object` ancestor.
It also raises specificity from `(0,1,0)` to `(0,2,0)`. C03 likewise adds a class
ancestor and its specificity to each affected rule. These are semantic changes,
not formatting. Both leaks exist under both tested compilers. V3 must generate
B's selector independently of any completed sibling A under the same public
lexical ancestors. C02 must emit `.standard-object__after` in both sequences;
C03 must match the isolated complete regression in both sequences. C01 preserves
and generalizes the isolation property, not the approval status of every v2
probe (top-level extend remains deferred). No mechanism is prescribed.

## Formerly exploratory behavior — maintainer disposition

Historical evidence remains exploratory. Q01/Q02 are explicitly DEFERRED.
Q03–Q05 are REJECTED: a block cannot occur beneath an extend in the initial core,
even with intervening calls. Q06 is PRESERVED as ordinary recursive block
composition; `.icon .icon` is not a special case. Q07 has no new maintainer
decision and remains DEFERRED as a complete selector combination.

| Rule / nesting | V2 observed output | Historical evidence / apparent intent | Fixture IDs | Decision |
| --- | --- | --- | --- | --- |
| Q01 — extend(double) outside any block | `.extend--mod1.extend--mod2` | 216–217; commented outer stress wrapper; deliberate experiment, support unknown. Standalone extend probes agree but are derived tests. | [exploratory/extend-extend](../characterization/v2/exploratory/extend-extend.scss), [state-isolation/probes/extend-element](../characterization/v2/state-isolation/probes/extend-element.scss) | V3 decision: DEFER |
| Q02 — extend → extend | `.extend--mod1.extend--mod2 .icon--mod1.icon--mod2` | 216–219; commented nested-extend experiment; support unknown | [exploratory/extend-extend](../characterization/v2/exploratory/extend-extend.scss) | V3 decision: DEFER |
| Q03 — extend → block | `.extend--mod1.extend--mod2 .icon` | 216–217, 224–225; commented branch; support unknown | [exploratory/extend-block](../characterization/v2/exploratory/extend-block.scss) | V3 decision: REJECT |
| Q04 — extend → extend → block | `.extend--mod1.extend--mod2 .icon--mod1.icon--mod2 .icon` | 216–223; commented branch; compiles unlike N03, but no explicit support statement | [exploratory/extend-extend-block](../characterization/v2/exploratory/extend-extend-block.scss) | V3 decision: REJECT |
| Q05 — extend → block → block, repeated inner name | `.extend--mod1.extend--mod2 .icon .icon` | 216–217, 224–229; commented repeated-name branch; ambiguous intent | [exploratory/extend-block-block](../characterization/v2/exploratory/extend-block-block.scss) | V3 decision: REJECT |
| Q06 — block → block → block; repeated `.icon .icon` descendants | `.standard-object .icon .icon` | Derived from 224–228 by replacing the outer extend with a plain block; not a verbatim historical case. Repeated descendant semantics remain ambiguous. | [exploratory/block-block-block](../characterization/v2/exploratory/block-block-block.scss) | V3 decision: PRESERVE |
| Q07 — block → element → modifier → block → modifier → element → modifier | `.standard-object__gigi--fatherdMod .icon--mod .icon__nested-element--nestedMod` | 114–118 within active ancestors 108–113; disabled alternative inside icon modifier, reason unknown | [exploratory/regression-commented-branch](../characterization/v2/exploratory/regression-commented-branch.scss) | V3 decision: DEFER |

The [complete-stress-tree](../characterization/v2/exploratory/complete-stress-tree.scss)
preserves the commented 216–230 sequence, `extend → [extend → block, block → block]`.
It emits five rules in order: outer extend, nested extend, its nested block,
sibling block, then that block's nested same-name block. This supports review of
Q01–Q05 as a combined sequence; that full tree is not approved v3 behavior.

## Core boundaries — maintainer decisions

The initial core consists only of `block`, `element`, `modifier`, `selector`,
and `extend`.

- `MOVE_TO_PLUGIN` if retained: themed button system, Atomic Design helpers,
  project-specific paths/conventions, and Eurobet-specific behavior. These are
  future plugin/preset concerns, excluded from initial core.
- `DEFER` to separate addon design: CSS layers, theme infrastructure, and
  CSS-variable helpers. No core coupling or legacy configuration interface is
  implied by preserving the tested selector rules.

## Remaining semantic decisions

1. Q01: whether top-level extend will become supported; Q02: whether nested
   extends will become supported.
2. Q07: whether to approve the exact output of the complete commented combination;
   its constituent approved nesting rules remain available.
3. Untested parent/child relationships and selector forms remain unapproved;
   see the VALID / INVALID / DEFERRED matrix in [SPEC-v3.md](SPEC-v3.md).
4. Final argument validation, public configuration, and diagnostic wording require
   decisions before those parts of the public API can be designed.
5. Addon/plugin interfaces and CSS-layer/theme/variable-helper semantics are
   separate future work, not prerequisites for designing the approved core subset.

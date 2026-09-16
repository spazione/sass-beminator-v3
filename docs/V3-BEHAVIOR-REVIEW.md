# V3 behavior review

Maintainer decision worksheet, not a specification. **Every decision is blank.**
Allowed future entries: `PRESERVE`, `CHANGE`, `REJECT`, `DEFER`, `MOVE_TO_PLUGIN`.
Apparent historical intent and review status are evidence assessments, not votes.

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
references are not counted twice. Exploratory rule counts are semantic groupings,
not a one-to-one count of fixtures.

## Candidate stable semantics

These 11 candidates occur in active historical code and produce straightforward
selectors without discrepancies in their listed contexts. All are **clean in the
tested scope**, not automatically approved. They do not generalize to sequences
affected by C02/C03, and they do not establish unrestricted nesting support.

### Block

| Rule / nesting | V2 observed output | Source / apparent intent | Evidence IDs | Decision |
| --- | --- | --- | --- | --- |
| B01 — standalone block | `.standard-object` | 5–6; active, intentional basic block | [core/block/basic](../characterization/v2/core/block/basic.scss) | V3 decision: [ ] |

### Element

| Rule / nesting | V2 observed output | Source / apparent intent | Evidence IDs | Decision |
| --- | --- | --- | --- | --- |
| E01 — block → element | `.standard-object__element` without a required block ancestor | 40–41; active, intentional element | [core/element/basic](../characterization/v2/core/element/basic.scss) | V3 decision: [ ] |
| E02 — block/element → modifier(single/double) → element | Descendant targeting: `.standard-object--modifier .standard-object__nested-element` or `.standard-object__element--modifier .standard-object__nested-element`. Double-modifier contexts use the conjunction in M03 before that descendant. The target keeps the block's element name, not an `__element__nested-element` chain. | 14–19, 27–32, 49–54, 62–67; active labels explicitly describe changing a nested element | core/modifier/[block-single-element](../characterization/v2/core/modifier/block-single-element.scss), [block-double-element](../characterization/v2/core/modifier/block-double-element.scss), [element-single-element](../characterization/v2/core/modifier/element-single-element.scss), [element-double-element](../characterization/v2/core/modifier/element-double-element.scss) | V3 decision: [ ] |

### Modifier

| Rule / nesting | V2 observed output | Source / apparent intent | Evidence IDs | Decision |
| --- | --- | --- | --- | --- |
| M01 — block → modifier(single) | `.standard-object--modifier` | 14–15; active, explicitly labelled single block modifier | [core/modifier/block-single](../characterization/v2/core/modifier/block-single.scss) | V3 decision: [ ] |
| M02 — block → element → modifier(single) | `.standard-object__element--modifier` | 49–50; active, explicitly labelled single element modifier | [core/modifier/element-single](../characterization/v2/core/modifier/element-single.scss) | V3 decision: [ ] |
| M03 — block/element → modifier(double) | `.standard-object--modifier-1.standard-object--modifier-2`; element counterpart `.standard-object__element--modifier-1.standard-object__element--modifier-2`. Both classes must match the same element; neither a descendant relation nor a chained suffix. | 27–28, 62–63; active, explicitly labelled double modifiers | core/modifier/[block-double](../characterization/v2/core/modifier/block-double.scss), [element-double](../characterization/v2/core/modifier/element-double.scss) | V3 decision: [ ] |

### Selector

| Rule / nesting | V2 observed output | Source / apparent intent | Evidence IDs | Decision |
| --- | --- | --- | --- | --- |
| S01 — element → selector(':before') | `.standard-object__element:before` | 75–77; active custom-selector example | [core/selector/before](../characterization/v2/core/selector/before.scss) | V3 decision: [ ] |
| S02 — element → selector('+') → element | `.standard-object__element + .standard-object__element-2` | 85–89; active custom selector with nested element | [core/selector/adjacent-element](../characterization/v2/core/selector/adjacent-element.scss) | V3 decision: [ ] |

S01/S02 establish only the tested pseudo-selector and adjacent-sibling forms,
not arbitrary selector strings or a general selector language.

### Extend

| Rule / nesting | V2 observed output | Source / apparent intent | Evidence IDs | Decision |
| --- | --- | --- | --- | --- |
| X01 — block → extend(single) | `.standard-object .icon--mod1` | 148–150; active “extended pattern with single modifier” | [core/extend/single](../characterization/v2/core/extend/single.scss) | V3 decision: [ ] |
| X02 — block → extend(double) | `.standard-object .icon--mod1.icon--mod2` | 158–160; active double-modifier extend | [core/extend/double](../characterization/v2/core/extend/double.scss) | V3 decision: [ ] |
| X03 — block → extend(single/double) → element | `.standard-object .icon--mod1 .icon__nested-element`; double form `.standard-object .icon--mod1.icon--mod2 .icon__nested-element` | 152–156, 162–166; active, explicitly labelled element under extend | core/extend/[single-element](../characterization/v2/core/extend/single-element.scss), [double-element](../characterization/v2/core/extend/double-element.scss) | V3 decision: [ ] |

These are observations of BEMinator's `extend` mixin. They do not establish a
contract equivalent to native Sass `@extend`, inheritance, or selector unification.

## Further Block semantics to review

These active cases need a nesting/scope decision beyond the narrowly scoped
candidate set. Clean individual output does not resolve its effect on later calls.

| Rule / nesting | V2 observed output | Source / apparent intent | Status / evidence IDs | Decision |
| --- | --- | --- | --- | --- |
| B02 — block → block | `.standard-object .icon`: inner block is selected as a descendant of the outer block | 98–100; active “BLOCK INSIDE BLOCK”, apparently intentional | **Clean local output; suspicious subsequent interaction C02/C03.** [core/combinations/block-block](../characterization/v2/core/combinations/block-block.scss) | V3 decision: [ ] |
| B03 — repeated top-level block name, later block → element | First call emits its earlier rules; the second `standard-object` call emits `.standard-object__ciao` in a second `@layer atoms` wrapper. No `icon` ancestor survives into that element. | 5–206, 208–212; active repetition; isolation intent inferred from placement | **Clean for this sequence.** [core/element/subsequent-block](../characterization/v2/core/element/subsequent-block.scss), [regression/historical-active-sequence](../characterization/v2/regression/historical-active-sequence.scss). Repeating identical declarations or deduplicating rules was not tested. | V3 decision: [ ] |
| B04 — block → element → modifier → block | Isolated: `.standard-object__gigi--fatherdMod .icon`; in full history: `.standard-object .standard-object__gigi--fatherdMod .icon` | 104–111; active section labelled a bug fixed in 2.0; intended nesting appears deliberate, exact desired scope unspecified | **Suspicious: context-sensitive output.** [core/combinations/element-modifier-block](../characterization/v2/core/combinations/element-modifier-block.scss), [regression/complete](../characterization/v2/regression/complete.scss); see C03 | V3 decision: [ ] |
| B05 — nested block → modifier or element → modifier | Isolated controls emit `.standard-object .icon--mod` and `.standard-object .icon__nested-element--nestedMod`; the inner naming base is `icon` | 110–124; active regression branches, apparently intentional | **Clean isolated controls; full sequence scope is suspicious.** core/combinations/[nested-block-modifier](../characterization/v2/core/combinations/nested-block-modifier.scss), [nested-block-element-modifier](../characterization/v2/core/combinations/nested-block-element-modifier.scss). Controls omit the historical gigi/modifier ancestors; see C03. | V3 decision: [ ] |

## Historical contradictions and nesting prohibitions

Review these together to establish the intended Element, Modifier, and Extend
nesting rules. **There are two contradictions, not three:** N03 is the confirming
comparison. Each result was checked both alone and after the historical prefix.

| Rule / nesting | Historical comment / apparent intent | Actual v2 output | Status / source / evidence IDs | Decision |
| --- | --- | --- | --- | --- |
| N01 — block → element → element | **ERROR**; intentional support is not indicated | Compiles; emits two `.standard-object__test-element` rules with the same identifying declaration | **Contradictory.** 183–192. invalid/[block-element-element](../characterization/v2/invalid/block-element-element.scss), [block-element-element-after-history](../characterization/v2/invalid/block-element-element-after-history.scss) | V3 decision: [ ] |
| N02 — block → modifier → modifier | **ERROR**; intentional support is not indicated | Compiles; `.standard-object--test-element` followed by `.standard-object--test-element--test-element` | **Contradictory.** 196–205. invalid/[block-modifier-modifier](../characterization/v2/invalid/block-modifier-modifier.scss), [block-modifier-modifier-after-history](../characterization/v2/invalid/block-modifier-modifier-after-history.scss) | V3 decision: [ ] |
| N03 — block → extend → block | **ERROR**; rejection appears intentional | Throws `INVALID NESTING`; no CSS returned by the compile API | **Clean agreement with comment, not an approved v3 prohibition.** 170–179. invalid/[block-extend-block](../characterization/v2/invalid/block-extend-block.scss), [block-extend-block-after-history](../characterization/v2/invalid/block-extend-block-after-history.scss); [exact error](../characterization/v2/invalid/block-extend-block.error.json) | V3 decision: [ ] |

Successful compilation alone does not resolve N01/N02. Nor does N03 establish
that every block beneath any extend must be rejected: Q03/Q04 compile.

## Context isolation — implementation evidence versus API semantics

**IMPLEMENTATION LEAK — V3 SEMANTICS MUST BE DECIDED**

For C02/C03, the same later SCSS under the same public ancestors changes output
solely because a preceding sibling block was invoked. That is strong evidence
of an implementation-state problem, not evidence of an intentional selector
contract. The historical “fixed in 2.0” comment does not identify the exact old
bug, so these observations cannot conclusively identify it.

| Rule / sequence | V2 observed output | Source / apparent intent | Status / evidence IDs | Decision |
| --- | --- | --- | --- | --- |
| C01 — prior scenario A; independent B, and restoration to sibling elements after nested icon | All 18 top-level comparisons are equivalent. The same-parent pippo/test-ele comparison also matches: `.standard-object__gigi--fatherdMod .standard-object__pippo`, its `--mod` rule, then `.standard-object__gigi--fatherdMod .standard-object__test-ele`. | Derived top-level probes; 126–135 and 208–212 are active historical restoration evidence. Isolation intent is inferred. | **Clean within tested scope, not a universal guarantee.** `state-isolation/after-{regression,history,selector,extend,stress,triple-block}--{plain-block,element-modifier,extend-element}`; [pippo-after-nested-icon](../characterization/v2/state-isolation/pippo-after-nested-icon/sequence.scss), [regression/sibling-elements](../characterization/v2/regression/sibling-elements.scss). IDs enumerate the 18 combinations in the [manifest](../characterization/v2/state-isolation/cases.json). | V3 decision: [ ] |
| C02 — sibling block('icon'); then element under unchanged outer block | Without preceding sibling: `.standard-object__after`. After sibling: `.standard-object .standard-object__after`. | Derived minimal control from 98–110; no historical comment endorses this change | **Suspicious implementation leak.** [state-isolation/sibling-element-after-block](../characterization/v2/state-isolation/sibling-element-after-block/sequence.scss) | V3 decision: [ ] |
| C03 — sibling block('icon'); then complete historical regression | All six regression rules gain a leading `.standard-object` ancestor; e.g. `.standard-object__gigi--fatherdMod .icon` becomes `.standard-object .standard-object__gigi--fatherdMod .icon` | 98–138; active deliberate regression sequence; intended exact selectors unspecified | **Suspicious implementation leak.** [state-isolation/regression-after-sibling-block](../characterization/v2/state-isolation/regression-after-sibling-block/sequence.scss), [regression/complete](../characterization/v2/regression/complete.scss), [regression/historical-active-sequence](../characterization/v2/regression/historical-active-sequence.scss) | V3 decision: [ ] |

C02 changes matching: the element must now have a `.standard-object` ancestor.
It also raises specificity from `(0,1,0)` to `(0,2,0)`. C03 likewise adds a class
ancestor and its specificity to each affected rule. These are semantic changes,
not formatting. Both leaks exist under both tested compilers. The evidence
does not prescribe a mutable-state mechanism or decide the v3 isolation contract.

## Exploratory behavior — explicit approval required

**Every Q row requires explicit maintainer approval before becoming v3 behavior.**
All have **exploratory** status, even where the CSS looks straightforward.
Commented code remains historical evidence; successful compilation is not proof
of supported API. Source intent is uncertain unless otherwise noted.

| Rule / nesting | V2 observed output | Historical evidence / apparent intent | Fixture IDs | Decision |
| --- | --- | --- | --- | --- |
| Q01 — extend(double) outside any block | `.extend--mod1.extend--mod2` | 216–217; commented outer stress wrapper; deliberate experiment, support unknown. Standalone extend probes agree but are derived tests. | [exploratory/extend-extend](../characterization/v2/exploratory/extend-extend.scss), [state-isolation/probes/extend-element](../characterization/v2/state-isolation/probes/extend-element.scss) | V3 decision: [ ] |
| Q02 — extend → extend | `.extend--mod1.extend--mod2 .icon--mod1.icon--mod2` | 216–219; commented nested-extend experiment; support unknown | [exploratory/extend-extend](../characterization/v2/exploratory/extend-extend.scss) | V3 decision: [ ] |
| Q03 — extend → block | `.extend--mod1.extend--mod2 .icon` | 216–217, 224–225; commented branch; support unknown | [exploratory/extend-block](../characterization/v2/exploratory/extend-block.scss) | V3 decision: [ ] |
| Q04 — extend → extend → block | `.extend--mod1.extend--mod2 .icon--mod1.icon--mod2 .icon` | 216–223; commented branch; compiles unlike N03, but no explicit support statement | [exploratory/extend-extend-block](../characterization/v2/exploratory/extend-extend-block.scss) | V3 decision: [ ] |
| Q05 — extend → block → block, repeated inner name | `.extend--mod1.extend--mod2 .icon .icon` | 216–217, 224–229; commented repeated-name branch; ambiguous intent | [exploratory/extend-block-block](../characterization/v2/exploratory/extend-block-block.scss) | V3 decision: [ ] |
| Q06 — block → block → block; repeated `.icon .icon` descendants | `.standard-object .icon .icon` | Derived from 224–228 by replacing the outer extend with a plain block; not a verbatim historical case. Repeated descendant semantics remain ambiguous. | [exploratory/block-block-block](../characterization/v2/exploratory/block-block-block.scss) | V3 decision: [ ] |
| Q07 — block → element → modifier → block → modifier → element → modifier | `.standard-object__gigi--fatherdMod .icon--mod .icon__nested-element--nestedMod` | 114–118 within active ancestors 108–113; disabled alternative inside icon modifier, reason unknown | [exploratory/regression-commented-branch](../characterization/v2/exploratory/regression-commented-branch.scss) | V3 decision: [ ] |

The [complete-stress-tree](../characterization/v2/exploratory/complete-stress-tree.scss)
preserves the commented 216–230 sequence, `extend → [extend → block, block → block]`.
It emits five rules in order: outer extend, nested extend, its nested block,
sibling block, then that block's nested same-name block. This supports review of
Q01–Q05 as a combined sequence; it grants no additional support status.

## High-level decisions requiring maintainer review

1. Should direct element → element nesting be forbidden, or what naming and scope should it express?
2. Should modifier → modifier nesting be forbidden, or how should it differ from two modifier arguments in one call?
3. What relationship should block → block represent, including blocks under modified elements and subsequent declarations of the same block?
4. What is the semantic contract of BEMinator `extend`, including modifier conjunctions, element targeting, and whether it is valid outside a block?
5. Should extend → extend be supported, and under which ancestor contexts may blocks nested beneath extend be valid?
6. Should repeated same-name block nesting require distinct descendants such as `.icon .icon`?
7. Should context always be lexically isolated so preceding sibling calls cannot change subsequent selectors, and what scope should be restored after nested calls?
8. Which specified capabilities belong to core versus addons/plugins? Themes, buttons, project paths, and Atomic Design helpers were excluded from this evidence; their placement needs separate scope review, not inferred support from these tests.

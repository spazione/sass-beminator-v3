# Button compatibility spike — historical evidence

The implementation has been promoted to [components/_button.scss](../../components/_button.scss).
See the [maintained contract](../../components/README.md) and tests under
`tests/components/` and `tests/legacy/button.test.js`. This original experiment
is retained unchanged below as historical evidence, following the repository
convention for completed spikes; it is not the maintained implementation. Its
open adoption questions describe the pre-promotion state. Functional pseudo map
keys are now explicitly outside the supported Button contract.

## Scope and hypothesis

Implement the exact legacy seven-argument `btn()` signature using one public
`element('btn-' + $name)` wrapper. Core structure, ownership, separator and
transition validity belong exclusively to that wrapper. This experiment does not
approve a production addon API or alter the core feature-completeness verdict.

## Compatibility specification (before implementation)

Use `vars → category → state → style → property` and
`vars → size → size-name → property`. Iterate in supplied order; ignore leaf
values and `prefix` metadata. Generate `var(--btn-...)` references with
`!important`, never variable definitions or fixed resets. Only `shared` generates
size declarations and caller content. Keep content once, after shared styling,
even if shared is not first; absent shared means no content or size output.
`default` omits the inner pseudo, other style/state keys add pseudos.

Preserve string `'true'`/`'false'`, left/right single-colon icon pseudos, empty
content, size dimensions, .5em margin, opposite-pseudo clearing, and key-triggered
suppression. `icon-color` with `'false'` produces nothing. Size icon declarations
stay at their map position. This can split base rules around pseudo rules under
modern Dart Sass; exact ordered output is the comparison target.

Reject a missing category or a missing size needed by shared with a small local
error rather than reproducing malformed declarations. No broad validation API.
Public selector grammar remains frozen; functional pseudo map keys are an input
contract question, not authorization to expand it.

## Implementation and evidence

`_button.scss` imports only `sass:map`, `sass:string`, and the supported
`src/_index.scss` entrypoint. `btn()` has exactly one `bem.element()` call.
Private spike helpers iterate styles and generate icons through public
`bem.selector()`; they neither construct BEM selectors nor hold persistent state.
There is no raw `&`, separator concatenation, parent parsing, trimming, private
core import, `!global`, or `@at-root`. Legacy owner reconstruction, nested flags,
wrapper accumulation, modifier/state flags and repeated structural emission all
disappear. Public element supplies legality, owner, subject, scope and restoration.

`fixtures/_maps.scss` copies the representative settings data from the read-only
legacy `src/scss/settings/settings.beminator-project.scss` (whitespace cleaned).
It is example data, not a replacement for consumer tokens. Tests extend this same
schema with icons, a secondary category, reordered states and absent shared.
`fixtures/representative.css` is captured directly from legacy, never from the
spike. It remains unchanged by tests. The representative SCSS is runnable alone.

Run from the project with supported Node 22.19+ or 24:

```sh
node --test spikes/button-addon/button.test.js
npm test
npm run test:legacy
```

The tests resolve their fixtures from `import.meta.url` and reuse the existing
generic compiler and legacy adapter. They install nothing in legacy. Legacy Sass
deprecation diagnostics remain enabled. No package scripts or production exports
were added; normal unit tests retain independence from the legacy checkout.

### CSS comparison result

Byte-for-byte equality initially failed: at some rule boundaries legacy emits
`}\n\n.card...` while the single element wrapper emits `}\n.card...`.
Only that blank line is normalized, specifically `}\n\n` before `.` or `#`.
No selector, property, value, importance, rule count, rule order or declaration
order is normalized. All tested compatible inputs then compare exactly, including
icon declarations interleaved with base properties and content. The captured CSS
retains the original formatting. Some fixtures already match byte-for-byte.

The selected category and size alone generate output. Ignored metadata, ignored
leaf values, shared styles other than default, non-shared default styles,
shared appearing after another state, and no shared are covered. There are no
implicit resets, variables, modifier classes, or layer wrappers.

### Structural inheritance result

Tests compare Button against a direct public `element('btn-play')` with identical
base declarations, then compare full icon/state output against the same scoped
prefix. Cases include block, modifier, hover-qualified, has-qualified, extend,
nested block scope, and pending `+`, `>` and `~` from an element. Markers after
Button and after its parent verify restoration. A caller modifier in content
observes the Button subject. Direct element parent and root calls produce the
same core diagnostic as direct element calls. No Button validation duplicates
these transitions. Configured layers are inherited from block.

Custom `-` element and `_` modifier separators pass all structural comparisons;
full icon and state rules use `.card-btn-play`. A separate legacy comparison
confirms the custom element separator. No separator knowledge exists in Button.

### Icons and caller content

Both string flags and both alignments compare against legacy with `icon-size`
interleaved between size properties, `icon-color` interleaved between skin
properties, default and non-default styles, and multiple state branches. Left
selects `:before`, right selects `:after`; dimensions and margin are size-only,
background is skin-only, and the opposite pseudo is cleared. `'false'` clears
both only when `icon-size` is reached. `icon-color` alone with `'false'` does
nothing. All generated declarations retain `!important`.

Content is optional, emitted once in the base Button scope at the shared map
position, and retains normal importance. No shared means **no content and no size
output**, deliberately preserving observed legacy behavior rather than moving
content unconditionally outside the iteration. This also preserves ordering when
shared is not the first state. Content is not replayed into generated pseudos.

## Compatibility matrix

MATCH means tested equality after the narrowly scoped blank-line normalization,
or structural equivalence to public element where explicitly stated. NOT TESTED
marks legacy contextual comparisons that are not claimed; v3 composition tests
for those rows still pass.

| Behavior | Legacy v2 | Spike v3 | Status | Notes |
| --- | --- | --- | --- | --- |
| signature | Seven arguments; first three required | Same names/order/defaults | MATCH | Named, positional, defaults, missing required args |
| btn- element naming | `card__btn-play` | Same | MATCH | Component prefix only |
| element separator | Configured separator | Inherited from element | MATCH | No separator in addon |
| size selection | Selected size keys | Same | MATCH | medium and small |
| category selection | Selected category keys | Same | MATCH | primary and secondary |
| shared/base declarations | Size then theme | Same | MATCH | Map iteration order retained |
| pseudo-state generation | State/style suffixes | Public selector calls | MATCH | Observed non-functional pseudos |
| CSS variable references | Hardcoded `--btn-`, values ignored | Same | MATCH | Metadata ignored; no definitions |
| !important policy | Generated only | Same | MATCH | Content stays normal |
| icon true | Selected pseudo and opposite clear | Same | MATCH | String value |
| icon false | Key-triggered suppression | Same | MATCH | No unconditional clear |
| icon left | before, margin-right | Same | MATCH | Size and color branches |
| icon right | after, margin-left | Same | MATCH | Size and color branches |
| @content | Only at shared | Same | MATCH | Optional, once, absent-shared tested |
| block parent | Naming owner | Public element | MATCH | Live legacy comparison |
| modifier parent | Scoped Button | Public element | MATCH | Live legacy comparison |
| qualified parent | Scoped Button | Public element | MATCH | Live hover comparison |
| has-qualified parent | No equivalent v3 has contract assumed | Matches public element | NOT TESTED | Legacy comparison unavailable; v3 tested |
| extend parent | Target owner and modified scope | Public element | MATCH | Live legacy comparison |
| pending relation parent | Legacy comparison not asserted | Matches public element | NOT TESTED | All three v3 relations tested |
| invalid element parent | Legacy behavior not characterized here | Core rejects element → element | INTENTIONAL V3 DIFFERENCE | Exact direct-element error; no local check |
| root call | Legacy behavior not characterized here | Core rejects root → element | INTENTIONAL V3 DIFFERENCE | No invented standalone owner |
| custom separator | `card-btn-play` | Same automatically | MATCH | Legacy and direct-element comparisons |
| functional pseudo map key | `nth-child(2)` emits CSS | Public selector rejects | BLOCKED | Input-contract question, not a core defect |

## Answers and remaining adoption decisions

1. **One structural element wrapper?** Yes, source-checked and behavior-tested.
2. **Valid legacy CSS matches?** Yes for tested Eurobet-style inputs, with only
   rule-boundary blank-line normalization; unrestricted pseudo keys are bounded below.
3. **What disappears?** Owner parsing, trimming, globals/flags, wrapper building,
   separator construction and Button-specific at-root reconstruction.
4. **Observed pseudo states expressible?** Yes, entirely through public selector;
   no terminal Sass fallback is needed for the observed cases.
5. **Private v3 API required?** No.
6. **Custom separators automatic?** Yes.
7. **Modifier/qualified/extend/pending inheritance?** All pass direct-element
   equivalence; has qualification, nested scopes and restoration also pass.
8. **Direct element → btn fails naturally?** Yes, with the core element error.
9. **String flags preserved?** Yes, no boolean modernization.
10. **Icons match?** Yes, all four flag/alignment combinations and key-trigger quirks.
11. **Normal content matches?** Yes, including ordinary declaration importance.
12. **Valid-input differences?** No semantic difference in the tested observed
    schema. The broader legacy schema can encode functional pseudo keys:
    `nth-child(2)` is valid CSS and compiles in legacy but is rejected here. This
    is a demonstrated boundary, not evidence that real Eurobet maps use it.
    Decide the addon input contract before adoption; terminal Sass could be
    investigated for that local styling without changing core. Full arbitrary
    pseudo strings, selector lists, and escaped spellings are not certified.
13. **Malformed-input behavior intentionally not preserved?** Missing category
    and missing size required by shared have explicit local errors. Legacy weak
    lookup errors/malformed declarations are not compatibility requirements.
    No comprehensive map/type validation or revised flag policy is introduced.
14. **Frozen core modification needed?** No evidence of a need. All required
    structure and observed styling fit the existing API. The experimental pseudo
    boundary is an addon contract decision, not a reason to expand the core.

Before adoption, review the bounded map-key contract, absent-shared/content rule,
minimal validation policy, and compatibility evidence. Packaging, exports,
variable provisioning and Eurobet integration remain outside this spike.

**One recommended next action:** review and explicitly approve the spike's bounded
Button compatibility contract, including the functional-pseudo input question,
before any production promotion.

## Integrity and verification

The spike suite has 35 passing tests. `npm test` and `npm run test:legacy` pass
under Node 22.19.0 / Dart Sass 1.104.1. No warnings are suppressed.
Core and entrypoint SHA-256 hashes match the pre-task baseline. Production tests
also assert the unchanged seven mixins, three settings, zero public functions,
one evolving mutable context stack and one emission boundary. Legacy tracked
diff and working-tree status match the pre-task baseline. All added files are
inside this spike; the pre-existing untracked `docs/BUTTON-V2-ANALYSIS.md` was
left untouched. Package exports, production docs and the core completeness
verdict are unchanged. Whitespace checks pass. Nothing is promoted or published.

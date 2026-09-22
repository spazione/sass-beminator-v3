# Optional CSS Layers: approved design and historical spike

## Approved production decision

The optional production subset is now implemented. The report below remains the
historical spike evidence; its naturally nested inner-layer output is **not**
production behavior.

- `block($name, $layer: null)` preserves the quoted legacy argument. Null adds no
  wrapper; configured names wrap the complete subtree. There is no enable switch.
- Explicit non-null selection is allowed only on the root BEM block. Nested blocks
  with omitted/null selection inherit; any explicit nested selection is rejected,
  including beneath unlayered roots. Existing root context provenance suffices;
  no layer context metadata was added. Extend ancestry rejection takes precedence.
- The eagerly validated registry is nonempty and flat; top-level evaluated names
  follow the conservative domain proven below. Values have no semantics. Lookup
  is strict, case-sensitive, and equivalent quoted/unquoted strings match.
- `css-layers()` explicitly emits order at the call site, with literal repeats.
  Consumers can write the ordering manually. It must precede layered CSS in final
  output; framework splitting/extraction/concatenation/runtime injection is outside
  BEMinator's control. No bundler-order guarantee or framework API is provided.
- The demonstrated media/supports/container propagation is approved. Raw selector
  re-entry and broader at-rule behavior remain outside this approval.

The implementation retains one evolving mutable stack and one BEM emission boundary.
See [production usage](PRODUCTION-v3.md#optional-css-layers). No theme/path machinery
or nested registry interpretation is restored.

## Historical design spike (before approval)

**Recommendation:** retain legacy-compatible `block($name, $layer: null)`, a
configurable ordered `$css-layers` map, strict configured-name lookup, and an
explicit `css-layers()` order mixin. No enable boolean, theme integration,
current-layer global, or emitted-order history is needed. A layer can wrap the
block emission subtree without entering the BEM context.

This is a disposable experiment, **not production approval or implementation**.
Production signatures, exports, contexts, selectors, separators, and tests are
unchanged. The important unresolved choice is what an explicitly layered inner
block means: ordinary Sass produces nested layers, not a top-level override.

Evidence: [57 executable probes](../spikes/css-layers/probes.test.js), the
[proof module](../spikes/css-layers/_proof.scss), and literal expanded CSS/source
artifacts under ignored `tmp/css-layers/`. The proof delegates all selector work
to the unchanged production core rather than copying it. Tests use Dart Sass
1.104.1 / Node 22.19.0. Browser cascade execution was not tested; CSS layer meaning
is distinguished below from compiler output.

## 1. Legacy source compatibility and activation

The exact quoted source works, including an unnamespaced `@use ... as *` probe:

```scss
@include block('card', $layer: 'molecules') {
  color: red;
}
```

Expanded output:

```css
@layer molecules {
  .card {
    color: red;
  }
}
```

Unquoted `$layer: molecules` produces identical CSS. The candidate adds only the
optional second parameter. It does not restore legacy positional theme arguments,
`$theme`, varargs, or the old empty-string sentinel. Omission and explicit `null`
emit ordinary rules when there is no surrounding layer. Importing the proof by
itself emits no CSS. A valid custom registry without layer selection also emits
no layer wrapper or order statement.

**Important qualification:** null means “add no wrapper”, not “escape an existing
layer”. A null/omitted child inherits its lexical layer, including a consumer's
raw `@layer`. An empty explicitly layered block currently emits `@layer molecules
{}`; this can establish order despite containing no rules.

A global `$use-css-layers` switch adds a second activation concept. It could solve
a future requirement to compile the same explicitly layered source in a forced
unlayered mode, but no such requirement was provided. Recommend omission/null
for optional use and no switch. Registry replacement controls names, not activation.

Read-only legacy evidence:

- [block and agnosticBlock](../../sass-beminator/src/scss/tools/mixins/tool.beminator.scss)
  accept `$layer`, check registry membership, and wrap emission. Legacy `block`
  also accepted theme arguments; source compatibility here is deliberately limited
  to the requested named `$layer` form.
- [shared layer settings](../../sass-beminator/src/scss/settings/settings.shared-css-layers.scss)
  contain the proposed default key order, alongside retired theme-path machinery.
- [injectCssLayers](../../sass-beminator/src/scss/tools/mixins/tool.inject-css-layers.scss)
  is explicitly invoked by [clientlib.main](../../sass-beminator/src/scss/clientlibs/clientlib.main.scss).
  This supports retaining explicit ordering convenience, but its mutable accumulator
  and theme/path configuration must not be copied.

No layer name implies an Atomic Design operation or project directory. The default
names are only a replaceable registry.

## 2. Flat registry and normalization

Candidate configuration:

```scss
$css-layers: (
  generic: (), elements: (), atoms: (), molecules: (), organisms: (),
  templates: (), pages: (), utilities: (),
) !default;
```

Consumers can replace the entire map, for example with
`(reset: (), base: (), components: (), utilities: ())`. Only top-level keys matter;
iteration retains insertion order. The proof emits exactly
`@layer reset, base, components, utilities;` from this replacement. Values are
ignored, including numbers and maps. Empty values have **no reserved meaning**.
Configuration is load-time only; no registry mutation API is proposed.

The smallest normalization rule is:

1. Require a Sass string for every key and every non-null selection.
2. Validate the evaluated string against the selected simple-name domain.
3. Use `string.unquote()` for output/lookup; retain case and do not trim whitespace.

Sass already treats quoted and unquoted equivalent strings as equal map keys.
Both key/argument quote directions pass; a literal map containing both `molecules`
and `'molecules'` reports a Sass duplicate-key error before the proof runs. A local
normalized-key set provides a defensive uniqueness check, not module state.
`molecules` and `Molecules` remain distinct. Sass resolves ordinary identifier
escapes before validation: `'molec\75 les'` matches `'molecules'` in the probe.
These observations align with [Sass string semantics](https://sass-lang.com/documentation/values/strings/)
and [map key equality](https://sass-lang.com/documentation/values/maps/).

Unquoted Sass **values** are not always strings: `red` is a color. A quoted `'red'`
key/selection works in the proof; unquoted `red` fails the string check. Thus the
promise should concern equivalent Sass strings, not every visually identical
source token. Recommend quoted layer names in examples.

`$css-layers: null` is replaced by its `!default` map before validation, just like
production separator configuration. It cannot be distinguished from omission.

## 3. Unknown-name and validation policy options

| Unknown selection | Advantage | Cost | Recommendation |
| --- | --- | --- | --- |
| Compile error | Catches typos and keeps names/order governed by the registry | Registry must include every chosen name | Prefer this; exercised in the proof |
| Allow arbitrary name | Flexible one-off layers | New names escape registry ordering and typo checks | No demonstrated need |
| Warn, then emit | Migration can continue | CSS still has an unregistered layer; warnings can be missed | Consider only for a concrete migration requirement |

The strict lookup is a tested candidate, **not a silently finalized policy**.
`$layer` denotes one configured name; it never accepts arbitrary CSS text.

The proof eagerly requires a **nonempty map**, even if layers are unused. Empty
`()` is reported by Sass as an empty list/map value; the candidate rejects it.
Allowing an empty registry instead would offer an explicit no-available-layers
configuration; order emission would need to become a no-op or error. Neither
option requires state. Recommend the simpler nonempty rule unless that use case
is desired; omitted layer selection already disables wrapper emission.

Candidate name domain: ASCII letter or underscore first, then ASCII letters,
digits, underscores, or hyphens. Reject empty strings, whitespace, commas, dots,
arbitrary CSS, numbers, booleans, lists, and maps. Reject CSS-wide keywords and
`default`, case-insensitively. CSS uses custom identifiers for layer names; the
[custom-ident definition](https://www.w3.org/TR/css-values-4/#custom-idents) explains
reserved keywords and case sensitivity. This probe's domain is intentionally
narrower than full CSS identifier syntax: Unicode and leading-hyphen names are
excluded, not claimed inherently invalid CSS. No CSS parser is implemented.

Maintainers must approve the narrow domain or provide needed counterexamples.
The validation policy should describe **evaluated Sass values**, not promise to
reject every escaped source spelling. Duplicate keys and malformed Sass syntax
remain Sass-owned diagnostics; configuration/lookup failures are proof-owned.

## 4. Propagation and separation from BEM construction

One wrapper surrounds `core.block(...) { @content; }`. Declarations, elements,
modifiers, and every already-approved descendant still use the existing emission
boundary. `subtree.css` is literally:

```css
@layer molecules {
  .card {
    color: red;
  }
  .card__title {
    color: blue;
  }
  .card--active.card--large {
    color: green;
  }
}
```

Layer identity never affects owner, subject, scope, separators, modifier
conjunction, or extend ancestry. The proof adds no layer field to any context.
Repeated layered blocks emit separate wrappers with the same name; the subsequent
unlayered root remains unlayered and uses its own owner. No layer cleanup step is
required because Sass provides lexical at-rule nesting.

## 5. Nested blocks and explicit inner layer choices

An inner block with no layer argument, or explicit null, naturally remains inside
the outer layer. `templates` → page → card → title emits
`.page .card__title` in `@layer templates`, with no duplicated block ancestor.

An explicit inner selection yields this measured output:

```css
@layer templates {
  .page {
    color: blue;
  }
  @layer molecules {
    .page .card {
      color: red;
    }
  }
  .page__after {
    color: green;
  }
}
```

CSS interprets the inner layer as `templates.molecules`, not root `molecules`.
Even selecting the same name twice yields `molecules.molecules`. The flat root
ordering declaration does not order these nested layers. CSS specifies nested
layer grouping separately from outer layers. [CSS Cascade 5](https://www.w3.org/TR/css-cascade-5/#layer-ordering)

| Inner explicit selection policy | Implications |
| --- | --- |
| Natural nested CSS layers | Works with zero layer metadata; must explicitly approve relative names and their ordering implications |
| Override to a root layer | Not what current emission does; would require a deliberate escape/emission policy, preserving other at-rules and outer selectors; not implemented or proven here |
| Reject when already layered | Clear flat-only contract, but detecting a BEM layer ancestor requires immutable ancestry metadata; cannot infer all consumer raw layer wrappers from ordinary Sass introspection |
| Ignore the inner selection | Avoids nesting but silently discards caller intent; detecting the layered case still needs provenance |
| Reject every non-root explicit selection | Existing BEM parent facts could enforce this without layer metadata, but it is stricter: also excludes inner selection beneath an unlayered block |

Legacy `agnosticBlock` clears its layer argument when `$nested` is true. That
historical branch is evidence for an ignore policy, not approval to revive its
state machinery or assume identical nested classification in v3.

**Recommendation for review:** approve inheritance for null/omitted inner layers;
keep explicit inner selection pending a separate choice from this table. Natural
nesting is the smallest mechanism, but not a top-level override. If a strict
flat-only public contract is chosen, decide its enforcement before production.
Do not silently ship the proof's inner nesting as an approved override.

## 6. Extend, selectors, and separators

All tested descendants stay in the enclosing layer:

| Probe | Selector inside `@layer molecules` |
| --- | --- |
| Extend a target with two modifiers | `.card .icon--active.icon--large` |
| Extend → element → modifier | `.card .icon--active.icon--large .icon__label--active` |
| Qualified block | `.card[disabled]:hover` |
| Pending relation | `.card__item + .card__child`, `.card__item > .card__child`, `.card__item ~ .card__child` |
| RHS modifier | `.card__item > .card__child--active` (also `+`, `~`) |
| Custom `-` / `_`, extend element qualifier | `.card .icon_a.icon_b .icon-item:hover` |
| Same custom configuration, RHS modifier | `.card .icon_a.icon_b .icon-item > .icon-child_active` |

Block beneath extend still fails through intervening element/modifier contexts.
Direct pending declarations still fail with Sass's style-rule error. A subsequent
independent compilation starts clean. There is no `$layer` argument on extend or
other descendants; their existing signatures remain unchanged. No functional
selector semantics are added.

## 7. The existing emission boundary and ordinary at-rules

Default `@at-root` removes style-rule ancestry while preserving enclosing
at-rules. The spike confirms this specifically for CSS Layers and the current
core, consistent with [Sass's @at-root documentation](https://sass-lang.com/documentation/at-rules/at-root/).
No extra `@at-root` is added to the proof.

| Arrangement | Observed expanded wrapper order |
| --- | --- |
| Layered block containing media | `@layer` → `@media` → computed rule |
| Media containing layered block | `@media` → `@layer` → computed rule |
| Layered block containing supports | `@layer` → `@supports` → computed rule |
| Supports containing layered block | `@supports` → `@layer` → computed rule |
| Layered block containing container | `@layer` → `@container` → computed rule |
| Container containing layered block | `@container` → `@layer` → computed rule |
| Each conditional wrapper inside pending `>` | `@layer` → conditional wrapper → complete RHS rule |

For example, a media wrapper inside content emits:

```css
@layer molecules {
  @media (min-width: 40rem) {
    .card__title {
      color: red;
    }
  }
  .card__after {
    color: blue;
  }
}
```

The outer-media version emits `@media` first, then `@layer`. No intended wrapper
escaped, no selector scope was duplicated, and subsequent siblings retained their
parent. These exact probes do not approve every Sass at-rule combination or all
of hardening D08. Browser matching and condition-dependent layer activation were
not tested. Ordering should be unconditional and early.

D09 remains untouched: a raw `&:hover` wrapper around a BEM element still loses
that raw selector condition, even though `@layer` is retained. Layers do not fix
or authorize raw selector re-entry.

## 8. Ordering strategies and actual module behavior

Layer order follows first declaration, so emitting an order statement after layer
use cannot retroactively reorder existing layers. Conditional first appearances
can also affect order; establish the intended order up front.
[CSS Cascade 5](https://www.w3.org/TR/css-cascade-5/#layer-ordering)

| Strategy | Measured behavior | Assessment |
| --- | --- | --- |
| A: module-level automatic order | `_automatic.scss` emits once across aliases and two consuming modules; even import-only use emits order CSS | Does **not** require an emitted flag, but introduces a CSS side effect without any layer-selected block |
| A: automatic order at each layered block | Repeats the full order before every call; nested use would be relative to outer rules/layers | No hidden state but noisy; not a reliable unconditional global placement strategy |
| B: explicit `css-layers()` | Emits exactly the configured ordered keys; two calls emit two identical statements | Recommended convenience; deterministic, no history, adds one mixin |
| C: consumer writes order | Literal consumer statement precedes wrappers; proof emits nothing automatically | Smallest API; consumer must keep desired order and registry consistent |

Sass includes a canonical module's CSS once per compilation; aliases do not
re-evaluate it. A second attempt to configure the already loaded proof module
fails. This is observed in the tests and documented by [Sass @use](https://sass-lang.com/documentation/at-rules/use/).
Separate compilations each emit their own CSS; this does not deduplicate across
bundled stylesheets or different physical copies of a module.

**Recommend B, while allowing consumers to choose C.** Call `css-layers()` at
stylesheet root before any layered CSS. There is no need for a `$use-css-layers`
switch or an “already emitted” global. Repeated calls are literal repeated
statements, not a deduplication service.

Placement requires care with real Sass modules: `@use` occurs before ordinary
mixin calls. If an imported component immediately emits layered CSS, a later
root `css-layers()` call is already too late. The `explicit-order-after-emitting-use-is-late`
probe places the templates layer before the order statement. An application can
put its explicit order call in an early stylesheet module loaded **before** the
emitting components, or call the mixin before invoking CSS-producing component
mixins. The automatic-module probe demonstrates early dependency ordering without
mutable history. The library must document this, not promise to repair order.

Calling `css-layers()` inside a raw layer emits relative sublayer ordering.
Calling it inside a BEM style body leaves the statement inside that style rule:
Sass does not hoist statement-only `@layer` automatically. This is not a supported
root-order placement. Do not add another emission boundary just to hoist misuse.
Production placement diagnostics, if desired, need their own decision; the spike
records actual CSS and does not claim every lexical misuse can be detected.

## 9. Future nested registry values and secondary wrapper

`(components: (atoms: (), molecules: ()), utilities: 123)` currently registers
only `components` and `utilities`. Its order statement lists those two names;
selecting `atoms` fails. Map values are not interpreted, documented as placeholders,
or reserved for nested configuration or metadata.

The map leaves a reasonable future path, but interpreting previously ignored
values would need an explicit opt-in or compatibility decision. Future nested
lookup, qualified names, and nested ordering would require their own contract;
no automatic recursive traversal is proposed. This future path is separate from
Sass's natural nesting of explicitly layered blocks.

The secondary `layer('molecules') { block('card') ... }` proof produces the same
wrapper and shows emission orthogonality. There is no concrete problem with the
legacy `$layer` signature that would justify replacing it with a wrapper-only API.
Do not add the secondary wrapper to the recommended initial public surface.

## 10. Architecture impact and smallest candidate API

The proof imports production, adding **zero evolving module globals** and **zero
BEM emission boundaries**. The combined system retains exactly **one mutable
private context stack** and **one BEM `@at-root` boundary**. `$css-layers` is a
load-time construction input; local validation/order lists are discarded per call.
There is no current-layer flag, emitted-layer cache, theme/path state, or selector
parsing to recover layer membership. BEM facts remain owner, subject, scope, kind,
under-extend, plus relation data where applicable.

Propagation itself needs **no context metadata**. Choosing to enforce a special
inner-layer policy may justify immutable ancestry information later; that is a
policy cost, not a demonstrated propagation requirement. Raw external layer
ancestry would still need a stated integration boundary.

Smallest useful recommended API for approval:

```scss
$css-layers: (...) !default; // replaceable flat ordered map

@mixin block($name, $layer: null) { /* optional emission wrapper */ }
@mixin css-layers() { /* explicit order at root before first layer use */ }

// Unchanged:
@mixin element($name) {}
@mixin modifier($mod1, $mod2: null) {}
@mixin selector($name) {}
@mixin extend($name, $mod1, $mod2: null) {}
```

The two existing separator variables remain unchanged. Recommend strict lookup,
quoted/unquoted string equivalence, and no separate activation switch. No layer
API is implemented in `src/` by this experiment.

## 11. Historical decision checklist (resolved by production approval)

The spike originally requested these five decisions. All are now settled by the
approved production decision at the top of this report; the following list records
the original review questions, not remaining implementation work:

1. **Public surface and activation:** approve the optional block argument and
   registry; null/omitted means no additional wrapper, not forced unlayering.
   Confirm no enable switch and whether empty explicit blocks may establish layers.
2. **Registry and lookup policy:** approve strict errors, nonempty/eager validation,
   the simple evaluated-name domain, case sensitivity, and the documented Sass
   null/default behavior. Values remain semantically ignored.
3. **Inner explicit selections:** choose natural nesting, rejection scope, ignore,
   or separately designed override semantics. This is the main unresolved behavior.
4. **Order ownership and placement:** approve explicit `css-layers()` versus the
   alternatives, root-before-use responsibility, repeats, and any placement
   diagnostic expectations. Consumer-owned order remains possible.
5. **Integration envelope:** approve the tested layer/conditional-wrapper
   propagation as production requirements, and state boundaries for external
   raw layers, independent bundles, and future nested-map interpretation. Do not
   treat positive probes as blanket D08/D09 approval.

No retired debug, `:where()`, theme identifier, theme arguments, directory paths,
automatic file loading, CSS-variable injection, or Atomic Design helpers return.
Layer selection is independent of all those systems.

## Historical spike validation

The new CSS Layer suite passes **57/57 tests**, counted separately. Existing
production (**172**), combined project (**234**, including legacy/characterization),
and existing spikes (**58**: 27 selector-engine + 15 context-stack + 16 structural)
remain unchanged and green. `npm run test:production`, `npm test`,
`npm run test:legacy`, and `npm run test:characterization` pass. Existing warnings
remain unsuppressed. Logs are `tmp/css-layers-*.log`; exact CSS/source probe outputs
are under `tmp/css-layers/`.

Only this report and `spikes/css-layers/` are added. No production code, approved
specification, existing tests/spikes, compiler artifacts, dependencies, or legacy
files are changed. Work stops for maintainer review.


## Production recovery validation

The historical validation above describes the spike before production approval.
Production stabilization is now complete: 203 production tests, 265 combined
project tests, and 115 spike tests (27 selector-engine, 15 context-stack,
16 structural-selector, 57 CSS Layers) pass. The final implementation has one
evolving mutable global and one BEM emission boundary, with no layer context field.
See [the recovery verification record](CORE-HARDENING-v3.md#css-layers-stabilization-completed-recovery-verification)
for suite counts, remaining hardening decisions, and ordering responsibilities.

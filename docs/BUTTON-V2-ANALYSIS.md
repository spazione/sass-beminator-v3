# V2 btn: focused read-only analysis

**Finding:** a Button addon can delegate BEM structure entirely to public v3
`element()`, with public `selector()` or ordinary terminal Sass for its generated
states. No private v3 context appears necessary. It remains a complete UI-pattern
generator, not merely an element alias. Preserve the distinction between its
structural wrapper and its map-driven declarations.

Only this requested report was written. No source, settings, tests or other
repository files were changed; no spike or benchmark was created.

## Source and exact signature

All legacy paths below are relative to `../sass-beminator`:

| Location | Relevant code |
| --- | --- |
| [`src/scss/tools/mixins/tool.beminator.scss`](../../sass-beminator/src/scss/tools/mixins/tool.beminator.scss) | `btn` lines 766–826; `getButtonProperties` 631–758; `trim-parent-class` 495–507; `selector` 903–915 |
| Same file, lines 515–559 | Corresponding legacy element construction, inspected only to identify duplication |
| [`src/scss/settings/settings.beminator-project.scss`](../../sass-beminator/src/scss/settings/settings.beminator-project.scss) | Sample `$btnSkins` lines 1–38 and `$btnSizes` 40–71 |
| `src/scss/tools/functions/tool.{str-split,list-to-string,value-replace}.scss` | String/list operations used by parent trimming |
| `src/scss/tools/mixins/tool.inject-css3-vars.scss` | Eagerly imported variable generator; **not called by btn** |

```scss
@mixin btn($name, $theme-settings, $shared-settings, $size: 'medium', $category: 'primary', $icon: 'true', $icon-align: 'left')
```

The first three arguments are required. There are no additional parameters.
`getButtonProperties`, `trim-parent-class` and `selector` are public legacy
mixins (no private name prefix), even though the first two serve as helpers here.

| Argument in consumer call | Actual meaning |
| --- | --- |
| `'play'` / `$name` | Suffix of element name **`btn-play`**, not `play` |
| `eurobetSettings.$btnSkins` / `$theme-settings` | Category → state → style → property map determining skin declarations and pseudo rules |
| `$btnSizes` / `$shared-settings` | Size → property map used only while processing the `shared` skin state |
| `$size: 'medium'` | Selects one size and the `--btn-size-medium-*` reference namespace; does not generate all sizes |
| `$category: 'primary'` | Selects one category and its `--btn-primary-*` namespace; generates its supplied states/styles, not all categories |
| `$icon: 'false'` | Compared explicitly against strings `'true'` / `'false'`; native Sass booleans are different values and do not satisfy those branches |
| `$icon-align: 'left'` | Chooses `:before` with right margin; `'right'` chooses `:after` with left margin when icon generation is enabled |

The string representation is operationally significant in v2, regardless of its
historical motivation. This audit does not approve a future boolean conversion.

## Minimal dependency graph and module boundary

```text
btn()
├── map.get(theme-settings, vars, category)
├── legacy BEM context globals + ambient & + @at-root
├── trim-parent-class() [nested branch only]
│   ├── str-split()
│   ├── value-replace()
│   └── list-to-string()
├── getButtonProperties()
│   ├── map.get(shared-settings / theme-settings, ...)
│   ├── string.unquote() for var(--btn-...) references
│   └── selector() [state/style/icon pseudos]
└── @content [shared state only, after generated properties]
```

Direct globals read by btn: `$modifier-check`, `$state-check`, `$nested`, `$block`,
`$element-separator`, `$nested-item-name`, `$wrapper`, `$where-prefix`,
`$where-suffix`, and the `$state-attribute` it writes globally on each iteration.
`$root` is locally captured from `&` in the relevant branches. The theme-state
and property maps are locals derived from arguments, not hidden project lookups.
Trimming writes `$wrapper`; selector captures its own `&`, writes `$state-wrapper`
and sets/resets `$state-check`. There is no saved BEM frame in btn itself.

Required behavior-level modules are `sass:map`, `sass:string`, and the three
trimming helpers, which use `sass:list`/`sass:meta` as well. For completeness,
loading the legacy monolithic public module eagerly loads all of these files,
even where btn does not call their functions:

- `settings/settings.shared-beminator.scss`, forwarding
  `settings.beminator-init.scss` and `settings.shared-css-layers.scss`.
- `tools/functions/tool.capitalize.scss`, `tool.str-replace.scss`,
  `tool.list-to-string.scss`, `tool.str-split.scss`, `tool.value-replace.scss`,
  `tool.last.scss`, and `tool.str-to-list.scss`.
- `tools/mixins/tool.inject-css3-vars.scss`, which imports
  `tools/functions/tool.hex-to-rgb.scss`.
- Built-in `sass:string`, `sass:meta`, `sass:map`, `sass:list`.

The representative consumer separately imports `settings.beminator-project.scss`.
Its maps are not automatically selected by btn. Loaded file URLs were observed
with Dart Sass; unused imported algorithms were not audited recursively.

## Map schemas and validation

The repository contains sample project maps, **not an identified definition of
`eurobetSettings.$btnSkins` from the supplied real application**. The following
are exact small excerpts of the available maps, not invented Eurobet values:

```scss
$btnSkins: (
  prefix: "btn",
  vars: (
    primary: (
      shared: (default: (color: #000, background-color: white)),
      enabled: (hover: (background-color: white), active: (background-color: white)),
      disabled: (
        hover: (color: #000, background-color: blue),
        active: (background-color: white)
      )
    )
  )
);

// Excerpt: source also supplies xs, small and large.
$btnSizes: (
  prefix: "btn",
  vars: (size: (medium: (
    height: 44px, font-size: 1.25em, padding: 10px 16px, gap: 10px
  )))
);
```

Skin schema: `vars → category → state → style → CSS-property: value`.
`shared` removes the outer state pseudo and triggers size declarations/content;
other state keys become `:state`. `default` removes the inner style pseudo;
other style keys become `:style`. Only supplied entries are generated, in map
iteration order. No hardcoded hover/focus/disabled inventory or fallback skin
exists. The sample has no focus entry and no enabled/default entry.

Size schema: `vars → size → size-name → CSS-property: value`. `icon-size` is a
special optional property; all other keys become declarations on the base rule.
`icon-color` is the analogous optional skin property. The shipped sample has no
active icon-color entry and no icon-size entry. These settings have no `!default`
declarations; callers explicitly supply the maps.

Both helpers use **keys**, not leaf values, to emit `var(--btn-...)` references.
The `prefix` metadata is ignored by btn/getButtonProperties: the CSS variable
prefix `btn` and element token prefix `btn-` are hardcoded independently.
Providing variables matching those references is necessary for the intended
computed styles; there are no `var()` fallback values.

There is no deliberate schema/name/category/size/icon validation. A useful base
pattern requires the selected category and size map and a `shared` state;
`default`/other states/properties are optional according to desired output.
Small in-memory checks found:

- Without `shared`, supplied state rules still emit, but size declarations and
  consumer content do not execute.
- A missing category raises Sass `Expected identifier.`
- A missing size can serialize a malformed empty-property declaration,
  `: var(--btn-size-absent-) !important;`, rather than a useful fallback/error.

These are legacy weaknesses to specify deliberately later, not behavior to copy
automatically. No attempt was made to enumerate every malformed map.

## Representative exact CSS

Compiled using v3's Dart Sass 1.104.1, without installing or writing anything in
v2. The hypothetical outer block is `card` (the supplied real call did not name
its parent). Inside ordinary `bem.block('card')`, use the available sample maps:

```scss
@include bem.btn('play', settings.$btnSkins, settings.$btnSizes,
  $size: 'medium', $category: 'primary', $icon: 'false') {
  margin-bottom: 10px;
}
```

Exact emitted CSS:

```css
.card__btn-play {
  height: var(--btn-size-medium-height) !important;
  font-size: var(--btn-size-medium-font-size) !important;
  padding: var(--btn-size-medium-padding) !important;
  gap: var(--btn-size-medium-gap) !important;
  color: var(--btn-primary-shared-default-color) !important;
  background-color: var(--btn-primary-shared-default-background-color) !important;
  margin-bottom: 10px;
}

.card__btn-play:enabled:hover {
  background-color: var(--btn-primary-enabled-hover-background-color) !important;
}

.card__btn-play:enabled:active {
  background-color: var(--btn-primary-enabled-active-background-color) !important;
}

.card__btn-play:disabled:hover {
  color: var(--btn-primary-disabled-hover-color) !important;
  background-color: var(--btn-primary-disabled-hover-background-color) !important;
}

.card__btn-play:disabled:active {
  background-color: var(--btn-primary-disabled-active-background-color) !important;
}
```

No CSS variable definitions, modifier classes, category/size classes, icon rules,
focus rules, layer wrapper or additional rules were emitted in this fixture.
Literal map colors/dimensions are not emitted by btn. Nor does it contain a fixed
reset/display/border/cursor rule set: its predefined behavior is the map-driven
pattern, pseudo-state expansion, icon handling and `!important` policy.
Exact output for the real Eurobet map cannot be asserted without that map.

Icon behavior from source: encountering `icon-size` with string `'true'` emits
`:before` or `:after` with empty content, equal width/height referencing the size
variable, and a `.5em` side margin; the opposite pseudo gets `content: none`.
String `'false'` emits both content-none rules **only when icon-size is present**.
`icon-color` with `'true'` adds empty content and a background-color variable to
the selected pseudo, clearing the opposite one. With `'false'`, icon-color alone
does nothing. All generated declarations use `!important`. No icon child class,
glyph, image URL or mask is generated by these helpers.

## Responsibility and theme dependency split

| Code/concept | Bucket | Future disposition |
| --- | --- | --- |
| btn 781–824: modifier/state branches, parent capture, element selector interpolation, nesting/wrapper handling, repeated at-root | A. BEM STRUCTURAL MECHANICS | Delegate to one public element entry |
| trim-parent-class 495–507: serialized selector splitting and literal `--`/`__` tests | A + E. LEGACY ARCHITECTURE | Delete from Button; v3 already retains ownership explicitly |
| btn 768–779 and helper 631–758: selected category/state/style expansion, size, icon rules, important declarations | B. BUTTON UI GENERATION | Retain as specified pattern behavior, independently of BEM ownership |
| Map schema, option names/defaults, btn-/--btn- conventions | C. GENERIC BUTTON CONFIGURATION | Button contract decisions; not core BEM separators |
| Concrete colors/sizes and actual Eurobet skin selection | D. EUROBET / PROJECT-SPECIFIC CONFIGURATION | Preset/config inputs; sample project values are not proven Eurobet values |
| Mutable flags/wrapper/state-attribute, legacy where-prefix/suffix | E. LEGACY ARCHITECTURE / OBSOLETE | Do not reproduce state leaks or hidden specificity modes |

Runtime CSS variables are **REQUIRED BUTTON BEHAVIOR for faithful v2 styles**;
their declaration provider is separable **GENERIC CONFIG**. The imported
`inject-css3-vars` machinery is not called by btn: a consumer may supply equivalent
custom properties itself. Rebuilding its global/path machinery is unnecessary.
The enclosing legacy block can perform theme/CSS-variable setup, but that is
surrounding integration, not a btn call dependency.

Theme paths, filesystem discovery, the theme registry and Atomic Design layer
configuration are **LEGACY / CAN REMOVE from the Button implementation**. Actual
Eurobet values/token provisioning are a **EUROBET PRESET CONCERN**. No Eurobet
module, filesystem path or Atomic Design type is read by btn itself. Existing
lexical layers can be inherited through element without a new Button layer API.

## Content, structural equivalence and public API feasibility

V2 executes `@content` only during `shared`, after getButtonProperties, in the
unqualified Button rule. It is not replayed for enabled/disabled/style/icon rules.
With the normal map it executes once; without shared it is skipped. Omitting the
content block is permitted. Local declarations are not automatically important,
so a normal declaration cannot override a generated important declaration merely
because it appears later. V2 does not push an element frame for this content;
arbitrary BEM re-entry there should not be inferred as an existing promise.

Future structural delegation is viable, with one naming caveat:
`element($name)` would yield `.card__play`, whereas preserving v2 naming needs
the ordinary element token **`btn-play`** passed to public element. That fixed
pattern prefix is not a second implementation of owner or separator handling.
Choose the token convention explicitly before any implementation.

With valid Button options/names, enter element once independently of state-map
iteration, then emit pattern styling and local content inside it. Thus parent
validity comes from element even if maps are empty or lack shared:

| Parent P | P → future btn has the same structural result as P → element |
| --- | --- |
| block | Valid, same naming owner |
| modifier | Valid, modifier scope retained |
| qualified (including has) | Valid, completed qualified scope retained |
| extend | Valid, extend target owner and ancestry retained |
| pending relation | Valid, resolves an element RHS |
| element | Invalid direct element nesting |
| root | Unsupported; no naming owner |

Public `selector()` can express each observed `:enabled`, `:disabled`, `:hover`,
`:active`, `:before` and `:after`, including chained pseudos. Ordinary terminal
Sass is also sufficient for these local UI rules. No modifier classes or has
conditions are generated by v2 btn, so `modifier()`/`has()` are not prerequisites.
Arbitrary state/style strings are blindly interpolated in v2; unprovided maps
using functional pseudos cannot be assumed to fit v3 selector's restricted grammar.
That is a future Button input-contract issue, not a reason to access private core.

No observed Button requirement prevents public-element delegation. Exact legacy
where specificity, permissive invalid nesting and history-dependent wrapper/flag
effects are not preserved by adopting v3 semantics. The UI behavior does not
require those artifacts. The repeated structural branches, global flags, parent
reconstruction and multiple emission sites can disappear; the map/state/icon
generator remains substantial UI logic. No speculative line-count saving is claimed.

## Classification and one next investigation

Classify this as a **Button component delivered as an optional addon**, with a
possible **Eurobet preset/config** supplying tokens and values. It is not a
required core feature or merely a generic element helper. No package/folder/export
architecture is decided here.

**Next investigation:** obtain the actual consumer's `$btnSkins`, `$btnSizes` and
matching `--btn-*` variable definitions, and review one real Button output contract
(including the `btn-` name and icon/content behavior). This resolves the remaining
evidence gap before rebuilding the pattern; no v3 private extension API is needed
on the available evidence. Do not implement the addon yet.

Verification was limited to the representative compile and three small map-edge
checks, all in memory through the existing compiler; legacy deprecation warnings
were retained. The legacy working tree stayed clean. V3 has only this report
added; no production test run or broad repository audit was needed.

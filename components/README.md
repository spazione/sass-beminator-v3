# Optional Button component

`_button.scss` is an optional Eurobet-oriented UI pattern, built on the public
BEMinator `element()` and `selector()` mixins. It is not core: Button maps, icons
and design-system styling are consumer policy. It is independently importable
from this checkout and exposes only `btn()`. The main API still exposes seven
mixins, three settings and no functions.

The small top-level `components/` directory separates specialized UI source from
core without adding an extension framework. No package subpath or new exports
are introduced; the existing package file list does not ship this directory.
A future explicit package subpath or separate distribution can be considered
independently. Do not import private core files.

## Usage and signature

For a stylesheet at the repository root (adjust paths for its location):

```scss
@use './src/index' as bem;
@use './components/button';
@use './project-button-settings' as settings; // consumer-supplied module

@include bem.block('card') {
  @include button.btn('play', settings.$btnSkins, settings.$btnSizes,
    $size: 'medium', $category: 'primary', $icon: 'false') {
    margin-bottom: 10px;
  }
}
// .card__btn-play plus the configured pseudo-state rules
```

The exact legacy signature is retained; the first three arguments are required:

```scss
@mixin btn(
  $name,
  $theme-settings,
  $shared-settings,
  $size: 'medium',
  $category: 'primary',
  $icon: 'true',
  $icon-align: 'left'
)
```

`btn()` enters `bem.element('btn-' + $name)` exactly once. It inherits naming
owner, scope, valid nesting, configured separators and restoration. Configure
core **before** loading Button, for example `@use './src/index' as bem with
($element-separator: '-');`, to obtain `.card-btn-play`. Block, modifier,
qualified, has-qualified, extend and supported pending-relation parents behave
like a direct element. Root and direct element parents are rejected by core.
The component has no private-core dependency, persistent mutable state, parent
parsing or separate BEM emission mechanism.

## Configuration and variable references

The legacy schemas are unchanged:

- Theme: `vars → category → state → style → CSS property: value`.
- Size: `vars → size → size-name → CSS property: value`.

For example, these are schema illustrations, **not design token defaults**:

```scss
$btnSkins: (
  prefix: 'btn',
  vars: (primary: (
    shared: (default: (color: null, background-color: null)),
    enabled: (hover: (background-color: null), active: (background-color: null)),
    disabled: (hover: (color: null))
  ))
);
$btnSizes: (
  prefix: 'btn',
  vars: (size: (medium: (height: null, font-size: null, icon-size: null)))
);
```

Only keys drive output. Leaf values and `prefix` metadata are ignored. Consumers
must provision the corresponding CSS custom properties, such as
`--btn-size-medium-height`, `--btn-primary-shared-default-color` and
`--btn-primary-enabled-hover-background-color`. Button emits references such as
`height: var(--btn-size-medium-height) !important;`, never definitions or literal
map values. The fixed `--btn-` variable prefix is independent of BEM separators.
There are no implicit resets, modifier classes or layer wrappers.

One category and one size are selected. Supplied entries retain map order.
`shared` uses the base Button; other state keys add a pseudo. `default` adds no
inner pseudo; other style keys add another pseudo. No complete inventory of
states is generated. Missing category, or missing size when `shared` is reached,
produces a small explicit local error. There is no comprehensive schema validator.

## Icons and content

Use the strings `'true'` and `'false'`, not Sass booleans; align with `'left'` or
`'right'`. With `'true'`, `icon-size` emits empty content, height, width and a
`.5em` side margin on `:before` (left) or `:after` (right), and clears the opposite
pseudo with `content: none`. `icon-color` emits empty content and a skin-variable
background color on the selected pseudo and clears the opposite one.

With `'false'`, encountering `icon-size` clears both pseudos; `icon-color` emits
nothing. Without `icon-size`, no unconditional suppression occurs. This preserves
legacy key-triggered behavior and declaration order. Generated declarations all
use `!important`.

Optional `@content` executes once at the `shared` map position, after shared
styling, in the base Button scope. It is never replayed into generated states or
icons. Its declarations have ordinary importance unless explicitly specified.
Without `shared`, neither content nor size declarations are emitted. Shared may
appear after other states; output retains that ordering. Sass may split base
rules around interleaved pseudo rules without changing this contract.

## Restricted pseudo keys and exceptional overrides

Supported map keys follow the established pattern: non-functional pseudo names
such as `enabled`, `disabled`, `hover`, `active` and `focus`. Button is not an
arbitrary-selector language. Functional keys such as `nth-child(2)` are unsupported
and rejected by public `selector()`. Core syntax is unchanged.

Use content for small local declarations. For a rare exception, target the same
BEM element separately, within the same permitted parent context:

```scss
@include bem.block('card') {
  @include button.btn('play', settings.$btnSkins, settings.$btnSizes);
  @include bem.element('btn-play') {
    &:nth-child(2) {
      color: purple !important;
    }
  }
}
```

This uses terminal raw Sass for the exceptional selector; do not re-enter BEM
mixins from that raw selector. Generated properties are `!important`: overriding
them may require matching importance (and sufficient specificity/source order),
or changing the referenced custom property. No hooks or override API are needed.

## Compatibility and maintenance

Maintained tests live in `tests/components/`; `npm run test:button` and `npm test`
run them without a legacy checkout. `npm run test:legacy` additionally compares
the promoted module directly against read-only v2. All observed states, icons,
content rules, ordering and structural inheritance from the spike are retained.
Only blank lines between CSS rules are normalized; no semantic differences are
normalized. The representative legacy CSS is preserved byte-for-byte.

See [fixture provenance](../tests/components/fixtures/README.md) and the
[historical spike](../spikes/button-addon/README.md). The frozen core and its
feature-completeness verdict are unchanged.

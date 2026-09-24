# Architecture boundaries

**Core** provides BEM selector behavior through `block`, `element`, `modifier`,
`selector`, `extend`, `has`, and `css-layers`. The implemented contract is in
[SPEC-v3.md](SPEC-v3.md) and [PRODUCTION-v3.md](PRODUCTION-v3.md). It uses modern
Dart Sass selector primitives, one evolving private context stack, and one BEM
emission boundary. The original bootstrap boundary described below remains the
basis for optional work; it does not imply that production is still unimplemented.

**Addons** may provide optional related capabilities after core behavior and
extension needs are stable. They must not force unrelated CSS utilities or
project conventions into the core.

**Plugins/Presets** may express project conventions, theme integration, and Atomic
Design configurations. The old themed button functionality is expected to
become a plugin/preset rather than part of the BEM core. Eurobet-specific paths
and conventions must also remain outside the core.

The specific extension mechanism and implementation internals are intentionally
undecided. Public behavior must be specified and tested before implementation;
the v2 architecture is not a template for v3.

`helpers/` separates generic Sass compilation, project paths, and legacy setup.
`tests/unit/` contains standalone infrastructure checks; `tests/legacy/` contains
opt-in reference smoke checks. `fixtures/` holds input SCSS. `characterization/`
and `compatibility/` reserve space for historical observations and approved v3
comparisons. `scripts/` is reserved for future development tooling.

# Extending BEMinator through composition

Higher-level mixins can wrap public BEMinator primitives and automatically
inherit BEM context, nesting validity, configured separators, scope and
restoration. For a local stylesheet at the repository root:

```scss
@use './src/index' as bem;

@mixin custom-element-pattern($name) {
  @include bem.element($name) {
    display: flex;
    gap: 0.5rem;
    @content;
  }
}

@include bem.block('card') {
  @include custom-element-pattern('actions') {
    margin-top: 1rem;
  }
}
// .card__actions { display: flex; gap: 0.5rem; margin-top: 1rem; }
```

The wrapper owns specialized styling; `element()` owns all BEM structure. A
configured element separator changes its name automatically. The same nesting
rules apply as for a direct element call, including rejection beneath another
direct element or at root. Subsequent siblings retain their enclosing context.
Use public `selector()` for supported qualification; raw Sass is suitable for
terminal styling, not BEM re-entry with inferred context.

This is ordinary Sass composition, with no registration, hooks or private API.
The optional [Button component](../components/README.md) is a specialized example
of this pattern; it does not expand BEMinator's core responsibilities.

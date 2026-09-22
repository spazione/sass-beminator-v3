import assert from 'node:assert/strict';
import test from 'node:test';
import { initCompiler } from 'sass';
import { compileScss } from '../../helpers/compile-scss.js';
const url = new URL('layers-fixture.scss', import.meta.url);
const prelude = (config = '') => `@use '../../src' as bem${config ? ` with (${config})` : ''};`;
const compile = (body, config = '') => compileScss(prelude(config) + body, { url });
const block = (body, name = 'card', selection = ", $layer: 'molecules'") => `@include bem.block('${name}'${selection}) { ${body} }`;
const rule = (selector, color = 'red') => `${selector} {\n  color: ${color};\n}`;
const wrap = (at, css) => `${at} {\n${css.split('\n').map((line) => `  ${line}`).join('\n')}\n}`;
const layer = (css, name = 'molecules') => wrap(`@layer ${name}`, css);
const order = '@layer generic, elements, atoms, molecules, organisms, templates, pages, utilities;';

for (const selection of [", $layer: 'molecules'", ', $layer: molecules', ", 'molecules'"]) {
  test(`block layer compatibility: ${selection}`, () => assert.equal(compile(block('color: red;', 'card', selection)), layer(rule('.card'))));
}
test('no automatic CSS; omitted and explicit null add no wrapper', () => {
  assert.equal(compile(''), '');
  assert.equal(compileScss("@use '../../src' as *; @include block('card', $layer: 'molecules') { color: red; }", { url }), layer(rule('.card')));
  for (const selection of ['', ', $layer: null']) {
    assert.equal(compile(block('color: red;', 'card', selection)), rule('.card'));
    assert.equal(compile(`@layer external { ${block('color: red;', 'card', selection)} }`), layer(rule('.card'), 'external'));
  }
});
test('layer propagates to block declarations, elements, and modifiers', () => {
  assert.equal(compile(block(`color: red; @include bem.element('title') { color: blue; }
    @include bem.modifier('active') { color: green; }`)),
  layer([rule('.card'), rule('.card__title', 'blue'), rule('.card--active', 'green')].join('\n')));
});
test('null and omitted nested layers inherit through recursive block composition', () => {
  for (const selection of ['', ', $layer: null']) {
    assert.equal(compile(block(block("@include bem.element('title') { color: red; }", 'card', selection), 'page', ", $layer: 'templates'")), layer(rule('.page .card__title'), 'templates'));
  }
});
for (const selection of ['', ", $layer: 'templates'", ", $layer: 'molecules'"]) {
  test(`explicit inner layers rejected under ${selection || 'unlayered root'}`, () => {
    for (const inner of [block(''), `@include bem.modifier('active') { ${block('')} }`,
      `@include bem.element('item') { @include bem.modifier('active') { ${block('')} } }`,
      `@media (min-width: 1px) { ${block('')} }`]) {
      assert.throws(() => compile(block(inner, 'page', selection)), /explicit layer selection is supported only on the root BEM block/);
    }
  });
}
test('extend ancestry rejection takes precedence over explicit layer selection', () => {
  assert.throws(() => compile(block(`@include bem.extend('icon', 'a') { @include bem.element('item') {
    @include bem.modifier('active') { ${block('')} } } }`)), /block is forbidden beneath extend/);
});
test('layered extend retains owner, scope, and modifier conjunction', () => {
  assert.equal(compile(block(`@include bem.extend('icon', 'active', 'large') { color: blue;
    @include bem.element('label') { @include bem.modifier('a', 'b') { color: red; } }
  }`)), layer([rule('.card .icon--active.icon--large', 'blue'), rule('.card .icon--active.icon--large .icon__label--a.icon__label--b')].join('\n')));
});
test('qualified compounds apply only to their subject inside a layer', () => {
  assert.equal(compile(block(`@include bem.selector(':hover') { color: red; }
    @include bem.element('item') { @include bem.modifier('active') { @include bem.selector('[disabled]:focus::before') { color: blue; } } }`)),
  layer([rule('.card:hover'), rule('.card__item--active[disabled]:focus::before', 'blue')].join('\n')));
});
for (const relation of ['+', '>', '~']) {
  test(`layered ${relation} supports RHS siblings/modifiers and restores parent`, () => {
    assert.equal(compile(block(`@include bem.element('item') { @include bem.selector('${relation}') {
      @include bem.element('child') { @include bem.modifier('active') { color: red; } }
      @include bem.element('other') { color: blue; }
    } @include bem.modifier('after') { color: green; } }`)), layer([
      rule(`.card__item ${relation} .card__child--active`), rule(`.card__item ${relation} .card__other`, 'blue'), rule('.card__item--after', 'green'),
    ].join('\n')));
  });
}
test('custom separators remain independent from layer configuration', () => {
  assert.equal(compile(block(`@include bem.extend('icon', 'a', 'b') { @include bem.element('item') {
    @include bem.selector(':hover') { color: red; }
    @include bem.selector('>') { @include bem.element('child') { @include bem.modifier('active') { color: blue; } } }
  } }`, 'card', ", $layer: 'components'"), "$element-separator: '-', $modifier-separator: '_', $css-layers: (components: ())"),
  layer([rule('.card .icon_a.icon_b .icon-item:hover'), rule('.card .icon_a.icon_b .icon-item > .icon-child_active', 'blue')].join('\n'), 'components'));
});
for (const at of ['@media (min-width: 40rem)', '@supports (display: grid)', '@container (min-width: 30rem)']) {
  test(`conditional wrapper order: ${at}`, () => {
    assert.equal(compile(block(`${at} { @include bem.element('title') { color: red; } } @include bem.element('after') { color: blue; }`)),
      layer(wrap(at, rule('.card__title')) + '\n' + rule('.card__after', 'blue')));
    assert.equal(compile(`${at} { ${block("@include bem.element('title') { color: red; }")} }`), wrap(at, layer(rule('.card__title'))));
    assert.equal(compile(block(`@include bem.element('item') { @include bem.selector('>') { ${at} { @include bem.element('child') { color: red; } } } }`)), layer(wrap(at, rule('.card__item > .card__child'))));
  });
}
test('ordering is explicit and repeated calls emit repeated declarations', () => {
  assert.equal(compile('@include bem.css-layers();'), order);
  assert.equal(compile('@include bem.css-layers(); @include bem.css-layers();'), order + '\n' + order);
  assert.equal(compile('@include bem.css-layers();' + block('color: red;')), order + '\n' + layer(rule('.card')));
  assert.equal(compile('@layer molecules, templates;' + block('color: red;')), '@layer molecules, templates;\n' + layer(rule('.card')));
});
test('registry replacement preserves top-level insertion order and ignores all values', () => {
  assert.equal(compile('@include bem.css-layers();' + block('color: red;', 'card', ", $layer: 'components'"),
    '$css-layers: (reset: (), base: 42, components: (atoms: (), molecules: ()), utilities: false)'),
  '@layer reset, base, components, utilities;\n' + layer(rule('.card'), 'components'));
  assert.throws(() => compile(block('', 'card', ", $layer: 'atoms'"), '$css-layers: (components: (atoms: ()))'), /unknown configured layer/);
});
test('registry and selection normalize equivalent strings but retain case', () => {
  assert.equal(compile(block('color: red;', 'card', ', $layer: molecules'), "$css-layers: ('molecules': ())"), layer(rule('.card')));
  assert.equal(compile(block('color: red;'), String.raw`$css-layers: ('molec\75 les': ())`), layer(rule('.card')));
  assert.equal(compile('@include bem.css-layers();', '$css-layers: (molecules: (), Molecules: ())'), '@layer molecules, Molecules;');
  assert.throws(() => compile(block('', 'card', ", $layer: 'Molecules'")), /unknown configured layer/);
});
test('unknown selections produce BEMinator-owned diagnostics', () => {
  assert.throws(() => compile(block('', 'card', ", $layer: 'foo'")), /BEMinator: unknown configured layer "foo" in \$css-layers/);
});
test('registry shape is validated on import even without layer use', () => {
  for (const registry of ['()', '12', 'false', "'molecules'", '(a, b)']) {
    assert.throws(() => compile('', `$css-layers: ${registry}`), /BEMinator: \$css-layers must be a nonempty Sass map/);
  }
  assert.equal(compile('@include bem.css-layers();', '$css-layers: null'), order);
});
test('invalid evaluated layer names fail as keys and arguments', () => {
  for (const name of ["''", "' '", "'a b'", "'a,b'", "'a.b'", "'a{}'", "'a; color:red'", "'é'", "'-vendor'", "'7foo'", '1', 'false', "('a', 'b')", '(a: b)',
    'initial', 'inherit', 'unset', 'revert', 'revert-layer', 'default', 'DEFAULT']) {
    assert.throws(() => compile('', `$css-layers: (${name}: ())`), /BEMinator: (layer names|reserved layer)/);
    assert.throws(() => compile(block('', 'card', `, $layer: ${name}`)), /BEMinator: (layer names|reserved layer)/);
  }
});
test('duplicate normalized Sass string keys fail before evaluation', () => {
  assert.throws(() => compile('', "$css-layers: (molecules: (), 'molecules': ())"), /Duplicate key/);
});
test('quoted color name works while unquoted Sass color is not a string', () => {
  assert.equal(compile(block('color: red;', 'card', ", $layer: 'red'"), "$css-layers: ('red': ())"), layer(rule('.card'), 'red'));
  assert.throws(() => compile(block('', 'card', ', $layer: red'), "$css-layers: ('red': ())"), /nonempty Sass strings/);
});
test('repeated layered and independent unlayered roots never share context', () => {
  const source = block("@include bem.block('icon') { color: red; } @include bem.element('after') { color: blue; }");
  assert.equal(compile(source + block('color: green;', 'other') + block('color: red;', 'plain', '')),
    [layer(rule('.card .icon') + '\n' + rule('.card__after', 'blue')), layer(rule('.other', 'green')), rule('.plain')].join('\n'));
});
test('empty layered blocks establish a layer; pending declarations and selector exclusions remain errors', () => {
  assert.equal(compile(block('')), '@layer molecules {}');
  for (const [body, diagnostic] of [
    ["@include bem.element('item') { @include bem.selector('>') { color: red; } }", /Declarations may only be used within style rules/],
    ["@include bem.selector(':has(.foo)') {}", /functional pseudo selectors are deferred/],
    ["@include bem.selector(':hover') { @include bem.selector(':focus') {} }", /qualified -> qualified is deferred/],
  ]) assert.throws(() => compile(block(body)), diagnostic);
});
test('layer parameters do not expand descendant signatures or restore retired arguments', () => {
  for (const call of ["element('item', $layer: 'molecules')", "modifier('a', $layer: 'molecules')", "selector(':hover', $layer: 'molecules')", "extend('icon', 'a', $layer: 'molecules')", "block('card', $theme: true)", 'css-layers(1)']) {
    assert.throws(() => compile(block(`@include bem.${call} {}`)), /No (?:argument|parameter) named|Only \d+ arguments? allowed|Mixin doesn't accept a content block/);
  }
});
test('compiler reuse after nested layer rejection restores clean independent compilation', () => {
  const compiler = initCompiler();
  const run = (body) => compiler.compileString(prelude() + body, { url }).css;
  try {
    assert.throws(() => run(block(block(''))), /root BEM block/);
    assert.equal(run(block('color: red;')), layer(rule('.card')));
    assert.equal(run(block('color: red;', 'card', '')), rule('.card'));
  } finally { compiler.dispose(); }
});

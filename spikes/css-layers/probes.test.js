import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { compileScss } from '../../helpers/compile-scss.js';
const url = new URL('fixture.scss', import.meta.url);
const output = new URL('../../tmp/css-layers/', import.meta.url);
mkdirSync(output, { recursive: true });
const order = '@layer generic, elements, atoms, molecules, organisms, templates, pages, utilities;';
const rule = (selector, color = 'red') => `${selector} {\n  color: ${color};\n}`;
const wrap = (at, css) => `${at} {\n${css.split('\n').map((line) => line ? `  ${line}` : '').join('\n')}\n}`;
const layer = (css, name = 'molecules') => wrap(`@layer ${name}`, css);
function compile(source, name) {
  try {
    const css = compileScss(source, { url });
    if (name) {
      writeFileSync(new URL(`${name}.scss`, output), source);
      writeFileSync(new URL(`${name}.css`, output), css);
    }
    return css;
  } catch (error) {
    if (name) writeFileSync(new URL(`${name}.error.txt`, output), String(error));
    throw error;
  }
}
const proof = (body, config = '') => `@use 'proof' as p${config ? ` with (${config})` : ''}; ${body}`;
const block = (body, name = 'card', selection = ", $layer: 'molecules'") => `@include p.block('${name}'${selection}) { ${body} }`;
function check(name, source, expected) { test(name, () => assert.equal(compile(source, name), expected)); }
check('quoted-legacy', proof(block('color: red;')), layer(rule('.card')));
check('unquoted', proof(block('color: red;', 'card', ', $layer: molecules')), layer(rule('.card')));
check('no-layer', proof(block('color: red;', 'card', '')), rule('.card'));
check('explicit-null', proof(block('color: red;', 'card', ', $layer: null')), rule('.card'));
check('import-only', proof(''), '');
check('subtree', proof(block(`color: red;
  @include p.element('title') { color: blue; }
  @include p.modifier('active', 'large') { color: green; }`)),
layer([rule('.card'), rule('.card__title', 'blue'), rule('.card--active.card--large', 'green')].join('\n')));
check('nested-inherits', proof(block(block("@include p.element('title') { color: red; }", 'card', ''), 'page', ", $layer: 'templates'")), layer(rule('.page .card__title'), 'templates'));
check('inner-explicit-layer', proof(block(`color: blue; ${block('color: red;')} @include p.element('after') { color: green; }`, 'page', ", $layer: 'templates'")),
layer([rule('.page', 'blue'), layer(rule('.page .card')), rule('.page__after', 'green')].join('\n'), 'templates'));
check('inner-same-layer', proof(block(block('color: red;'))), layer(layer(rule('.card .card'))));
check('extend', proof(block(`@include p.extend('icon', 'active', 'large') {
 color: blue; @include p.element('label') { @include p.modifier('active') { color: red; } }
}`)), layer([rule('.card .icon--active.icon--large', 'blue'), rule('.card .icon--active.icon--large .icon__label--active')].join('\n')));
check('qualified', proof(block(`@include p.selector('[disabled]:hover') { color: red; }`)), layer(rule('.card[disabled]:hover')));
for (const relation of ['+', '>', '~']) {
  const id = { '+': 'adjacent', '>': 'child', '~': 'sibling' }[relation];
  check(`pending-${id}`, proof(block(`@include p.element('item') { @include p.selector('${relation}') {
    @include p.element('child') { color: red; @include p.modifier('active') { color: blue; } }
  } @include p.modifier('after') { color: green; } }`)), layer([
    rule(`.card__item ${relation} .card__child`), rule(`.card__item ${relation} .card__child--active`, 'blue'), rule('.card__item--after', 'green'),
  ].join('\n')));
}
check('custom-separators', proof(block(`@include p.extend('icon', 'a', 'b') { @include p.element('item') {
  @include p.selector(':hover') { color: red; }
  @include p.selector('>') { @include p.element('child') { @include p.modifier('active') { color: blue; } } }
} }`), "$element-separator: '-', $modifier-separator: '_'"), layer([
  rule('.card .icon_a.icon_b .icon-item:hover'), rule('.card .icon_a.icon_b .icon-item > .icon-child_active', 'blue'),
].join('\n')));
for (const [id, at] of [['media', '@media (min-width: 40rem)'], ['supports', '@supports (display: grid)'], ['container', '@container (min-width: 30rem)']]) {
  check(`${id}-inside`, proof(block(`${at} { @include p.element('title') { color: red; } } @include p.element('after') { color: blue; }`)),
    layer([wrap(at, rule('.card__title')), rule('.card__after', 'blue')].join('\n')));
  check(`${id}-outside`, proof(`${at} { ${block("@include p.element('title') { color: red; }")} }`), wrap(at, layer(rule('.card__title'))));
  check(`${id}-pending`, proof(block(`@include p.element('item') { @include p.selector('>') { ${at} { @include p.element('child') { color: red; } } } }`)), layer(wrap(at, rule('.card__item > .card__child'))));
}
check('repeated-and-independent', proof(block('color: red;') + block('color: blue;', 'other') + block('color: green;', 'plain', '')),
  [layer(rule('.card')), layer(rule('.other', 'blue')), rule('.plain', 'green')].join('\n'));
check('registry-replaced', proof(`@include p.css-layers(); ${block('color: red;', 'card', ", $layer: 'components'")}`,
  '$css-layers: (reset: (), base: (), components: (), utilities: ())'), '@layer reset, base, components, utilities;\n' + layer(rule('.card'), 'components'));
check('quoted-registry-unquoted-argument', proof(block('color: red;', 'card', ', $layer: molecules'), "$css-layers: ('molecules': ())"), layer(rule('.card')));
check('values-ignored', proof(`@include p.css-layers(); ${block('color: red;', 'card', ", $layer: 'components'")}`,
  '$css-layers: (components: (atoms: (), molecules: ()), utilities: 123)'), '@layer components, utilities;\n' + layer(rule('.card'), 'components'));
check('explicit-order', proof(`@include p.css-layers(); ${block('color: red;', 'page', ", $layer: 'templates'")} ${block('color: blue;')}`),
  order + '\n' + layer(rule('.page'), 'templates') + '\n' + layer(rule('.card', 'blue')));
check('explicit-order-repeat', proof('@include p.css-layers(); @include p.css-layers();'), order + '\n' + order);
check('consumer-order', proof('@layer templates, molecules; ' + block('color: red;')), '@layer templates, molecules;\n' + layer(rule('.card')));
check('automatic-unused', "@use 'automatic';", order);
check('automatic-module-dedup', "@use 'consumer-a'; @use 'consumer-b';", order + '\n' + layer(rule('.a')) + '\n' + layer(rule('.b', 'blue')));
check('automatic-aliases', "@use 'automatic' as a; @use 'automatic' as b;", order);
check('automatic-per-call-repeats', proof(`@mixin auto-block($name) { @include p.css-layers(); @include p.block($name, $layer: molecules) { @content; } }
@include auto-block('a') { color: red; } @include auto-block('b') { color: blue; }`),
order + '\n' + layer(rule('.a')) + '\n' + order + '\n' + layer(rule('.b', 'blue')));
check('wrapper-secondary', proof(`@include p.layer('molecules') { ${block('color: red;', 'card', '')} }`), layer(rule('.card')));
check('raw-layer-inherits', proof(`@layer external { ${block('color: red;', 'card', '')} }`), layer(rule('.card'), 'external'));
check('raw-reentry-not-fixed', proof(block(`&:hover { @include p.element('title') { color: red; } }`)), layer(rule('.card__title')));
check('order-inside-style-is-not-hoisted', proof(block('@include p.css-layers(); color: red;')), layer(wrap('.card', order + '\ncolor: red;')));
check('order-inside-layer-is-relative', proof('@layer templates { @include p.css-layers(); }'), layer(order, 'templates'));
check('legacy-unprefixed-source', "@use 'proof' as *; @include block('card', $layer: 'molecules') { color: red; }", layer(rule('.card')));
check('empty-layer', proof(block('')), '@layer molecules {}');
check('registry-null-default', proof('@include p.css-layers();', '$css-layers: null'), order);
check('no-layer-custom-registry', proof(block('color: red;', 'card', ''), '$css-layers: (components: ())'), rule('.card'));
check('inner-explicit-null-inherits', proof(block(block('color: red;', 'card', ', $layer: null'), 'page')), layer(rule('.page .card')));

test('unknown and malformed selections fail rather than becoming arbitrary CSS', () => {
  for (const value of ["'foo'", "''", "' '", "'a,b'", "'a b'", "'a.b'", "'x{}'", '12', 'true', "('a', 'b')", '(a: b)']) {
    assert.throws(() => compile(proof(block('color: red;', 'card', `, $layer: ${value}`))), /Layer spike:/);
  }
});
test('invalid registry shapes and keys fail eagerly', () => {
  for (const registry of ['()', '12', "'molecules'", '(a, b)', "('': ())", "('a b': ())", "('a,b': ())", "('a.b': ())", '(1: ())', '(inherit: ())', '(DEFAULT: ())', "('é': ())", "('-vendor': ())"]) {
    assert.throws(() => compile(proof('', `$css-layers: ${registry}`)), /Layer spike:/);
  }
});
test('quoted and unquoted duplicate keys are rejected by Sass before normalization', () => {
  assert.throws(() => compile(proof('', "$css-layers: (molecules: (), 'molecules': ())")), /Duplicate key/);
});
check('case-sensitive-distinct-keys', proof(`@include p.css-layers(); ${block('color: red;', 'card', ", $layer: 'Molecules'")}`,
  '$css-layers: (molecules: (), Molecules: ())'), '@layer molecules, Molecules;\n' + layer(rule('.card'), 'Molecules'));
test('nested registry values do not register nested keys', () => {
  assert.throws(() => compile(proof(block('', 'card', ", $layer: 'atoms'"), '$css-layers: (components: (atoms: ()))')), /unknown configured layer/);
});
test('ancestry and pending declaration failures remain core failures', () => {
  for (const [body, diagnostic] of [
    ["@include p.extend('icon', 'a') { @include p.element('label') { @include p.modifier('active') { @include p.block('bad') {} } } }", /block is forbidden beneath extend/],
    ["@include p.element('item') { @include p.selector('>') { color: red; } }", /Declarations may only be used within style rules/],
  ]) assert.throws(() => compile(proof(block(body))), diagnostic);
  assert.equal(compile(proof(block('color: red;', 'fresh', ''))), rule('.fresh'));
});
test('proof adds no mutable state, context metadata, or BEM emission boundary', () => {
  const source = readFileSync(new URL('_proof.scss', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /!global|@at-root|context-stack/);
  assert.deepEqual([...source.matchAll(/^\$([\w-]+):/gm)].map((m) => m[1]), ['css-layers']);
  const core = readFileSync(new URL('../../src/core/_bem.scss', import.meta.url), 'utf8');
  assert.equal([...core.matchAll(/@at-root\s*\{/g)].length, 1);
  assert.deepEqual([...core.matchAll(/\$([\w-]+):[^;]*!global/g)].map((m) => m[1]), ['-context-stack', '-context-stack']);
});

check('identifier-escapes-normalized-by-sass', proof(block('color: red;', 'card', ", $layer: 'molecules'"), String.raw`$css-layers: ('molec\75 les': ())`), layer(rule('.card')));
test('canonical module cannot be reconfigured after first load', () => {
  assert.throws(() => compile("@use 'proof' as a; @use 'proof' as b with ($css-layers: (components: ()));"), /already loaded/);
});
check('explicit-order-after-emitting-use-is-late', "@use 'proof' as p; @use 'emitting'; @include p.css-layers();",
  layer(rule('.page'), 'templates') + '\n' + order);
check('quoted-color-name-is-a-string', proof(block('color: red;', 'card', ", $layer: 'red'"), "$css-layers: ('red': ())"), layer(rule('.card'), 'red'));
test('unquoted CSS color values are not Sass string layer names', () => {
  assert.throws(() => compile(proof(block('', 'card', ', $layer: red'), "$css-layers: ('red': ())")), /nonempty string/);
  assert.throws(() => compile(proof('', '$css-layers: (red: ())')), /nonempty string/);
});

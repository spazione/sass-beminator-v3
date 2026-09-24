import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { compileScss } from '../../helpers/compile-scss.js';
import { compileLegacy } from '../../helpers/legacy.js';

const url = new URL('probe.scss', import.meta.url);
const mapsUrl = fileURLToPath(new URL('fixtures/_maps.scss', import.meta.url));
const setup = `@use 'sass:map'; @use '${mapsUrl}' as maps;
$skins: maps.$btnSkins; $sizes: maps.$btnSizes;`;
const call = (args = '', content = 'margin-bottom: 10px;') =>
  `@include button.btn('play', $skins, $sizes${args}) { ${content} }`;
const wrap = (mixin, args, body) => `@include bem.${mixin}(${args}) { ${body} }`;
const block = body => wrap('block', "'card'", body);
const compile = (body, config = '', extra = '') => compileScss(
  `@use '../../src/index' as bem ${config}; @use 'button'; ${setup} ${extra} ${body}`, { url });
const legacy = (body, extra = '') => compileLegacy(`${setup} ${extra} ${body.replaceAll('button.btn', 'bem.btn')}`);
const iconMaps = `$sizes: map.set($sizes, vars, size, medium, (height: 44px, icon-size: 1em, gap: 10px));
$skins: map.set($skins, vars, primary, (
  shared: (default: (color: red, icon-color: pink, background-color: white), focus: (icon-color: blue)),
  enabled: (default: (icon-color: red), hover: (background-color: blue, icon-color: pink, color: white)),
  disabled: (active: (icon-color: gray))));`;

// Only blank lines between flat rules differ because v3 enters element once.
const css = value => value.replace(/}\n\n(?=[.#])/g, '}\n');
const comparisons = [
  ['representative', ", $icon: 'false'", ''],
  ['defaults', '', ''],
  ['small secondary, ignored metadata and leaf values', ", 'small', 'secondary', 'false'",
    `$skins: map.set($skins, prefix, 'ignored'); $sizes: map.set($sizes, prefix, 'ignored');
     $skins: map.set($skins, vars, secondary, (shared: (default: (border: 999px)), focus: (default: (opacity: 0))));`],
  ['shared after states', '', `$skins: map.set($skins, vars, primary, (enabled: (hover: (color: red)), shared: (default: (color: blue))));`],
  ['absent shared omits sizes and content', '', `$skins: map.set($skins, vars, primary, (focus: (default: (color: red))));`],
  ['shared non-default style', '', `$skins: map.set($skins, vars, primary, (shared: (hover: (color: red), default: (color: blue))));`],
  ['icon-color alone false does not suppress', ", $icon: 'false'", `$skins: map.set($skins, vars, primary, (shared: (default: (icon-color: red))));`],
  ...['true', 'false'].flatMap(icon => ['left', 'right'].map(align =>
    [`icons ${icon} ${align}`, `, $icon: '${icon}', $icon-align: '${align}'`, iconMaps])),
];
for (const [name, args, extra] of comparisons) {
  test(`exact legacy CSS: ${name}`, () => {
    const body = block(call(args));
    assert.equal(css(compile(body, '', extra)), css(legacy(body, extra)));
  });
}
test('representative file equals live legacy and captured evidence', () => {
  const fixtureUrl = new URL('fixtures/representative.scss', import.meta.url);
  const actual = compileScss(readFileSync(fixtureUrl, 'utf8'), { url: fixtureUrl });
  const expected = readFileSync(new URL('fixtures/representative.css', import.meta.url), 'utf8');
  assert.equal(css(actual), css(expected));
  assert.equal(css(actual), css(legacy(block(call(", $icon: 'false'")))));
  assert.doesNotMatch(actual, /--btn-[\w-]+:|@layer|\.card--/);
  assert.equal((actual.match(/margin-bottom:/g) ?? []).length, 1);
});
test('content optional; named arguments and defaults retain signature', () => {
  const named = "@include button.btn($name: 'play', $theme-settings: $skins, $shared-settings: $sizes);";
  assert.equal(css(compile(block(named))), css(legacy(block(named))));
  for (const args of ["'play'", "'play', $skins"]) {
    assert.throws(() => compile(block(`@include button.btn(${args});`)), /Missing argument/);
  }
});

const parents = [
  ['block', block, '.card__btn-play'],
  ['modifier', body => block(wrap('modifier', "'active'", body)), '.card--active .card__btn-play'],
  ['qualified', body => block(wrap('selector', "':hover'", body)), '.card:hover .card__btn-play'],
  ['has-qualified', body => block(wrap('has', "element, 'details'", body)), '.card:has(.card__details) .card__btn-play'],
  ['extend', body => block(wrap('extend', "'icon', 'active'", body)), '.card .icon--active .icon__btn-play'],
  ...['+', '>', '~'].map(relation => [`pending ${relation}`, body => block(wrap('element', "'left'", wrap('selector', `'${relation}'`, body))), `.card__left ${relation} .card__btn-play`]),
  ['nested scope', body => wrap('block', "'page'", block(body)), '.page .card__btn-play'],
];
const plain = 'height: var(--btn-size-medium-height) !important; color: var(--btn-primary-shared-default-color) !important; margin-bottom: 10px;';
const minimal = '$sizes: (vars: (size: (medium: (height: 1px)))); $skins: (vars: (primary: (shared: (default: (color: red)))));';
for (const [name, parent, selector] of parents) {
  test(`structural equivalence and restoration: ${name}`, () => {
    const after = 'outline: none;';
    const button = parent(call() + after) + block(wrap('element', "'after'", 'color: blue;'));
    const element = parent(wrap('element', "'btn-play'", plain) + after) + block(wrap('element', "'after'", 'color: blue;'));
    // Pending frames forbid direct declarations, so place the restoration marker outside them.
    const clean = source => name.startsWith('pending') ? source.replaceAll(after, '') : source;
    assert.equal(compile(clean(button), '', minimal), compile(clean(element), '', minimal));
    assert.ok(compile(clean(button), '', minimal).includes(`${selector} {`));
    // Full UI rules must inherit the same prefix as a standalone Button, with no duplication.
    const base = compile(block(call()), '', iconMaps);
    assert.equal(compile(parent(call()), '', iconMaps), base.replaceAll('.card__btn-play', selector));
  });
}
for (const [name, parent] of [
  ['root', body => body],
  ['element', body => block(wrap('element', "'wrapper'", body))],
]) {
  test(`invalid ${name} comes from element itself`, () => {
    const error = source => {
      try { compile(parent(source)); assert.fail('Expected rejection'); }
      catch (e) { assert.match(e.message, /BEMinator:.*(?:root -> element|element -> element)/); return e.message.split('\n')[0]; }
    };
    assert.equal(error(call()), error(wrap('element', "'btn-play'", plain)));
  });
}
test('custom separators come only from public element, including states', () => {
  const config = "with ($element-separator: '-', $modifier-separator: '_')";
  for (const [, parent] of parents) {
    assert.equal(compile(parent(call()), config, minimal), compile(parent(wrap('element', "'btn-play'", plain)), config, minimal));
  }
  assert.equal(compile(block(call()), config, iconMaps), compile(block(call()), '', iconMaps).replaceAll('.card__btn-play', '.card-btn-play'));
});
test('layer policy is inherited, not introduced', () => {
  assert.equal(compile(wrap('block', "'card', $layer: 'molecules'", call()), '', minimal),
    compile(wrap('block', "'card', $layer: 'molecules'", wrap('element', "'btn-play'", plain)), '', minimal));
});
test('missing category and size are explicit local failures', () => {
  assert.throws(() => compile(block(call(", $category: 'missing'"))), /Button spike: missing category/);
  assert.throws(() => compile(block(call(", $size: 'missing'"))), /Button spike: missing size/);
});
test('functional map pseudos remain a documented input-contract gap', () => {
  const extra = "$skins: (vars: (primary: (shared: (default: (color: red)), 'nth-child(2)': (default: (color: blue)))));";
  assert.match(legacy(block(call()), extra), /:nth-child\(2\)/);
  assert.throws(() => compile(block(call()), '', extra), /BEMinator:/);
});
test('implementation uses one element wrapper, public entrypoint, no reconstruction', () => {
  const source = readFileSync(new URL('_button.scss', import.meta.url), 'utf8');
  assert.equal((source.match(/@include bem\.element\(/g) ?? []).length, 1);
  assert.deepEqual([...source.matchAll(/@use ['"]([^'"]+)/g)].map(m => m[1]), ['sass:map', 'sass:string', '../../src/index']);
  assert.doesNotMatch(source, /@at-root|!global|__|&|trim-parent|src\/core/);
});

for (const [name, parent] of parents.filter(([name]) => ['block', 'modifier', 'qualified', 'extend'].includes(name))) {
  test(`legacy parent comparison: ${name}`, () => {
    assert.equal(css(compile(parent(call()), '', minimal)), css(legacy(parent(call()), minimal)));
  });
}
test('content observes Button subject and restores it after generated qualifiers', () => {
  const content = "@include bem.modifier('local') { color: blue; } outline: none;";
  const body = block(call('', content));
  const expected = block(wrap('element', "'btn-play'", `height: var(--btn-size-medium-height) !important; color: var(--btn-primary-shared-default-color) !important; ${content}`));
  assert.equal(compile(body, '', minimal), compile(expected, '', minimal));
});
test('legacy and v3 custom element separator comparison', () => {
  assert.equal(css(compile(block(call()), "with ($element-separator: '-')")),
    css(legacy(block(call()), "bem.$element-separator: '-';")));
});

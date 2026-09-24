import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { compileScss } from '../../helpers/compile-scss.js';
import { compile, call, block, wrap, css, comparisons, parents, minimal, plain, iconMaps } from './support.js';

const expectedCases = JSON.parse(readFileSync(new URL('fixtures/compatibility.json', import.meta.url), 'utf8'));
for (const [name, args, extra] of comparisons) {
  test(`captured legacy CSS: ${name}`, () => {
    const body = block(call(args));
    assert.equal(css(compile(body, '', extra)), css(expectedCases[name]));
  });
}
test('representative file equals preserved legacy evidence', () => {
  const fixtureUrl = new URL('fixtures/representative.scss', import.meta.url);
  const actual = compileScss(readFileSync(fixtureUrl, 'utf8'), { url: fixtureUrl });
  const expected = readFileSync(new URL('fixtures/representative.css', import.meta.url), 'utf8');
  assert.equal(css(actual), css(expected));
  assert.doesNotMatch(actual, /--btn-[\w-]+:|@layer|\.card--/);
  assert.equal((actual.match(/margin-bottom:/g) ?? []).length, 1);
});
test('content optional; named arguments and defaults retain signature', () => {
  const named = "@include button.btn($name: 'play', $theme-settings: $skins, $shared-settings: $sizes);";
  assert.equal(css(compile(block(named))), css(expectedCases.defaults.replace('  margin-bottom: 10px;\n', '')));
  for (const args of ["'play'", "'play', $skins"]) {
    assert.throws(() => compile(block(`@include button.btn(${args});`)), /Missing argument/);
  }
});

for (const [name, parent, selector] of parents) {
  test(`structural equivalence and restoration: ${name}`, () => {
    // Direct declarations are forbidden in pending relation frames.
    const after = name.startsWith('pending') ? '' : 'outline: none;';
    const button = parent(call() + after) + block(wrap('element', "'after'", 'color: blue;'));
    const element = parent(wrap('element', "'btn-play'", plain) + after) + block(wrap('element', "'after'", 'color: blue;'));
    const actual = compile(button, '', minimal);
    assert.equal(actual, compile(element, '', minimal));
    assert.ok(actual.includes(`${selector} {`));
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
  assert.throws(() => compile(block(call(", $category: 'missing'"))), /Button: missing category/);
  assert.throws(() => compile(block(call(", $size: 'missing'"))), /Button: missing size/);
});
test('functional pseudo map keys are outside the supported contract', () => {
  const extra = "$skins: (vars: (primary: (shared: (default: (color: red)), 'nth-child(2)': (default: (color: blue)))));";
  assert.throws(() => compile(block(call()), '', extra), /BEMinator:/);
});
test('implementation uses one element wrapper, public entrypoint, no reconstruction', () => {
  const source = readFileSync(new URL('../../components/_button.scss', import.meta.url), 'utf8');
  assert.equal((source.match(/@include bem\.element\(/g) ?? []).length, 1);
  assert.deepEqual([...source.matchAll(/@use ['"]([^'"]+)/g)].map(m => m[1]), ['sass:map', 'sass:string', '../src/index']);
  assert.doesNotMatch(source, /@at-root|!global|__|&|trim-parent|src\/core/);
});

test('content observes Button subject and restores it after generated qualifiers', () => {
  const content = "@include bem.modifier('local') { color: blue; } outline: none;";
  const body = block(call('', content));
  const expected = block(wrap('element', "'btn-play'", `height: var(--btn-size-medium-height) !important; color: var(--btn-primary-shared-default-color) !important; ${content}`));
  assert.equal(compile(body, '', minimal), compile(expected, '', minimal));
});

test('optional module exposes only btn and preserves every signature parameter', () => {
  const source = readFileSync(new URL('../../components/_button.scss', import.meta.url), 'utf8');
  assert.equal(source.match(/@mixin btn\(([^)]*)\)/)[1],
    "$name, $theme-settings, $shared-settings, $size: 'medium', $category: 'primary', $icon: 'true', $icon-align: 'left'");
  assert.equal(compileScss(`@use '../../components/button'; @use 'sass:meta'; @use 'sass:map';
    @if map.keys(meta.module-mixins('button')) != ('btn',) { @error 'Unexpected mixins'; }
    @if meta.module-functions('button') != () or meta.module-variables('button') != () { @error 'Unexpected exports'; }
  `, { url: new URL('surface.scss', import.meta.url) }), '');
  const positional = call(", 'medium', 'primary', 'true', 'right'");
  const named = "@include button.btn($icon-align: 'right', $category: 'primary', $name: 'play', $icon: 'true', $size: 'medium', $shared-settings: $sizes, $theme-settings: $skins) { margin-bottom: 10px; }";
  assert.equal(compile(block(positional), '', iconMaps), compile(block(named), '', iconMaps));
  assert.throws(() => compile(block("@include button.btn('play', $skins, $sizes, 'medium', 'primary', 'true', 'left', 'extra');")), /Only 7 arguments allowed/);
});

test('separate element is a terminal functional-selector escape hatch', () => {
  const override = wrap('element', "'btn-play'", '&:nth-child(2) { color: purple !important; }');
  const actual = compile(block(call() + override));
  assert.ok(actual.endsWith('.card__btn-play:nth-child(2) {\n  color: purple !important;\n}'));
  assert.ok(actual.startsWith(compile(block(call()))));
});

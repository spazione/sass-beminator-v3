import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { compileString, initCompiler } from 'sass';
import { compileScss } from '../../helpers/compile-scss.js';

const url = new URL('has-fixture.scss', import.meta.url);
const call = (name, args, body = 'color: red;') => `@include bem.${name}(${args}) { ${body} }`;
const block = body => call('block', "'card'", body);
const element = body => block(call('element', "'item'", body));
const has = (body = 'color: red;', args = "element, 'details'") => call('has', args, body);
const compile = (body, config = '') => compileScss(`@use '../../src' as bem ${config}; ${body}`, { url });
const css = (selector, color = 'red') => `${selector} {\n  color: ${color};\n}`;
const q = value => `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;

test('real game-card preserves root layer and surrounding declarations', () => {
  assert.equal(compile(`@include bem.block('game-card', $layer: 'molecules') {
    display: flex; flex-direction: column; height: 100%;
    @include bem.element('thumbnail') {
      border-radius: 12px; overflow: hidden; position: relative;
      @include bem.has(element, 'details', $relation: '+') {
        border-bottom-left-radius: 0; border-bottom-right-radius: 0;
      }
    }
  }`), `@layer molecules {
  .game-card {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .game-card__thumbnail {
    border-radius: 12px;
    overflow: hidden;
    position: relative;
  }
  .game-card__thumbnail:has(+ .game-card__details) {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }
}`);
});

const parents = [
  ['block', block, '.card'],
  ['element', element, '.card__item'],
  ['block modifier', body => block(call('modifier', "'active'", body)), '.card--active'],
  ['element modifiers', body => element(call('modifier', "'active', 'large'", body)), '.card__item--active.card__item--large'],
  ['qualified block', body => block(call('selector', "':hover'", body)), '.card:hover'],
  ['qualified element', body => element(call('selector', "':hover'", body)), '.card__item:hover'],
  ['qualified modifier', body => element(call('modifier', "'active'", call('selector', "':focus'", body))), '.card__item--active:focus'],
];
for (const [label, wrap, subject] of parents) {
  test(`${label}: same-owner element for every relation, independent of subject origin`, () => {
    for (const relation of [null, '>', '+', '~']) {
      assert.equal(compile(wrap(has('color: red;', `element, 'details', $relation: ${relation === null ? 'null' : q(relation)}`))),
        css(`${subject}:has(${relation === null ? '' : `${relation} `}.card__details)`));
    }
  });
}
test('both qualification orders preserve call order', () => {
  assert.equal(compile(element(has(call('selector', "':hover'"), "element, 'details', $relation: '+'"))), css('.card__item:has(+ .card__details):hover'));
  assert.equal(compile(element(call('selector', "':hover'", has('color: red;', "element, 'details', $relation: '+'")))), css('.card__item:hover:has(+ .card__details)'));
});
test('qualified element/block re-entry promotes complete outer scope once', () => {
  assert.equal(compile(block(has(call('element', "'title'")))), css('.card:has(.card__details) .card__title'));
  assert.equal(compile(call('block', "'page'", block(has(call('element', "'title'"))))), css('.page .card:has(.card__details) .card__title'));
  assert.equal(compile(block(has(call('block', "'icon'", call('element', "'glyph'"))))), css('.card:has(.card__details) .icon__glyph'));
  assert.equal(compile(block(has(call('block', "'icon'", has())))), css('.card:has(.card__details) .icon:has(.icon__details)'));
});
test('extend element preserves target ownership and ancestry', () => {
  const extendElement = body => block(call('extend', "'icon', 'active'", call('element', "'label'", body)));
  assert.equal(compile(extendElement(has())), css('.card .icon--active .icon__label:has(.icon__details)'));
  assert.equal(compile(extendElement(has(call('element', "'glyph'")))), css('.card .icon--active .icon__label:has(.icon__details) .icon__glyph'));
  for (const body of [call('block', "'bad'"), call('element', "'glyph'", call('selector', "':hover'", call('block', "'bad'")))]) {
    assert.throws(() => compile(extendElement(has(body))), /block is forbidden beneath extend/);
  }
});
test('custom separators affect subject and owner-derived target', () => {
  const config = "with ($element-separator: '-', $modifier-separator: '_')";
  assert.equal(compile(call('block', "'game-card'", call('element', "'thumbnail'", has('color: red;', "element, 'details', $relation: '+'"))), config), css('.game-card-thumbnail:has(+ .game-card-details)'));
  assert.equal(compile(element(call('modifier', "'active'", has())), config), css('.card-item_active:has(.card-details)'));
});
test('signature accepts named arguments and one evaluated BEM name', () => {
  assert.equal(compile(block(has('color: red;', "$type: element, $name: 'details'"))), css('.card:has(.card__details)'));
  assert.equal(compile(block(has('color: red;', "'element', 'details', null"))), css('.card:has(.card__details)'));
  assert.equal(compile(`$name: 'Detail'; ${block(has('color: red;', 'element, "#{$name}_2-x"'))}`), css('.card:has(.card__Detail_2-x)'));
  assert.equal(compile(block(has('color: red;', String.raw`element, '\64 etails'`))), css('.card:has(.card__details)'));
  for (const args of ['', 'element', "element, 'details', '+', 'extra'", "element, 'details', $modifier: 'active'"]) {
    assert.throws(() => compile(block(has('', args))), /Missing argument|Only 3 arguments allowed|No parameter named \$modifier/);
  }
});
test('invalid target kinds, names and relations cannot open deferred features', () => {
  for (const type of ['block', 'modifier', 'foo', 'null', '42', '()', '(element, element)', '(type: element)']) {
    assert.throws(() => compile(block(has('', `${type}, 'details'`))), /has supports only element targets/);
  }
  for (const name of ["''", 'null', '42', 'true', '()', "('a', 'b')", '(key: value)', "'.details'", "'1details'", "'é'", "'a b'", "'x:has(.y)'", "'x,y'", "'a>b'"]) {
    assert.throws(() => compile(block(has('', `element, ${name}`))), /BEMinator: (expected a nonempty BEM name string|a BEM name)/);
  }
  for (const relation of ["'||'", "','", "' '", "''", "'descendant'", "'++'", '42', 'false', '()', "('>', '+')", '(a: b)']) {
    assert.throws(() => compile(block(has('', `element, 'details', $relation: ${relation}`))), /has relation must be/);
  }
});
test('root, direct extend and pending relation remain unavailable', () => {
  assert.throws(() => compile(has()), /invalid nesting: has requires a BEM subject/);
  assert.throws(() => compile(block(call('extend', "'icon', 'active'", has()))), /extend -> qualified is unsupported/);
  for (const relation of ['>', '+', '~']) {
    assert.throws(() => compile(element(call('selector', q(relation), has()))), /pending-relation -> qualified is unsupported/);
    assert.equal(compile(element(call('selector', q(relation), call('element', "'child'", has())))), css(`.card__item ${relation} .card__child:has(.card__details)`));
  }
});
test('has retains qualified child restrictions and root-only layer policy', () => {
  for (const [body, kind] of [[call('modifier', "'active'"), 'modifier'], [call('selector', "'+'"), 'pending-relation'], [call('extend', "'icon', 'active'"), 'extend']]) {
    assert.throws(() => compile(block(has(body))), new RegExp(`qualified -> ${kind} is unsupported`));
  }
  assert.throws(() => compile(block(has(call('block', "'icon', $layer: 'atoms'")))), /explicit layer selection is supported only on the root/);
  assert.equal(compile(call('block', "'card', $layer: 'atoms'", has(call('block', "'icon'")))), '@layer atoms {\n  .card:has(.card__details) .icon {\n    color: red;\n  }\n}');
});
test('pseudo-element anchor guard uses native tokens, including normalized escapes and legacy forms', () => {
  for (const qualifier of ['::before', '::after', '::marker', ':before', ':after', ':first-line', ':first-letter', ':BEFORE', '[disabled]:hover::before', ':before:hover', String.raw`:b\65 fore`, String.raw`:\62 efore`, String.raw`::b\65 fore`]) {
    assert.throws(() => compile(block(call('selector', q(qualifier), has()))), /has cannot qualify a pseudo-element subject/);
  }
  // An attribute containing pseudo-like text is not a pseudo-element.
  assert.equal(compile(block(call('selector', q('[data-note="::before"]:hover'), has()))), css('.card[data-note="::before"]:hover:has(.card__details)'));
  assert.equal(compile(block(has(call('selector', "'::before'")))), css('.card:has(.card__details)::before'));
});
test('selector parser still rejects all raw functional pseudo strings', () => {
  for (const value of [':has(.card__details)', ':not(.x)', ':is(.x)', ':where(.x)', ':hover:has(.x)', String.raw`:h\61 s(.x)`]) {
    assert.throws(() => compile(block(call('selector', q(value)))), /functional pseudo selectors are unsupported/);
  }
});
test('empty branches, sibling calls, qualified nesting and repeated roots restore scope', () => {
  for (const body of ['', call('element', "'empty'", ''), call('selector', "':hover'", ''), call('block', "'empty'", '')]) {
    assert.equal(compile(block(has(body))), '');
  }
  assert.equal(compile(block(has(call('element', "'title'")) + call('element', "'body'", 'color: blue;'))),
    `${css('.card:has(.card__details) .card__title')}\n\n${css('.card__body', 'blue')}`);
  assert.equal(compile(block(has(call('selector', "':hover'", call('element', "'title'"))) + has('color: blue;', "element, 'summary', $relation: '+'"))
    + call('block', "'other'", has()) + block(has())), [
    css('.card:has(.card__details):hover .card__title'), css('.card:has(+ .card__summary)', 'blue'),
    css('.other:has(.other__details)'), css('.card:has(.card__details)'),
  ].join('\n\n'));
});
test('frame equality and complete stack restoration, including extend ancestry', () => {
  const production = readFileSync(new URL('../../src/core/_bem.scss', import.meta.url), 'utf8');
  const probes = `
    @mixin probe-restore { $before: $-context-stack; @content;
      @if $-context-stack != $before { @error 'Stack did not restore'; }
    }
    @mixin probe-frame($owner, $subject, $scope: (), $under: false) {
      $expected: (owner: s.parse($owner), subject: s.parse($subject), scope: $scope, kind: qualified, under-extend: $under);
      @if -current-context() != $expected { @error 'Unexpected frame'; }
    }
  `;
  const check = (owner, subject, scope = '()', under = false) => `@include bem.probe-frame('${owner}', '${subject}', ${scope}, ${under});`;
  const body = `@include bem.probe-restore { ${block(`@include bem.probe-restore {
    ${has(check('.card', '.card:has(.card__details)') + `@include bem.probe-restore { ${call('selector', "':hover'", call('element', "'empty'", ''))} }`)}
    ${call('extend', "'icon', 'active'", call('element', "'label'", `@include bem.probe-restore { ${has(check('.icon', '.icon__label:has(.icon__details)', "(s.parse('.card .icon--active'),)", true))} }`))}
  }`)} }`;
  assert.equal(compileString(`@use 'probe:core' as bem; @use 'sass:selector' as s; ${body}`, {
    importers: [{ canonicalize: u => u === 'probe:core' ? new URL(u) : null,
      load: () => ({ contents: "@use 'sass:selector' as s;\n" + production + probes, syntax: 'scss' }) }],
  }).css, '');
});
test('reused compiler has no context leak after an aborted has body', () => {
  const compiler = initCompiler();
  const run = body => compiler.compileString(`@use '../../src' as bem; ${body}`, { url }).css;
  try {
    assert.equal(run(block(has())), css('.card:has(.card__details)'));
    assert.throws(() => run(block(has("@error 'caller abort';"))), /caller abort/);
    assert.equal(run(block(has())), css('.card:has(.card__details)'));
  } finally { compiler.dispose(); }
});

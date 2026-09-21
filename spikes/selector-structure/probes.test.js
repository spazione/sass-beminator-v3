// New experimental suite, deliberately separate from existing production/spikes.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { compileScss } from '../../helpers/compile-scss.js';
import { projectRoot } from '../../helpers/project-paths.js';
const url = new URL('fixture.scss', import.meta.url);
const output = join(projectRoot, 'tmp/selector-structure');
mkdirSync(output, { recursive: true });
const quote = (s) => `'${s.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
function compile(body) {
  return compileScss(`@use 'proof' as p; @include p.assert-depth(0); ${body} @include p.assert-depth(0);`, { url });
}
function rules(css) {
  const regex = /([^{}]+)\{\s*content: "([^"\n]*)";\s*\}/g;
  const result = [...css.matchAll(regex)].map((m) => [m[1].trim(), m[2]]);
  assert.equal(css.replace(regex, '').trim(), '');
  return result;
}
const environments = [
  ['block', (s) => `@include p.proof-block('button') { ${s} }`, '.button'],
  ['element', (s) => `@include p.proof-block('card') { @include p.proof-element('button') { ${s} } }`, '.card__button'],
  ['modifier', (s) => `@include p.proof-block('card') { @include p.proof-element('button') { @include p.proof-modifier('active') { ${s} } } }`, '.card__button--active'],
  ['extend-element', (s) => `@include p.proof-block('card') { @include p.proof-extend('icon', 'large') { @include p.proof-element('label') { ${s} } } }`, '.card .icon--large .icon__label'],
];
const qualifiers = [':hover', ':focus', ':focus-visible', ':active', ':disabled', ':before', ':after', '::before', '::after', '[disabled]', "[data-state='open']"];
for (const [name, wrap, subject] of environments) {
  test(`all eleven qualifiers under ${name} preserve naming and scope`, () => {
    const css = compile(wrap(qualifiers.map((q) => `@include p.proof-selector(${quote(q)}) { content: '${q.startsWith('[') ? 'attribute' : q}'; }`).join('\n')));
    assert.deepEqual(rules(css), qualifiers.map((q) => [subject + (q === "[data-state='open']" ? '[data-state=open]' : q), q.startsWith('[') ? 'attribute' : q]));
    writeFileSync(join(output, `${name}.css`), css);
  });
}
for (const relation of ['+', '>', '~']) {
  test(`${relation} uses a shared pending frame and restores siblings`, () => {
    for (const nested of [false, true]) {
      const body = `@include p.proof-block('card') {
        @include p.proof-element('item') {
          @include p.proof-selector('${relation}') {
            @include p.assert-depth(${nested ? 4 : 3});
            @include p.proof-element('other') { content: 'other'; }
            @include p.proof-element('next') { @include p.proof-modifier('active') { content: 'modified'; } }
          }
          @include p.assert-depth(${nested ? 3 : 2});
          @include p.proof-modifier('after') { content: 'after'; }
        }
        @include p.proof-element('last') { content: 'last'; }
      }`;
      const css = compile(nested ? `@include p.proof-block('page') { ${body} }` : body);
      const prefix = nested ? '.page ' : '';
      assert.deepEqual(rules(css), [
        [prefix + `.card__item ${relation} .card__other`, 'other'],
        [prefix + `.card__item ${relation} .card__next--active`, 'modified'],
        [prefix + '.card__item--after', 'after'], [prefix + '.card__last', 'last'],
      ]);
    }
  });
  test(`${relation} has no incomplete CSS and rejects direct declarations`, () => {
    const wrap = (body) => `@include p.proof-block('card') { @include p.proof-element('item') { @include p.proof-selector('${relation}') { ${body} } } }`;
    assert.equal(compile(wrap('')), '');
    assert.throws(() => compile(wrap('color: red;')), /Declarations may only be used within style rules/);
  });
}
test('qualifier chains compose left to right but restore their parent after each call', () => {
  assert.deepEqual(rules(compile(`@include p.proof-block('card') {
    @include p.proof-selector(':hover') {
      @include p.proof-selector(':before') { content: 'chain'; }
      @include p.proof-selector('[disabled]') { content: 'attribute'; }
    }
    @include p.proof-element('after') { content: 'after'; }
  }`)), [['.card:hover:before', 'chain'], ['.card:hover[disabled]', 'attribute'], ['.card__after', 'after']]);
});
test('single and double modified subjects are qualified without duplicating scope', () => {
  assert.deepEqual(rules(compile(`@include p.proof-block('page') { @include p.proof-block('card') {
    @include p.proof-modifier('a', 'b') { @include p.proof-selector(':hover') { content: 'hover'; } }
  } }`)), [['.page .card--a.card--b:hover', 'hover']]);
});
test('extend ancestry survives both generic families and owner survives relation resolution', () => {
  const wrap = (s) => `@include p.proof-block('card') { @include p.proof-extend('icon', 'large') { @include p.proof-element('label') { ${s} } } }`;
  for (const token of [':hover', '[disabled]', '+', '>', '~']) {
    assert.throws(() => compile(wrap(`@include p.proof-selector('${token}') { @include p.proof-block('bad') {} }`)), /PROBE block under extend/);
  }
  for (const relation of ['+', '>', '~']) {
    assert.deepEqual(rules(compile(wrap(`@include p.proof-selector('${relation}') { @include p.proof-element('other') { content: 'owner'; } }`))),
      [[`.card .icon--large .icon__label ${relation} .icon__other`, 'owner']]);
  }
});
test('qualifier and relation siblings in representative orders restore exact context', () => {
  const calls = [
    "@include p.proof-modifier('active') { content: 'modifier'; }",
    "@include p.proof-selector(':hover') { content: 'hover'; }",
    "@include p.proof-selector('[disabled]') { content: 'attribute'; }",
    "@include p.proof-selector('>') { @include p.proof-element('child') { content: 'child'; } }",
    "@include p.proof-selector('~') { @include p.proof-element('other') { content: 'other'; } }",
  ];
  const expected = [['.card__item--active', 'modifier'], ['.card__item:hover', 'hover'], ['.card__item[disabled]', 'attribute'], ['.card__item > .card__child', 'child'], ['.card__item ~ .card__other', 'other']];
  for (const order of [[0, 1, 2, 3, 4], [4, 2, 0, 3, 1], [3, 4, 1, 2, 0]]) {
    const css = compile(`@include p.proof-block('card') { @include p.proof-element('item') {
      ${order.map((i) => `${calls[i]} @include p.proof-modifier('after') { content: 'after'; }`).join('\n')}
    } } @include p.proof-block('clean') { content: 'root'; }`);
    assert.deepEqual(rules(css), [...order.flatMap((i) => [expected[i], ['.card__item--after', 'after']]), ['.clean', 'root']]);
  }
});
test('boundary rejects arbitrary selectors, mixed compounds, lists, functions, and nonstrings', () => {
  for (const token of ['.foo', '.foo .bar', '.theme &', '&:hover', ':hover:focus', ':hover, :focus', 'button:hover', '#id', '*', '%placeholder',
    ':has(.foo)', ':not(.foo)', ':is(.foo)', ':where(.foo)', ':nth-child(2n + 1)', String.raw`:h\61 s(.foo)`, ':hover > .child', '[broken', '||']) {
    assert.throws(() => compile(`@include p.proof-block('card') { @include p.proof-selector(${quote(token)}) { content: 'excluded'; } }`));
  }
  for (const value of ['null', '17', "(':hover', ':focus')"]) {
    assert.throws(() => compile(`@include p.proof-block('card') { @include p.proof-selector(${value}) {} }`), /PROBE expected selector string/);
  }
});
test('Sass parser handles delimiters in attributes; minimal gate is deliberately not browser validation', () => {
  assert.deepEqual(rules(compile(`@include p.proof-block('card') {
    @include p.proof-selector(${quote("[data-note=':has(.x), > (']")}) { content: 'attribute'; }
    @include p.proof-selector(':made-up') { content: 'unknown'; }
    @include p.proof-selector(${quote(String.raw`:h\6f ver`)}) { content: 'escaped'; }
  }`)), [['.card[data-note=":has(.x), > ("]', 'attribute'], ['.card:made-up', 'unknown'], ['.card:hover', 'escaped']]);
});

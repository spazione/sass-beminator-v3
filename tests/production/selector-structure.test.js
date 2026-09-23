import assert from 'node:assert/strict';
import test from 'node:test';
import { compileScss } from '../../helpers/compile-scss.js';
const url = new URL('structure-fixture.scss', import.meta.url);
const quote = (s) => `'${s.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
const block = (body) => `@include bem.block('card') { ${body} }`;
const element = (body) => block(`@include bem.element('item') { ${body} }`);
function compile(body) { return compileScss(`@use '../../src' as bem; ${body}`, { url }); }
function rules(css) {
  const regex = /([^{}]+)\{\s*content: "([^"\n]*)";\s*\}/g;
  const result = [...css.matchAll(regex)].map((m) => [m[1].trim(), m[2]]);
  assert.equal(css.replace(regex, '').trim(), '', 'Unexpected CSS beyond identifying rules');
  return result;
}
const qualifiers = [
  ':hover', ':focus', ':focus-visible', ':active', ':disabled', ':before', ':after', '::before', '::after',
  '[disabled]', ':hover:focus', ':focus-visible:hover', ':placeholder:hover', ':focus::before', '[disabled]:hover',
  ['[data-state="open"]:focus', '[data-state=open]:focus'],
  [':hover[aria-expanded="true"]', ':hover[aria-expanded=true]'],
  [':focus[aria-expanded="true"]', ':focus[aria-expanded=true]'],
  ['[data-state="open"]', '[data-state=open]'],
].map((q) => Array.isArray(q) ? q : [q, q]);
const contexts = [
  ['block', (body) => `@include bem.block('button') { ${body} }`, '.button'],
  ['element', (body) => block(`@include bem.element('button') { ${body} }`), '.card__button'],
  ['block modifier', (body) => block(`@include bem.modifier('active') { ${body} }`), '.card--active'],
  ['element modifier', (body) => block(`@include bem.element('button') { @include bem.modifier('active') { ${body} } }`), '.card__button--active'],
  ['extend element', (body) => block(`@include bem.extend('icon', 'large') { @include bem.element('label') { ${body} } }`), '.card .icon--large .icon__label'],
  ['scoped double modifier', (body) => `@include bem.block('page') { ${block(`@include bem.element('button') { @include bem.modifier('a', 'b') { ${body} } }`)} }`, '.page .card__button--a.card__button--b'],
];
for (const [label, wrap, subject] of contexts) {
  test(`single and compound qualifiers under ${label} change only the subject`, () => {
    const body = qualifiers.map(([input], i) => `@include bem.selector(${quote(input)}) { content: 'q${i}'; }`).join('\n');
    assert.deepEqual(rules(compile(wrap(body))), qualifiers.map(([, normalized], i) => [subject + normalized, `q${i}`]));
  });
}
test('syntax-family validation accepts unknown names and ordering without a browser-semantics registry', () => {
  assert.deepEqual(rules(compile(block(`
    @include bem.selector(':made-up') { content: 'unknown'; }
    @include bem.selector('::before::after') { content: 'ordering'; }
    @include bem.selector(${quote(String.raw`:h\6f ver:focus`)}) { content: 'normalized'; }
  `))), [['.card:made-up', 'unknown'], ['.card::before::after', 'ordering'], ['.card:hover:focus', 'normalized']]);
});
test('attribute punctuation remains literal even in a mixed qualifier compound', () => {
  assert.deepEqual(rules(compile(block(`@include bem.selector(${quote('[data-note=":has(.x), > ( &"]:hover')}) { content: 'literal'; }`))),
    [['.card[data-note=":has(.x), > ( &"]:hover', 'literal']]);
});
for (const input of ['.foo', '#foo', 'button', '*', '%placeholder', '.foo:hover', 'button:hover', '#foo:hover', ':hover.foo']) {
  test(`different target family is excluded: ${input}`, () => {
    assert.throws(() => compile(block(`@include bem.selector(${quote(input)}) {}`)), /selector qualifiers must be non-functional pseudos or attributes/);
  });
}
for (const input of ['.foo .bar', ':hover .foo', ':hover, :focus', ':hover > .child']) {
  test(`compound shape excludes list/complex input: ${input}`, () => {
    assert.throws(() => compile(block(`@include bem.selector(${quote(input)}) {}`)), /one qualified compound, not a selector list or complex selector/);
  });
}
for (const input of ['.theme &', '&:hover']) {
  test(`parent reference remains excluded: ${input}`, () => {
    assert.throws(() => compile(block(`@include bem.selector(${quote(input)}) {}`)), /Parent selectors aren't allowed/);
  });
}
test('nonstring selector arguments fail before parsing', () => {
  for (const value of ['null', '12', "(':hover', ':focus')", '(a: b)']) {
    assert.throws(() => compile(block(`@include bem.selector(${value}) {}`)), /BEMinator: selector requires a string/);
  }
});
test('malformed, empty, and unsupported relation input does not emit CSS', () => {
  for (const input of ['', ' ', '||', '[broken', '+ >']) {
    assert.throws(() => compile(block(`@include bem.selector(${quote(input)}) {}`)), /expected|Expected|one qualified compound/);
  }
});
test('functional pseudos are deferred even when escaped or mixed with attributes/pseudos', () => {
  for (const input of [':has(.foo)', ':not(.foo)', ':is(.foo, .bar)', ':where(.foo)', ':nth-child(2n)',
    ':hover:has(.foo)', '[disabled]:not(.foo)', String.raw`:hover:h\61 s(.foo)`]) {
    assert.throws(() => compile(block(`@include bem.selector(${quote(input)}) {}`)), /functional pseudo selectors are unsupported in the current BEMinator API/);
  }
});
test('one compound call and nested qualifiers qualify the same subject', () => {
  assert.deepEqual(rules(compile(block("@include bem.selector(':hover:focus') { content: 'compound'; }"))), [['.card:hover:focus', 'compound']]);
  assert.deepEqual(rules(compile(block("@include bem.selector(':hover') { @include bem.selector(':focus') { content: 'nested'; } }"))), [['.card:hover:focus', 'nested']]);
});
test('modifier, extend and pending children of qualified compounds remain deferred', () => {
  for (const child of ["@include bem.modifier('active') {}",
    "@include bem.extend('icon', 'active') {}", "@include bem.selector('>') {}"]) {
    assert.throws(() => compile(block(`@include bem.selector('[disabled]:hover') { ${child} }`)), /nesting qualified -> [\w-]+ is unsupported in the current BEMinator API/);
  }
});
test('extend ancestry overrides qualified and pending local restrictions', () => {
  for (const form of ['[disabled]:hover', ':focus::before', '+', '>', '~']) {
    assert.throws(() => compile(block(`@include bem.extend('icon', 'large') { @include bem.element('label') {
      @include bem.selector(${quote(form)}) { @include bem.block('bad') {} }
    } }`)), /block is forbidden beneath extend/);
  }
});
for (const relation of ['+', '>', '~']) {
  test(`${relation} preserves scoped and extend ownership, RHS modifiers, and sibling restoration`, () => {
    const branches = `@include bem.selector('${relation}') {
      @include bem.element('other') { content: 'other'; @include bem.modifier('active') { content: 'single'; }
        @include bem.modifier('a', 'b') { content: 'double'; } }
      @include bem.element('next') { content: 'next'; }
    }
    @include bem.selector('${relation}') { @include bem.element('repeat') { content: 'repeat'; } }
    @include bem.modifier('after') { content: 'after'; }`;
    for (const [wrap, scope, owner] of [
      [element, '', '.card'],
      [(s) => `@include bem.block('page') { ${element(s)} }`, '.page ', '.card'],
      [(s) => block(`@include bem.extend('icon', 'large') { @include bem.element('item') { ${s} } }`), '.card .icon--large ', '.icon'],
    ]) {
      const left = `${scope}${owner}__item ${relation} `;
      assert.deepEqual(rules(compile(wrap(branches))), [
        [left + `${owner}__other`, 'other'], [left + `${owner}__other--active`, 'single'],
        [left + `${owner}__other--a${owner}__other--b`, 'double'], [left + `${owner}__next`, 'next'],
        [left + `${owner}__repeat`, 'repeat'], [`${scope}${owner}__item--after`, 'after'],
      ]);
    }
  });
  test(`${relation} empty branches emit nothing; direct declarations fail before and after RHS children`, () => {
    assert.equal(compile(element(`@include bem.selector('${relation}') {}`)), '');
    assert.equal(compile(element(`@include bem.selector('${relation}') { @include bem.element('empty') {} }`)), '');
    for (const body of ['color: red;', '--color: red;', "@include bem.element('other') { content: 'other'; } color: red;"]) {
      assert.throws(() => compile(element(`@include bem.selector('${relation}') { ${body} }`)), /Declarations may only be used within style rules/);
    }
  });
  test(`${relation} pending frame accepts only an element child`, () => {
    for (const child of ["@include bem.block('bad') {}", "@include bem.modifier('bad') {}", "@include bem.extend('icon', 'bad') {}",
      "@include bem.selector(':hover') {}", "@include bem.selector('>') {}"]) {
      assert.throws(() => compile(element(`@include bem.selector('${relation}') { ${child} }`)), /nesting pending-relation -> [\w-]+ is unsupported in the current BEMinator API/);
    }
  });
}
test('compound/pending sibling sequences and repeated roots retain original contexts', () => {
  const children = [
    "@include bem.selector('[disabled]:hover') { content: 'compound'; }",
    "@include bem.modifier('active') { content: 'modifier'; }",
    "@include bem.selector('>') { @include bem.element('child') { content: 'child'; } }",
    "@include bem.selector('~') { @include bem.element('other') { content: 'other'; } }",
  ];
  const expected = [['.card__item[disabled]:hover', 'compound'], ['.card__item--active', 'modifier'], ['.card__item > .card__child', 'child'], ['.card__item ~ .card__other', 'other']];
  for (const order of [[0, 1, 2, 3], [3, 2, 1, 0], [1, 0, 3, 2]]) {
    const body = order.map((i) => `${children[i]} @include bem.selector(':focus::before') { content: 'after'; }`).join('\n');
    assert.deepEqual(rules(compile(element(body) + block("@include bem.element('clean') { content: 'clean'; }"))),
      [...order.flatMap((i) => [expected[i], ['.card__item:focus::before', 'after']]), ['.card__clean', 'clean']]);
  }
});

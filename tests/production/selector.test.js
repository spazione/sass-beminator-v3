import assert from 'node:assert/strict';
import test from 'node:test';
import { initCompiler } from 'sass';
import { compileScss } from '../../helpers/compile-scss.js';

const url = new URL('selector-fixture.scss', import.meta.url);
const prelude = "@use '../../src' as bem;";
const wrap = (body) => `@include bem.block('card') { @include bem.element('item') { ${body} } }`;
function compile(body) {
  return compileScss(`${prelude}\n${body}`, { url });
}
function rules(css) {
  const pattern = /([^{}]+)\{\s*content: "([^"\n]*)";\s*\}/g;
  const result = [...css.matchAll(pattern)].map((match) => [match[1].trim(), match[2]]);
  assert.equal(css.replace(pattern, '').trim(), '', 'Unexpected CSS beyond identifying rules');
  return result;
}

test(':before appends exactly the approved spelling and permits declarations', () => {
  assert.deepEqual(rules(compile(`@include bem.block('card') {
    @include bem.element('title') { @include bem.selector(':before') { content: 'before'; } }
  }`)), [['.card__title:before', 'before']]);
});
test('nested block :before retains the inner owner and enclosing scope', () => {
  assert.deepEqual(rules(compile(`@include bem.block('page') {
    ${wrap("@include bem.selector(':before') { content: 'before'; }")}
  }`)), [['.page .card__item:before', 'before']]);
});
test('repeated :before calls do not accumulate suffixes', () => {
  assert.deepEqual(rules(compile(wrap(`
    @include bem.selector(':before') { content: 'first'; }
    @include bem.selector(":before") { content: 'second'; }
  `))), [['.card__item:before', 'first'], ['.card__item:before', 'second']]);
});
test('pending + resolves through an element with the current owner', () => {
  assert.deepEqual(rules(compile(wrap(`@include bem.selector('+') {
    @include bem.element('other') { content: 'other'; }
  }`))), [['.card__item + .card__other', 'other']]);
});
test('nested block adjacent relation retains card ownership without duplicating scope', () => {
  assert.deepEqual(rules(compile(`@include bem.block('page') {
    ${wrap("@include bem.selector('+') { @include bem.element('other') { content: 'other'; } }")}
  }`)), [['.page .card__item + .card__other', 'other']]);
});
test('right-hand element supports single and double modifiers on its own subject', () => {
  assert.deepEqual(rules(compile(wrap(`@include bem.selector('+') {
    @include bem.element('other') {
      @include bem.modifier('active') { content: 'single'; }
      @include bem.modifier('a', 'b') { content: 'double'; }
    }
  }`))), [
    ['.card__item + .card__other--active', 'single'],
    ['.card__item + .card__other--a.card__other--b', 'double'],
  ]);
});
test('repeated adjacent branches and sibling right-hand elements restore the pending left context', () => {
  assert.deepEqual(rules(compile(wrap(`
    @include bem.selector('+') {
      @include bem.element('first') { content: 'first'; }
      @include bem.element('second') { content: 'second'; }
    }
    @include bem.selector('+') {
      @include bem.element('third') { content: 'third'; }
    }
    @include bem.modifier('after') { content: 'after'; }
  `))), [
    ['.card__item + .card__first', 'first'], ['.card__item + .card__second', 'second'],
    ['.card__item + .card__third', 'third'], ['.card__item--after', 'after'],
  ]);
});
test('representative selector/modifier sibling orders preserve the original element', () => {
  const children = [
    "@include bem.modifier('active') { content: 'modifier'; }",
    "@include bem.selector(':before') { content: 'before'; }",
    "@include bem.selector('+') { @include bem.element('other') { content: 'other'; } }",
  ];
  const expected = [['.card__item--active', 'modifier'], ['.card__item:before', 'before'], ['.card__item + .card__other', 'other']];
  for (const order of [[0, 1, 2], [2, 0, 1], [1, 2, 0]]) {
    const body = order.map((i) => `${children[i]}
      @include bem.modifier('disabled') { content: 'after'; }`).join('\n');
    assert.deepEqual(rules(compile(wrap(body))), order.flatMap((i) => [expected[i], ['.card__item--disabled', 'after']]));
  }
});
test('selector completion restores enclosing block ownership and clean independent roots', () => {
  assert.deepEqual(rules(compile(`@include bem.block('page') {
    ${wrap(`@include bem.selector(':before') { content: 'before'; }
      @include bem.selector('+') { @include bem.element('other') { content: 'other'; } }`)}
    @include bem.element('after') { content: 'page'; }
  }
  @include bem.block('card') { @include bem.element('after') { content: 'root'; } }`)), [
    ['.page .card__item:before', 'before'], ['.page .card__item + .card__other', 'other'],
    ['.page__after', 'page'], ['.card__after', 'root'],
  ]);
});
test('empty pending + and empty child produce no incomplete combinator CSS', () => {
  assert.equal(compile(wrap("@include bem.selector('+') {}")), '');
  assert.deepEqual(rules(compile(wrap(`
    @include bem.selector('+') { @include bem.element('empty') {} }
    @include bem.modifier('after') { content: 'after'; }
  `))), [['.card__item--after', 'after']]);
});
test('functional selector values remain deferred, including mixed compounds', () => {
  for (const value of ["':has(.card__featured)'", "':not(.card__featured)'",
    "':is(.card__featured)'", "':where(.card__featured)'", "':nth-child(2n)'",
    "':hover:has(.foo)'", "'[disabled]:not(.foo)'"]) {
    assert.throws(() => compile(wrap(`@include bem.selector(${value}) {}`)),
      /BEMinator: functional pseudo selectors are deferred/);
  }
});
test('selector requires exactly one argument', () => {
  for (const args of ['', "':before', '+'"]) {
    assert.throws(() => compile(wrap(`@include bem.selector(${args}) {}`)), /Missing argument|Only 1 argument allowed/);
  }
});
test('qualified selectors reject root parent', () => {
  assert.throws(() => compile("@include bem.selector(':before') {}"),
    /nesting root -> qualified is deferred/);
});
test('pending relations reject root, block, and modifier parents', () => {
  for (const form of ['+', '>', '~']) {
    const call = `@include bem.selector('${form}') {}`;
    for (const [source, parent] of [
      [call, 'root'], [`@include bem.block('card') { ${call} }`, 'block'],
      [wrap(`@include bem.modifier('active') { ${call} }`), 'modifier'],
    ]) {
      assert.throws(() => compile(source), new RegExp(`nesting ${parent} -> pending-relation is deferred`));
    }
  }
});
test(':before has no approved core children; + permits only element children', () => {
  const children = [
    ['block', "'other'"], ['element', "'other'"], ['modifier', "'active'"],
    ['selector', "':before'"], ['selector', "'+'"], ['extend', "'icon', 'active'"],
  ];
  for (const form of [':before', '+']) {
    for (const [mixin, args] of children) {
      if (form === '+' && mixin === 'element') continue;
      assert.throws(() => compile(wrap(`@include bem.selector('${form}') {
        @include bem.${mixin}(${args}) {}
      }`)), /nesting (qualified|pending-relation) -> [\w-]+ is deferred; not implemented in this slice/);
    }
  }
});
test('completing selector calls does not weaken direct element/modifier rejection', () => {
  assert.throws(() => compile(wrap(`@include bem.selector('+') {
    @include bem.element('other') {}
  }
  @include bem.element('invalid') {}`)), /invalid nesting: element -> element/);
  assert.throws(() => compile(wrap(`@include bem.selector(':before') {}
    @include bem.modifier('a') { @include bem.modifier('b') {} }
  `)), /invalid nesting: modifier -> modifier/);
});
for (const [label, content] of [
  ['ordinary declarations', 'color: red;'],
  ['custom properties', '--color: red;'],
  ['declarations after a completed child', "@include bem.element('other') { content: 'other'; } color: red;"],
  ['declarations in control flow', '@if true { color: red; }'],
  ['declarations from a user mixin', '@include declare-color;'],
]) {
  test(`pending + rejects ${label} instead of attaching them to the left element`, () => {
    assert.throws(() => compile(`@mixin declare-color { color: red; }
      ${wrap(`@include bem.selector('+') { ${content} }`)}`),
      /Declarations may only be used within style rules/);
  });
}
test('pending + also rejects direct declarations inside a surrounding media rule', () => {
  assert.throws(() => compile(`@media (min-width: 1px) {
    ${wrap("@include bem.selector('+') { color: red; }")}
  }`), /Declarations may only be used within style rules/);
});
test('a rejected pending declaration cannot contaminate the next compilation', () => {
  const compiler = initCompiler();
  const run = (body) => compiler.compileString(`${prelude}\n${body}`, { url }).css;
  const fresh = wrap("@include bem.selector('+') { @include bem.element('other') { content: 'other'; } }");
  try {
    const expected = run(fresh);
    assert.throws(() => run(wrap("@include bem.selector('+') { color: red; }")), /Declarations may only be used within style rules/);
    assert.equal(run(fresh), expected);
    assert.deepEqual(rules(run(wrap("@include bem.modifier('active') { content: 'clean'; }"))), [['.card__item--active', 'clean']]);
  } finally { compiler.dispose(); }
});

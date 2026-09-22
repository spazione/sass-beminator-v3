import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { initCompiler } from 'sass';
import { compileScss } from '../../helpers/compile-scss.js';

const url = new URL('extend-fixture.scss', import.meta.url);
const prelude = "@use '../../src' as bem;";
const block = (body) => `@include bem.block('standard-object') { ${body} }`;
const extend = (body) => `@include bem.extend('icon', 'mod1') { ${body} }`;
function compile(body) { return compileScss(`${prelude}\n${body}`, { url }); }
function rules(css) {
  const pattern = /([^{}]+)\{\s*content: "([^"\n]*)";\s*\}/g;
  const result = [...css.matchAll(pattern)].map((match) => [match[1].trim(), match[2]]);
  assert.equal(css.replace(pattern, '').trim(), '', 'Unexpected CSS beyond identifying rules');
  return result;
}

// X01–X03: approved artifacts only, with independent intentional expectations.
for (const [fixture, args, child, selector, label] of [
  ['single', "'icon', 'mod1'", false, '.standard-object .icon--mod1', 'EXTENDED PATTERN WITH SINGLE MODIFIER'],
  ['double', "'icon', 'mod1', 'mod2'", false, '.standard-object .icon--mod1.icon--mod2', 'EXTENDED PATTERN WITH DOUBLE MODIFIER'],
  ['single-element', "'icon', 'mod1'", true, '.standard-object .icon--mod1 .icon__nested-element', 'EXTEND WITH SINGLE MODIFIER APPLIED to AN ELEMENT'],
  ['double-element', "'icon', 'mod1', 'mod2'", true, '.standard-object .icon--mod1.icon--mod2 .icon__nested-element', 'EXTEND WITH DOUBLE MODIFIER APPLIED to AN ELEMENT'],
]) {
  test(`approved historical extend ${fixture}`, () => {
    const declaration = `content: '${label}';`;
    const body = child ? `@include bem.element('nested-element') { ${declaration} }` : declaration;
    const actual = rules(compile(block(`@include bem.extend(${args}) { ${body} }`)));
    assert.deepEqual(actual, [[selector, label]]);
    assert.deepEqual(actual, rules(readFileSync(new URL(`../../characterization/v2/core/extend/${fixture}.css`, import.meta.url), 'utf8')));
  });
}
test('extend element modifiers retain owner, subject, and each scope exactly once', () => {
  assert.deepEqual(rules(compile(block(`@include bem.extend('icon', 'x', 'y') {
    @include bem.element('label') {
      @include bem.modifier('active') { content: 'single'; }
      @include bem.modifier('large', 'bright') { content: 'double'; }
    }
  }`))), [
    ['.standard-object .icon--x.icon--y .icon__label--active', 'single'],
    ['.standard-object .icon--x.icon--y .icon__label--large.icon__label--bright', 'double'],
  ]);
});
test('extend beneath a nested block preserves the complete enclosing block scope', () => {
  assert.deepEqual(rules(compile(`@include bem.block('page') {
    ${block(extend("@include bem.element('label') { @include bem.modifier('active') { content: 'label'; } }"))}
  }`)), [['.page .standard-object .icon--mod1 .icon__label--active', 'label']]);
});
test('extend validates target and both modifiers with the existing literal-name policy', () => {
  const invalidNames = ["''", 'null', '7', "'icon, .other'", "'icon child'", "'icon:hover'", "'7icon'"];
  for (const name of invalidNames) {
    for (const args of [`${name}, 'm'`, `'icon', ${name}`, `'icon', 'm', ${name}`]) {
      if (args === "'icon', 'm', null") continue;
      assert.throws(() => compile(block(`@include bem.extend(${args}) {}`)),
        /BEMinator: (expected a nonempty literal BEM name|a BEM name)/);
    }
  }
  assert.deepEqual(rules(compile(block("@include bem.extend(Icon_2, 'mod-1', 'active') { content: 'valid'; }"))),
    [['.standard-object .Icon_2--mod-1.Icon_2--active', 'valid']]);
});
test('extend requires one modifier and permits only an optional second modifier', () => {
  for (const args of ['', "'icon'", "'icon', 'a', 'b', 'c'"]) {
    assert.throws(() => compile(block(`@include bem.extend(${args}) {}`)), /Missing argument|Only 3 arguments allowed/);
  }
  assert.deepEqual(rules(compile(block("@include bem.extend($name: 'icon', $mod1: 'm', $mod2: null) { content: 'named'; }"))),
    [['.standard-object .icon--m', 'named']]);
});
const forbiddenBlock = "@include bem.block('forbidden') {}";
const rejectionPaths = [
  ['direct', forbiddenBlock],
  ['through element', `@include bem.element('label') { ${forbiddenBlock} }`],
  ['through element and modifier', `@include bem.element('label') { @include bem.modifier('active') { ${forbiddenBlock} } }`],
  ['through before', `@include bem.element('label') { @include bem.selector(':before') { ${forbiddenBlock} } }`],
  ['through pending adjacent', `@include bem.element('label') { @include bem.selector('+') { ${forbiddenBlock} } }`],
  ['through adjacent element and modifier', `@include bem.element('label') { @include bem.selector('+') {
    @include bem.element('other') { @include bem.modifier('active') { ${forbiddenBlock} } }
  } }`],
];
for (const [label, body] of rejectionPaths) {
  test(`blocks remain forbidden beneath extend ${label}`, () => {
    assert.throws(() => compile(block(extend(body))), /BEMinator: invalid nesting: block is forbidden beneath extend/);
  });
}
for (const [label, source, parent] of [
  ['top-level extend', extend(''), 'root'],
  ['nested extend', block(extend(extend(''))), 'extend'],
  ['element parent', block(`@include bem.element('label') { ${extend('')} }`), 'element'],
  ['modifier parent', block(`@include bem.modifier('active') { ${extend('')} }`), 'modifier'],
  ['before parent', block(`@include bem.element('label') { @include bem.selector(':before') { ${extend('')} } }`), 'qualified'],
  ['adjacent parent', block(`@include bem.element('label') { @include bem.selector('+') { ${extend('')} } }`), 'pending-relation'],
]) {
  test(`${label} remains deferred`, () => {
    assert.throws(() => compile(source), new RegExp(`nesting ${parent} -> extend is deferred; not implemented in this slice`));
  });
}
test('direct selector and modifier beneath extend remain deferred', () => {
  for (const call of ["@include bem.selector(':before') {}", "@include bem.selector('+') {}", "@include bem.modifier('active') {}"]) {
    assert.throws(() => compile(block(extend(call))), /nesting extend -> (qualified|pending-relation|modifier) is deferred; not implemented in this slice/);
  }
});
test('approved selector children of an extend element retain the target owner', () => {
  assert.deepEqual(rules(compile(block(extend(`@include bem.element('label') {
    @include bem.selector(':before') { content: 'before'; }
    @include bem.selector('+') { @include bem.element('other') { content: 'other'; } }
  }`)))), [
    ['.standard-object .icon--mod1 .icon__label:before', 'before'],
    ['.standard-object .icon--mod1 .icon__label + .icon__other', 'other'],
  ]);
});
test('completed extend restores owner, scope, and permission for a later nested block', () => {
  const probe = `@include bem.element('after') { content: 'after'; }
    @include bem.block('normal') { @include bem.element('item') { content: 'normal'; } }`;
  const alone = rules(compile(block(probe)));
  const sequence = rules(compile(block(extend("@include bem.element('inner') { content: 'inner'; }") + probe)));
  assert.deepEqual(alone, [['.standard-object__after', 'after'], ['.standard-object .normal__item', 'normal']]);
  assert.deepEqual(sequence, [['.standard-object .icon--mod1 .icon__inner', 'inner'], ...alone]);
});
test('repeated extend calls and independent roots never retain ancestry', () => {
  assert.deepEqual(rules(compile(block(`
    ${extend('')}
    ${extend("content: 'first';")}
    @include bem.extend('other', 'x', 'y') { @include bem.element('label') { content: 'second'; } }
    ${extend("content: 'third';")}
  `) + block("@include bem.block('normal') { content: 'clean'; }"))), [
    ['.standard-object .icon--mod1', 'first'],
    ['.standard-object .other--x.other--y .other__label', 'second'],
    ['.standard-object .icon--mod1', 'third'], ['.standard-object .normal', 'clean'],
  ]);
});
test('representative five-operation sibling sequences restore normal and scoped parents', () => {
  const children = [
    "@include bem.element('item') { content: 'element'; }",
    "@include bem.modifier('active') { content: 'modifier'; }",
    "@include bem.block('child') { content: 'block'; }",
    extend("@include bem.element('inner') { content: 'extend'; }"),
    "@include bem.element('left') { @include bem.selector(':before') { content: 'before'; } @include bem.selector('+') { @include bem.element('right') { content: 'adjacent'; } } }",
  ];
  const expected = [
    [['.standard-object__item', 'element']], [['.standard-object--active', 'modifier']],
    [['.standard-object .child', 'block']], [['.standard-object .icon--mod1 .icon__inner', 'extend']],
    [['.standard-object__left:before', 'before'], ['.standard-object__left + .standard-object__right', 'adjacent']],
  ];
  for (const nested of [false, true]) {
    for (const order of [[0, 1, 2, 3, 4], [3, 4, 2, 1, 0], [4, 0, 3, 2, 1]]) {
      const body = order.map((i) => `${children[i]}
        @include bem.element('after') { content: 'after'; }
        @include bem.block('allowed') { content: 'allowed'; }`).join('\n');
      const source = nested ? `@include bem.block('page') { ${block(body)} }` : block(body);
      assert.deepEqual(rules(compile(source)), order.flatMap((i) => [...expected[i],
        ['.standard-object__after', 'after'], ['.standard-object .allowed', 'allowed']])
        .map(([selector, label]) => [nested ? `.page ${selector}` : selector, label]));
    }
  }
});
test('extend constructs new rules without native Sass extension or rule merging', () => {
  assert.deepEqual(rules(compile(`.icon--mod1 { content: 'existing'; }
    ${block(extend("content: 'constructed';"))}`)), [
    ['.icon--mod1', 'existing'], ['.standard-object .icon--mod1', 'constructed'],
  ]);
});
test('source architecture has three load-time settings, one evolving stack, and no native extension primitives', () => {
  const source = readFileSync(new URL('../../src/core/_bem.scss', import.meta.url), 'utf8')
    .replace(/\/\/[^\n]*/g, '');
  // Guard this cohesive module's architectural constraint, not a general SCSS parser.
  assert.deepEqual([...source.matchAll(/^\$([\w-]+):/gm)].map((match) => match[1]),
    ['element-separator', 'modifier-separator', 'css-layers', '-context-stack']);
  assert.deepEqual([...source.matchAll(/^\$([\w-]+):[^;]*!default/gm)].map((match) => match[1]),
    ['element-separator', 'modifier-separator', 'css-layers']);
  const writes = [...source.matchAll(/\$([\w-]+):[^;]*!global/g)].map((match) => match[1]);
  assert.deepEqual(writes, ['-context-stack', '-context-stack']);
  assert.equal([...source.matchAll(/@at-root\b/g)].length, 1);
  assert.doesNotMatch(source, /@extend\b|selector\.(?:unify|extend|replace)\s*\(/);
});
test('compiler reuse after an extend ancestry error starts with a clean root', () => {
  const compiler = initCompiler();
  const run = (body) => compiler.compileString(`${prelude}\n${body}`, { url }).css;
  const fresh = block("@include bem.block('normal') { content: 'normal'; }");
  try {
    const expected = run(fresh);
    run(block(extend("@include bem.element('label') { content: 'valid'; }")));
    assert.equal(run(fresh), expected);
    assert.throws(() => run(block(extend(rejectionPaths[2][1]))), /block is forbidden beneath extend/);
    assert.equal(run(fresh), expected);
  } finally { compiler.dispose(); }
});

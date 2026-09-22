import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { initCompiler } from 'sass';
import { compileScss } from '../../helpers/compile-scss.js';

const url = new URL('fixture.scss', import.meta.url);
const prelude = "@use '../../src' as bem; @use 'regression' as regression;";
function compile(body) {
  return compileScss(`${prelude}\n${body}`, { url });
}
// Exact selectors, declarations, and order; ignore only inter-rule whitespace.
function rules(css) {
  const pattern = /([^{}]+)\{\s*content: "([^"\n]*)";\s*\}/g;
  const result = [...css.matchAll(pattern)].map((match) => [match[1].trim(), match[2]]);
  assert.equal(css.replace(pattern, '').trim(), '', 'Unexpected CSS beyond identifying rules');
  return result;
}
function wrap(mixin, args, body) {
  return `@include bem.${mixin}(${args}) { ${body} }`;
}
function tree(path, body = "content: 'approved';") {
  return path.reduceRight((child, [mixin, args]) => wrap(mixin, args, child), body);
}
// SPEC B01–B05, E01–E02, M01–M03, Q06. These are intentional v3
// expectations, not permissive/known-leak v2 snapshots.
const cases = [
  ['root block', [['block', "'card'"]], '.card'],
  ['block element', [['block', "'card'"], ['element', "'title'"]], '.card__title'],
  ['block modifier', [['block', "'card'"], ['modifier', "'active'"]], '.card--active'],
  ['block double modifier', [['block', "'card'"], ['modifier', "'a', 'b'"]], '.card--a.card--b'],
  ['element modifier', [['block', "'card'"], ['element', "'title'"], ['modifier', "'large'"]], '.card__title--large'],
  ['element double modifier', [['block', "'card'"], ['element', "'title'"], ['modifier', "'a', 'b'"]], '.card__title--a.card__title--b'],
  ['modifier element', [['block', "'card'"], ['modifier', "'active'"], ['element', "'title'"]], '.card--active .card__title'],
  ['double modifier element', [['block', "'card'"], ['modifier', "'a', 'b'"], ['element', "'title'"]], '.card--a.card--b .card__title'],
  ['modified element child ownership', [['block', "'card'"], ['element', "'item'"], ['modifier', "'active'"], ['element', "'child'"]], '.card__item--active .card__child'],
  ['double modified element child ownership', [['block', "'card'"], ['element', "'item'"], ['modifier', "'a', 'b'"], ['element', "'child'"]], '.card__item--a.card__item--b .card__child'],
  ['nested block', [['block', "'page'"], ['block', "'card'"]], '.page .card'],
  ['three block depths', [['block', "'page'"], ['block', "'card'"], ['block', "'icon'"]], '.page .card .icon'],
  ['equal-name blocks', [['block', "'icon'"], ['block', "'icon'"]], '.icon .icon'],
  ['nested block element naming', [['block', "'page'"], ['block', "'card'"], ['element', "'title'"]], '.page .card__title'],
  ['nested block modifier', [['block', "'page'"], ['block', "'card'"], ['modifier', "'active'"]], '.page .card--active'],
  ['nested block double modifier', [['block', "'page'"], ['block', "'card'"], ['modifier', "'a', 'b'"]], '.page .card--a.card--b'],
  ['nested block element modifier', [['block', "'page'"], ['block', "'card'"], ['element', "'title'"], ['modifier', "'large'"]], '.page .card__title--large'],
  ['nested block element double modifier', [['block', "'page'"], ['block', "'card'"], ['element', "'title'"], ['modifier', "'a', 'b'"]], '.page .card__title--a.card__title--b'],
  ['block beneath contextual element modifier', [['block', "'card'"], ['element', "'item'"], ['modifier', "'active'"], ['block', "'icon'"]], '.card__item--active .icon'],
  ['modifier after intervening block', [['block', "'card'"], ['modifier', "'active'"], ['block', "'icon'"], ['modifier', "'large'"]], '.card--active .icon--large'],
  ['modifier after intervening element', [['block', "'card'"], ['modifier', "'active'"], ['element', "'title'"], ['modifier', "'large'"]], '.card--active .card__title--large'],
];
for (const [name, path, selector] of cases) {
  test(name, () => assert.deepEqual(rules(compile(tree(path))), [[selector, 'approved']]));
}

test('recursive calls restore each enclosing owner and scope', () => {
  const css = compile(`@mixin descend($remaining) {
    @include bem.block('icon') {
      content: 'depth #{$remaining}';
      @if $remaining > 1 { @include descend($remaining - 1); }
      @include bem.element('after') { content: 'after #{$remaining}'; }
    }
  }
  @include descend(3);`);
  assert.deepEqual(rules(css), [
    ['.icon', 'depth 3'], ['.icon .icon', 'depth 2'], ['.icon .icon .icon', 'depth 1'],
    ['.icon .icon .icon__after', 'after 1'], ['.icon .icon__after', 'after 2'], ['.icon__after', 'after 3'],
  ]);
});
test('ordinary declarations retain lexical caller values and rule order', () => {
  assert.equal(compile(`$size: 2rem;
    @include bem.block('card') {
      color: red;
      @include bem.element('title') {
        @include bem.modifier('large') { font-size: $size; }
      }
      color: blue;
    }`), '.card {\n  color: red;\n}\n.card__title--large {\n  font-size: 2rem;\n}\n\n.card {\n  color: blue;\n}');
});
test('C02 minimal historical leak stays corrected after a sibling block', () => {
  const alone = rules(compile(wrap('block', "'standard-object'", wrap('element', "'after'", "content: 'after';"))));
  const sequence = rules(compile(wrap('block', "'standard-object'", `
    @include bem.block('icon') { content: 'prior'; }
    @include bem.element('after') { content: 'after'; }`)));
  assert.deepEqual(alone, [['.standard-object__after', 'after']]);
  assert.deepEqual(sequence, [['.standard-object .icon', 'prior'], ...alone]);
});
test('C03 all six historical regression rules are independent of the preceding icon', () => {
  const expected = [
    ['.standard-object__gigi--fatherdMod .icon', 'BLOCK INSIDE BLOCK'],
    ['.standard-object__gigi--fatherdMod .icon--mod', 'BLOCK INSIDE BLOCK WITH SINGLE MODIFIER'],
    ['.standard-object__gigi--fatherdMod .icon__nested-element--nestedMod', 'nestedMod'],
    ['.standard-object__gigi--fatherdMod .standard-object__pippo', 'pippo'],
    ['.standard-object__gigi--fatherdMod .standard-object__pippo--mod', 'mod'],
    ['.standard-object__gigi--fatherdMod .standard-object__test-ele', 'test-ele'],
  ];
  const alone = rules(compile(wrap('block', "'standard-object'", '@include regression.tree;')));
  const sequence = rules(compile(wrap('block', "'standard-object'", `
    @include bem.block('icon') { content: 'prior'; } @include regression.tree;`)));
  assert.deepEqual(alone, expected);
  assert.deepEqual(sequence, [['.standard-object .icon', 'prior'], ...expected]);
  // Only this explicitly approved isolated artifact is compared. The buggy
  // full-history artifact remains evidence and is deliberately not an oracle.
  assert.deepEqual(alone, rules(readFileSync(new URL('../../characterization/v2/regression/complete.css', import.meta.url), 'utf8')));
});
function permutations(items) {
  if (!items.length) return [[]];
  return items.flatMap((item, i) => permutations(items.filter((_, j) => i !== j)).map((rest) => [item, ...rest]));
}
test('all six sibling orders restore both root and scoped parent contexts after every child', () => {
  const children = [
    wrap('element', "'title'", wrap('modifier', "'large'", "content: 'element';")),
    wrap('modifier', "'active'", wrap('element', "'child'", "content: 'modifier';")),
    wrap('block', "'icon'", wrap('element', "'label'", "content: 'block';")),
  ];
  const outputs = [['.card__title--large', 'element'], ['.card--active .card__child', 'modifier'], ['.card .icon__label', 'block']];
  for (const nested of [false, true]) {
    for (const order of permutations([0, 1, 2])) {
      const body = order.map((i) => `${children[i]}
        @include bem.element('after') { content: 'after'; }
        @include bem.modifier('after') { content: 'parent modifier'; }`).join('\n');
      const card = wrap('block', "'card'", body);
      const source = nested ? tree([['block', "'page'"], ['modifier', "'active'"]], card) : card;
      const prefix = nested ? '.page--active ' : '';
      assert.deepEqual(rules(compile(source)), order.flatMap((i) => [outputs[i],
        ['.card__after', 'after'], ['.card--after', 'parent modifier']])
        .map(([selector, label]) => [prefix + selector, label]));
    }
  }
});
test('element and modifier parents survive multiple completed children', () => {
  assert.deepEqual(rules(compile(`@include bem.block('card') {
    @include bem.element('title') {
      @include bem.modifier('first') {
        @include bem.block('icon') { content: 'nested'; }
        @include bem.element('child') { content: 'child'; }
      }
      @include bem.modifier('second') { content: 'second'; }
      @include bem.modifier('third', 'fourth') { content: 'double'; }
    }
    @include bem.element('after') { content: 'after'; }
  }`)), [
    ['.card__title--first .icon', 'nested'], ['.card__title--first .card__child', 'child'],
    ['.card__title--second', 'second'], ['.card__title--third.card__title--fourth', 'double'],
    ['.card__after', 'after'],
  ]);
});
test('empty children and repeated same/different roots leave no stale stack frames', () => {
  assert.deepEqual(rules(compile(`
    @include bem.block('card') {
      @include bem.block('empty') {}
      @include bem.element('empty') {}
      @include bem.modifier('empty') {}
      @include regression.tree;
    }
    @include bem.block('other') { content: 'other'; }
    @include bem.block('card') { @include bem.element('after') { content: 'after'; } }
    @include bem.block('card') { content: 'card'; }
  `)).slice(-3), [['.other', 'other'], ['.card__after', 'after'], ['.card', 'card']]);
  // A top-level element after a completed root must observe root, not block.
  assert.throws(() => compile("@include bem.block('card') {} @include bem.element('leak') {}"), /nesting root -> element is deferred/);
});
for (const kind of ['element', 'modifier']) {
  for (const afterHistory of [false, true]) {
    test(`reject direct ${kind} nesting${afterHistory ? ' after history' : ''}`, () => {
      const invalid = tree([['block', "'card'"], [kind, "'a'"], [kind, "'b'"]]);
      const history = wrap('block', "'standard-object'", '@include regression.tree;');
      assert.throws(() => compile((afterHistory ? history : '') + invalid),
        new RegExp(`BEMinator: invalid nesting: ${kind} -> ${kind}`));
    });
  }
}
test('control flow does not hide direct invalid nesting', () => {
  assert.throws(() => compile(`@include bem.block('card') {
    @include bem.element('item') { @if true { @include bem.element('other') {} } }
  }`), /invalid nesting: element -> element/);
});
for (const [path, diagnostic] of [
  [[['element', "'item'"]], 'root -> element'],
  [[['modifier', "'active'"]], 'root -> modifier'],
  [[['block', "'card'"], ['element', "'title'"], ['block', "'icon'"]], 'element -> block'],
]) {
  test(`deferred ${diagnostic} has no implemented output`, () => {
    assert.throws(() => compile(tree(path)), new RegExp(`nesting ${diagnostic} is deferred; not implemented in this slice`));
  });
}
test('modifier accepts exactly the one/two-name shapes and rejects zero/three arguments', () => {
  for (const args of ['', "'a', 'b', 'c'"]) {
    assert.throws(() => compile(wrap('block', "'card'", wrap('modifier', args, ''))), /Missing argument|Only 2 arguments allowed/);
  }
  assert.deepEqual(rules(compile(tree([['block', "'card'"], ['modifier', "'active', null"]]))), [['.card--active', 'approved']]);
});
test('simple quoted/unquoted literal names preserve case, hyphens, underscores and digits', () => {
  assert.deepEqual(rules(compile(tree([['block', 'Card_2'], ['element', "'title-1'"], ['modifier', "'fatherdMod'"]]))),
    [['.Card_2__title-1--fatherdMod', 'approved']]);
});
test('unsupported names cannot introduce selectors through interpolation', () => {
  for (const name of ["''", 'null', '7', "'card, .other'", "'card child'", "'card:hover'", "'7card'"]) {
    for (const path of [
      [['block', name]], [['block', "'card'"], ['element', name]],
      [['block', "'card'"], ['modifier', name]], [['block', "'card'"], ['modifier', `'a', ${name}`]],
    ]) {
      if (name === 'null' && path.at(-1)[1] === "'a', null") continue;
      assert.throws(() => compile(tree(path)), /BEMinator: (expected a nonempty literal BEM name|a BEM name)/);
    }
  }
});
test('public module exposes exactly six mixins, three configuration settings, and no functions/debug hooks', () => {
  assert.equal(compileScss(`@use '../../src' as bem;
    @use 'sass:meta'; @use 'sass:map'; @use 'sass:list';
    $mixins: meta.module-mixins('bem');
    @if list.length(map.keys($mixins)) != 6 or
        not map.has-key($mixins, 'block') or not map.has-key($mixins, 'element') or
        not map.has-key($mixins, 'modifier') or
        not map.has-key($mixins, 'selector') or
        not map.has-key($mixins, 'css-layers') or
        not map.has-key($mixins, 'extend') { @error 'Unexpected mixin exports'; }
    @if list.length(map.keys(meta.module-functions('bem'))) != 0 or
        list.length(map.keys(meta.module-variables('bem'))) != 3 or
        not map.has-key(meta.module-variables('bem'), 'css-layers') or
        not map.has-key(meta.module-variables('bem'), 'element-separator') or
        not map.has-key(meta.module-variables('bem'), 'modifier-separator') { @error 'Leaked internals'; }
  `, { url }), '');
});
test('private stack and lifecycle helpers cannot be accessed even by deep import', () => {
  for (const access of ['$value: core.$-context-stack;', '$value: core.-current-context();', '@include core.-push-context(null);', '@include core.-restore-context(());']) {
    assert.throws(() => compileScss(`@use '../../src/core/bem' as core; ${access}`, { url }), /Private members/);
  }
});
test('reusing a compiler after successful and aborted fixtures cannot retain context', () => {
  const compiler = initCompiler();
  const run = (body) => compiler.compileString(`${prelude}\n${body}`, { url }).css;
  const fresh = tree([['block', "'fresh'"], ['element', "'title'"]]);
  try {
    const expected = run(fresh);
    assert.deepEqual(rules(expected), [['.fresh__title', 'approved']]);
    run(wrap('block', "'standard-object'", '@include regression.tree;'));
    assert.equal(run(fresh), expected);
    for (const body of [
      tree([['block', "'card'"], ['element', "'a'"], ['element', "'b'"]]),
      tree([['block', "'card'"], ['modifier', "'active'"]], "@error 'caller abort';"),
    ]) {
      assert.throws(() => run(body), /invalid nesting|caller abort/);
      assert.equal(run(fresh), expected);
    }
  } finally { compiler.dispose(); }
});

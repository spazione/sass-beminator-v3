import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { initCompiler } from 'sass';
import { compileScss } from '../../helpers/compile-scss.js';
import { projectRoot } from '../../helpers/project-paths.js';

const directory = fileURLToPath(new URL('.', import.meta.url));
const output = join(projectRoot, 'tmp/context-stack');
mkdirSync(output, { recursive: true });
const imports = "@use 'stack' as s; @use 'regression' as r;";
function compile(name, body) {
  const css = compileScss(`${imports}\n@include s.assert-depth(0);\n${body}\n@include s.assert-depth(0);`, {
    loadPaths: [directory], url: new URL(`${name}.scss`, import.meta.url),
  });
  writeFileSync(join(output, `${name}.css`), css);
  return css;
}
function rules(css) {
  const pattern = /([^{}]+)\{\s*content: "([^"\n]*)";\s*\}/g;
  const result = [...css.matchAll(pattern)].map((m) => [m[1].trim(), m[2]]);
  assert.equal(css.replace(pattern, '').trim(), '', 'Unexpected CSS beyond flat proof rules');
  return result;
}
const expected = [
  ['.block', 'block'], ['.block__element', 'element'],
  ['.block--modifier', 'block modifier'], ['.block__element--modifier', 'element modifier'],
  ['.block--a.block--b', 'block conjunction'],
  ['.block__element--a.block__element--b', 'element conjunction'],
  ['.outer .block--a.block--b', 'scoped conjunction'],
  ['.block--active .block__child', 'block context'],
  ['.block__item--active .block__child', 'element context'],
  ['.block--a.block--b .block__child', 'double block context'],
  ['.block__item--a.block__item--b .block__child', 'double element context'],
  ['.a .b', 'two blocks'], ['.a .b .c', 'three blocks'],
  ['.icon .icon', 'depth 3'], ['.icon .icon .icon', 'depth 2'],
  ['.icon .icon .icon .icon', 'depth 1'],
  ['.standard-object .icon__label', 'inner element'],
  ['.standard-object .icon--active', 'inner modifier'],
  ['.standard-object .icon__label--active', 'inner element modifier'],
  ['.block__item:before', 'pseudo'], ['.block__item + .block__other', 'adjacent'],
  ['.a .b--m', 'single extend'], ['.a .b--m .b__item', 'single extend element'],
  ['.a .b--x.b--y', 'double extend'], ['.a .b--x.b--y .b__item', 'double extend element'],
];
test('all 25 approved A–G outputs match explicit transport and normative expectations', () => {
  const actual = rules(compile('approved', readFileSync(join(directory, 'approved.scss'), 'utf8').replace("@use 'stack' as s;", '')));
  assert.deepEqual(actual, expected);
  const explicit = ['a-suffix', 'b-conjunction', 'c-contextual-element', 'd-recursive-block', 'e-nested-naming', 'f-selectors', 'g-extend']
    .flatMap((name) => rules(compileScss(readFileSync(join(directory, '../selector-engine', `${name}.scss`), 'utf8'), {
      loadPaths: [join(directory, '../selector-engine')],
    })));
  assert.deepEqual(actual, explicit);
});
const regression = [
  ['.standard-object__gigi--fatherdMod .icon', 'BLOCK INSIDE BLOCK'],
  ['.standard-object__gigi--fatherdMod .icon--mod', 'BLOCK INSIDE BLOCK WITH SINGLE MODIFIER'],
  ['.standard-object__gigi--fatherdMod .icon__nested-element--nestedMod', 'nestedMod'],
  ['.standard-object__gigi--fatherdMod .standard-object__pippo', 'pippo'],
  ['.standard-object__gigi--fatherdMod .standard-object__pippo--mod', 'mod'],
  ['.standard-object__gigi--fatherdMod .standard-object__test-ele', 'test-ele'],
];
for (const large of [false, true]) {
  test(`historical ${large ? 'six-rule regression' : 'minimal leak'} remains isolated`, () => {
    const body = large ? '@include r.tree;' : "@include s.proof-element('after') { content: 'after'; }";
    const run = (preceding) => rules(compile(`regression-${large}-${preceding}`, `
      @include s.proof-block('standard-object') {
        ${preceding ? "@include s.proof-block('icon') { content: 'prior sibling'; }" : ''}
        @include s.assert-depth(1); ${body} @include s.assert-depth(1);
      }`));
    const alone = run(false);
    const sequence = run(true);
    assert.deepEqual(sequence[0], ['.standard-object .icon', 'prior sibling']);
    assert.deepEqual(sequence.slice(1), alone);
    assert.deepEqual(alone, large ? regression : [['.standard-object__after', 'after']]);
  });
}
const operations = [
  "@include s.proof-element('item') { @include s.proof-modifier('active') { content: 'element'; } }",
  "@include s.proof-modifier('wide') { @include s.proof-element('child') { content: 'modifier'; } }",
  "@include s.proof-block('icon') { @include s.proof-element('label') { content: 'block'; } }",
  "@include s.proof-element('left') { @include s.proof-selector('+') { @include s.proof-element('right') { content: 'selector'; } } }",
  "@include s.proof-extend('target', 'x', 'y') { @include s.proof-element('part') { content: 'extend'; } }",
];
function permutations(items) {
  if (!items.length) return [[]];
  return items.flatMap((item, i) => permutations(items.filter((_, j) => i !== j)).map((rest) => [item, ...rest]));
}
test('all 120 mixed sibling orders restore the parent after each child', () => {
  const childExpected = [
    ['.card__item--active', 'element'], ['.card--wide .card__child', 'modifier'],
    ['.card .icon__label', 'block'], ['.card__left + .card__right', 'selector'],
    ['.card .target--x.target--y .target__part', 'extend'],
  ];
  for (const nested of [false, true]) {
    const depth = nested ? 3 : 1;
    const prefix = nested ? '.outer--active ' : '';
    for (const [number, order] of permutations([0, 1, 2, 3, 4]).entries()) {
      const body = order.map((i) => `${operations[i]}
        @include s.assert-depth(${depth});
        @include s.proof-element('after') { content: 'after'; }
        @include s.assert-depth(${depth});`).join('\n');
      const card = `@include s.proof-block('card') { ${body} }`;
      const source = nested ? `@include s.proof-block('outer') {
        @include s.proof-modifier('active') { ${card} @include s.assert-depth(2); }
        @include s.assert-depth(1);
      }` : card;
      assert.deepEqual(rules(compile(`sequence-${nested}-${number}`, source)),
        order.flatMap((i) => [childExpected[i], ['.card__after', 'after']])
          .map(([selector, label]) => [prefix + selector, label]));
    }
  }
});
test('selector and modifier siblings restore an element parent in all six orders', () => {
  const children = [
    "@include s.proof-selector(':before') { content: 'before'; }",
    "@include s.proof-selector('+') { @include s.proof-element('next') { content: 'adjacent'; } }",
    "@include s.proof-modifier('large') { content: 'modifier'; }",
  ];
  const outputs = [['.card__title:before', 'before'], ['.card__title + .card__next', 'adjacent'], ['.card__title--large', 'modifier']];
  for (const [number, order] of permutations([0, 1, 2]).entries()) {
    assert.deepEqual(rules(compile(`element-sequence-${number}`, `@include s.proof-block('card') {
      @include s.proof-element('title') {
        ${order.map((i) => `${children[i]} @include s.assert-depth(2);
          @include s.proof-modifier('after') { content: 'after'; }`).join('\n')}
      }
    }`)), order.flatMap((i) => [outputs[i], ['.card__title--after', 'after']]));
  }
});
test('repeated roots, empty content, and shared module imports restore depth', () => {
  const body = `@include s.proof-block('card') {
    @include s.assert-depth(1);
    @include s.proof-block('empty') {} @include s.assert-depth(1);
    @include r.tree; @include s.assert-depth(1);
  }
  @include s.assert-depth(0);
  @include s.proof-block('card') { @include s.proof-element('after') { content: 'after'; } }
  @include s.proof-block('other') { content: 'other'; }
  @include s.proof-block('card') { content: 'card'; }`;
  const result = rules(compile('independent-roots', body));
  assert.deepEqual(result.slice(-3), [['.card__after', 'after'], ['.other', 'other'], ['.card', 'card']]);
});
const invalid = [
  ["@include s.proof-element('a') { @include s.proof-element('b') {} }", 'element -> element'],
  ["@include s.proof-modifier('a') { @include s.proof-modifier('b') {} }", 'modifier -> modifier'],
  ["@include s.proof-extend('b', 'm') { @include s.proof-block('c') {} }", 'extend -> block'],
  ["@include s.proof-extend('b', 'm') { @include s.proof-element('e') { @include s.proof-block('c') {} } }", 'element -> block'],
  ["@include s.proof-extend('b', 'm') { @include s.proof-element('e') { @include s.proof-modifier('n') { @include s.proof-block('c') {} } } }", 'modifier -> block'],
  ["@include s.proof-extend('b', 'm') { @include s.proof-element('e') { @include s.proof-selector('+') { @include s.proof-element('f') { @include s.proof-modifier('n') { @include s.proof-block('c') {} } } } } }", 'modifier -> block'],
];
for (const [body, diagnostic] of invalid) {
  test(`reject ${diagnostic} with immutable ancestry (${invalid.findIndex((x) => x[0] === body)})`, () => {
    assert.throws(() => compile('invalid', `@include s.proof-block('a') { ${body} }`),
      new RegExp(`SPIKE invalid nesting: ${diagnostic}`));
  });
}
test('identical emitted selectors do not determine block ancestry validity', () => {
  assert.deepEqual(rules(compile('allowed-provenance', `@include s.proof-block('a') {
    @include s.proof-block('b') { @include s.proof-modifier('m') {
      content: 'same'; @include s.proof-block('c') { content: 'allowed'; }
    } }
  }`)), [['.a .b--m', 'same'], ['.a .b--m .c', 'allowed']]);
  assert.deepEqual(rules(compile('extend-provenance', `@include s.proof-block('a') {
    @include s.proof-extend('b', 'm') { content: 'same'; }
  }`)), [['.a .b--m', 'same']]);
  // The identical extend selector's child block is rejected by the tests above.
});
test('error aborts active frames; the same compiler can compile fresh roots afterwards', () => {
  const compiler = initCompiler();
  const options = { loadPaths: [directory] };
  const fresh = `${imports} @include s.assert-depth(0);
    @include s.proof-block('fresh') { @include s.assert-depth(1); content: 'fresh'; }
    @include s.assert-depth(0);`;
  try {
    const before = compiler.compileString(fresh, options).css;
    for (const body of [invalid[4][0], "@include s.proof-element('e') { @error 'CALLER abort'; }"]) {
      const source = `${imports} @include s.proof-block('a') {
        ${body} @error 'UNREACHABLE sibling';
      } @error 'UNREACHABLE root';`;
      assert.throws(() => compiler.compileString(source, options), (error) => {
        assert.match(error.message, /SPIKE invalid nesting|CALLER abort/);
        assert.doesNotMatch(error.message, /UNREACHABLE/);
        return true;
      });
      assert.equal(compiler.compileString(fresh, options).css, before);
    }
    compiler.compileString(`${imports} @include s.proof-block('other') { @include r.tree; }`, options);
    assert.equal(compiler.compileString(fresh, options).css, before);
  } finally { compiler.dispose(); }
});
test('stack and mutation helpers are Sass-private', () => {
  for (const access of ['$x: s.$-context-stack;', '$x: s.-current-context();', '@include s.-push-context(null);', '@include s.-pop-context((), null);']) {
    assert.throws(() => compile('private', access), /Private members/);
  }
});

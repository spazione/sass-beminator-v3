import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { compileScss } from '../../helpers/compile-scss.js';
import { projectRoot } from '../../helpers/project-paths.js';

const directory = fileURLToPath(new URL('.', import.meta.url));
const output = join(projectRoot, 'tmp/selector-engine');
mkdirSync(output, { recursive: true });
function compile(name, source = readFileSync(join(directory, `${name}.scss`), 'utf8')) {
  const css = compileScss(source, { loadPaths: [directory], url: new URL(`${name}.scss`, import.meta.url) });
  writeFileSync(join(output, `${name}.css`), css);
  return css;
}

// These proof inputs emit flat rules with one identifying declaration only.
// Reject any other output; retain selector text, combinators, values, and order.
function rules(css) {
  const pattern = /([^{}]+)\{\s*content: "([^"\n]*)";\s*\}/g;
  const result = [...css.matchAll(pattern)].map((m) => [m[1].trim(), m[2]]);
  assert.equal(css.replace(pattern, '').trim(), '', 'Unexpected CSS beyond flat proof rules');
  return result;
}

const examples = {
  'a-suffix': [
    ['.block', 'block'], ['.block__element', 'element'],
    ['.block--modifier', 'block modifier'], ['.block__element--modifier', 'element modifier'],
  ],
  'b-conjunction': [
    ['.block--a.block--b', 'block conjunction'],
    ['.block__element--a.block__element--b', 'element conjunction'],
    ['.outer .block--a.block--b', 'scoped conjunction'],
  ],
  'c-contextual-element': [
    ['.block--active .block__child', 'block context'],
    ['.block__item--active .block__child', 'element context'],
    ['.block--a.block--b .block__child', 'double block context'],
    ['.block__item--a.block__item--b .block__child', 'double element context'],
  ],
  'd-recursive-block': [
    ['.a .b', 'two blocks'], ['.a .b .c', 'three blocks'],
    ['.icon .icon', 'depth 3'], ['.icon .icon .icon', 'depth 2'],
    ['.icon .icon .icon .icon', 'depth 1'],
  ],
  'e-nested-naming': [
    ['.standard-object .icon__label', 'inner element'],
    ['.standard-object .icon--active', 'inner modifier'],
    ['.standard-object .icon__label--active', 'inner element modifier'],
  ],
  'f-selectors': [
    ['.block__item:before', 'pseudo'], ['.block__item + .block__other', 'adjacent'],
  ],
  'g-extend': [
    ['.a .b--m', 'single extend'], ['.a .b--m .b__item', 'single extend element'],
    ['.a .b--x.b--y', 'double extend'], ['.a .b--x.b--y .b__item', 'double extend element'],
  ],
  'i-strategies': [
    ['.natural__item--active__child', 'wrong target from parent suffix'],
    ['.ambient .ambient .target', 'accidental double nesting'],
    ['.ambient .target', 'explicit emission'],
    ['.outer .icon--m', '.outer .icon--m'], ['.outer .icon--m', '.outer .icon--m'],
    ['.lexical', 'caller/callee'],
  ],
};
for (const [name, expected] of Object.entries(examples)) {
  test(name, () => assert.deepEqual(rules(compile(name)), expected));
}

const regression = [
  ['.standard-object__gigi--fatherdMod .icon', 'BLOCK INSIDE BLOCK'],
  ['.standard-object__gigi--fatherdMod .icon--mod', 'BLOCK INSIDE BLOCK WITH SINGLE MODIFIER'],
  ['.standard-object__gigi--fatherdMod .icon__nested-element--nestedMod', 'nestedMod'],
  ['.standard-object__gigi--fatherdMod .standard-object__pippo', 'pippo'],
  ['.standard-object__gigi--fatherdMod .standard-object__pippo--mod', 'mod'],
  ['.standard-object__gigi--fatherdMod .standard-object__test-ele', 'test-ele'],
];
for (const large of [false, true]) {
  test(`h-isolation: ${large ? 'complete regression' : 'minimal sibling leak'}`, () => {
    const input = (preceding) => `@use 'h-isolation' with ($preceding: ${preceding}, $large: ${large});`;
    const alone = rules(compile(`h-${large}-alone`, input(false)));
    const sequence = rules(compile(`h-${large}-sequence`, input(true)));
    assert.deepEqual(sequence[0], ['.standard-object .icon', 'prior sibling']);
    assert.deepEqual(sequence.slice(1), alone, 'A must not change any B selector or declaration');
    assert.deepEqual(alone, large ? regression : [['.standard-object__after', 'after']]);
  });
}

test('j-content using does not implicitly pass a context into another mixin', () => {
  assert.throws(() => compile('j-unavailable-context'), /Undefined variable/);
});

// Values here model public call provenance, not inferred selector strings.
const validation = [
  ['element', false, 'element', 'invalid'],
  ['modifier', false, 'modifier', 'invalid'],
  ['extend', true, 'block', 'invalid'],
  ['element', true, 'block', 'invalid'],
  ['modifier', true, 'block', 'invalid'],
  ['block', false, 'block', 'valid'],
  ['modifier', false, 'block', 'valid'],
  ['block', false, 'modifier', 'valid'],
  ['element', false, 'modifier', 'valid'],
  ['root', false, 'extend', 'deferred'],
  ['extend', true, 'extend', 'deferred'],
  ['before', false, 'element', 'deferred'],
  ['adjacent', false, 'element', 'valid'],
  ['block', false, 'selector', 'deferred'],
];
for (const [kind, underExtend, child, expected] of validation) {
  test(`validation: ${kind}${underExtend ? ' below extend' : ''} -> ${child} is ${expected}`, () => {
    const source = `@use 'proof' as p;
      $context: p.frame(p.atom('icon'), p.suffix(p.atom('icon'), '--m'), (p.atom('outer'),), ${kind}, ${underExtend});
      .verdict { content: '#{p.relation($context, ${child})}'; }`;
    assert.deepEqual(rules(compile(`validation-${kind}-${underExtend}-${child}`, source)), [['.verdict', expected]]);
    if (expected === 'invalid') {
      assert.throws(() => compile('validation-rejection', source + `
        @if p.relation($context, ${child}) == invalid { @error 'SPIKE invalid nesting'; }`), /SPIKE invalid nesting/);
    }
  });
}

test('immutable derived value leaves its parent unchanged', () => {
  const source = `@use 'proof' as p; @use 'sass:map';
    $parent: p.frame(p.atom('a'), p.atom('a'));
    $child: map.merge($parent, (owner: p.atom('b'), subject: p.atom('b'), scope: (p.current($parent),)));
    @include p.emit($child, 'child'); @include p.emit($parent, 'unchanged parent');`;
  assert.deepEqual(rules(compile('immutable-parent', source)), [['.a .b', 'child'], ['.a', 'unchanged parent']]);
});

test('extend ancestry survives intervening element and modifier values', () => {
  const source = `@use 'proof' as p; @use 'sass:map';
    $target: p.frame(p.atom('b'), p.suffix(p.atom('b'), '--m'), (p.atom('a'),), extend, true);
    $part: p.frame(map.get($target, owner), p.suffix(map.get($target, owner), '__item'),
      (p.current($target),), element, map.get($target, under-extend));
    $qualified: map.merge($part, (kind: modifier, subject: p.suffix(map.get($part, subject), '--active')));
    .part-verdict { content: '#{p.relation($part, block)}'; }
    .qualified-verdict { content: '#{p.relation($qualified, block)}'; }`;
  assert.deepEqual(rules(compile('inherited-extend', source)), [['.part-verdict', 'invalid'], ['.qualified-verdict', 'invalid']]);
});

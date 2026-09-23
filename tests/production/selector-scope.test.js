import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { compileString } from 'sass';
import { compileScss } from '../../helpers/compile-scss.js';

const url = new URL('fixture.scss', import.meta.url);
const production = readFileSync(new URL('../../src/core/_bem.scss', import.meta.url), 'utf8');
const q = value => `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
const call = (kind, args, body) => `@include bem.${kind}(${args}) { ${body} }`;
const block = body => call('block', "'card'", body);
const element = body => call('element', "'item'", body);
const qualified = (body, token = ':hover') => call('selector', q(token), body);
const leaf = (name = 'title', value = 'red') => call('element', q(name), `color: ${value};`);
const compile = (body, module = '../../src', config = '') => compileScss(`@use '${module}' as bem ${config}; ${body}`, { url });
const expected = pairs => pairs.map(([selector, color]) => `${selector} {\n  color: ${color};\n}`).join('\n\n');
const parents = [
  ['block', block, '.card'],
  ['element', body => block(element(body)), '.card__item'],
  ['modifier', body => block(call('modifier', "'active'", body)), '.card--active'],
  ['element modifier', body => block(element(call('modifier', "'active'", body))), '.card__item--active'],
  ['extend element', body => block(call('extend', "'icon', 'active'", call('element', "'label'", body))), '.card .icon--active .icon__label', 'icon'],
  ['nested block', body => call('block', "'page'", block(body)), '.page .card'],
];
const qualifiers = [
  [':hover', ':hover'], [':focus', ':focus'], [':hover:focus', ':hover:focus'],
  ['[disabled]', '[disabled]'], ['[disabled]:hover', '[disabled]:hover'],
  ['[data-state="open"]:focus', '[data-state=open]:focus'],
  [':hover[aria-expanded="true"]', ':hover[aria-expanded=true]'], [':focus::before', ':focus::before'],
];
// Promoted parent/qualifier coverage, grouped rather than duplicating 48 test cases.
for (const [parent, wrap, subject, owner = 'card'] of parents) {
  test(`${parent} -> qualified -> element preserves owner and complete scope`, () => {
    for (const [input, serialized] of qualifiers) {
      assert.equal(compile(wrap(qualified(leaf(), input))), expected([[`${subject}${serialized} .${owner}__title`, 'red']]));
    }
  });
}
test('requested icon children keep card ownership under element and modifier parents', () => {
  for (const [, wrap, subject] of parents.slice(1, 4)) {
    assert.equal(compile(wrap(qualified(leaf('icon')))), expected([[`${subject}:hover .card__icon`, 'red']]));
  }
});
test('qualified declarations, child modifiers and later declarations retain order', () => {
  assert.equal(compile(block(qualified(`color: red; ${call('element', "'title'", call('modifier', "'large'", 'color: blue;'))} color: green;`))),
    expected([['.card:hover', 'red'], ['.card:hover .card__title--large', 'blue'], ['.card:hover', 'green']]).replace('\n\n', '\n'));
});
test('double modifiers preserve conjunction and complete outer scope only once', () => {
  assert.equal(compile(call('block', "'page'", block(call('modifier', "'a', 'b'", qualified(call('element', "'title'", call('modifier', "'large', 'bright'", 'color: red;'))))))),
    expected([['.page .card--a.card--b:hover .card__title--large.card__title--bright', 'red']]));
});
for (const [parent, wrap] of parents) {
  test(`direct modifier after qualification remains deferred under ${parent}`, () => {
    assert.throws(() => compile(wrap(qualified(call('modifier', "'active'", 'color: red;')))), /qualified -> modifier is unsupported/);
  });
}
test('nested block explicitly starts a new owner, inheriting qualified scope', () => {
  assert.equal(compile(block(qualified(call('block', "'icon'", `color: red; ${leaf('glyph', 'blue')}`)) + leaf('after', 'green'))),
    expected([['.card:hover .icon', 'red'], ['.card:hover .icon__glyph', 'blue'], ['.card__after', 'green']]).replace('\n\n', '\n'));
});
test('equal-name nested block is still a new lexical block, not a suffix', () => {
  assert.equal(compile(block(qualified(block(leaf())))), expected([['.card:hover .card__title', 'red']]));
});
test('qualified element can delimit a new block without changing direct element/block policy', () => {
  assert.equal(compile(block(element(qualified(call('block', "'icon'", leaf('glyph')))))),
    expected([['.card__item:hover .icon__glyph', 'red']]));
  assert.throws(() => compile(block(element(call('block', "'icon'", '')))), /element -> block is unsupported/);
});
test('nested qualifier composes same subject and restores outer qualified subject', () => {
  assert.equal(compile(block(qualified(qualified(leaf(), ':focus') + leaf('body', 'blue')))),
    expected([['.card:hover:focus .card__title', 'red'], ['.card:hover .card__body', 'blue']]));
});
test('nested qualifiers keep an existing outer scope once', () => {
  assert.equal(compile(call('block', "'page'", block(qualified(qualified(leaf(), '[disabled]'))))),
    expected([['.page .card:hover[disabled] .card__title', 'red']]));
});
test('qualifier scopes across element descendants preserve the original owner', () => {
  assert.equal(compile(block(qualified(call('element', "'item'", qualified(leaf('glyph'), ':focus'))))),
    expected([['.card:hover .card__item:focus .card__glyph', 'red']]));
});
test('extend target ownership and composition survive qualified descendants', () => {
  assert.equal(compile(block(call('extend', "'icon', 'active'", call('element', "'label'", qualified(leaf('glyph')))))),
    expected([['.card .icon--active .icon__label:hover .icon__glyph', 'red']]));
});
for (const bad of [call('block', "'bad'", ''), call('block', "'bad', $layer: 'atoms'", '')]) {
  for (const deep of [false, true]) {
    test(`extend ancestry still rejects block; deeper=${deep}, ${bad}`, () => {
      const body = deep ? call('element', "'glyph'", qualified(bad)) : bad;
      assert.throws(() => compile(block(call('extend', "'icon', 'active'", call('element', "'label'", qualified(body))))), /block is forbidden beneath extend/);
    });
  }
}
test('selector directly under extend and extend under selector stay deferred', () => {
  assert.throws(() => compile(block(call('extend', "'icon', 'active'", qualified(leaf())))), /extend -> qualified is unsupported/);
  assert.throws(() => compile(block(qualified(call('extend', "'icon', 'active'", '')))), /qualified -> extend is unsupported/);
});
for (const relation of ['>', '+', '~']) {
  test(`qualified -> ${relation} is deferred at every original parent`, () => {
    for (const [, wrap] of parents) assert.throws(() => compile(wrap(qualified(call('selector', q(relation), leaf('child'))))), /qualified -> pending-relation is unsupported/);
  });
  test(`qualified -> element -> ${relation} -> element retains normal relation semantics`, () => {
    assert.equal(compile(block(qualified(element(call('selector', q(relation), leaf('child')))) + leaf('after', 'blue'))),
      expected([[`.card:hover .card__item ${relation} .card__child`, 'red'], ['.card__after', 'blue']]));
  });
  test(`resolved ${relation} -> qualified -> element completes relation scope once`, () => {
    assert.equal(compile(block(element(call('selector', q(relation), call('element', "'child'", qualified(leaf('glyph'))))))),
      expected([[`.card__item ${relation} .card__child:hover .card__glyph`, 'red']]));
  });
  test(`pending ${relation} keeps bare declarations and qualifier children rejected`, () => {
    assert.throws(() => compile(block(element(call('selector', q(relation), 'color: red;')))), /Declarations may only be used within style rules/);
    assert.throws(() => compile(block(element(call('selector', q(relation), qualified('color: red;'))))), /pending-relation -> qualified is unsupported/);
  });
}
test('sibling scopes, later roots, repeated names and nested frames are isolated', () => {
  const body = block(qualified(leaf()) + leaf('body', 'blue') + qualified(leaf('body', 'green'), ':focus'))
    + call('block', "'other'", leaf('title', 'black')) + block(leaf('title', 'red'));
  assert.equal(compile(body), expected([
    ['.card:hover .card__title', 'red'], ['.card__body', 'blue'], ['.card:focus .card__body', 'green'],
    ['.other__title', 'black'], ['.card__title', 'red'],
  ]));
});
for (const branch of ['', leaf().replace('color: red;', ''), qualified(''), call('block', "'icon'", '')]) {
  test(`empty qualified branch emits nothing: ${branch}`, () => {
    assert.equal(compile(block(qualified(branch))), '');
    assert.equal(compile(block(qualified(branch) + leaf('after'))), expected([['.card__after', 'red']]));
  });
}
test('custom separators apply to owner-based children, not to qualifiers', () => {
  assert.equal(compile(block(qualified(call('element', "'title'", call('modifier', "'large'", 'color: red;')))), '../../src',
    "with ($element-separator: '-', $modifier-separator: '_')"), expected([['.card:hover .card-title_large', 'red']]));
});
test('root layers and conditional wrappers survive the unchanged emission boundary', () => {
  const source = call('block', "'card', $layer: 'atoms'", `@media (width > 1px) { ${qualified(leaf())} }`);
  assert.equal(compile(source), '@layer atoms {\n  @media (width > 1px) {\n    .card:hover .card__title {\n      color: red;\n    }\n  }\n}');
  assert.throws(() => compile(block(qualified(call('block', "'icon', $layer: 'atoms'", '')))), /explicit layer selection is supported only on the root/);
});
test('context maps restore exactly, not just to an equivalent emitted selector', () => {
  // These test-only assertions are injected into an in-memory module, never exported by the production entrypoint.
  const probes = `
    @mixin probe-frame($owner, $subject, $scope, $kind, $under: false, $relation: null) {
      $expected: (owner: $owner, subject: $subject, scope: $scope, kind: $kind, under-extend: $under);
      @if $relation != null { $expected: map.set($expected, relation, $relation); }
      @if -current-context() != $expected { @error 'Frame mismatch: #{meta.inspect(-current-context())} != #{meta.inspect($expected)}'; }
    }
    @mixin probe-restore {
      $before: $-context-stack;
      @content;
      @if $-context-stack != $before { @error 'Stack did not restore exactly'; }
    }
  `;
  const frame = (owner, subject, scope, kind, under = false, relation = 'null') =>
    `@include bem.probe-frame(${owner ? `s.parse('${owner}')` : 'null'}, ${subject ? `s.parse('${subject}')` : 'null'}, ${scope}, ${kind}, ${under}, ${relation});`;
  const root = frame(null, null, '()', 'root');
  const body = `${root} @include bem.probe-restore { ${block(
    frame('.card', '.card', '()', 'block') + `@include bem.probe-restore { ${qualified(
      frame('.card', '.card:hover', '()', 'qualified') + `@include bem.probe-restore { ${call('element', "'title'",
        frame('.card', '.card__title', "(s.parse('.card:hover'),)", 'element'))} }`
      + `@include bem.probe-restore { ${call('block', "'icon'", frame('.icon', '.icon', "(s.parse('.card:hover'),)", 'block'))} }`
      + `@include bem.probe-restore { ${element(call('selector', "'>'",
        frame('.card', '.card__item', "(s.parse('.card:hover'),)", 'pending-relation', false, "'>'")
        + leaf('resolved')))} }`
      + `@include bem.probe-restore { ${qualified(frame('.card', '.card:hover:focus', '()', 'qualified'), ':focus')} }`
    )} }` + frame('.card', '.card', '()', 'block')
  )} } ${root}
  @include bem.probe-restore { ${block(call('extend', "'icon', 'active'", call('element', "'label'", qualified(call('element', "'glyph'",
    frame('.icon', '.icon__glyph', "(s.parse('.card .icon--active .icon__label:hover'),)", 'element', true))))))} } ${root}`;
  assert.equal(compileString(`@use 'probe:core' as bem; @use 'sass:selector' as s; ${body}`, {
    importers: [{ canonicalize: u => u === 'probe:core' ? new URL(u) : null, load: () => ({ contents: production + probes, syntax: 'scss' }) }],
  }).css, expected([['.card:hover .card__item > .card__resolved', 'red']]));
});

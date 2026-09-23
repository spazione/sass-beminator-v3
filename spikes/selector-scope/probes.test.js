import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { compileString } from 'sass';
import { compileScss } from '../../helpers/compile-scss.js';

const url = new URL('fixture.scss', import.meta.url);
const proof = readFileSync(new URL('_proof.scss', import.meta.url), 'utf8');
const historical = proof.split('\n').slice(3).join('\n')
  .replace('qualified: (element, block, qualified), pending-relation:', 'qualified: (), pending-relation:')
  .replace('$parent-kind == modifier or $parent-kind == extend or $parent-kind == qualified {', '$parent-kind == modifier or $parent-kind == extend {');
const production = readFileSync(new URL('../../src/core/_bem.scss', import.meta.url), 'utf8');
const q = value => `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
const call = (kind, args, body) => `@include bem.${kind}(${args}) { ${body} }`;
const block = body => call('block', "'card'", body);
const element = body => call('element', "'item'", body);
const qualified = (body, token = ':hover') => call('selector', q(token), body);
const leaf = (name = 'title', value = 'red') => call('element', q(name), `color: ${value};`);
const compile = (body, module = './index', config = '') => compileScss(`@use '${module}' as bem ${config}; ${body}`, { url });
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
for (const [parent, wrap, subject, owner = 'card'] of parents) {
  for (const [input, serialized] of qualifiers) {
    test(`${parent} -> ${input} -> element preserves owner and exact scope`, () => {
      assert.equal(compile(wrap(qualified(leaf(), input))), expected([[`${subject}${serialized} .${owner}__title`, 'red']]));
    });
  }
}
test('baseline preserves historical rejection evidence and matches adopted production', () => {
  const source = block(qualified(leaf()));
  assert.equal(compile(source), '.card:hover .card__title {\n  color: red;\n}');
  assert.equal(compile(source, '../../src'), compile(source));
  assert.throws(() => compileString(`@use 'historical:core' as bem; ${source}`, {
    importers: [{ canonicalize: u => u === 'historical:core' ? new URL(u) : null, load: () => ({ contents: historical, syntax: 'scss' }) }],
  }), /nesting qualified -> element is unsupported/);
});
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
test('raw Sass re-entry loses hover; explicit selector scope preserves it', () => {
  const raw = block(`&:hover { ${leaf()} }`);
  assert.equal(compile(raw), expected([['.card__title', 'red']]));
  assert.equal(compile(raw, '../../src'), compile(raw));
  assert.equal(compile(block(qualified(leaf()))), expected([['.card:hover .card__title', 'red']]));
});
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
const rejected = ['.foo', '#foo', 'button', '*', '%placeholder', '.foo:hover', 'button:hover', '.foo .bar',
  ':hover .foo', ':hover, :focus', '.theme &', '&:hover'];
for (const token of rejected) {
  test(`unchanged structural rejection: ${token}`, () => {
    for (const module of ['./index', '../../src']) assert.throws(() => compile(block(qualified('color: red;', token)), module));
  });
}
for (const token of [':is(.x)', ':where(.x)', ':has(.x)', ':not(.x)', ':nth-child(2n)', String.raw`:h\61 s(.x)`]) {
  test(`functional pseudo remains deferred: ${token}`, () => {
    for (const module of ['./index', '../../src']) assert.throws(() => compile(block(qualified('', token)), module), /functional pseudo selectors are unsupported/);
  });
}
test('accepted terminal forms are byte-identical to production', () => {
  for (const [token] of qualifiers) for (const [, wrap] of parents) {
    const source = wrap(qualified('color: red;', token));
    assert.equal(compile(source), compile(source, '../../src'));
  }
});
test('direct element/element and modifier/modifier remain invalid', () => {
  assert.throws(() => compile(block(element(leaf()))), /invalid nesting: element -> element/);
  assert.throws(() => compile(block(call('modifier', "'a'", call('modifier', "'b'", '')))), /invalid nesting: modifier -> modifier/);
});
test('custom separators apply to owner-based children, not to qualifiers', () => {
  assert.equal(compile(block(qualified(call('element', "'title'", call('modifier', "'large'", 'color: red;')))), './index',
    "with ($element-separator: '-', $modifier-separator: '_')"), expected([['.card:hover .card-title_large', 'red']]));
});
test('root layers and conditional wrappers survive the unchanged emission boundary', () => {
  const source = call('block', "'card', $layer: 'atoms'", `@media (width > 1px) { ${qualified(leaf())} }`);
  assert.equal(compile(source), '@layer atoms {\n  @media (width > 1px) {\n    .card:hover .card__title {\n      color: red;\n    }\n  }\n}');
  assert.throws(() => compile(block(qualified(call('block', "'icon', $layer: 'atoms'", '')))), /explicit layer selection is supported only on the root/);
});
test('context maps restore exactly, not just to an equivalent emitted selector', () => {
  // These test-only assertions are injected into an in-memory module, never exported by the spike entrypoint.
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
    importers: [{ canonicalize: u => u === 'probe:core' ? new URL(u) : null, load: () => ({ contents: proof + probes, syntax: 'scss' }) }],
  }).css, expected([['.card:hover .card__item > .card__resolved', 'red']]));
});
test('spike preserves its two-rule historical delta and matches adopted production', () => {
  assert.equal(createHash('sha256').update(historical).digest('hex'), '3a73cbdbb227f0f7a0d1d7a092eea4c47510694b3361378f234ddc2921cce6cd');
  const restored = proof.split('\n').slice(3).join('\n')
    .replace('qualified: (element, block, qualified), pending-relation:', 'qualified: (), pending-relation:')
    .replace('$parent-kind == modifier or $parent-kind == extend or $parent-kind == qualified {', '$parent-kind == modifier or $parent-kind == extend {');
  assert.equal(restored, historical);
  assert.equal(proof.split('\n').slice(3).join('\n'), production);
  assert.deepEqual([...proof.matchAll(/(\$[\w-]+):[^;]*!global/g)].map(m => m[1]), ['$-context-stack', '$-context-stack']);
  assert.equal([...proof.matchAll(/@at-root/g)].length, 1);
  assert.equal(compile(`@use 'sass:meta'; @use 'sass:list';
    @if list.length(meta.module-mixins(bem)) != 6 or list.length(meta.module-variables(bem)) != 3 or list.length(meta.module-functions(bem)) != 0 { @error 'Public surface changed'; }`), '');
});

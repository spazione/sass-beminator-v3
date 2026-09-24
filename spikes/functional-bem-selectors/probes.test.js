import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { compileString, info } from 'sass';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const production = read('../../src/core/_bem.scss');
const fragment = read('_experiment.scss');
const options = {
  url: new URL('fixture.scss', import.meta.url),
  importers: [{
    canonicalize: url => url === 'spike:core' ? new URL(url) : null,
    load: () => ({ contents: production + '\n' + fragment, syntax: 'scss' }),
  }],
};
const compile = (body, config = '') => compileString(`@use 'spike:core' as bem ${config}; ${body}`, options).css;
const call = (name, args, body = 'color: red;') => `@include bem.${name}(${args}) { ${body} }`;
const block = body => call('block', "'card'", body);
const element = body => block(call('element', "'item'", body));
const css = selector => `${selector} {\n  color: red;\n}`;

test('exact pinned compiler and unchanged production core', () => {
  assert.match(info, /dart-sass\s+1\.104\.1\s/);
  assert.equal(createHash('sha256').update(production).digest('hex'), '7379354cda28ad2ae5a002f441a75d548ecc2b8aa76166cc5355be4ce4edf5be');
});
test('real layered game-card fixture, including surrounding declarations', () => {
  assert.equal(compileString(read('game-card.scss'), options).css, `@layer molecules {
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
test('has uses owner independently of immediate subject origin, for all four relations', () => {
  const parents = [
    [block, '.card'], [element, '.card__item'],
    [body => block(call('modifier', "'active'", body)), '.card--active'],
    [body => element(call('modifier', "'active', 'large'", body)), '.card__item--active.card__item--large'],
    [body => element(call('selector', "':hover'", body)), '.card__item:hover'],
    [body => block(call('selector', "':hover'", body)), '.card:hover'],
    [body => block(call('modifier', "'active'", call('selector', "':hover'", body))), '.card--active:hover'],
  ];
  for (const [wrap, subject] of parents) {
    for (const relation of [null, '>', '+', '~']) {
      assert.equal(compile(wrap(call('has', `element, 'details', $relation: ${relation === null ? 'null' : `'${relation}'`}`))),
        css(`${subject}:has(${relation === null ? '' : `${relation} `}.card__details)`));
    }
  }
});
test('both has/selector orders, qualified re-entry and scoped ancestry', () => {
  assert.equal(compile(element(call('has', "element, 'details', $relation: '+'", call('selector', "':hover'")))), css('.card__item:has(+ .card__details):hover'));
  assert.equal(compile(element(call('selector', "':hover'", call('has', "element, 'details', $relation: '+'")))), css('.card__item:hover:has(+ .card__details)'));
  assert.equal(compile(block(call('has', "element, 'details'", call('element', "'title'")))), css('.card:has(.card__details) .card__title'));
  assert.equal(compile(call('block', "'page'", block(call('has', "element, 'details'", call('element', "'title'"))))), css('.page .card:has(.card__details) .card__title'));
});
test('custom separators and explicit block/modified-element targets are constructible', () => {
  assert.equal(compile(element(call('has', "element, 'details', $modifier: 'selected'")), "with ($element-separator: '-', $modifier-separator: '_')"), css('.card-item:has(.card-details_selected)'));
  assert.equal(compile(block(call('has', "block, 'footer', $relation: '+'"))), css('.card:has(+ .footer)'));
  assert.equal(compile(block(call('has', "block, 'footer', $modifier: 'open'"))), css('.card:has(.footer--open)'));
});
test('filter mixin names are legal; scalar and homogeneous list targets serialize exactly', () => {
  for (const pseudo of ['not', 'is', 'where']) {
    assert.equal(compile(block(call(pseudo, "modifier, 'disabled'"))), css(`.card:${pseudo}(.card--disabled)`));
    assert.equal(compile(element(call(pseudo, "modifier, 'disabled'"))), css(`.card__item:${pseudo}(.card__item--disabled)`));
    assert.equal(compile(block(call(pseudo, "modifier, ('compact', 'dense')"))), css(`.card:${pseudo}(.card--compact, .card--dense)`));
    assert.equal(compile(element(call(pseudo, "modifier, 'disabled'", call('selector', "':hover'")))), css(`.card__item:${pseudo}(.card__item--disabled):hover`));
    assert.equal(compile(block(call(pseudo, "modifier, 'disabled'", call('element', "'title'")))), css(`.card:${pseudo}(.card--disabled) .card__title`));
    assert.throws(() => compile(block(call('selector', "':hover'", call(pseudo, "modifier, 'disabled'")))), /requires a direct block or element/);
    assert.throws(() => compile(element(call('modifier', "'active'", call(pseudo, "modifier, 'disabled'")))), /requires a direct block or element/);
  }
});
test('positional, named and generic spellings are equivalent for all four anchors', () => {
  for (const [pseudo, type, name, relation, wrap, expected] of [
    ['has', 'element', "'details'", "'+'", body => call('block', "'game-card'", call('element', "'thumbnail'", body)), '.game-card__thumbnail:has(+ .game-card__details)'],
    ['not', 'modifier', "'disabled'", 'null', block, '.card:not(.card--disabled)'],
    ['is', 'modifier', "('compact', 'dense')", 'null', block, '.card:is(.card--compact, .card--dense)'],
    ['where', 'modifier', "'compact'", 'null', block, '.card:where(.card--compact)'],
  ]) {
    const extra = pseudo === 'has' ? `, $relation: ${relation}` : '';
    for (const body of [call(pseudo, `${type}, ${name}${extra}`), call(pseudo, `$type: ${type}, $name: ${name}${extra}`), call('condition', `'${pseudo}', ${type}, ${name}, $relation: ${relation}`)]) {
      assert.equal(compile(wrap(body)), css(expected));
    }
  }
});
test('extend descendants retain new owner and ancestry; direct extend/pending remain deferred', () => {
  assert.equal(compile(block(call('extend', "'icon', 'active'", call('element', "'label'", call('has', "element, 'details'"))))), css('.card .icon--active .icon__label:has(.icon__details)'));
  assert.throws(() => compile(block(call('extend', "'icon', 'active'", call('has', "element, 'details'")))), /extend -> qualified is unsupported/);
  assert.throws(() => compile(element(call('selector', "'+'", call('has', "element, 'details'")))), /pending-relation -> qualified is unsupported/);
  assert.throws(() => compile(block(call('extend', "'icon', 'active'", call('element', "'label'", call('has', "element, 'details'", call('block', "'bad'")))))), /block is forbidden beneath extend/);
});
test('semantic errors are explicit and production parser remains closed', () => {
  for (const [args, error] of [["modifier, 'active'", /ambiguous/], ["element, 'details', $relation: '||'", /unsupported relation/], ["element, ''", /nonempty BEM/], ["unknown, 'x'", /target kind/], ["element, ('a', 'b')", /one target/]]) {
    assert.throws(() => compile(block(call('has', args))), error);
  }
  assert.throws(() => compile(call('has', "element, 'details'")), /root -> qualified/);
  assert.throws(() => compile(block(call('is', 'modifier, ()'))), /must not be empty/);
  for (const pseudo of ['::before', ':before']) {
    assert.throws(() => compile(block(call('selector', `'${pseudo}'`, call('has', "element, 'details'")))), /pseudo-element/);
  }
  assert.throws(() => compile(block(call('selector', "':has(.card__details)'"))), /functional pseudo selectors are unsupported/);
});
test('qualified frame shape and restoration use existing stack and emission boundary', () => {
  const probe = `@include bem.spike-qualified-frame('.card', '.card:has(.card__details)');`;
  assert.equal(compile(`@include bem.spike-restoration { ${block(call('has', "element, 'details'", probe) + call('element', "'after'"))} }`), css('.card__after'));
});
test('native primitives: exact values and known browser-validity gap', () => {
  const source = `@use 'sass:selector'; @use 'sass:meta'; .probe {
    relative: meta.inspect(selector.nest('+', '.card__details'));
    parsed: meta.inspect(selector.parse(':has(+ .card__details)'));
    appended: meta.inspect(selector.append('.card', ':where(.card--compact)'));
    replaced: meta.inspect(selector.replace('.card:hover', '.card', '.tile'));
    unified: meta.inspect(selector.unify('.card', '.card--compact'));
    simples: meta.inspect(selector.simple-selectors('.card:has(+ .card__details)'));
    nested-has: meta.inspect(selector.parse(':has(:has(.x))'));
    pseudo-element: meta.inspect(selector.append('.card::before', ':has(.x)'));
  }`;
  assert.equal(compileString(source).css, `.probe {
  relative: (+ .card__details,);
  parsed: (:has(+ .card__details),);
  appended: (.card:where(.card--compact),);
  replaced: (.tile:hover,);
  unified: (.card.card--compact,);
  simples: .card, :has(+ .card__details);
  nested-has: (:has(:has(.x)),);
  pseudo-element: (.card::before:has(.x),);
}`);
  assert.throws(() => compileString("@use 'sass:selector'; .probe { x: selector.parse(':has('); }"), /expected/);
});

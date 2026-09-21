// Observations only: not acceptance tests or approval of new v3 semantics.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileScss } from '../../helpers/compile-scss.js';
import { projectRoot } from '../../helpers/project-paths.js';

const output = join(projectRoot, 'tmp/core-hardening');
mkdirSync(output, { recursive: true });
const observations = [];
const url = new URL('fixture.scss', import.meta.url);
const wrap = (body) => `@include bem.block('card') { ${body} }`;
function observe(id, body) {
  const source = `@use '../../src' as bem;\n${body}`;
  try { observations.push({ id, source, css: compileScss(source, { url }) }); }
  catch (error) { observations.push({ id, source, error: error.message }); }
}
const allOperations = `
  content: 'block';
  @include bem.element('item') {
    content: 'element';
    @include bem.modifier('active') { content: 'modifier'; }
    @include bem.selector(':before') { content: 'before'; }
    @include bem.selector('+') { @include bem.element('other') { content: 'adjacent'; } }
  }
  @include bem.extend('icon', 'm') { @include bem.element('label') { content: 'extend'; } }
  @include bem.element('after') { content: 'after'; }
`;
for (const [name, rule] of [
  ['media', '@media (min-width: 40rem)'],
  ['supports', '@supports (display: grid)'],
  ['container', '@container card (min-width: 20rem)'],
]) {
  observe(`${name}-outside`, `${rule} { ${wrap(allOperations)} }`);
  observe(`${name}-inside`, wrap(`${rule} { ${allOperations} }
    @include bem.element('outside') { content: 'outside'; }`));
  observe(`${name}-pending`, wrap(`@include bem.element('item') {
    @include bem.selector('+') { ${rule} { @include bem.element('other') { content: 'right'; } } }
    @include bem.modifier('after') { content: 'after'; }
  }`));
}
observe('nested-media-supports', `@media (min-width: 40rem) {
  ${wrap(`@supports (display: grid) { @include bem.element('item') { content: 'inside'; } }
    @include bem.element('after') { content: 'after'; }`)}
}`);
observe('media-ancestry-error', wrap(`@include bem.extend('icon', 'm') {
  @media (min-width: 40rem) { @include bem.element('item') {
    @supports (display: grid) { @include bem.modifier('active') { @include bem.block('bad') {} } }
  } }
}`));
observe('raw-child-rule', wrap("> img { content: 'raw'; } @include bem.element('after') { content: 'after'; }"));
observe('raw-parent-suffix', wrap("&:hover { content: 'raw'; } &__manual { content: 'manual'; }"));
observe('bem-inside-raw-hover', wrap("&:hover { @include bem.element('title') { content: 'title'; } }"));
observe('bem-inside-raw-descendant', wrap(".wrapper { @include bem.block('icon') { content: 'icon'; } @include bem.element('title') { content: 'title'; } }"));
observe('root-inside-raw-wrapper', ".theme { @include bem.block('card') { content: 'card'; } }");
observe('modifier-inside-raw-hover', wrap("@include bem.element('item') { &:hover { @include bem.modifier('active') { content: 'active'; } } }"));
observe('raw-conditional-before-bem', wrap("&:has(.featured) { @include bem.element('title') { content: 'title'; } }"));
observe('raw-nesting-does-not-change-kind', wrap("@include bem.element('item') { .wrapper { @include bem.element('other') {} } }"));
observe('pending-direct-declaration', wrap("@include bem.element('item') { @include bem.selector('+') { color: red; } }"));
observe('pending-raw-rule', wrap("@include bem.element('item') { @include bem.selector('+') { .manual { content: 'manual'; } } }"));
observe('pending-raw-parent-reference', wrap("@include bem.element('item') { @include bem.selector('+') { & { content: 'raw'; } } }"));
observe('pending-font-face-descriptor', `@font-face { ${wrap("@include bem.element('item') { @include bem.selector('+') { color: red; } }")} }`);
for (const [id, argument] of [
  ['hyphen', "'card-item'"], ['underscore', "'_Card_2'"], ['digit-tail', "'card2'"],
  ['leading-hyphen', "'-card'"], ['leading-double-hyphen', "'--card'"],
  ['unicode', "'café'"], ['unicode-cjk', "'卡片'"],
  ['escaped-ascii-quoted', String.raw`'c\61 rd'`],
  ['escaped-ascii-unquoted', String.raw`c\61 rd`],
  ['escaped-digit', String.raw`'\31 card'`], ['escaped-colon', String.raw`'card\:item'`],
  ['number', '12'], ['digit-string', "'12'"], ['list', "('card', 'other')"],
  ['empty', "''"], ['null', 'null'], ['space', "'card item'"], ['selector-list', "'card,.other'"],
  ['already-bem', "'card__item--active'"], ['custom-prefix', "'c-card'"],
]) observe(`name-${id}`, `@include bem.block(${argument}) { content: 'name'; }`);
observe('name-variable-interpolation', `$base: 'card'; $suffix: 2;
  @include bem.block($base) { @include bem.element('title-#{$suffix}') { content: 'value'; } }
  @include bem.block(#{$base}-#{$suffix}) { content: 'interpolation'; }`);
observe('named-modifier-supported-keywords', wrap("@include bem.modifier($mod1: 'a', $mod2: 'b') { content: 'named'; }"));
observe('named-modifier-obsolete-v3-keywords', wrap("@include bem.modifier($name: 'a', $second: 'b') { content: 'named'; }"));
observe('exports', `@use 'sass:meta'; @use 'sass:map'; @use '../../src/core/bem' as core;
  .surface { entry-mixins: meta.inspect(map.keys(meta.module-mixins('bem')));
    entry-functions: meta.inspect(map.keys(meta.module-functions('bem')));
    entry-variables: meta.inspect(map.keys(meta.module-variables('bem')));
    deep-mixins: meta.inspect(map.keys(meta.module-mixins('core')));
    deep-functions: meta.inspect(map.keys(meta.module-functions('core')));
    deep-variables: meta.inspect(map.keys(meta.module-variables('core'))); }
  @include bem.block('card') { @include core.element('title') { content: 'same module'; } }
`);
observe('private-derive', "@use '../../src/core/bem' as core; $value: core.-derive(null, null, null, null, null);");
observe('configuration-unavailable', "@use '../../src' as configured with ($element-separator: '--');");

// Observations are generated under ignored tmp/, never approved snapshots.
writeFileSync(join(output, 'production.json'), JSON.stringify(observations, null, 2) + '\n');
for (const item of observations) console.log(`${item.id}: ${item.error ? item.error.split('\n')[0] : item.css.replace(/\s+/g, ' ')}`);
assert(observations.filter((item) => /^(media|supports|container)-(outside|inside|pending)$/.test(item.id)).every((item) => !item.error));
// Lock the observed raw-boundary surprises without promoting them into SPEC.
const compact = (css) => css.replace(/\s+/g, ' ').trim();
for (const [id, expected] of [
  ['bem-inside-raw-hover', '.card__title { content: "title"; }'],
  ['root-inside-raw-wrapper', '.card { content: "card"; }'],
  ['pending-raw-parent-reference', '.card__item { content: "raw"; }'],
  ['name-escaped-ascii-quoted', '.card { content: "name"; }'],
]) assert.equal(compact(observations.find((item) => item.id === id).css), expected);
for (const name of ['media', 'supports', 'container']) {
  const outside = observations.find((item) => item.id === `${name}-outside`).css;
  const inside = observations.find((item) => item.id === `${name}-inside`).css;
  assert.equal(compact(inside), `${compact(outside)} .card__outside { content: "outside"; }`);
}
console.log(`${observations.length} production observations recorded.`);

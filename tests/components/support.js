import { fileURLToPath } from 'node:url';
import { compileScss } from '../../helpers/compile-scss.js';

const url = new URL('probe.scss', import.meta.url);
const mapsUrl = fileURLToPath(new URL('fixtures/_maps.scss', import.meta.url));
export const setup = `@use 'sass:map'; @use '${mapsUrl}' as maps;
$skins: maps.$btnSkins; $sizes: maps.$btnSizes;`;
export const call = (args = '', content = 'margin-bottom: 10px;') =>
  `@include button.btn('play', $skins, $sizes${args}) { ${content} }`;
export const wrap = (mixin, args, body) => `@include bem.${mixin}(${args}) { ${body} }`;
export const block = body => wrap('block', "'card'", body);
export const compile = (body, config = '', extra = '') => compileScss(
  `@use '../../src/index' as bem ${config}; @use '../../components/button'; ${setup} ${extra} ${body}`, { url });
export const iconMaps = `$sizes: map.set($sizes, vars, size, medium, (height: 44px, icon-size: 1em, gap: 10px));
$skins: map.set($skins, vars, primary, (
  shared: (default: (color: red, icon-color: pink, background-color: white), focus: (icon-color: blue)),
  enabled: (default: (icon-color: red), hover: (background-color: blue, icon-color: pink, color: white)),
  disabled: (active: (icon-color: gray))));`;

// Only blank lines between flat rules differ because v3 enters element once.
export const css = value => value.replace(/}\n\n(?=[.#])/g, '}\n');
export const comparisons = [
  ['representative', ", $icon: 'false'", ''],
  ['defaults', '', ''],
  ['small secondary, ignored metadata and leaf values', ", 'small', 'secondary', 'false'",
    `$skins: map.set($skins, prefix, 'ignored'); $sizes: map.set($sizes, prefix, 'ignored');
     $skins: map.set($skins, vars, secondary, (shared: (default: (border: 999px)), focus: (default: (opacity: 0))));`],
  ['shared after states', '', `$skins: map.set($skins, vars, primary, (enabled: (hover: (color: red)), shared: (default: (color: blue))));`],
  ['absent shared omits sizes and content', '', `$skins: map.set($skins, vars, primary, (focus: (default: (color: red))));`],
  ['shared non-default style', '', `$skins: map.set($skins, vars, primary, (shared: (hover: (color: red), default: (color: blue))));`],
  ['icon-color alone false does not suppress', ", $icon: 'false'", `$skins: map.set($skins, vars, primary, (shared: (default: (icon-color: red))));`],
  ...['true', 'false'].flatMap(icon => ['left', 'right'].map(align =>
    [`icons ${icon} ${align}`, `, $icon: '${icon}', $icon-align: '${align}'`, iconMaps])),
];
export const parents = [
  ['block', block, '.card__btn-play'],
  ['modifier', body => block(wrap('modifier', "'active'", body)), '.card--active .card__btn-play'],
  ['qualified', body => block(wrap('selector', "':hover'", body)), '.card:hover .card__btn-play'],
  ['has-qualified', body => block(wrap('has', "element, 'details'", body)), '.card:has(.card__details) .card__btn-play'],
  ['extend', body => block(wrap('extend', "'icon', 'active'", body)), '.card .icon--active .icon__btn-play'],
  ...['+', '>', '~'].map(relation => [`pending ${relation}`, body => block(wrap('element', "'left'", wrap('selector', `'${relation}'`, body))), `.card__left ${relation} .card__btn-play`]),
  ['nested scope', body => wrap('block', "'page'", block(body)), '.page .card__btn-play'],
];
export const plain = 'height: var(--btn-size-medium-height) !important; color: var(--btn-primary-shared-default-color) !important; margin-bottom: 10px;';
export const minimal = '$sizes: (vars: (size: (medium: (height: 1px)))); $skins: (vars: (primary: (shared: (default: (color: red)))));';

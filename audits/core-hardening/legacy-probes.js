// READ ONLY legacy observations, separate from historical characterization artifacts.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileLegacy } from '../../helpers/legacy.js';
import { projectRoot } from '../../helpers/project-paths.js';
const output = join(projectRoot, 'tmp/core-hardening');
mkdirSync(output, { recursive: true });
const observations = [];
const bodies = {
  block: "@include bem.block('card') { content: 'block'; }",
  element: "@include bem.block('card') { @include bem.element('item') { content: 'element'; } }",
  modifier: "@include bem.block('card') { @include bem.modifier('a', 'b') { content: 'modifier'; } }",
  'element-modifier': "@include bem.block('card') { @include bem.element('item') { @include bem.modifier('a', 'b') { content: 'modified'; } } }",
  before: "@include bem.block('card') { @include bem.element('item') { @include bem.selector(':before') { content: 'before'; } } }",
  adjacent: "@include bem.block('card') { @include bem.element('item') { @include bem.selector('+') { @include bem.element('other') { content: 'adjacent'; } } } }",
  extend: "@include bem.block('card') { @include bem.extend('icon', 'a', 'b') { content: 'extend'; @include bem.element('item') { content: 'element'; } } }",
  'nested-modifier-element': "@include bem.block('page') { @include bem.block('card') { @include bem.modifier('active') { @include bem.element('item') { content: 'nested'; } } } }",
};
function observe(id, source) {
  try { observations.push({ id, source, css: compileLegacy(source) }); }
  catch (error) { observations.push({ id, source, error: error.message }); }
}
for (const [id, source] of Object.entries(bodies)) {
  observe(`${id}-default`, source);
  observe(`${id}-custom`, `bem.$element-separator: '--'; bem.$modifier-separator: '-';\n${source}`);
}
observe('debug', `bem.$debug: true; ${bodies.element}`);
observe('where-overrides', `bem.$where-prefix: ':is('; bem.$where-suffix: ')'; ${bodies.element}`);
observe('where-mode-public-assignment', `bem.$where-mode: true; ${bodies.element}`);
for (const debug of [false, true]) observe(`error-debug-${debug}`, `bem.$debug: ${debug}; @include bem.block('card') { @include bem.extend('icon', 'm') { @include bem.block('bad') {} } }`);
writeFileSync(join(output, 'legacy.json'), JSON.stringify(observations, null, 2) + '\n');
for (const item of observations) console.log(`${item.id}: ${item.error ? item.error.split('\n')[0] : item.css.replace(/\s+/g, ' ')}`);
console.log(`${observations.length} legacy observations recorded.`);

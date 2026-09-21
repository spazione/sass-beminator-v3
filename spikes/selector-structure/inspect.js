// Raw Sass observations, not acceptance of these values as BEMinator inputs.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileScss } from '../../helpers/compile-scss.js';
import { projectRoot } from '../../helpers/project-paths.js';
const output = join(projectRoot, 'tmp/selector-structure');
mkdirSync(output, { recursive: true });
const tokens = [':hover', ':focus', ':focus-visible', ':active', ':disabled', ':before', ':after', '::before', '::after',
  '[disabled]', "[data-state='open']", "[data-note=':has(.x), > (']", ':has(.foo)', ':not(.foo)', ':is(.foo,.bar)',
  ':where(.foo)', ':nth-child(2n + 1)', '.foo', '.foo .bar', '.theme &', '&:hover', ':hover:focus', ':hover, :focus',
  'button:hover', '#id', '*', '%placeholder', '+', '>', '~', '||', ' ', '', ':made-up', '::made-up', ':HOVER',
  String.raw`:h\6f ver`, String.raw`:h\61 s(.foo)`, ':hover/*comment*/', '[broken', ':hover > .child', ':hover::before'];
const quote = (s) => `'${s.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
const results = [];
for (const token of tokens) {
  const source = `@use 'sass:selector'; @use 'sass:list'; @use 'sass:meta';
    $parsed: selector.parse(${quote(token)});
    .probe { parsed: meta.inspect($parsed); complexes: list.length($parsed);
      first-length: list.length(list.nth($parsed, 1));
      @if list.length($parsed) == 1 and list.length(list.nth($parsed, 1)) == 1 and not list.index(('+', '>', '~'), ${quote(token)}) {
        simples: meta.inspect(selector.simple-selectors(list.nth(list.nth($parsed, 1), 1)));
      }
    }`;
  const row = { token };
  try { row.structure = compileScss(source); } catch (error) { row.parseError = error.message; }
  try {
    row.append = compileScss(`@use 'sass:selector'; #{selector.append('.card__item', ${quote(token)})} { content: 'append'; }`);
  } catch (error) { row.appendError = error.message; }
  results.push(row);
}
for (const token of ['+', '>', '~']) {
  results.push({ relation: token, css: compileScss(`@use 'sass:selector'; #{selector.nest('.page .card__item', ${quote(token)}, '.card__other')} { content: 'relation'; }`) });
}
for (const [first, second] of [[':hover', ':before'], ['[disabled]', ':focus'], ['::before', '::after'], [':before', ':hover']]) {
  results.push({ chain: [first, second], css: compileScss(`@use 'sass:selector'; #{selector.append(selector.append('.card', ${quote(first)}), ${quote(second)})} { content: 'chain'; }`) });
}
writeFileSync(join(output, 'primitives.json'), JSON.stringify(results, null, 2) + '\n');
for (const row of results) console.log(JSON.stringify(row));

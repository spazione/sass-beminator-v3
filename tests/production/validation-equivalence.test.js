import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { compileString } from 'sass';

// Frozen pre-optimization reference. Never silently refresh this fixture.
const previous = readFileSync(new URL('../../benchmarks/references/v3-before-validation.scss', import.meta.url), 'utf8');
const current = readFileSync(new URL('../../src/core/_bem.scss', import.meta.url), 'utf8');
assert.equal(createHash('sha256').update(previous).digest('hex'),
  '805b444631498f9f5ba634605b289ab10fc6fee8a6083af1588a0338070346e7');
function outcome(core, body, extra = '') {
  try {
    return { css: compileString(`@use 'test:core' as bem; @use 'sass:meta'; ${body}`, {
      importers: [{ canonicalize: url => url === 'test:core' ? new URL(url) : null,
        load: () => ({ contents: core + extra, syntax: 'scss' }) }],
      style: 'expanded', charset: false, sourceMap: false,
    }).css };
  } catch (error) { return { error: error.sassMessage ?? error.message }; }
}
const typeError = 'BEMinator: expected a nonempty BEM name string.';
const firstError = 'BEMinator: a BEM name must start with an ASCII letter or underscore.';
const tailError = 'BEMinator: a BEM name may contain only ASCII letters, digits, underscores and hyphens.';
const exposeName = '\n@function diagnostic-name($value) { @return -name($value); }';
const nameCases = [
  ["'card'"], ["'a'"], ["'Z'"], ["'_'"], ["'a0_-'"], ['card'],
  ["$value", null, "$value: 'dynamic_name-9';"],
  ["'#{$value}-item'", null, "$value: 'Card';"],
  ["'\\63 ard'"], ["'a\\31 b'"], ["'a\\2d b'"],
  ["''", typeError], ['null', typeError], ['true', typeError], ['42', typeError],
  ['(a, b)', typeError], ['(key: value)', typeError], ['()', typeError],
  ["'1a'", firstError], ["'-a'", firstError], ["'é'", firstError],
  ["'a b'", tailError], ["'a:b'", tailError], ["'a.b'", tailError],
  ["'a,b'", tailError], ["'aé'", tailError], ["'a😀'", tailError],
  ["'a\\20 b'", tailError], ["'\\31 a'", firstError],
];
for (let code = 32; code < 127; code++) {
  const char = String.fromCharCode(code);
  const escaped = char.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
  nameCases.push([`'${escaped}'`, /^[A-Za-z_]$/.test(char) ? null : firstError]);
  nameCases.push([`'a${escaped}'`, /^[A-Za-z0-9_-]$/.test(char) ? null : tailError]);
}
for (const [index, [value, error, setup = '']] of nameCases.entries()) {
  test(`name equivalence ${index}: ${value}`, () => {
    const body = `${setup} .x { result: meta.inspect(bem.diagnostic-name(${value})); }`;
    const actual = outcome(current, body, exposeName);
    assert.deepEqual(actual, outcome(previous, body, exposeName));
    if (error) assert.equal(actual.error, `"${error}"`);
    else {
      assert.ok(actual.css);
      // Preserve the evaluated input exactly, including Sass quotedness.
      const expected = compileString(`@use 'sass:meta'; ${setup} .x { result: meta.inspect(${value}); }`).css;
      assert.equal(actual.css, expected);
    }
  });
}
const transitions = {
  root: ['block'], block: ['block', 'element', 'modifier', 'extend', 'qualified'],
  element: ['modifier', 'qualified', 'pending-relation'], modifier: ['block', 'element', 'qualified'],
  qualified: ['element', 'block', 'qualified'], 'pending-relation': ['element'], extend: ['element'],
};
const exposeValidate = '\n@function diagnostic-validate($parent, $child, $under) { @return -validate((kind: $parent, under-extend: $under), $child); }';
for (const parent of Object.keys(transitions))
for (const child of ['block', 'element', 'modifier', 'qualified', 'pending-relation', 'extend'])
for (const under of [false, true]) {
  test(`relationship contract and historical comparison ${parent}/${child}/under-extend=${under}`, () => {
    const body = `.x { result: meta.inspect(bem.diagnostic-validate(${parent}, ${child}, ${under})); }`;
    const actual = outcome(current, body, exposeValidate);
    const historical = outcome(previous, body, exposeValidate);
    const promoted = parent === 'qualified' && ['element', 'block', 'qualified'].includes(child) && !(child === 'block' && under);
    if (promoted) {
      // Explicitly approved scope adoption; the historical fixture remains frozen.
      assert.equal(historical.error, `"BEMinator: nesting qualified -> ${child} is unsupported in the current BEMinator API."`);
      assert.ok(actual.css);
    } else assert.deepEqual(actual, historical);
    const expectedError = child === 'block' && under
      ? 'BEMinator: invalid nesting: block is forbidden beneath extend.'
      : parent === child && ['element', 'modifier'].includes(child)
        ? `BEMinator: invalid nesting: ${parent} -> ${child}.`
        : !transitions[parent].includes(child)
          ? `BEMinator: nesting ${parent} -> ${child} is unsupported in the current BEMinator API.` : null;
    if (expectedError) assert.equal(actual.error, `"${expectedError}"`);
    else assert.ok(actual.css);
  });
}
test('source differs from frozen reference only by optimizations and approved scope adoption', () => {
  const withoutName = text => text.replace(/@function -name\(\$name\) \{[\s\S]*?\n\}/, 'NAME_VALIDATOR');
  const restoreMap = current
    .replace('$parent-kind == modifier or $parent-kind == extend or $parent-kind == qualified {', '$parent-kind == modifier or $parent-kind == extend {')
    .replace(/\/\/ Private immutable relationship data;[^\n]*\n\$-allowed-transitions:[\s\S]*?extend: \(element,\)\);\n\n/, '')
    .replace('  @if not list.index(map.get($-allowed-transitions, $parent-kind), $kind) {',
      previous.match(/  \$allowed:[\s\S]*?  @if not list.index\(map.get\(\$allowed, \$parent-kind\), \$kind\) \{/)[0]);
  assert.equal(withoutName(restoreMap), withoutName(previous));
  assert.equal([...current.matchAll(/\$-allowed-transitions:/g)].length, 1);
  assert.deepEqual([...current.matchAll(/(\$[\w-]+):[^;]*!global/g)].map(m => m[1]),
    ['$-context-stack', '$-context-stack']);
  assert.equal([...current.matchAll(/@at-root/g)].length, 1);
});

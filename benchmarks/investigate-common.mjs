// Fixture-specific diagnostic ablations, never production implementations.
// Reuses the existing harness's pure generator/check/statistics definitions.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { performance } from 'node:perf_hooks';
import * as sass from 'sass';
import { projectRoot, requireLegacyRoot } from '../helpers/project-paths.js';

assert.equal(process.versions.node, '22.19.0');
assert.match(sass.info, /^dart-sass\s+1\.104\.1\s/m);
const harness = readFileSync(join(projectRoot, 'benchmarks/compile-performance.mjs'), 'utf8');
const start = harness.indexOf('const wrap = '), end = harness.indexOf('const output = ');
assert.ok(start > 0 && end > start);
const { workload, flatRules, stats } = runInNewContext(
  harness.slice(start, end) + '\n({workload, flatRules, stats})', { assert });
const core = readFileSync(join(projectRoot, 'src/core/_bem.scss'), 'utf8');
const sha = (text) => createHash('sha256').update(text).digest('hex');
const output = join(projectRoot, 'tmp/benchmarks/core-v2-v3-diagnostics');
mkdirSync(output, { recursive: true });
const settings = (root, logger) => ({ url: pathToFileURL(join(root, '__benchmark__.scss')),
  style: 'expanded', charset: false, sourceMap: false, logger });
const report = { startedAt: new Date().toISOString(), node: process.version, sass: sass.info,
  coreSha256: sha(core), harnessSha256: sha(harness), audit: [], diagnostics: [],
  methodology: { scale: 1000, warmups: 2, iterations: 6,
    order: 'rotate first variant each round; reverse every other round',
    loading: 'all diagnostic variants use the same in-memory importer',
    warningAudit: 'verbose collecting logger outside timing; no silenced deprecations',
    timings: 'compileString only, Logger.silent; generation and equality checks outside timing',
    scope: 'ablations only valid for this common fixture; not proposed production changes' } };
const save = () => writeFileSync(join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
// Small fresh compiles audit both logger callbacks and the actual module graph.
for (const scenario of ['block', 'common', 'nested', 'extend', 'mixed']) {
  const fixture = workload(scenario, 2);
  assert.equal([...fixture.body.matchAll(/@include bem\./g)].length, fixture.calls);
  const outputs = [];
  for (const [version, root, entry] of [
    ['v2', requireLegacyRoot(), './src/scss/tools/mixins/tool.beminator.scss'],
    ['v3', projectRoot, './src'],
  ]) {
    const warnings = [], debug = [];
    const result = sass.compileString(`@use '${entry}' as bem;\n${fixture.body}`, {
      ...settings(root, { warn: (message, options) => warnings.push({ message,
        deprecation: options.deprecation, id: options.deprecationType?.id }),
      debug: (message) => debug.push(message) }), verbose: true,
    });
    assert.deepEqual(flatRules(result.css), flatRules(fixture.expected));
    outputs.push(result.css);
    report.audit.push({ scenario, version, scale: 2, calls: fixture.calls,
      cssBytes: Buffer.byteLength(result.css), warnings, debug,
      loadedUrls: result.loadedUrls.map(String) });
  }
  assert.equal(outputs[0], outputs[1]);
}
save();

function replaceFunction(source, name, body) {
  // Function boundaries end at an unindented closing brace in this source.
  const marker = `@function ${name}(`;
  const from = source.indexOf(marker);
  assert.ok(from >= 0);
  const open = source.indexOf('{', from), close = source.indexOf('\n}', open);
  assert.ok(close > open);
  return source.slice(0, open + 1) + `\n  ${body}\n` + source.slice(close);
}
const noName = replaceFunction(core, '-name', '@return $name;');
const noNesting = replaceFunction(core, '-validate', '@return $parent;');
const variants = {
  stock: core,
  'without-name-validation': noName,
  'without-nesting-validation': noNesting,
  'without-both-validations': replaceFunction(noName, '-validate', '@return $parent;'),
  'without-explicit-owner-parse': core.replace("$owner: selector.parse('.#{$name}');", "$owner: '.#{$name}';"),
  'without-complete-selector-nest': replaceFunction(core, '-complete-selector',
    "@if list.length(map.get($context, scope)) != 0 { @error 'Diagnostic requires empty scope'; } @return map.get($context, subject);"),
};
const fixture = workload('common', report.methodology.scale);
const source = `@use 'diagnostic:core' as bem;\n${fixture.body}`;
const productionCss = sass.compileString(`@use './src' as bem;\n${fixture.body}`,
  settings(projectRoot, sass.Logger.silent)).css;
assert.deepEqual(flatRules(productionCss), flatRules(fixture.expected));
const lanes = Object.entries(variants).map(([name, contents]) => {
  const options = { ...settings(projectRoot, sass.Logger.silent), importers: [{
    canonicalize: (url) => url === 'diagnostic:core' ? new URL(url) : null,
    load: () => ({ contents, syntax: 'scss' }),
  }] };
  assert.equal(sass.compileString(source, options).css, productionCss, name);
  writeFileSync(join(output, `${name}.scss`), contents);
  return { name, options, samples: [], sourceSha256: sha(contents) };
});
for (let round = 0; round < report.methodology.warmups + report.methodology.iterations; round++) {
  const order = lanes.map((_, i) => (i + round) % lanes.length);
  if (round % 2) order.reverse();
  for (const index of order) {
    const lane = lanes[index];
    const start = performance.now();
    const result = sass.compileString(source, lane.options);
    const elapsed = performance.now() - start;
    assert.equal(result.css, productionCss, lane.name);
    if (round >= report.methodology.warmups) lane.samples.push(elapsed);
  }
  console.log(`Diagnostic round ${round + 1}/8 complete`);
}
report.diagnostics = lanes.map(({ name, samples, sourceSha256 }) => ({ name,
  samplesMs: samples, statsMs: stats(samples), sourceSha256,
  cssBytes: Buffer.byteLength(productionCss), correctness: 'byte-identical to production v3 and independent expected rules' }));
report.completedAt = new Date().toISOString();
save();
console.log(JSON.stringify(report.diagnostics, null, 2));

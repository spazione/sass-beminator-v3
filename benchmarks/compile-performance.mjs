import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus, platform, release, totalmem, loadavg } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import * as sass from 'sass';
import { projectRoot, requireLegacyRoot } from '../helpers/project-paths.js';

// No fixture generation, CSS checks, printing, or file writes occur in timed regions.
const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  assert.match(arg, /^--[\w-]+=.+$/, 'Use --option=value');
  const split = arg.indexOf('=');
  return [arg.slice(2, split), arg.slice(split + 1)];
}));
const allowed = ['scenarios', 'scales', 'mixed-scales', 'iterations', 'warmups', 'output'];
for (const key of Object.keys(args)) assert.ok(allowed.includes(key), `Unknown option: ${key}`);
const integer = (value, min = 1) => {
  const number = Number(value);
  assert.ok(Number.isSafeInteger(number) && number >= min, `Invalid integer: ${value}`);
  return number;
};
const scales = (value) => value.split(',').map((n) => integer(n));
const iterations = integer(args.iterations ?? 10);
const warmups = integer(args.warmups ?? 3, 0);
const ordinaryScales = scales(args.scales ?? '100,1000,5000');
const mixedScales = scales(args['mixed-scales'] ?? '10,100,500,1000');
const scenarioOrder = ['baseline', 'block', 'common', 'nested', 'extend', 'mixed', 'layers'];
const selected = (args.scenarios ?? scenarioOrder.join(',')).split(',');
for (const name of selected) assert.ok(scenarioOrder.includes(name), `Unknown scenario: ${name}`);
assert.equal(process.versions.node, '22.19.0', 'Benchmark requires Node 22.19.0');
assert.match(sass.info, /^dart-sass\s+1\.104\.1\s/m, 'Benchmark requires Dart Sass 1.104.1');
const legacyRoot = requireLegacyRoot();
const legacyEntry = join(legacyRoot, 'src/scss/tools/mixins/tool.beminator.scss');
const v3Entry = join(projectRoot, 'src/_index.scss');
const options = (root) => ({
  url: pathToFileURL(join(root, '__benchmark__.scss')),
  style: 'expanded', charset: false, sourceMap: false, logger: sass.Logger.silent,
});
const legacyOptions = options(legacyRoot);
const modernOptions = options(projectRoot);
const prelude = {
  v2: '@use "./src/scss/tools/mixins/tool.beminator.scss" as bem;\n',
  v3: '@use "./src" as bem;\n',
};
const wrap = (call, body) => `@include bem.${call} { ${body} }`;
const declarations = { red: 'color: red;', blue: 'color: blue;', large: 'font-size: 2rem;', active: 'opacity: 1;' };
function workload(scenario, count, layered = false) {
  const sources = [], expected = [];
  const rule = (selector, body) => expected.push(`${selector} { ${body} }`);
  let perInstance = 0;
  for (let i = 1; i <= count; i++) {
    const name = `component-${i}`, root = `.${name}`;
    const block = (body) => wrap(`block('${name}'${layered ? ", $layer: 'molecules'" : ''})`, body);
    if (scenario === 'block') {
      sources.push(block(declarations.red)); rule(root, declarations.red); perInstance = 1;
    } else if (scenario === 'common') {
      sources.push(block(
        wrap("element('title')", wrap("modifier('large')", declarations.large)) +
        wrap("element('body')", declarations.red) + wrap("modifier('active')", declarations.active)));
      rule(`${root}__title--large`, declarations.large); rule(`${root}__body`, declarations.red);
      rule(`${root}--active`, declarations.active); perInstance = 5;
    } else if (scenario === 'nested') {
      sources.push(block(wrap("block('card')", wrap("element('title')", declarations.red))));
      rule(`${root} .card__title`, declarations.red); perInstance = 3;
    } else if (scenario === 'extend') {
      sources.push(block(wrap("extend('icon', 'active')", wrap("element('label')", declarations.red))));
      rule(`${root} .icon--active .icon__label`, declarations.red); perInstance = 3;
    } else if (scenario === 'mixed') {
      sources.push(block(declarations.red +
        wrap("element('title')", wrap("modifier('large')", declarations.large)) +
        wrap("element('body')", declarations.red) +
        wrap("element('icon')", wrap("selector(':before')", declarations.blue)) +
        wrap("modifier('active')", declarations.active) +
        wrap("extend('icon', 'active')", wrap("element('label')", declarations.red)) +
        wrap("block('badge')", wrap("element('text')", declarations.blue))));
      rule(root, declarations.red); rule(`${root}__title--large`, declarations.large);
      rule(`${root}__body`, declarations.red); rule(`${root}__icon:before`, declarations.blue);
      rule(`${root}--active`, declarations.active);
      rule(`${root} .icon--active .icon__label`, declarations.red);
      rule(`${root} .badge__text`, declarations.blue); perInstance = 11;
    } else throw new Error(`No generator: ${scenario}`);
  }
  return { body: sources.join('\n'), expected: expected.join('\n'), calls: perInstance * count, perInstance };
}
// These fixtures contain only flat rules/simple declarations: preserve descendant
// selector whitespace, declaration order and values; ignore serialization spacing.
function flatRules(css) {
  const re = /([^{}]+)\{([^{}]*)\}/g;
  const rules = [...css.matchAll(re)].map(([, selector, body]) => [
    selector.trim().replace(/\s+/g, ' '),
    body.split(';').map((x) => x.trim()).filter(Boolean).map((x) => x.replace(/\s*:\s*/, ':')),
  ]);
  assert.equal(css.replace(re, '').trim(), '', 'Unexpected non-flat CSS in comparison');
  return rules;
}
function stats(samples) {
  const ordered = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const n = ordered.length;
  return { median: n % 2 ? ordered[(n - 1) / 2] : (ordered[n / 2 - 1] + ordered[n / 2]) / 2,
    mean, min: ordered[0], max: ordered[n - 1], p95: ordered[Math.ceil(n * 0.95) - 1],
    stddev: Math.sqrt(samples.reduce((sum, x) => sum + (x - mean) ** 2, 0) / n) };
}
const output = join(projectRoot, 'tmp/benchmarks', args.output ?? new Date().toISOString().replaceAll(':', '-'));
mkdirSync(output, { recursive: true });
const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const report = {
  startedAt: new Date().toISOString(), environment: {
    node: process.version, sass: sass.info, os: `${platform()} ${release()}`, cpu: cpus()[0]?.model,
    logicalCpus: cpus().length, totalMemoryBytes: totalmem(), loadAverageStart: loadavg(),
    sources: { legacyEntrySha256: sha(legacyEntry), v3EntrySha256: sha(v3Entry), v3CoreSha256: sha(join(projectRoot, 'src/core/_bem.scss')) },
  }, methodology: { warmups, iterations, api: 'sass.compileString', unit: 'ms',
    compilerLifecycle: 'fresh compileString evaluation per call; modules loaded on each compilation',
    order: 'alternate reference/candidate first on each pair; scenario starting side alternates',
    warnings: 'Logger.silent for both; normal helpers/tests unchanged', p95: 'nearest rank', stddev: 'population',
    baselineSubtracted: false, forcedGC: false }, results: [],
};
const save = () => writeFileSync(join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
save();
console.log('scenario  instances  calls  reference-ms  candidate-ms  delta%  speedup  CSS-bytes(ref/new)');
let index = 0;
for (const scenario of scenarioOrder.filter((s) => selected.includes(s))) {
  for (const scale of scenario === 'baseline' ? [1] : ['mixed', 'layers'].includes(scenario) ? mixedScales : ordinaryScales) {
    const fixture = scenario === 'baseline' ? { body: '.foo { color: red; }', expected: '.foo { color: red; }', calls: 0, perInstance: 0 }
      : workload(scenario === 'layers' ? 'mixed' : scenario, scale);
    const isLayers = scenario === 'layers';
    const sources = scenario === 'baseline' ? [fixture.body, fixture.body] : isLayers
      ? [prelude.v3 + fixture.body, prelude.v3 + '@include bem.css-layers();\n' + workload('mixed', scale, true).body]
      : [prelude.v2 + fixture.body, prelude.v3 + fixture.body];
    const settings = [isLayers || scenario === 'baseline' ? modernOptions : legacyOptions, modernOptions];
    // Untimed correctness preflight is in addition to the configured warmups.
    const css = sources.map((source, i) => sass.compileString(source, settings[i]).css);
    assert.deepEqual(flatRules(css[0]), flatRules(fixture.expected), `${scenario}/${scale}: reference semantics`);
    if (isLayers) {
      const order = '@layer generic, elements, atoms, molecules, organisms, templates, pages, utilities;';
      const chunks = css[1].slice(order.length).trim().split('@layer molecules {').slice(1);
      assert.ok(css[1].startsWith(order));
      assert.equal(chunks.length, scale);
      // Remove only each known outer layer closing brace, retaining all BEM rules.
      assert.deepEqual(flatRules(chunks.map((x) => x.trim().slice(0, -1)).join('\n')), flatRules(css[0]));
    } else assert.deepEqual(flatRules(css[1]), flatRules(fixture.expected), `${scenario}/${scale}: v3 semantics`);
    const samples = [[], []];
    for (let iteration = -warmups; iteration < iterations; iteration++) {
      const first = ((iteration + warmups + index) % 2);
      for (const side of [first, 1 - first]) {
        const start = performance.now();
        const result = sass.compileString(sources[side], settings[side]);
        const elapsed = performance.now() - start;
        if (iteration >= 0) samples[side].push(elapsed);
        assert.equal(result.css, css[side], 'Output changed between evaluations');
      }
    }
    const summaries = samples.map(stats);
    const row = { scenario, scale, comparison: isLayers ? 'v3 unlayered vs v3 layered' : scenario === 'baseline' ? 'identical Sass input, two timing lanes' : 'v2 vs v3',
      callsPerInstance: fixture.perInstance, totalCalls: fixture.calls, extraCandidateOrderingCalls: isLayers ? 1 : 0,
      correctness: 'passed independent expected selectors/declarations and cross-version or wrapper equivalence',
      cssBytes: css.map((value) => Buffer.byteLength(value)), samplesMs: samples, statsMs: summaries,
      deltaPercent: (summaries[1].median / summaries[0].median - 1) * 100,
      speedup: summaries[0].median / summaries[1].median };
    report.results.push(row); save(); index++;
    console.log(`${scenario.padEnd(9)} ${String(scale).padStart(7)} ${String(fixture.calls).padStart(6)} ${summaries[0].median.toFixed(2).padStart(13)} ${summaries[1].median.toFixed(2).padStart(13)} ${row.deltaPercent.toFixed(1).padStart(7)} ${row.speedup.toFixed(2).padStart(8)} ${row.cssBytes.join('/')}`);
  }
}
report.completedAt = new Date().toISOString(); report.environment.loadAverageEnd = loadavg(); save();
console.log(`Results: ${output}/results.json`);

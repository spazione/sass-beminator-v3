// Diagnostic only: never writes production or updates expected output.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { performance, PerformanceObserver } from 'node:perf_hooks';
import { cpus, loadavg, freemem, totalmem, release } from 'node:os';
import { Session } from 'node:inspector';
import * as sass from 'sass';
import { projectRoot, requireLegacyRoot } from '../helpers/project-paths.js';

const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  assert.match(arg, /^--[\w-]+=.+$/);
  const i = arg.indexOf('='); return [arg.slice(2, i), arg.slice(i + 1)];
}));
for (const key of Object.keys(args)) assert.ok(['mode', 'tag', 'rounds', 'warmups', 'length', 'shape', 'scale'].includes(key));
const mode = args.mode ?? 'repeat';
assert.ok(['repeat', 'gc', 'forced', 'validators', 'length', 'structure', 'cpu', 'allocation'].includes(mode));
const rounds = Number(args.rounds ?? (mode === 'repeat' ? 30 : 12));
const warmups = Number(args.warmups ?? 5), scale = Number(args.scale ?? 1000);
for (const n of [rounds, warmups, scale]) assert.ok(Number.isSafeInteger(n) && n >= 0);
const tag = args.tag; assert.match(tag ?? '', /^[\w-]+$/);
assert.equal(process.versions.node, '22.19.0');
assert.match(sass.info, /^dart-sass\s+1\.104\.1\s/m);
const output = join(projectRoot, 'benchmarks/results/runtime-profile');
const temporary = join(projectRoot, 'tmp/benchmarks/runtime-profile', tag);
mkdirSync(output, { recursive: true });
assert.ok(!existsSync(join(output, `${tag}.json`)), 'Use a new tag; evidence is never overwritten');
assert.ok(!existsSync(temporary), 'Use a new temporary tag');
mkdirSync(temporary, { recursive: true });
const sha = text => createHash('sha256').update(text).digest('hex');
const production = readFileSync(join(projectRoot, 'src/core/_bem.scss'), 'utf8');
const old = readFileSync(join(projectRoot, 'benchmarks/references/v3-before-validation.scss'), 'utf8');
assert.equal(sha(old), '805b444631498f9f5ba634605b289ab10fc6fee8a6083af1588a0338070346e7');
const entry = readFileSync(join(projectRoot, 'src/_index.scss'), 'utf8');
const namePattern = /@function -name\(\$name\) \{[\s\S]*?\n\}/;
assert.ok(old.match(namePattern) && production.match(namePattern));
const numeric = production.replace(namePattern, old.match(namePattern)[0]);
const bypass = production.replace(namePattern, '@function -name($name) { @return $name; }');
const harness = readFileSync(join(projectRoot, 'benchmarks/compile-performance.mjs'), 'utf8');
const from = harness.indexOf('const wrap = '), to = harness.indexOf('const output = ');
assert.ok(from > 0 && to > from);
const { workload, flatRules, stats: baseStats } = runInNewContext(harness.slice(from, to) + '\n({workload,flatRules,stats})', { assert });
export function stats(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), s = baseStats(values);
  return { ...s, p90: sorted[Math.ceil(values.length * .9) - 1],
    p99: values.length >= 100 ? sorted[Math.ceil(values.length * .99) - 1] : null,
    cv: s.mean ? s.stddev / s.mean : null };
}
let fixture = workload('mixed', scale);
// Rename BEM names only, never the qualifier, preserving call tree and expectations.
if (mode === 'length' || mode === 'structure') {
  const length = Number(args.length ?? 5); assert.ok(length >= 5 && length <= 100);
  const names = [...new Set([...fixture.body.matchAll(/'([^':]+)'/g)].map(m => m[1]))];
  const mapping = new Map(names.map((name, i) => [name, `n${i.toString(36).padStart(4, '0')}`.padEnd(length, 'x')]));
  fixture.body = fixture.body.replace(/'([^':]+)'/g, (match, name) => `'${mapping.get(name)}'`);
  const tokens = new RegExp(names.sort((a, b) => b.length - a.length).join('|'), 'g');
  fixture.expected = fixture.expected.replace(tokens, name => mapping.get(name));
  fixture.nameLength = length;
  if (mode === 'structure' && args.shape === 'validation') {
    // Same 11,000 public calls; each root still goes through normal derive/emission.
    fixture.body = Array.from({ length: scale * 11 }, () => "@include bem.block('short') {}").join('\n');
    fixture.expected = '';
  } else if (mode === 'structure') assert.equal(args.shape, 'selector');
}
const writeCore = (name, contents) => {
  const root = join(temporary, name); mkdirSync(join(root, 'src/core'), { recursive: true });
  writeFileSync(join(root, 'src/core/_bem.scss'), contents);
  writeFileSync(join(root, 'src/_index.scss'), entry);
  return [name, root, './src', sha(contents)];
};
const normal = [['v2', requireLegacyRoot(), './src/scss/tools/mixins/tool.beminator.scss'],
  writeCore('old-v3', old), ['split', projectRoot, './src', sha(production)]];
const controlled = [writeCore('numeric-static', numeric), normal[2]];
const selected = ['validators'].includes(mode) ? [...controlled, writeCore('bypass-static', bypass)]
  : ['length', 'structure'].includes(mode) ? controlled
  : mode === 'cpu' ? normal.slice(1)
  : mode === 'allocation' ? [normal[0], normal[1], ...controlled] : normal;
const lanes = selected.map(([name, root, module, hash]) => ({ name, hash,
  source: `@use '${module}' as bem;\n${fixture.body}`,
  options: { url: pathToFileURL(join(root, '__profile__.scss')), style: 'expanded', charset: false, sourceMap: false, logger: sass.Logger.silent },
}));
const warningAudit = {};
const css = lanes.map(lane => {
  warningAudit[lane.name] = [];
  return sass.compileString(lane.source, { ...lane.options, logger: {
    warn(message, options) { warningAudit[lane.name].push({ message, deprecation: options.deprecation }); }, debug() {},
  } }).css;
});
for (const value of css) { assert.equal(value, css[0]); assert.deepEqual(flatRules(value), flatRules(fixture.expected)); }
const host = () => ({ loadavg: loadavg(), freeMemory: freemem(), memory: process.memoryUsage() });
const observed = [];
const instrument = mode !== 'repeat';
const accept = entries => observed.push(...entries.map(e => ({ start: e.startTime, duration: e.duration, kind: e.detail.kind, flags: e.detail.flags })));
const observer = instrument ? new PerformanceObserver(list => accept(list.getEntries())) : null;
observer?.observe({ entryTypes: ['gc'] });
// GC callbacks are delivered after synchronous compilation. Match event timestamps,
// not callback delivery time; drain after two event-loop turns and once at finish.
const drain = async () => { await new Promise(setImmediate); await new Promise(setImmediate); accept(observer.takeRecords()); };
const report = { tag, mode, rounds, warmups, scale, shape: args.shape, nameLength: fixture.nameLength,
  startedAt: new Date().toISOString(), node: process.version, sass: sass.info, cpu: cpus()[0].model,
  logicalCpus: cpus().length, os: release(), totalMemory: totalmem(), startHost: host(),
  hashes: { production: sha(production), old: sha(old), entry: sha(entry), script: sha(readFileSync(new URL(import.meta.url))), harness: sha(harness) },
  lanes: lanes.map(l => ({ name: l.name, hash: l.hash })), calls: fixture.calls, cssBytes: Buffer.byteLength(css[0]), cssHash: sha(css[0]), warningAudit,
  methodology: { order: 'rotate first; reverse alternate rounds', timing: 'compileString only; checks and instrumentation boundaries outside timer',
    gc: mode === 'forced' ? 'forced BEFORE each compile, excluded from compile events/time' : 'not forced',
    observer: instrument, percentile: 'nearest rank; p99 omitted for n<100', memory: 'before/after; not total allocation',
    cpuIntervalUs: mode === 'cpu' ? 1000 : null, allocationIntervalBytes: mode === 'allocation' ? 32768 : null },
  samples: [], orders: [] };
const session = ['cpu', 'allocation'].includes(mode) ? new Session() : null;
session?.connect();
const post = (method, params = {}) => new Promise((resolve, reject) => session.post(method, params, (error, result) => error ? reject(error) : resolve(result)));
if (mode === 'cpu') { await post('Profiler.enable'); await post('Profiler.setSamplingInterval', { interval: 1000 }); }
if (mode === 'allocation') await post('HeapProfiler.enable');
if (mode === 'forced') assert.equal(typeof global.gc, 'function', 'Use --expose-gc');
const save = () => writeFileSync(join(output, `${tag}.json`), JSON.stringify(report, null, 2) + '\n');
save();
for (let round = 0; round < warmups + rounds; round++) {
  const order = lanes.map((_, i) => (i + round) % lanes.length); if (round % 2) order.reverse();
  report.orders.push({ round, names: order.map(i => lanes[i].name) });
  for (const index of order) {
    const lane = lanes[index], measured = round >= warmups;
    if (mode === 'forced') { global.gc(); await drain(); }
    if (measured && mode === 'cpu') await post('Profiler.start');
    if (measured && mode === 'allocation') await post('HeapProfiler.startSampling', {
      samplingInterval: 32768, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true,
    });
    const before = host(), cpuBefore = process.cpuUsage();
    const start = performance.now();
    let result = sass.compileString(lane.source, lane.options);
    const end = performance.now();
    const cpu = process.cpuUsage(cpuBefore), after = host();
    let profileFile;
    if (measured && session) {
      const { profile } = await post(mode === 'cpu' ? 'Profiler.stop' : 'HeapProfiler.stopSampling');
      profileFile = `${tag}-${lane.name}-${round - warmups}.${mode === 'cpu' ? 'cpuprofile' : 'heapprofile'}`;
      assert.ok(!existsSync(join(output, profileFile)));
      writeFileSync(join(output, profileFile), JSON.stringify(profile));
    }
    assert.equal(result.css, css[index]); result = null;
    if (instrument) await drain();
    report.samples.push({ lane: lane.name, round: round - warmups, warmup: !measured, start, end,
      duration: end - start, cpu, before, after, afterObservation: instrument ? process.memoryUsage() : null, profileFile });
  }
  save(); console.log(`${tag}: ${round + 1}/${warmups + rounds}`);
}
if (instrument) { await drain(); observer.disconnect(); }
session?.disconnect();
report.gcEvents = observed;
for (const sample of report.samples) {
  const events = observed.filter(e => e.start >= sample.start && e.start < sample.end);
  sample.gc = instrument ? { count: events.length, totalMs: events.reduce((s, e) => s + e.duration, 0),
    largestMs: Math.max(0, ...events.map(e => e.duration)), kinds: Object.fromEntries([...new Set(events.map(e => e.kind))].map(k => [k, events.filter(e => e.kind === k).length])) } : null;
}
report.summary = Object.fromEntries(lanes.map(lane => {
  const samples = report.samples.filter(s => !s.warmup && s.lane === lane.name), times = samples.map(s => s.duration), summary = stats(times);
  return [lane.name, { timing: summary, tails: Object.fromEntries([1.25, 1.5, 1.75].map(f => [f, times.filter(t => t > summary.median * f).length])) }];
}));
report.pairedRatios = Object.fromEntries(lanes.filter(l => l.name !== 'split').map(lane => {
  const n = report.samples.filter(s => !s.warmup && s.lane === 'split').map(s => s.duration);
  const d = report.samples.filter(s => !s.warmup && s.lane === lane.name).map(s => s.duration);
  const ratios = n.map((v, i) => v / d[i]);
  return [`split/${lane.name}`, { samples: ratios, stats: stats(ratios), faster: ratios.filter(v => v < 1).length }];
}));
report.completedAt = new Date().toISOString(); report.endHost = host();
assert.equal(sha(readFileSync(join(projectRoot, 'src/core/_bem.scss'))), sha(production));
assert.equal(sha(readFileSync(join(projectRoot, 'src/_index.scss'))), sha(entry));
save(); console.log(JSON.stringify(report.summary, null, 2));

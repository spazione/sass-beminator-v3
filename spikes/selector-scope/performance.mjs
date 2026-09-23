// Small sanity check only, not a new performance investigation.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { cpus } from 'node:os';
import * as sass from 'sass';

assert.equal(process.versions.node, '22.19.0');
assert.match(sass.info, /^dart-sass\s+1\.104\.1\s/m);
const output = new URL('results/sanity.json', import.meta.url);
assert.ok(!existsSync(output), 'Existing sanity evidence is preserved; use a deliberate new output for another run.');
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const core = new URL('../../src/core/_bem.scss', import.meta.url);
const coreHash = sha(core);
const count = 1000, warmups = 2, rounds = 5;
const lanes = [false, true].map(scoped => {
  const parts = [], expected = [];
  for (let i = 0; i < count; i++) {
    const child = "@include bem.element('title') { color: red; }";
    parts.push(`@include bem.block('card-${i}') { ${scoped ? `@include bem.selector(':hover') { ${child} }` : child} }`);
    expected.push(`${scoped ? `.card-${i}:hover ` : ''}.card-${i}__title {\n  color: red;\n}`);
  }
  return { name: scoped ? 'block-selector-element' : 'block-element', calls: count * (scoped ? 3 : 2),
    source: `@use './index' as bem;\n${parts.join('\n')}`, expected: expected.join('\n\n'), samplesMs: [] };
});
const options = { url: new URL('fixture.scss', import.meta.url), style: 'expanded', charset: false, sourceMap: false };
for (const lane of lanes) assert.equal(sass.compileString(lane.source, options).css, lane.expected);
const orders = [];
for (let round = 0; round < warmups + rounds; round++) {
  const order = round % 2 ? [1, 0] : [0, 1]; orders.push(order);
  for (const index of order) {
    const lane = lanes[index], start = performance.now();
    const css = sass.compileString(lane.source, options).css;
    const elapsed = performance.now() - start;
    assert.equal(css, lane.expected);
    if (round >= warmups) lane.samplesMs.push(elapsed);
  }
}
function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return { median: sorted[2], mean: samples.reduce((a, b) => a + b) / samples.length, min: sorted[0], max: sorted.at(-1) };
}
const results = lanes.map(l => ({ name: l.name, calls: l.calls, cssBytes: Buffer.byteLength(l.expected), samplesMs: l.samplesMs, statsMs: stats(l.samplesMs) }));
assert.equal(sha(core), coreHash);
const report = { completedAt: new Date().toISOString(), node: process.version, sass: sass.info, cpu: cpus()[0].model,
  productionHash: coreHash, spikeHash: sha(new URL('_proof.scss', import.meta.url)), count, warmups, rounds,
  methodology: 'compile only; fixture/checks outside timer; alternating order; no discarded samples; same spike core for both paths', orders, results,
  medianRatio: results[1].statsMs.median / results[0].statsMs.median };
mkdirSync(new URL('results/', import.meta.url), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));

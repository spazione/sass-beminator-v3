import assert from 'node:assert/strict';
import test from 'node:test';
import { compileLegacy } from '../../../helpers/legacy.js';
import { readArtifact, probeSource, probeCss } from '../../../helpers/characterization.js';

const scenarios = JSON.parse(readArtifact('state-isolation/cases.json'));
for (const scenario of scenarios) {
  const artifact = (name) => readArtifact(`state-isolation/${scenario.id}/${name}`);
  const expected = JSON.parse(artifact('result.json'));
  test(`[v2 ${expected.isolated ? 'ISOLATED' : 'KNOWN STATE LEAK'}] ${scenario.id}`, () => {
    const options = { ...scenario, probe: readArtifact(scenario.probe) };
    const aloneSource = probeSource({ ...options, before: '' });
    const sequenceSource = probeSource({ ...options, before: readArtifact(scenario.before) });
    assert.equal(aloneSource, artifact('alone.scss'), 'Recorded probe source must match its recipe');
    assert.equal(sequenceSource, artifact('sequence.scss'), 'Recorded sequence must match its recipe');
    const alone = compileLegacy(aloneSource);
    const sequence = compileLegacy(sequenceSource);
    assert.equal(alone, artifact('alone.css'));
    assert.equal(sequence, artifact('sequence.css'));
    // Compare B from A+B with B alone within fresh, separate compilations.
    // Known violations are named and frozen as historical evidence, not endorsed.
    if (expected.isolated) assert.equal(probeCss(sequence), probeCss(alone));
    else assert.notEqual(probeCss(sequence), probeCss(alone), 'Known v2 leak changed: review the evidence');
  });
}

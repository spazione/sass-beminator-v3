import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileLegacy } from '../helpers/legacy.js';
import { characterizationRoot, readArtifact, probeSource, probeCss } from '../helpers/characterization.js';

if (process.argv[2] !== '--record-new') throw new Error('Use --record-new; existing observations are never overwritten.');
const scenarios = JSON.parse(readArtifact('state-isolation/cases.json'));
for (const scenario of scenarios) {
  const directory = join(characterizationRoot, 'state-isolation', scenario.id);
  if (existsSync(directory)) continue;
  const options = { ...scenario, probe: readArtifact(scenario.probe) };
  const aloneSource = probeSource({ ...options, before: '' });
  const sequenceSource = probeSource({ ...options, before: readArtifact(scenario.before) });
  const alone = compileLegacy(aloneSource);
  const sequence = compileLegacy(sequenceSource);
  const isolated = probeCss(alone) === probeCss(sequence);
  mkdirSync(directory);
  writeFileSync(join(directory, 'alone.scss'), aloneSource);
  writeFileSync(join(directory, 'sequence.scss'), sequenceSource);
  writeFileSync(join(directory, 'alone.css'), alone);
  writeFileSync(join(directory, 'sequence.css'), sequence);
  writeFileSync(join(directory, 'result.json'), `${JSON.stringify({ isolated }, null, 2)}\n`);
  console.log(`${scenario.id}: ${isolated ? 'isolated' : 'STATE LEAK'}`);
}

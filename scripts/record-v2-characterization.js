import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cases, characterizationRoot, observeLegacy, readArtifact } from '../helpers/characterization.js';

// Deliberate initial capture only. Test execution never updates observations.
// Replacing an existing baseline requires a separate, reviewed change.
if (process.argv[2] !== '--record-new') {
  throw new Error('Use --record-new to capture missing v2 observations; existing baselines are never overwritten.');
}

for (const entry of cases) {
  const cssPath = join(characterizationRoot, `${entry.id}.css`);
  const errorPath = join(characterizationRoot, `${entry.id}.error.json`);
  if (existsSync(cssPath) || existsSync(errorPath)) continue;
  const result = observeLegacy(readArtifact(`${entry.id}.scss`));
  if (result.outcome === 'css') writeFileSync(cssPath, result.css);
  else writeFileSync(errorPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`${entry.id}: ${result.outcome}`);
}

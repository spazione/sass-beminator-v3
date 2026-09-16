import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { compileLegacy } from '../../helpers/legacy.js';
import { projectRoot, legacyRoot, requireLegacyRoot } from '../../helpers/project-paths.js';

test('legacy v2 resolves relative to the v3 project', () => {
  assert.equal(legacyRoot, resolve(projectRoot, '../sass-beminator'));
  assert.equal(requireLegacyRoot(), legacyRoot);
});

test('legacy block emits a plain class selector', () => {
  const source = readFileSync(new URL('../../fixtures/legacy/block.scss', import.meta.url), 'utf8');
  assert.equal(compileLegacy(source), '.smoke-block {\n  color: red;\n}');
});

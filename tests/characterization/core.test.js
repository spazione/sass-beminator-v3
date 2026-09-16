import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { cases, characterizationRoot, observeLegacy, readArtifact } from '../../helpers/characterization.js';

for (const entry of cases) {
  test(`[v2 ${entry.kind}] ${entry.id}`, () => {
    const hasError = existsSync(join(characterizationRoot, `${entry.id}.error.json`));
    const hasCss = existsSync(join(characterizationRoot, `${entry.id}.css`));
    assert.notEqual(hasError, hasCss, 'Each fixture must have exactly one recorded outcome');
    const actual = observeLegacy(readArtifact(`${entry.id}.scss`));
    const expected = hasError
      ? JSON.parse(readArtifact(`${entry.id}.error.json`))
      : { outcome: 'css', css: readArtifact(`${entry.id}.css`) };
    if (hasError) {
      // Full captured diagnostics are available for review. Stack path formatting
      // depends on cwd; assert the exact Sass message and lack of returned CSS.
      assert.equal(actual.outcome, 'error');
      assert.equal(actual.sassMessage, expected.sassMessage);
      assert.equal(actual.cssReturned, false);
    } else {
      assert.deepEqual(actual, expected);
    }
  });
}

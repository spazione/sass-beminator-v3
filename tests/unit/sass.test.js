import assert from 'node:assert/strict';
import test from 'node:test';
import { compileScss } from '../../helpers/compile-scss.js';

test('Dart Sass compiles SCSS to deterministic expanded CSS', () => {
  assert.equal(
    compileScss('$color: red; .sass-smoke { color: $color; }'),
    '.sass-smoke {\n  color: red;\n}',
  );
});

test('Sass errors retain their source diagnostics', () => {
  assert.throws(
    () => compileScss('.broken { color: $undefined; }'),
    /Undefined variable/,
  );
});

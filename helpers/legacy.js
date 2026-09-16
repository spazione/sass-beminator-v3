import { statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileScss } from './compile-scss.js';
import { requireLegacyRoot } from './project-paths.js';

export function compileLegacy(source) {
  const root = requireLegacyRoot();
  const entryPoint = join(root, 'src/scss/tools/mixins/tool.beminator.scss');
  try {
    if (!statSync(entryPoint).isFile()) throw new Error('Entry point is not a file');
  } catch (cause) {
    throw new Error(`Legacy BEMinator Sass entry point is unavailable at ${entryPoint}. Check the v2 reference checkout.`, { cause });
  }

  // A synthetic source URL resolves the relative @use without writing a file.
  // Fixtures use the stable `bem` namespace, independent of v2's physical layout.
  return compileScss(
    `@use "./src/scss/tools/mixins/tool.beminator.scss" as bem;\n${source}`,
    { url: pathToFileURL(join(root, '__beminator_smoke__.scss')) },
  );
}

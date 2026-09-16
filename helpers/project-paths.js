import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const legacyRoot = resolve(projectRoot, '../sass-beminator');

// Validate lazily: importing paths must not require a legacy checkout.
export function requireLegacyRoot() {
  try {
    if (statSync(legacyRoot).isDirectory()) return legacyRoot;
  } catch (cause) {
    throw new Error(
      `Legacy Sass BEMinator v2 repository is unavailable at ${legacyRoot}. Place the read-only reference at ../sass-beminator relative to the v3 project. Only legacy tests require it.`,
      { cause },
    );
  }
  throw new Error(`Expected a legacy repository directory at ${legacyRoot}.`);
}

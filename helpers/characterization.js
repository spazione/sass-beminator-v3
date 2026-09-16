import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileLegacy } from './legacy.js';
import { legacyRoot, projectRoot } from './project-paths.js';

export const characterizationRoot = join(projectRoot, 'characterization/v2');
export const readArtifact = (name) => readFileSync(join(characterizationRoot, name), 'utf8');
export const cases = JSON.parse(readArtifact('cases.json'));

export function observeLegacy(source) {
  try {
    return { outcome: 'css', css: compileLegacy(source) };
  } catch (error) {
    // Missing checkouts and harness errors must fail, not become Sass observations.
    if (typeof error.sassMessage !== 'string') throw error;
    return {
      outcome: 'error',
      sassMessage: error.sassMessage,
      diagnostic: error.message.replaceAll(legacyRoot, '<legacy-v2>').replaceAll(projectRoot, '<v3>'),
      cssReturned: false,
    };
  }
}

const begin = '/* characterization-probe-begin */';
const end = '/* characterization-probe-end */';

// Loud comments delimit emitted probe CSS; no selector parsing or rewriting.
// @at-root also supports probes inside the sibling regression's SCSS context.
export function probeSource({ prefix = '', before = '', probe, suffix = '' }) {
  return `${prefix}\n${before}\n@at-root { ${begin} }\n${probe}\n@at-root { ${end} }\n${suffix}`;
}

export function probeCss(css) {
  const parts = css.split(begin);
  if (parts.length !== 2 || parts[1].split(end).length !== 2) {
    throw new Error('Expected exactly one pair of probe markers in emitted CSS');
  }
  const result = parts[1].split(end)[0].trim();
  if (!result) throw new Error('The isolation probe emitted no CSS');
  return result;
}

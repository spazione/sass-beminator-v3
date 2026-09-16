import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as currentSass from 'sass';
import { cases, characterizationRoot, readArtifact, probeCss } from '../helpers/characterization.js';
import { projectRoot, requireLegacyRoot } from '../helpers/project-paths.js';

const legacyRoot = requireLegacyRoot();
const requireLegacy = createRequire(join(legacyRoot, 'package.json'));
const legacyCompilerPath = requireLegacy.resolve('sass');
assert.ok(legacyCompilerPath.startsWith(join(legacyRoot, 'node_modules', 'sass') + '/'),
  'Sass must resolve from the legacy project’s own installed dependencies');
const legacySass = requireLegacy('sass');
function version(compiler) {
  return /^dart-sass\t([^\t]+)/m.exec(compiler.info)?.[1];
}
assert.equal(version(currentSass), '1.104.1');
assert.equal(version(legacySass), '1.83.4');

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
function protectTree(directory, hashes) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) protectTree(path, hashes);
    else hashes[path] = sha256(readFileSync(path));
  }
}
function protectedHashes() {
  const hashes = {};
  for (const directory of [characterizationRoot, join(projectRoot, 'src'), join(legacyRoot, 'src')]) {
    protectTree(directory, hashes);
  }
  for (const root of [projectRoot, legacyRoot]) {
    for (const file of ['package.json', 'package-lock.json', 'node_modules/sass/package.json']) {
      const path = join(root, file);
      hashes[path] = sha256(readFileSync(path));
    }
  }
  const inventory = join(projectRoot, 'docs/CHARACTERIZATION-v2.md');
  hashes[inventory] = sha256(readFileSync(inventory));
  return hashes;
}
const beforeHashes = protectedHashes();
const reference = JSON.parse(readArtifact('reference.json'));
assert.equal(sha256(readFileSync(join(legacyRoot, reference.source))), reference.sourceSha256);

const inputs = cases.map(({ id }) => ({
  id, source: `${id}.scss`,
  expected: existsSync(join(characterizationRoot, `${id}.error.json`))
    ? JSON.parse(readArtifact(`${id}.error.json`))
    : { outcome: 'css', css: readArtifact(`${id}.css`) },
}));
const isolationCases = JSON.parse(readArtifact('state-isolation/cases.json'));
for (const { id } of isolationCases) {
  for (const mode of ['alone', 'sequence']) {
    const stem = `state-isolation/${id}/${mode}`;
    inputs.push({ id: stem, source: `${stem}.scss`, expected: { outcome: 'css', css: readArtifact(`${stem}.css`) } });
  }
}
assert.equal(inputs.length, 79, 'Expected 37 fixture outcomes plus 21 pairs of isolation inputs');

mkdirSync(join(projectRoot, 'tmp'), { recursive: true });
const outputRoot = mkdtempSync(join(projectRoot, 'tmp/compiler-baseline-v2-'));
function save(name, value) {
  const path = join(outputRoot, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
function compile(compiler, source) {
  const warnings = [];
  const debug = [];
  const logger = {
    warn(message, options) {
      const category = options.deprecationType?.id ?? (options.deprecation ? 'unclassified-deprecation' : 'warning');
      warnings.push({ category, message, deprecation: options.deprecation,
        location: options.span ? { url: String(options.span.url), line: options.span.start.line + 1 } : null });
      console.warn(`[Sass ${version(compiler)}] ${category}: ${message}`);
    },
    debug(message) { debug.push(message); console.error(`[Sass debug] ${message}`); },
  };
  try {
    // Same adapter prelude, synthetic URL, and options as helpers/legacy.js and
    // helpers/compile-scss.js. Only the compiler instance and diagnostic sink vary.
    const result = compiler.compileString(
      `@use "./src/scss/tools/mixins/tool.beminator.scss" as bem;\n${source}`,
      { syntax: 'scss', loadPaths: [], url: pathToFileURL(join(legacyRoot, '__beminator_smoke__.scss')),
        style: 'expanded', charset: false, sourceMap: false, logger },
    );
    return { outcome: 'css', css: result.css.replace(/\r\n?/g, '\n'), warnings, debug };
  } catch (error) {
    if (typeof error.sassMessage !== 'string') throw error;
    return { outcome: 'error', sassMessage: error.sassMessage, diagnostic: error.message,
      cssReturned: false, warnings, debug };
  }
}
function behavior(result) {
  return result.outcome === 'css'
    ? { outcome: result.outcome, css: result.css }
    : { outcome: result.outcome, sassMessage: result.sassMessage, cssReturned: result.cssReturned };
}
const equalBehavior = (a, b) => JSON.stringify(behavior(a)) === JSON.stringify(behavior(b));
const results = {};
const warningCounts = {};
const comparisons = [];
for (const input of inputs) {
  const source = readArtifact(input.source);
  const pair = {};
  for (const compiler of [currentSass, legacySass]) {
    const v = version(compiler);
    const result = compile(compiler, source);
    pair[v] = result;
    (results[v] ??= {})[input.id] = result;
    warningCounts[v] ??= {};
    for (const warning of result.warnings) {
      warningCounts[v][warning.category] = (warningCounts[v][warning.category] ?? 0) + 1;
    }
    save(`${v}/${input.id}.json`, { source: input.source, sourceSha256: sha256(source), ...result });
  }
  const current = pair['1.104.1'];
  const historical = pair['1.83.4'];
  comparisons.push({ id: input.id, identical: equalBehavior(current, historical),
    currentMatchesCaptured: equalBehavior(current, input.expected),
    historicalMatchesCaptured: equalBehavior(historical, input.expected),
    currentOutcome: current.outcome, historicalOutcome: historical.outcome,
    exactDiagnosticEqual: current.outcome === 'error' && historical.outcome === 'error'
      ? current.diagnostic === historical.diagnostic : null });
}
const isolation = isolationCases.map(({ id }) => {
  const entry = { id, capturedIsolated: JSON.parse(readArtifact(`state-isolation/${id}/result.json`)).isolated };
  for (const v of ['1.104.1', '1.83.4']) {
    const alone = results[v][`state-isolation/${id}/alone`];
    const sequence = results[v][`state-isolation/${id}/sequence`];
    entry[v] = alone.outcome === 'css' && sequence.outcome === 'css'
      ? { isolated: probeCss(alone.css) === probeCss(sequence.css), aloneProbe: probeCss(alone.css), sequenceProbe: probeCss(sequence.css) }
      : { isolated: null, aloneOutcome: alone.outcome, sequenceOutcome: sequence.outcome };
  }
  return entry;
});
assert.deepEqual(protectedHashes(), beforeHashes, 'Protected source, artifacts, or package metadata changed');
save('protected-hashes.json', Object.fromEntries(Object.entries(beforeHashes).map(([path, hash]) => [relative(projectRoot, path), hash])));
const summary = {
  reference, node: process.version, compilerInfo: { current: currentSass.info, historical: legacySass.info },
  legacyCompilerPath: relative(projectRoot, legacyCompilerPath),
  characterizationTests: cases.length + isolationCases.length,
  inputsCompared: inputs.length, compilations: inputs.length * 2,
  identicalOutputs: comparisons.filter((c) => c.identical).length,
  differences: comparisons.filter((c) => !c.identical),
  capturedArtifactMismatches: comparisons.filter((c) => !c.currentMatchesCaptured || !c.historicalMatchesCaptured),
  warningCounts, isolation, comparisons, protectedFilesUnchanged: true,
};
save('summary.json', summary);
console.log(JSON.stringify({ output: relative(projectRoot, outputRoot), inputsCompared: summary.inputsCompared,
  identicalOutputs: summary.identicalOutputs, differences: summary.differences,
  capturedArtifactMismatches: summary.capturedArtifactMismatches, warningCounts,
  stateLeaks: isolation.filter((c) => !c['1.83.4'].isolated).map((c) => c.id),
  protectedFilesUnchanged: true }, null, 2));
if (summary.differences.length || summary.capturedArtifactMismatches.length) process.exitCode = 1;

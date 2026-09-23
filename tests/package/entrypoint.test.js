import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compileString, NodePackageImporter } from 'sass';
import { projectRoot } from '../../helpers/project-paths.js';

test('packed package resolves its root and exposes only the stable Sass API', () => {
  const consumer = mkdtempSync(join(tmpdir(), 'beminator-package-'));
  try {
    // Pack the real project without lifecycle scripts, registry access, or global cache writes.
    const [packed] = JSON.parse(execFileSync('npm', [
      'pack', projectRoot, '--json', '--ignore-scripts', '--offline',
      '--pack-destination', consumer, '--cache', join(consumer, 'npm-cache'),
    ], { cwd: consumer, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }));
    assert.equal(packed.name, 'sass-beminator');
    const files = packed.files.map(({ path }) => path);
    for (const required of ['package.json', 'src/_index.scss', 'src/core/_bem.scss']) {
      assert.ok(files.includes(required), `Missing packed file: ${required}`);
    }
    assert.ok(files.every((path) => !/^(tests|spikes|tmp|node_modules|characterization)\//.test(path)));
    const installed = join(consumer, 'node_modules', 'sass-beminator');
    mkdirSync(installed, { recursive: true });
    execFileSync('tar', ['-xzf', join(consumer, packed.filename), '-C', installed, '--strip-components=1']);
    const metadata = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'));
    assert.equal(metadata.sass, './src/_index.scss');
    assert.deepEqual(metadata.exports, { '.': { sass: './src/_index.scss' } });

    const result = compileString(`
      @use 'pkg:sass-beminator' as bem with (
        $element-separator: '-', $modifier-separator: '_',
        $css-layers: (components: (), utilities: ())
      );
      @use 'sass:meta'; @use 'sass:map'; @use 'sass:list';
      $mixins: meta.module-mixins('bem');
      @if list.length($mixins) != 6 { @error 'Unexpected mixin count'; }
      @each $name in (block, element, modifier, selector, extend, css-layers) {
        @if not map.has-key($mixins, $name) { @error 'Missing mixin: #{$name}'; }
      }
      $variables: meta.module-variables('bem');
      @if list.length($variables) != 3 { @error 'Unexpected variable count'; }
      @each $name in (element-separator, modifier-separator, css-layers) {
        @if not map.has-key($variables, $name) { @error 'Missing setting: #{$name}'; }
      }
      @if list.length(meta.module-functions('bem')) != 0 { @error 'Unexpected public functions'; }
      @include bem.css-layers();
      @include bem.block('card', $layer: 'components') {
        color: red;
        @include bem.element('title') {
          @include bem.modifier('active') { color: blue; }
        }
        @include bem.selector(':hover') { color: green; }
        @include bem.extend('icon', 'small') { color: black; }
      }
    `, {
      url: pathToFileURL(join(consumer, 'consumer.scss')),
      importers: [new NodePackageImporter(consumer)],
      style: 'expanded',
    });
    assert.equal(result.css, `@layer components, utilities;
@layer components {
  .card {
    color: red;
  }
  .card-title_active {
    color: blue;
  }
  .card:hover {
    color: green;
  }
  .card .icon_small {
    color: black;
  }
}`);
    // Prove resolution used the unpacked artifact, not this checkout or a load path.
    assert.deepEqual(result.loadedUrls.map(fileURLToPath).sort(), [
      join(consumer, 'consumer.scss'),
      join(installed, 'src', '_index.scss'), join(installed, 'src', 'core', '_bem.scss'),
    ].sort());
  } finally {
    rmSync(consumer, { recursive: true, force: true });
  }
});

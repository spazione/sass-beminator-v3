import { compileString } from 'sass';

// Preserve CSS semantics and native Sass diagnostics; normalize only line endings.
export function compileScss(source, { loadPaths = [], url } = {}) {
  const result = compileString(source, {
    syntax: 'scss',
    loadPaths,
    url,
    style: 'expanded',
    charset: false,
    sourceMap: false,
  });
  return result.css.replace(/\r\n?/g, '\n');
}

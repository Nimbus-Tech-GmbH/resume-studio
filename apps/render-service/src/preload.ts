// Preload: stub CSS imports (ESM + CJS) so React themes that `import './x.css'`
// at module load can run in Node without a bundler.
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./css-hook.mjs', pathToFileURL(import.meta.url));

const require = createRequire(import.meta.url);
require.extensions['.css'] = (module) => {
  module.exports = {};
};

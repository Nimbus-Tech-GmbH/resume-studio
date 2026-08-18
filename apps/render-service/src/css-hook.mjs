// Node ESM loader hook. Stubs `.css` imports so React themes that import
// CSS at module load can run under bundler-free Node.
export async function resolve(specifier, context, next) {
  if (specifier.endsWith('.css')) {
    return {
      url: 'data:text/javascript,export%20default%20{}',
      shortCircuit: true,
      format: 'module',
    };
  }
  return next(specifier, context);
}

import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');
const isProduction = process.argv.includes('--production');

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints: ['src/extension/extension.ts'],
  bundle: true,
  outfile: 'out/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'ES2022',
  sourcemap: !isProduction,
  minify: isProduction,
  alias: {
    '@shared': './src/shared',
    '@extension': './src/extension',
  },
};

if (isWatch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log('[esbuild] watching...');
} else {
  await esbuild.build(buildOptions);
  console.log('[esbuild] build complete');
}

import { defineConfig, transformWithEsbuild } from 'vite';
import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const notices = readFileSync(new URL('./THIRD_PARTY_NOTICES.md', import.meta.url), 'utf8');
const license = readFileSync(new URL('./LICENSE', import.meta.url), 'utf8');
export default defineConfig({
  define: { __HAUS_BLICK_VERSION__: JSON.stringify(pkg.version) },
  plugins: [{ name: 'single-file-license-preservation', enforce: 'post',
    async generateBundle(_options, bundle) {
      for (const item of Object.values(bundle)) if (item.type === 'chunk') {
        const result = await transformWithEsbuild(item.code, item.fileName, { loader: 'js', target: 'es2022', minify: true, legalComments: 'none' });
        item.code = `/*! Haus Blick ${pkg.version} — MIT\n${license}\n${notices.replaceAll('*/', '* /')}\n*/\n` + result.code;
      }
    }
  }],
  build: {
    target: 'es2022',
    sourcemap: false,
    minify: false,
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: () => 'haus-blick.js' },
    rollupOptions: { output: { inlineDynamicImports: true } }
  }
});

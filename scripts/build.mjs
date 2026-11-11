import { build } from 'esbuild'
import { mkdir } from 'node:fs/promises'

await mkdir('desktop', { recursive: true })
await build({
  entryPoints: ['src/hermes/entry.tsx'],
  outfile: 'desktop/plugin.js',
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: 'es2022',
  minify: true,
  external: ['@hermes/plugin-sdk', 'react', 'react/jsx-runtime'],
  define: { 'process.env.NODE_ENV': '"production"' },
})
console.log('Built desktop/plugin.js')

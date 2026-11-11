import { pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const stubs = {
  '@hermes/plugin-sdk': join(root, 'stub-sdk.mjs'),
  react: join(root, '..', 'node_modules', 'react', 'index.js'),
  'react/jsx-runtime': join(root, '..', 'node_modules', 'react', 'jsx-runtime.js'),
}

export async function resolve(specifier, context, nextResolve) {
  if (stubs[specifier]) {
    return { url: pathToFileURL(stubs[specifier]).href, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}

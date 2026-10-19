import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'

// Monaco грузится из бандла, без CDN: воркер собирается Vite из ./editor.worker.ts.
Object.assign(globalThis, {
  MonacoEnvironment: {
    getWorker: () => new Worker(new URL('./editor.worker.ts', import.meta.url), { type: 'module' }),
  },
})
loader.config({ monaco })

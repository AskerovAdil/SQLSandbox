import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base: локально "/", в CI — "/<repo>/" (GitHub Pages).
// Пути к ассетам, WASM PGlite и воркерам Monaco строятся от base автоматически.
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
const base = process.env.VITE_BASE ?? (process.env.GITHUB_ACTIONS && repo ? `/${repo}/` : '/')

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ['@electric-sql/pglite'],
  },
  worker: {
    format: 'es',
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})

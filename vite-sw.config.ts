import { defineConfig } from 'vite'
import * as path from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/web/service-worker.ts'),
      name: 'ServiceWorker',
      fileName: () => 'service-worker.js',
      formats: ['iife']
    },
    outDir: 'dist/web',
    emptyOutDir: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
})
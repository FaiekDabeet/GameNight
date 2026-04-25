import { defineConfig } from 'vite'

export default defineConfig({
  // Base path — change to '/gamenight/' if hosting on GitHub Pages subdirectory
  base: '/ ',

  build: {
    outDir: 'dist',
    sourcemap: true,
  },

  server: {
    port: 5173,
    open: true,
  },
})

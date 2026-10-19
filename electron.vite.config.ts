import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@main': resolve('src/main')
      }
    },
    build: {
      rollupOptions: {
        external: ['better-sqlite3', 'active-win'],
        output: {
          assetFileNames: '[name].[ext]'
        }
      },
      assetsInclude: ['**/*.sql'],
      copyPublicDir: false
    }
  },
  preload: {
    resolve: {
      alias: {
        '@preload': resolve('src/preload')
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer')
      }
    },
    plugins: [react()],
    css: {
      postcss: './postcss.config.js'
    }
  }
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { builtinModules } from 'node:module'

const isElectron = process.env.ELECTRON === 'true';

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    ...(isElectron ? [
      electron([
        {
          // Main process entry file of the Electron App.
          entry: 'electron/main.ts',
          onstart(options) {
            options.startup()
          },
          vite: {
            build: {
              outDir: 'dist-electron',
              minify: false,
              rollupOptions: {
                output: {
                  format: 'es',
                  entryFileNames: '[name].js',
                },
                // Externalize all dependencies and built-ins to prevent bundling CJS into ESM
                external: [
                  'electron',
                  ...builtinModules,
                  ...builtinModules.map(m => `node:${m}`),
                  /^[^./]/, // Matches all third-party node_modules
                ],
              },
            },
          },
        },
        {
          entry: 'electron/preload.ts',
          onstart(options) {
            options.reload()
          },
          vite: {
            build: {
              outDir: 'dist-electron',
              minify: false,
              lib: {
                entry: 'electron/preload.ts',
                formats: ['cjs'],
                fileName: () => 'preload.cjs',
              },
              rollupOptions: {
                external: ['electron'],
              },
            },
          },
        },
      ]),
      renderer(),
    ] : []),
  ],
  build: {
    minify: false,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  define: {
    'process.env': {}
  },
  optimizeDeps: {
    include: [
      'react-markdown',
      'remark-gfm',
      'react-syntax-highlighter',
      'react-syntax-highlighter/dist/esm/styles/prism'
    ]
  },
  server: {
    port: 5174,
    proxy: {
      '/api/openai': {
        target: 'https://api.openai.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openai/, ''),
      },
      '/api/anthropic': {
        target: 'https://api.anthropic.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
      },
      '/api/moonshot': {
        target: 'https://api.moonshot.cn/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/moonshot/, ''),
      },
      '/api/deepseek': {
        target: 'https://api.deepseek.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/deepseek/, ''),
      },
      '/api/glm': {
        target: 'https://open.bigmodel.cn/api/paas/v4',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/glm/, ''),
      },
      '/api/gemini': {
        target: 'https://generativelanguage.googleapis.com/v1beta',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gemini/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const key = req.headers['x-goog-api-key'];
            if (key) {
              proxyReq.path += (proxyReq.path.includes('?') ? '&' : '?') + `key=${key}`;
            }
          });
        }
      }
    },
  },
})

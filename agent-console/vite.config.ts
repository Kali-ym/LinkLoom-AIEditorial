import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

function manualChunks(id: string): string | undefined {
  const normalized = id.replace(/\\/g, '/')

  if (!normalized.includes('node_modules')) {
    // Do not force app feature chunks (ChatInput/WorkingSidebar/tool-renders):
    // cross-imports create circular TDZ errors in production
    // ("Cannot access 'X' before initialization").
    return undefined
  }

  // React must stay in one chunk. Splitting react into lobehub-ui and
  // react-dom into antd caused: Cannot set properties of undefined (setting 'Activity').
  if (
    normalized.includes('/node_modules/react/') ||
    normalized.includes('/node_modules/react-dom/') ||
    normalized.includes('/node_modules/scheduler/') ||
    normalized.includes('/node_modules/use-sync-external-store/')
  ) {
    return 'vendor-react'
  }

  if (
    normalized.includes('@lobehub/editor') ||
    normalized.includes('/lexical/') ||
    normalized.includes('/@lexical/')
  ) {
    return 'vendor-editor'
  }
  if (normalized.includes('@lobehub/icons')) {
    return 'vendor-lobehub-icons'
  }
  if (normalized.includes('@lobehub/ui')) {
    return 'vendor-lobehub-ui'
  }
  if (normalized.includes('/antd/') || normalized.includes('/antd-style/')) {
    return 'vendor-antd'
  }
  if (normalized.includes('framer-motion')) {
    return 'vendor-motion'
  }
  if (normalized.includes('@sentry')) {
    return 'vendor-sentry'
  }
  if (normalized.includes('/cmdk')) {
    return 'vendor-cmdk'
  }
  // Keep shiki/mermaid language packs as Vite's natural async chunks —
  // forcing them into one vendor-* blob regresses first paint.
  return undefined
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../', '')
  const backendPort = env.PORT || '3000'
  const backendUrl = `http://localhost:${backendPort}`
  const versionFilePath = path.resolve(__dirname, '../version')
  const appVersion = fs.existsSync(versionFilePath)
    ? fs.readFileSync(versionFilePath, 'utf-8').trim()
    : '0'

  const lexicalDedupe = ['lexical', '@lexical/utils'] as const

  return {
    base: '/console/',
    plugins: [react()],
    resolve: {
      dedupe: ['react', 'react-dom', ...lexicalDedupe],
      alias: {
        lexical: path.resolve(__dirname, 'node_modules/lexical'),
        '@lexical/utils': path.resolve(__dirname, 'node_modules/@lexical/utils'),
      },
    },
    optimizeDeps: {
      include: [...lexicalDedupe],
    },
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    build: {
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks,
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5174,
      strictPort: true,
      proxy: {
        '/api': { target: backendUrl, changeOrigin: true },
        '/writeData': { target: backendUrl, changeOrigin: true },
        '/genAIContent': { target: backendUrl, changeOrigin: true },
        '/commitToGitHub': { target: backendUrl, changeOrigin: true },
      },
    },
  }
})

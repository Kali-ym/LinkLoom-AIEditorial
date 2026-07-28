import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

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
      dedupe: [...lexicalDedupe],
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

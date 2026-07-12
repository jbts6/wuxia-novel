import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { libraryApiPlugin } from './server/libraryApiPlugin'

const repositoryRoot = path.resolve(__dirname, '..')

export default defineConfig({
  plugins: [
    libraryApiPlugin({ rootDirectory: repositoryRoot }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

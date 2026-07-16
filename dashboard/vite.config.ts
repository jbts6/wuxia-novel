import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { libraryApiPlugin } from './server/libraryApiPlugin'
import { reviewApiPlugin } from './server/reviewApiPlugin'

const repositoryRoot = path.resolve(__dirname, '..')

export default defineConfig({
  plugins: [
    libraryApiPlugin({ rootDirectory: repositoryRoot }),
    reviewApiPlugin({ rootDirectory: repositoryRoot }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

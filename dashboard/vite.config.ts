import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@data/天龙八部': path.resolve(__dirname, '../金庸/天龙八部/data'),
      '@data/神雕侠侣': path.resolve(__dirname, '../金庸/神雕侠侣/data'),
      '@data/碧血剑': path.resolve(__dirname, '../金庸/碧血剑/data'),
    },
  },
})

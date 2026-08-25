import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins:[react()], build:{ outDir:'dist-A', emptyOutDir:true, rollupOptions:{ input:'measure/A.html' } } })

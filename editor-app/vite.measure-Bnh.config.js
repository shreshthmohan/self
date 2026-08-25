import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins:[react()], build:{ outDir:'dist-Bnh', emptyOutDir:true, rollupOptions:{ input:'measure/Bnh.html' } } })

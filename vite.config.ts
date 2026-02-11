import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Bu ayar çok önemlidir. APK içinde dosyaların '/assets' yerine './assets' 
  // şeklinde bulunmasını sağlar.
  base: './', 
})
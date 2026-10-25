import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  base: process.env.VITE_ASSET_BASE || "/",
  plugins: [react()],
  css: {
    postcss: {
      plugins: [],
    },
  },
  server: { host: "0.0.0.0", port: 8443 },
  preview: { host: "0.0.0.0", port: 8443 },
})
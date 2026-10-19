import path from "node:path"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@resume-studio/ai-contracts": path.resolve(__dirname, "../../packages/ai-contracts/src/index.ts"),
    },
  },
  server: {
    proxy: {
      "/api/auth": {
        target: process.env.AUTH_PORT ? `http://127.0.0.1:${process.env.AUTH_PORT}` : "http://127.0.0.1:4000",
        changeOrigin: true,
      },
      "/api/ai": {
        target: process.env.AI_PORT ? `http://127.0.0.1:${process.env.AI_PORT}` : "http://127.0.0.1:4100",
        changeOrigin: true,
      },
    },
  },
})

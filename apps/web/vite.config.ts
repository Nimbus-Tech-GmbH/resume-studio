import path from "node:path"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig, loadEnv } from "vite"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, "../.."), "")

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: {
        "/api/ai/opencode": {
          target: env.OPENCODE_TARGET || "https://opencode.ai",
          changeOrigin: true,
          rewrite: (requestPath) =>
            requestPath.replace(/^\/api\/ai\/opencode/, "/inference"),
        },
        "/api/auth": {
          target: `http://127.0.0.1:${env.AUTH_PORT || "4000"}`,
          changeOrigin: true,
        },
      },
    },
  }
})

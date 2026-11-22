import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

export default defineConfig(({ mode }) => {
  const { CAP_DEV_USER } = loadEnv(mode, __dirname, "")

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/odata/v4": {
          target: "http://localhost:4004",
          configure: (proxy) => {
            if (!CAP_DEV_USER) return

            const authorization = `Basic ${Buffer.from(`${CAP_DEV_USER}:`).toString("base64")}`
            proxy.on("proxyReq", (proxyRequest) => {
              proxyRequest.setHeader("Authorization", authorization)
            })
          },
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
})

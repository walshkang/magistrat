import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolveDevServerConfig } from "./src/devtools/dev-server-config";

export default defineConfig(() => ({
  plugins: [react()],
  server: {
    port: 3010,
    strictPort: true,
    ...resolveDevServerConfig(process.env)
  }
}));

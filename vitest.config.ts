import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["scripts/**", "node_modules/**"],
  },
});

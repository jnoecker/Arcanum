import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  define: {
    __BUILD_VARIANT__: JSON.stringify("full"),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@fontsource")) return "vendor-fonts";
          if (id.includes("@tiptap") || id.includes("tippy.js")) return "vendor-editor";
          if (id.includes("@xyflow") || id.includes("@dagrejs")) return "vendor-graph";
          if (id.includes("leaflet") || id.includes("react-leaflet")) return "vendor-map";
          if (id.includes("react-arborist")) return "vendor-tree";
          if (id.includes("@imgly/background-removal")) return "vendor-image";
          if (id.includes("@tauri-apps")) return "vendor-tauri";
          if (id.includes("/yaml/")) return "vendor-yaml";
          return undefined;
        },
      },
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));

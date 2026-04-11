import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react()],
  worker: {
    format: "es" as const,
  },
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
          if (id.includes("recharts")) return "vendor-charts";
          if (id.includes("motion")) return "vendor-motion";
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
    // Cross-origin isolation enables SharedArrayBuffer, which lets
    // @imgly/background-removal run its WASM/ONNX inference with
    // multi-threading (numThreads = navigator.hardwareConcurrency)
    // instead of falling back to single-threaded execution.
    // `credentialless` is used instead of `require-corp` so that
    // staticimgly.com (which doesn't send CORP headers) can still
    // serve the model files — the browser just drops credentials.
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless",
    },
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

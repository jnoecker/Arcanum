import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

// Middleware plugin that unconditionally stamps COOP + COEP on every
// response from the dev server. Vite's `server.headers` option drops
// through some internal transforms (notably worker-script responses),
// so rely on this plugin instead. SharedArrayBuffer — and therefore
// multi-threaded WASM in @imgly/background-removal — requires both
// the top-level document AND every subresponse to carry these.
// COEP: credentialless keeps staticimgly.com (no CORP headers) loadable.
const crossOriginIsolation = (): Plugin => ({
  name: "cross-origin-isolation",
  configureServer(server) {
    server.middlewares.use((_req, res, next) => {
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
      next();
    });
  },
  configurePreviewServer(server) {
    server.middlewares.use((_req, res, next) => {
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
      next();
    });
  },
});

export default defineConfig(async () => ({
  plugins: [react(), crossOriginIsolation()],
  define: {
    __BUILD_VARIANT__: JSON.stringify(process.env.VITE_AI === 'false' ? 'community' : 'full'),
  },
  worker: {
    format: "es" as const,
  },
  // Force-include deps that are only referenced from inside a Web
  // Worker. Vite's dependency scanner doesn't crawl worker source
  // files at startup, so it discovers them on first worker
  // instantiation — which triggers a full-page reload ("new
  // dependencies optimized") and nukes in-progress edits. Including
  // them here makes the dev server pre-bundle them up front.
  optimizeDeps: {
    include: ["@imgly/background-removal"],
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

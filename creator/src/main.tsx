import React from "react";
import ReactDOM from "react-dom/client";

// Fontsource bundles (local, no CDN)
import "@fontsource/cinzel/400.css";
import "@fontsource/cinzel/600.css";
import "@fontsource/cinzel/700.css";
import "@fontsource/crimson-pro/400.css";
import "@fontsource/crimson-pro/400-italic.css";
import "@fontsource/crimson-pro/500.css";
import "@fontsource/crimson-pro/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";

import { App } from "./App";
import "./index.css";
import { bootstrapTheme } from "./stores/themeStore";

// Apply persisted theme before first render to avoid a flash of defaults.
bootstrapTheme();

// One-shot diagnostic for the cross-origin isolation feature that BG
// removal needs for multi-threaded WASM. If this logs `false` the COOP/
// COEP headers aren't making it to the top-level document — check the
// Network tab of DevTools for the index.html response headers.
console.info("[arcanum] crossOriginIsolated =", self.crossOriginIsolated);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

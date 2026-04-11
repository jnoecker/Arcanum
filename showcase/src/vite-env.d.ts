/// <reference types="vite/client" />

declare module "*.css" {}
declare module "@fontsource/*/400.css" {}
declare module "@fontsource/*/600.css" {}
declare module "@fontsource/*/700.css" {}

interface ImportMetaEnv {
  readonly VITE_SHOWCASE_URL?: string;
  readonly VITE_HUB_ROOT_DOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

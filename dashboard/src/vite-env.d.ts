/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HUB_ADDRESS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

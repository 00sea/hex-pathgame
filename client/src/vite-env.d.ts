// client/src/vite-env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_URL?: string
  readonly VITE_DEBUG?: string
  readonly VITE_APP_NAME?: string
  readonly VITE_LOG_LEVEL?: string
  // Add more environment variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
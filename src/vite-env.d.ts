/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_NUTRIENT_API_KEY: string
  readonly VITE_MPESA_CONSUMER_KEY: string
  readonly VITE_MPESA_CONSUMER_SECRET: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
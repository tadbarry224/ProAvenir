/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Adresse de l'API NestJS, ex. http://localhost:3001/api (voir .env.example). */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

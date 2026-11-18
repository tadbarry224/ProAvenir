/**
 * Configuration des tests (Vitest).
 *
 * Fichier séparé de vite.config.ts pour ne pas charger les plugins spécifiques
 * à Figma Make pendant les tests. On garde seulement ce qui est utile :
 * le plugin React (JSX) et l'alias "@" vers src.
 */
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Remarque Windows : Vitest est lancé via scripts/vitest.mjs (voir ce fichier).

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    // Par défaut, les tests tournent dans Node (rapide, suffisant pour la logique pure).
    // Les tests d'interface déclarent `// @vitest-environment jsdom` en haut du fichier
    // pour disposer d'un faux navigateur (document, window…).
    environment: "node",
    restoreMocks: true,
    // Adresse fictive : les tests d'interface remplacent fetch par src/test/fakeApi.ts.
    env: { VITE_API_URL: "http://api.test/api" },
  },
});

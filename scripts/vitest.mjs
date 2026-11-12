/**
 * Lance Vitest en corrigeant un problème propre à Windows.
 *
 * Quand le terminal est ouvert sur « c:\… » (lettre de lecteur en minuscule,
 * cas fréquent dans VS Code), Vitest charge deux copies de lui-même
 * (« c:\… » et « C:\… ») et tous les tests échouent avec :
 *   TypeError: Cannot read properties of undefined (reading 'config')
 *
 * Ce script relance simplement Vitest depuis le même dossier écrit avec
 * une majuscule. Sur macOS et Linux, il ne change rien.
 *
 * Utilisation (via package.json) : npm test  |  npm run test:watch
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

const cwd = process.cwd().replace(/^[a-z]:/, (drive) => drive.toUpperCase());
const vitestBin = path.join(cwd, "node_modules", "vitest", "vitest.mjs");

const result = spawnSync(process.execPath, [vitestBin, ...process.argv.slice(2)], {
  cwd,
  stdio: "inherit",
});

process.exit(result.status ?? 1);

#!/usr/bin/env node
/**
 * Nitro bundles `@electric-sql/pglite` JS into `__server.func/_libs/` but
 * leaves behind `pglite.data` / `*.wasm`. Local `vite preview` then crashes
 * on PGLite bootstrap. Copy the assets next to the bundled module.
 * No-op when the nitro output isn't there (or we're on a Neon-only deploy).
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "node_modules/@electric-sql/pglite/dist");
const destDir = join(root, ".vercel/output/functions/__server.func/_libs");

if (!existsSync(destDir)) {
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });
for (const name of ["pglite.data", "pglite.wasm", "initdb.wasm"]) {
  const src = join(srcDir, name);
  if (!existsSync(src)) continue;
  copyFileSync(src, join(destDir, name));
}

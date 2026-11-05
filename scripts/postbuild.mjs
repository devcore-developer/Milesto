import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Post-build helper: copies runtime assets into the standalone output.
 * Works on Windows, macOS and Linux (replaces the Unix-only `cp -r` commands).
 *
 * Copies:
 * 1. `.next/static`  → client chunks
 * 2. `public/`       → static assets
 * 3. PDF fonts       → the invoice/document templates read the Inter and
 *    Noto Sans Arabic woff2 files from `node_modules/@fontsource-variable/…`
 *    at runtime (see src/lib/pdf/*-html.ts). Output-file tracing cannot see
 *    those dynamic paths, so without this copy a standalone deployment would
 *    silently fall back to system fonts in exported PDFs.
 */
const root = process.cwd();
const standalone = join(root, ".next", "standalone");

if (!existsSync(standalone)) {
  // Non-fatal: some hosting platforms (e.g. Vercel) serve from `.next`
  // directly and never produce the standalone bundle.
  console.warn("standalone output not found — skipping standalone asset copy");
  process.exit(0);
}

cpSync(join(root, ".next", "static"), join(standalone, ".next", "static"), {
  recursive: true,
});
cpSync(join(root, "public"), join(standalone, "public"), {
  recursive: true,
});

const PDF_FONTS = [
  "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  "@fontsource-variable/noto-sans-arabic/files/noto-sans-arabic-arabic-wght-normal.woff2",
];

for (const rel of PDF_FONTS) {
  const src = join(root, "node_modules", rel);
  const dest = join(standalone, "node_modules", rel);
  if (!existsSync(src)) {
    console.warn(`⚠ PDF font not found (skipped): ${rel}`);
    continue;
  }
  mkdirSync(join(dest, ".."), { recursive: true });
  cpSync(src, dest);
}

console.log("standalone assets copied ✔ (static, public, PDF fonts)");
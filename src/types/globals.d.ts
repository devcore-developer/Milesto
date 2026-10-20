// Ambient type declarations for side-effect imports.
//
// Fixes TS2882 ("Cannot find module or type declarations for side-effect
// import of './globals.css'") raised by newer TypeScript editors (5.6+)
// when side-effect import checking is active. Next.js 14 does not ship a
// plain "*.css" ambient declaration, so we provide one here. The workspace
// tsc version is unaffected, but this declaration satisfies both.

declare module "*.css";
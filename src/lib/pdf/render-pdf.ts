// Headless-Chromium PDF renderer (Phase 5, production-hardened in Phase 7).
//
// One renderer, two environments — detected automatically, no config needed:
//   • Vercel / AWS Lambda (serverless): launches the Lambda-compatible
//     Chromium shipped by @sparticuz/chromium through puppeteer-core.
//     Vercel sets VERCEL=1; force this branch anywhere with
//     PDF_CHROMIUM_SERVERLESS=1.
//   • Local dev & self-hosted Node (VPS/Docker/Railway/Render): launches the
//     full Chrome bundled with the `puppeteer` package.
//
// One browser instance is launched lazily and reused across requests; the
// browser is relaunched automatically if a render crashes it.
import type { Browser } from "puppeteer-core";

function serverlessMode(): boolean {
  if (process.env.PDF_CHROMIUM_SERVERLESS === "1") return true;
  if (process.env.PDF_CHROMIUM_SERVERLESS === "0") return false;
  // Vercel sets VERCEL=1 in every runtime, including Fluid Compute.
  return process.env.VERCEL === "1";
}

async function launchBrowser(): Promise<Browser> {
  // Imported lazily so bundlers never try to resolve puppeteer at build time
  // (both packages are also listed in next.config `serverExternalPackages`).
  if (serverlessMode()) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteerCore = (await import("puppeteer-core")).default;
    return puppeteerCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  const puppeteer = (await import("puppeteer")).default;
  return puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--font-render-hinting=none",
      "--hide-scrollbars",
    ],
  });
}

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launchBrowser().catch((error) => {
      browserPromise = null; // allow the next request to retry the launch
      throw error;
    });
  }
  return browserPromise;
}

/** Optional Chromium print settings (Phase 6: documents with page numbers). */
export interface RenderPdfOptions {
  /** Show running header/footer templates on every page. */
  displayHeaderFooter?: boolean;
  /** Empty by default so Chromium never prints its own date/URL header. */
  headerTemplate?: string;
  footerTemplate?: string;
  /** Page margins — defaults to zero (full-bleed invoice layout). */
  margins?: { top?: string; right?: string; bottom?: string; left?: string };
}

/** Render a complete HTML document into an A4 PDF buffer. */
export async function renderPdf(
  html: string,
  options: RenderPdfOptions = {},
): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // All assets (fonts, logo) are inline data URLs — "load" is sufficient.
    await page.setContent(html, { timeout: 60_000 });
    const bytes = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: options.displayHeaderFooter ?? false,
      // Chromium prints its own header/footer when templates are omitted —
      // always pass explicit (possibly empty) templates.
      headerTemplate: options.headerTemplate ?? "<div></div>",
      footerTemplate: options.footerTemplate ?? "<div></div>",
      margin: options.margins ?? {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
      },
    });
    return Buffer.from(bytes);
  } finally {
    await page.close();
  }
}
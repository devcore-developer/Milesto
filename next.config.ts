import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Puppeteer (used for invoice PDF generation) must stay external so the
  // server bundle launches the real Node module instead of bundling it.
  // puppeteer-core + @sparticuz/chromium power the Vercel serverless branch.
  serverExternalPackages: ["puppeteer", "puppeteer-core", "@sparticuz/chromium"],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
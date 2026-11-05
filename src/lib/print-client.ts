"use client";

/**
 * Print a URL (usually a generated PDF) without leaving the page.
 * A hidden same-origin iframe loads the file and calls print() — this
 * prints the EXACT premium PDF layout, including Arabic RTL pages.
 */
export function printPdfUrl(url: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.inset = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";
  iframe.setAttribute("aria-hidden", "true");

  iframe.addEventListener("load", () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      // Some browsers block programmatic printing — fall back silently.
    }
  });

  document.body.appendChild(iframe);
  iframe.src = url;

  // Clean up long after the print dialog is closed.
  window.setTimeout(() => iframe.remove(), 120_000);
}
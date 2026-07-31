import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export const MAX_PDF_BYTES = 4 * 1024 * 1024;

export function isHtmlFileName(name) {
  return /\.html?$/i.test(name || "");
}

export function pdfDownloadName(name) {
  return (name || "document.html").replace(/\.html?$/i, ".pdf");
}

export async function renderHtmlToPdf(html) {
  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.url().startsWith("data:")) {
        request.continue();
        return;
      }
      request.abort();
    });

    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 10_000 });
    await page.emulateMediaType("screen");
    return Buffer.from(await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    }));
  } finally {
    if (browser) await browser.close();
  }
}

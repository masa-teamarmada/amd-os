import chromium from "@sparticuz/chromium";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import puppeteer from "puppeteer-core";

export const MAX_PDF_BYTES = 4 * 1024 * 1024;
const require = createRequire(import.meta.url);
const FONT_CSS_PATH = require.resolve("@fontsource-variable/noto-sans-jp/wght.css");
const JAPANESE_TEXT_PATTERN = /[\u3040-\u30ff\u3400-\u9fff\uff00-\uffef]/;
let fontCssPromise;

export function isHtmlFileName(name) {
  return /\.html?$/i.test(name || "");
}

export function pdfDownloadName(name) {
  return (name || "document.html").replace(/\.html?$/i, ".pdf");
}

async function loadPdfFontCss() {
  const css = await readFile(FONT_CSS_PATH, "utf8");
  const fileNames = [...new Set([...css.matchAll(/url\(\.\/files\/([^)]*)\)/g)].map((match) => match[1]))];
  const fonts = new Map(await Promise.all(fileNames.map(async (fileName) => [
    fileName,
    (await readFile(join(dirname(FONT_CSS_PATH), "files", fileName))).toString("base64"),
  ])));
  return css.replace(/url\(\.\/files\/([^)]*)\)/g, (_match, fileName) => `url(data:font/woff2;base64,${fonts.get(fileName)})`);
}

async function pdfFontCss(html) {
  fontCssPromise ||= loadPdfFontCss();
  const css = await fontCssPromise;
  const forceJapaneseFont = JAPANESE_TEXT_PATTERN.test(html)
    ? "body, body * { font-family: 'Noto Sans JP Variable', sans-serif !important; }"
    : "";
  return `${css}\n${forceJapaneseFont}`;
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
    await page.addStyleTag({ content: await pdfFontCss(html) });
    await page.evaluate(async () => {
      await document.fonts.load("400 16px 'Noto Sans JP Variable'");
      await document.fonts.ready;
    });
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

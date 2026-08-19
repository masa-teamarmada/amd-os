import chromium from "@sparticuz/chromium";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import puppeteer from "puppeteer-core";

const require = createRequire(import.meta.url);
const FONT_CSS_PATH = require.resolve("@fontsource-variable/noto-sans-jp/wght.css");
// @sparticuz/chromium の executablePath() は引数なしだと CJS の __filename から
// bin を求める。Turbopack の Vercel Function ではその __filename が無く、
// require.resolve() も数値のmodule idへ変換されるため、Functionのproject rootから
// 同梱済みbinを明示する。
const CHROMIUM_BIN_PATH = join(process.cwd(), "node_modules", "@sparticuz", "chromium", "bin");
const JAPANESE_TEXT_PATTERN = /[\u3040-\u30ff\u3400-\u9fff\uff00-\uffef]/;
let fontCssPromise: Promise<string> | undefined;

async function loadPdfFontCss() {
  const css = await readFile(FONT_CSS_PATH, "utf8");
  const fileNames = [...new Set([...css.matchAll(/url\(\.\/files\/([^)]*)\)/g)].map((match) => match[1]))];
  const fonts = new Map<string, string>(await Promise.all(fileNames.map(async (fileName): Promise<[string, string]> => [
    fileName,
    (await readFile(join(dirname(FONT_CSS_PATH), "files", fileName))).toString("base64"),
  ])));
  return css.replace(/url\(\.\/files\/([^)]*)\)/g, (_match, fileName) => `url(data:font/woff2;base64,${fonts.get(fileName)})`);
}

async function pdfFontCss(html: string) {
  fontCssPromise ??= loadPdfFontCss();
  const css = await fontCssPromise;
  const forceJapaneseFont = JAPANESE_TEXT_PATTERN.test(html)
    ? "body, body * { font-family: 'Noto Sans JP Variable', sans-serif !important; }"
    : "";
  return `${css}\n${forceJapaneseFont}`;
}

/**
 * 保存済みHTMLを、HTML内のscriptや外部ネットワークを実行せずにA4 PDFへ組版する。
 * Project Shareの受入済みPDF化契約と同じ安全境界を資料室にも適用する。
 */
type PdfRenderOptions = {
  executablePath?: string;
  args?: string[];
};

export async function renderWorkspaceDocumentHtmlToPdf(
  html: string,
  options: PdfRenderOptions = {},
): Promise<Buffer> {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  try {
    const executablePath = options.executablePath ?? await chromium.executablePath(CHROMIUM_BIN_PATH);
    const args = options.args ?? (options.executablePath ? [] : chromium.args);
    browser = await puppeteer.launch({
      args,
      executablePath,
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

import chromium from "@sparticuz/chromium";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import puppeteer from "puppeteer-core";

// @sparticuz/chromium の executablePath() は引数なしだと CJS の __filename から
// bin を求める。Turbopack の Vercel Function ではその __filename が無く、
// require.resolve() も数値のmodule idへ変換されるため、Functionのproject rootから
// 同梱済みbinを明示する。
// FONT_CSS_PATH も同じ理由で require.resolve() を使わない: Turbopack の本番 chunk では
// module-scope の require.resolve() 呼び出し自体が最適化で消え、`let` 宣言だけが残り
// FONT_CSS_PATH が undefined のまま readFile() へ渡って TypeError になる
// (2026-08-19 本番 /api/workspace-documents/[id]/pdf で発覚)。
const CHROMIUM_BIN_PATH = join(process.cwd(), "node_modules", "@sparticuz", "chromium", "bin");
const FONT_CSS_PATH = join(process.cwd(), "node_modules", "@fontsource-variable", "noto-sans-jp", "wght.css");
const JAPANESE_TEXT_PATTERN = /[\u3040-\u30ff\u3400-\u9fff\uff00-\uffef]/;
let fontCssPromise: Promise<string> | undefined;

const CSS_PX_PER_INCH = 96;
const A4_WIDTH_PX = Math.round((210 / 25.4) * CSS_PX_PER_INCH);
const A4_HEIGHT_PX = Math.round((297 / 25.4) * CSS_PX_PER_INCH);
const DESKTOP_PROBE_WIDTH_PX = 1280;
const MAX_CONTENT_WIDTH_PX = 1800;
const COLLAPSE_HEIGHT_RATIO_THRESHOLD = 1.4;
const PDF_PAGE_MARGIN = "0.35in";

/** A4幅で横組みが縦積みに崩れた資料だけ、元のデスクトップ幅を使う。 */
export function choosePdfContentWidthPx(params: {
  collapsed: boolean;
  desktopScrollWidthPx: number;
}): number {
  if (!params.collapsed) return A4_WIDTH_PX;
  return Math.min(
    Math.max(params.desktopScrollWidthPx, DESKTOP_PROBE_WIDTH_PX),
    MAX_CONTENT_WIDTH_PX,
  );
}

/** 狭いA4幅でカラムが畳まれたかを、実HTMLの高さと横overflowから判定する。 */
export function detectResponsiveCollapse(params: {
  desktopScrollHeightPx: number;
  a4ScrollHeightPx: number;
  desktopScrollWidthPx: number;
}): boolean {
  const { desktopScrollHeightPx, a4ScrollHeightPx, desktopScrollWidthPx } = params;
  if (desktopScrollHeightPx <= 0) return false;
  const heightRatio = a4ScrollHeightPx / desktopScrollHeightPx;
  return heightRatio >= COLLAPSE_HEIGHT_RATIO_THRESHOLD
    || desktopScrollWidthPx > DESKTOP_PROBE_WIDTH_PX + 16;
}

/** A4比率を保ったまま、指定した幅からPDFページ高さ(px)を算出する。 */
export function pdfHeightPxForWidth(widthPx: number): number {
  return Math.round(widthPx * (A4_HEIGHT_PX / A4_WIDTH_PX));
}

function pxToInches(px: number): string {
  return `${(px / CSS_PX_PER_INCH).toFixed(3)}in`;
}

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
 * 保存済みHTMLを、HTML内のscriptや外部ネットワークを実行せずにPDFへ組版する。
 * 横組み資料はA4幅でレスポンシブ表示へ畳まず、元のデスクトップ幅を保つ。
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

    await page.setViewport({ width: DESKTOP_PROBE_WIDTH_PX, height: 1600, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 10_000 });
    await page.addStyleTag({ content: await pdfFontCss(html) });
    await page.evaluate(async () => {
      await document.fonts.load("400 16px 'Noto Sans JP Variable'");
      await document.fonts.ready;
    });
    await page.emulateMediaType("screen");
    const desktopMetrics = await page.evaluate(() => ({
      scrollWidth: Math.ceil(Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0)),
      scrollHeight: Math.ceil(Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0)),
    }));

    await page.setViewport({ width: A4_WIDTH_PX, height: 1600, deviceScaleFactor: 1 });
    const a4Metrics = await page.evaluate(() => ({
      scrollHeight: Math.ceil(Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0)),
    }));
    const pdfWidthPx = choosePdfContentWidthPx({
      collapsed: detectResponsiveCollapse({
        desktopScrollHeightPx: desktopMetrics.scrollHeight,
        a4ScrollHeightPx: a4Metrics.scrollHeight,
        desktopScrollWidthPx: desktopMetrics.scrollWidth,
      }),
      desktopScrollWidthPx: desktopMetrics.scrollWidth,
    });
    const pdfHeightPx = pdfHeightPxForWidth(pdfWidthPx);

    await page.setViewport({ width: pdfWidthPx, height: 1600, deviceScaleFactor: 1 });
    await page.addStyleTag({
      content: `
        /* 元資料のサイドナビはPDFに不要。nav本体だけでなく、その親gridの列も消す。 */
        .side, .sidebar, aside, nav, [role="navigation"] {
          display: none !important;
        }
        .layout {
          display: block !important;
          grid-template-columns: minmax(0, 1fr) !important;
        }
        .layout > :not(.side) {
          min-width: 0 !important;
        }
        h1, h2, h3, h4, h5, h6 {
          break-after: avoid-page !important;
          page-break-after: avoid !important;
        }
      `,
    });
    await page.evaluate((pageHeightPx: number) => {
      const logicalDisplays = new Set(["flex", "inline-flex", "grid", "inline-grid", "table", "table-row"]);
      for (const element of document.body?.querySelectorAll<HTMLElement>("*") ?? []) {
        if (!logicalDisplays.has(getComputedStyle(element).display)) continue;
        const height = element.getBoundingClientRect().height;
        if (height > 0 && height <= pageHeightPx * 0.92) {
          element.style.breakInside = "avoid";
          element.style.pageBreakInside = "avoid";
        }
      }
    }, pdfHeightPx);

    return Buffer.from(await page.pdf({
      width: pxToInches(pdfWidthPx),
      height: pxToInches(pdfHeightPx),
      margin: {
        top: PDF_PAGE_MARGIN,
        right: PDF_PAGE_MARGIN,
        bottom: PDF_PAGE_MARGIN,
        left: PDF_PAGE_MARGIN,
      },
      printBackground: true,
      preferCSSPageSize: false,
    }));
  } finally {
    if (browser) await browser.close();
  }
}

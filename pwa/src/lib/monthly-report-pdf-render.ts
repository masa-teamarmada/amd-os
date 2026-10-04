import { join } from "node:path";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { monthlyReportPdfFontCss } from "./workspace-document-html-pdf.ts";

/** Render the saved print view, preserving its @page and document CSS. No scripts or remote assets run. */
export async function renderMonthlyReportPdf(html: string, executablePath?: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    executablePath: executablePath || await chromium.executablePath(join(process.cwd(), "node_modules/@sparticuz/chromium/bin")),
    args: executablePath ? ["--no-sandbox"] : chromium.args,
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on("request", (request) => request.url().startsWith("data:") ? request.continue() : request.abort());
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 15_000 });
    if (!await page.$(".sheet, .submission-sheet")) throw new Error("保存済み報告書の紙面を取得できなかった");
    // Next streams route content inside hidden suspense containers. Isolate the
    // server-rendered report and its styles so script-free printing stays visible.
    await page.evaluate(() => {
      const report = document.querySelector(".print-root");
      if (!report) throw new Error("報告書の紙面がありません");
      for (const style of Array.from(document.querySelectorAll("style"))) document.head.appendChild(style.cloneNode(true));
      document.body.replaceChildren(report);
    });
    await page.addStyleTag({ content: "* { box-sizing: border-box; }" + await monthlyReportPdfFontCss() });
    await page.emulateMediaType("print");
    await page.evaluate(async () => {
      const sample = document.querySelector(".print-root")?.textContent || "月次報告書";
      const regular = await document.fonts.load('400 12px "Noto Sans JP"', sample);
      const bold = await document.fonts.load('700 12px "Noto Sans JP"', sample);
      await document.fonts.ready;
      if (!regular.length || !bold.length) throw new Error("日本語フォントを読み込めませんでした。");
    });
    return Buffer.from(await page.pdf({ format: "A4", preferCSSPageSize: true, printBackground: true, timeout: 25_000 }));
  } finally { await browser.close(); }
}

#!/usr/bin/env node

import { chromium } from "playwright";

const rawPattern = /tech-poc-gate|ewir-internal-definition|business-poc-conditions|funding-investor-conditions|funding-step2-runway|FC\s*北陸|北陸工場|\brunway\b/gi;
const url = process.env.SX_VISIBLE_AUDIT_URL || "https://amd-os-pwa.vercel.app/project/p21/workspace";
const widths = (process.env.SX_VISIBLE_AUDIT_WIDTHS || "390,768,1440").split(",").map((value) => Number(value));
const cookieName = process.env.SX_VISIBLE_AUDIT_COOKIE_NAME;
const cookieValue = process.env.SX_VISIBLE_AUDIT_COOKIE_VALUE;

if (!cookieName || !cookieValue) {
  throw new Error("SX_VISIBLE_AUDIT_COOKIE_NAME と SX_VISIBLE_AUDIT_COOKIE_VALUE が必要だよ");
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.context().addCookies([{ name: cookieName, value: cookieValue, url, httpOnly: true, secure: true, sameSite: "Lax" }]);
  const reports = [];
  for (const width of widths) {
    const consoleErrors = [];
    page.removeAllListeners("console");
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    await page.setViewportSize({ width, height: width < 500 ? 844 : width < 1000 ? 900 : 900 });
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await page.locator("#management-summary").waitFor({ state: "visible", timeout: 30000 });
    const report = await page.evaluate((patternSource) => {
      const visibleText = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const parent = node.parentElement;
        if (parent && !["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName)) {
          const style = window.getComputedStyle(parent);
          const rect = parent.getBoundingClientRect();
          if (style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0) visibleText.push(node.textContent || "");
        }
        node = walker.nextNode();
      }
      const text = visibleText.join(" ");
      const pattern = new RegExp(patternSource, "gi");
      return { matches: [...text.matchAll(pattern)].map((match) => match[0]), scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth };
    }, rawPattern.source);
    const matches = [...new Set(report.matches.map((match) => match.toLowerCase()))];
    reports.push({ width, matches, scrollWidth: report.scrollWidth, bodyScrollWidth: report.bodyScrollWidth, consoleErrors });
    if (matches.length > 0) throw new Error(`${width}pxに内部語が残っているよ: ${matches.join(", ")}`);
  }
  console.log(JSON.stringify({ url, reports }, null, 2));
} finally {
  await browser.close();
}

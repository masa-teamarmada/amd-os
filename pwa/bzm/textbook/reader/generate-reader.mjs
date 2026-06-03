#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pwaRoot = path.resolve(__dirname, "../../..");
const manuscriptDir = path.join(pwaRoot, "bzm/public-manuscript");
const outputPath = path.join(__dirname, "textbook-reader.html");

const files = fs
  .readdirSync(manuscriptDir)
  .filter((file) => /^\d+-.+\.md$/.test(file))
  .sort((a, b) => Number(a.match(/^\d+/)?.[0] ?? 0) - Number(b.match(/^\d+/)?.[0] ?? 0));

const chapters = files.map((file) => {
  const markdown = fs.readFileSync(path.join(manuscriptDir, file), "utf8");
  const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? file.replace(/\.md$/, "");
  return { file, title, markdown };
});

const payload = JSON.stringify(chapters)
  .replace(/</g, "\\u003c")
  .replace(/\u2028/g, "\\u2028")
  .replace(/\u2029/g, "\\u2029");

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Before Zero Manuscript Reader</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f6f8;
      --paper: #ffffff;
      --ink: #111827;
      --muted: #687385;
      --line: #d7dde5;
      --accent: #0f766e;
      --accent-2: #9f1239;
      --shadow: 0 18px 60px rgba(15, 23, 42, .16);
      --font-size: 18px;
    }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      min-height: 100%;
      background:
        linear-gradient(135deg, rgba(15,118,110,.12), transparent 28%),
        radial-gradient(circle at 82% 18%, rgba(159,18,57,.11), transparent 26%),
        var(--bg);
      color: var(--ink);
      font-family: "Hiragino Mincho ProN", "Yu Mincho", "YuMincho", "Noto Serif JP", serif;
      overflow: hidden;
    }

    button, select {
      font: inherit;
    }

    .reader {
      width: 100vw;
      height: 100dvh;
      display: grid;
      grid-template-rows: auto 1fr auto;
      padding: max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom));
      gap: 10px;
    }

    .topbar, .bottombar {
      z-index: 10;
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 8px;
      max-width: 920px;
      width: 100%;
      margin: 0 auto;
    }

    .bottombar {
      grid-template-columns: auto 1fr auto auto;
    }

    .brand {
      display: grid;
      gap: 2px;
      min-width: 0;
    }

    .brand strong {
      font-size: 12px;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: var(--accent);
      white-space: nowrap;
    }

    .brand span, .progress {
      color: var(--muted);
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    select {
      min-width: 0;
      width: 100%;
      border: 1px solid var(--line);
      background: rgba(255,255,255,.82);
      color: var(--ink);
      border-radius: 8px;
      padding: 9px 10px;
      box-shadow: 0 8px 20px rgba(15,23,42,.06);
    }

    .icon-button {
      width: 42px;
      height: 42px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,.9);
      color: var(--ink);
      display: grid;
      place-items: center;
      box-shadow: 0 10px 24px rgba(15,23,42,.10);
    }

    .icon-button:active {
      transform: translateY(1px);
    }

    .deck {
      height: 100%;
      max-width: 920px;
      width: 100%;
      margin: 0 auto;
      display: flex;
      overflow-x: auto;
      overflow-y: hidden;
      scroll-snap-type: x mandatory;
      scroll-behavior: smooth;
      border-radius: 12px;
      scrollbar-width: none;
    }

    .deck::-webkit-scrollbar { display: none; }

    .page {
      flex: 0 0 100%;
      height: 100%;
      scroll-snap-align: start;
      padding: 4px;
    }

    .sheet {
      height: 100%;
      overflow-y: auto;
      background: var(--paper);
      border: 1px solid rgba(148, 163, 184, .55);
      border-radius: 12px;
      box-shadow: var(--shadow);
      padding: clamp(24px, 7vw, 64px);
      position: relative;
    }

    .sheet::before {
      content: "";
      position: absolute;
      inset: 0 auto 0 0;
      width: 5px;
      border-radius: 12px 0 0 12px;
      background: linear-gradient(var(--accent), transparent 72%);
      opacity: .75;
    }

    .chapter-kicker {
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--accent);
      font-size: 12px;
      letter-spacing: .12em;
      text-transform: uppercase;
      margin-bottom: 20px;
    }

    h1, h2, h3 {
      line-height: 1.3;
      letter-spacing: 0;
      margin: 0 0 .9em;
    }

    h1 {
      font-size: clamp(28px, 8vw, 48px);
      font-weight: 700;
    }

    h2 {
      font-size: clamp(22px, 5.6vw, 32px);
      margin-top: 1.7em;
      padding-top: .4em;
      border-top: 1px solid var(--line);
    }

    h3 {
      font-size: clamp(18px, 4.5vw, 24px);
      color: #253044;
      margin-top: 1.5em;
    }

    p, li {
      font-size: var(--font-size);
      line-height: 1.95;
      letter-spacing: 0;
    }

    p {
      margin: 0 0 1.1em;
    }

    ul, ol {
      padding-left: 1.3em;
      margin: 0 0 1.2em;
    }

    code {
      font-family: "SFMono-Regular", ui-monospace, Menlo, Consolas, monospace;
      font-size: .86em;
      color: #7f1d1d;
      background: #f1f5f9;
      border: 1px solid #dbe3ee;
      border-radius: 5px;
      padding: .08em .32em;
      word-break: break-word;
    }

    blockquote {
      margin: 1.4em 0;
      padding: .2em 0 .2em 1.1em;
      border-left: 3px solid var(--accent);
      color: #334155;
    }

    .fineprint {
      color: var(--muted);
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 12px;
      line-height: 1.5;
    }

    .range {
      accent-color: var(--accent);
      min-width: 88px;
    }

    @media (max-width: 640px) {
      .reader { padding-left: 8px; padding-right: 8px; }
      .topbar { grid-template-columns: 1fr auto; }
      .topbar select { grid-column: 1 / -1; }
      .brand span { display: none; }
      .sheet { padding: 24px 20px 30px 24px; }
      .bottombar { grid-template-columns: auto 1fr auto; }
      .range { display: none; }
    }
  </style>
</head>
<body>
  <main class="reader">
    <header class="topbar">
      <div class="brand">
        <strong>Before Zero</strong>
        <span>draft reader / swipe sideways</span>
      </div>
      <select id="chapterSelect" aria-label="章へ移動"></select>
      <button class="icon-button" id="tocButton" title="現在の章へ戻る" aria-label="現在の章へ戻る">⌖</button>
    </header>

    <section class="deck" id="deck" aria-label="横スライド読書ビュー"></section>

    <footer class="bottombar">
      <button class="icon-button" id="prevButton" title="前のページ" aria-label="前のページ">‹</button>
      <div class="progress" id="progress">Loading…</div>
      <input class="range" id="fontRange" type="range" min="16" max="23" value="18" aria-label="文字サイズ" />
      <button class="icon-button" id="nextButton" title="次のページ" aria-label="次のページ">›</button>
    </footer>
  </main>

  <script id="chapters-data" type="application/json">${payload}</script>
  <script>
    const chapters = JSON.parse(document.getElementById("chapters-data").textContent);
    const deck = document.getElementById("deck");
    const chapterSelect = document.getElementById("chapterSelect");
    const progress = document.getElementById("progress");
    const prevButton = document.getElementById("prevButton");
    const nextButton = document.getElementById("nextButton");
    const tocButton = document.getElementById("tocButton");
    const fontRange = document.getElementById("fontRange");
    const storageKey = "before-zero-reader-page";
    const fontKey = "before-zero-reader-font-size";
    const pageMap = [];
    let currentPage = Number(localStorage.getItem(storageKey) || 0);

    function escapeHtml(value) {
      return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    }

    function inlineMarkdown(value) {
      return escapeHtml(value)
        .replace(/\\*\\*(.+?)\\*\\*/g, "<strong>$1</strong>")
        .replace(new RegExp(String.fromCharCode(96) + "([^" + String.fromCharCode(96) + "]+)" + String.fromCharCode(96), "g"), "<code>$1</code>");
    }

    function renderBlocks(markdown) {
      const lines = markdown.split(/\\r?\\n/);
      const html = [];
      let paragraph = [];
      let list = [];

      function flushParagraph() {
        if (!paragraph.length) return;
        html.push("<p>" + inlineMarkdown(paragraph.join(" ")) + "</p>");
        paragraph = [];
      }

      function flushList() {
        if (!list.length) return;
        html.push("<ul>" + list.map((item) => "<li>" + inlineMarkdown(item) + "</li>").join("") + "</ul>");
        list = [];
      }

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
          flushParagraph();
          flushList();
          continue;
        }
        const heading = line.match(/^(#{1,3})\\s+(.+)$/);
        if (heading) {
          flushParagraph();
          flushList();
          const level = heading[1].length;
          html.push("<h" + level + ">" + inlineMarkdown(heading[2]) + "</h" + level + ">");
          continue;
        }
        const bullet = line.match(/^-\\s+(.+)$/);
        if (bullet) {
          flushParagraph();
          list.push(bullet[1]);
          continue;
        }
        if (line.startsWith(">")) {
          flushParagraph();
          flushList();
          html.push("<blockquote><p>" + inlineMarkdown(line.replace(/^>\\s?/, "")) + "</p></blockquote>");
          continue;
        }
        flushList();
        paragraph.push(line);
      }

      flushParagraph();
      flushList();
      return html.join("\\n");
    }

    function splitChapter(chapter, chapterIndex) {
      const blocks = chapter.markdown.split(/\\n(?=##\\s+|#\\s+)/g);
      const pages = [];
      let bucket = "";
      const maxChars = chapterIndex >= 26 ? 1500 : 1250;

      for (const block of blocks) {
        if (!bucket) {
          bucket = block;
          continue;
        }
        if ((bucket + "\\n\\n" + block).length > maxChars) {
          pages.push(bucket);
          bucket = block;
        } else {
          bucket += "\\n\\n" + block;
        }
      }
      if (bucket) pages.push(bucket);
      return pages.length ? pages : [chapter.markdown];
    }

    function render() {
      const savedFont = localStorage.getItem(fontKey);
      if (savedFont) {
        document.documentElement.style.setProperty("--font-size", savedFont + "px");
        fontRange.value = savedFont;
      }

      chapters.forEach((chapter, chapterIndex) => {
        const option = document.createElement("option");
        option.value = String(chapterIndex);
        option.textContent = chapter.title;
        chapterSelect.appendChild(option);

        const pages = splitChapter(chapter, chapterIndex);
        pages.forEach((pageMarkdown, localPageIndex) => {
          pageMap.push({ chapterIndex, localPageIndex, title: chapter.title });
          const page = document.createElement("article");
          page.className = "page";
          page.innerHTML =
            '<div class="sheet">' +
            '<div class="chapter-kicker">' +
            escapeHtml(String(chapterIndex).padStart(2, "0")) +
            " / " +
            escapeHtml(chapter.file.replace(/\\.md$/, "")) +
            "</div>" +
            renderBlocks(pageMarkdown) +
            '<p class="fineprint">Swipe sideways. Page ' +
            (pageMap.length) +
            "</p>" +
            "</div>";
          deck.appendChild(page);
        });
      });

      currentPage = Math.min(Math.max(currentPage, 0), pageMap.length - 1);
      updateProgress();
      requestAnimationFrame(() => goToPage(currentPage, false));
    }

    function goToPage(index, smooth = true) {
      currentPage = Math.min(Math.max(index, 0), pageMap.length - 1);
      const pageWidth = deck.clientWidth;
      deck.scrollTo({ left: currentPage * pageWidth, behavior: smooth ? "smooth" : "auto" });
      updateProgress();
    }

    function updateProgress() {
      const page = pageMap[currentPage];
      if (!page) return;
      chapterSelect.value = String(page.chapterIndex);
      progress.textContent = (currentPage + 1) + " / " + pageMap.length + " · " + page.title;
      localStorage.setItem(storageKey, String(currentPage));
    }

    function currentPageFromScroll() {
      return Math.round(deck.scrollLeft / Math.max(deck.clientWidth, 1));
    }

    deck.addEventListener("scroll", () => {
      window.clearTimeout(deck._scrollTimer);
      deck._scrollTimer = window.setTimeout(() => {
        currentPage = currentPageFromScroll();
        updateProgress();
      }, 80);
    });

    prevButton.addEventListener("click", () => goToPage(currentPage - 1));
    nextButton.addEventListener("click", () => goToPage(currentPage + 1));
    tocButton.addEventListener("click", () => {
      const chapter = pageMap[currentPage]?.chapterIndex ?? 0;
      const firstPage = pageMap.findIndex((page) => page.chapterIndex === chapter);
      if (firstPage >= 0) goToPage(firstPage);
    });
    chapterSelect.addEventListener("change", () => {
      const chapterIndex = Number(chapterSelect.value);
      const firstPage = pageMap.findIndex((page) => page.chapterIndex === chapterIndex);
      if (firstPage >= 0) goToPage(firstPage);
    });
    fontRange.addEventListener("input", () => {
      document.documentElement.style.setProperty("--font-size", fontRange.value + "px");
      localStorage.setItem(fontKey, fontRange.value);
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") goToPage(currentPage - 1);
      if (event.key === "ArrowRight" || event.key === " ") goToPage(currentPage + 1);
    });

    window.addEventListener("resize", () => goToPage(currentPage, false));

    render();
  </script>
</body>
</html>
`;

fs.mkdirSync(__dirname, { recursive: true });
fs.writeFileSync(outputPath, html);

console.log(outputPath);

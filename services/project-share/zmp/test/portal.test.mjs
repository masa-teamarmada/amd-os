import { test } from "node:test";
import assert from "node:assert/strict";
import { renderPortalHtml } from "../server/routes/portal.mjs";

function extractModuleScript(html) {
  const match = /<script type="module">([\s\S]*?)<\/script>/.exec(html);
  assert.ok(match, "module script block should exist");
  return match[1];
}

test("brand logo images have explicit classes and no ambiguous selectors", () => {
  const html = renderPortalHtml();
  assert.match(html, /<img class="brand-symbol" src="\$\{LOGO_SYMBOL_DATA_URL\}"|<img class="brand-symbol"/);
  assert.match(html, /class="brand-symbol"/);
  assert.match(html, /class="brand-wordmark"/);
  assert.doesNotMatch(html, /\.brand img:first-child/);
  assert.doesNotMatch(html, /\.brand img:last-child/);
});

test("logo CSS sets desktop widths, mobile hides only wordmark, and uses official blue", () => {
  const html = renderPortalHtml();
  assert.match(html, /--blue:\s*#1A8FE6/);
  assert.match(html, /\.brand-wordmark\s*\{[^}]*width:\s*108px/);
  assert.match(html, /\.brand-symbol\s*\{[^}]*width:\s*22px/);
  const start = html.indexOf("@media (max-width: 720px)");
  const end = html.indexOf("</style>", start);
  assert.ok(start > -1 && end > start, "mobile media query block should exist");
  const mobileBlock = html.slice(start, end);
  assert.match(mobileBlock, /\.brand-wordmark\s*\{\s*display:\s*none;\s*\}/);
  assert.doesNotMatch(mobileBlock, /\.brand-symbol\s*\{\s*display:\s*none/);
});

test("no per-row open/view action labels remain; rows open via double-click instead", () => {
  const html = renderPortalHtml();
  assert.doesNotMatch(html, />開く</);
  assert.doesNotMatch(html, />表示</);
  assert.doesNotMatch(html, /data-testid="open-deck-link"/);
  assert.doesNotMatch(html, /<a href="\/documents\/agventure-lab"/);
});

test("activateRow opens ordinary files internally, external links safely, and navigates into folders", () => {
  const html = renderPortalHtml();
  const script = extractModuleScript(html);
  const activateMatch = /function activateRow\(tr\) \{[\s\S]*?\n    \}/.exec(script);
  assert.ok(activateMatch, "activateRow function should exist");
  const body = activateMatch[0];
  assert.match(body, /navigateTo\(tr\.getAttribute\("data-folder-path"\)\)/);
  assert.match(body, /const entry = getEntryFromRow\(tr\);/);
  assert.match(body, /if \(entry\.kind === "link"\)/);
  assert.match(body, /window\.open\(entry\.url, "_blank", "noopener,noreferrer"\)/);
  assert.match(body, /window\.open\("\/api\/view\?pathname=" \+ encodeURIComponent\(entry\.pathname\), "_blank", "noopener"\)/);
  assert.doesNotMatch(body, /about:blank/);
});

test("row double-click is delegated on the tbody, excludes the actions column, and calls activateRow", () => {
  const html = renderPortalHtml();
  const script = extractModuleScript(html);
  const dblMatch = /rowsEl\.addEventListener\("dblclick", \(event\) => \{[\s\S]*?\n    \}\);/.exec(script);
  assert.ok(dblMatch, "dblclick delegation on rowsEl should exist");
  const body = dblMatch[0];
  const guardIndex = body.indexOf('event.target.closest(".col-actions")');
  const activateIndex = body.indexOf("activateRow(tr)");
  assert.ok(guardIndex > -1, "must bail out when the double-click lands inside .col-actions");
  assert.ok(activateIndex > guardIndex, "the actions-column guard must run before activateRow is called");
});

test("row keydown delegation activates rows on Enter/Space only when the row itself (not a row-action control) has focus", () => {
  const html = renderPortalHtml();
  const script = extractModuleScript(html);
  const keyMatch = /rowsEl\.addEventListener\("keydown", \(event\) => \{[\s\S]*?\n    \}\);/.exec(script);
  assert.ok(keyMatch, "keydown delegation on rowsEl should exist");
  const body = keyMatch[0];
  assert.match(body, /event\.key !== "Enter" && event\.key !== " "/);
  assert.match(body, /event\.target\.closest\("\.row-actions"\)/);
  assert.match(body, /tr !== event\.target/);
  assert.match(body, /event\.preventDefault\(\);/);
  assert.match(body, /activateRow\(tr\);/);
});

test("no fragile filename regex literal remains; validation uses charCode loop", () => {
  const html = renderPortalHtml();
  assert.doesNotMatch(html, /FILENAME_INVALID_RE/);
  assert.doesNotMatch(html, /\\x00-\\x1f/);
  assert.doesNotMatch(html, /\/\[\\\\\/\\x00/);
  assert.match(html, /charCodeAt/);
  assert.match(html, /isValidEntryName/);
});

test("no top-level static import of blob-client, only dynamic import inside uploadFiles", () => {
  const html = renderPortalHtml();
  const script = extractModuleScript(html);
  assert.doesNotMatch(script, /^\s*import\s+\{\s*upload\s*\}\s+from\s+"\/vendor\/blob-client\.mjs"/m);
  assert.doesNotMatch(script, /\nimport\s+\{\s*upload\s*\}\s+from\s+"\/vendor\/blob-client\.mjs"/);
  assert.match(script, /await import\("\/vendor\/blob-client\.mjs"\)/);

  const uploadFilesMatch = /async function uploadFiles\([\s\S]*?\n    \}/.exec(script);
  assert.ok(uploadFilesMatch, "uploadFiles function should be found");
  assert.match(uploadFilesMatch[0], /await import\("\/vendor\/blob-client\.mjs"\)/);
});

test("dynamic import of blob-client is wrapped in try/catch with cleanup on failure", () => {
  const html = renderPortalHtml();
  const script = extractModuleScript(html);
  const uploadFilesMatch = /async function uploadFiles\([\s\S]*?\n    \}/.exec(script);
  assert.ok(uploadFilesMatch, "uploadFiles function should be found");
  const body = uploadFilesMatch[0];

  const tryIndex = body.indexOf("try {");
  const importIndex = body.indexOf('await import("/vendor/blob-client.mjs")');
  const catchIndex = body.indexOf("} catch (err) {", tryIndex);
  assert.ok(tryIndex > -1 && importIndex > tryIndex, "dynamic import must be inside a try block");
  assert.ok(catchIndex > importIndex, "a catch block must follow the dynamic import");

  const catchBlockEnd = body.indexOf("\n      }", catchIndex);
  const catchBody = body.slice(catchIndex, catchBlockEnd > -1 ? catchBlockEnd : undefined);
  assert.match(catchBody, /setStatus\(.*"error"\)/, "failure must set a clear error status");
  assert.match(catchBody, /fileInput\.value = ""/, "failure must reset the file input");
  assert.match(catchBody, /progressRow\.hidden = true/, "failure must reset progress state");
  assert.match(catchBody, /uploadBtn\.disabled = false/, "failure must reset the upload button state");
  assert.match(catchBody, /return;/, "failure must return without throwing further");
});

test("folder UI: breadcrumb bar, up button, toolbar controls, and create-folder dialog present", () => {
  const html = renderPortalHtml();
  assert.match(html, /id="location-bar"/);
  assert.match(html, /id="breadcrumbs"/);
  assert.match(html, /id="up-btn"[^>]*hidden/);
  assert.match(html, /id="search"/);
  assert.match(html, /class="create-folder-btn"[^>]*aria-label="フォルダを作成"/);
  assert.match(html, /class="folder-plus-icon"/);
  assert.match(html, /<path d="M15\.5 11\.5v6M12\.5 14\.5h6" \/>/);
  assert.match(html, /class="upload-btn"[^>]*>ファイルをアップロード/);
  assert.match(html, /<input type="file" id="file-input" multiple \/>/);
  assert.match(html, /class="add-link-btn"[^>]*aria-label="オンライン資料を追加"/);
  assert.match(html, /id="online-link-dialog"/);
  assert.match(html, /id="online-link-url-input"[^>]*type="url"|type="url" id="online-link-url-input"/);
  assert.match(html, /id="online-link-name-input"/);
  assert.match(html, /addLinkBtn\.addEventListener\("click", openOnlineLinkDialog\)/);
  assert.match(html, /fetch\("\/api\/links", \{\s*\n\s*method: "POST"/);

  assert.match(html, /<dialog id="folder-dialog">/);
  assert.match(html, /<label for="folder-name-input">フォルダ名<\/label>/);
  assert.match(html, /<input type="text" id="folder-name-input"[^>]*required/);
  assert.match(html, /id="folder-dialog-cancel"/);
  assert.match(html, /folderDialog\.showModal\(\)/);
  assert.match(html, /folderNameInput\.focus\(\)/);
  assert.match(html, /folderForm\.reset\(\)/);
  assert.match(html, /folderDialog\.close\(\)/);
  assert.match(html, /<dialog id="rename-dialog">/);
  assert.match(html, /<label for="rename-name-input">新しいファイル名<\/label>/);
  assert.match(html, /id="rename-dialog-cancel"/);
  assert.match(html, /id="rename-dialog-submit"/);
  assert.match(html, /renameDialog\.showModal\(\)/);
  assert.match(html, /renameNameInput\.select\(\)/);
});

test("folder rows render before files with icon, type, and only a delete control (no open button)", () => {
  const html = renderPortalHtml();
  assert.match(html, /class="folder-icon"/);
  assert.match(html, /typeTd\.textContent = "フォルダ"/);
  assert.match(html, /data-testid", "folder-row"/);
  const forFolderIndex = html.indexOf("for (const folder of folderList)");
  const forFileIndex = html.indexOf("for (const file of fileList)");
  assert.ok(forFolderIndex > -1 && forFileIndex > -1 && forFolderIndex < forFileIndex);

  const script = extractModuleScript(html);
  const folderLoopMatch = /for \(const folder of folderList\) \{[\s\S]*?\n      \}/.exec(script);
  assert.ok(folderLoopMatch, "folder row loop should exist");
  const body = folderLoopMatch[0];
  assert.doesNotMatch(body, /openBtn/);
  assert.match(body, /deleteBtn\.textContent = "削除";/);
});

test("folder rows carry data-row-type, data-folder-path, and tabindex for keyboard access", () => {
  const html = renderPortalHtml();
  const script = extractModuleScript(html);
  assert.match(script, /tr\.setAttribute\("data-row-type", "folder"\);/);
  assert.match(script, /tr\.setAttribute\("data-folder-path", folder\.path\);/);
  const folderLoopMatch = /for \(const folder of folderList\) \{[\s\S]*?\n      \}/.exec(script);
  assert.ok(folderLoopMatch, "folder row loop should exist");
  assert.match(folderLoopMatch[0], /tr\.tabIndex = 0;/);
});

test("file rows carry type-specific identifiers, use a link icon for online entries, and have no dedicated view button", () => {
  const html = renderPortalHtml();
  const script = extractModuleScript(html);
  const fileLoopMatch = /for \(const file of fileList\) \{[\s\S]*?\n      \}/.exec(script);
  assert.ok(fileLoopMatch, "file row loop should exist");
  const body = fileLoopMatch[0];
  assert.match(body, /tr\.setAttribute\("data-row-type", "file"\);/);
  assert.match(body, /tr\.setAttribute\("data-entry-kind", isOnlineLink \? "link" : "file"\);/);
  assert.match(body, /tr\.setAttribute\("data-link-id", file\.id\);/);
  assert.match(body, /tr\.setAttribute\("data-file-pathname", file\.pathname\);/);
  assert.match(body, /onlineLinkIconSvg\(\)/);
  assert.match(body, /typeTd\.textContent = entryFormat\(file\);/);
  assert.match(body, /tr\.tabIndex = 0;/);
  assert.doesNotMatch(body, /viewBtn/);
  assert.match(body, /downloadBtn\.textContent = isHtmlFileName\(file\.name\) \? "PDF化ダウンロード" : "ダウンロード";/);
  assert.match(body, /renameBtn\.textContent = "名前変更";/);
  assert.match(body, /deleteBtn\.textContent = "削除";/);
});

test("API integration strings: folders and online links use their respective authenticated endpoints", () => {
  const html = renderPortalHtml();
  assert.match(html, /"\/api\/files\?folder=" \+ encodeURIComponent\(currentFolder\)/);
  assert.match(html, /fetch\("\/api\/folders", \{\s*method: "POST"/);
  assert.match(html, /JSON\.stringify\(\{ parentPath: currentFolder, name \}\)/);
  assert.match(html, /fetch\("\/api\/folders", \{\s*method: "DELETE"/);
  assert.match(html, /JSON\.stringify\(\{ folderPath \}\)/);
  assert.match(html, /res\.status === 409/);
  assert.match(html, /フォルダが空ではありません/);
  assert.match(html, /fetch\(isOnlineLink \? "\/api\/links" : "\/api\/files"/);
  assert.match(html, /JSON\.stringify\(isOnlineLink \? \{ id: renameTarget\.id, newName \} : \{ pathname: renameTarget\.pathname, newName \}\)/);
  assert.match(html, /JSON\.stringify\(\{ url, name, folder: currentFolder \}\)/);
  assert.match(html, /http または https のURLを入力してください。/);
});

test("upload pathname includes currentFolder segment when nested", () => {
  const html = renderPortalHtml();
  assert.match(html, /const prefix = currentFolder \? "zmp\/files\/" \+ currentFolder \+ "\/" : "zmp\/files\/";/);
  assert.match(html, /await upload\(prefix \+ file\.name, file,/);
});

test("folder URLs restore a validated folder, track navigation, and support browser back/forward", () => {
  const html = renderPortalHtml();
  const script = extractModuleScript(html);
  assert.match(script, /function folderFromLocation\(\) \{/);
  assert.match(script, /new URLSearchParams\(window\.location\.search\)\.get\("folder"\)/);
  assert.match(script, /rawFolder\.split\("\/"\)/);
  assert.match(script, /segments\.every\(isValidEntryName\) \? rawFolder : ""/);
  assert.match(script, /let currentFolder = folderFromLocation\(\);/);
  assert.match(script, /function syncFolderUrl\(\) \{/);
  assert.match(script, /url\.searchParams\.set\("folder", currentFolder\)/);
  assert.match(script, /url\.searchParams\.delete\("folder"\)/);
  assert.match(script, /window\.history\.pushState\(\{ folder: currentFolder \}, "", url\.pathname \+ url\.search \+ url\.hash\);/);
  assert.match(script, /function navigateTo\(folderPath, \{ updateHistory = true \} = \{\}\) \{/);
  assert.match(script, /if \(updateHistory\) syncFolderUrl\(\);/);
  assert.match(script, /window\.addEventListener\("popstate", \(\) => \{\s*\n\s*navigateTo\(folderFromLocation\(\), \{ updateHistory: false \}\);/);
});

test("no innerHTML use with interpolated user data (only static SVG strings)", () => {
  const html = renderPortalHtml();
  const script = extractModuleScript(html);
  const innerHtmlUses = [...script.matchAll(/\.innerHTML\s*=\s*([^;]+);/g)].map((m) => m[1]);
  for (const usage of innerHtmlUses) {
    assert.doesNotMatch(usage, /\$\{/);
    assert.ok(
      usage.trim() === '""' || /folderIconSvg\(\)/.test(usage) || /dragGripSvg\(\)/.test(usage) || /onlineLinkIconSvg\(\)/.test(usage),
      "innerHTML should only be set to empty string or a static icon svg, got: " + usage
    );
  }
});

test("existing controls preserved: sort headers, logout, progress, mobile sort", () => {
  const html = renderPortalHtml();
  assert.match(html, /id="logout-btn"/);
  assert.match(html, /id="mobile-sort"/);
  assert.match(html, /id="progress-row"/);
  assert.match(html, /data-sort="name"/);
  assert.match(html, /data-sort="uploadedAt"/);
});

test("progress row has a hidden-attribute CSS rule so it stays hidden at rest", () => {
  const html = renderPortalHtml();
  assert.match(html, /\.progress-row\[hidden\]\s*\{\s*display:\s*none;\s*\}/);
  assert.match(html, /<div class="progress-row" id="progress-row" hidden>/);
});

test("name cells stay table-cells and wrap flex layout in an inner .name-content span", () => {
  const html = renderPortalHtml();
  const styleStart = html.indexOf("<style>");
  const styleEnd = html.indexOf("</style>");
  const styleBlock = html.slice(styleStart, styleEnd);
  assert.doesNotMatch(styleBlock, /\.name-cell\s*\{[^}]*display:\s*flex/);
  assert.match(styleBlock, /\.name-content\s*\{[^}]*display:\s*flex/);

  const script = extractModuleScript(html);
  assert.doesNotMatch(script, /nameTd\.className\s*=\s*"name-cell";\s*\n\s*nameTd\.textContent/);
  assert.match(script, /nameContent\.className\s*=\s*"name-content"/);

  assert.doesNotMatch(html, /AgVenture Lab|PSI Step 2|documents\/agventure-lab/);
});

test("module script parses as valid JavaScript", () => {
  const html = renderPortalHtml();
  const script = extractModuleScript(html)
    .replace(/\(\{ upload \} = await import\("\/vendor\/blob-client\.mjs"\)\);/, "(upload = async () => {});");
  assert.doesNotThrow(() => {
    // eslint-disable-next-line no-new-func
    new Function(script);
  });
});

test("search input placeholder mentions both files and folders", () => {
  const html = renderPortalHtml();
  assert.match(html, /placeholder="ファイル・フォルダ名で検索"/);
});

test(".row-actions a is styled as an action control matching button parity", () => {
  const html = renderPortalHtml();
  const start = html.indexOf(".row-actions a {");
  assert.ok(start > -1, ".row-actions a rule should exist");
  const end = html.indexOf("}", start);
  const rule = html.slice(start, end);
  assert.match(rule, /display:\s*inline-flex/);
  assert.match(rule, /align-items:\s*center/);
  assert.match(rule, /justify-content:\s*center/);
  assert.match(rule, /border:\s*1px solid var\(--line\)/);
  assert.match(rule, /min-height:\s*44px/);
  assert.match(rule, /text-decoration:\s*none/);
  assert.match(html, /\.row-actions a:hover,\s*\n\s*\.row-actions a:focus-visible \{/);
  assert.match(html, /\.row-actions a:focus-visible,/);
});

test("rows carry a subtle pointer cursor while the actions column stays default, colors/layout otherwise unchanged", () => {
  const html = renderPortalHtml();
  const styleStart = html.indexOf("<style>");
  const styleEnd = html.indexOf("</style>");
  const styleBlock = html.slice(styleStart, styleEnd);
  assert.match(styleBlock, /tbody tr\[data-row-type\] \{ cursor: pointer; \}/);
  assert.match(styleBlock, /tbody tr\[data-row-type\] \.col-actions \{ cursor: default; \}/);
  assert.match(styleBlock, /tbody tr:hover td \{ background: #FAFCFE; \}/);
  assert.match(styleBlock, /--blue:\s*#1A8FE6/);
});

test("focusable rows get the same focus-visible outline treatment as other interactive controls", () => {
  const html = renderPortalHtml();
  assert.match(
    html,
    /dialog button:focus-visible,\s*\n\s*tbody tr\[data-row-type\]:focus-visible \{ outline: 2px solid var\(--blue\); outline-offset: -2px; \}/
  );
});

test("drop overlay: markup wraps the table, is decorative, and hidden until drag-over", () => {
  const html = renderPortalHtml();
  const areaStart = html.indexOf('<div class="file-list-area" id="file-list-area">');
  assert.ok(areaStart > -1, "file-list-area wrapper should exist");
  const tableIndex = html.indexOf("<table", areaStart);
  const overlayIndex = html.indexOf('id="drop-overlay"', areaStart);
  assert.ok(tableIndex > areaStart && overlayIndex > tableIndex, "table and drop-overlay should both live inside file-list-area, overlay after table");
  assert.match(html, /<div class="drop-overlay" id="drop-overlay" aria-hidden="true"/);

  const styleStart = html.indexOf("<style>");
  const styleEnd = html.indexOf("</style>");
  const styleBlock = html.slice(styleStart, styleEnd);
  assert.match(styleBlock, /\.file-list-area\s*\{[^}]*position:\s*relative/);
  assert.match(styleBlock, /\.drop-overlay\s*\{[^}]*display:\s*none/);
  assert.match(styleBlock, /\.file-list-area\.drag-over \.drop-overlay\s*\{\s*display:\s*flex;\s*\}/);
  assert.match(styleBlock, /\.drop-overlay\s*\{[^}]*border:\s*2px dashed var\(--blue\)/);
  assert.match(styleBlock, /\.drop-overlay\s*\{[^}]*pointer-events:\s*none/);
});

test("drag-and-drop: page-wide listeners guard on Files type, ignore text/link drags", () => {
  const html = renderPortalHtml();
  const script = extractModuleScript(html);
  assert.match(script, /function isFileDrag\(dataTransfer\)/);
  assert.match(script, /Array\.from\(dataTransfer\.types \|\| \[\]\)\.includes\("Files"\)/);

  assert.match(script, /document\.addEventListener\("dragenter", \(event\) => \{\s*\n\s*if \(!isFileDrag\(event\.dataTransfer\)\) return;/);
  assert.match(script, /document\.addEventListener\("dragover", \(event\) => \{\s*\n\s*if \(!isFileDrag\(event\.dataTransfer\)\) return;/);
  assert.match(script, /document\.addEventListener\("drop", \(event\) => \{\s*\n\s*if \(!isFileDrag\(event\.dataTransfer\)\) return;/);

  assert.match(script, /document\.addEventListener\("dragover", \(event\) => \{[\s\S]*?event\.preventDefault\(\);[\s\S]*?event\.dataTransfer\.dropEffect = "copy";/);
  assert.match(script, /document\.addEventListener\("drop", \(event\) => \{[\s\S]*?event\.preventDefault\(\);/);
});

test("drag-and-drop: dragenter/dragleave use a counter so nested enter/leave does not flicker the overlay", () => {
  const html = renderPortalHtml();
  const script = extractModuleScript(html);
  assert.match(script, /let dragDepth = 0;/);
  assert.match(script, /dragDepth \+= 1;/);
  assert.match(script, /document\.addEventListener\("dragleave", \(\) => \{\s*\n\s*if \(dragDepth === 0\) return;\s*\n\s*dragDepth -= 1;\s*\n\s*if \(dragDepth === 0\) fileListArea\.classList\.remove\("drag-over"\);/);
});

test("drag-and-drop: dropped files are routed through the existing uploadFiles pipeline, not a duplicate implementation", () => {
  const html = renderPortalHtml();
  const script = extractModuleScript(html);
  const dropMatch = /document\.addEventListener\("drop", \(event\) => \{[\s\S]*?\n    \}\);/.exec(script);
  assert.ok(dropMatch, "drop listener should be found");
  const body = dropMatch[0];
  assert.match(body, /const droppedFiles = event\.dataTransfer\.files;/);
  assert.match(body, /uploadFiles\(droppedFiles\)/);
  assert.doesNotMatch(body, /new FormData/);
  assert.doesNotMatch(body, /fetch\(/);
});

test("internal move drag: the whole file row is a pointer-event drag source", () => {
  const html = renderPortalHtml();
  const script = extractModuleScript(html);
  // Native HTML5 draggable dragging was replaced by pointer-event handling, since the
  // deployed native draggable handle produced no event/PATCH under a real press-move-release.
  assert.doesNotMatch(script, /INTERNAL_MOVE_MIME/);
  assert.doesNotMatch(script, /draggable\s*=\s*true/);

  const fileLoopMatch = /for \(const file of fileList\) \{[\s\S]*?\n      \}/.exec(script);
  assert.ok(fileLoopMatch, "file row loop should exist");
  const body = fileLoopMatch[0];
  assert.doesNotMatch(body, /tr\.draggable = true;/);
  assert.match(body, /nameContent\.className = "name-content drag-handle";/);
  assert.match(body, /nameContent\.setAttribute\("data-drag-handle", "true"\);/);

  const styleStart = html.indexOf("<style>");
  const styleEnd = html.indexOf("</style>");
  const styleBlock = html.slice(styleStart, styleEnd);
  assert.match(styleBlock, /tbody tr\[data-row-type="file"\]\s*\{[^}]*cursor:\s*grab/);
  assert.match(styleBlock, /tbody tr\.dragging-row\s*\{[^}]*cursor:\s*grabbing/);
});

test("internal move drag: rows carry a visible (hover/focus-revealed) grip hint, not a dedicated button", () => {
  const html = renderPortalHtml();
  const script = extractModuleScript(html);
  assert.match(script, /function dragGripSvg\(\)/);
  const fileLoopMatch = /for \(const file of fileList\) \{[\s\S]*?\n      \}/.exec(script);
  assert.ok(fileLoopMatch, "file row loop should exist");
  assert.match(fileLoopMatch[0], /nameContent\.innerHTML = dragGripSvg\(\) \+ \(isOnlineLink \? onlineLinkIconSvg\(\) : ""\);/);
  assert.doesNotMatch(fileLoopMatch[0], /createElement\("button"\)[\s\S]*?[Dd]rag/);

  const styleStart = html.indexOf("<style>");
  const styleEnd = html.indexOf("</style>");
  const styleBlock = html.slice(styleStart, styleEnd);
  assert.match(styleBlock, /\.drag-grip\s*\{[^}]*opacity:\s*0;/);
  assert.match(styleBlock, /tbody tr\[data-row-type="file"\]:hover \.drag-grip,/);
});

test("internal move drag: pointerdown anywhere on a file row arms the drag without starting it yet", () => {
  const html = renderPortalHtml();
  const script = extractModuleScript(html);
  const pointerdownMatch = /rowsEl\.addEventListener\("pointerdown", \(event\) => \{[\s\S]*?\n    \}\);/.exec(script);
  assert.ok(pointerdownMatch, "pointerdown delegation on rowsEl should exist");
  const body = pointerdownMatch[0];
  // Action buttons remain clickable; every other part of a file row can start a drag.
  assert.match(body, /event\.target\.closest\("\.col-actions"\)/);
  assert.match(body, /const tr = event\.target\.closest\('tr\[data-row-type="file"\]'\);/);
  assert.doesNotMatch(body, /data-drag-handle/);
  assert.match(body, /if \(!event\.isPrimary\) return;/);
  assert.match(body, /if \(event\.pointerType === "mouse" && event\.button !== 0\) return;/);
  assert.match(body, /const entry = getEntryFromRow\(tr\);/);
  assert.match(body, /if \(!entry\) return;/);
  assert.match(body, /const rowRect = tr\.getBoundingClientRect\(\);/);
  assert.match(body, /entry,/);
  assert.match(body, /grabOffsetX:\s*event\.clientX - rowRect\.left,/);
  assert.match(body, /grabOffsetY:\s*event\.clientY - rowRect\.top,/);
  assert.match(body, /dragging:\s*false,/);
  // pointerdown only records state; the dimmed .dragging-row class must not appear here,
  // it only applies once pointermove crosses the movement threshold.
  assert.doesNotMatch(body, /dragging-row/);
});

test("internal move drag: pointermove past a small threshold marks dragging and highlights the folder under the pointer via elementFromPoint", () => {
  const html = renderPortalHtml();
  const script = extractModuleScript(html);
  assert.match(script, /const DRAG_THRESHOLD_PX = 6;/);
  const pointermoveMatch = /window\.addEventListener\("pointermove", \(event\) => \{[\s\S]*?\n    \}\);/.exec(script);
  assert.ok(pointermoveMatch, "pointermove listener on window should exist");
  const body = pointermoveMatch[0];
  assert.match(body, /if \(!pointerDrag \|\| event\.pointerId !== pointerDrag\.pointerId\) return;/);
  assert.match(body, /Math\.abs\(dx\) < DRAG_THRESHOLD_PX && Math\.abs\(dy\) < DRAG_THRESHOLD_PX/);
  assert.match(body, /pointerDrag\.dragging = true;/);
  assert.match(body, /pointerDrag\.tr\.classList\.add\("dragging-row"\);/);
  assert.match(body, /pointerDrag\.preview = createDragPreview\(pointerDrag\.tr\);/);
  assert.match(body, /positionDragPreview\(event\);/);
  assert.match(body, /event\.preventDefault\(\);/);
  assert.match(body, /document\.elementFromPoint\(event\.clientX, event\.clientY\)/);
  assert.match(body, /el\.closest\('tr\[data-row-type="folder"\]'\)/);
  assert.match(body, /tr\.classList\.add\("drop-target"\)/);
});

test("internal move drag: pointerup invokes moveFileTo exactly once when released over a folder, then fully clears drag state", () => {
  const html = renderPortalHtml();
  const script = extractModuleScript(html);
  const pointerupMatch = /window\.addEventListener\("pointerup", \(event\) => \{[\s\S]*?\n    \}\);/.exec(script);
  assert.ok(pointerupMatch, "pointerup listener on window should exist");
  const body = pointerupMatch[0];
  assert.match(body, /if \(!pointerDrag \|\| event\.pointerId !== pointerDrag\.pointerId\) return;/);
  const wasDraggingIndex = body.indexOf("wasDragging");
  const endDragIndex = body.indexOf("endPointerDrag();");
  const moveFileToIndex = body.indexOf("moveFileTo(entry, targetTr.getAttribute(\"data-folder-path\"));");
  assert.ok(wasDraggingIndex > -1 && endDragIndex > -1 && moveFileToIndex > -1);
  // State must be captured and cleared before moveFileTo runs, so a slow request never
  // leaves the row dimmed or the drop target highlighted.
  assert.ok(endDragIndex < moveFileToIndex, "drag state must be cleared before moveFileTo is invoked");
  assert.match(body, /if \(wasDragging && targetTr\) \{/);

  const endPointerDragMatch = /function endPointerDrag\(\) \{[\s\S]*?\n    \}/.exec(script);
  assert.ok(endPointerDragMatch, "endPointerDrag helper should exist");
  assert.match(endPointerDragMatch[0], /pointerDrag\.tr\.classList\.remove\("dragging-row"\);/);
  assert.match(endPointerDragMatch[0], /pointerDrag\.preview\.remove\(\);/);
  assert.match(endPointerDragMatch[0], /pointerDrag = null;/);
  assert.match(endPointerDragMatch[0], /clearDropTarget\(\);/);

  const styleStart = html.indexOf("<style>");
  const styleEnd = html.indexOf("</style>");
  const styleBlock = html.slice(styleStart, styleEnd);
  assert.match(styleBlock, /tbody tr\.dragging-row\s*\{[^}]*opacity:\s*0\.5;[^}]*cursor:\s*grabbing/);
});

test("internal move drag: a click that never crosses the threshold does not trigger a move (no accidental drops on plain clicks)", () => {
  const html = renderPortalHtml();
  const script = extractModuleScript(html);
  const pointerupMatch = /window\.addEventListener\("pointerup", \(event\) => \{[\s\S]*?\n    \}\);/.exec(script);
  assert.ok(pointerupMatch, "pointerup listener on window should exist");
  assert.match(pointerupMatch[0], /const wasDragging = pointerDrag\.dragging;/);
  assert.match(pointerupMatch[0], /if \(wasDragging && targetTr\) \{/);
});

test("internal move drag: pointercancel and window blur clear drag state without invoking moveFileTo", () => {
  const html = renderPortalHtml();
  const script = extractModuleScript(html);

  const pointercancelMatch = /window\.addEventListener\("pointercancel", \(event\) => \{[\s\S]*?\n    \}\);/.exec(script);
  assert.ok(pointercancelMatch, "pointercancel listener on window should exist");
  assert.match(pointercancelMatch[0], /if \(!pointerDrag \|\| event\.pointerId !== pointerDrag\.pointerId\) return;/);
  assert.match(pointercancelMatch[0], /endPointerDrag\(\);/);
  assert.doesNotMatch(pointercancelMatch[0], /moveFileTo/);

  const blurMatch = /window\.addEventListener\("blur", \(\) => \{[\s\S]*?\n    \}\);/.exec(script);
  assert.ok(blurMatch, "blur listener on window should exist");
  assert.match(blurMatch[0], /endPointerDrag\(\);/);
  assert.doesNotMatch(blurMatch[0], /moveFileTo/);
});

test("internal move drag: only folder rows accept the drop, shown with official-blue tint and icon emphasis", () => {
  const html = renderPortalHtml();
  const script = extractModuleScript(html);

  const folderLoopMatch = /for \(const folder of folderList\) \{[\s\S]*?\n      \}/.exec(script);
  assert.ok(folderLoopMatch, "folder row loop should exist");
  assert.doesNotMatch(folderLoopMatch[0], /moveHint|ここへ移動/);

  const styleStart = html.indexOf("<style>");
  const styleEnd = html.indexOf("</style>");
  const styleBlock = html.slice(styleStart, styleEnd);
  assert.match(styleBlock, /tbody tr\.folder-row\.drop-target td \{ background: #E7F1FB; \}/);
  assert.match(styleBlock, /tbody tr\.folder-row\.drop-target \.folder-icon \{ color: var\(--blue\); transform: scale\(1\.12\); \}/);
});

test("internal move drag: a semi-transparent clone of the actual row follows the pointer", () => {
  const html = renderPortalHtml();
  const script = extractModuleScript(html);
  assert.match(script, /function createDragPreview\(sourceRow\)/);
  assert.match(script, /const sourceRect = sourceRow\.getBoundingClientRect\(\);/);
  assert.match(script, /document\.createElement\("table"\)/);
  assert.match(script, /preview\.className = "drag-preview";/);
  assert.match(script, /const previewRow = sourceRow\.cloneNode\(true\);/);
  assert.match(script, /previewRow\.classList\.remove\("dragging-row"\);/);
  assert.match(script, /sourceCell\.getBoundingClientRect\(\)\.width/);
  assert.match(script, /function positionDragPreview\(event\)/);
  assert.match(script, /event\.clientX - pointerDrag\.grabOffsetX/);
  assert.match(script, /event\.clientY - pointerDrag\.grabOffsetY/);
  assert.match(script, /style\.transform = "translate3d\("/);

  const styleStart = html.indexOf("<style>");
  const styleEnd = html.indexOf("</style>");
  const styleBlock = html.slice(styleStart, styleEnd);
  assert.match(styleBlock, /\.drag-preview\s*\{[^}]*position: fixed/);
  assert.match(styleBlock, /\.drag-preview\.is-visible \{ display: table; \}/);
  assert.match(styleBlock, /\.drag-preview\s*\{[^}]*background: var\(--white\);/);
  assert.match(styleBlock, /\.drag-preview\s*\{[^}]*opacity: 0\.82;/);
  assert.match(styleBlock, /\.drag-preview\s*\{[^}]*pointer-events: none/);
  assert.doesNotMatch(styleBlock, /background: rgba\(24, 36, 46, 0\.94\)/);
});

test("internal move drag (pointer events) and external OS-file drag (native HTML5 drag) stay on fully separate listener sets", () => {
  const html = renderPortalHtml();
  const script = extractModuleScript(html);
  assert.match(script, /function isFileDrag\(dataTransfer\)/);
  assert.match(script, /Array\.from\(dataTransfer\.types \|\| \[\]\)\.includes\("Files"\)/);

  // Internal move is pointer-based and delegated on rowsEl/window; the OS-file upload
  // handlers stay on document via native dragenter/dragover/drop and are untouched.
  assert.match(script, /rowsEl\.addEventListener\("pointerdown"/);
  assert.match(script, /window\.addEventListener\("pointermove"/);
  assert.match(script, /window\.addEventListener\("pointerup"/);
  assert.doesNotMatch(script, /rowsEl\.addEventListener\("dragover"/);
  assert.doesNotMatch(script, /rowsEl\.addEventListener\("drop"/);
  assert.match(script, /document\.addEventListener\("dragover", \(event\) => \{\s*\n\s*if \(!isFileDrag\(event\.dataTransfer\)\) return;/);
  assert.match(script, /document\.addEventListener\("drop", \(event\) => \{\s*\n\s*if \(!isFileDrag\(event\.dataTransfer\)\) return;/);
});

test("moveFileTo: sends the right endpoint for physical files or online links, guards re-entrancy, and reports a 409 conflict in Japanese", () => {
  const html = renderPortalHtml();
  const script = extractModuleScript(html);
  assert.match(script, /let moveInProgress = false;/);

  const moveFileToMatch = /async function moveFileTo\([\s\S]*?\n    \}/.exec(script);
  assert.ok(moveFileToMatch, "moveFileTo function should exist");
  const body = moveFileToMatch[0];

  const guardIndex = body.indexOf("if (moveInProgress) {");
  const setTrueIndex = body.indexOf("moveInProgress = true;");
  const fetchIndex = body.indexOf('fetch(isOnlineLink ? "/api/links" : "/api/files"');
  assert.ok(guardIndex > -1 && setTrueIndex > -1 && fetchIndex > -1);
  assert.ok(guardIndex < setTrueIndex && setTrueIndex < fetchIndex, "the re-entrancy guard must run before the flag is armed and before the request is sent");
  assert.match(body, /moveInProgress = false;/);
  assert.match(body, /const isOnlineLink = entry\.kind === "link";/);
  assert.match(body, /fetch\(isOnlineLink \? "\/api\/links" : "\/api\/files", \{\s*\n\s*method: "PATCH",/);
  assert.match(body, /JSON\.stringify\(isOnlineLink \? \{ id: entry\.id, targetFolder \} : \{ pathname: entry\.pathname, targetFolder \}\)/);
  assert.match(body, /res\.status === 409/);
  assert.match(body, /には同じ名前の項目がすでにあります。/);
  assert.match(body, /移動しました。/);
});

test("drag-and-drop: drop handler refuses a second drop while an upload is already in progress", () => {
  const html = renderPortalHtml();
  const script = extractModuleScript(html);
  const dropMatch = /document\.addEventListener\("drop", \(event\) => \{[\s\S]*?\n    \}\);/.exec(script);
  assert.ok(dropMatch, "drop listener should be found");
  const body = dropMatch[0];
  assert.match(body, /if \(uploadInProgress\) \{/);
  const guardIndex = body.indexOf("if (uploadInProgress)");
  const uploadCallIndex = body.indexOf("uploadFiles(droppedFiles)");
  assert.ok(guardIndex > -1 && guardIndex < uploadCallIndex, "uploadInProgress guard must run before uploadFiles is invoked");
});

test("uploadFiles itself guards against re-entrant/duplicate invocation via an uploadInProgress flag", () => {
  const html = renderPortalHtml();
  const script = extractModuleScript(html);
  assert.match(script, /let uploadInProgress = false;/);

  const uploadFilesMatch = /async function uploadFiles\([\s\S]*?\n    \}/.exec(script);
  assert.ok(uploadFilesMatch, "uploadFiles function should be found");
  const body = uploadFilesMatch[0];

  const guardIndex = body.indexOf("if (uploadInProgress) return;");
  assert.ok(guardIndex > -1, "uploadFiles must bail out early when a run is already in progress");
  const setTrueIndex = body.indexOf("uploadInProgress = true;");
  const lastSetFalseIndex = body.lastIndexOf("uploadInProgress = false;");
  assert.ok(guardIndex < setTrueIndex, "the guard check must precede the flag being set");
  assert.ok(setTrueIndex < lastSetFalseIndex, "the flag must be set true before work starts and reset false once the whole run (success path) completes");
  assert.match(body, /uploadInProgress = true;\s*\n\s*uploadBtn\.disabled = true;/);
});

test("uploadInProgress is armed before the dynamic import await, so a click or drop during SDK load is blocked", () => {
  const html = renderPortalHtml();
  const script = extractModuleScript(html);
  const uploadFilesMatch = /async function uploadFiles\([\s\S]*?\n    \}/.exec(script);
  assert.ok(uploadFilesMatch, "uploadFiles function should be found");
  const body = uploadFilesMatch[0];

  const invalidCheckIndex = body.indexOf("const invalid = list.some(");
  const setTrueIndex = body.indexOf("uploadInProgress = true;");
  const disabledTrueIndex = body.indexOf("uploadBtn.disabled = true;");
  const importIndex = body.indexOf('await import("/vendor/blob-client.mjs")');

  assert.ok(invalidCheckIndex > -1 && setTrueIndex > -1 && disabledTrueIndex > -1 && importIndex > -1);
  assert.ok(
    invalidCheckIndex < setTrueIndex && setTrueIndex < importIndex,
    "uploadInProgress must be set true after name validation but before the first await (dynamic import), not after it"
  );
  assert.ok(
    disabledTrueIndex < importIndex,
    "uploadBtn must be disabled before the first await too, so a button click during SDK load is also blocked"
  );
});

test("import-failure catch resets uploadInProgress alongside the existing cleanup, so a failed load does not lock out future uploads", () => {
  const html = renderPortalHtml();
  const script = extractModuleScript(html);
  const uploadFilesMatch = /async function uploadFiles\([\s\S]*?\n    \}/.exec(script);
  assert.ok(uploadFilesMatch, "uploadFiles function should be found");
  const body = uploadFilesMatch[0];

  const tryIndex = body.indexOf("try {");
  const catchIndex = body.indexOf("} catch (err) {", tryIndex);
  const catchBlockEnd = body.indexOf("\n      }", catchIndex);
  const catchBody = body.slice(catchIndex, catchBlockEnd > -1 ? catchBlockEnd : undefined);

  assert.match(catchBody, /setStatus\(.*"error"\)/, "failure must set a clear error status");
  assert.match(catchBody, /fileInput\.value = ""/, "failure must reset the file input");
  assert.match(catchBody, /progressRow\.hidden = true/, "failure must reset progress state");
  assert.match(catchBody, /uploadBtn\.disabled = false/, "failure must reset the upload button state");
  assert.match(catchBody, /uploadInProgress = false/, "failure must also release the uploadInProgress guard");
  assert.match(catchBody, /return;/, "failure must return without throwing further");
});

test("renderPortalHtml overall structure is well-formed", () => {
  const html = renderPortalHtml();
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<\/html>$/);
  assert.match(html, /<title>ZMP PROJECT SHARE<\/title>/);
});

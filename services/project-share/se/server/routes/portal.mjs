import { LOGO_SYMBOL_DATA_URL, LOGO_TYPE_DATA_URL } from "../brand-data.mjs";

export function renderPortalHtml() {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SE PROJECT SHARE</title>
<style>
  :root {
    color-scheme: light;
    --blue: #1A8FE6;
    --navy: #18242E;
    --white: #FFFFFF;
    --line: #E1E7EC;
    --muted: #63707A;
    --pale: #F4F8FB;
    --danger: #B3261E;
    --success: #1E7B45;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: "Yu Gothic", -apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif;
    background: var(--white);
    color: var(--navy);
    min-height: 100vh;
  }
  a { color: var(--blue); }
  header.top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 24px;
    border-bottom: 1px solid var(--line);
  }
  .brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .brand-symbol { width: 22px; height: 22px; object-fit: contain; flex-shrink: 0; }
  .brand-wordmark { width: 108px; height: auto; object-fit: contain; flex-shrink: 0; }
  .brand-title {
    font-size: 12.5px;
    font-weight: 700;
    color: var(--muted);
    letter-spacing: 0.03em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  button.logout {
    border: 1px solid var(--line);
    background: var(--white);
    color: var(--muted);
    font-size: 12.5px;
    padding: 8px 14px;
    min-height: 44px;
    border-radius: 4px;
    cursor: pointer;
    flex-shrink: 0;
  }
  button.logout:hover { color: var(--navy); border-color: var(--muted); }
  button.logout:focus-visible,
  .upload-btn:focus-visible,
  .create-folder-btn:focus-visible,
  .add-link-btn:focus-visible,
  .crumb:focus-visible,
  .up-btn:focus-visible,
  thead th:focus-visible,
  .row-actions button:focus-visible,
  .row-actions a:focus-visible,
  #file-input-trigger:focus-visible,
  #mobile-sort:focus-visible,
  dialog input:focus-visible,
  dialog button:focus-visible,
  tbody tr[data-row-type]:focus-visible { outline: 2px solid var(--blue); outline-offset: -2px; }
  main { max-width: 1100px; margin: 0 auto; padding: 24px; }
  .location-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
    padding: 8px 12px;
    background: var(--pale);
    border: 1px solid var(--line);
    border-radius: 4px;
    font-size: 13px;
  }
  .breadcrumbs { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; min-width: 0; }
  .crumb {
    border: none;
    background: none;
    color: var(--blue);
    font-size: 13px;
    padding: 4px 6px;
    min-height: 32px;
    cursor: pointer;
    border-radius: 4px;
  }
  .crumb:hover { background: #E7F1FB; }
  .crumb[aria-current="location"] { color: var(--navy); font-weight: 700; cursor: default; }
  .crumb-sep { color: var(--muted); }
  .up-btn {
    margin-left: auto;
    border: 1px solid var(--line);
    background: var(--white);
    color: var(--navy);
    font-size: 12.5px;
    padding: 6px 12px;
    min-height: 36px;
    border-radius: 4px;
    cursor: pointer;
  }
  .up-btn:hover { border-color: var(--blue); color: var(--blue); }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 18px;
    flex-wrap: wrap;
  }
  .search-wrap { position: relative; flex: 1 1 260px; min-width: 220px; }
  input[type="search"], input[type="text"], input[type="url"] {
    width: 100%;
    padding: 9px 12px;
    min-height: 44px;
    border: 1px solid var(--line);
    border-radius: 4px;
    font-size: 13.5px;
    color: var(--navy);
    background: var(--white);
  }
  input[type="search"]:focus, input[type="text"]:focus, input[type="url"]:focus { outline: 2px solid var(--blue); outline-offset: 1px; }
  .upload-btn, .create-folder-btn, .add-link-btn {
    font-size: 13px;
    font-weight: 700;
    padding: 9px 16px;
    min-height: 44px;
    border-radius: 4px;
    cursor: pointer;
    white-space: nowrap;
  }
  .upload-btn {
    border: 1px solid var(--blue);
    background: var(--blue);
    color: #fff;
  }
  .upload-btn:hover { background: #147ac9; }
  .upload-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .create-folder-btn, .add-link-btn {
    border: 1px solid var(--line);
    background: var(--white);
    color: var(--navy);
    width: 44px;
    padding: 9px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .create-folder-btn:hover, .add-link-btn:hover { border-color: var(--blue); color: var(--blue); }
  .folder-plus-icon, .online-link-icon { width: 22px; height: 22px; display: block; }
  #mobile-sort {
    display: none;
    width: 100%;
    padding: 9px 12px;
    min-height: 44px;
    border: 1px solid var(--line);
    border-radius: 4px;
    font-size: 13px;
    color: var(--navy);
    background: var(--white);
    margin-bottom: 12px;
  }
  #file-input { display: none; }
  #status {
    min-height: 18px;
    font-size: 12.5px;
    color: var(--muted);
    margin-bottom: 10px;
  }
  #status[data-tone="error"] { color: var(--danger); }
  #status[data-tone="success"] { color: var(--success); }
  .progress-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
  .progress-row[hidden] { display: none; }
  .progress-track {
    flex: 1;
    height: 6px;
    background: var(--pale);
    border-radius: 3px;
    overflow: hidden;
  }
  .progress-fill { height: 100%; width: 0%; background: var(--blue); transition: width 0.15s linear; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13.5px;
  }
  thead th {
    text-align: left;
    font-size: 11.5px;
    font-weight: 700;
    color: var(--muted);
    letter-spacing: 0.03em;
    padding: 10px 10px;
    border-bottom: 1px solid var(--line);
    cursor: pointer;
    user-select: none;
  }
  thead th:focus-visible { outline: 2px solid var(--blue); }
  thead th .arrow { font-size: 10px; margin-left: 3px; opacity: 0.6; }
  tbody td {
    padding: 11px 10px;
    border-bottom: 1px solid var(--line);
    vertical-align: middle;
  }
  tbody tr.folder-row td { font-weight: 600; }
  tbody tr:hover td { background: #FAFCFE; }
  tbody tr[data-row-type] { cursor: pointer; }
  tbody tr[data-row-type] .col-actions { cursor: default; }
  .name-content { display: flex; align-items: center; gap: 8px; }
  .folder-icon { width: 18px; height: 18px; flex-shrink: 0; color: var(--muted); }
  .online-link-icon { width: 18px; height: 18px; flex-shrink: 0; color: var(--blue); }
  .name-content.drag-handle {
    cursor: grab;
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
  }
  .name-content.drag-handle:active { cursor: grabbing; }
  .drag-grip {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    color: var(--muted);
    opacity: 0;
  }
  tbody tr[data-row-type="file"]:hover .drag-grip,
  tbody tr[data-row-type="file"]:focus-visible .drag-grip,
  tbody tr[data-row-type="file"].dragging-row .drag-grip {
    opacity: 0.6;
  }
  tbody tr.dragging-row { opacity: 0.5; }
  tbody tr.folder-row.drop-target td { background: #E7F1FB; }
  tbody tr.folder-row.drop-target { outline: 2px solid var(--blue); outline-offset: -2px; }
  tbody tr.folder-row.drop-target .folder-icon { color: var(--blue); transform: scale(1.12); }
  .drag-preview {
    position: fixed;
    left: 0;
    top: 0;
    display: none;
    align-items: center;
    gap: 8px;
    max-width: min(320px, calc(100vw - 16px));
    padding: 8px 12px;
    border: 1px solid rgba(255, 255, 255, 0.28);
    border-radius: 6px;
    background: rgba(24, 36, 46, 0.94);
    box-shadow: 0 8px 22px rgba(24, 36, 46, 0.24);
    color: var(--white);
    font-size: 12.5px;
    font-weight: 700;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    pointer-events: none;
    z-index: 10;
  }
  .drag-preview.is-visible { display: inline-flex; }
  .drag-preview-icon {
    width: 16px;
    height: 18px;
    flex: 0 0 auto;
    border: 1.5px solid currentColor;
    border-radius: 2px;
    opacity: 0.86;
  }
  .drag-preview-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .row-actions { display: flex; gap: 6px; justify-content: flex-end; }
  .row-actions button {
    border: 1px solid var(--line);
    background: var(--white);
    color: var(--navy);
    font-size: 12px;
    padding: 5px 10px;
    min-height: 44px;
    border-radius: 4px;
    cursor: pointer;
  }
  .row-actions button:hover { border-color: var(--blue); color: var(--blue); }
  .row-actions button.danger:hover { border-color: var(--danger); color: var(--danger); }
  .row-actions a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--line);
    background: var(--white);
    color: var(--navy);
    font-size: 12px;
    padding: 5px 10px;
    min-height: 44px;
    border-radius: 4px;
    cursor: pointer;
    text-decoration: none;
  }
  .row-actions a:hover,
  .row-actions a:focus-visible { border-color: var(--blue); color: var(--blue); }
  .empty { padding: 30px 10px; text-align: center; color: var(--muted); font-size: 13px; }
  .col-size, .col-date, .col-type { color: var(--muted); white-space: nowrap; }

  .file-list-area { position: relative; }
  .drop-overlay {
    position: absolute;
    inset: 0;
    display: none;
    align-items: center;
    justify-content: center;
    border: 2px dashed var(--blue);
    border-radius: 6px;
    background: rgba(26, 143, 230, 0.05);
    color: var(--blue);
    font-size: 13px;
    font-weight: 700;
    pointer-events: none;
    z-index: 2;
  }
  .file-list-area.drag-over .drop-overlay { display: flex; }

  dialog#folder-dialog,
  dialog#rename-dialog,
  dialog#online-link-dialog {
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 20px;
    width: 100%;
    max-width: 360px;
  }
  dialog#folder-dialog::backdrop,
  dialog#rename-dialog::backdrop,
  dialog#online-link-dialog::backdrop { background: rgba(24, 36, 46, 0.35); }
  dialog#folder-dialog h2,
  dialog#rename-dialog h2,
  dialog#online-link-dialog h2 { font-size: 15px; margin: 0 0 12px; }
  dialog#folder-dialog label,
  dialog#rename-dialog label,
  dialog#online-link-dialog label { display: block; font-size: 12.5px; color: var(--muted); margin-bottom: 6px; }
  .dialog-field + .dialog-field { margin-top: 12px; }
  .dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
  .dialog-actions button {
    min-height: 40px;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
  }
  .dialog-actions button[value="cancel"] {
    border: 1px solid var(--line);
    background: var(--white);
    color: var(--navy);
  }
  .dialog-actions button[type="submit"] {
    border: 1px solid var(--blue);
    background: var(--blue);
    color: #fff;
    font-weight: 700;
  }

  @media (min-width: 721px) {
    #mobile-sort { display: none !important; }
  }

  @media (max-width: 720px) {
    header.top { padding: 10px 14px; flex-wrap: nowrap; }
    .brand { gap: 6px; }
    .brand-symbol { width: 20px; height: 20px; }
    .brand-wordmark { display: none; }
    .brand-title { font-size: 11px; }
    button.logout { padding: 8px 10px; font-size: 11.5px; }
    main { padding: 14px; }
    .toolbar { gap: 8px; }
    .search-wrap { flex: 0 1 calc(100% - 104px); min-width: 0; }
    .create-folder-btn, .add-link-btn { flex: 0 0 44px; }
    .upload-btn { flex: 1 0 100%; }
    #mobile-sort { display: block; }
    table thead { display: none; }
    table, tbody, tr, td { display: block; width: 100%; }
    tbody tr {
      border: 1px solid var(--line);
      border-radius: 6px;
      margin-bottom: 10px;
      padding: 10px 12px;
    }
    tbody td { border: none; padding: 4px 0; }
    tbody td.col-actions { padding-top: 8px; }
    tbody td.col-type::before,
    tbody td.col-size::before,
    tbody td.col-date::before {
      content: attr(data-label) "：";
      color: var(--muted);
      font-weight: 700;
      margin-right: 4px;
    }
    .row-actions { justify-content: flex-start; flex-wrap: wrap; }
  }
</style>
</head>
<body>
  <header class="top">
    <div class="brand">
      <img class="brand-symbol" src="${LOGO_SYMBOL_DATA_URL}" alt="Team ARMADA symbol" />
      <img class="brand-wordmark" src="${LOGO_TYPE_DATA_URL}" alt="team ARMADA" />
      <span class="brand-title">SE PROJECT SHARE</span>
    </div>
    <button type="button" class="logout" id="logout-btn">ログアウト</button>
  </header>
  <main>
    <div class="location-bar" id="location-bar">
      <nav class="breadcrumbs" id="breadcrumbs" aria-label="現在の場所"></nav>
      <button type="button" class="up-btn" id="up-btn" hidden data-testid="up-button">上へ</button>
    </div>
    <div class="toolbar">
      <div class="search-wrap">
        <label for="search" class="visually-hidden" style="position:absolute;left:-9999px;">検索</label>
        <input type="search" id="search" placeholder="ファイル・フォルダ名で検索" autocomplete="off" data-testid="search-input" />
      </div>
      <button type="button" class="create-folder-btn" id="create-folder-btn" data-testid="create-folder-button" aria-label="フォルダを作成" title="フォルダを作成">
        <svg class="folder-plus-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
          <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
          <path d="M15.5 11.5v6M12.5 14.5h6" />
        </svg>
      </button>
      <button type="button" class="add-link-btn" id="add-link-btn" data-testid="add-link-button" aria-label="オンライン資料を追加" title="オンライン資料を追加">
        <svg class="online-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
          <path d="m10.5 13.5 3-3" />
          <path d="m7.25 16.75-1.5 1.5a3.25 3.25 0 0 1-4.6-4.6l3-3a3.25 3.25 0 0 1 4.6 0" />
          <path d="m16.75 7.25 1.5-1.5a3.25 3.25 0 0 1 4.6 4.6l-3 3a3.25 3.25 0 0 1-4.6 0" />
          <path d="M18.5 13.5v4M16.5 15.5h4" />
        </svg>
      </button>
      <button type="button" class="upload-btn" id="upload-btn" data-testid="upload-button">ファイルをアップロード</button>
      <input type="file" id="file-input" multiple />
    </div>
    <div id="status" role="status" aria-live="polite"></div>
    <div class="progress-row" id="progress-row" hidden>
      <div class="progress-track"><div class="progress-fill" id="progress-fill"></div></div>
      <span id="progress-label" style="font-size:12px;color:var(--muted);min-width:36px;text-align:right;">0%</span>
    </div>
    <label for="mobile-sort" class="visually-hidden" style="position:absolute;left:-9999px;">並び替え</label>
    <select id="mobile-sort">
      <option value="uploadedAt:desc">更新日が新しい順</option>
      <option value="uploadedAt:asc">更新日が古い順</option>
      <option value="name:asc">名前（昇順）</option>
      <option value="name:desc">名前（降順）</option>
      <option value="size:desc">サイズが大きい順</option>
      <option value="size:asc">サイズが小さい順</option>
    </select>
    <div class="file-list-area" id="file-list-area">
      <table aria-describedby="status">
        <thead>
          <tr>
            <th scope="col" tabindex="0" data-sort="name" aria-sort="none">名前<span class="arrow" data-arrow="name"></span></th>
            <th scope="col" tabindex="0" data-sort="type" class="col-type" aria-sort="none">形式<span class="arrow" data-arrow="type"></span></th>
            <th scope="col" tabindex="0" data-sort="size" class="col-size" aria-sort="none">サイズ<span class="arrow" data-arrow="size"></span></th>
            <th scope="col" tabindex="0" data-sort="uploadedAt" class="col-date" aria-sort="descending">更新日<span class="arrow" data-arrow="uploadedAt"></span></th>
            <th scope="col" class="col-actions"></th>
          </tr>
        </thead>
        <tbody id="file-rows">
        </tbody>
      </table>
      <div class="drop-overlay" id="drop-overlay" aria-hidden="true" data-testid="drop-overlay">
        <span>ここにドロップして保存</span>
      </div>
    </div>
  </main>
  <dialog id="folder-dialog">
    <form method="dialog" id="folder-form">
      <h2>フォルダを作成</h2>
      <label for="folder-name-input">フォルダ名</label>
      <input type="text" id="folder-name-input" name="folder-name" autocomplete="off" required data-testid="folder-name-input" />
      <div class="dialog-actions">
        <button type="button" value="cancel" id="folder-dialog-cancel" data-testid="folder-dialog-cancel">キャンセル</button>
        <button type="submit" data-testid="folder-dialog-submit">作成</button>
      </div>
    </form>
  </dialog>
  <dialog id="rename-dialog">
    <form method="dialog" id="rename-form">
      <h2>ファイル名を変更</h2>
      <label for="rename-name-input">新しいファイル名</label>
      <input type="text" id="rename-name-input" name="new-name" autocomplete="off" required data-testid="rename-name-input" />
      <div class="dialog-actions">
        <button type="button" value="cancel" id="rename-dialog-cancel" data-testid="rename-dialog-cancel">キャンセル</button>
        <button type="submit" id="rename-dialog-submit" data-testid="rename-dialog-submit">保存</button>
      </div>
    </form>
  </dialog>
  <dialog id="online-link-dialog">
    <form method="dialog" id="online-link-form">
      <h2>オンライン資料を追加</h2>
      <div class="dialog-field">
        <label for="online-link-url-input">URL</label>
        <input type="url" id="online-link-url-input" name="url" autocomplete="url" inputmode="url" placeholder="https://…" required data-testid="online-link-url-input" />
      </div>
      <div class="dialog-field">
        <label for="online-link-name-input">表示名（省略可）</label>
        <input type="text" id="online-link-name-input" name="name" autocomplete="off" placeholder="未入力ならURLから設定" data-testid="online-link-name-input" />
      </div>
      <div class="dialog-actions">
        <button type="button" value="cancel" id="online-link-dialog-cancel" data-testid="online-link-dialog-cancel">キャンセル</button>
        <button type="submit" id="online-link-dialog-submit" data-testid="online-link-dialog-submit">追加</button>
      </div>
    </form>
  </dialog>
  <script type="module">
    const statusEl = document.getElementById("status");
    const rowsEl = document.getElementById("file-rows");
    const searchEl = document.getElementById("search");
    const uploadBtn = document.getElementById("upload-btn");
    const fileInput = document.getElementById("file-input");
    const progressRow = document.getElementById("progress-row");
    const progressFill = document.getElementById("progress-fill");
    const progressLabel = document.getElementById("progress-label");
    const logoutBtn = document.getElementById("logout-btn");
    const mobileSort = document.getElementById("mobile-sort");
    const breadcrumbsEl = document.getElementById("breadcrumbs");
    const upBtn = document.getElementById("up-btn");
    const createFolderBtn = document.getElementById("create-folder-btn");
    const addLinkBtn = document.getElementById("add-link-btn");
    const folderDialog = document.getElementById("folder-dialog");
    const folderForm = document.getElementById("folder-form");
    const folderNameInput = document.getElementById("folder-name-input");
    const folderDialogCancel = document.getElementById("folder-dialog-cancel");
    const renameDialog = document.getElementById("rename-dialog");
    const renameForm = document.getElementById("rename-form");
    const renameNameInput = document.getElementById("rename-name-input");
    const renameDialogCancel = document.getElementById("rename-dialog-cancel");
    const renameDialogSubmit = document.getElementById("rename-dialog-submit");
    const onlineLinkDialog = document.getElementById("online-link-dialog");
    const onlineLinkForm = document.getElementById("online-link-form");
    const onlineLinkUrlInput = document.getElementById("online-link-url-input");
    const onlineLinkNameInput = document.getElementById("online-link-name-input");
    const onlineLinkDialogCancel = document.getElementById("online-link-dialog-cancel");
    const onlineLinkDialogSubmit = document.getElementById("online-link-dialog-submit");
    const fileListArea = document.getElementById("file-list-area");

    const MULTIPART_THRESHOLD_BYTES = 100 * 1024 * 1024;

    const FORMAT_EXT_MAP = {
      pdf: "PDF",
      doc: "DOCX", docx: "DOCX",
      xls: "XLSX", xlsx: "XLSX",
      ppt: "PPTX", pptx: "PPTX",
      png: "画像", jpg: "画像", jpeg: "画像", gif: "画像", webp: "画像", svg: "画像", bmp: "画像", heic: "画像",
      mp4: "動画", mov: "動画", avi: "動画", webm: "動画", mkv: "動画",
      mp3: "音声", wav: "音声", m4a: "音声", aac: "音声", flac: "音声",
      txt: "テキスト", md: "テキスト", csv: "テキスト",
    };

    function inferFormat(name) {
      const idx = (name || "").lastIndexOf(".");
      const ext = idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
      return FORMAT_EXT_MAP[ext] || "その他";
    }

    function entryFormat(entry) {
      return entry.kind === "link" ? "オンライン資料" : inferFormat(entry.name);
    }

    function isValidEntryName(name) {
      if (!name) return false;
      if (name !== name.trim()) return false;
      if (name === "." || name === "..") return false;
      if (name === ".folder") return false;
      if (name.length > 255) return false;
      for (let i = 0; i < name.length; i += 1) {
        const code = name.charCodeAt(i);
        if (code <= 0x1f || code === 0x7f) return false;
        if (code === 47 || code === 92) return false;
      }
      return true;
    }

    let files = [];
    let folders = [];
    let currentFolder = "";
    let sortKey = "uploadedAt";
    let sortDir = "desc";
    let uploadInProgress = false;
    let moveInProgress = false;
    let renameInProgress = false;
    let onlineLinkInProgress = false;
    let dragDepth = 0;
    let dropTargetRow = null;
    let pointerDrag = null;
    let renameTarget = null;

    const DRAG_THRESHOLD_PX = 6;

    function setStatus(message, tone) {
      statusEl.textContent = message || "";
      if (tone) statusEl.setAttribute("data-tone", tone);
      else statusEl.removeAttribute("data-tone");
    }

    function formatSize(bytes) {
      if (!Number.isFinite(bytes)) return "—";
      if (bytes < 1024) return bytes + " B";
      const units = ["KB", "MB", "GB", "TB"];
      let value = bytes;
      let unitIndex = -1;
      do {
        value /= 1024;
        unitIndex += 1;
      } while (value >= 1024 && unitIndex < units.length - 1);
      return value.toFixed(value >= 10 ? 0 : 1) + " " + units[unitIndex];
    }

    function formatDate(iso) {
      if (!iso) return "—";
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "—";
      return d.toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    }

    function updateSortArrows() {
      document.querySelectorAll("[data-arrow]").forEach((el) => {
        const key = el.getAttribute("data-arrow");
        el.textContent = key === sortKey ? (sortDir === "asc" ? "▲" : "▼") : "";
      });
      document.querySelectorAll("th[data-sort]").forEach((th) => {
        const key = th.getAttribute("data-sort");
        if (key !== sortKey) {
          th.setAttribute("aria-sort", "none");
        } else {
          th.setAttribute("aria-sort", sortDir === "asc" ? "ascending" : "descending");
        }
      });
      const mobileValue = sortKey + ":" + sortDir;
      if (mobileSort.value !== mobileValue) mobileSort.value = mobileValue;
    }

    function renderBreadcrumbs() {
      breadcrumbsEl.innerHTML = "";
      const rootBtn = document.createElement("button");
      rootBtn.type = "button";
      rootBtn.className = "crumb";
      rootBtn.textContent = "SE";
      rootBtn.dataset.testid = "breadcrumb-root";
      if (!currentFolder) rootBtn.setAttribute("aria-current", "location");
      rootBtn.addEventListener("click", () => navigateTo(""));
      breadcrumbsEl.appendChild(rootBtn);

      const segments = currentFolder ? currentFolder.split("/") : [];
      let pathSoFar = "";
      segments.forEach((segment, index) => {
        const sep = document.createElement("span");
        sep.className = "crumb-sep";
        sep.textContent = "/";
        sep.setAttribute("aria-hidden", "true");
        breadcrumbsEl.appendChild(sep);

        pathSoFar = pathSoFar ? pathSoFar + "/" + segment : segment;
        const targetPath = pathSoFar;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "crumb";
        btn.textContent = segment;
        if (index === segments.length - 1) btn.setAttribute("aria-current", "location");
        btn.addEventListener("click", () => navigateTo(targetPath));
        breadcrumbsEl.appendChild(btn);
      });

      upBtn.hidden = !currentFolder;
    }

    function navigateTo(folderPath) {
      currentFolder = folderPath;
      searchEl.value = "";
      renderBreadcrumbs();
      loadFiles();
    }

    function sortedFilteredFiles() {
      const q = searchEl.value.trim().toLowerCase();
      let list = files.filter((f) => !q || f.name.toLowerCase().includes(q));
      list.sort((a, b) => {
        let av;
        let bv;
        if (sortKey === "type") {
          av = entryFormat(a);
          bv = entryFormat(b);
        } else {
          av = a[sortKey];
          bv = b[sortKey];
        }
        if (sortKey === "name" || sortKey === "type") {
          av = av.toLowerCase();
          bv = bv.toLowerCase();
        }
        if (sortKey === "uploadedAt") {
          av = new Date(av).getTime();
          bv = new Date(bv).getTime();
        }
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
      return list;
    }

    function sortedFilteredFolders() {
      const q = searchEl.value.trim().toLowerCase();
      const list = folders.filter((f) => !q || f.name.toLowerCase().includes(q));
      list.sort((a, b) => a.name.localeCompare(b.name, "ja"));
      return list;
    }

    function folderIconSvg() {
      return '<svg class="folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 6.5a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/></svg>';
    }

    function onlineLinkIconSvg() {
      return '<svg class="online-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m10.5 13.5 3-3"/><path d="m7.25 16.75-1.5 1.5a3.25 3.25 0 0 1-4.6-4.6l3-3a3.25 3.25 0 0 1 4.6 0"/><path d="m16.75 7.25 1.5-1.5a3.25 3.25 0 0 1 4.6 4.6l-3 3a3.25 3.25 0 0 1-4.6 0"/></svg>';
    }

    function dragGripSvg() {
      return '<svg class="drag-grip" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="5" cy="3" r="1.3"/><circle cx="11" cy="3" r="1.3"/><circle cx="5" cy="8" r="1.3"/><circle cx="11" cy="8" r="1.3"/><circle cx="5" cy="13" r="1.3"/><circle cx="11" cy="13" r="1.3"/></svg>';
    }

    function render() {
      rowsEl.innerHTML = "";

      const folderList = sortedFilteredFolders();
      const fileList = sortedFilteredFiles();

      if (folderList.length === 0 && fileList.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 5;
        td.className = "empty";
        td.textContent = files.length === 0 && folders.length === 0
          ? "このフォルダにはまだ何もありません。"
          : "該当する項目が見つかりません。";
        tr.appendChild(td);
        rowsEl.appendChild(tr);
        return;
      }

      for (const folder of folderList) {
        const tr = document.createElement("tr");
        tr.className = "folder-row";
        tr.setAttribute("data-testid", "folder-row");
        tr.setAttribute("data-row-type", "folder");
        tr.setAttribute("data-folder-path", folder.path);
        tr.tabIndex = 0;

        const nameTd = document.createElement("td");
        nameTd.className = "name-cell";
        const nameContent = document.createElement("span");
        nameContent.className = "name-content";
        nameContent.innerHTML = folderIconSvg();
        const nameSpan = document.createElement("span");
        nameSpan.textContent = folder.name;
        nameContent.appendChild(nameSpan);
        nameTd.appendChild(nameContent);
        tr.appendChild(nameTd);

        const typeTd = document.createElement("td");
        typeTd.className = "col-type";
        typeTd.setAttribute("data-label", "形式");
        typeTd.textContent = "フォルダ";
        tr.appendChild(typeTd);

        const sizeTd = document.createElement("td");
        sizeTd.className = "col-size";
        sizeTd.setAttribute("data-label", "サイズ");
        sizeTd.textContent = "—";
        tr.appendChild(sizeTd);

        const dateTd = document.createElement("td");
        dateTd.className = "col-date";
        dateTd.setAttribute("data-label", "更新日");
        dateTd.textContent = "—";
        tr.appendChild(dateTd);

        const actionsTd = document.createElement("td");
        actionsTd.className = "col-actions";
        const actions = document.createElement("div");
        actions.className = "row-actions";

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "danger";
        deleteBtn.textContent = "削除";
        deleteBtn.addEventListener("click", () => deleteFolder(folder.path, folder.name));
        actions.appendChild(deleteBtn);

        actionsTd.appendChild(actions);
        tr.appendChild(actionsTd);
        rowsEl.appendChild(tr);
      }

      for (const file of fileList) {
        const isOnlineLink = file.kind === "link";
        const tr = document.createElement("tr");
        tr.setAttribute("data-row-type", "file");
        tr.setAttribute("data-entry-kind", isOnlineLink ? "link" : "file");
        if (isOnlineLink) tr.setAttribute("data-link-id", file.id);
        else tr.setAttribute("data-file-pathname", file.pathname);
        tr.tabIndex = 0;

        const nameTd = document.createElement("td");
        nameTd.className = "name-cell";
        const nameContent = document.createElement("span");
        nameContent.className = "name-content drag-handle";
        nameContent.setAttribute("data-drag-handle", "true");
        nameContent.innerHTML = dragGripSvg() + (isOnlineLink ? onlineLinkIconSvg() : "");
        const nameSpan = document.createElement("span");
        nameSpan.textContent = file.name;
        nameContent.appendChild(nameSpan);
        nameTd.appendChild(nameContent);
        tr.appendChild(nameTd);

        const typeTd = document.createElement("td");
        typeTd.className = "col-type";
        typeTd.setAttribute("data-label", "形式");
        typeTd.textContent = entryFormat(file);
        tr.appendChild(typeTd);

        const sizeTd = document.createElement("td");
        sizeTd.className = "col-size";
        sizeTd.setAttribute("data-label", "サイズ");
        sizeTd.textContent = isOnlineLink ? "—" : formatSize(file.size);
        tr.appendChild(sizeTd);

        const dateTd = document.createElement("td");
        dateTd.className = "col-date";
        dateTd.setAttribute("data-label", "更新日");
        dateTd.textContent = formatDate(file.uploadedAt);
        tr.appendChild(dateTd);

        const actionsTd = document.createElement("td");
        actionsTd.className = "col-actions";
        const actions = document.createElement("div");
        actions.className = "row-actions";

        if (!isOnlineLink) {
          const downloadBtn = document.createElement("button");
          downloadBtn.type = "button";
          downloadBtn.textContent = "ダウンロード";
          downloadBtn.addEventListener("click", () => openFile(file.pathname, true));
          actions.appendChild(downloadBtn);
        }

        const renameBtn = document.createElement("button");
        renameBtn.type = "button";
        renameBtn.textContent = "名前変更";
        renameBtn.addEventListener("click", () => openRenameDialog(file));
        actions.appendChild(renameBtn);

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "danger";
        deleteBtn.textContent = "削除";
        deleteBtn.addEventListener("click", () => {
          if (isOnlineLink) deleteOnlineLink(file);
          else deleteFile(file.pathname, file.name);
        });
        actions.appendChild(deleteBtn);

        actionsTd.appendChild(actions);
        tr.appendChild(actionsTd);
        rowsEl.appendChild(tr);
      }
    }

    function activateRow(tr) {
      const type = tr.getAttribute("data-row-type");
      if (type === "folder") {
        navigateTo(tr.getAttribute("data-folder-path"));
      } else if (type === "file") {
        const entry = getEntryFromRow(tr);
        if (!entry) return;
        if (entry.kind === "link") {
          window.open(entry.url, "_blank", "noopener,noreferrer");
          return;
        }
        window.open("/api/view?pathname=" + encodeURIComponent(entry.pathname), "_blank", "noopener");
      }
    }

    function getEntryFromRow(tr) {
      if (tr.getAttribute("data-entry-kind") === "link") {
        const id = tr.getAttribute("data-link-id");
        return files.find((entry) => entry.kind === "link" && entry.id === id);
      }
      const pathname = tr.getAttribute("data-file-pathname");
      return files.find((entry) => entry.kind !== "link" && entry.pathname === pathname);
    }

    rowsEl.addEventListener("dblclick", (event) => {
      if (event.target.closest(".col-actions")) return;
      const tr = event.target.closest("tr[data-row-type]");
      if (!tr) return;
      activateRow(tr);
    });

    rowsEl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target.closest(".row-actions")) return;
      const tr = event.target.closest("tr[data-row-type]");
      if (!tr || tr !== event.target) return;
      event.preventDefault();
      activateRow(tr);
    });

    async function loadFiles() {
      setStatus("読み込み中…");
      try {
        const res = await fetch("/api/files?folder=" + encodeURIComponent(currentFolder), {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (res.status === 401) {
          window.location.reload();
          return;
        }
        if (!res.ok) throw new Error("一覧の取得に失敗しました。");
        const data = await res.json();
        files = Array.isArray(data.files) ? data.files : [];
        folders = Array.isArray(data.folders) ? data.folders : [];
        setStatus("");
        render();
      } catch (err) {
        setStatus(err.message || "一覧の取得に失敗しました。", "error");
      }
    }

    async function openFile(pathname, download) {
      if (download) {
        setStatus("リンクを準備しています…");
        try {
          const res = await fetch("/api/access", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pathname, download }),
          });
          if (res.status === 401) {
            window.location.reload();
            return;
          }
          if (!res.ok) throw new Error("リンクの発行に失敗しました。");
          const data = await res.json();
          setStatus("");
          const a = document.createElement("a");
          a.href = data.url;
          a.rel = "noopener";
          a.download = "";
          document.body.appendChild(a);
          a.click();
          a.remove();
        } catch (err) {
          setStatus(err.message || "リンクの発行に失敗しました。", "error");
        }
        return;
      }

    }

    async function deleteFile(pathname, name) {
      if (!window.confirm(name + " を削除しますか？この操作は取り消せません。")) return;
      setStatus("削除しています…");
      try {
        const res = await fetch("/api/files", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pathname }),
        });
        if (res.status === 401) {
          window.location.reload();
          return;
        }
        if (!res.ok) throw new Error("削除に失敗しました。");
        setStatus(name + " を削除しました。", "success");
        await loadFiles();
      } catch (err) {
        setStatus(err.message || "削除に失敗しました。", "error");
      }
    }

    async function deleteOnlineLink(link) {
      if (!window.confirm(link.name + " を削除しますか？この操作は取り消せません。")) return;
      setStatus("削除しています…");
      try {
        const res = await fetch("/api/links", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: link.id }),
        });
        if (res.status === 401) {
          window.location.reload();
          return;
        }
        if (!res.ok) throw new Error("削除に失敗しました。");
        setStatus(link.name + " を削除しました。", "success");
        await loadFiles();
      } catch (err) {
        setStatus(err.message || "削除に失敗しました。", "error");
      }
    }

    async function deleteFolder(folderPath, name) {
      if (!window.confirm(name + " を削除しますか？この操作は取り消せません。")) return;
      setStatus("削除しています…");
      try {
        const res = await fetch("/api/folders", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderPath }),
        });
        if (res.status === 401) {
          window.location.reload();
          return;
        }
        if (res.status === 409) {
          setStatus("フォルダが空ではありません", "error");
          return;
        }
        if (!res.ok) throw new Error("削除に失敗しました。");
        setStatus(name + " を削除しました。", "success");
        await loadFiles();
      } catch (err) {
        setStatus(err.message || "削除に失敗しました。", "error");
      }
    }

    function openRenameDialog(entry) {
      renameTarget = entry;
      renameNameInput.value = entry.name;
      renameDialog.showModal();
      renameNameInput.focus();
      renameNameInput.select();
    }

    function closeRenameDialog() {
      renameTarget = null;
      renameForm.reset();
      renameDialog.close();
    }

    renameDialogCancel.addEventListener("click", closeRenameDialog);
    renameDialog.addEventListener("cancel", () => {
      renameTarget = null;
      renameForm.reset();
    });

    renameForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!renameTarget || renameInProgress) return;

      const { name: oldName } = renameTarget;
      const newName = renameNameInput.value.trim();
      if (!isValidEntryName(newName)) {
        setStatus("ファイル名に使用できない文字が含まれています。", "error");
        return;
      }
      if (newName === oldName) {
        closeRenameDialog();
        return;
      }

      renameInProgress = true;
      renameDialogSubmit.disabled = true;
      setStatus(oldName + " の名前を変更しています…");
      try {
        const isOnlineLink = renameTarget.kind === "link";
        const res = await fetch(isOnlineLink ? "/api/links" : "/api/files", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(isOnlineLink ? { id: renameTarget.id, newName } : { pathname: renameTarget.pathname, newName }),
        });
        if (res.status === 401) {
          window.location.reload();
          return;
        }
        if (res.status === 409) {
          setStatus("同じ名前の項目がすでにあります。", "error");
          return;
        }
        if (!res.ok) throw new Error("名前の変更に失敗しました。");
        closeRenameDialog();
        setStatus(newName + " に変更しました。", "success");
        await loadFiles();
      } catch (err) {
        setStatus(err.message || "名前の変更に失敗しました。", "error");
      } finally {
        renameInProgress = false;
        renameDialogSubmit.disabled = false;
      }
    });

    async function moveFileTo(entry, targetFolder) {
      if (!entry || targetFolder === null || targetFolder === undefined) return;
      if (moveInProgress) {
        setStatus("移動中です。完了までお待ちください。", "error");
        return;
      }
      const isOnlineLink = entry.kind === "link";
      const fileName = entry.name;
      const folderEntry = folders.find((f) => f.path === targetFolder);
      const folderName = folderEntry ? folderEntry.name : targetFolder;

      moveInProgress = true;
      setStatus(fileName + " を " + folderName + " へ移動しています…");
      try {
        const res = await fetch(isOnlineLink ? "/api/links" : "/api/files", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(isOnlineLink ? { id: entry.id, targetFolder } : { pathname: entry.pathname, targetFolder }),
        });
        if (res.status === 401) {
          window.location.reload();
          return;
        }
        if (res.status === 409) {
          setStatus(folderName + " には同じ名前の項目がすでにあります。", "error");
          return;
        }
        if (!res.ok) throw new Error(fileName + " の移動に失敗しました。");
        setStatus(fileName + " を " + folderName + " へ移動しました。", "success");
        await loadFiles();
      } catch (err) {
        setStatus(err.message || fileName + " の移動に失敗しました。", "error");
      } finally {
        moveInProgress = false;
      }
    }

    function clearDropTarget() {
      if (dropTargetRow) {
        dropTargetRow.classList.remove("drop-target");
        dropTargetRow = null;
      }
    }

    function endPointerDrag() {
      if (!pointerDrag) return;
      pointerDrag.tr.classList.remove("dragging-row");
      if (pointerDrag.preview) pointerDrag.preview.remove();
      pointerDrag = null;
      clearDropTarget();
    }

    function createDragPreview(name) {
      const preview = document.createElement("div");
      preview.className = "drag-preview";
      preview.setAttribute("aria-hidden", "true");

      const icon = document.createElement("span");
      icon.className = "drag-preview-icon";
      icon.setAttribute("aria-hidden", "true");
      preview.appendChild(icon);

      const label = document.createElement("span");
      label.className = "drag-preview-label";
      label.textContent = name;
      preview.appendChild(label);
      return preview;
    }

    function positionDragPreview(event) {
      if (!pointerDrag?.preview) return;
      const previewRect = pointerDrag.preview.getBoundingClientRect();
      const x = Math.max(8, Math.min(event.clientX + 14, window.innerWidth - previewRect.width - 8));
      const y = Math.max(8, Math.min(event.clientY + 14, window.innerHeight - previewRect.height - 8));
      pointerDrag.preview.style.transform = "translate3d(" + x + "px, " + y + "px, 0)";
    }

    rowsEl.addEventListener("pointerdown", (event) => {
      if (!event.isPrimary) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const handle = event.target.closest('[data-drag-handle="true"]');
      const tr = handle ? handle.closest('tr[data-row-type="file"]') : null;
      if (!tr) return;
      const entry = getEntryFromRow(tr);
      if (!entry) return;
      pointerDrag = {
        pointerId: event.pointerId,
        entry,
        name: entry.name,
        tr,
        startX: event.clientX,
        startY: event.clientY,
        dragging: false,
      };
    });

    window.addEventListener("pointermove", (event) => {
      if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;
      if (!pointerDrag.dragging) {
        const dx = event.clientX - pointerDrag.startX;
        const dy = event.clientY - pointerDrag.startY;
        if (Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) return;
        pointerDrag.dragging = true;
        pointerDrag.tr.classList.add("dragging-row");
        pointerDrag.preview = createDragPreview(pointerDrag.name);
        document.body.appendChild(pointerDrag.preview);
        pointerDrag.preview.classList.add("is-visible");
      }
      event.preventDefault();
      positionDragPreview(event);
      const el = document.elementFromPoint(event.clientX, event.clientY);
      const tr = el ? el.closest('tr[data-row-type="folder"]') : null;
      if (tr !== dropTargetRow) {
        clearDropTarget();
        if (tr) {
          tr.classList.add("drop-target");
          dropTargetRow = tr;
        }
      }
    });

    window.addEventListener("pointerup", (event) => {
      if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;
      const wasDragging = pointerDrag.dragging;
      const entry = pointerDrag.entry;
      const targetTr = dropTargetRow;
      endPointerDrag();
      if (wasDragging && targetTr) {
        moveFileTo(entry, targetTr.getAttribute("data-folder-path"));
      }
    });

    window.addEventListener("pointercancel", (event) => {
      if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;
      endPointerDrag();
    });

    window.addEventListener("blur", () => {
      endPointerDrag();
    });

    function setProgress(percent) {
      progressRow.hidden = false;
      progressFill.style.width = percent + "%";
      progressLabel.textContent = Math.round(percent) + "%";
    }

    async function uploadFiles(fileList) {
      const list = Array.from(fileList);
      if (list.length === 0) return;
      if (uploadInProgress) return;
      const invalid = list.some((file) => !isValidEntryName(file.name));
      if (invalid) {
        setStatus("ファイル名に使用できない文字が含まれています。", "error");
        fileInput.value = "";
        return;
      }
      uploadInProgress = true;
      uploadBtn.disabled = true;
      let upload;
      try {
        ({ upload } = await import("/vendor/blob-client.mjs"));
      } catch (err) {
        setStatus("アップロード機能の読み込みに失敗しました。", "error");
        fileInput.value = "";
        progressRow.hidden = true;
        uploadBtn.disabled = false;
        uploadInProgress = false;
        return;
      }
      for (const file of list) {
        setStatus(file.name + " をアップロードしています…");
        setProgress(0);
        const prefix = currentFolder ? "se/files/" + currentFolder + "/" : "se/files/";
        try {
          await upload(prefix + file.name, file, {
            access: "private",
            handleUploadUrl: "/api/upload",
            multipart: file.size > MULTIPART_THRESHOLD_BYTES,
            onUploadProgress: (event) => setProgress(event.percentage),
          });
          setStatus(file.name + " をアップロードしました。", "success");
        } catch (err) {
          setStatus(file.name + " のアップロードに失敗しました。", "error");
        }
      }
      progressRow.hidden = true;
      uploadBtn.disabled = false;
      uploadInProgress = false;
      fileInput.value = "";
      await loadFiles();
    }

    function isValidOnlineUrl(value) {
      try {
        const parsed = new URL(value);
        return (parsed.protocol === "https:" || parsed.protocol === "http:") && !!parsed.hostname && !parsed.username && !parsed.password;
      } catch {
        return false;
      }
    }

    function openOnlineLinkDialog() {
      onlineLinkForm.reset();
      onlineLinkDialog.showModal();
      onlineLinkUrlInput.focus();
    }

    function closeOnlineLinkDialog() {
      onlineLinkForm.reset();
      onlineLinkDialog.close();
    }

    addLinkBtn.addEventListener("click", openOnlineLinkDialog);
    onlineLinkDialogCancel.addEventListener("click", closeOnlineLinkDialog);
    onlineLinkDialog.addEventListener("cancel", () => {
      onlineLinkForm.reset();
    });

    onlineLinkForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (onlineLinkInProgress) return;

      const url = onlineLinkUrlInput.value.trim();
      const name = onlineLinkNameInput.value.trim();
      if (!isValidOnlineUrl(url)) {
        setStatus("http または https のURLを入力してください。", "error");
        onlineLinkUrlInput.focus();
        return;
      }
      if (name && !isValidEntryName(name)) {
        setStatus("表示名に使用できない文字が含まれています。", "error");
        onlineLinkNameInput.focus();
        return;
      }

      onlineLinkInProgress = true;
      onlineLinkDialogSubmit.disabled = true;
      setStatus("オンライン資料を追加しています…");
      try {
        const res = await fetch("/api/links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, name, folder: currentFolder }),
        });
        if (res.status === 401) {
          window.location.reload();
          return;
        }
        if (!res.ok) throw new Error("オンライン資料の追加に失敗しました。");
        closeOnlineLinkDialog();
        setStatus((name || "オンライン資料") + " を追加しました。", "success");
        await loadFiles();
      } catch (err) {
        setStatus(err.message || "オンライン資料の追加に失敗しました。", "error");
      } finally {
        onlineLinkInProgress = false;
        onlineLinkDialogSubmit.disabled = false;
      }
    });

    function openFolderDialog() {
      folderNameInput.value = "";
      folderDialog.showModal();
      folderNameInput.focus();
    }

    function closeFolderDialog() {
      folderForm.reset();
      folderDialog.close();
    }

    createFolderBtn.addEventListener("click", openFolderDialog);
    folderDialogCancel.addEventListener("click", closeFolderDialog);
    folderDialog.addEventListener("cancel", () => {
      folderForm.reset();
    });

    folderForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = folderNameInput.value.trim();
      if (!isValidEntryName(name)) {
        setStatus("フォルダ名に使用できない文字が含まれています。", "error");
        return;
      }
      setStatus("フォルダを作成しています…");
      try {
        const res = await fetch("/api/folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parentPath: currentFolder, name }),
        });
        if (res.status === 401) {
          window.location.reload();
          return;
        }
        if (!res.ok) throw new Error("フォルダの作成に失敗しました。");
        closeFolderDialog();
        setStatus(name + " を作成しました。", "success");
        await loadFiles();
      } catch (err) {
        setStatus(err.message || "フォルダの作成に失敗しました。", "error");
      }
    });

    document.querySelectorAll("th[data-sort]").forEach((th) => {
      const key = th.getAttribute("data-sort");
      function activate() {
        if (sortKey === key) {
          sortDir = sortDir === "asc" ? "desc" : "asc";
        } else {
          sortKey = key;
          sortDir = "asc";
        }
        updateSortArrows();
        render();
      }
      th.addEventListener("click", activate);
      th.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      });
    });

    searchEl.addEventListener("input", () => render());

    mobileSort.addEventListener("change", () => {
      const [key, dir] = mobileSort.value.split(":");
      sortKey = key;
      sortDir = dir;
      updateSortArrows();
      render();
    });

    upBtn.addEventListener("click", () => {
      if (!currentFolder) return;
      const segments = currentFolder.split("/");
      segments.pop();
      navigateTo(segments.join("/"));
    });

    uploadBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => uploadFiles(fileInput.files));

    function isFileDrag(dataTransfer) {
      return !!dataTransfer && Array.from(dataTransfer.types || []).includes("Files");
    }

    document.addEventListener("dragenter", (event) => {
      if (!isFileDrag(event.dataTransfer)) return;
      event.preventDefault();
      dragDepth += 1;
      fileListArea.classList.add("drag-over");
    });

    document.addEventListener("dragover", (event) => {
      if (!isFileDrag(event.dataTransfer)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    });

    document.addEventListener("dragleave", () => {
      if (dragDepth === 0) return;
      dragDepth -= 1;
      if (dragDepth === 0) fileListArea.classList.remove("drag-over");
    });

    document.addEventListener("drop", (event) => {
      if (!isFileDrag(event.dataTransfer)) return;
      event.preventDefault();
      dragDepth = 0;
      fileListArea.classList.remove("drag-over");
      if (uploadInProgress) {
        setStatus("アップロード中です。完了までお待ちください。", "error");
        return;
      }
      const droppedFiles = event.dataTransfer.files;
      if (droppedFiles && droppedFiles.length > 0) uploadFiles(droppedFiles);
    });

    logoutBtn.addEventListener("click", async () => {
      logoutBtn.disabled = true;
      try {
        await fetch("/api/logout", { method: "POST" });
      } finally {
        window.location.reload();
      }
    });

    updateSortArrows();
    renderBreadcrumbs();
    loadFiles();
  </script>
</body>
</html>`;
}

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = {
  access: new URL("../src/lib/workspace-document-access.ts", import.meta.url),
  capabilities: new URL("../src/lib/workspace-capabilities.ts", import.meta.url),
  list: new URL("../src/app/api/workspace-documents/route.ts", import.meta.url),
  mutate: new URL("../src/app/api/workspace-documents/[documentId]/route.ts", import.meta.url),
  open: new URL("../src/app/api/workspace-documents/[documentId]/open/route.ts", import.meta.url),
  render: new URL("../src/app/api/workspace-documents/[documentId]/render/route.ts", import.meta.url),
  textLoader: new URL("../src/lib/workspace-document-text.ts", import.meta.url),
  markdownPage: new URL("../src/app/workspace-document/[documentId]/page.tsx", import.meta.url),
  markdownReader: new URL("../src/components/workspace-documents/WorkspaceMarkdownReader.tsx", import.meta.url),
  htmlEditingGate: new URL("../src/lib/workspace-document-editing.ts", import.meta.url),
  htmlSource: new URL("../src/app/api/workspace-documents/[documentId]/source/route.ts", import.meta.url),
  htmlRevisionList: new URL("../src/app/api/workspace-documents/[documentId]/revisions/route.ts", import.meta.url),
  htmlRevisionItem: new URL("../src/app/api/workspace-documents/[documentId]/revisions/[revisionNo]/route.ts", import.meta.url),
  deckGate: new URL("../src/lib/workspace-document-decks.ts", import.meta.url),
  deck: new URL("../src/app/api/workspace-documents/[documentId]/deck/route.ts", import.meta.url),
  deckPublish: new URL("../src/app/api/workspace-documents/[documentId]/deck/publish/route.ts", import.meta.url),
  deckAssets: new URL("../src/app/api/workspace-documents/[documentId]/assets/route.ts", import.meta.url),
  deckModel: new URL("../src/lib/workspace-deck-model.ts", import.meta.url),
  deckRender: new URL("../src/lib/workspace-deck-render.ts", import.meta.url),
  pdf: new URL("../src/app/api/workspace-documents/[documentId]/pdf/route.ts", import.meta.url),
  htmlPdf: new URL("../src/lib/workspace-document-html-pdf.ts", import.meta.url),
  serializer: new URL("../src/lib/workspace-documents-server.ts", import.meta.url),
  middleware: new URL("../src/lib/supabase/middleware.ts", import.meta.url),
  institutionPage: new URL("../src/app/workspace/[slug]/files/page.tsx", import.meta.url),
  projectPage: new URL("../src/app/(shared-workspace)/project/[projectId]/workspace/files/page.tsx", import.meta.url),
  sxWorkspace: new URL("../src/components/project-workspace/SxWeeklyControlDashboard.tsx", import.meta.url),
  room: new URL("../src/components/workspace-documents/WorkspaceDocumentRoom.tsx", import.meta.url),
  editorPage: new URL("../src/app/workspace-document/[documentId]/edit/page.tsx", import.meta.url),
  editorWorkbench: new URL("../src/components/workspace-documents/WorkspaceDocumentEditorWorkbench.tsx", import.meta.url),
  cockpit: new URL("../src/components/cockpit/CockpitView.tsx", import.meta.url),
  nextConfig: new URL("../next.config.ts", import.meta.url),
};

const source = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([key, url]) => [key, await readFile(url, "utf8")])));

assert.match(source.access, /resolveSharedWorkspaceAccess\(projectId\)/, "PJ資料は共有workspaceの明示アクセスを再利用する");
assert.match(source.access, /workspaceCapabilities\(/, "資料権限はrole名の直接比較でなく共通capability bundleから解決する");
assert.match(source.access, /hasWorkspaceCapability\(capabilities, "document\.upload"\)/, "資料追加は明示capabilityを検査する");
assert.match(source.access, /hasWorkspaceCapability\(capabilities, "document\.manage"\)/, "資料整理は明示capabilityを検査する");
assert.doesNotMatch(source.access, /access\.role === "manager"|membership\.role === "owner"/, "資料access resolverへrole名の認可分岐を直書きしない");
assert.match(source.capabilities, /role: "manager" \| "contributor" \| "readonly"/, "既存PJ roleをcapability bundle入力として閉じる");
assert.match(source.capabilities, /External role labels currently do not grant membership management/, "未実装権限を強いrole名から推定しない");
assert.match(source.access, /scope\.institutionWorkspaces\.find/, "機関資料は機関membershipを明示確認する");
assert.doesNotMatch(source.access, /institutionWorkspaces.*project_access/s, "機関membershipからPJ権限を自動生成しない");
assert.match(source.list, /surface === "workspace" \|\| !access\.canReadInternal[\s\S]*?visibility", "workspace_shared"/s, "workspace面と外部一覧は共有資料だけに絞る");
assert.match(source.open, /row\.visibility === "amd_internal" && !access\.canReadInternal/, "open routeも内部資料を404にする");
assert.match(source.open, /!download && isWorkspaceDocumentHtml[\s\S]*?\/render/, "旧open URLもHTMLをブラウザ表示へ振り分ける");
assert.match(source.open, /!download && isWorkspaceDocumentMarkdown[\s\S]*?\/workspace-document\//, "旧open URLもMarkdown Readerへ振り分ける");
assert.match(source.open, /createSignedUrl\(row\.storage_path, 60/, "private fileは60秒の署名URLで開く");
assert.match(source.render, /resolveDocumentRowAccess\(db, row\)/, "HTML表示も資料ごとの権限を再確認する");
assert.match(source.render, /row\.visibility === "amd_internal" && !access\.canReadInternal/, "HTML表示も内部資料を404にする");
assert.match(source.render, /row\.visibility === "workspace_shared" && !\(await getWorkspaceAccessCandidateSession\(\)\)/, "外部共有資料の未ログイン直リンクは確認コード入口へ案内する");
assert.match(source.render, /login\.searchParams\.set\("audience", "institution"\)/, "外部資料の直リンクは外部向けログイン画面を開く");
assert.match(source.render, /login\.searchParams\.set\("next", new URL\(request\.url\)\.pathname\)/, "ログイン後は元の資料表示へ戻す");
assert.match(source.render, /isWorkspaceDocumentHtml\(row\.mime_type, row\.display_name\)/, "HTMLだけを専用表示で返す");
assert.match(source.render, /WORKSPACE_DOCUMENT_HTML_PREVIEW_MAX_BYTES/, "HTML表示の読込量を制限する");
assert.match(source.render, /row\.entry_kind !== "file" && row\.entry_kind !== "link"/, "HTML表示は保存fileとDrive linkの両方を扱う");
assert.match(source.render, /loadWorkspaceDocumentText\(db, row, WORKSPACE_DOCUMENT_HTML_PREVIEW_MAX_BYTES\)/, "HTML表示は共通の上限付き本文loaderを通す");
assert.match(source.render, /default-src 'none';[\s\S]*sandbox/, "HTML表示はscriptを許可しないsandbox CSPを返す");
assert.match(source.render, /Content-Type": "text\/html; charset=utf-8"/, "HTML表示は正しいMIMEで返す");
// HTML編集系routeの認可は共有gate (workspace-document-editing.ts) に集約する。
// 本文読込・保存・版履歴・復元が同じ条件を各自で書き写すと、片方だけ緩む事故が起きる。
assert.match(source.htmlEditingGate, /resolveDocumentRowAccess\(db, row\)/, "HTML編集gateは資料ごとの権限を再確認する");
assert.match(source.htmlEditingGate, /row\.visibility === "amd_internal" && !access\.canReadInternal/, "HTML編集gateは内部資料を404にする");
assert.match(source.htmlEditingGate, /!access\.canUpload/, "HTML本文の読込・保存は追加権限を必須にする");
assert.match(source.htmlEditingGate, /isWorkspaceDocumentHtml\(row\.mime_type, row\.display_name\)/, "HTML編集gateはHTMLだけを通す");
assert.match(source.htmlEditingGate, /upload_status", "active"/, "HTML編集gateは削除済み資料を通さない");
assert.match(source.htmlEditingGate, /!row\.storage_bucket \|\| !row\.storage_path/, "HTML編集gateは実体を触れない資料を通さない");
assert.match(source.htmlSource, /loadEditableWorkspaceHtmlDocument\(documentId\)/, "HTML本文routeは共有gateで認可する");
assert.match(source.htmlSource, /normalizeWorkspaceDocumentHtmlSource/, "HTML本文は空欄・byte上限をserverで検証する");
assert.match(source.htmlSource, /isWorkspaceDocumentSha256\(body\.expectedSha256\)/, "HTML保存は編集前の版のsha256を必須にする");
assert.match(source.htmlSource, /replaceWorkspaceHtmlSource\(\{[\s\S]*?auditAction: "replace_html"/, "HTML本文の保存は共有の書き込み経路を通る");
assert.match(source.htmlSource, /isSameOriginWorkspaceMutation\(request\)/, "HTML保存は同一originからの操作だけ受け付ける");
assert.doesNotMatch(source.htmlSource, /createSignedUrl|signedUrl/, "HTML編集用APIは署名URLを返さない");

// 現物の差し替えは replaceWorkspaceHtmlSource 1本に集約する。本文保存と版復元が別々に
// 上書き手順を持つと、片方だけ「退避せずに上書き」へ退化しても誰も気づけない。
assert.doesNotMatch(source.htmlSource, /\.upload\(storagePath/, "HTML本文routeはStorageを直接上書きしない");
assert.doesNotMatch(source.htmlRevisionItem, /\.upload\(storagePath/, "版復元routeはStorageを直接上書きしない");
assert.match(source.htmlEditingGate, /currentSha256 !== expectedSha256[\s\S]*?conflict: true/, "現物と食い違う保存は409で止める");
assert.match(source.htmlEditingGate, /status: 409/, "競合はHTTP 409で返す");
assert.match(source.htmlEditingGate, /nextSha256 === currentSha256[\s\S]*?unchanged: true/, "内容が変わらない保存で版を増やさない");
assert.match(source.htmlEditingGate, /archiveHtmlSourceRevision\(db, \{[\s\S]*?\}\);/, "上書き前に旧版を版履歴へ退避する");
assert.match(source.htmlEditingGate, /catch[\s\S]*?html revision archive failed[\s\S]*?return \{ ok: false/, "旧版を退避できなければ上書きせず中断する");
assert.match(source.htmlEditingGate, /\.upload\(storagePath, sourceBytes/, "HTML本文は既存private Storage objectへ上書きする");
assert.match(source.htmlEditingGate, /file_size_bytes: sourceBytes\.byteLength/, "HTML保存後にサイズmetadataを更新する");
assert.match(source.htmlEditingGate, /mime_type: mimeType/, "HTML保存後にMIME metadataを更新する");
assert.match(source.htmlEditingGate, /updated_at: new Date\(\)\.toISOString\(\)/, "HTML保存後に更新日時を更新する");
assert.match(source.htmlEditingGate, /pruneWorkspaceDocumentRevisions\(db, row\.document_id\)/, "保存のたびに保持件数を超えた版を掃除する");
assert.match(source.htmlEditingGate, /action: auditAction/, "本文差し替えは本文なしの監査eventを残す");

// 版履歴route。読込と同じgateを通さないと、編集できない人が過去版を読めてしまう。
assert.match(source.htmlRevisionList, /loadEditableWorkspaceHtmlDocument\(documentId\)/, "版一覧は共有gateで認可する");
assert.match(source.htmlRevisionList, /publicWorkspaceDocumentRevision/, "版一覧はstorage実体のpathを外へ出さない");
assert.match(source.htmlRevisionList, /currentSha256/, "版一覧は復元用に現物のsha256を返す");
assert.doesNotMatch(source.htmlRevisionList, /createSignedUrl|signedUrl/, "版一覧は署名URLを返さない");
assert.match(source.htmlRevisionItem, /loadEditableWorkspaceHtmlDocument\(documentId\)/, "版の本文取得・復元は共有gateで認可する");
assert.match(source.htmlRevisionItem, /isSameOriginWorkspaceMutation\(request\)/, "版復元は同一originからの操作だけ受け付ける");
assert.match(source.htmlRevisionItem, /isWorkspaceDocumentSha256\(body\.expectedSha256\)/, "版復元も復元前のsha256を必須にする");
assert.match(source.htmlRevisionItem, /replaceWorkspaceHtmlSource\(\{[\s\S]*?auditAction: "restore_revision"/, "版復元は新しい保存として現物を差し替える");
assert.doesNotMatch(source.htmlRevisionItem, /\.delete\(\)|\.remove\(/, "版復元は既存の版を消さない");
assert.doesNotMatch(source.htmlRevisionItem, /createSignedUrl|signedUrl/, "版の本文取得は署名URLを返さない");
// デッキ (spec/2-8 Phase 2)。モデルが正本で、HTMLはそこからの生成物。
// 認可・現物の差し替え・版の退避は、Phase 0/1 で作った1本の経路をそのまま通す。
assert.match(source.deck, /loadEditableWorkspaceHtmlDocument\(documentId\)/, "デッキ取得・保存は本文編集と同じgateで認可する");
assert.match(source.deck, /isSameOriginWorkspaceMutation\(request\)/, "デッキ保存は同一originからの操作だけ受け付ける");
assert.match(source.deck, /normalizeWorkspaceDeck\(body\.deck/, "受け取ったモデルはserverで検査してから保存する");
assert.match(source.deck, /isWorkspaceDocumentSha256\(body\.expectedSha256\)/, "デッキ保存も編集前の版のsha256を検査する");
assert.doesNotMatch(source.deck, /createSignedUrl|signedUrl/, "デッキAPIは署名URLを返さない");
assert.doesNotMatch(source.deck, /\.upload\(|\.from\("workspace_document_decks"\)/, "route直書きでモデルを書き込まない (共有経路を通す)");

assert.match(source.deckPublish, /loadEditableWorkspaceHtmlDocument\(documentId\)/, "publishも同じgateで認可する");
assert.match(source.deckPublish, /isSameOriginWorkspaceMutation\(request\)/, "publishは同一originからの操作だけ受け付ける");
assert.match(source.deckPublish, /isWorkspaceDocumentSha256\(body\.expectedSha256\)/, "publishは公開するモデルの版を必須にする");
assert.match(source.deckPublish, /deckRow\.model_sha256 !== body\.expectedSha256[\s\S]*?409/, "見ていたモデルと違うものを公開しない");
assert.match(source.deckPublish, /publishWorkspaceDeck\(\{/, "publishは共有の生成・差し替え経路を通る");
assert.doesNotMatch(source.deckPublish, /\.upload\(|createSignedUrl/, "publish routeはStorageを直接触らない");

assert.match(source.deckGate, /replaceWorkspaceHtmlSource\(\{/, "publishの書き込みは既存の現物差し替え経路を通る");
assert.match(source.deckGate, /auditAction: "replace_html"/, "publishもHTML差し替えとして監査に残す");
assert.match(source.deckGate, /deck_action: "publish_deck"/, "何のための差し替えかをdetailへ残す");
assert.match(source.deckGate, /current\.model_sha256 !== expectedSha256[\s\S]*?status: 409/, "モデルの競合は409で止める");
assert.match(source.deckGate, /current\.model_sha256 === nextSha256[\s\S]*?unchanged: true/, "中身の変わらない保存で版を増やさない");
assert.match(source.deckGate, /archiveDeckModelRevision\(db, \{/, "上書き前のモデルを版履歴へ退避する");
assert.match(source.deckGate, /catch \(archiveError\)[\s\S]*?return \{ ok: false/, "旧版を退避できなければ上書きせず中断する");
assert.match(source.deckGate, /published_sha256: deckRow\.model_sha256/, "公開済みの印は公開したモデルのshaで持つ");
assert.match(source.deckGate, /probeWorkspaceDeckImage\(bytes\)/, "画像は名乗られたMIMEでなくバイト列で判定する");
assert.match(source.deckGate, /workspaceDeckImageExceedsMaxEdge\(probe\)/, "長辺の上限を超える画像を受け付けない");
assert.match(source.deckGate, /workspaceDeckAssetDataUri\(asset\.mime_type/, "publishの画像はdata URIで埋め込む");
assert.doesNotMatch(source.deckGate, /createSignedUrl/, "publish出力に期限付きURLを混ぜない (外部参照ゼロ)");
assert.match(source.deckGate, /missing\.length[\s\S]*?ok: false/, "参照している画像を読めないまま公開しない");
assert.match(source.deckGate, /byteLength > WORKSPACE_DOCUMENT_HTML_PREVIEW_MAX_BYTES/, "プレビュー上限を超える公開HTMLを作らない");

assert.match(source.deckAssets, /loadEditableWorkspaceHtmlDocument\(documentId\)/, "画像APIも同じgateで認可する");
assert.match(source.deckAssets, /isSameOriginWorkspaceMutation\(request\)/, "画像追加は同一originからの操作だけ受け付ける");
assert.match(source.deckAssets, /createWorkspaceDeckAsset\(\{/, "画像の登録は共有経路を通る");
assert.match(source.deckAssets, /ASSET_PREVIEW_URL_TTL_SECONDS = 60/, "編集用プレビューURLは短命にする");
assert.match(source.deckAssets, /publicWorkspaceDeckAsset\(/, "画像一覧はstorage実体のpathを外へ出さない");

// モデルとレンダラは素のNodeから読める形を保つ (契約テストが振る舞いを検査するため)。
assert.doesNotMatch(source.deckModel, /import "server-only"/, "モデルにserver-onlyを入れない");
assert.doesNotMatch(source.deckRender, /import "server-only"/, "レンダラにserver-onlyを入れない");
assert.doesNotMatch(source.deckRender, /className: "(?!deck)/, "デッキのclassはdeck接頭辞で閉じる (publish先にTailwindは無い)");
assert.match(source.deckRender, /sanitizeWorkspaceDeckRawHtml\(block\.slots\.html\)/, "rawHtmlは描画時にもサニタイズする");
assert.doesNotMatch(source.deckRender, /slide\.notes/, "発表者メモをpublish出力へ描かない");

assert.match(source.pdf, /resolveDocumentRowAccess\(db, row\)/, "HTML PDF化も資料ごとの権限を再確認する");
assert.match(source.pdf, /row\.visibility === "amd_internal" && !access\.canReadInternal/, "HTML PDF化も内部資料を404にする");
assert.match(source.pdf, /row\.entry_kind !== "file" && row\.entry_kind !== "link"/, "HTML PDF化は保存fileとDrive linkの両方を扱う");
assert.match(source.pdf, /isWorkspaceDocumentHtml\(row\.mime_type, row\.display_name\)/, "HTMLだけをPDF化する");
assert.match(source.pdf, /WORKSPACE_DOCUMENT_HTML_PDF_MAX_INPUT_BYTES/, "HTML PDF化の入力量を制限する");
assert.match(source.pdf, /WORKSPACE_DOCUMENT_HTML_PDF_MAX_OUTPUT_BYTES/, "HTML PDF化の出力量を制限する");
assert.match(source.pdf, /loadWorkspaceDocumentText\(db, row, WORKSPACE_DOCUMENT_HTML_PDF_MAX_INPUT_BYTES\)/, "HTML PDF化も共通の許可host付き本文loaderを通す");
assert.match(source.pdf, /renderWorkspaceDocumentHtmlToPdf/, "HTMLは専用の安全PDF変換を通す");
assert.match(source.pdf, /workspaceDocumentPdfCacheStoragePath\(access\.scopeKind, access\.scopeId, documentId\)/, "PDFキャッシュ先はscope単位で決定的なpathにする");
assert.match(source.pdf, /\.storage\s*\n?\s*\.from\(row\.storage_bucket[\s\S]*?\.upload\(pdfStoragePath, pdf/, "生成したPDFは既存のprivate Storageへ保存する");
assert.match(source.pdf, /createSignedUrl\(pdfStoragePath, WORKSPACE_DOCUMENT_PDF_DOWNLOAD_URL_TTL_SECONDS/, "PDF DLは短命の署名URLだけを発行する");
assert.match(source.pdf, /delivery["']?\)\s*===\s*"json"/, "PDF化routeは明示クエリでだけJSON配信を選べる");
assert.match(source.pdf, /if \(!wantsJson\) return redirectToSignedPdf\(downloadUrl\)/, "既定(クエリなし)は旧クライアント互換のため署名URLへredirectする");
assert.match(source.pdf, /NextResponse\.redirect\(signedUrl, \{ status: 302, headers: \{ "Cache-Control": "no-store" \} \}\)/, "旧クライアント向けredirectはno-storeを維持する");
assert.match(source.pdf, /downloadUrl,/, "delivery=json指定時はJSONで署名URLを返す");
assert.doesNotMatch(source.pdf, /new NextResponse\(responseBytes/, "Vercel Function responseへPDF本体を直接載せない(4.5MB body上限を避ける)");
assert.doesNotMatch(source.pdf, /Content-Type": "application\/pdf"/, "PDF本体のContent-TypeはFunction responseでなくStorage署名URLが設定する");
assert.match(source.htmlPdf, /page\.setJavaScriptEnabled\(false\)/, "HTML PDF化ではscriptを実行しない");
assert.match(source.htmlPdf, /page\.setRequestInterception\(true\)/, "HTML PDF化では外部通信を遮断する");
assert.match(source.htmlPdf, /request\.url\(\)\.startsWith\("data:"\)/, "HTML PDF化は埋込dataだけを許可する");
assert.match(source.htmlPdf, /detectResponsiveCollapse/, "HTML PDF化は狭い紙面でのレスポンシブ崩れを実測する");
assert.match(source.htmlPdf, /choosePdfContentWidthPx/, "横組みが崩れるHTMLだけは元のデスクトップ幅をPDF紙面へ使う");
assert.match(source.htmlPdf, /page\.setViewport\(\{ width: DESKTOP_PROBE_WIDTH_PX/, "PDF化前にデスクトップ幅で資料を測る");
assert.match(source.htmlPdf, /page\.setViewport\(\{ width: A4_WIDTH_PX/, "PDF化前にA4幅でも資料を測る");
assert.match(source.htmlPdf, /breakInside = "avoid"/, "比較カード・表など小さな論理ブロックをページ途中で割らない");
assert.match(source.htmlPdf, /h1, h2, h3, h4, h5, h6/, "見出しだけをページ末尾へ残さない");
assert.match(source.htmlPdf, /\.side, \.sidebar, aside, nav, \[role="navigation"\]/, "PDFには元HTMLのサイドナビを出さない");
assert.match(source.htmlPdf, /\.layout \{[\s\S]*?display: block !important;/, "サイドナビを消した時は親gridも1列へ戻して空白列を残さない");
assert.match(source.htmlPdf, /margin: \{[\s\S]*?top: PDF_PAGE_MARGIN/, "PDFの全ページに同じ余白を付ける");
assert.match(source.htmlPdf, /width: pxToInches\(pdfWidthPx\)/, "PDF紙面幅は実測した資料幅から決める");
assert.match(source.htmlPdf, /preferCSSPageSize: false/, "HTML内の固定@page指定で実測紙面幅を上書きしない");
assert.match(source.htmlPdf, /process\.cwd\(\), "node_modules", "@sparticuz", "chromium", "bin"/, "HTML PDF化はFunctionのproject rootからChromium binを確定する");
assert.match(source.htmlPdf, /chromium\.executablePath\(CHROMIUM_BIN_PATH\)/, "HTML PDF化はTurbopack上で__filenameとrequire.resolveに依存せずChromium binを渡す");
assert.match(source.htmlPdf, /process\.cwd\(\), "node_modules", "@fontsource-variable", "noto-sans-jp", "wght\.css"/, "HTML PDF化はFunctionのproject rootからNotoフォントCSSを確定する");
assert.doesNotMatch(source.htmlPdf, /require\.resolve\("@fontsource-variable\/noto-sans-jp\/wght\.css"\)/, "NotoフォントCSSはTurbopackで消えるrequire.resolveに依存しない");
assert.match(source.room, /\/render`/, "HTMLの資料名クリックは安全表示を開く");
assert.match(source.room, /async function downloadHtmlAsPdf/, "PDF化ダウンロードはfetchで失敗を検知するhandlerを持つ");
assert.match(source.room, /function workspaceDocumentViewHref[\s\S]*?isWorkspaceDocumentHtml[\s\S]*?\/render`[\s\S]*?isWorkspaceDocumentMarkdown[\s\S]*?\/workspace-document\//, "資料名クリックはHTML安全表示とMarkdown Readerへ振り分ける");
assert.match(source.room, /"PDF化ダウンロード"/, "HTMLの右端操作はPDF化ダウンロードと明示する");
assert.match(source.room, /\/pdf\?delivery=json`/, "新クライアントは明示クエリでJSON配信を要求する(既定の旧互換redirectと混同しない)");
assert.match(source.room, /!response\.ok \|\| !payload\.ok \|\| !payload\.downloadUrl/, "PDF化ダウンロードはJSON応答のok/downloadUrlを見る");
assert.doesNotMatch(source.room, /downloadHtmlAsPdf[\s\S]{0,600}response\.blob\(\)/, "PDF化ダウンロードはFunction responseをblob化しない(署名URLへ直接遷移する)");
assert.match(source.room, /item\.entryKind === "file" \|\| item\.entryKind === "link"[\s\S]*?isWorkspaceDocumentHtml/, "HTML fileとDrive linkの両方にPDF化操作を出す");
assert.match(source.room, /permissions\?\.canUpload && item\.entryKind === "file" && isWorkspaceDocumentHtml[\s\S]*?documentEditorHref/, "HTML編集導線はcanUploadで表示する");
assert.match(source.room, /function documentEditorHref[\s\S]*?\/workspace-document\/\$\{encodeURIComponent\(documentId\)\}\/edit/, "編集は資料室のモーダルではなく専用ページを開く");
assert.match(source.room, /href=\{documentEditorHref\(item\.documentId, pathname\)\}[\s\S]{0,120}target="_blank"/, "編集は別タブで開き、資料室の一覧を閉じない");
assert.doesNotMatch(source.room, /dialog === "deck_editor"|dialog === "edit_html"|dialog === "html_revisions"/, "編集UIを資料室モーダルへ戻さない(幅が潰れて使えない)");
assert.match(source.room, /subscribeWorkspaceDocumentUpdates\(\(\) => void refreshDocuments\(\)\)/, "別タブの保存を資料室一覧へ取り込む");
assert.match(source.editorPage, /loadEditableWorkspaceHtmlDocument\(/, "編集ページは表示前に編集権限を確かめる");
assert.match(source.editorPage, /recordWorkspaceAuditEvent[\s\S]{0,400}"open_editor"/, "編集ページを開いた事実を監査ログへ残す");
assert.match(source.editorPage, /function safeBackHref[\s\S]*?startsWith\("\/\/"\)/, "戻り先クエリで外部サイトへ飛ばさない");
assert.match(source.editorWorkbench, /HTMLを編集/, "編集ページはソース編集も持つ");
assert.match(source.editorWorkbench, /<WorkspaceDocumentDeckEditor/, "編集ページの既定は見たまま編集");
assert.match(source.editorWorkbench, /beforeunload/, "未保存のままタブを閉じさせない");
assert.match(source.room, /permissions\?\.canUpload && \([\s\S]*?資料室から削除/, "資料室からの削除はcanUploadで表示する");
assert.match(source.room, /資料室の通常一覧と共有画面から外す[\s\S]*?保護された保管領域に残り/, "削除確認は非破壊保管と公開停止を明示する");
assert.match(source.room, /open\?download=1/, "非HTMLの右端操作はダウンロードlinkのまま");
assert.match(source.textLoader, /ALLOWED_DRIVE_HOSTS = new Set\(\["drive\.google\.com", "docs\.google\.com"\]\)/, "Drive本文取得はGoogle Drive hostだけを許可する");
assert.match(source.textLoader, /getGoogleAuthAsync\(\)/, "Drive本文取得はserver側Google認証を使う");
assert.match(source.textLoader, /declaredSize > maxBytes[\s\S]*byteLength > maxBytes/, "Drive本文はmetadataと実byteの両方で上限判定する");
assert.match(source.markdownPage, /resolveDocumentRowAccess\(db, row\)/, "Markdown Readerも資料ごとの権限を再確認する");
assert.match(source.markdownPage, /row\.visibility === "amd_internal" && !access\.canReadInternal/, "Markdown Readerも内部資料を404にする");
assert.match(source.markdownPage, /WORKSPACE_DOCUMENT_MARKDOWN_PREVIEW_MAX_BYTES/, "Markdown Readerは本文読込量を制限する");
assert.match(source.markdownPage, /<WorkspaceMarkdownReader source=\{loaded\.text\}/, "Markdown本文は専用Readerへ渡す");
assert.match(source.markdownReader, /ReactMarkdown[\s\S]*remarkPlugins=\{\[remarkGfm\]\}/, "Markdown ReaderはGFMをレンダリングする");
assert.doesNotMatch(source.markdownPage, /Sidebar|WorkspaceDocumentRoom|Cockpit/, "Markdown Reader pageに資料室の左メニューを持ち込まない");
assert.match(source.room, /<button[\s\S]*?downloadHtmlAsPdf/, "右端のPDF化ダウンロードだけが変換handlerを呼ぶ");
assert.match(source.room, /setError\(\s*\n?\s*cause instanceof Error \? cause\.message : "PDFを生成できなかったよ。"/, "PDF化失敗はrole=alertへ日本語エラーを出し、JSON画面へは遷移しない");
assert.doesNotMatch(source.serializer.split("export function publicWorkspaceDocument")[1], /storage_path|external_url/, "一覧DTOに保存先や外部URLを含めない");
assert.doesNotMatch(source.mutate, /\.remove\(/, "archiveで実ファイルを削除しない");
assert.match(source.mutate, /body\.action === "archive"\) \{\s*if \(!access\.canUpload\)/, "archiveは整理権限でなくcanUploadに開放する");
assert.match(source.list, /workspaceDocumentDestinationStatus/, "作成時に保存先folderと共有境界を検証する");
assert.match(source.list, /findActiveWorkspaceDocumentNameConflict\(db, access, folderPath, displayName\)/, "通常追加と置き換え準備で同一folderのactive同名entryをserver再確認する");
assert.match(source.list, /const replaceDocumentId =/, "置き換えは明示replaceDocumentIdを持つupload intentだけで開始する");
assert.match(source.list, /resolveDocumentRowAccess\(db, replacement\)/, "置き換え対象はserverで資料ごとのaccessを再確認する");
assert.match(source.list, /workspaceDocumentMatchesAccess\(replacement, access\)/, "置き換え対象は同じ資料室scopeだけに固定する");
assert.match(source.list, /replacement\.entry_kind !== "file"[\s\S]*replacement\.upload_status !== "active"/, "link・folder・非active entryをファイル置き換えに使わない");
assert.match(source.list, /createSignedUploadUrl\(replacement\.storage_path, \{ upsert: true \}\)/, "明示置き換えだけ既存Storage pathのupsert署名URLを作る");
assert.match(source.list, /if \(conflict\) \{\s*return json\(\{ ok: false, error: "同じ場所に同名の資料があるよ。画面を更新して選び直してね。" \}, 409\);/s, "通常追加はrace時も同名を黙って上書きしない");
assert.match(source.mutate, /body\.action === "complete_replace"/, "置き換え完了は通常upload完了と別actionにする");
assert.match(source.mutate, /body\.action === "complete_replace"[\s\S]*?row\.upload_status !== "active"/, "置き換え完了は元fileをpending/failedへ変えずactiveのまま確認する");
assert.match(source.mutate, /content_sha256: null[\s\S]*?source_updated_at: null/, "手動置き換え後は移行時hash・更新根拠を残さない");
assert.match(source.mutate, /action: "replace_file"/, "置き換え完了は本文を含まない監査eventを残す");
assert.match(source.mutate, /workspaceDocumentDestinationStatus/, "整理時に保存先folderと共有境界を検証する");
// 2026-08-21: workspaceDocumentFolderHasSharedDescendants(真偽)は
// countWorkspaceDocumentSharedDescendants(件数)へ拡張し、確認同意(cascadeVisibility)
// があれば配下ごと一括で内部化できるようにした。真偽判定はその戻り値 > 0 に置き換え済み。
assert.match(source.mutate, /countWorkspaceDocumentSharedDescendants\(db, row\)/, "共有資料を含むfolderの内部化は影響件数を数えてから判定する");
assert.match(source.mutate, /code: "shared_descendants",\s*affected: cascadeAffected,/, "確認同意なしの内部化409は機械可読なcodeと件数を返す");
assert.match(source.mutate, /!cascadeVisibility[\s\S]{0,500}?workspace_set_folder_visibility_cascade/, "確認同意(cascadeVisibility)がなければ配下一括変更RPCを呼ばない");
assert.match(source.mutate, /action: "organize_cascade"/, "配下一括変更は専用の監査actionを残す");
assert.match(source.mutate, /if \(access\.principal === "workspace_account"\) visibility = "workspace_shared";/, "外部アカウントはvisibilityをworkspace_shared固定のまま(cascade経路でも内部化を選べない)");
assert.match(source.institutionPage, /resolveInstitutionDocumentAccess\(slug\)/, "機関資料pageはslug accessを再検証する");
assert.match(source.projectPage, /resolveProjectDocumentAccess\(projectId\)/, "PJ資料pageはproject accessを再検証する");
assert.match(source.projectPage, /access\.principal === "internal_member"[\s\S]*\/cockpit/, "内部メンバーは資料室からcockpitへ戻る");
assert.match(source.projectPage, /PJ概要へ戻る/, "外部メンバーは資料室から共有PJ概要へ戻る");
assert.match(source.institutionPage, /surface="workspace"/, "機関workspace資料室は公開面を明示する");
assert.match(source.projectPage, /surface="workspace"/, "PJ workspace資料室は公開面を明示する");
assert.match(source.sxWorkspace, /<WorkspaceDocumentRoom[\s\S]*?surface="workspace"/s, "SXドライブはworkspace面として資料室を開く");
assert.match(source.middleware, /workspace\(\?:\\\/files\)\?/, "外部workspace sessionでPJ資料室routeへ到達できる");
assert.match(source.cockpit, /aria-label="ドライブ"[\s\S]*?<WorkspaceDocumentRoom/s, "cockpitは資料一覧でなくドライブタブを置く");
assert.match(source.list, /monthly_report_internal[\s\S]*?monthly_report_submission/s, "社内版・提出版は月次報告書folderの仮想entryとして並べる");
assert.match(source.list, /surface === "cockpit" && access\.canReadInternal/, "月次帳票は内部cockpit面だけに限定する");
assert.doesNotMatch(source.list, /monthly report list failed:[\s\S]*?return json\(\{ ok: false, error: "月次報告書を読み込めなかったよ。" \}, 500\)/s, "月次帳票の補助読込失敗で既存ドライブ一覧を空にしない");
assert.match(source.room, /item\.entryKind !== "report"/, "月次帳票の仮想entryは移動・削除できない");
assert.doesNotMatch(source.cockpit, /WorkspaceDocumentLauncher/, "進捗管理タブへ資料室launcherを戻さない (2026-08-21 まさ確定)");
assert.doesNotMatch(source.cockpit, /WorkspaceDocumentSummary/, "cockpitの資料サマリ一覧を復活させない");
assert.match(source.room, /同名のファイルがあります/, "同名uploadはFinder型の確認dialogを出す");
assert.match(source.room, /中止[\s\S]*?両方残す[\s\S]*?置き換える/s, "同名dialogに中止・両方残す・置き換えるを明示する");
assert.match(source.room, /workspaceDocumentFinderCopyName/, "両方残すはFinder型の連番filenameを生成する");
assert.match(source.room, /conflictDocument\?\.entryKind === "file"/, "置き換えるbuttonは既存active fileだけに限定する");
assert.match(source.room, /upsert: prepared\.isReplacement === true/, "署名uploadのupsertは明示置き換えだけに限定する");
assert.match(source.room, /type WorkspaceDocumentSurface = "cockpit" \| "workspace"/, "資料室の表示面を明示的に分ける");
assert.match(source.room, /apiUrl\(scopeKind, scopeId, surface\)/, "資料室は表示面を一覧APIへ渡す");
assert.match(source.room, /const canManageVisibility = surface === "cockpit" && Boolean\(permissions\?\.canReadInternal\)/, "共有範囲の操作はcockpit内部面だけに閉じる");
assert.match(source.cockpit, /presentation="modal"/, "cockpitタブ内の資料室は専用presentationを使う");
assert.doesNotMatch(source.cockpit, /WorkspaceDocumentSummary|最新資料/, "cockpitで最新資料一覧を先読みしない");
assert.doesNotMatch(source.room, /ここへファイルをドロップして追加/, "細い常設のファイルdrop帯を復活させない");
assert.match(source.room, /data-testid=\{permissions\?\.canUpload && !query \? "workspace-document-list-drop-zone" : undefined\}/, "追加できる現在folderの資料一覧全体をファイルdrop先にする");
assert.match(source.room, /onDrop=\{permissions\?\.canUpload && !query \? handleDrop : undefined\}/, "資料一覧のdropも既存upload handlerを通す");
assert.match(source.room, /function handleDrop\(event: DragEvent<HTMLDivElement>\) \{\s*if \(!isExternalFileDrag\(event\)\) return;/, "内部資料の移動dragをファイルuploadとして処理しない");
assert.match(source.room, /function handleFileDragOver\(event: DragEvent<HTMLDivElement>\) \{\s*if \(!isExternalFileDrag\(event\)\) return;/, "内部資料の移動dragで資料一覧を外部file drop状態にしない");
assert.match(source.room, /function isExternalFileDrag\(event: DragEvent<HTMLElement>\)[\s\S]*?includes\("Files"\)/, "Finder/Explorerの外部file dragだけを判別する");
assert.match(source.room, /function preventExternalFileNavigation\(event: DragEvent<HTMLElement>\)[\s\S]*?isExternalFileDrag\(event\)[\s\S]*?event\.preventDefault\(\)/, "資料室内の外部file dropでブラウザ既定のopen/downloadを止める");
assert.match(source.room, /onDragOverCapture=\{preventExternalFileNavigation\}[\s\S]*?onDropCapture=\{preventExternalFileNavigation\}/, "空状態の境界を外したFinder dropも資料室内では既定遷移させない");
assert.match(source.room, /query \? "該当する資料はないよ" : "この場所はまだ空だよ"/, "検索0件と空folderの表示を分ける");

assert.match(source.room, /item\.visibility === "amd_internal"\s*\?\s*styles\.internalFolderIcon/, "AMD内部folderは専用色classでiconを分ける");
assert.match(source.room, /dialog === "create_folder" \? "PJ全体" : "外部共有"/, "folder作成dialogのworkspace_sharedラベルはPJ全体にする");
assert.match(source.room, /selected\?\.entryKind === "folder" \? "PJ全体" : "外部共有"/, "folder整理dialogのworkspace_sharedラベルはPJ全体にする");
assert.match(source.room, /entryKind === "folder"\s*\?\s*"PJ全体"\s*:\s*"外部共有"/, "folder一覧のworkspace_sharedバッジはPJ全体と表示する");
// 2026-08-21: PJ全体(workspace_shared)はfolder/file/linkのiconを既存オレンジ系色で揃える。
assert.match(source.room, /shared\s*\?\s*styles\.sharedEntryIcon/, "workspace_sharedのiconは種別を問わず専用オレンジ色classへ揃える");
// 2026-08-21: 一覧の「共有範囲」独立カラムを廃止し、バッジを資料名の直後へ移した。
assert.doesNotMatch(source.room, /<span>共有範囲<\/span>/, "共有範囲の独立列見出しは復活させない");
assert.match(source.room, /grid-cols-\[minmax\(0,1fr\)_120px_360px\]/, "一覧headerは名称\/更新\/操作の3列にする");
assert.match(source.room, /xl:grid-cols-\[minmax\(0,1fr\)_120px_360px\]/, "一覧行も同じ3列gridに揃える");
assert.match(source.room, /shrink-0 items-center rounded-full/, "資料名の直後に置くバッジは長い名前の省略で潰れない");
// 2026-08-21: フォルダ内部化がconfirmなしの409で止まったら、件数つきの確認dialogへ差し替える。
assert.match(source.room, /payload\.code === "shared_descendants"[\s\S]{0,500}?setDialog\("cascade_visibility"\)/, "409(shared_descendants)はその場のエラー表示でなく確認dialogを出す");
assert.match(source.room, /DialogTitle>フォルダの中の資料も一緒に変わります</, "確認dialogの見出しは指示書の文面を使う");
assert.match(source.room, /このフォルダには外部共有の資料が\{pendingCascade\?\.affected \?\? 0\}件あります/, "確認dialogの本文は実際の影響件数を埋め込む");
assert.match(source.room, /中の資料もまとめてAMD内部にする/, "確認dialogの承諾buttonは指示書の文面を使う");
assert.match(source.room, /cascadeVisibility: true/, "承諾後は同じPATCHをcascadeVisibility付きで再送する");
assert.match(source.room, /フォルダと中の資料 \$\{affected\} 件をAMD内部にしたよ。/, "cascade成功後は既存noticeの仕組みで件数入りの完了通知を出す");
assert.match(source.room, /href=\{workspaceDocumentViewHref\(item\)\}\s*target="_blank"/s, "資料名は外部ブラウザの別タブで開く");
assert.match(source.room, /application\/x-amd-workspace-document/, "一覧entryは資料移動用のdrag payloadを持つ");
assert.match(source.room, /onDrop=\{\(event\) => finishBreadcrumbDrop\(event, ""\)\}/, "資料直下のパンくずをdrop先にできる");
assert.match(source.room, /onDrop=\{\(event\) => finishBreadcrumbDrop\(event, path\)\}/, "上位folderのパンくずをdrop先にできる");
assert.match(source.room, /action: "organize"[\s\S]*?folderPath: destinationPath[\s\S]*?visibility: item\.visibility/s, "パンくずdropも既存の整理APIと共有範囲を通して移動する");
assert.match(source.room, /onDrop=\{\(event\) => finishFolderDrop\(event, item\)\}/, "一覧のフォルダ行そのものをdrop先にできる");
assert.match(source.room, /onDragOver=\{\(event\) => allowFolderDrop\(event, item\)\}/, "フォルダ行の上でdropを許可する");
assert.match(source.room, /function canDropIntoFolder\(folder: DocumentItem\)[\s\S]*?folder\.entryKind !== "folder"[\s\S]*?eligibleMoveTargetFor\(item, destinationPath\)/, "自分自身・配下・ファイル行へはdropさせない");
assert.match(source.room, /if \(item\.entryKind === "folder" && !eligibleMoveTargetFor\(item, destinationPath\)\)/, "移動の自己参照checkはdialogのselectedではなくdrag中のentryで判定する");
assert.match(source.room, /資料を一覧のフォルダ行か、パンくずのフォルダへドラッグすると移動できる。タッチ操作とキーボードでは各資料の整理から移動先を選ぶ。/, "dragできない操作系にも既存整理dialogの移動導線を案内する");
assert.match(source.room, /role="status"/, "移動成功は資料室内のstatus通知で分かる");
assert.match(source.mutate, /row\.folder_path === folderPath[\s\S]*?return json\(\{ ok: true, document: publicWorkspaceDocument\(row\) \}\);/s, "同じfolderへの移動はserverでもno-opにする");

// 移動・削除・追加は、まず画面へ反映してからサーバ確定を背景で待つ (5-7秒の全件再読込で止めない)。
const refreshBlock = source.room.match(/const refreshDocuments = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[/)?.[0] ?? "";
assert.ok(refreshBlock, "mutation後の同期は背景専用のrefreshDocumentsで行う");
assert.ok(!refreshBlock.includes("setLoading("), "背景同期はspinnerへ切り替えない");
assert.ok(!refreshBlock.includes("setDocuments([])"), "背景同期の失敗で一覧を空にしない");
assert.doesNotMatch(source.room, /await loadDocuments\(\)/, "mutation後にspinner付きの全件再読込へ戻さない");
assert.match(source.room, /applyLocalOrganize\(item, \{[\s\S]*?\}\);[\s\S]{0,900}?await fetch\(/, "移動は先に画面へ反映してからPATCHを投げる");
assert.match(source.room, /applyLocalArchive\(target\);\s*\n\s*setDialog\(null\);[\s\S]{0,600}?await fetch\(/, "削除は先に画面から消してdialogを閉じてからPATCHを投げる");
assert.match(source.room, /function applyLocalArchive[\s\S]*?entry\.folderPath === path \|\| entry\.folderPath\.startsWith\(/, "フォルダ削除はRPCと同じく配下ごと画面から消す");
assert.match(source.room, /function applyLocalOrganize[\s\S]*?entry\.folderPath\.slice\(oldPath\.length\)/, "フォルダ移動はRPCと同じく配下のfolderPathも書き換える");
assert.match(source.room, /setDialog\(null\);[\s\S]{0,400}?await fetch\(apiUrl/, "追加はdialogを閉じてからPOSTを投げる");
assert.ok((source.room.match(/setDocuments\(snapshot\);/g) ?? []).length >= 4, "失敗時はsnapshotへ戻す (移動・追加・整理・削除の4系統)");

assert.match(
  source.nextConfig,
  /"\/api\/workspace-documents\/\*\/pdf":\s*\[[^\]]*@fontsource-variable\/noto-sans-jp[^\]]*\]/s,
  "HTML PDF化routeはNotoフォント本体をbuildへ明示同梱する",
);
assert.match(
  source.nextConfig,
  /"\/api\/workspace-documents\/\*\/pdf":\s*\[[^\]]*@sparticuz\/chromium\/bin[^\]]*\]/s,
  "HTML PDF化routeは@sparticuz/chromiumの実行バイナリ(bin/*.br)をbuildへ明示同梱する(無いと本番でbrotli展開できずPDF生成が全滅する)",
);
assert.doesNotMatch(source.nextConfig, /workspace-documents\/\[documentId\]\/pdf\/route/, "output tracingはroute source pathでなく実行route globを使う");

console.log("workspace documents contract: ok");

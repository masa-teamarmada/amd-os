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
  htmlSource: new URL("../src/app/api/workspace-documents/[documentId]/source/route.ts", import.meta.url),
  pdf: new URL("../src/app/api/workspace-documents/[documentId]/pdf/route.ts", import.meta.url),
  htmlPdf: new URL("../src/lib/workspace-document-html-pdf.ts", import.meta.url),
  serializer: new URL("../src/lib/workspace-documents-server.ts", import.meta.url),
  middleware: new URL("../src/lib/supabase/middleware.ts", import.meta.url),
  institutionPage: new URL("../src/app/workspace/[slug]/files/page.tsx", import.meta.url),
  projectPage: new URL("../src/app/(shared-workspace)/project/[projectId]/workspace/files/page.tsx", import.meta.url),
  room: new URL("../src/components/workspace-documents/WorkspaceDocumentRoom.tsx", import.meta.url),
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
assert.match(source.list, /!access\.canReadInternal.*visibility.*workspace_shared/s, "外部一覧は共有資料だけに絞る");
assert.match(source.open, /row\.visibility === "amd_internal" && !access\.canReadInternal/, "open routeも内部資料を404にする");
assert.match(source.open, /!download && isWorkspaceDocumentHtml[\s\S]*?\/render/, "旧open URLもHTMLをブラウザ表示へ振り分ける");
assert.match(source.open, /!download && isWorkspaceDocumentMarkdown[\s\S]*?\/workspace-document\//, "旧open URLもMarkdown Readerへ振り分ける");
assert.match(source.open, /createSignedUrl\(row\.storage_path, 60/, "private fileは60秒の署名URLで開く");
assert.match(source.render, /resolveDocumentRowAccess\(db, row\)/, "HTML表示も資料ごとの権限を再確認する");
assert.match(source.render, /row\.visibility === "amd_internal" && !access\.canReadInternal/, "HTML表示も内部資料を404にする");
assert.match(source.render, /isWorkspaceDocumentHtml\(row\.mime_type, row\.display_name\)/, "HTMLだけを専用表示で返す");
assert.match(source.render, /WORKSPACE_DOCUMENT_HTML_PREVIEW_MAX_BYTES/, "HTML表示の読込量を制限する");
assert.match(source.render, /row\.entry_kind !== "file" && row\.entry_kind !== "link"/, "HTML表示は保存fileとDrive linkの両方を扱う");
assert.match(source.render, /loadWorkspaceDocumentText\(db, row, WORKSPACE_DOCUMENT_HTML_PREVIEW_MAX_BYTES\)/, "HTML表示は共通の上限付き本文loaderを通す");
assert.match(source.render, /default-src 'none';[\s\S]*sandbox/, "HTML表示はscriptを許可しないsandbox CSPを返す");
assert.match(source.render, /Content-Type": "text\/html; charset=utf-8"/, "HTML表示は正しいMIMEで返す");
assert.match(source.htmlSource, /resolveDocumentRowAccess\(db, row\)/, "HTML編集も資料ごとの権限を再確認する");
assert.match(source.htmlSource, /row\.visibility === "amd_internal" && !access\.canReadInternal/, "HTML編集も内部資料を404にする");
assert.match(source.htmlSource, /!access\.canUpload/, "HTML本文の読込・保存は追加権限を必須にする");
assert.match(source.htmlSource, /isWorkspaceDocumentHtml\(row\.mime_type, row\.display_name\)/, "HTMLだけを本文編集できる");
assert.match(source.htmlSource, /normalizeWorkspaceDocumentHtmlSource/, "HTML本文は空欄・byte上限をserverで検証する");
assert.match(source.htmlSource, /const storagePath = row\.storage_path[\s\S]*?\.upload\(storagePath, sourceBytes/, "HTML本文は既存private Storage objectへ上書きする");
assert.match(source.htmlSource, /file_size_bytes: sourceBytes\.byteLength/, "HTML保存後にサイズmetadataを更新する");
assert.match(source.htmlSource, /mime_type: mimeType/, "HTML保存後にMIME metadataを更新する");
assert.match(source.htmlSource, /updated_at: new Date\(\)\.toISOString\(\)/, "HTML保存後に更新日時を更新する");
assert.match(source.htmlSource, /action: "replace_html"/, "HTML本文の差し替えは本文なしの監査eventを残す");
assert.doesNotMatch(source.htmlSource, /createSignedUrl|signedUrl/, "HTML編集用APIは署名URLを返さない");
assert.match(source.pdf, /resolveDocumentRowAccess\(db, row\)/, "HTML PDF化も資料ごとの権限を再確認する");
assert.match(source.pdf, /row\.visibility === "amd_internal" && !access\.canReadInternal/, "HTML PDF化も内部資料を404にする");
assert.match(source.pdf, /row\.entry_kind !== "file" && row\.entry_kind !== "link"/, "HTML PDF化は保存fileとDrive linkの両方を扱う");
assert.match(source.pdf, /isWorkspaceDocumentHtml\(row\.mime_type, row\.display_name\)/, "HTMLだけをPDF化する");
assert.match(source.pdf, /WORKSPACE_DOCUMENT_HTML_PDF_MAX_INPUT_BYTES/, "HTML PDF化の入力量を制限する");
assert.match(source.pdf, /WORKSPACE_DOCUMENT_HTML_PDF_MAX_OUTPUT_BYTES/, "HTML PDF化の出力量を制限する");
assert.match(source.pdf, /loadWorkspaceDocumentText\(db, row, WORKSPACE_DOCUMENT_HTML_PDF_MAX_INPUT_BYTES\)/, "HTML PDF化も共通の許可host付き本文loaderを通す");
assert.match(source.pdf, /renderWorkspaceDocumentHtmlToPdf/, "HTMLは専用の安全PDF変換を通す");
assert.match(source.pdf, /Content-Type": "application\/pdf"/, "HTML PDF化はPDFとして返す");
assert.match(source.pdf, /Content-Disposition.*attachment/, "HTML PDF化はブラウザ表示でなく保存する");
assert.match(source.htmlPdf, /page\.setJavaScriptEnabled\(false\)/, "HTML PDF化ではscriptを実行しない");
assert.match(source.htmlPdf, /page\.setRequestInterception\(true\)/, "HTML PDF化では外部通信を遮断する");
assert.match(source.htmlPdf, /request\.url\(\)\.startsWith\("data:"\)/, "HTML PDF化は埋込dataだけを許可する");
assert.match(source.htmlPdf, /format: "A4"/, "HTML PDF化はA4で組版する");
assert.match(source.room, /\/render`/, "HTMLの資料名クリックは安全表示を開く");
assert.match(source.room, /async function downloadHtmlAsPdf/, "PDF化ダウンロードはfetchで失敗を検知するhandlerを持つ");
assert.match(source.room, /function workspaceDocumentViewHref[\s\S]*?isWorkspaceDocumentHtml[\s\S]*?\/render`[\s\S]*?isWorkspaceDocumentMarkdown[\s\S]*?\/workspace-document\//, "資料名クリックはHTML安全表示とMarkdown Readerへ振り分ける");
assert.match(source.room, /"PDF化ダウンロード"/, "HTMLの右端操作はPDF化ダウンロードと明示する");
assert.match(source.room, /item\.entryKind === "file" \|\| item\.entryKind === "link"[\s\S]*?isWorkspaceDocumentHtml/, "HTML fileとDrive linkの両方にPDF化操作を出す");
assert.match(source.room, /HTMLを編集/, "HTMLの右端操作は本文編集を明示する");
assert.match(source.room, /permissions\?\.canUpload && item\.entryKind === "file" && isWorkspaceDocumentHtml[\s\S]*?openHtmlEditor/, "HTML本文編集はcanUploadで表示する");
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
assert.match(source.mutate, /workspaceDocumentFolderHasSharedDescendants/, "共有資料を含むfolderの内部化を一括露出変更なしで止める");
assert.match(source.institutionPage, /resolveInstitutionDocumentAccess\(slug\)/, "機関資料pageはslug accessを再検証する");
assert.match(source.projectPage, /resolveProjectDocumentAccess\(projectId\)/, "PJ資料pageはproject accessを再検証する");
assert.match(source.projectPage, /access\.principal === "internal_member"[\s\S]*\/cockpit/, "内部メンバーは資料室からcockpitへ戻る");
assert.match(source.projectPage, /PJ概要へ戻る/, "外部メンバーは資料室から共有PJ概要へ戻る");
assert.match(source.middleware, /workspace\(\?:\\\/files\)\?/, "外部workspace sessionでPJ資料室routeへ到達できる");
assert.match(source.cockpit, /<WorkspaceDocumentLauncher/, "cockpitは資料一覧でなく資料室launcherを置く");
assert.doesNotMatch(source.cockpit, /WorkspaceDocumentSummary/, "cockpitの資料サマリ一覧を復活させない");
assert.match(source.room, /data-testid="workspace-document-launcher"/, "資料室launcherを操作契約として固定する");
assert.match(source.room, /同名のファイルがあります/, "同名uploadはFinder型の確認dialogを出す");
assert.match(source.room, /中止[\s\S]*?両方残す[\s\S]*?置き換える/s, "同名dialogに中止・両方残す・置き換えるを明示する");
assert.match(source.room, /workspaceDocumentFinderCopyName/, "両方残すはFinder型の連番filenameを生成する");
assert.match(source.room, /conflictDocument\?\.entryKind === "file"/, "置き換えるbuttonは既存active fileだけに限定する");
assert.match(source.room, /upsert: prepared\.isReplacement === true/, "署名uploadのupsertは明示置き換えだけに限定する");
assert.match(source.room, /data-testid="workspace-document-modal"/, "資料室はcockpit内modalで開く");
assert.match(source.room, /presentation="modal"/, "modal内の資料室は専用presentationを使う");
assert.doesNotMatch(source.room, /const latest =|slice\(0, 3\)/, "cockpit launcherで最新資料一覧を先読みしない");

assert.match(source.room, /item\.visibility === "amd_internal"\s*\?\s*styles\.internalFolderIcon/, "AMD内部folderは専用色classでiconを分ける");
assert.match(source.room, /dialog === "create_folder" \? "PJ全体" : "外部共有"/, "folder作成dialogのworkspace_sharedラベルはPJ全体にする");
assert.match(source.room, /selected\?\.entryKind === "folder" \? "PJ全体" : "外部共有"/, "folder整理dialogのworkspace_sharedラベルはPJ全体にする");
assert.match(source.room, /entryKind === "folder"\s*\?\s*"PJ全体"\s*:\s*"外部共有"/, "folder一覧のworkspace_sharedバッジはPJ全体と表示する");
assert.match(source.room, /href=\{workspaceDocumentViewHref\(item\)\}\s*target="_blank"/s, "資料名は外部ブラウザの別タブで開く");

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

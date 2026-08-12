import assert from "node:assert/strict";
import fs from "node:fs";

const kiyoPage = fs.readFileSync(new URL("../src/app/(app)/admin/kiyo/page.tsx", import.meta.url), "utf8");
const reimbursePage = fs.readFileSync(new URL("../src/app/(app)/reimburse/page.tsx", import.meta.url), "utf8");
const catalog = fs.readFileSync(new URL("../src/lib/surface-catalog.ts", import.meta.url), "utf8");
const invoicePage = fs.readFileSync(new URL("../src/app/(app)/admin/invoices/page.tsx", import.meta.url), "utf8");
const invoiceQueue = fs.readFileSync(new URL("../src/components/admin/AdminInvoiceIssueQueue.tsx", import.meta.url), "utf8");
const invoiceDialog = fs.readFileSync(new URL("../src/components/admin/AdminInvoiceIssueDialog.tsx", import.meta.url), "utf8");
const decisionRoute = fs.readFileSync(new URL("../src/app/api/reimbursements/decision/route.ts", import.meta.url), "utf8");
const decisionService = fs.readFileSync(new URL("../src/lib/reimbursement-decision.ts", import.meta.url), "utf8");
const issueInvoice = fs.readFileSync(new URL("../../ios/supabase/functions/issue-invoice/index.ts", import.meta.url), "utf8");
const reimbursementRls = fs.readFileSync(new URL("../../ios/supabase/migrations/20260812123000_lock_reimbursements_writes_to_server.sql", import.meta.url), "utf8");

assert.match(kiyoPage, /absolute: "きよ - AMD OS"/, "page titleは『きよ』に固定する");
assert.match(kiyoPage, />きよ<\/h1>/, "画面見出しは『きよ』に固定する");
assert.doesNotMatch(kiyoPage, /読み取り専用|read-only/, "きよを確認専用画面へ戻さない");

for (const task of ["reimbursements", "invoices", "payouts"]) {
  assert.match(kiyoPage, new RegExp(`id: "${task}"`), `${task} taskをきよに置く`);
  assert.match(kiyoPage, new RegExp(`/admin/kiyo\\?task=\\$\\{task\\.id\\}`), "task切替後も/admin/kiyoに留まる");
}

assert.match(kiyoPage, /<ReimburseWorkspace embedded \/>/, "立替の申請・承認UIをきよへ埋め込む");
assert.match(kiyoPage, /<AdminInvoicesPage embedded \/>/, "請求書の発行UIをきよへ埋め込む");
assert.match(kiyoPage, /<AdminPayoutsPage embedded \/>/, "メンバー支払の通知書発行・送付UIをきよへ埋め込む");
assert.match(reimbursePage, /embedded = false/, "立替画面は埋め込み時も同じwrite workflowを使う");
assert.match(catalog, /id: "admin-kiyo"[^\n]*title: "きよ"[^\n]*navLabel: "きよ"/, "adminメニュー名を『きよ』に固定する");

// 3taskはタブとして扱う（丸角カード群への回帰禁止）
assert.match(kiyoPage, /role="tablist"/, "3taskはtablistとして扱う");
assert.match(kiyoPage, /role="tab"/, "各taskはtab roleを持つ");
assert.match(kiyoPage, /aria-selected=\{selected\}/, "選択状態をaria-selectedで示す");
assert.match(kiyoPage, /role="tabpanel"/, "選択中の作業面をtabpanelとして関連付ける");
assert.match(kiyoPage, /aria-labelledby=\{`kiyo-tab-\$\{activeTask\}`\}/, "tabpanelを選択中tabへ関連付ける");
assert.doesNotMatch(kiyoPage, /rounded-lg border px-4 py-3/, "3taskをrounded-lgな個別カードへ回帰させない");
assert.doesNotMatch(kiyoPage, /grid gap-2 sm:grid-cols-3/, "3taskをカードgridへ回帰させない");
assert.doesNotMatch(kiyoPage, /rounded-lg|rounded-md|rounded-xl|shadow-/, "きよのタブ・作業面へ角丸・影を戻さない");

// PCは同じ幅3区画が隣接し縦の境界線で区切られる。選択中は上辺・左右辺を強調し下辺を作業面へ隙間ゼロでつなげる
assert.match(kiyoPage, /sm:grid sm:grid-cols-3/, "PCは3taskを同じ幅の隣接する3区画にする");
assert.match(kiyoPage, /index > 0 && "-ml-px"/, "隣接する区画の境界線を1本の縦線に重ねる");
assert.match(kiyoPage, /border-t-2 border-t-foreground/, "選択中tabは上辺を太く強調して前面タブと分かるようにする");
assert.match(kiyoPage, /border-b-background/, "選択中tabは下辺を作業面の背景色で消して前面状態にする");
assert.match(kiyoPage, /w-\[168px\] shrink-0[^"]*sm:w-full/, "mobileは固定幅168px、PCのみ3等分のw-fullに切り替える");
assert.doesNotMatch(kiyoPage, /min-w-\[168px\]/, "mobileのw-fullとmin-widthの併用でtapタブ幅が潰れる書き方へ戻さない");
assert.match(kiyoPage, /flex overflow-x-auto sm:grid/, "mobileは横スクロール1行タブを維持する");

// タブ列とtabpanelは隙間ゼロで隣接させ、選択中タブの下辺erasureが実際に作業面とつながるようにする
assert.match(
  kiyoPage,
  /<div className="mb-3">\s*<div\s*\n\s*role="tablist"/,
  "タブ列とtabpanelを囲む外側にだけmb-3を置き、タブ列自体には下マージンを付けない",
);
assert.doesNotMatch(kiyoPage, /role="tablist"[\s\S]{0,120}?className="[^"]*mb-3/, "タブ列自体にmb-3を付けてtabpanelとの間に隙間を作らない");

// 高密度dense operations UI契約: 見出し/タブ/本文の余白は4/8/12px系に収める
assert.match(kiyoPage, /mb-2/, "きよ見出し下の余白は8px系に収める");
assert.match(kiyoPage, /mb-3/, "きよタブ+作業面ブロック下の余白は12px系に収める");
assert.doesNotMatch(kiyoPage, /mb-5|mb-6/, "きよ見出し・タブの余白を20px以上に緩めない");
assert.match(kiyoPage, /min-h-11/, "タブのタップ領域は44px以上を維持する");

// admin承認済みの他メンバー分が消えて見える回帰の防止: adminだけの常設「承認済み」台帳
assert.match(reimbursePage, />承認済み</, "adminへ承認済み台帳の見出しを出す");
assert.match(reimbursePage, /approvedLedgerItems/, "status=approved\\(互換でpaidも含む\\)を一覧から拾う専用の一覧を持つ");
assert.match(reimbursePage, /status === "approved" \|\| item\.status === "paid"/, "承認済み台帳はstatus=approved\\(paidは互換\\)だけを対象にする");
assert.match(reimbursePage, /approvedLedgerTotal/, "承認済み台帳に合計金額を出す");
assert.match(reimbursePage, /\{isAdmin && \(/, "承認済み台帳はadminだけに表示する");
assert.doesNotMatch(reimbursePage, /rounded-lg|rounded-xl|shadow-/, "承認済み台帳を丸角カードや大きい集計カードにしない");

// mobile document overflow回帰の防止: 承認済み台帳の860px tableはgrid右列とsection自身にmin-w-0が無いと親を押し広げる
assert.match(reimbursePage, /<div className="min-w-0 space-y-4">/, "承認待ち/承認済み/自分の申請を束ねる右列wrapperにmin-w-0を付ける");
assert.match(reimbursePage, /<section className="min-w-0 border border-border border-l-2 border-l-emerald-500\/50 bg-card p-4">/, "承認済みsection自体にもmin-w-0を付ける");
assert.match(reimbursePage, /<div className="mt-3 max-w-full overflow-x-auto">/, "承認済み台帳のscroll boxにmax-w-fullを付けてtable幅で親を押し広げない");

// 請求判断ワークベンチ: 契約→13か月実績→全立替→権限別承認→発行を同じ面に置く
assert.match(invoiceQueue, /請求候補/, "基本額と承認済立替から請求候補を表示する");
assert.match(invoiceQueue, /この月の立替（全ステータス）/, "選択月の立替をstatusで隠さない");
assert.match(invoiceQueue, /viewerCanPmApprove[\s\S]*PM承認/, "担当PMだけにPM承認操作を出す");
assert.match(invoiceQueue, /viewerIsAdmin[\s\S]*admin承認/, "adminだけにadmin承認操作を出す");
assert.match(invoiceQueue, /pending\.length > 0/, "未承認立替が1件でもあれば月報状態に関係なくblockerを作る");
assert.match(invoiceQueue, /blockers\.length === 0 && !\["issued", "sent", "paid"\]/, "blockerが無い過去滞留は発行できる");
assert.match(invoiceQueue, /grid-cols-\[68px_78px_108px_108px_116px_104px_1fr\]/, "13か月台帳を高密度な固定列で保つ");
assert.match(invoiceQueue, /overflow-x-auto/, "狭い画面では台帳だけを横スクロールさせる");
assert.match(invoiceQueue, /aria-label="請求先PJを選択"/, "mobileは長いPJ一覧をselectへ再配置する");
assert.match(invoiceQueue, /lg:h-\[calc\(100vh-228px\)\]/, "desktopの作業面をviewport内へ収める");
assert.doesNotMatch(invoiceQueue, /rounded-full|rounded-lg|rounded-md|rounded-xl|shadow-/, "請求作業面を丸角カードやpillだらけに戻さない");
assert.doesNotMatch(invoicePage, /budget_yen/, "PJ予算を請求額の根拠にしない");
assert.match(invoicePage, /viewerPmProjectIds/, "表示中ユーザーの担当PM権限を渡す");
assert.match(invoicePage, /created_by_label/, "申請者のメールアドレスを表示用データへ直接使わない");
assert.match(invoicePage, /cycle_exists: Boolean\(c\)/, "PJ×13か月を生成しbilling cycle欠損月も隠さない");

assert.match(invoiceQueue, /\/api\/reimbursements\/decision/, "画面内承認は認証済みAPIを通す");
assert.match(decisionRoute, /requireAuth\(\)/, "画面内承認APIはPWAセッションを必須にする");
assert.match(decisionService, /\.eq\("is_pm", true\)/, "PM承認は担当PJのPM権限をサーバーで検査する");
assert.match(decisionService, /if \(!member\.is_admin\)/, "admin承認はadmin権限をサーバーで検査する");
assert.match(decisionService, /\.eq\("status", currentStatus\)|\.in\("status", Array\.from\(PM_APPROVED_STATUSES\)\)/, "状態遷移は遷移元statusを条件にして競合を拒否する");
assert.match(invoiceDialog, /\.in\("status", \["approved", "paid"\]\)/, "発行モーダルは承認済み立替だけを載せる");
assert.match(invoiceDialog, /item\.billed_ym === ym/, "発行モーダルもbilled_ym優先の月判定を使う");
assert.match(issueInvoice, /loadInvoiceReimbursements[\s\S]*invoiceBlockerMessage/, "freee発行直前に未承認と月報blockerをサーバーで再検査する");
assert.match(issueInvoice, /row\.status === "approved" \|\| row\.status === "paid"/, "実発行もapprovedとpaidを同じ立替集合として扱う");
assert.match(issueInvoice, /row\.billed_ym === ym/, "実発行もbilled_ym優先の月帰属を使う");
assert.doesNotMatch(reimbursePage, /\.from\("reimbursements"\)[\s\S]{0,120}?\.(?:update|delete)\(/, "既存立替画面からの直接writeを戻さない");
assert.match(reimbursementRls, /DROP POLICY IF EXISTS "authenticated_all"/, "全authenticated書込みpolicyを廃止する");
assert.match(reimbursementRls, /FOR SELECT TO authenticated/, "authenticated clientは読み取りだけ維持する");
assert.doesNotMatch(reimbursementRls, /FOR ALL/, "authenticated全員への無条件write policyを戻さない");
assert.match(reimbursementRls, /FOR UPDATE TO authenticated[\s\S]*created_by[\s\S]*status = 'submitted'[\s\S]*pm_approved_by IS NULL/, "本人のsubmitted編集だけを許可し承認metadataを拒否する");
assert.doesNotMatch(reimbursementRls, /status\s+IN\s*\([^)]*approved/i, "RLS経由の承認遷移を許可しない");

console.log("admin kiyo workspace contract: ok");

#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const headings = [
  "概要",
  "今月進んだこと",
  "重要な判断・合意",
  "顧客・共同研究・外部関係者の動き",
  "技術・知財・実験・資料",
  "リスク・未確定事項",
  "来月の焦点",
  "根拠",
];

function report(overrides = {}) {
  const defaults = {
    概要: "当月は認定制度の運用設計が進み、規程本則と審査実務の役割分担を整理した。並行して研究シーズの事業化支援を進め、顧客課題と初期実証の論点を絞り込んだ。認定委員会は大学としてのリスク確認を中心に扱い、事業性の優先順位とは分ける方針を置いた。次月は運用資料を完成させ、個別シーズの検証計画へ接続する。",
    今月進んだこと: "制度設計では、認定規程、委員会運営、支援判断を別々の文書で扱う構成を整理した。規程本則には制度の原則を置き、審査時の確認事項は内規とチェックリスト、申請から認定後支援までの手順は業務フローで示す方針とした。これにより、委員会が何を判断し、関係部署へ何を照会するかを具体化できる段階まで進んだ。\n\n研究シーズ支援では、対象技術の顧客課題、利用場面、必要データ、資金計画を一体で確認した。技術の新規性だけで評価せず、小規模実証と初期売上へつながる検証順序を設計し、公的資金を組み合わせながら事業仮説を磨く方針を整理した。\n\n外部連携では、広域支援制度の事務連絡と、個別案件の支援に利用できる情報を分けた。期限付きの提出事項は担当と経路を確認し、制度設計の参考情報は当月の意思決定へ直接混ぜず、次回協議の材料として保持した。",
    "重要な判断・合意": "認定委員会は事業性を点数評価して案件を落とす場とせず、大学として許容できないリスクがないかを確認する場とする。支援対象の優先順位は別の運用判断として扱う。",
    "顧客・共同研究・外部関係者の動き": "大学側とは認定制度の審査範囲と関係部署への照会方法を協議した。研究者とは技術データ、用途候補、事業への関与方法を確認し、次回までの検討事項を共有した。",
    "技術・知財・実験・資料": "認定委員会内規、審査チェックリスト、業務フロー図の役割を分けて整備した。研究シーズについては実測データと知財状況を確認し、用途別の実証計画へ落とすための資料を作成した。",
    "リスク・未確定事項": "審査時の関係部署照会と利益相反手続きは、既存規程との接続が未確定である。研究シーズは顧客課題と実証条件の確認が残っており、事業化方式を確定する段階にはない。",
    "来月の焦点": "内規、チェックリスト、業務フロー図を同じ申請案件で通し、判断の重複と抜けを確認する。研究シーズは用途候補を絞り、必要な技術データと小規模実証の条件を整理する。",
    根拠: "- 7月7日 定例打合せ「認定委員会の運用設計」\n- 7月13日 学内ピッチ審査\n- 7月21日 定例打合せ「内規とチェックリストの確認」",
  };
  return headings.map((heading) => `## ${heading}\n${overrides[heading] || defaults[heading]}`).join("\n\n");
}

function validate(content, field = "draft_content") {
  const dir = mkdtempSync(path.join(tmpdir(), "amd-os-monthly-quality-"));
  const file = path.join(dir, "input.json");
  writeFileSync(file, JSON.stringify({ monthlyReports: [{ project_id: "p25", ym: "202607", [field]: content }] }));
  try {
    const stdout = execFileSync(process.execPath, ["scripts/ms_progress_review_tool.mjs", "validate-monthly-report", "--file", file], {
      cwd: path.resolve(import.meta.dirname, ".."),
      encoding: "utf8",
    });
    return JSON.parse(stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function externalReport({ short = false } = {}) {
  const sections = [
    "1. 業務概要",
    "2. 当月の実施内容",
    "3. 第一領域：規程策定支援",
    "4. 第二領域：起業シーズ掘り起こし",
    "5. 第三領域：自治体等との連携・ファンド形成",
    "6. 体制および打合せ実施記録",
    "7. 主要成果物",
    "8. その他活動",
    "9. 来月以降の予定",
  ];
  const paragraph = short ? "実施内容を整理した。" : "当月の証跡を業務領域ごとに統合し、経緯、実施内容、判断、未確定事項、次の工程が連続して理解できる報告文として整理した。".repeat(8);
  return [
    "# 月次業務報告書",
    "| 項目 | 内容 |\n|---|---|\n| 件名 | 月次業務報告書 |",
    ...sections.map((section, index) => `## ${section}\n\n${paragraph}\n\n${index === 1 || index === 5 ? "| 項目 | 内容 |\n|---|---|\n| 実施 | 完了 |" : ""}`),
    "以上のとおり報告する。",
  ].join("\n\n");
}

function validateExternal(content, { reference = "", formatSeedApproved = false } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "amd-os-monthly-external-quality-"));
  const file = path.join(dir, "input.json");
  writeFileSync(file, JSON.stringify({
    monthlyReportsExternal: [{
      project_id: "p25",
      ym: "2026-07",
      body_md: content,
      reference_project_id: "p25",
      reference_ym: "2026-06",
      reference_body_md: reference,
      format_seed_approved: formatSeedApproved,
    }],
  }));
  try {
    const stdout = execFileSync(process.execPath, ["scripts/ms_progress_review_tool.mjs", "validate-monthly-report-external", "--file", file], {
      cwd: path.resolve(import.meta.dirname, ".."),
      encoding: "utf8",
    });
    return JSON.parse(stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function sxReport(month) {
  const previous = month === 6;
  const monthLabel = `${month}月`;
  const closingDate = previous ? "6月30日時点" : "7月31日時点";
  const prose = `当月は技術経営と事業開発の各業務項目について、確認済みの事実、到達点、継続課題を整理した。${monthLabel}の事実だけを記載し、判断済みの事項と協議中の事項を分けている。`.repeat(12);
  return [
    "# 月次業務報告書",
    `| 項目 | 内容 |\n|---|---|\n| 件名 | SX月次業務報告書 |\n| 提出先 | 愛媛大学 御中 |\n| 提出者 | 株式会社チームアルマダ |\n| 作成日 | 2026年${month}月30日 |\n| 対象期間 | 2026年${month}月1日〜2026年${month}月30日 |\n| 契約期間 | 2026年6月1日〜2027年3月31日 |`,
    `本報告は、業務委託契約に基づく当月実施内容を仕様書記載の業務項目順に取りまとめたものである。${prose}`,
    `## ①技術経営\n\n| 業務項目 | 当月の対応内容 |\n|---|---|\n| PoCプロトコル設計 | ${prose} |\n| 想定顧客ヒアリング | ${prose} |\n| 関連法令調査 | ${prose} |\n| 知財戦略策定 | ${prose} |\n| スケールコスト試算 | ${prose} |\n| 開発計画策定支援 | ${prose} |`,
    `## ②事業開発\n\n| 業務項目 | 当月の対応内容 |\n|---|---|\n| 事業計画更新 | ${prose} |\n| 資本政策策定 | ${prose} |\n| アタックリスト・ピッチデッキ作成 | ${prose} |\n| 登記事項決定 | ${prose} |\n| ファクトブック作成 | ${prose} |\n| VC面談対応 | ${prose} |\n| DD対応・条件交渉 | ${prose} |`,
    `## 主な対外連携の方針整理\n\n${prose}`,
    `## 主要な打合せ実施記録\n\n| 日時 | 打合せ名 | 形式 |\n|---|---|---|\n| ${monthLabel}10日 | 定例打合せ | オンライン |`,
    `## 主要成果物\n\n| 提示・共有日 | 成果物名 |\n|---|---|\n| ${monthLabel}20日 | 当月資料 |`,
    `## 来月以降の予定\n\n| 項目 | ${closingDate} |\n|---|---|\n| 継続業務 | ${prose} |\n\n${prose}`,
    "以上のとおり報告する。",
  ].join("\n\n");
}

const validInternal = validate(report());
assert.equal(validInternal.ok, true, `8見出しで事実を業務領域へ統合した本文は通る: ${JSON.stringify(validInternal)}`);
assert.equal(validate(report({ 概要: "既存draft生成後にL2件数を確認した。" })).ok, false, "生成作業ログ入り概要は落ちる");
assert.equal(validate(report({ 今月進んだこと: "決定/確認: 生データを貼った。" })).ok, false, "生の決定行は落ちる");
assert.equal(validate(report({ "重要な判断・合意": "判断を途中まで書いた…" })).ok, false, "省略された本文は落ちる");
assert.equal(validate(report({ "技術・知財・実験・資料": "研究費申請に必要なeLADへの入力項目を確認し、担当と提出経路を整理した。" })).ok, true, "eLADはe-Radへ正規化して通る");
assert.equal(validate(report({ 概要: "進捗を整理した。判断を整理した。次月を整理した。" })).ok, false, "短く中身のない概要は落ちる");
assert.equal(validate(report({ 今月進んだこと: "- 7月7日 会議を実施した。\n- 7月13日 会議を実施した。\n- 7月21日 会議を実施した。" })).ok, false, "会議ログだけの進捗は落ちる");
assert.equal(validate(report({ 根拠: "- https://example.com/source?id=meeting-1" })).ok, false, "根拠欄の内部URLとIDは落ちる");

const duplicate = `${report()}\n\n## 概要\n重複。`;
assert.equal(validate(duplicate, "final_content").ok, false, "見出し重複はfinal_contentでも落ちる");
assert.equal(validateExternal(externalReport(), { formatSeedApproved: true }).ok, true, "人が承認した初回seedは通る");
assert.equal(validateExternal(externalReport({ short: true }), { formatSeedApproved: true }).ok, false, "短い要約だけの提出版は落ちる");
assert.equal(validateExternal(externalReport()).ok, false, "直前月referenceもseed承認もない提出版は落ちる");

const sxJuneReference = sxReport(6);
const sxJulySameFormat = validateExternal(sxReport(7), { reference: sxJuneReference });
assert.equal(sxJulySameFormat.ok, true, `SXは日付と当月内容を更新しても6月の構造を継承すれば通る: ${JSON.stringify(sxJulySameFormat)}`);
assert.equal(sxJulySameFormat.results[0].formatMatch, true, "前月と同じSX構造はformatMatch=trueになる");
const sxJulyKuteFormat = validateExternal(externalReport(), { reference: sxJuneReference });
assert.equal(sxJulyKuteFormat.ok, false, "SXをKUTE型の共通章立てへ変更すると落ちる");
assert.equal(sxJulyKuteFormat.results[0].formatMatch, false, "前月と違うPJ形式はformatMatch=falseになる");

const printClient = readFileSync(new URL("../src/app/(app)/project/[projectId]/report/[ym]/print/print-client.tsx", import.meta.url), "utf8");
const printRoute = readFileSync(new URL("../src/app/api/project/monthly-report-print/route.ts", import.meta.url), "utf8");
const monthlyModal = readFileSync(new URL("../src/components/cockpit/CockpitMonthlyModal.tsx", import.meta.url), "utf8");
const paidGenerateRoute = readFileSync(new URL("../src/app/api/report/generate/route.ts", import.meta.url), "utf8");
const paidEditRoute = readFileSync(new URL("../src/app/api/monthly-report/edit-by-tsukuyomi/route.ts", import.meta.url), "utf8");
const manualUpdateRoute = readFileSync(new URL("../src/app/api/monthly-report/manual-update/route.ts", import.meta.url), "utf8");
const externalManualUpdateRoute = readFileSync(new URL("../src/app/api/monthly-report/external-manual-update/route.ts", import.meta.url), "utf8");
const reportFixRoute = readFileSync(new URL("../src/app/api/report/fix/route.ts", import.meta.url), "utf8");
const monthEndRoutine = readFileSync(new URL("../scheduled-tasks/amd-os-l2-monthend-evidence/SKILL.md", import.meta.url), "utf8");
const monthlyReportRoutine = readFileSync(new URL("../scheduled-tasks/amd-os-l2m1-monthly-report/SKILL.md", import.meta.url), "utf8");
const kakuReport = readFileSync(new URL("../scheduled-tasks/shared/kaku-report/SKILL.md", import.meta.url), "utf8");
assert.match(printClient, /isMarkdownTableSeparator/, "提出版のMarkdown表を構造化して描画する");
assert.match(printClient, /className="md-table"/, "提出版の表に印刷用スタイル契約がある");
assert.match(printClient, /replace\(\/\^#\\s\+月次業務報告書/, "帳票タイトルと本文H1を二重表示しない");
assert.match(printClient, /function SubmissionReport/, "提出版は実提出書式専用の連続文書コンポーネントを使う");
assert.match(printClient, /function InlineMarkdownReview/, "両版の本文を紙面上のブロック単位で編集する");
assert.match(printClient, /report-editable-block/, "編集対象の位置を紙面上で特定できる");
assert.match(printClient, /sourceWithReportHeading/, "保存時に帳票見出しを失わない");
assert.match(printClient, /<SubmissionReport reportBody=\{reportBody\}/, "提出版も紙面上の編集部品を使う");
assert.match(printClient, /<CoverPage data=\{previewData\} \/>[\s\S]*<AppendixSection data=\{previewData\} \/>/, "社内版の既存リッチ帳票構成は維持する");
assert.match(printClient, /\.submission-sheet \{[\s\S]*page-break-after: auto; break-after: auto;/, "提出版は章ごとの強制改頁を入れない");
assert.match(printClient, /\.submission-sheet \.md-body h2/, "提出版の章見出しに専用の視覚階層がある");
assert.match(printRoute, /は\|が\|を\|も\|へ\|の\|から\|より/, "提出版氏名置換は所有の助詞「の」も扱う");
assert.match(printRoute, /A-Za-z0-9/, "提出版氏名置換は助詞直後が英数字でも扱う");
assert.match(printRoute, /"submission"/, "提出版は全PJ共通のtemplateキーを受け付ける");
assert.match(printRoute, /monthly_reports_external/, "提出版は対外版テーブルを正本にする");
assert.doesNotMatch(printRoute, /fallbackBody\s*=\s*repRes\.data\?\.(?:final_content|draft_content)/, "提出版が未生成でも社内版へフォールバックしない");
assert.match(printRoute, /usingSubmissionFallback:\s*false/, "提出版フォールバックは互換フィールド上も無効にする");
assert.match(monthlyModal, /SUBMISSION_TEMPLATE = "submission"/, "月次モーダルは提出先名を操作ラベルへ持ち込まない");
assert.doesNotMatch(monthlyModal, /NIMS提出版|愛媛大提出版|工学院提出版|社内版を編集|社内版プレビュー/, "月次モーダルに提出先別・操作混在ラベルを残さない");
assert.doesNotMatch(monthlyModal, /報告書を生成|再生成|修正指示/, "月次モーダルから従量課金の生成導線を除く");
assert.match(monthlyModal, /社内版を確認・編集/, "社内版の確認と編集を一つの入口にする");
assert.match(monthlyModal, /提出版を確認・編集/, "提出版の確認と編集を一つの入口にする");
assert.doesNotMatch(monthlyModal, /本文を編集|提出版を編集|SubmissionReportEditor/, "モーダルに別経路の本文編集導線を残さない");
assert.doesNotMatch(paidGenerateRoute, /@anthropic-ai\/sdk|anthropic\.messages\.create/, "旧生成APIはAnthropicを呼ばない");
assert.match(paidGenerateRoute, /PAID_REPORT_GENERATION_DISABLED/, "旧生成APIは410で停止理由を返す");
assert.doesNotMatch(paidEditRoute, /@anthropic-ai\/sdk|anthropic\.messages\.create/, "旧AI修正APIはAnthropicを呼ばない");
assert.match(paidEditRoute, /PAID_REPORT_EDIT_DISABLED/, "旧AI修正APIは410で停止理由を返す");
assert.match(manualUpdateRoute, /validateInternalMonthlyReport/, "直接編集は保存前に社内版品質ゲートを通す");
assert.match(manualUpdateRoute, /existing\?\.final_content/, "下書き保存は確定済みの社内版ステータスを崩さない");
assert.match(reportFixRoute, /validateInternalMonthlyReport/, "確定時も社内版品質ゲートを通す");
assert.match(reportFixRoute, /force/, "既存の確定版を置き換えるには明示操作を要求する");
assert.match(externalManualUpdateRoute, /requireAdmin/, "提出版の手動編集は管理者だけが行う");
assert.match(externalManualUpdateRoute, /monthly_reports_external/, "提出版の手動編集は対外版の正本へ保存する");
assert.match(externalManualUpdateRoute, /validateSubmission/, "提出版の手動編集も提出用の構成品質を検査する");
assert.match(externalManualUpdateRoute, /previousExternalYm/, "提出版の手動編集も同じPJの直前月を取得する");
assert.match(externalManualUpdateRoute, /compareSubmissionStructure/, "提出版の手動編集も前月構造を比較する");
assert.match(externalManualUpdateRoute, /allowFormatChange/, "提出版の構造変更は明示承認を要求する");
assert.match(externalManualUpdateRoute, /findJargon/, "提出版の手動編集は内部用語を保存前に検査する");
assert.match(monthEndRoutine, /Fable 5 固定/, "月末routineはFable 5固定を正本化する");
assert.match(monthEndRoutine, /従量課金API/, "月末routineは従量課金APIへのフォールバックを禁止する");
assert.match(monthEndRoutine, /subagent、workflow、並列エージェントを起動しない/, "月末routineは別エージェントへ生成を逃がさない");
assert.match(monthlyReportRoutine, /shared\/kaku-report\/SKILL\.md/, "M-1はリポジトリ内のkaku-reportを必読にする");
assert.match(monthlyReportRoutine, /概要[\s\S]*3〜5文/, "M-1は提出前に概要の役割を固定する");
assert.match(monthlyReportRoutine, /同じPJの直前月実提出版/, "M-1提出版はPJ別の前月実提出書式を正本にする");
assert.match(monthlyReportRoutine, /formatMatch=true/, "M-1提出版は前月構造一致を保存条件にする");
assert.match(monthlyReportRoutine, /format_seed_approved=true[^\n]*force=true/, "M-1 routineはseed承認や既存版強制上書きを行わない");
assert.match(kakuReport, /監査情報は本文の材料にしない/, "routineから読めるkaku-reportにも監査情報分離を保持する");

console.log("monthly report quality guard: ok");

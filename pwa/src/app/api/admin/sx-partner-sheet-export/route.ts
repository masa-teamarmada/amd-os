/**
 * GET /api/admin/sx-partner-sheet-export?spreadsheetId=...&projectId=p21&tab=...&audience=external&dryRun=1
 *   Authorization: Bearer $CRON_SECRET
 *
 * AMD OS の関係先リスト (project_management_partners) を Google スプレッドシートへ書き出す。
 * 正本は AMD OS 側。このシートは外部共有用の読み取り面であり、シート側の編集はOSへ戻らない。
 *
 * 列は PWA の関係先リスト (SxPartnerPipeline の PARTNER_LEDGER_COLUMNS) に合わせる。
 * 画面のセルが複数の値を重ねている箇所 (次回面談・排液・接点の経緯) だけ、
 * スプシでは絞り込みできるよう列へ展開する。
 *
 * audience:
 *   external (既定) — VC分類と excludeSlugs を除いた外部共有向け。
 *   internal        — OS と同じ全件。
 *
 * 必要 env: GOOGLE_OAUTH_* (Vercel production にセット済) + SUPABASE_SERVICE_ROLE_KEY
 */

import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getGoogleAuthAsync } from "@/lib/sources/google";
import { getSxManagementBundle, type SxManagementPartner } from "@/lib/sx-management";
import {
  SX_MEETING_MODE_LABEL,
  sxComparePartnersForPoc,
  sxCompactPartnerRowText,
  sxPartnerActivityStateLabel,
  sxPartnerClassificationLabel,
  sxPartnerPrimaryIntervention,
  sxPartnerStageLabel,
  sxPocPriorityTier,
  sxPocPriorityTierLabel,
} from "@/lib/sx-partner-progress";
import { sxNormalizePublicName } from "@/lib/sx-name-normalize";
import { nominalizeSxNextActionLabel } from "@/lib/sx-action-label";

export const maxDuration = 60;

/** 資金調達側・内部プレースホルダーなど、外部共有の関係先リストに載せない slug。 */
const DEFAULT_EXCLUDE_SLUGS = ["smbc", "ewir-candidate-a"];

const CONFIDENCE_LABEL: Record<string, string> = {
  high: "確認済み",
  medium: "推定",
  low: "要確認",
  unknown: "未確認",
};

/** sx-visual-shared.tsx の同名関数と同じ契約 (あちらは client component 側の正本)。 */
function formatDueDateWithPrecision(dueDate: string | null, precision: string) {
  if (precision === "unknown" || !dueDate) return "期限未設定";
  const [year, month] = dueDate.slice(0, 7).split("-");
  if (precision === "month") return `${year}年${Number(month)}月（日付未確認）`;
  const day = dueDate.slice(8, 10);
  return `${year}/${Number(month)}/${Number(day)}`;
}

function formatDate(value: string | null) {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${year}/${Number(month)}/${Number(day)}`;
}

/**
 * 内部運用の注記を落とす。value_note には「（2026-08-06 えいみ判断）」のような
 * 記入者タグが混ざるが、対外資料に内部運用語を出さない (AGENTS.common)。
 */
function stripInternalAnnotations(value: string | null): string {
  if (!value) return "";
  return value
    .replace(/[（(]\d{4}-\d{2}-\d{2}\s*(えいみ|amie)[^）)]*[）)]/g, "")
    .replace(/[（(](えいみ|amie)[^）)]*[）)]/g, "")
    .trim();
}

const COLUMNS: Array<{ header: string; width: number; note?: string }> = [
  { header: "評価", width: 56 },
  { header: "評価の根拠", width: 300 },
  { header: "関係先", width: 220 },
  { header: "分類", width: 120 },
  { header: "段階", width: 96 },
  { header: "活動状態", width: 96 },
  { header: "ゴール", width: 200 },
  { header: "次にやること", width: 260 },
  { header: "次回面談", width: 150 },
  { header: "面談の着地点", width: 200 },
  { header: "面談で準備するもの", width: 200 },
  { header: "期限", width: 130 },
  { header: "排液の成分", width: 300 },
  { header: "年間排出量", width: 120 },
  { header: "年間処理費用", width: 120 },
  { header: "分析・実験でわかったこと", width: 260 },
  { header: "排液調達", width: 84 },
  { header: "紹介ルート", width: 130 },
  { header: "接点の経緯", width: 220 },
  { header: "直近接触日", width: 100 },
  { header: "情報の確度", width: 90 },
  { header: "最終確認日", width: 100 },
];

function buildRow(partner: SxManagementPartner, today: string): string[] {
  const intervention = sxPartnerPrimaryIntervention(partner, today);
  const actionText = sxCompactPartnerRowText(
    nominalizeSxNextActionLabel(sxNormalizePublicName(intervention.title)),
    partner.name,
  );
  const receivedSamples = partner.samples.filter(
    (sample) =>
      sample.status === "received" ||
      sample.status === "analyzed" ||
      sample.receivedOn != null,
  ).length;
  const procured = partner.effluentProcured ?? receivedSamples > 0;
  const meetingDate = partner.nextMeetingOn
    ? `${formatDate(partner.nextMeetingOn)}${partner.nextMeetingTime ? ` ${partner.nextMeetingTime}` : ""}`
    : "";
  const meetingWhere = [
    partner.nextMeetingMode ? SX_MEETING_MODE_LABEL[partner.nextMeetingMode] : null,
    partner.nextMeetingPlace,
  ]
    .filter(Boolean)
    .join(" ・ ");

  return [
    sxPocPriorityTierLabel(sxPocPriorityTier(partner)),
    stripInternalAnnotations(partner.valueNote),
    partner.name,
    partner.classifications.map(sxPartnerClassificationLabel).join("・"),
    sxPartnerStageLabel(partner.relationshipStage),
    sxPartnerActivityStateLabel(partner.activityState),
    partner.targetState ? sxNormalizePublicName(partner.targetState) : "",
    actionText,
    [meetingDate, meetingWhere].filter(Boolean).join(" / "),
    partner.nextMeetingGoal || "",
    partner.nextMeetingPrep || "",
    formatDueDateWithPrecision(intervention.dueDate, intervention.dueDatePrecision),
    partner.effluentComponents || "",
    partner.effluentVolumeAnnual || "",
    partner.effluentCostAnnual || "",
    partner.effluentTestResult || "",
    procured ? "調達済み" : "",
    partner.introducerLabel || "",
    partner.connectionContext || "",
    formatDate(partner.lastContactDate),
    CONFIDENCE_LABEL[partner.confidence] || "未確認",
    formatDate(partner.lastVerifiedAt),
  ];
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const spreadsheetId = searchParams.get("spreadsheetId");
  if (!spreadsheetId) {
    return NextResponse.json({ error: "spreadsheetId required" }, { status: 400 });
  }
  const projectId = searchParams.get("projectId") || "p21";
  const tabTitle = searchParams.get("tab") || "関係先リスト（AMD OS 同期）";
  const audience = searchParams.get("audience") === "internal" ? "internal" : "external";
  const dryRun = searchParams.get("dryRun") === "1";
  const excludeSlugs = (searchParams.get("excludeSlugs") ?? DEFAULT_EXCLUDE_SLUGS.join(","))
    .split(",")
    .map((slug) => slug.trim())
    .filter(Boolean);
  const renameTab = searchParams.get("renameTab");
  const renameTabTo = searchParams.get("renameTabTo");

  const bundle = await getSxManagementBundle(projectId, true);
  const today = bundle.asOf;

  const excluded: Array<{ name: string; reason: string }> = [];
  const partners = bundle.partners.filter((partner) => {
    if (audience === "internal") return true;
    if (partner.classifications.includes("vc")) {
      excluded.push({ name: partner.name, reason: "VC（資金調達側）" });
      return false;
    }
    if (excludeSlugs.includes(partner.slug)) {
      excluded.push({ name: partner.name, reason: "除外指定" });
      return false;
    }
    return true;
  });
  partners.sort((left, right) => sxComparePartnersForPoc(left, right, today, "priority"));

  const stamp = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
  const metaRow = [
    `SX 関係先リスト（AMD OS 同期）｜情報の基準時点 ${stamp} JST｜${partners.length}件｜正本はAMD OS。このシートは読み取り用で、編集してもOSへは戻りません。`,
  ];
  const values = [metaRow, COLUMNS.map((column) => column.header), ...partners.map((partner) => buildRow(partner, today))];

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      projectId,
      audience,
      tabTitle,
      rowCount: partners.length,
      excluded,
      preview: values.slice(0, 5),
    });
  }

  const auth = await getGoogleAuthAsync();
  if (!auth) {
    return NextResponse.json({ error: "GOOGLE_OAUTH_* env が未設定" }, { status: 500 });
  }
  const sheets = google.sheets({ version: "v4", auth });

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTabs = (meta.data.sheets ?? []).map((sheet) => ({
    title: sheet.properties?.title ?? "",
    sheetId: sheet.properties?.sheetId ?? 0,
  }));
  let target = existingTabs.find((tab) => tab.title === tabTitle);

  if (!target) {
    const created = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: tabTitle,
                index: 0,
                gridProperties: {
                  rowCount: Math.max(values.length + 20, 100),
                  columnCount: COLUMNS.length,
                  frozenRowCount: 2,
                },
              },
            },
          },
        ],
      },
    });
    const props = created.data.replies?.[0]?.addSheet?.properties;
    target = { title: props?.title ?? tabTitle, sheetId: props?.sheetId ?? 0 };
  } else {
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `'${tabTitle}'!A1:ZZ2000`,
    });
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tabTitle}'!A1`,
    valueInputOption: "RAW",
    requestBody: { values },
  });

  const sheetId = target.sheetId;
  const requests: object[] = [
    {
      updateSheetProperties: {
        properties: { sheetId, index: 0, gridProperties: { frozenRowCount: 2 } },
        fields: "index,gridProperties.frozenRowCount",
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, fontSize: 10 },
            backgroundColor: { red: 0.94, green: 0.96, blue: 0.99 },
            wrapStrategy: "CLIP",
          },
        },
        fields: "userEnteredFormat(textFormat,backgroundColor,wrapStrategy)",
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 2 },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, fontSize: 10 },
            backgroundColor: { red: 0.89, green: 0.91, blue: 0.94 },
            verticalAlignment: "MIDDLE",
            wrapStrategy: "WRAP",
          },
        },
        fields: "userEnteredFormat(textFormat,backgroundColor,verticalAlignment,wrapStrategy)",
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 2, endRowIndex: values.length },
        cell: {
          userEnteredFormat: {
            textFormat: { fontSize: 10 },
            verticalAlignment: "TOP",
            wrapStrategy: "WRAP",
          },
        },
        fields: "userEnteredFormat(textFormat,verticalAlignment,wrapStrategy)",
      },
    },
    // 評価列だけは中央寄せ。記号1文字なので左寄せだと行の頭が読みにくい。
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 2, endRowIndex: values.length, startColumnIndex: 0, endColumnIndex: 1 },
        cell: {
          userEnteredFormat: { horizontalAlignment: "CENTER", textFormat: { bold: true, fontSize: 10 } },
        },
        fields: "userEnteredFormat(horizontalAlignment,textFormat)",
      },
    },
    ...COLUMNS.map((column, index) => ({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: index, endIndex: index + 1 },
        properties: { pixelSize: column.width },
        fields: "pixelSize",
      },
    })),
    {
      setBasicFilter: {
        filter: {
          range: {
            sheetId,
            startRowIndex: 1,
            endRowIndex: values.length,
            startColumnIndex: 0,
            endColumnIndex: COLUMNS.length,
          },
        },
      },
    },
  ];

  if (renameTab && renameTabTo) {
    const victim = existingTabs.find((tab) => tab.title === renameTab);
    if (victim) {
      requests.push({
        updateSheetProperties: {
          properties: { sheetId: victim.sheetId, title: renameTabTo },
          fields: "title",
        },
      });
    }
  }

  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });

  return NextResponse.json({
    ok: true,
    projectId,
    audience,
    tabTitle,
    sheetId,
    rowCount: partners.length,
    excluded,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheetId}`,
  });
}

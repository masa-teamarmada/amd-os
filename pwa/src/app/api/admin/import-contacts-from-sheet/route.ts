/**
 * AMD VC リスト (Google Sheet) からコンタクト履歴 + 担当者を一括投入する。
 *
 * 入力: POST { sheet_text: "..." } (Drive MCP 等で取得した plain text representation)
 *
 * 処理:
 *   - Claude に sheet_text を解析させ、PJ × VC × 担当者 × ステータスの構造化 JSON を生成
 *   - 既知 VC name と fuzzy match (alias map で略称を解決)
 *   - vc_contacts (担当者) + project_vc_relations (PJ × VC × ステータス) を upsert
 */

import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;
export const runtime = "nodejs";

interface ParsedContact {
  vc_name_in_sheet: string;          // しートに書かれた表記
  pj_short: string;                   // tiem / KT / CTB / LST / JC / BWE / YD / CX / SX / MC / r3kt / SE / OPT
  contact_names?: string[];           // 担当者名 (複数の可能性)
  status?: "not_contacted" | "pitching" | "evaluating" | "dd" | "term_sheet" | "invested" | "passed" | "declined";
  ticket_size_memo?: string;
  general_memo?: string;
}

// シート上の略称 → vcs.name マッピング (alias)
const VC_ALIAS_MAP: Record<string, string> = {
  // (sheet 内表記) : (DB の name)
  "ANRI": "ANRI",
  "abies": "Abies Ventures",
  "Abies": "Abies Ventures",
  "Beyond Next": "Beyond Next Ventures",
  "BNV": "Beyond Next Ventures",
  "UTEC": "UTEC（東京大学エッジキャピタルパートナーズ）",
  "UTokyo IPC": "UTokyo IPC（東京大学協創プラットフォーム開発）",
  "UTIPC": "UTokyo IPC（東京大学協創プラットフォーム開発）",
  "UMI": "Universal Materials Incubator",
  "リアルテックファンド": "UntroD Capital Japan（旧リアルテックホールディングス）",
  "RTF": "UntroD Capital Japan（旧リアルテックホールディングス）",
  "RTH": "UntroD Capital Japan（旧リアルテックホールディングス）",
  "UntroD": "UntroD Capital Japan（旧リアルテックホールディングス）",
  "iCAP": "京都大学イノベーションキャピタル（京大iCAP）",
  "DCI": "大和企業投資",
  "大和企業投資": "大和企業投資",
  "DCM": "DCM Ventures",
  "MUCAP": "三菱UFJキャピタル",
  "三菱UFJキャピタル": "三菱UFJキャピタル",
  "MUFGTR": "三菱UFJキャピタル",
  "JIC": "産業革新投資機構（JIC）",
  "JIC VGI": "JIC VGI（JICベンチャー・グロース・インベストメンツ）",
  "DBJ": "日本政策投資銀行（DBJ）スタートアップ・イノベーションファンド",
  "DBJC": "DBJキャピタル",
  "JAFCO": "JAFCO グループ",
  "SBI": "SBI投資（SBI Investment）",
  "SPARX": "SPARX Asset Management（SPARX Group）",
  "Coral Capital": "Coral Capital",
  "WiL": "WiL",
  "WIL": "WiL",
  "Globis": "グロービス・キャピタル・パートナーズ",
  "グロービス": "グロービス・キャピタル・パートナーズ",
  "GCPJ": "グロービス・キャピタル・パートナーズ",
  "Genesia": "Genesia Ventures",
  "ジェネシア": "Genesia Ventures",
  "ジェネシアベンチャーズ": "Genesia Ventures",
  "Skyland Ventures": "Skyland Ventures",
  "SV": "Skyland Ventures",
  "EV": "East Ventures",
  "East Ventures": "East Ventures",
  "Hakobune": "Hakobune",
  "Antler": "Antler",
  "Incubate Fund": "Incubate Fund",
  "Spiral Capital": "Spiral Capital",
  "Scrum": "Scrum Ventures",
  "D4V": "D4V",
  "千葉道場": "千葉道場ファンド",
  "Spurcle": "Spurcle",
  "W Fund": "W Fund",
  "Catalys": "Catalys",
  "A-START": "A-Start",
  "ASTART": "A-Start",
  "THVP": "東北大学ベンチャーパートナーズ",
  "NOBUNAGA": "NOBUNAGA",
  "MIJ": "Medical Incubator Japan",
  "MedVenture Partners": "MedVenture Partners",
  "ANVP": "AN Venture Partners",
  "AN Venture Partners": "AN Venture Partners",
  "NEWTON BIOCAPITAL": "NEWTON BIOCAPITAL",
  "KII": "Keio Innovation Initiative",
  "KSP": "ケーエスピー",
  "NVCC": "日本ベンチャーキャピタル",
  "日本ベンチャーキャピタル": "日本ベンチャーキャピタル",
  "NTTドコモベンチャーズ": "NTTドコモベンチャーズ",
  "KDDI": "KDDI Open Innovation Fund",
  "HDYV": "博報堂DYベンチャーズ",
  "SMBCVC": "SMBCベンチャーキャピタル",
  "PKSHA": "PKSHA Capital",
  "東京センチュリー": "東京センチュリーキャピタル",
  "LifeX Ventures": "LifeX Ventures",
  "archetype": "archetype ventures",
  "LtV": "Lifetime Ventures",
  "LTV": "Lifetime Ventures",
  "QXLV": "クオンタムリープベンチャーズ",
  "qxlv": "クオンタムリープベンチャーズ",
  "ANOBAKA": "ANOBAKA",
  "Anobaka": "ANOBAKA",
  "PnP": "Plug and Play Japan",
  "PNP": "Plug and Play Japan",
  "NECAP": "NECキャピタルソリューションズ",
  "TAV": "テックアクセルベンチャーズ",
  "SCI": "サムライインキュベート",
  "FVC": "フューチャーベンチャーキャピタル",
  "YKKAP": "YKKAP",
  "めぶき": "めぶきキャピタル",
  "DEEPCORE": "DEEPCORE",
  "Deep Core": "DEEPCORE",
  "みらい創造": "みらい創造インベストメンツ",
  "IDATEN Ventures": "IDATEN Ventures",
  // 024 で追加した stub VC への alias
  "農林中金": "農林中金キャピタル",
  "SMTB": "三井住友信託銀行",
  "Colopl": "Colopl Next",
  "ICJ": "Incubate Capital Japan",
  "WV": "Will VC",
  "PacCap": "Pacific Capital",
  "PrimePartners": "Prime Partners",
  "Nissei": "日本生命",
  "ニッセイ": "日本生命",
  "ZVC": "Z Venture Capital",
  "イノベーションエンジン": "Innovation Engine",
  "ITV": "伊予銀ベンチャー (ITV)",
  "EEI": "Eneos Innovation Investment (EEI)",
  "TB": "Toyota Boshoku",
  "epiST": "epiST",
  "Oval": "Oval",
  "emellience": "Emellience Partners",
  "AMANO": "AMANO",
  "筑波SBI": "筑波SBI",
  "MIC": "Mizuho Capital",        // 厳密には別だが暫定
  "MUTB": "三菱UFJ信託銀行",
  "GHOV": "GHO Ventures",
  "Hataraku": "Hataraku Capital",
  "JST SUCCESS": "JST SUCCESS",
  "CEJ": "CEJ",
  "FTI": "Fast Track Initiative (FTI)",
  "IF": "IF (Investment Fund)",
  "ATAC": "ATAC",
  "WIZP": "WIZP",
  "新生CP": "新生キャピタルパートナーズ",
  "IPVP": "IP Bridge VP (IPVP)",
  "エムスリー": "エムスリー",
  "DCIP": "Daiichi Capital Investment Partners (DCIP)",
  "DMC": "DMC",
  "Remeges Ventures": "Remeges Ventures",
  "ビジネスエージェント": "ビジネスエージェント",
  "MZF": "MZ Web3 Fund (MZF)",
  "FIC": "Future Innovation Capital (FIC)",
  "Station AI": "Station Ai",
  "X-tech Ventures": "X-tech Ventures",
  "アニマルスピリッツ": "アニマルスピリッツ",
  "GGG": "GGG",
  "ナショナルサーチファンド": "ナショナルサーチファンド",
  "愛知キャピタル": "愛知キャピタル",
  "積水化学": "積水化学",
  "セントラルシードファンド": "セントラルシードファンド",
  "デライトベンチャーズ": "デライトベンチャーズ",
  "021": "Bandai Namco 021 Fund (021)",
  "077BC": "七十七キャピタル (77BC)",
  "77BC": "七十七キャピタル (77BC)",
  "DIMENSION": "DIMENSION",
  "INCJ": "産業革新投資機構（JIC）",  // 後継として
  "MUTRX": "三菱UFJ信託銀行",         // 別名
};

// PJ short → project_id
const PJ_MAP: Record<string, string> = {
  "tiem": "p03",
  "ティエム": "p03",
  "KT": "p04",
  "輝翠TECH": "p04",
  "CTB": "p06",
  "CrestecBio": "p06",
  "LST": "p07",
  "LiSTie": "p07",
  "LisTie": "p07",
  "JC": "p09",
  "JOYCLE": "p09",
  "BWE": "p11",
  "Blue Water Energy": "p11",
  "YD": "p18",
  "Yellow Duck": "p18",
  "CX": "p20",
  "CryoX": "p20",
  "SX": "p21",
  "SolvioraX": "p21",
};

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const sheetText = typeof body.sheet_text === "string" ? body.sheet_text : "";
  if (!sheetText) {
    return NextResponse.json({ error: "sheet_text body field required" }, { status: 400 });
  }

  const anthroKey = process.env.ANTHROPIC_API_KEY;
  if (!anthroKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY missing" }, { status: 500 });

  const db = createAdminClient();
  const anthropic = new Anthropic({ apiKey: anthroKey });

  // Claude に解析させる
  const prompt = `以下は AMD (株式会社チームアルマダ) が管理してる VC コンタクトリストの Google Sheet を text 化したもの。
PJ ごとの VC との接触履歴 + 担当者名 + ステータス を構造化 JSON で抽出してください。

# シート content (raw)
${sheetText.slice(0, 60000)}

# PJ 略称マッピング (シート内表記 → AMD の PJ ID)
tiem=p03 (ティエムファクトリ) / KT=p04 (輝翠TECH) / CTB=p06 (CrestecBio) /
LST=p07 (LiSTie) / JC=p09 (JOYCLE) / BWE=p11 / YD=p18 (Yellow Duck) /
CX=p20 (CryoX) / SX=p21 (SolvioraX) / r3kt や OPT や SE や MC や MS は他 PJ
※ r3kt / OPT / SE / MC / MS / NIMS は AMD PJ ID 不明なので skip してよい

# ステータスマッピング (シートのメモ → status)
- "確定" / "出資済み" → invested
- "lead" + 確定 → invested (is_lead=true は別レコード)
- "lead" のみ → pitching または evaluating (面談中なら pitching、検討中なら evaluating)
- "follow" のみ → pitching (リード次第)
- "DD" → dd
- "見送り" / "辞退" / "rejected" → passed
- "シード不可" → declined
- 「メール送付」「mtg実施」「再アプローチ」など → pitching
- 何も書いてない / "対象外" → not_contacted (この場合は出力に含めなくてよい)

# 担当者名抽出ルール (CRITICAL)
- VC 側の担当者名のみ contact_names に入れる
- 以下は AMD 内部の人物 / PJ 側の人物 → contact_names に絶対入れない:
  - 山地 / 山地正洋 / masa = AMD CEO まさ本人
  - タミル / Tamil = KT (輝翠TECH) の CEO (PJ 側)
  - 飯野 / 下里 / 武田 / 丸島 = AMD 内 or PJ 側の関係者
  - 「○○ルート」「○○経由」と書かれてる人 = 紹介者であり VC 担当ではない
- 「資料送付済」「メールで打診」「再アプローチ」等は contact_names ではなく general_memo
- 「鶴岡」「中島」「Atsushi Take」「Dave Lin」「曽我部 崇」のように、
  VC 名と隣接して記載され、明確に先方の担当として書かれてる人だけ抽出
- 不確かな場合は contact_names を省略

# 出力形式 (必ず <contacts_json>...</contacts_json> で囲む)

{
  "contacts": [
    {
      "vc_name_in_sheet": "BNV",
      "pj_short": "KT",
      "contact_names": ["鶴岡"],
      "status": "evaluating",
      "ticket_size_memo": "50-180M",
      "general_memo": "lead capable / 8/24mtg"
    }
  ]
}

# ルール
- pj_short が tiem/KT/CTB/LST/JC/BWE/YD/CX/SX 以外は skip
- vc_name_in_sheet は省略形 (BNV / iCAP 等) でも書いてあるまま入れる、後で alias 解決
- contact_names は 1-3 名程度。書いてなければ省略
- 1 つの (VC, PJ) ペアに 1 行 (重複統合)
- JSON のみ、説明文なし
- 上限 200 件まで`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 16000,
    messages: [{ role: "user", content: prompt }],
  });

  const fullText = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n");

  const tagMatch = fullText.match(/<contacts_json>([\s\S]*?)<\/contacts_json>/);
  if (!tagMatch) {
    return NextResponse.json({ error: "no contacts_json block", raw: fullText.slice(0, 2000) }, { status: 500 });
  }

  let parsed: { contacts?: ParsedContact[] } = {};
  try {
    parsed = JSON.parse(tagMatch[1].trim());
  } catch (e) {
    return NextResponse.json({ error: `parse - ${(e as Error).message}`, raw: tagMatch[1].slice(0, 2000) }, { status: 500 });
  }

  const contacts = Array.isArray(parsed.contacts) ? parsed.contacts : [];

  // 既存 VC の name → id マップ
  const { data: vcRows } = await db.from("vcs").select("id, name");
  const vcIdByName = new Map<string, string>();
  for (const v of (vcRows ?? []) as { id: string; name: string }[]) vcIdByName.set(v.name, v.id);

  const stats = {
    parsed_total: contacts.length,
    relations_upserted: 0,
    contacts_inserted: 0,
    skipped_unknown_vc: 0,
    skipped_unknown_pj: 0,
    unmatched_vcs: [] as string[],
    errors: [] as string[],
  };

  for (const c of contacts) {
    const pjId = PJ_MAP[c.pj_short];
    if (!pjId) {
      stats.skipped_unknown_pj++;
      continue;
    }
    const aliased = VC_ALIAS_MAP[c.vc_name_in_sheet] ?? c.vc_name_in_sheet;
    const vcId = vcIdByName.get(aliased);
    if (!vcId) {
      stats.skipped_unknown_vc++;
      if (!stats.unmatched_vcs.includes(c.vc_name_in_sheet)) {
        stats.unmatched_vcs.push(c.vc_name_in_sheet);
      }
      continue;
    }

    // 担当者 upsert (vc_id + name 一意で扱う)
    let firstContactId: string | null = null;
    if (Array.isArray(c.contact_names)) {
      for (const cname of c.contact_names) {
        if (!cname || cname.length < 2) continue;
        const { data: existing } = await db
          .from("vc_contacts")
          .select("id")
          .eq("vc_id", vcId)
          .eq("name", cname)
          .maybeSingle();
        if (existing) {
          if (!firstContactId) firstContactId = (existing as { id: string }).id;
          continue;
        }
        const { data: inserted, error } = await db
          .from("vc_contacts")
          .insert({ vc_id: vcId, name: cname, notes: "AMD VC sheet からの自動投入 (2026-05-08)" })
          .select("id")
          .single();
        if (error) stats.errors.push(`contact ${cname}: ${error.message}`);
        else {
          stats.contacts_inserted++;
          if (!firstContactId) firstContactId = (inserted as { id: string }).id;
        }
      }
    }

    // project_vc_relations upsert
    const memoParts = [c.ticket_size_memo, c.general_memo].filter(Boolean).join(" / ");
    const { error: relErr } = await db.from("project_vc_relations").upsert(
      {
        project_id: pjId,
        vc_id: vcId,
        vc_contact_id: firstContactId,
        status: c.status ?? "pitching",
        notes: memoParts ? `[AMD VC sheet] ${memoParts}` : "AMD VC sheet からの自動投入",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,vc_id" }
    );
    if (relErr) stats.errors.push(`relation ${aliased}/${pjId}: ${relErr.message}`);
    else stats.relations_upserted++;
  }

  return NextResponse.json({ ok: true, ...stats, errors: stats.errors.slice(0, 20) });
}

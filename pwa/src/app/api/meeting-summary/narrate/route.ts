/**
 * POST /api/meeting-summary/narrate
 *
 * 通常 MTG (= source_kinds が dialogue / none / upcoming 以外) の議事録サマリを、
 * その MTG に参加していなかった人でも 背景 → 経緯/進捗 → 決まったこと → 次の一手 → 残課題 が追える
 * Markdown narrative に書き直して `project_meeting_summaries.narrative_md` に保存する。
 *
 * dialogue 用 `/api/dialogue-meeting/narrate` と対称。違いは:
 *   - 「決まったこと」を書いてよい (dialogue は「提案」ニュアンス必須だった)
 *   - 対象は通常 MTG (dialogue ガードを反転)
 *
 * 入力モード:
 *   { meeting_id: "<id>" }                        → 1 件だけ narrate
 *   { all: true, limit?: number, project_id?: }   → narrative_md が空の通常 MTG を順次 narrate
 *
 * 既存の箇条書き (summary_short / decided / progress / next_actions / risks) を入力にする
 * (= 元 Notion/Gmail ソースは DB に保持していないため)。
 * source_hash と generated_by_model は変更しない (= 抽出経路情報を保持 + l6 の再抽出から保護)。
 *
 * 認証: admin (members.is_admin=true) または Authorization: Bearer ${CRON_SECRET}
 * LLM: Claude Sonnet 4.6 (= claude-sonnet-4-6)
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface MeetingRow {
  meeting_id: string;
  project_id: string;
  ym: string;
  meeting_date: string;
  title: string;
  summary_short: string;
  decided: unknown;
  progress: unknown;
  next_actions: unknown;
  risks: unknown;
  source_kinds: string | null;
}

const EXCLUDED_SOURCE_KINDS = new Set([
  "dialogue",
  "none",
  "upcoming",
  "upcoming_tentative",
]);

function isExcluded(row: { meeting_id: string; source_kinds: string | null }): boolean {
  if (row.meeting_id.startsWith("dialogue:")) return true;
  if (row.meeting_id.startsWith("upcoming:")) return true;
  if (row.source_kinds && EXCLUDED_SOURCE_KINDS.has(row.source_kinds)) return true;
  return false;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x : String(x ?? ""))).filter((s) => s.length > 0);
}

async function authorize(
  req: NextRequest,
): Promise<{ ok: true; createdBy: string } | { ok: false; res: NextResponse }> {
  const auth = req.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET || "";
  if (cronSecret && auth === `Bearer ${cronSecret}`) {
    return { ok: true, createdBy: "cron" };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return { ok: false, res: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  const { data: member } = await supabase
    .from("members")
    .select("code_name, is_admin")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();
  if (!member?.is_admin) {
    return { ok: false, res: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { ok: true, createdBy: member.code_name || user.email };
}

function buildPrompt(meeting: MeetingRow): string {
  const decided = asStringArray(meeting.decided);
  const progress = asStringArray(meeting.progress);
  const nextActions = asStringArray(meeting.next_actions);
  const risks = asStringArray(meeting.risks);

  return [
    `# 入力`,
    `- PJ: ${meeting.project_id}`,
    `- 月: ${meeting.ym}`,
    `- 日付: ${meeting.meeting_date}`,
    `- タイトル: ${meeting.title}`,
    `- ソース種別: ${meeting.source_kinds ?? "(不明)"}`,
    ``,
    `## サマリ`,
    meeting.summary_short || "(空)",
    ``,
    `## 進捗・経緯（raw）— ここに含まれる Markdown 表は narrative に必ず再現すること`,
    progress.length > 0 ? progress.map((p) => `- ${p}`).join("\n\n") : "- (空)",
    ``,
    `## 決まったこと（raw）`,
    decided.length > 0 ? decided.map((d) => `- ${d}`).join("\n") : "- (空)",
    ``,
    `## 次の一手（raw）`,
    nextActions.length > 0 ? nextActions.map((n) => `- ${n}`).join("\n") : "- (空)",
    ``,
    `## リスク・残課題（raw）`,
    risks.length > 0 ? risks.map((r) => `- ${r}`).join("\n") : "- (空)",
  ].join("\n");
}

const SYSTEM_PROMPT = `あなたは AMD OS の議事録担当。
通常 MTG (社外打合せ・社内定例・ヒアリング等) の生データ (箇条書き) を、
**その MTG に参加していなかったチームメンバーでも**「どういう会議だったか」「何が進んだか」
「何が決まったか」「次に誰が何をするか」「残課題は何か」がスムーズに追える、
**箇条書きに頼らない文章中心の Markdown narrative** に書き直す。

# 出力フォーマット（厳守、Markdown）

## 🎯 背景
（2-4 文の段落。どういう相手と何のための会議か、議題の前提となる現状認識・課題感。
 重要な固有名詞・数字・日付は **太字** で強調する。raw に背景が乏しければサマリから無理なく補える範囲で）

## 📊 経緯・進んだこと
（3-8 文の物語形式。会議で何が共有され、どの論点が動いたかを文章でつなぐ。
 箇条書きの羅列にせず、会議にいなかった人が流れを復元できるように、流れと含意が分かる文章で書く。
 **入力 raw の中に Markdown 表 (\`| ... | ... |\` 形式) があれば、ここに必ず本文として再現する**。
 表ごとに前後 1 行で「これは何の表か」を説明する short caption を付ける。重要な転換点は **太字**）

## ✅ 決まったこと
（1-4 段落。複数ある場合も箇条書きにせず、各段落の冒頭に **【決定タイトル】** を置いて、決定内容・条件・前提・数字を文章で説明する。raw decided が空ならこのセクション自体を出さない）

## ▶️ 次の一手（TODO）
（1-3 段落。担当と期限が分かる場合は **担当 → 期限** を文中で太字にする。担当が未定なら「**要確認 → ?**」、期限が未定なら「**?** 月」と文章で書く。箇条書き・チェックボックスにはしない。raw next_actions が空ならこのセクションを出さない）

## ⚠️ リスク・残課題
（1-3 段落。各段落の冒頭に **【リスクタイトル】** を置き、内容を文章で説明する。重要な期限・閾値は **太字** で。raw risks が空ならこのセクションを出さない）

# 絶対ルール
1. **入力 raw に書かれていない情報を勝手に追加・創作しない**（推測禁止）。ただし raw 内の別文脈から自明な補足（略称→正式名称の展開など）は許可。
2. **入力 raw が空のセクションは出力にも出さない**。「(記録なし)」のような空行も書かない。
3. **入力 raw の Markdown 表は narrative 本文に必ず再現する**。「元データに表があるので参照」のような言い訳禁止。
4. **表の中の不要記号**：「不要・対象外」を示すときは \`✕\`（U+2715）を使う。\`✘\`（U+2718）は使わない。raw に \`✘\` があれば \`✕\` に置き換える。
5. **役割・主語の取り違えに注意**：raw 箇条書きが誰が何をするかを取り違えている疑いがある場合 (例: 投資家側と起業側が逆など) は、文脈から明らかに整合する側に**控えめに**寄せてよいが、確証が無ければ raw のまま残し、断定しない。新情報の創作はしない。
6. **箇条書き禁止**: narrative 本文では \`-\` / \`*\` / \`・\` / \`•\` / \`1.\` で始まる羅列、\`- [ ]\` チェックボックス、配列項目の貼り付けを使わない。見出し、段落、blockquote、Markdown table だけで構成する。箇条書きが必要に見える内容も、段落として自然につなぐ。
7. **強調の使い分け**:
   - **太字** = 重要キーワード・固有名詞・数字・日付
   - \`|...|\` table = 並列構造の情報（マトリクス・対応表・候補リスト）
8. **絵文字見出し** で各セクションの目的を直感的に示す（🎯 背景 / 📊 経緯 / ✅ 決定 / ▶️ TODO / ⚠️ 残課題）。
9. **略称・社内固有名詞には初出で文脈補足を付ける**。例:「ファインケム（FC）」「ダイキアクシス（DAVP）」のような展開。
10. **文章は途中で切らない**。全セクションを完結させる。表を含めて最後まで書ききる。
11. 想定文字数は問わない（短い会議は短く、表を含む重い会議は長くてよい）。`;

async function narrateOne(
  meeting: MeetingRow,
): Promise<{ ok: true; narrative_md: string } | { ok: false; error: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "ANTHROPIC_API_KEY missing" };
  const admin = createAdminClient();

  const userPrompt = buildPrompt(meeting);
  const anthropic = new Anthropic({ apiKey });
  try {
    const resp = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    const textBlock = resp.content.find((b) => b.type === "text");
    const narrative = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";
    if (!narrative) return { ok: false, error: "empty narrative" };

    const { error: upError } = await admin
      .from("project_meeting_summaries")
      .update({ narrative_md: narrative, updated_at: new Date().toISOString() })
      .eq("meeting_id", meeting.meeting_id);
    if (upError) return { ok: false, error: upError.message };
    return { ok: true, narrative_md: narrative };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown anthropic error" };
  }
}

const SELECT_COLS =
  "meeting_id,project_id,ym,meeting_date,title,summary_short,decided,progress,next_actions,risks,source_kinds";

export async function POST(req: NextRequest) {
  const authz = await authorize(req);
  if (!authz.ok) return authz.res;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const meetingId = typeof body.meeting_id === "string" ? body.meeting_id : null;
  const all = body.all === true;
  const projectId = typeof body.project_id === "string" ? body.project_id : null;
  const limit = typeof body.limit === "number" ? Math.min(50, Math.max(1, body.limit)) : 10;

  const admin = createAdminClient();

  // 1 件モード
  if (meetingId) {
    const { data, error } = await admin
      .from("project_meeting_summaries")
      .select(SELECT_COLS)
      .eq("meeting_id", meetingId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: `meeting not found: ${meetingId}` }, { status: 404 });
    if (isExcluded(data as MeetingRow)) {
      return NextResponse.json(
        { error: "not a normal meeting (dialogue/none/upcoming are excluded)" },
        { status: 400 },
      );
    }
    const res = await narrateOne(data as MeetingRow);
    if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 500 });
    return NextResponse.json({ ok: true, meeting_id: meetingId, narrative_md: res.narrative_md });
  }

  // バッチ (= all=true): narrative_md が空の通常 MTG を limit 件 narrate
  if (!all) {
    return NextResponse.json({ error: "either meeting_id or all=true is required" }, { status: 400 });
  }
  let query = admin
    .from("project_meeting_summaries")
    .select(SELECT_COLS)
    .or("narrative_md.is.null,narrative_md.eq.")
    .not("source_kinds", "in", "(dialogue,none,upcoming,upcoming_tentative)")
    .not("source_kinds", "is", null)
    .order("meeting_date", { ascending: false })
    .limit(limit);
  if (projectId) query = query.eq("project_id", projectId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const targets = ((data || []) as MeetingRow[]).filter((t) => !isExcluded(t));
  const results: Array<{ meeting_id: string; ok: boolean; error?: string }> = [];
  for (const t of targets) {
    const r = await narrateOne(t);
    results.push({ meeting_id: t.meeting_id, ok: r.ok, error: r.ok ? undefined : r.error });
  }
  return NextResponse.json({
    ok: true,
    total: targets.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}

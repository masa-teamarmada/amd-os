/**
 * POST /api/dialogue-meeting/narrate
 *
 * 提案前の論点整理セッション (= source_kinds='dialogue') の dialogue meeting を、
 * 初めて読む人でも 背景 → 議論の流れ → 提案 → 残課題 が分かる Markdown narrative に
 * 書き直して `project_meeting_summaries.narrative_md` に保存する。
 *
 * 入力モード:
 *   { meeting_id: "dialogue:p21:..." }  → 1 件だけ narrate
 *   { all: true, limit?: number }         → narrative_md が NULL の dialogue meeting を順次 narrate
 *
 * 認証: admin (members.is_admin=true) または Authorization: Bearer ${CRON_SECRET}
 *
 * LLM: Claude Sonnet 4.6 (= claude-sonnet-4-6)
 *
 * 関連 strategy signal: meeting.source_url が "internal://strategy-signals/<id1>,<id2>" の形なら
 * その signal_id 配列で project_strategy_signals を fetch し prompt に含める。
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface DialogueMeetingRow {
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
  source_url: string | null;
  source_kinds: string | null;
}

interface StrategySignalRow {
  signal_id: string;
  signal_type: string | null;
  impact_level: string | null;
  decision_state: string | null;
  title: string | null;
  summary: string | null;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x : String(x ?? ""))).filter((s) => s.length > 0);
}

function parseRelatedSignalIds(sourceUrl: string | null): string[] {
  if (!sourceUrl) return [];
  const m = sourceUrl.match(/^internal:\/\/strategy-signals\/(.+)$/);
  if (!m) return [];
  return m[1].split(",").map((s) => s.trim()).filter(Boolean);
}

async function authorize(req: NextRequest): Promise<{ ok: true; createdBy: string } | { ok: false; res: NextResponse }> {
  const auth = req.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET || "";
  if (cronSecret && auth === `Bearer ${cronSecret}`) {
    return { ok: true, createdBy: "cron" };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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

function buildPrompt(meeting: DialogueMeetingRow, signals: StrategySignalRow[]): string {
  const decided = asStringArray(meeting.decided);
  const progress = asStringArray(meeting.progress);
  const nextActions = asStringArray(meeting.next_actions);
  const risks = asStringArray(meeting.risks);
  const signalsBlock = signals.length > 0
    ? signals
        .map((s, i) =>
          `${i + 1}. [${s.signal_type ?? "?"} / ${s.impact_level ?? "?"} / ${s.decision_state ?? "?"}] ${s.title ?? ""}\n   ${s.summary ?? ""}`
        )
        .join("\n")
    : "(なし)";

  return [
    `# 入力`,
    `- PJ: ${meeting.project_id}`,
    `- 月: ${meeting.ym}`,
    `- 日付: ${meeting.meeting_date}`,
    `- タイトル: ${meeting.title}`,
    ``,
    `## 提案前の論点整理サマリ`,
    meeting.summary_short || "(空)",
    ``,
    `## 議論で前進した点（raw）— ここに含まれる Markdown 表は narrative に必ず再現すること`,
    progress.length > 0 ? progress.map((p) => `- ${p}`).join("\n\n") : "- (空)",
    ``,
    `## チームへの提案案（raw）`,
    decided.length > 0 ? decided.map((d) => `- ${d}`).join("\n") : "- (空)",
    ``,
    `## 次の一手（raw）`,
    nextActions.length > 0 ? nextActions.map((n) => `- ${n}`).join("\n") : "- (空)",
    ``,
    `## 気になっていること（raw）`,
    risks.length > 0 ? risks.map((r) => `- ${r}`).join("\n") : "- (空)",
    ``,
    `## 関連経営シグナル（議論の対象になった候補）`,
    signalsBlock,
  ].join("\n");
}

const SYSTEM_PROMPT = `あなたは AMD OS の経営記録担当。
**提案前の論点整理セッション** の生データを、
**初めて読んだチームメンバーでも**「なぜこの議論をしたか」「議論の中で何が動いたか」
「チームに何を提案するか」「残課題は何か」がスムーズに追える、
**ビジュアル導線が設計された Markdown narrative** に書き直す。

# 出力フォーマット（厳守、Markdown）

## 🎯 背景
（2-4 文の段落。なぜこの議論が必要だったか、議題の前提となる現状認識・課題感。
 重要な固有名詞・数字・日付は **太字** で強調する）

## 💭 議論の流れ
（3-8 文の物語形式。何から議論が始まり、どの視点で深まり、論点がどう動いたか。
 箇条書きではなく文章でつなぐ。事実だけ淡々と書くのではなく、議論の含意を残す。
 重要な転換点・キーワードは **太字** で強調する）

## 📊 議論で確定した重要マップ・表
（**入力 raw progress[] / decided[] の中に Markdown 表 (\`| ... | ... |\` 形式) があれば、
ここに必ず本文として再現する**。1 つも省略しない。表ごとに前後 1 行で「これは何の表か」を説明
する short caption を付ける。表が無い議論セッションではこのセクション自体を出さない）

## 💬 チームへの提案案
> このセクションは「提案前の論点整理セッションで整理した、チームに『こうしてはどうか』と出す提案」を並べる。
> **「決定」「決まったこと」とは書かない**。必ず「提案」「相談」「議論したうえでの方向性」のニュアンス。

- **【提案タイトル】**：提案内容を 1-3 文で。重要な条件・タイミング・前提は **太字** で。
- （複数提案がある場合は同形式で並べる）

## ✅ 次の一手（TODO）
- [ ] **担当 → 期限**：内容を 1-2 文で。
- [ ] **担当 → 期限**：（複数項目を同形式で並べる）

（**必ず \`- [ ]\` のチェックボックス形式で書く**。担当が未定なら「**要相談 → ?**」、期限が未定なら「**?** 月」と書く）

## ⚠️ 残課題 / 気になっていること
（1-数項目。各項目は「**【リスク タイトル】**: 内容 1-2 文」の形で。重要な期限・閾値は **太字** で）

# 絶対ルール
1. **「決まったこと」とは絶対書かない**。dialogue meeting の出力は必ず「提案」「相談」「方向性」のニュアンス。
2. **このセッションは「提案前の論点整理セッション」と呼ぶ**。raw 内に別呼称があっても、narrative ではこの呼称へ統一する。
3. **提案はチームへの相談として書く**。特定個人だけで確定したように読める言い方は避ける。
4. **入力 raw の Markdown 表は narrative 本文に必ず再現する**。「元データに表があるので参照」のような言い訳禁止。表は読み手が真っ先に見たいビジュアル情報。
5. **表の中の不要記号**：表で「不要・対象外」を示すときは **\`✕\`（U+2715 MULTIPLICATION X）** を使う。**\`✘\`（U+2718 HEAVY BALLOT X）は使わない**（罰点っぽくて視覚的にきつい）。raw に \`✘\` があっても \`✕\` に置き換える。
6. **略称・社内固有名詞には初出で文脈補足を付ける**。例:「ダイキアクシス（DAVP）」「PSI Step2 事業化推進機関」のような展開。**ただし特定の MTG / イベントを narrative の時間軸の主役のように扱わない**。例:「5/下旬の開発部長MTG」は raw 内に出てきても、実態は単に NDA 締結後のキックオフ会話レベルなので、narrative では「**事業戦略上そろそろ方針を決めておきたいタイミング**」のような事業ロジック側の表現に書き換える。特定 MTG にフォーカスして時間制約を演出しない。
7. **強調の使い分け**:
   - **太字** = 重要キーワード・固有名詞・数字・日付
   - \`>\` blockquote = セクション全体の前置き・補足
   - \`- [ ]\` チェックボックス = TODO
   - \`|...|\` table = 並列構造の情報（マトリクス・対応表・候補リスト）
8. **絵文字見出し** を使って各セクションの目的を直感的に示す（🎯 背景 / 💭 議論 / 📊 マップ / 💬 提案 / ✅ TODO / ⚠️ 残課題）。
9. **入力 raw に書かれていない情報を勝手に追加しない**（推測・創作禁止）。ただし raw 内の別文脈から自明な補足（例: 略称→正式名称の展開）は許可。
10. **入力 raw が空のセクションは出力にも出さない**。「(まだ記録なし)」のような空行も書かない。
11. **文章は途中で切らない**。出力全体が長くなっても全セクションを完結させる。表を含めて最後まで書ききる。
12. 想定文字数は問わない（短い議論セッションは短く、表を含む重い議論は長くてよい）。`;

async function narrateOne(meeting: DialogueMeetingRow): Promise<{ ok: true; narrative_md: string } | { ok: false; error: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "ANTHROPIC_API_KEY missing" };
  const admin = createAdminClient();

  // related strategy signals
  const ids = parseRelatedSignalIds(meeting.source_url);
  let signals: StrategySignalRow[] = [];
  if (ids.length > 0) {
    const { data, error } = await admin
      .from("project_strategy_signals")
      .select("signal_id,signal_type,impact_level,decision_state,title,summary")
      .in("signal_id", ids);
    if (!error && data) signals = data as StrategySignalRow[];
  }

  const userPrompt = buildPrompt(meeting, signals);

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

export async function POST(req: NextRequest) {
  const authz = await authorize(req);
  if (!authz.ok) return authz.res;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const meetingId = typeof body.meeting_id === "string" ? body.meeting_id : null;
  const all = body.all === true;
  const limit = typeof body.limit === "number" ? Math.min(50, Math.max(1, body.limit)) : 10;

  const admin = createAdminClient();

  // 1 件モード
  if (meetingId) {
    const { data, error } = await admin
      .from("project_meeting_summaries")
      .select("meeting_id,project_id,ym,meeting_date,title,summary_short,decided,progress,next_actions,risks,source_url,source_kinds")
      .eq("meeting_id", meetingId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: `meeting not found: ${meetingId}` }, { status: 404 });
    if (data.source_kinds !== "dialogue" && !data.meeting_id.startsWith("dialogue:")) {
      return NextResponse.json({ error: "not a dialogue meeting" }, { status: 400 });
    }
    const res = await narrateOne(data as DialogueMeetingRow);
    if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 500 });
    return NextResponse.json({ ok: true, meeting_id: meetingId, narrative_md: res.narrative_md });
  }

  // バッチ (= all=true) モード: narrative_md が NULL の dialogue meeting を limit 件 narrate
  if (!all) {
    return NextResponse.json({ error: "either meeting_id or all=true is required" }, { status: 400 });
  }
  const { data, error } = await admin
    .from("project_meeting_summaries")
    .select("meeting_id,project_id,ym,meeting_date,title,summary_short,decided,progress,next_actions,risks,source_url,source_kinds,narrative_md")
    .eq("source_kinds", "dialogue")
    .is("narrative_md", null)
    .order("meeting_date", { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const targets = (data || []) as (DialogueMeetingRow & { narrative_md: string | null })[];
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

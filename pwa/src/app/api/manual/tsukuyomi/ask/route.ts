/**
 * OS マニュアル専用のつくよみ Q&A。
 *
 * Global Tsukuyomi chat は Sonnet + DB 修正 tool を持つが、この route は
 * `/manual` だけの実験導線として Gemini にマニュアル本文を渡して回答する。
 * DB 書き込みはしない。
 */

import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getManualSearchDocuments } from "@/app/(app)/manual/manual-data";
import { searchManualDocuments, type ManualSearchDocument } from "@/app/(app)/manual/manual-search";
import { requireAuth } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

interface IncomingHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

function uniqueDocs(docs: ManualSearchDocument[]) {
  const seen = new Set<string>();
  return docs.filter((doc) => {
    if (seen.has(doc.slug)) return false;
    seen.add(doc.slug);
    return true;
  });
}

function findDocsBySlug(docs: ManualSearchDocument[], slugs: string[]) {
  return slugs
    .map((slug) => docs.find((doc) => doc.slug === slug))
    .filter((doc): doc is ManualSearchDocument => Boolean(doc));
}

function guideDocsForQuestion(docs: ManualSearchDocument[], question: string) {
  const compactQuestion = question.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
  const slugs: string[] = [];

  if (compactQuestion.includes("l2")) {
    slugs.push("1-1-intro", "3-2-data-and-extraction", "8-3-l2-extraction-routines-spec");
  }

  if (compactQuestion.includes("検索")) {
    slugs.push("1-1-intro", "9-2-developer");
  }

  return findDocsBySlug(docs, slugs);
}

function contextBlock(doc: ManualSearchDocument) {
  const body = doc.text.length > 8_000 ? `${doc.text.slice(0, 8_000)} ...` : doc.text;
  return `## ${doc.number}. ${doc.title} (${doc.slug})
summary: ${doc.summary}
topics: ${doc.topics.join(", ")}
screens: ${doc.screens.join(", ") || "-"}
tables: ${doc.tables.join(", ") || "-"}
headings: ${doc.headings.slice(0, 12).join(" / ")}

${body}`;
}

/**
 * 全章の索引。本文を渡せた章が 0 件でも、どの章を見ればよいかだけは答えられるように
 * 常に渡す。マニュアル本文が英語表記の章 (例: Venture Map) を日本語で聞かれた場合も、
 * 索引があれば章を案内できる。
 */
function chapterIndexBlock(docs: ManualSearchDocument[]) {
  return docs
    .map((doc) => {
      const meta = [...doc.topics, ...doc.screens, ...doc.tables].filter(Boolean).join(" / ");
      return `- ${doc.number} ${doc.title}: ${doc.summary || "-"}${meta ? ` [${meta}]` : ""}`;
    })
    .join("\n");
}

function sourceLinksBlock(docs: ManualSearchDocument[]) {
  const sources = docs.slice(0, 4);
  if (sources.length === 0) return "";

  return [
    "ここ見たらOK:",
    ...sources.map((doc) => `- [${doc.number} ${doc.title}](/manual/${encodeURIComponent(doc.slug)})`),
  ].join("\n");
}

function applyTsukuyomiVoice(reply: string) {
  return reply
    .replace(/ご確認ください/g, "見てね")
    .replace(/ご参照ください/g, "見てね")
    .replace(/確認してください/g, "見てね")
    .replace(/参照してください/g, "見てね")
    .replace(/してください/g, "してね");
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.errorResponse;

  let body: {
    question?: string;
    currentSlug?: string | null;
    history?: IncomingHistoryMessage[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });
  }

  const docs = getManualSearchDocuments();
  const currentDoc = body.currentSlug ? docs.find((doc) => doc.slug === body.currentSlug) : undefined;
  const rankedDocs = searchManualDocuments(docs, question, 7).map((result) => result.doc);
  const guideDocs = guideDocsForQuestion(docs, question);
  const selectedDocs = uniqueDocs([...(currentDoc ? [currentDoc] : []), ...guideDocs, ...rankedDocs]).slice(0, 8);
  const history = (body.history ?? [])
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-6)
    .map((message) => `${message.role === "user" ? "まさ" : "つくよみ"}: ${message.content.slice(0, 800)}`)
    .join("\n");

  const context = selectedDocs.map(contextBlock).join("\n\n---\n\n");
  const chapterIndex = chapterIndexBlock(docs);
  const prompt = `あなたは AMD OS のマニュアル案内役「つくよみ」。
以下の OS マニュアル本文を根拠に、まさの質問へ日本語で答えて。

守ること:
- マニュアル本文から分かることだけ答える。
- つくよみは敬語を使わない。です / ます / ください / ご確認ください / 参照してください / ご参照ください は禁止。
- まさに話す口調で、やわらかく、少しくだけて答える。例: 「ざっくり言うと」「ここを見ると早いよ」「まずここだけ押さえればOK」。
- 高校生にも伝わるように、専門語をいきなり並べない。最初に一言でたとえ、その後に必要な用語を出す。
- 回答の型は「ざっくり言うと」→「たとえると」→「もう少し正確に言うと」→「次に見るところ」。長くしすぎない。
- 本文が渡っていない場合でも、下の章の索引から該当しそうな章を探して「まずは 6-11 メンバー支払フロー を見て」のように必ず案内する。索引にも無いときだけ「マニュアル内では該当箇所を見つけきれなかった」と言う。内部の参照範囲を指す表現は使わない。
- 索引の章タイトルが英語でも、質問の日本語と同じものを指していないか確かめる。例: 「ベンチャーマップ」は \`Venture Map\`。
- 参照した章は「3-2 データと抽出」のように章番号 + タイトルで書く。
- テーブル名・カラム名・ファイル名・パスは必ず backtick で囲む。例: \`monthly_reports\`
- 「別の章を確認」だけで終えず、該当しそうな章名を具体的に示す。
- DB 更新・通知送信・外部サービス操作はしない。案内だけにする。
- 章リンク一覧はシステム側で最後に付けるので、本文中で無理にURLを作らない。

直近の会話:
${history || "(なし)"}

質問:
${question}

章の索引 (全章):
${chapterIndex}

参照用マニュアル本文:
${context || "(質問に強く一致する章を特定できなかった。上の索引から案内して)"}`;

  try {
    const gen = new GoogleGenerativeAI(apiKey);
    const model = gen.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const reply = applyTsukuyomiVoice(result.response.text().trim());
    const links = sourceLinksBlock(selectedDocs);
    const replyWithLinks = links ? `${reply || "ごめん、回答を作れなかった。"}\n\n---\n\n${links}` : reply;

    return NextResponse.json({
      reply: replyWithLinks || "ごめん、回答を作れなかった。",
      model: "gemini-2.5-flash",
      sources: selectedDocs.slice(0, 4).map((doc) => ({
        slug: doc.slug,
        number: doc.number,
        title: doc.title,
      })),
    });
  } catch (e) {
    console.error("[manual/tsukuyomi/ask]", e);
    return NextResponse.json({ error: "gemini error" }, { status: 500 });
  }
}

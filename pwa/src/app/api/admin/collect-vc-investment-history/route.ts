import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;
export const runtime = "nodejs";

const PROMPT_KEY = "vc.investment_history.collect.v1";
const LIGHTWEIGHT_MODELS = new Set(["gemini-3.5-flash-lite"]);
const ROUND_LABELS = [
  "pre_seed",
  "seed",
  "series_a",
  "series_b",
  "series_c",
  "series_d",
  "bridge",
  "growth",
  "unknown",
] as const;

type RelationRow = {
  vc_id: string;
  project_id: string;
  status: string;
  last_touch_at: string | null;
};

type VcRow = {
  id: string;
  name: string;
  name_en: string | null;
  website: string | null;
  investment_history_collected_at: string | null;
};

type RoundDraft = {
  startup_name?: string;
  startup_name_en?: string | null;
  startup_website?: string | null;
  round_label?: string | null;
  announced_on?: string | null;
  completed_on?: string | null;
  deal_status?: string | null;
  round_total_amount_low?: number | null;
  round_total_amount_high?: number | null;
  round_total_currency?: string | null;
  round_total_disclosure?: string | null;
  investor_amount_low?: number | null;
  investor_amount_high?: number | null;
  investor_amount_currency?: string | null;
  investor_amount_disclosure?: string | null;
  investor_role?: string | null;
  fund_no?: number | null;
  source_url?: string | null;
  source_title?: string | null;
  evidence_note?: string | null;
};

const STATUS_SCORE: Record<string, number> = {
  term_sheet: 700,
  dd: 600,
  evaluating: 500,
  pitching: 400,
  invested: 350,
  passed: 100,
  declined: 50,
};

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isPublicIp(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168)) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (isIP(address) === 6) {
    const normalized = address.toLowerCase();
    return !(
      normalized === "::" || normalized === "::1" ||
      normalized.startsWith("fc") || normalized.startsWith("fd") ||
      /^fe[89ab]/.test(normalized) || normalized.startsWith("ff") ||
      normalized.startsWith("::ffff:")
    );
  }
  return false;
}

async function assertPublicUrl(url: URL): Promise<void> {
  if (!(["http:", "https:"].includes(url.protocol))) throw new Error("unsupported protocol");
  if (url.username || url.password) throw new Error("URL credentials are not allowed");
  if (url.port && !(["80", "443"].includes(url.port))) throw new Error("non-standard port is not allowed");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("local hostname is not allowed");
  }
  const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true });
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicIp(address))) {
    throw new Error("private or unresolved address is not allowed");
  }
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n: string) => String.fromCodePoint(Number.parseInt(n, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function searchable(value: string): string {
  return decodeHtml(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/株式会社|有限会社|合同会社|incorporated|corporation|company|limited/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function entityTokens(value: string, kind: "startup" | "vc"): string[] {
  const fragments = value
    .normalize("NFKC")
    .replace(/[（）()]/g, " ")
    .split(/[\s/・,，]+/)
    .map((fragment) => searchable(fragment))
    .map((fragment) => kind === "startup"
      ? fragment.replace(/group|holdings|technologies|technology|inc|corp|ltd/g, "")
      : fragment.replace(/investment|investments|ventures|venture|capital|キャピタル|インベストメント|投資|cvc/g, ""))
    .filter((fragment) => /[a-z]/.test(fragment) ? fragment.length >= 3 : fragment.length >= 2);
  const full = searchable(value)
    .replace(kind === "startup"
      ? /group|holdings|technologies|technology|inc|corp|ltd/g
      : /investment|investments|ventures|venture|capital|キャピタル|インベストメント|投資|cvc/g, "");
  if (full.length >= 2) fragments.unshift(full);
  return [...new Set(fragments)];
}

async function fetchSourcePage(initialUrl: string): Promise<{ url: string; title: string | null; text: string }> {
  let current = new URL(initialUrl);
  for (let redirectCount = 0; redirectCount <= 4; redirectCount++) {
    await assertPublicUrl(current);
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(12_000),
      headers: { "user-agent": "AMD-OS investment evidence validator/1.0" },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error(`redirect ${response.status} without location`);
      current = new URL(location, current);
      continue;
    }
    if (!response.ok) throw new Error(`source HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      throw new Error("source is not text");
    }
    const html = (await response.text()).slice(0, 2_000_000);
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? decodeHtml(titleMatch[1]).replace(/\s+/g, " ").trim().slice(0, 300) : null;
    const text = html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--([\s\S]*?)-->/g, " ")
      .replace(/<[^>]+>/g, " ");
    return { url: current.toString(), title, text: searchable(text) };
  }
  throw new Error("too many redirects");
}

async function validateEvidenceSource(
  sourceUrl: string,
  startupName: string,
  vc: Pick<VcRow, "name" | "name_en" | "website">,
): Promise<{ ok: true; url: string; title: string | null; text: string } | { ok: false; reason: string }> {
  try {
    const parsed = new URL(sourceUrl);
    if ((parsed.pathname === "/" || parsed.pathname === "") && !parsed.search) {
      return { ok: false, reason: "root homepage is not transaction evidence" };
    }
    const page = await fetchSourcePage(sourceUrl);
    const finalUrl = new URL(page.url);
    if ((finalUrl.pathname === "/" || finalUrl.pathname === "") && !finalUrl.search) {
      return { ok: false, reason: "source redirected to a root homepage" };
    }
    const startupMatched = entityTokens(startupName, "startup").some((token) => page.text.includes(token));
    const vcMatched = [vc.name, vc.name_en ?? ""]
      .flatMap((name) => entityTokens(name, "vc"))
      .some((token) => page.text.includes(token));
    const officialVcHost = vc.website
      ? new URL(vc.website).hostname.replace(/^www\./, "") === new URL(page.url).hostname.replace(/^www\./, "")
      : false;
    if (!startupMatched) return { ok: false, reason: "startup name not found in source body" };
    if (!vcMatched && !officialVcHost) return { ok: false, reason: "VC name not found in source body" };
    return { ok: true, url: page.url, title: page.title, text: page.text };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

function sourceMentionsDate(text: string, date: string | null): boolean {
  if (!date) return false;
  const [year, month, day] = date.split("-");
  const candidates = [
    `${year}${month}${day}`,
    `${year}年${Number(month)}月${Number(day)}日`,
    `${year}/${Number(month)}/${Number(day)}`,
  ].map(searchable);
  return candidates.some((candidate) => text.includes(candidate));
}

function sourceMentionsAmount(text: string, value: number | null, currency: string): boolean {
  if (value === null) return false;
  const candidates = [String(value)];
  if (currency === "JPY") {
    if (value >= 100_000_000) candidates.push(`${value / 100_000_000}億円`, `${value / 100_000_000}億`);
    if (value >= 10_000) candidates.push(`${value / 10_000}万円`, `${value / 10_000}万`);
  } else if (value >= 1_000_000) {
    const currencyNames = currency === "USD" ? ["米ドル", "ドル"] : currency === "EUR" ? ["ユーロ"] : [currency];
    candidates.push(`${value / 1_000_000}million${currency}`, `${value / 1_000_000}m${currency}`);
    if (value >= 100_000_000) {
      for (const name of currencyNames) candidates.push(`${value / 100_000_000}億${name}`);
    }
  }
  return candidates.map(searchable).some((candidate) => text.includes(candidate));
}

function currencyCode(value: unknown, fallback = "JPY"): string {
  const candidate = String(value ?? fallback).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(candidate) ? candidate : fallback;
}

function amount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function normalizeStartupName(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/株式会社|有限会社|合同会社/g, "")
    .replace(/[\s・･.．,，()（）]/g, "")
    .toLowerCase();
}

function renderPrompt(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (body, [key, value]) => body.replaceAll(`{{${key}}}`, value),
    template,
  );
}

function parseDrafts(text: string): RoundDraft[] {
  const tagged = text.match(/<vc_investment_json>([\s\S]*?)<\/vc_investment_json>/);
  if (!tagged) return [];
  try {
    const parsed = JSON.parse(tagged[1].trim()) as { rounds?: unknown };
    return Array.isArray(parsed.rounds) ? (parsed.rounds as RoundDraft[]) : [];
  } catch {
    return [];
  }
}

async function generateWithGemini(model: string, prompt: string, maxOutputTokens: number): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens,
          responseMimeType: "text/plain",
        },
      }),
    },
  );
  const body = await response.json() as {
    error?: { message?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  if (!response.ok) throw new Error(body.error?.message ?? `Gemini HTTP ${response.status}`);
  return (body.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") ?? "5"), 5));
  const refresh = url.searchParams.get("refresh") === "1";
  const db = createAdminClient();

  const [{ data: prompt, error: promptError }, { data: relations, error: relationError }] = await Promise.all([
    db
      .from("llm_prompts")
      .select("body, model, max_tokens")
      .eq("prompt_key", PROMPT_KEY)
      .eq("is_active", true)
      .maybeSingle(),
    db
      .from("project_vc_relations")
      .select("vc_id, project_id, status, last_touch_at")
      .neq("status", "not_contacted"),
  ]);

  if (promptError || !prompt?.body?.trim()) {
    return NextResponse.json({ error: "active prompt missing", detail: promptError?.message }, { status: 500 });
  }
  const model = String(prompt.model ?? "");
  if (!LIGHTWEIGHT_MODELS.has(model)) {
    return NextResponse.json({ error: "lightweight model required", model }, { status: 409 });
  }
  if (relationError) {
    return NextResponse.json({ error: relationError.message }, { status: 500 });
  }

  const relationRows = (relations ?? []) as RelationRow[];
  const relationByVc = new Map<string, RelationRow[]>();
  for (const relation of relationRows) {
    const list = relationByVc.get(relation.vc_id) ?? [];
    list.push(relation);
    relationByVc.set(relation.vc_id, list);
  }
  const vcIds = [...relationByVc.keys()];
  if (vcIds.length === 0) {
    return NextResponse.json({ ok: true, model, eligible_vcs: 0, processed_vcs: 0 });
  }

  const { data: vcs, error: vcsError } = await db
    .from("vcs")
    .select("id, name, name_en, website, investment_history_collected_at")
    .in("id", vcIds);
  if (vcsError) return NextResponse.json({ error: vcsError.message }, { status: 500 });

  const selected = ((vcs ?? []) as VcRow[])
    .filter((vc) => refresh || !vc.investment_history_collected_at)
    .sort((a, b) => {
      const aRelations = relationByVc.get(a.id) ?? [];
      const bRelations = relationByVc.get(b.id) ?? [];
      const aScore = Math.max(...aRelations.map((r) => STATUS_SCORE[r.status] ?? 0)) + aRelations.length;
      const bScore = Math.max(...bRelations.map((r) => STATUS_SCORE[r.status] ?? 0)) + bRelations.length;
      return bScore - aScore || a.name.localeCompare(b.name, "ja");
    })
    .slice(0, limit);

  const result = {
    ok: true,
    model,
    eligible_vcs: vcIds.length,
    processed_vcs: 0,
    rounds_upserted: 0,
    candidates_inserted: 0,
    candidates_updated: 0,
    rejected_drafts: 0,
    vcs: [] as Array<{ name: string; drafts: number; saved: number }>,
    errors: [] as string[],
    rejections: [] as string[],
  };

  for (const vc of selected) {
    try {
      const { data: existingInvestments } = await db
        .from("vc_investments")
        .select("target_company, source_url, round, invested_at")
        .eq("vc_id", vc.id)
        .neq("verification_status", "dismissed")
        .limit(40);
      const existingSummary = (existingInvestments ?? []).length > 0
        ? (existingInvestments ?? [])
            .map((item) => `- ${item.target_company} / ${item.round ?? "ラウンド不明"} / ${item.invested_at ?? "日付不明"} / ${item.source_url ?? "出典未登録"}`)
            .join("\n")
        : "(なし)";

      const userPrompt = renderPrompt(prompt.body, {
        VC_NAME: vc.name,
        VC_NAME_EN: vc.name_en ? `（${vc.name_en}）` : "",
        VC_WEBSITE: vc.website ?? "未登録",
        EXISTING_INVESTMENTS: existingSummary,
      });
      const text = await generateWithGemini(
        model,
        userPrompt,
        Math.max(512, Math.min(Number(prompt.max_tokens ?? 4096), 4096)),
      );
      const drafts = parseDrafts(text);
      let savedForVc = 0;

      for (const draft of drafts) {
        const startupName = String(draft.startup_name ?? "").trim();
        const sourceUrl = validUrl(draft.source_url) ? draft.source_url : null;
        const normalizedName = normalizeStartupName(startupName);
        if (!startupName || !normalizedName || !sourceUrl) continue;
        const evidenceNote = String(draft.evidence_note ?? "").trim();
        if (!/(出資|投資|増資|資金調達|調達|invest|funding|financing)/i.test(evidenceNote)) {
          result.rejected_drafts++;
          result.rejections.push(`${vc.name} / ${startupName}: evidence note does not state an investment transaction`);
          continue;
        }
        const evidence = await validateEvidenceSource(sourceUrl, startupName, vc);
        if (!evidence.ok) {
          result.rejected_drafts++;
          result.rejections.push(`${vc.name} / ${startupName}: ${evidence.reason}`);
          continue;
        }

        let { data: startup, error: startupError } = await db
          .from("startup_companies")
          .select("id, aliases, name_en, website")
          .eq("normalized_name", normalizedName)
          .maybeSingle();
        if (startupError) throw startupError;
        if (!startup) {
          const inserted = await db
            .from("startup_companies")
            .insert({
              canonical_name: startupName,
              name_en: draft.startup_name_en ?? null,
              normalized_name: normalizedName,
              aliases: [startupName],
              website: validUrl(draft.startup_website) ? draft.startup_website : null,
            })
            .select("id, aliases, name_en, website")
            .single();
          if (inserted.error) throw inserted.error;
          startup = inserted.data;
        } else if (!startup.aliases.includes(startupName)) {
          await db
            .from("startup_companies")
            .update({ aliases: [...startup.aliases, startupName], updated_at: new Date().toISOString() })
            .eq("id", startup.id);
        }

        const proposedAnnouncedOn = isIsoDate(draft.announced_on) ? draft.announced_on : null;
        const proposedCompletedOn = isIsoDate(draft.completed_on) ? draft.completed_on : null;
        const announcedOn = sourceMentionsDate(evidence.text, proposedAnnouncedOn) ? proposedAnnouncedOn : null;
        const completedOn = sourceMentionsDate(evidence.text, proposedCompletedOn) ? proposedCompletedOn : null;
        const roundLabel = enumValue(String(draft.round_label ?? "unknown").trim().toLowerCase(), ROUND_LABELS, "unknown");
        const dedupeBasis = `${startup.id}|${announcedOn ?? evidence.url}|${roundLabel}`;
        const dedupeKey = createHash("sha256").update(dedupeBasis).digest("hex");
        const now = new Date().toISOString();
        const requestedDealStatus = enumValue(draft.deal_status, ["planned", "announced", "completed", "cancelled", "unknown"] as const, "unknown");
        const dealStatus = requestedDealStatus === "completed" && !completedOn ? "announced" : requestedDealStatus;
        const roundCurrency = currencyCode(draft.round_total_currency);
        const proposedRoundLow = amount(draft.round_total_amount_low);
        const proposedRoundHigh = amount(draft.round_total_amount_high);
        const roundLow = sourceMentionsAmount(evidence.text, proposedRoundLow, roundCurrency) ? proposedRoundLow : null;
        const roundHigh = sourceMentionsAmount(evidence.text, proposedRoundHigh, roundCurrency) ? proposedRoundHigh : null;
        const roundDisclosure = roundLow !== null || roundHigh !== null
          ? enumValue(draft.round_total_disclosure, ["exact", "range", "undisclosed", "not_found"] as const, "not_found")
          : enumValue(draft.round_total_disclosure, ["undisclosed", "not_found"] as const, "not_found");
        const roundPayload = {
          startup_id: startup.id,
          dedupe_key: dedupeKey,
          round_label: roundLabel,
          announced_on: announcedOn,
          completed_on: completedOn,
          deal_status: dealStatus,
          total_amount_low: roundLow,
          total_amount_high: roundHigh,
          total_amount_currency: roundCurrency,
          total_amount_disclosure: roundDisclosure,
          source_url: evidence.url,
          source_title: evidence.title ?? (String(draft.source_title ?? "").trim().slice(0, 300) || null),
          evidence_note: evidenceNote.slice(0, 500) || null,
          verification_status: "candidate",
          collected_by_model: model,
          collected_at: now,
          updated_at: now,
        };
        const { data: existingRound } = await db
          .from("startup_funding_rounds")
          .select("id, verification_status")
          .eq("dedupe_key", dedupeKey)
          .maybeSingle();
        let roundId: string;
        if (existingRound) {
          roundId = existingRound.id;
          if (existingRound.verification_status !== "confirmed") {
            const updated = await db.from("startup_funding_rounds").update(roundPayload).eq("id", roundId);
            if (updated.error) throw updated.error;
          }
        } else {
          const inserted = await db.from("startup_funding_rounds").insert(roundPayload).select("id").single();
          if (inserted.error) throw inserted.error;
          roundId = inserted.data.id;
        }
        result.rounds_upserted++;

        let fundId: string | null = null;
        if (typeof draft.fund_no === "number" && Number.isInteger(draft.fund_no)) {
          const { data: fund } = await db
            .from("vc_funds")
            .select("id")
            .eq("vc_id", vc.id)
            .eq("fund_no", draft.fund_no)
            .maybeSingle();
          fundId = fund?.id ?? null;
        }

        const currency = currencyCode(draft.investor_amount_currency);
        const proposedInvestorLow = amount(draft.investor_amount_low);
        const proposedInvestorHigh = amount(draft.investor_amount_high);
        const investorLow = sourceMentionsAmount(evidence.text, proposedInvestorLow, currency) ? proposedInvestorLow : null;
        const investorHigh = sourceMentionsAmount(evidence.text, proposedInvestorHigh, currency) ? proposedInvestorHigh : null;
        const investorDisclosure = investorLow !== null || investorHigh !== null
          ? enumValue(draft.investor_amount_disclosure, ["exact", "range", "undisclosed", "not_found"] as const, "not_found")
          : enumValue(draft.investor_amount_disclosure, ["undisclosed", "not_found"] as const, "not_found");
        const investmentPayload = {
          vc_id: vc.id,
          fund_id: fundId,
          startup_id: startup.id,
          funding_round_id: roundId,
          target_company: startupName,
          target_company_en: draft.startup_name_en ?? null,
          amount_jpy: currency === "JPY" && investorLow !== null && investorLow === investorHigh ? investorLow : null,
          round: roundLabel,
          invested_at: completedOn ?? announcedOn,
          is_lead: draft.investor_role === "lead" || draft.investor_role === "co_lead",
          source_url: evidence.url,
          notes: evidenceNote.slice(0, 500) || null,
          investor_amount_low: investorLow,
          investor_amount_high: investorHigh,
          investor_amount_currency: currency,
          amount_disclosure: investorDisclosure,
          investor_role: enumValue(draft.investor_role, ["lead", "co_lead", "participant", "unknown"] as const, "unknown"),
          deal_status: roundPayload.deal_status,
          verification_status: "candidate",
          collected_by_model: model,
          collected_at: now,
          updated_at: now,
        };
        const { data: existingInvestment } = await db
          .from("vc_investments")
          .select("id, verification_status")
          .eq("vc_id", vc.id)
          .eq("funding_round_id", roundId)
          .maybeSingle();
        if (existingInvestment) {
          if (existingInvestment.verification_status !== "confirmed") {
            const updated = await db.from("vc_investments").update(investmentPayload).eq("id", existingInvestment.id);
            if (updated.error) throw updated.error;
            result.candidates_updated++;
            savedForVc++;
          }
        } else {
          const inserted = await db.from("vc_investments").insert(investmentPayload);
          if (inserted.error) throw inserted.error;
          result.candidates_inserted++;
          savedForVc++;
        }
      }

      const collectedAt = new Date().toISOString();
      const { count: candidateCount } = await db
        .from("vc_investments")
        .select("id", { count: "exact", head: true })
        .eq("vc_id", vc.id)
        .eq("verification_status", "candidate");
      await db
        .from("vcs")
        .update({
          investment_history_collected_at: collectedAt,
          investment_history_model: model,
          investment_history_candidate_count: candidateCount ?? 0,
          updated_at: collectedAt,
        })
        .eq("id", vc.id);
      result.processed_vcs++;
      result.vcs.push({ name: vc.name, drafts: drafts.length, saved: savedForVc });
    } catch (error) {
      result.errors.push(`${vc.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  result.rejections = result.rejections.slice(0, 50);
  return NextResponse.json(result, { status: result.errors.length > 0 && result.processed_vcs === 0 ? 500 : 200 });
}

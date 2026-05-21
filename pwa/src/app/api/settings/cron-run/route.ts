import { NextRequest, NextResponse } from "next/server";
import { findCronOperation } from "@/lib/operations-catalog";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RunPayload = {
  operationId?: unknown;
  paramsText?: unknown;
  params?: unknown;
};

type RunParams = {
  args?: unknown;
  query?: unknown;
};

export async function POST(req: NextRequest) {
  try {
    const auth = await assertAdmin();
    if (auth) return auth;

    const body = (await req.json().catch(() => ({}))) as RunPayload;
    const operationId = String(body.operationId ?? "").trim();
    const operation = findCronOperation(operationId);
    if (!operation) {
      return NextResponse.json({ error: "unknown operation" }, { status: 400 });
    }
    if (operation.run.type === "manual") {
      return NextResponse.json({ error: operation.run.reason }, { status: 400 });
    }

    const params = parseRunParams(body);
    const startedAt = Date.now();
    const result =
      operation.run.type === "gas"
        ? await runGasOperation(operation.run.functionName, params, operation.run.defaultArgs)
        : await runPwaOperation(req, operation.run.path, params, operation.run.defaultQuery ?? {});

    return NextResponse.json({
      ok: result.ok,
      operation: {
        id: operation.id,
        label: operation.label,
        layer: operation.layer,
        trigger: operation.trigger,
      },
      duration_ms: Date.now() - startedAt,
      request: result.request,
      response: result.response,
    }, { status: result.ok ? 200 : 502 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase() ?? "";
  if (!email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data: member, error } = await supabase
    .from("members")
    .select("is_admin")
    .eq("email", email)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!member?.is_admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return null;
}

function parseRunParams(body: RunPayload): RunParams {
  if (typeof body.paramsText === "string" && body.paramsText.trim()) {
    const parsed = JSON.parse(body.paramsText) as RunParams;
    return parsed && typeof parsed === "object" ? parsed : {};
  }
  if (body.params && typeof body.params === "object") return body.params as RunParams;
  return {};
}

async function runGasOperation(functionName: string, params: RunParams, defaultArgs: unknown[]) {
  const baseUrl = process.env.NEXT_PUBLIC_GAS_WEBAPP_URL || "";
  const apiKey = process.env.NEXT_PUBLIC_GAS_API_KEY || "";
  if (!baseUrl || !apiKey) throw new Error("GAS endpoint is not configured");

  const args = Array.isArray(params.args) ? params.args : defaultArgs;
  const url = new URL(baseUrl);
  url.searchParams.set("mode", "pwaApi");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("action", "runFunc");
  url.searchParams.set("fn", functionName);
  url.searchParams.set("args", JSON.stringify(args));

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(240000),
  });
  const parsed = await readResponse(response);
  const okBody = !parsed || !("ok" in parsed) || parsed.ok !== false;
  return {
    ok: response.ok && okBody,
    request: { type: "gas", functionName, args },
    response: { status: response.status, body: parsed },
  };
}

async function runPwaOperation(
  req: NextRequest,
  path: string,
  params: RunParams,
  defaultQuery: Record<string, string | number | boolean>
) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET is not configured");

  const query = normalizeQuery(params.query, defaultQuery);
  const url = new URL(path, req.nextUrl.origin);
  for (const [key, value] of Object.entries(query)) {
    if (value == null) continue;
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(240000),
  });
  const parsed = await readResponse(response);
  const okBody = !parsed || !("ok" in parsed) || parsed.ok !== false;
  return {
    ok: response.ok && okBody,
    request: { type: "pwa", path, query },
    response: { status: response.status, body: parsed },
  };
}

function normalizeQuery(input: unknown, fallback: Record<string, string | number | boolean>) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return fallback;
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    }
  }
  return out;
}

async function readResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { text: text.slice(0, 4000) };
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireMember } from "@/lib/supabase/api-auth";
import type {
  RegulationState,
  RegulationVersionState,
} from "@/lib/institution-regulations";

export const runtime = "nodejs";
const CELL_STATES = new Set<RegulationState>([
  "unconfirmed",
  "not_established",
  "drafting",
  "review",
  "approved",
  "effective",
  "not_applicable",
]);
const VERSION_STATES = new Set<RegulationVersionState>([
  "reference",
  "draft",
  "review",
  "approved",
  "effective",
  "superseded",
]);
const textValue = (value: unknown, max = 500) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export async function GET(request: NextRequest) {
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;
  const institutionId = request.nextUrl.searchParams.get("institutionId");
  let regulationsQuery = auth.supabase
    .from("institution_regulations")
    .select("*")
    .order("updated_at", { ascending: false });
  let cellsQuery = auth.supabase
    .from("institution_regulation_cells")
    .select("*");
  if (institutionId) {
    regulationsQuery = regulationsQuery.eq("institution_id", institutionId);
    cellsQuery = cellsQuery.eq("institution_id", institutionId);
  }
  const [typesResult, regulationsResult, cellsResult, memberResult] =
    await Promise.all([
      auth.supabase
        .from("institution_regulation_types")
        .select("*")
        .eq("is_active", true)
        .order("sort_order"),
      regulationsQuery,
      cellsQuery,
      auth.supabase
        .from("members")
        .select("is_admin")
        .eq("email", auth.user.email.toLowerCase())
        .maybeSingle(),
    ]);
  const firstError = [typesResult, regulationsResult, cellsResult].find(
    (result) => result.error,
  )?.error;
  if (firstError)
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  const regulationIds = (regulationsResult.data ?? []).map(
    (row) => row.regulation_id,
  );
  const versionsResult = regulationIds.length
    ? await auth.supabase
        .from("institution_regulation_versions")
        .select("*")
        .in("regulation_id", regulationIds)
        .order("version_date", { ascending: false, nullsFirst: false })
    : { data: [], error: null };
  if (versionsResult.error)
    return NextResponse.json(
      { error: versionsResult.error.message },
      { status: 500 },
    );
  return NextResponse.json({
    types: (typesResult.data ?? []).map((r) => ({
      regulationTypeId: r.regulation_type_id,
      groupKey: r.group_key,
      label: r.label,
      shortLabel: r.short_label,
      description: r.description,
      sortOrder: r.sort_order,
    })),
    regulations: (regulationsResult.data ?? []).map((r) => ({
      regulationId: r.regulation_id,
      institutionId: r.institution_id,
      title: r.title,
      stage: r.stage,
      lifecycleState: r.lifecycle_state,
      currentStateNote: r.current_state_note,
      nextGate: r.next_gate,
      nextGateTiming: r.next_gate_timing,
      updatedAt: r.updated_at,
    })),
    cells: (cellsResult.data ?? []).map((r) => ({
      institutionId: r.institution_id,
      regulationTypeId: r.regulation_type_id,
      regulationId: r.regulation_id,
      state: r.state,
      confirmedAt: r.confirmed_at,
    })),
    versions: (versionsResult.data ?? []).map((r) => ({
      versionId: r.version_id,
      regulationId: r.regulation_id,
      label: r.label,
      fileName: r.file_name,
      versionState: r.version_state,
      externalUrl: r.external_url,
      versionDate: r.version_date,
      isCurrent: r.is_current,
      createdAt: r.created_at,
    })),
    canEdit: Boolean(memberResult.data?.is_admin),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body)
    return NextResponse.json({ error: "入力形式が不正です" }, { status: 400 });
  if (body.action === "save_cell") {
    const institutionId = textValue(body.institutionId, 100);
    const regulationTypeId = textValue(body.regulationTypeId, 100);
    const state = textValue(body.state, 30) as RegulationState;
    if (!institutionId || !regulationTypeId || !CELL_STATES.has(state))
      return NextResponse.json(
        { error: "機関・規程種別・状態を確認してね" },
        { status: 400 },
      );
    let regulationId = textValue(body.regulationId, 150) || null;
    const needsDocument = [
      "drafting",
      "review",
      "approved",
      "effective",
    ].includes(state);
    if (regulationId || needsDocument) {
      const payload = {
        institution_id: institutionId,
        title: textValue(body.title, 300) || "名称未設定",
        stage: Math.max(0, Math.min(4, Number(body.stage) || 0)),
        lifecycle_state: [
          "drafting",
          "review",
          "approved",
          "effective",
          "superseded",
        ].includes(textValue(body.lifecycleState, 30))
          ? textValue(body.lifecycleState, 30)
          : "drafting",
        current_state_note: textValue(body.currentStateNote, 1000) || null,
        next_gate: textValue(body.nextGate, 500) || null,
        next_gate_timing: textValue(body.nextGateTiming, 200) || null,
        updated_by: auth.user.email,
        updated_at: new Date().toISOString(),
      };
      if (regulationId) {
        const { error } = await auth.supabase
          .from("institution_regulations")
          .update(payload)
          .eq("regulation_id", regulationId);
        if (error)
          return NextResponse.json({ error: error.message }, { status: 500 });
      } else {
        regulationId = `reg_${crypto.randomUUID()}`;
        const { error } = await auth.supabase
          .from("institution_regulations")
          .insert({ regulation_id: regulationId, ...payload });
        if (error)
          return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    const { error } = await auth.supabase
      .from("institution_regulation_cells")
      .upsert({
        institution_id: institutionId,
        regulation_type_id: regulationTypeId,
        regulation_id: regulationId,
        state,
        confirmed_at: new Date().toISOString().slice(0, 10),
        updated_by: auth.user.email,
        updated_at: new Date().toISOString(),
      });
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, regulationId });
  }
  if (body.action === "add_version") {
    const regulationId = textValue(body.regulationId, 150);
    const versionState = textValue(
      body.versionState,
      30,
    ) as RegulationVersionState;
    const externalUrl = textValue(body.externalUrl, 2000) || null;
    if (
      !regulationId ||
      !textValue(body.label, 200) ||
      !VERSION_STATES.has(versionState) ||
      (externalUrl && !externalUrl.startsWith("https://"))
    )
      return NextResponse.json(
        { error: "版名・状態・httpsリンクを確認してね" },
        { status: 400 },
      );
    const { error } = await auth.supabase
      .from("institution_regulation_versions")
      .insert({
        version_id: `regver_${crypto.randomUUID()}`,
        regulation_id: regulationId,
        label: textValue(body.label, 200),
        file_name: textValue(body.fileName, 500) || null,
        version_state: versionState,
        external_url: externalUrl,
        version_date: textValue(body.versionDate, 10) || null,
        is_current: body.isCurrent !== false,
        created_by: auth.user.email,
      });
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "操作が不正です" }, { status: 400 });
}

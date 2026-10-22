import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Choice = "yes" | "no" | "abstain";
type PreviewAgenda = {
  id: string; project_id: "preview"; meeting_kind: "management";
  title: string; motion: string; materials: string;
  proposed_by_kind: "member"; proposed_by_id: "preview-member";
  rule_version_id: string | null; opened_at: string | null;
  opened_by_kind: "member" | null; opened_by_id: string | null;
  deadline_at: null; closed_at: string | null;
  outcome: "approved" | "rejected" | "no_quorum" | null;
  cancel_reason: null; supersedes_agenda_id: string | null;
  created_at: string; status: "draft" | "open" | "closed";
  eligible_count: number; cast_count: number; my_vote: Choice | null;
  can_vote: boolean; tally: Record<Choice, number> | null;
};

const rule = {
  id: "preview-rule", version: 1, source_title: "表示確認用の架空規程",
  source_text: "これは画面表示と操作を試すための架空の経営会議規程です。実際の会社規程ではありません。",
  quorum_numerator: 1, quorum_denominator: 2, quorum_strict: true,
  approval_basis: "eligible", approval_numerator: 1, approval_denominator: 2, approval_strict: true,
  close_mode: "manual", manual_close_role: "any_executive", deadline_minutes: null,
  clause_reference: "表示確認用", published_at: "2026-10-22T00:00:00.000Z",
};

function initialAgendas(): PreviewAgenda[] {
  const now = new Date().toISOString();
  const common = {
    project_id: "preview" as const, meeting_kind: "management" as const,
    proposed_by_kind: "member" as const, proposed_by_id: "preview-member" as const,
    opened_by_kind: "member" as const, opened_by_id: "preview-member",
    deadline_at: null, cancel_reason: null, supersedes_agenda_id: null,
    created_at: now,
  };
  return [
    {
      ...common, id: "preview-agenda-1", title: "次年度事業計画案の承認",
      motion: "次年度の事業計画案について、重点施策と予算方針を承認する。",
      materials: "確認する点（架空の例）\n・重点施策と担当体制\n・研究開発費と資金繰り\n・実行後の見直し時期",
      status: "open", rule_version_id: rule.id, opened_at: now,
      closed_at: null, outcome: null, eligible_count: 3, cast_count: 1,
      my_vote: null, can_vote: true, tally: { yes: 1, no: 0, abstain: 0 },
    },
    {
      ...common, id: "preview-agenda-2", title: "開発方針の見直し",
      motion: "開発方針を見直し、次回会議までに改訂案を作成する。",
      materials: "表示確認用の架空の議案。",
      status: "closed", rule_version_id: rule.id, opened_at: now,
      closed_at: now, outcome: "approved", eligible_count: 3, cast_count: 3,
      my_vote: "yes", can_vote: false, tally: { yes: 2, no: 1, abstain: 0 },
    },
  ];
}

let agendas = initialAgendas();
let nextId = 3;

function localDevelopmentOnly(request: Request) {
  return process.env.NODE_ENV === "development" && /^(127\.0\.0\.1|localhost)$/.test(new URL(request.url).hostname);
}

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  if (!localDevelopmentOnly(request)) return new NextResponse(null, { status: 404 });
  if (new URL(request.url).searchParams.get("eligibility") === "1") {
    return NextResponse.json({ eligible: true }, { headers: noStore });
  }
  return NextResponse.json({
    viewer: { kind: "member", id: "preview-member", displayName: "表示確認", isAdmin: false },
    rule, rule_versions: [rule], roster_count: 3,
    agendas: agendas.map((agenda) => ({ ...agenda, tally: agenda.status === "closed" ? agenda.tally : null })),
  }, { headers: noStore });
}

export async function POST(request: Request) {
  if (!localDevelopmentOnly(request)) return new NextResponse(null, { status: 404 });
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!input || typeof input.action !== "string") return NextResponse.json({ error: "操作を確認できない" }, { status: 400, headers: noStore });
  if (input.action === "reset-preview") {
    agendas = initialAgendas();
    nextId = 3;
    return NextResponse.json({ ok: true }, { headers: noStore });
  }
  if (input.action === "create") {
    const title = typeof input.title === "string" ? input.title.trim() : "";
    const motion = typeof input.motion === "string" ? input.motion.trim() : "";
    if (!title || !motion) return NextResponse.json({ error: "議案名と決議文を入力" }, { status: 400, headers: noStore });
    const id = `preview-agenda-${nextId++}`;
    agendas.unshift({
      id, project_id: "preview", meeting_kind: "management", title, motion,
      materials: typeof input.materials === "string" ? input.materials : "",
      proposed_by_kind: "member", proposed_by_id: "preview-member",
      rule_version_id: null, opened_at: null, opened_by_kind: null, opened_by_id: null,
      deadline_at: null, closed_at: null, outcome: null, cancel_reason: null,
      supersedes_agenda_id: typeof input.supersedesAgendaId === "string" ? input.supersedesAgendaId : null,
      created_at: new Date().toISOString(), status: "draft", eligible_count: 0,
      cast_count: 0, my_vote: null, can_vote: false, tally: null,
    });
    return NextResponse.json({ id }, { headers: noStore });
  }
  const agenda = agendas.find((item) => item.id === input.agendaId);
  if (!agenda) return NextResponse.json({ error: "議案が見つからない" }, { status: 404, headers: noStore });
  if (input.action === "update" && agenda.status === "draft") {
    const title = typeof input.title === "string" ? input.title.trim() : "";
    const motion = typeof input.motion === "string" ? input.motion.trim() : "";
    if (!title || !motion) return NextResponse.json({ error: "議案名と決議文を入力" }, { status: 400, headers: noStore });
    agenda.title = title; agenda.motion = motion;
    agenda.materials = typeof input.materials === "string" ? input.materials : "";
    return NextResponse.json({ ok: true }, { headers: noStore });
  }
  if (input.action === "start" && agenda.status === "draft") {
    agenda.status = "open"; agenda.rule_version_id = rule.id;
    agenda.opened_at = new Date().toISOString(); agenda.opened_by_kind = "member";
    agenda.opened_by_id = "preview-member"; agenda.eligible_count = 3;
    agenda.cast_count = 0; agenda.can_vote = true;
    agenda.tally = { yes: 0, no: 0, abstain: 0 };
    return NextResponse.json({ ok: true }, { headers: noStore });
  }
  if (input.action === "vote" && agenda.status === "open" && agenda.can_vote && !agenda.my_vote) {
    if (input.choice !== "yes" && input.choice !== "no" && input.choice !== "abstain") return NextResponse.json({ error: "投票を選択" }, { status: 400, headers: noStore });
    agenda.my_vote = input.choice; agenda.can_vote = false; agenda.cast_count += 1;
    if (agenda.tally) agenda.tally[input.choice] += 1;
    return NextResponse.json({ ok: true }, { headers: noStore });
  }
  if (input.action === "close" && agenda.status === "open") {
    agenda.status = "closed"; agenda.closed_at = new Date().toISOString();
    agenda.outcome = agenda.cast_count <= agenda.eligible_count / 2 ? "no_quorum" : (agenda.tally?.yes ?? 0) > agenda.eligible_count / 2 ? "approved" : "rejected";
    return NextResponse.json({ ok: true }, { headers: noStore });
  }
  return NextResponse.json({ error: "この状態では操作できない" }, { status: 409, headers: noStore });
}

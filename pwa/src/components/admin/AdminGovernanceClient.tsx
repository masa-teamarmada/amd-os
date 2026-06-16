"use client";

/**
 * AdminGovernanceClient — 株主 / ラウンド / 総会 / 要対応 の CRUD UI。
 * API: /api/governance (entity=shareholder|round|meeting), /api/action-items
 * 設計: pwa/design/governance_action_items.md
 */

import { useCallback, useEffect, useMemo, useState } from "react";

export type PjOption = { projectId: string; projectName: string; status: string };

type Shareholder = {
  id: string; holder_type: string | null; holder_name: string; holder_member_id: string | null;
  share_class: string | null; shares: number | null; ownership_pct: number | null; invested_yen: number | null; as_of_ym: string | null; notes: string | null;
};
type Round = {
  id: string; round_name: string | null; round_date: string | null; round_ym: string | null;
  pre_money_yen: number | null; post_money_yen: number | null; raised_yen: number | null; price_per_share_yen: number | null; lead_investor: string | null; notes: string | null;
};
type Meeting = {
  id: string; meeting_type: string | null; meeting_date: string | null; meeting_ym: string | null; location: string | null;
  agenda_summary: string | null; resolutions_json?: { title?: string; result?: string }[] | null; amd_response: string | null; notes: string | null;
  attachments_json?: { name?: string; url?: string; webViewLink?: string; web_view_link?: string; folder_display_path?: string }[] | null;
};
type ActionItem = {
  action_id: string; title: string; category: string | null; due_at: string | null; status: string; action_url: string | null; daysLeft: number | null;
};

const num = (v: string) => (v.trim() === "" ? null : Number(v));
const txt = (v: string) => (v.trim() === "" ? null : v.trim());
const attachmentUrl = (a: { url?: string; webViewLink?: string; web_view_link?: string }) => a.url || a.webViewLink || a.web_view_link || "";

export function AdminGovernanceClient({ projects, initialProjectId }: { projects: PjOption[]; initialProjectId: string | null }) {
  const [projectId, setProjectId] = useState<string>(initialProjectId || projects[0]?.projectId || "");
  const [gov, setGov] = useState<{ shareholders: Shareholder[]; rounds: Round[]; meetings: Meeting[]; actionItems: ActionItem[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const load = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    fetch(`/api/governance?projectId=${encodeURIComponent(projectId)}`)
      .then((r) => r.json())
      .then((j) => { if (j?.ok) setGov(j); else setMsg(j?.error || "読み込み失敗"); })
      .catch((e) => setMsg(String(e)))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const post = async (entity: string, row: Record<string, unknown>) => {
    setMsg("");
    const r = await fetch("/api/governance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entity, row: { ...row, project_id: projectId } }) });
    const j = await r.json(); if (!j.ok) setMsg(j.error || "追加失敗"); else load();
  };
  const del = async (entity: string, id: string) => {
    if (!confirm("削除しますか？")) return;
    const r = await fetch(`/api/governance?entity=${entity}&id=${id}`, { method: "DELETE" });
    const j = await r.json(); if (!j.ok) setMsg(j.error || "削除失敗"); else load();
  };

  const pjLabel = useMemo(() => projects.find((p) => p.projectId === projectId), [projects, projectId]);

  return (
    <div className="space-y-5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-muted-foreground">PJ</label>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="rounded border border-border bg-background px-2 py-1 text-sm">
          {projects.map((p) => <option key={p.projectId} value={p.projectId}>{p.projectName} ({p.projectId}{p.status ? `・${p.status}` : ""})</option>)}
        </select>
        {loading && <span className="text-xs text-muted-foreground">読み込み中…</span>}
        {msg && <span className="text-xs text-rose-600">{msg}</span>}
      </div>

      {gov && (
        <>
          <Section title="株主構成 (キャップテーブル)">
            <Table head={["種別", "株主名", "株式種類", "株数", "比率%", "出資額", ""]}>
              {gov.shareholders.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <Td>{s.holder_type}</Td><Td>{s.holder_name}</Td><Td>{s.share_class}</Td>
                  <Td>{s.shares?.toLocaleString() ?? "—"}</Td><Td>{s.ownership_pct ?? "—"}</Td><Td>{s.invested_yen?.toLocaleString() ?? "—"}</Td>
                  <Td><DelBtn onClick={() => del("shareholder", s.id)} /></Td>
                </tr>
              ))}
            </Table>
            <AddForm
              fields={[
                { k: "holder_type", ph: "種別(amd/masa/founder/vc/angel/employee/other)" },
                { k: "holder_name", ph: "株主名*" },
                { k: "share_class", ph: "株式種類(普通株/優先株2nd...)" },
                { k: "shares", ph: "株数", num: true },
                { k: "ownership_pct", ph: "比率%", num: true },
                { k: "invested_yen", ph: "出資額(円)", num: true },
                { k: "as_of_ym", ph: "時点YYYYMM" },
              ]}
              required={["holder_name"]}
              onAdd={(v) => post("shareholder", { holder_type: txt(v.holder_type), holder_name: v.holder_name, share_class: txt(v.share_class), shares: num(v.shares), ownership_pct: num(v.ownership_pct), invested_yen: num(v.invested_yen), as_of_ym: txt(v.as_of_ym) })}
            />
          </Section>

          <Section title="資金調達ラウンド / バリュエーション">
            <Table head={["ラウンド", "日付", "調達額", "pre", "post", "1株単価", "Lead", ""]}>
              {gov.rounds.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <Td>{r.round_name}</Td><Td>{r.round_date}</Td><Td>{r.raised_yen?.toLocaleString() ?? "—"}</Td>
                  <Td>{r.pre_money_yen?.toLocaleString() ?? "—"}</Td><Td>{r.post_money_yen?.toLocaleString() ?? "—"}</Td>
                  <Td>{r.price_per_share_yen ?? "—"}</Td><Td>{r.lead_investor}</Td>
                  <Td><DelBtn onClick={() => del("round", r.id)} /></Td>
                </tr>
              ))}
            </Table>
            <AddForm
              fields={[
                { k: "round_name", ph: "ラウンド名* (優先株2nd等)" },
                { k: "round_date", ph: "日付YYYY-MM-DD" },
                { k: "raised_yen", ph: "調達額(円)", num: true },
                { k: "pre_money_yen", ph: "pre(円)", num: true },
                { k: "post_money_yen", ph: "post(円)", num: true },
                { k: "price_per_share_yen", ph: "1株単価(円)", num: true },
                { k: "lead_investor", ph: "Lead投資家" },
              ]}
              required={["round_name"]}
              onAdd={(v) => post("round", { round_name: v.round_name, round_date: txt(v.round_date), raised_yen: num(v.raised_yen), pre_money_yen: num(v.pre_money_yen), post_money_yen: num(v.post_money_yen), price_per_share_yen: num(v.price_per_share_yen), lead_investor: txt(v.lead_investor) })}
            />
          </Section>

          <Section title="株主総会・取締役会 / 決議">
            <Table head={["種別", "日付", "場所/方式", "議案・決議", "AMD対応", ""]}>
              {gov.meetings.map((m) => (
                <tr key={m.id} className="border-t border-border align-top">
                  <Td>{m.meeting_type}</Td><Td>{m.meeting_date}</Td><Td>{m.location}</Td>
                  <Td className="max-w-[360px]">
                    <div>{m.agenda_summary}</div>
                    {Array.isArray(m.resolutions_json) && m.resolutions_json.length > 0 && (
                      <div className="mt-0.5 text-muted-foreground">
                        決議: {m.resolutions_json.slice(0, 3).map((r) => `${r.title || ""}${r.result ? `(${r.result})` : ""}`).filter(Boolean).join(" / ")}
                      </div>
                    )}
                    {Array.isArray(m.attachments_json) && m.attachments_json.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {m.attachments_json.slice(0, 4).map((a, i) => (
                          attachmentUrl(a) ? (
                            <a key={i} href={attachmentUrl(a)} target="_blank" rel="noopener noreferrer" title={a.folder_display_path || undefined}
                              className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] hover:bg-muted hover:underline">
                              資料: {a.name || `${i + 1}`}
                            </a>
                          ) : (
                            <span key={i} className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">資料: {a.name || `${i + 1}`}</span>
                          )
                        ))}
                      </div>
                    )}
                  </Td>
                  <Td>{m.amd_response}</Td>
                  <Td><DelBtn onClick={() => del("meeting", m.id)} /></Td>
                </tr>
              ))}
            </Table>
            <AddForm
              fields={[
                { k: "meeting_type", ph: "種別(agm/egm/board/board_written_resolution)" },
                { k: "meeting_date", ph: "日付YYYY-MM-DD" },
                { k: "location", ph: "場所/方式(書面決議など)" },
                { k: "agenda_summary", ph: "議案要約*" },
                { k: "resolutions", ph: "決議( / 区切り)" },
                { k: "amd_response", ph: "AMD対応(proxy/attended/consented/abstained/none)" },
              ]}
              required={["agenda_summary"]}
              onAdd={(v) => post("meeting", {
                meeting_type: txt(v.meeting_type),
                meeting_date: txt(v.meeting_date),
                meeting_ym: v.meeting_date ? v.meeting_date.replace(/-/g, "").slice(0, 6) : null,
                location: txt(v.location),
                agenda_summary: v.agenda_summary,
                resolutions_json: parseResolutionLines(v.resolutions),
                amd_response: txt(v.amd_response),
              })}
            />
          </Section>

          <Section title={`要対応 (${pjLabel?.projectName ?? projectId})`}>
            <Table head={["状態", "期日", "区分", "件名", "リンク"]}>
              {gov.actionItems.map((a) => (
                <tr key={a.action_id} className="border-t border-border">
                  <Td>{a.status}</Td><Td>{a.due_at?.slice(0, 10) ?? "—"}</Td><Td>{a.category}</Td><Td className="max-w-[320px]">{a.title}</Td>
                  <Td>{a.action_url ? <a className="underline" href={a.action_url} target="_blank" rel="noopener noreferrer">開く</a> : "—"}</Td>
                </tr>
              ))}
            </Table>
            <ActionAddForm projectId={projectId} onAdded={load} />
          </Section>
        </>
      )}
    </div>
  );
}

function parseResolutionLines(value = "") {
  return value
    .split(/[／/、\n]/)
    .map((v) => v.trim())
    .filter(Boolean)
    .map((title) => ({ title, result: "unknown" }));
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-background">
      <div className="border-b border-border px-3 py-2 text-[13px] font-semibold">{title}</div>
      <div className="p-3 space-y-2">{children}</div>
    </section>
  );
}
function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full text-[11px]">
      <thead><tr className="text-left text-muted-foreground">{head.map((h, i) => <th key={i} className="pb-1 pr-2 font-medium">{h}</th>)}</tr></thead>
      <tbody>{children}</tbody>
    </table>
  );
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`py-1 pr-2 align-top ${className}`}>{children}</td>;
}
function DelBtn({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-rose-600">削除</button>;
}

function AddForm({ fields, required, onAdd }: { fields: { k: string; ph: string; num?: boolean }[]; required: string[]; onAdd: (v: Record<string, string>) => void }) {
  const [v, setV] = useState<Record<string, string>>({});
  const ok = required.every((k) => (v[k] ?? "").trim() !== "");
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
      {fields.map((f) => (
        <input key={f.k} value={v[f.k] ?? ""} placeholder={f.ph} onChange={(e) => setV((p) => ({ ...p, [f.k]: e.target.value }))}
          className="rounded border border-border bg-background px-1.5 py-0.5 text-[11px]" style={{ width: f.num ? 90 : 150 }} />
      ))}
      <button disabled={!ok} onClick={() => { onAdd(v); setV({}); }}
        className="rounded border border-border bg-background px-2 py-0.5 text-[11px] hover:bg-muted disabled:opacity-40">追加</button>
    </div>
  );
}

function ActionAddForm({ projectId, onAdded }: { projectId: string; onAdded: () => void }) {
  const [v, setV] = useState<{ title: string; category: string; due_at: string; action_url: string }>({ title: "", category: "governance", due_at: "", action_url: "" });
  const add = async () => {
    if (!v.title.trim()) return;
    const r = await fetch("/api/action-items", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, scope: "project", title: v.title, category: v.category, due_at: v.due_at ? new Date(v.due_at).toISOString() : null, action_url: txt(v.action_url) }),
    });
    const j = await r.json(); if (j.ok) { setV({ title: "", category: "governance", due_at: "", action_url: "" }); onAdded(); }
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
      <input value={v.title} placeholder="件名*" onChange={(e) => setV((p) => ({ ...p, title: e.target.value }))} className="rounded border border-border bg-background px-1.5 py-0.5 text-[11px]" style={{ width: 220 }} />
      <input value={v.category} placeholder="区分" onChange={(e) => setV((p) => ({ ...p, category: e.target.value }))} className="rounded border border-border bg-background px-1.5 py-0.5 text-[11px]" style={{ width: 110 }} />
      <input type="date" value={v.due_at} onChange={(e) => setV((p) => ({ ...p, due_at: e.target.value }))} className="rounded border border-border bg-background px-1.5 py-0.5 text-[11px]" />
      <input value={v.action_url} placeholder="対応リンク" onChange={(e) => setV((p) => ({ ...p, action_url: e.target.value }))} className="rounded border border-border bg-background px-1.5 py-0.5 text-[11px]" style={{ width: 180 }} />
      <button disabled={!v.title.trim()} onClick={add} className="rounded border border-border bg-background px-2 py-0.5 text-[11px] hover:bg-muted disabled:opacity-40">要対応を追加</button>
    </div>
  );
}

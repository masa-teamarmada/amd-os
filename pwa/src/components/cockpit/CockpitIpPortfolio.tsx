"use client";

/**
 * CockpitIpPortfolio — PJ コックピット「知財」タブ本体 (まさ依頼 2026-08-21)。
 *
 * スコープは AMD 自社知財だけでなく、その技術領域の IP 全体マップ (before zero の定石):
 * 自社 / 大学基本特許 / 共同出願 / 他社の障害特許 / ウォッチ を同じ台帳に載せる。
 * 構成: サマリ帯 → ⏰期限 → 🗺️特許マップ → 立場別リスト → 詳細モーダル。
 * read = ログイン済みメンバー、write = admin (API 側で判定し canEdit で返る)。
 * API: /api/project-ip / migration: scripts/migrations/308_project_ip_ledger.sql
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { PatentMap } from "./PatentMap";
import {
  AGREEMENT_LABEL, CLAIM_BREADTH_LABEL, DEADLINE_KIND_LABEL, EVENT_KIND_LABEL,
  HOLDER_KIND_LABEL, IP_KIND_LABEL, IP_STATUS_LABEL, LICENSE_LABEL,
  RELATION_META, RELATION_ORDER, THREAT_LABEL,
  daysUntil, externalSearchUrl,
  type IpAsset, type IpDeadline, type IpEvent, type IpRelation, type IpRight,
} from "@/lib/project-ip";

type Bundle = {
  canEdit: boolean;
  assets: IpAsset[];
  deadlines: IpDeadline[];
  rights: IpRight[];
  events: IpEvent[];
};

const GROUPS: { key: string; title: string; relations: IpRelation[]; hint: string }[] = [
  { key: "own", title: "🛡 自社・共同の権利", relations: ["own", "joint"], hint: "AMD / PJ法人が持つ、または共同出願している権利" },
  { key: "university", title: "🏛 大学の基本特許", relations: ["university"], hint: "実施許諾・不実施補償の交渉対象になる大学側の権利" },
  { key: "blocking", title: "⚠️ 障害特許・ウォッチ", relations: ["blocking", "watch"], hint: "他社が押さえていて回避 or ライセンスが要る権利" },
];

export function CockpitIpPortfolio({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<IpAsset | "new" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/project-ip?projectId=${encodeURIComponent(projectId)}`);
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || "読み込みに失敗した");
      setData({ canEdit: !!j.canEdit, assets: j.assets ?? [], deadlines: j.deadlines ?? [], rights: j.rights ?? [], events: j.events ?? [] });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const assets = data?.assets ?? [];
  const selected = useMemo(() => assets.find((a) => a.ip_asset_id === selectedId) ?? null, [assets, selectedId]);

  const counts = useMemo(() => {
    const m = {} as Record<IpRelation, number>;
    for (const r of RELATION_ORDER) m[r] = 0;
    for (const a of assets) m[a.relation] = (m[a.relation] ?? 0) + 1;
    return m;
  }, [assets]);

  const openDeadlines = useMemo(
    () => (data?.deadlines ?? []).filter((d) => d.status === "open").sort((a, b) => a.due_on.localeCompare(b.due_on)),
    [data?.deadlines],
  );

  if (loading && !data) return <div className="rounded-lg border border-border bg-background px-3 py-6 text-[11px] text-muted-foreground">知財台帳を読み込み中…</div>;
  if (error) return <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-[11px] text-rose-700">知財台帳の読み込みに失敗した: {error}</div>;

  return (
    <div className="space-y-3" data-testid="cockpit-ip-tab">
      {/* サマリ帯 */}
      <section className="rounded-lg border border-border bg-background px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[13px] font-semibold">📜 知財ポートフォリオ</h2>
          {RELATION_ORDER.map((r) => (
            <span key={r} className={`rounded border px-1.5 py-0.5 text-[10px] ${RELATION_META[r].cls}`}>
              {RELATION_META[r].label} <span className="font-semibold tabular-nums">{counts[r]}</span>
            </span>
          ))}
          {data?.canEdit && (
            <button
              type="button"
              onClick={() => setEditing("new")}
              className="ml-auto rounded border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
            >＋ 追加</button>
          )}
        </div>
        {assets.length === 0 && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            この PJ の知財はまだ登録されていない。自社出願だけでなく、大学の基本特許・他社の障害特許まで載せると before zero の判断材料になる。
          </p>
        )}
      </section>

      {/* 期限 */}
      {openDeadlines.length > 0 && (
        <section className="rounded-lg border border-border bg-background">
          <div className="border-b border-border px-3 py-2 text-[13px] font-semibold">⏰ 期限</div>
          <div className="divide-y divide-border text-[11px]">
            {openDeadlines.map((d) => {
              const left = daysUntil(d.due_on);
              const cls = left < 0 ? "border-rose-200 bg-rose-50 text-rose-700"
                : left <= 30 ? "border-rose-200 bg-rose-50 text-rose-700"
                : left <= 90 ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-border bg-muted/40 text-muted-foreground";
              const asset = assets.find((a) => a.ip_asset_id === d.ip_asset_id);
              return (
                <button
                  key={d.ip_deadline_id}
                  type="button"
                  onClick={() => asset && setSelectedId(asset.ip_asset_id)}
                  className="flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 px-3 py-2 text-left hover:bg-muted/40"
                >
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] ${cls}`}>
                    {left < 0 ? `${-left}日超過` : `あと${left}日`}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{d.due_on}</span>
                  <span className="font-medium">{DEADLINE_KIND_LABEL[d.deadline_kind] ?? d.deadline_kind}</span>
                  {d.label && <span className="text-muted-foreground">{d.label}</span>}
                  {asset && <span className="text-[10px] text-muted-foreground">— {asset.title}</span>}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 特許マップ */}
      <PatentMap assets={assets} onSelect={(a) => setSelectedId(a.ip_asset_id)} />

      {/* 立場別リスト */}
      {GROUPS.map((g) => {
        const list = assets.filter((a) => g.relations.includes(a.relation));
        if (list.length === 0) return null;
        return (
          <section key={g.key} className="rounded-lg border border-border bg-background">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
              <h2 className="text-[13px] font-semibold">{g.title}</h2>
              <span className="text-[10px] text-muted-foreground">{g.hint}</span>
              <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">{list.length}件</span>
            </div>
            <div className="divide-y divide-border text-[11px]">
              {list.map((a) => {
                const dl = openDeadlines.filter((d) => d.ip_asset_id === a.ip_asset_id);
                const threat = a.threat_level ? THREAT_LABEL[a.threat_level] : null;
                return (
                  <button
                    key={a.ip_asset_id}
                    type="button"
                    onClick={() => setSelectedId(a.ip_asset_id)}
                    className="flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 px-3 py-2 text-left hover:bg-muted/40"
                  >
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] ${RELATION_META[a.relation].cls}`}>{RELATION_META[a.relation].short}</span>
                    <span className="font-medium">{a.title}</span>
                    <span className="rounded border border-border bg-muted/30 px-1 py-0 text-[9px] text-muted-foreground">
                      {IP_KIND_LABEL[a.ip_kind] ?? a.ip_kind}/{a.jurisdiction}
                    </span>
                    <span className="text-muted-foreground">{IP_STATUS_LABEL[a.status] ?? a.status}</span>
                    {a.application_number && <span className="tabular-nums text-[10px] text-muted-foreground">{a.application_number}</span>}
                    {a.applicants?.[0] && <span className="text-[10px] text-muted-foreground">{a.applicants.join(" / ")}</span>}
                    {threat && <span className={`rounded border px-1 py-0 text-[9px] ${threat.cls}`}>{threat.txt}</span>}
                    {dl.length > 0 && <span className="rounded border border-amber-200 bg-amber-50 px-1 py-0 text-[9px] text-amber-700">期限{dl.length}</span>}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      {selected && (
        <AssetDetail
          asset={selected}
          rights={(data?.rights ?? []).filter((r) => r.ip_asset_id === selected.ip_asset_id)}
          events={(data?.events ?? []).filter((e) => e.ip_asset_id === selected.ip_asset_id)}
          deadlines={(data?.deadlines ?? []).filter((d) => d.ip_asset_id === selected.ip_asset_id)}
          canEdit={!!data?.canEdit}
          onClose={() => setSelectedId(null)}
          onEdit={() => { setEditing(selected); setSelectedId(null); }}
          onChanged={load}
        />
      )}

      {editing && (
        <AssetForm
          projectId={projectId}
          asset={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load(); }}
        />
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div
        className="mt-8 w-full max-w-2xl rounded-lg border border-border bg-background shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <h3 className="text-[13px] font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="ml-auto rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted">閉じる</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  if (children == null || children === "" || children === false) return null;
  return (
    <div className="flex gap-2 px-3 py-1.5">
      <span className="w-28 shrink-0 text-[10px] text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 text-[11px]">{children}</span>
    </div>
  );
}

function AssetDetail({
  asset, rights, events, deadlines, canEdit, onClose, onEdit, onChanged,
}: {
  asset: IpAsset; rights: IpRight[]; events: IpEvent[]; deadlines: IpDeadline[];
  canEdit: boolean; onClose: () => void; onEdit: () => void; onChanged: () => void;
}) {
  const link = externalSearchUrl(asset);
  const [busy, setBusy] = useState(false);

  const closeDeadline = async (id: string) => {
    setBusy(true);
    await fetch("/api/project-ip", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entity: "deadline", id, patch: { status: "done" } }),
    });
    setBusy(false);
    onChanged();
  };

  return (
    <Modal title={asset.title} onClose={onClose}>
      <div className="divide-y divide-border">
        <div className="py-1">
          <Row label="立場">
            <span className={`rounded border px-1.5 py-0.5 text-[10px] ${RELATION_META[asset.relation].cls}`}>{RELATION_META[asset.relation].label}</span>
          </Row>
          <Row label="種別 / 国">{`${IP_KIND_LABEL[asset.ip_kind] ?? asset.ip_kind} / ${asset.jurisdiction}`}</Row>
          <Row label="ステータス">{IP_STATUS_LABEL[asset.status] ?? asset.status}</Row>
          <Row label="出願番号">{asset.application_number}</Row>
          <Row label="公開番号">{asset.publication_number}</Row>
          <Row label="登録番号">{asset.registration_number}</Row>
          <Row label="出願日">{asset.application_date}</Row>
          <Row label="公開日">{asset.publication_date}</Row>
          <Row label="登録日">{asset.registration_date}</Row>
          <Row label="満了日">{asset.expiry_date}</Row>
          <Row label="出願人">{asset.applicants?.join(" / ")}</Row>
          <Row label="発明者">{asset.inventors?.join(" / ")}</Row>
          <Row label="技術区分">{asset.tech_domain}</Row>
          <Row label="IPC / CPC">{[...(asset.ipc_codes ?? []), ...(asset.cpc_codes ?? [])].join(" / ")}</Row>
          <Row label="権利範囲">{asset.claim_breadth ? CLAIM_BREADTH_LABEL[asset.claim_breadth] : null}</Row>
          <Row label="重要度">{`${asset.importance} / 5`}</Row>
          <Row label="脅威度">{asset.threat_level ? (THREAT_LABEL[asset.threat_level]?.txt ?? asset.threat_level) : null}</Row>
          <Row label="要約">{asset.abstract_text}</Row>
          <Row label="メモ">{asset.note_md}</Row>
          <Row label="出典">{`${asset.source_kind}${asset.external_sync_at ? ` (同期 ${asset.external_sync_at.slice(0, 10)})` : ""}`}</Row>
          {link && (
            <Row label="外部">
              <a href={link.url} target="_blank" rel="noreferrer" className="underline">{link.label}</a>
            </Row>
          )}
        </div>

        {deadlines.length > 0 && (
          <div className="px-3 py-2">
            <div className="mb-1 text-[11px] font-semibold">⏰ 期限</div>
            <div className="space-y-1 text-[11px]">
              {deadlines.map((d) => (
                <div key={d.ip_deadline_id} className="flex flex-wrap items-center gap-2">
                  <span className="tabular-nums text-muted-foreground">{d.due_on}</span>
                  <span>{DEADLINE_KIND_LABEL[d.deadline_kind] ?? d.deadline_kind}</span>
                  {d.label && <span className="text-muted-foreground">{d.label}</span>}
                  <span className="rounded border border-border bg-muted/30 px-1 py-0 text-[9px] text-muted-foreground">{d.status}</span>
                  {canEdit && d.status === "open" && (
                    <button type="button" disabled={busy} onClick={() => closeDeadline(d.ip_deadline_id)} className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-muted">完了にする</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {rights.length > 0 && (
          <div className="px-3 py-2">
            <div className="mb-1 text-[11px] font-semibold">🤝 権利者・ライセンス</div>
            <div className="space-y-1 text-[11px]">
              {rights.map((r) => (
                <div key={r.ip_right_id} className="flex flex-wrap items-center gap-2">
                  <span className="rounded border border-border bg-muted/30 px-1 py-0 text-[9px] text-muted-foreground">{HOLDER_KIND_LABEL[r.holder_kind] ?? r.holder_kind}</span>
                  <span className="font-medium">{r.holder_name}</span>
                  {r.share_pct != null && <span className="tabular-nums">{r.share_pct}%</span>}
                  <span>実施許諾: {LICENSE_LABEL[r.license_to_project] ?? r.license_to_project}</span>
                  <span className="text-muted-foreground">契約: {AGREEMENT_LABEL[r.license_agreement_status] ?? r.license_agreement_status}</span>
                  {r.non_practice_compensation && <span className="text-muted-foreground">不実施補償: {r.non_practice_compensation}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {events.length > 0 && (
          <div className="px-3 py-2">
            <div className="mb-1 text-[11px] font-semibold">🕘 経緯</div>
            <div className="space-y-1 text-[11px]">
              {events.map((e) => (
                <div key={e.ip_event_id} className="flex flex-wrap items-baseline gap-2">
                  <span className="tabular-nums text-muted-foreground">{e.event_date}</span>
                  <span className="rounded border border-border bg-muted/30 px-1 py-0 text-[9px] text-muted-foreground">{EVENT_KIND_LABEL[e.event_kind] ?? e.event_kind}</span>
                  <span>{e.title}</span>
                  {e.detail && <span className="text-muted-foreground">{e.detail}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {canEdit && (
          <div className="flex gap-2 px-3 py-2">
            <button type="button" onClick={onEdit} className="rounded border border-border px-2 py-1 text-[11px] hover:bg-muted">編集</button>
          </div>
        )}
      </div>
    </Modal>
  );
}

const TEXT_FIELDS: { key: keyof IpAsset; label: string; placeholder?: string }[] = [
  { key: "application_number", label: "出願番号", placeholder: "特願2025-123456" },
  { key: "publication_number", label: "公開番号", placeholder: "特開2026-000000" },
  { key: "registration_number", label: "登録番号" },
  { key: "tech_domain", label: "技術区分", placeholder: "特許マップのX軸になる" },
  { key: "family_key", label: "ファミリー" },
  { key: "external_url", label: "外部URL" },
];
const DATE_FIELDS: { key: keyof IpAsset; label: string }[] = [
  { key: "application_date", label: "出願日" },
  { key: "publication_date", label: "公開日" },
  { key: "registration_date", label: "登録日" },
  { key: "expiry_date", label: "満了日" },
];

function AssetForm({
  projectId, asset, onClose, onSaved,
}: { projectId: string; asset: IpAsset | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Record<string, unknown>>(() => ({
    relation: asset?.relation ?? "own",
    ip_kind: asset?.ip_kind ?? "patent",
    title: asset?.title ?? "",
    jurisdiction: asset?.jurisdiction ?? "JP",
    status: asset?.status ?? "unknown",
    importance: asset?.importance ?? 3,
    claim_breadth: asset?.claim_breadth ?? "",
    threat_level: asset?.threat_level ?? "",
    abstract_text: asset?.abstract_text ?? "",
    note_md: asset?.note_md ?? "",
    applicants: (asset?.applicants ?? []).join(", "),
    inventors: (asset?.inventors ?? []).join(", "),
    ipc_codes: (asset?.ipc_codes ?? []).join(", "),
    ...Object.fromEntries(TEXT_FIELDS.map((f) => [f.key, (asset?.[f.key] as string | null) ?? ""])),
    ...Object.fromEntries(DATE_FIELDS.map((f) => [f.key, (asset?.[f.key] as string | null) ?? ""])),
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!String(form.title).trim()) { setErr("タイトルは必須"); return; }
    setBusy(true);
    setErr(null);
    const list = (v: unknown) => String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const row: Record<string, unknown> = {
      project_id: projectId,
      relation: form.relation,
      ip_kind: form.ip_kind,
      title: String(form.title).trim(),
      jurisdiction: String(form.jurisdiction || "JP").toUpperCase(),
      status: form.status,
      importance: Number(form.importance) || 3,
      claim_breadth: form.claim_breadth === "" ? null : Number(form.claim_breadth),
      threat_level: form.threat_level === "" ? null : form.threat_level,
      abstract_text: String(form.abstract_text || "") || null,
      note_md: String(form.note_md || "") || null,
      applicants: list(form.applicants),
      inventors: list(form.inventors),
      ipc_codes: list(form.ipc_codes),
    };
    for (const f of [...TEXT_FIELDS, ...DATE_FIELDS]) {
      row[f.key as string] = String(form[f.key as string] || "") || null;
    }
    const res = await fetch("/api/project-ip", {
      method: asset ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(asset ? { entity: "asset", id: asset.ip_asset_id, patch: row } : { entity: "asset", row }),
    });
    const j = await res.json().catch(() => null);
    setBusy(false);
    if (!j?.ok) { setErr(j?.error || "保存に失敗した"); return; }
    onSaved();
  };

  const remove = async () => {
    if (!asset) return;
    if (!window.confirm(`「${asset.title}」を台帳から削除する。よい?`)) return;
    setBusy(true);
    await fetch(`/api/project-ip?entity=asset&id=${encodeURIComponent(asset.ip_asset_id)}`, { method: "DELETE" });
    setBusy(false);
    onSaved();
  };

  const input = "w-full rounded border border-border bg-background px-2 py-1 text-[11px]";

  return (
    <Modal title={asset ? "知財を編集" : "知財を追加"} onClose={onClose}>
      <div className="space-y-2 px-3 py-3">
        <label className="block">
          <span className="text-[10px] text-muted-foreground">タイトル *</span>
          <input className={input} value={String(form.title)} onChange={(e) => set("title", e.target.value)} />
        </label>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label className="block">
            <span className="text-[10px] text-muted-foreground">立場</span>
            <select className={input} value={String(form.relation)} onChange={(e) => set("relation", e.target.value)}>
              {RELATION_ORDER.map((r) => <option key={r} value={r}>{RELATION_META[r].label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] text-muted-foreground">種別</span>
            <select className={input} value={String(form.ip_kind)} onChange={(e) => set("ip_kind", e.target.value)}>
              {Object.entries(IP_KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] text-muted-foreground">国</span>
            <input className={input} value={String(form.jurisdiction)} onChange={(e) => set("jurisdiction", e.target.value)} />
          </label>
          <label className="block">
            <span className="text-[10px] text-muted-foreground">ステータス</span>
            <select className={input} value={String(form.status)} onChange={(e) => set("status", e.target.value)}>
              {Object.entries(IP_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TEXT_FIELDS.map((f) => (
            <label key={String(f.key)} className="block">
              <span className="text-[10px] text-muted-foreground">{f.label}</span>
              <input className={input} placeholder={f.placeholder} value={String(form[f.key as string] ?? "")} onChange={(e) => set(f.key as string, e.target.value)} />
            </label>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {DATE_FIELDS.map((f) => (
            <label key={String(f.key)} className="block">
              <span className="text-[10px] text-muted-foreground">{f.label}</span>
              <input type="date" className={input} value={String(form[f.key as string] ?? "")} onChange={(e) => set(f.key as string, e.target.value)} />
            </label>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <label className="block">
            <span className="text-[10px] text-muted-foreground">重要度 (マップの大きさ)</span>
            <select className={input} value={String(form.importance)} onChange={(e) => set("importance", e.target.value)}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] text-muted-foreground">権利範囲 (マップのY軸)</span>
            <select className={input} value={String(form.claim_breadth)} onChange={(e) => set("claim_breadth", e.target.value)}>
              <option value="">未評価</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{CLAIM_BREADTH_LABEL[n]}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] text-muted-foreground">脅威度</span>
            <select className={input} value={String(form.threat_level)} onChange={(e) => set("threat_level", e.target.value)}>
              <option value="">未評価</option>
              {Object.entries(THREAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v.txt}</option>)}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label className="block">
            <span className="text-[10px] text-muted-foreground">出願人 (カンマ区切り)</span>
            <input className={input} value={String(form.applicants)} onChange={(e) => set("applicants", e.target.value)} />
          </label>
          <label className="block">
            <span className="text-[10px] text-muted-foreground">発明者 (カンマ区切り)</span>
            <input className={input} value={String(form.inventors)} onChange={(e) => set("inventors", e.target.value)} />
          </label>
          <label className="block">
            <span className="text-[10px] text-muted-foreground">IPC (カンマ区切り)</span>
            <input className={input} value={String(form.ipc_codes)} onChange={(e) => set("ipc_codes", e.target.value)} />
          </label>
        </div>

        <label className="block">
          <span className="text-[10px] text-muted-foreground">要約</span>
          <textarea className={`${input} h-16`} value={String(form.abstract_text)} onChange={(e) => set("abstract_text", e.target.value)} />
        </label>
        <label className="block">
          <span className="text-[10px] text-muted-foreground">メモ</span>
          <textarea className={`${input} h-16`} value={String(form.note_md)} onChange={(e) => set("note_md", e.target.value)} />
        </label>

        {err && <p className="text-[11px] text-rose-600">{err}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" disabled={busy} onClick={submit} className="rounded border border-foreground bg-foreground px-3 py-1 text-[11px] text-background disabled:opacity-50">保存</button>
          <button type="button" onClick={onClose} className="rounded border border-border px-3 py-1 text-[11px] hover:bg-muted">キャンセル</button>
          {asset && <button type="button" disabled={busy} onClick={remove} className="ml-auto rounded border border-rose-200 px-3 py-1 text-[11px] text-rose-600 hover:bg-rose-50">削除</button>}
        </div>
      </div>
    </Modal>
  );
}

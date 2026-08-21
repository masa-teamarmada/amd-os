"use client";

/**
 * CockpitIpPortfolio — PJ コックピット「知財」タブ本体 (まさ依頼 2026-08-21)。
 *
 * スコープは AMD 自社知財だけでなく、その技術領域の IP 全体マップ (before zero の定石):
 * 自社 / 大学基本特許 / 共同出願 / 他社の障害特許 / ウォッチ を同じ台帳に載せる。
 * 構成: サマリ帯 → ⏰期限 → 🗺️特許マップ → 立場別テーブル → 詳細モーダル。
 * read = ログイン済みメンバー、write = admin (API 側で判定し canEdit で返る)。
 * API: /api/project-ip / migration: scripts/migrations/308_project_ip_ledger.sql
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { PatentMap } from "./PatentMap";
import {
  AGREEMENT_LABEL, CLAIM_BREADTH_LABEL, DEADLINE_KIND_LABEL, EVENT_KIND_LABEL,
  HOLDER_KIND_LABEL, IP_KIND_LABEL, IP_STATUS_LABEL, LICENSE_LABEL,
  RELATION_META, RELATION_ORDER, THREAT_LABEL,
  ANNUITY_LABEL, PCT_LABEL, PRACTICE_LABEL,
  daysUntil, externalSearchUrl, verifyFreshness,
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

/**
 * 立場別テーブルの見出し。名称列 (先頭固定) 以外をこの順で並べる。
 * tbody 側の <Cell> の並びと 1:1 で対応するので、片方だけ足さないこと。
 */
const HEAD: { txt: string; title?: string; right?: boolean }[] = [
  { txt: "状態" },
  { txt: "年金", title: "特許料 (年金) の納付状況。不納だと権利が消滅する" },
  { txt: "年金納付済", title: "何年分まで納付済みか = その日までは権利が生きている" },
  { txt: "審査請求", title: "審査請求日。未請求のまま出願から3年で取下げ擬制になる" },
  { txt: "外国", title: "PCT・外国出願の現況" },
  { txt: "PCT番号" },
  { txt: "鮮度", title: "最後に現況を確認した日。1年以上前なら要再調査" },
  { txt: "技術区分" },
  { txt: "出願番号" },
  { txt: "公開番号" },
  { txt: "登録番号" },
  { txt: "優先日", title: "存続期間20年 / PCT30ヶ月 / 優先権12ヶ月の起点" },
  { txt: "出願日" },
  { txt: "登録日" },
  { txt: "満了日" },
  { txt: "出願人" },
  { txt: "現権利者", title: "移転があると出願人と一致しない" },
  { txt: "実施", title: "自社事業での実施状況" },
  { txt: "年間費用", right: true, title: "年間の維持コスト (円)" },
  { txt: "担当" },
  { txt: "代理人" },
  { txt: "ファミリー" },
  { txt: "ファミリー数", right: true, title: "同一発明の他国出願数 (外部API同期で埋まる)" },
  { txt: "被引用", right: true, title: "被引用数 (外部API同期で埋まる)" },
  { txt: "範囲", right: true, title: "権利範囲の広さ 1-5 (5=上位概念で広い)" },
  { txt: "重要", right: true, title: "重要度 1-5" },
  { txt: "注意" },
];

function Cell({ children, dim, right, wrap, title }: {
  children: React.ReactNode; dim?: boolean; right?: boolean; wrap?: boolean; title?: string;
}) {
  return (
    <td
      title={title}
      className={`px-2 py-1.5 ${wrap ? "" : "whitespace-nowrap"} ${right ? "text-right tabular-nums" : ""} ${dim ? "text-muted-foreground" : ""}`}
    >
      {children}
    </td>
  );
}

function Chip({ meta }: { meta: { txt: string; cls: string } }) {
  return <span className={`rounded border px-1 py-0 text-[9px] ${meta.cls}`}>{meta.txt}</span>;
}

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

      {/* 立場別テーブル */}
      {GROUPS.map((g) => {
        const list = assets
          .filter((a) => g.relations.includes(a.relation))
          .slice()
          .sort((x, y) =>
            RELATION_ORDER.indexOf(x.relation) - RELATION_ORDER.indexOf(y.relation) ||
            y.importance - x.importance ||
            String(y.application_number ?? "").localeCompare(String(x.application_number ?? "")));
        if (list.length === 0) return null;
        return (
          <section key={g.key} className="rounded-lg border border-border bg-background">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
              <h2 className="text-[13px] font-semibold">{g.title}</h2>
              <span className="text-[10px] text-muted-foreground">{g.hint}</span>
              <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">{list.length}件</span>
            </div>
            {/* 列が多いので、先頭列 (名称) と見出し行を固定して横スクロールさせる (まさ指示 2026-08-21)。
                overflow-x-auto だけだと overflow-y が auto になって sticky が効かないため、両軸スクロールの箱にする。 */}
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-max min-w-full border-collapse text-[11px]">
                <thead>
                  <tr className="text-[10px] text-muted-foreground">
                    <th className="sticky left-0 top-0 z-30 min-w-[220px] border-b border-r border-border bg-muted px-2 py-1.5 text-left font-medium">名称</th>
                    {HEAD.map((h) => (
                      <th
                        key={h.txt}
                        title={h.title}
                        className={`sticky top-0 z-20 whitespace-nowrap border-b border-border bg-muted px-2 py-1.5 font-medium ${h.right ? "text-right" : "text-left"}`}
                      >
                        {h.txt}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {list.map((a) => {
                    const dl = openDeadlines.filter((d) => d.ip_asset_id === a.ip_asset_id);
                    const threat = a.threat_level ? THREAT_LABEL[a.threat_level] : null;
                    const annuity = ANNUITY_LABEL[a.annuity_status] ?? ANNUITY_LABEL.unknown;
                    const pct = PCT_LABEL[a.pct_status] ?? PCT_LABEL.unknown;
                    const fresh = verifyFreshness(a.last_verified_on);
                    return (
                      <tr
                        key={a.ip_asset_id}
                        onClick={() => setSelectedId(a.ip_asset_id)}
                        className="group cursor-pointer align-top hover:bg-muted"
                      >
                        <td className="sticky left-0 z-10 border-r border-border bg-background px-2 py-1.5 group-hover:bg-muted">
                          <span className={`mr-1.5 rounded border px-1 py-0 text-[9px] ${RELATION_META[a.relation].cls}`}>
                            {RELATION_META[a.relation].short}
                          </span>
                          <span className="font-medium">{a.title}</span>
                          <span className="ml-1.5 whitespace-nowrap text-[9px] text-muted-foreground">
                            {IP_KIND_LABEL[a.ip_kind] ?? a.ip_kind}/{a.jurisdiction}
                          </span>
                        </td>
                        <Cell>{IP_STATUS_LABEL[a.status] ?? a.status}</Cell>
                        <Cell><Chip meta={annuity} /></Cell>
                        <Cell dim>{a.annuity_paid_through_on ?? "—"}</Cell>
                        <Cell>{a.examination_requested_on ?? <span className="text-muted-foreground">未請求</span>}</Cell>
                        <Cell><Chip meta={pct} /></Cell>
                        <Cell dim>{a.pct_number ?? "—"}</Cell>
                        <Cell>
                          <span className={`rounded border px-1 py-0 text-[9px] ${fresh.cls}`}>{fresh.txt}</span>
                        </Cell>
                        <Cell dim>{a.tech_domain ?? "—"}</Cell>
                        <Cell dim>{a.application_number ?? "—"}</Cell>
                        <Cell dim>{a.publication_number ?? "—"}</Cell>
                        <Cell dim>{a.registration_number ?? "—"}</Cell>
                        <Cell dim>{a.priority_date ?? "—"}</Cell>
                        <Cell dim>{a.application_date ?? "—"}</Cell>
                        <Cell dim>{a.registration_date ?? "—"}</Cell>
                        <Cell dim>{a.expiry_date ?? "—"}</Cell>
                        <Cell dim wrap>{a.applicants?.length ? a.applicants.join(" / ") : "—"}</Cell>
                        <Cell dim wrap>{a.current_assignee?.length ? a.current_assignee.join(" / ") : "—"}</Cell>
                        <Cell>{PRACTICE_LABEL[a.practice_status] ?? a.practice_status}</Cell>
                        <Cell right>{a.annual_cost_yen != null ? `¥${Number(a.annual_cost_yen).toLocaleString("ja-JP")}` : "—"}</Cell>
                        <Cell dim>{a.owner_member_id ?? "—"}</Cell>
                        <Cell dim wrap>{a.attorney_firm ?? "—"}</Cell>
                        <Cell dim>{a.family_key ?? "—"}</Cell>
                        <Cell right>{a.family_size ?? "—"}</Cell>
                        <Cell right>{a.citation_count ?? "—"}</Cell>
                        <Cell right title={a.claim_breadth ? CLAIM_BREADTH_LABEL[a.claim_breadth] : undefined}>
                          {a.claim_breadth ?? "—"}
                        </Cell>
                        <Cell right>{a.importance}</Cell>
                        <Cell>
                          <span className="flex flex-wrap items-center gap-1">
                            {threat && <span className={`rounded border px-1 py-0 text-[9px] ${threat.cls}`}>{threat.txt}</span>}
                            {dl.length > 0 && (
                              <span className="rounded border border-amber-200 bg-amber-50 px-1 py-0 text-[9px] text-amber-700">期限{dl.length}</span>
                            )}
                            {!threat && dl.length === 0 && <span className="text-muted-foreground">—</span>}
                          </span>
                        </Cell>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
          <Row label="優先日">{asset.priority_date}</Row>
          <Row label="審査請求日">{asset.examination_requested_on ?? "未請求"}</Row>
          <Row label="年金">{`${ANNUITY_LABEL[asset.annuity_status]?.txt ?? asset.annuity_status}${asset.annuity_paid_through_on ? ` (${asset.annuity_paid_through_on} まで納付済)` : ""}`}</Row>
          <Row label="外国 (PCT)">{`${PCT_LABEL[asset.pct_status]?.txt ?? asset.pct_status}${asset.pct_number ? ` / ${asset.pct_number}` : ""}`}</Row>
          <Row label="出願人">{asset.applicants?.join(" / ")}</Row>
          <Row label="現権利者">{asset.current_assignee?.join(" / ")}</Row>
          <Row label="発明者">{asset.inventors?.join(" / ")}</Row>
          <Row label="技術区分">{asset.tech_domain}</Row>
          <Row label="IPC / CPC">{[...(asset.ipc_codes ?? []), ...(asset.cpc_codes ?? [])].join(" / ")}</Row>
          <Row label="権利範囲">{asset.claim_breadth ? CLAIM_BREADTH_LABEL[asset.claim_breadth] : null}</Row>
          <Row label="重要度">{`${asset.importance} / 5`}</Row>
          <Row label="脅威度">{asset.threat_level ? (THREAT_LABEL[asset.threat_level]?.txt ?? asset.threat_level) : null}</Row>
          <Row label="要約">{asset.abstract_text}</Row>
          <Row label="メモ">{asset.note_md}</Row>
          <Row label="実施状況">{PRACTICE_LABEL[asset.practice_status] ?? asset.practice_status}</Row>
          <Row label="年間維持費">{asset.annual_cost_yen != null ? `¥${Number(asset.annual_cost_yen).toLocaleString("ja-JP")}` : null}</Row>
          <Row label="担当 / 代理人">{[asset.owner_member_id, asset.attorney_firm].filter(Boolean).join(" / ")}</Row>
          <Row label="ファミリー数 / 被引用">{asset.family_size != null || asset.citation_count != null ? `${asset.family_size ?? "—"} / ${asset.citation_count ?? "—"}` : null}</Row>
          <Row label="最終確認日">{verifyFreshness(asset.last_verified_on).txt}</Row>
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
  { key: "pct_number", label: "PCT番号", placeholder: "PCT/JP2025/000000" },
  { key: "owner_member_id", label: "社内担当", placeholder: "ID001" },
  { key: "attorney_firm", label: "代理人事務所" },
];
const DATE_FIELDS: { key: keyof IpAsset; label: string }[] = [
  { key: "application_date", label: "出願日" },
  { key: "publication_date", label: "公開日" },
  { key: "registration_date", label: "登録日" },
  { key: "expiry_date", label: "満了日" },
  { key: "priority_date", label: "優先日" },
  { key: "examination_requested_on", label: "審査請求日" },
  { key: "annuity_paid_through_on", label: "年金納付済" },
  { key: "last_verified_on", label: "最終確認日" },
];
/** 数値列。空文字は null に落とす (0 と未入力を区別する)。 */
const NUM_FIELDS: { key: keyof IpAsset; label: string }[] = [
  { key: "annual_cost_yen", label: "年間維持費 (円)" },
  { key: "family_size", label: "ファミリー数" },
  { key: "citation_count", label: "被引用数" },
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
    current_assignee: (asset?.current_assignee ?? []).join(", "),
    annuity_status: asset?.annuity_status ?? "unknown",
    pct_status: asset?.pct_status ?? "unknown",
    practice_status: asset?.practice_status ?? "unknown",
    ...Object.fromEntries(NUM_FIELDS.map((f) => [f.key, asset?.[f.key] != null ? String(asset[f.key]) : ""])),
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
      current_assignee: list(form.current_assignee),
      annuity_status: form.annuity_status,
      pct_status: form.pct_status,
      practice_status: form.practice_status,
    };
    for (const f of NUM_FIELDS) {
      const v = String(form[f.key as string] ?? "").trim();
      row[f.key as string] = v === "" ? null : Number(v);
    }
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

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <label className="block">
            <span className="text-[10px] text-muted-foreground">年金 (特許料)</span>
            <select className={input} value={String(form.annuity_status)} onChange={(e) => set("annuity_status", e.target.value)}>
              {Object.entries(ANNUITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v.txt}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] text-muted-foreground">外国 (PCT)</span>
            <select className={input} value={String(form.pct_status)} onChange={(e) => set("pct_status", e.target.value)}>
              {Object.entries(PCT_LABEL).map(([k, v]) => <option key={k} value={k}>{v.txt}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] text-muted-foreground">実施状況</span>
            <select className={input} value={String(form.practice_status)} onChange={(e) => set("practice_status", e.target.value)}>
              {Object.entries(PRACTICE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {NUM_FIELDS.map((f) => (
            <label key={String(f.key)} className="block">
              <span className="text-[10px] text-muted-foreground">{f.label}</span>
              <input type="number" className={input} value={String(form[f.key as string] ?? "")} onChange={(e) => set(f.key as string, e.target.value)} />
            </label>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label className="block">
            <span className="text-[10px] text-muted-foreground">現権利者 (カンマ区切り)</span>
            <input className={input} value={String(form.current_assignee)} onChange={(e) => set("current_assignee", e.target.value)} />
          </label>
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

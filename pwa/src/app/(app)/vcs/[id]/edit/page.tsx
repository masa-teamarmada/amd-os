"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  fetchVcDetail,
  updateVc,
  upsertVcFund,
  deleteVcFund,
  insertVcInvestment,
  updateVcInvestment,
  deleteVcInvestment,
  insertVcContact,
  updateVcContact,
  deleteVcContact,
  upsertProjectVcRelation,
  deleteProjectVcRelation,
  insertVcNews,
  VC_TYPE_LABEL,
  FUND_STATUS_LABEL,
  PVR_STATUS_LABEL,
  DRY_POWDER_SOURCE_LABEL,
  VC_NEWS_KIND_LABEL,
} from "@/lib/vc-data";
import { fetchProjectsFromSupabase, type DashProject } from "@/lib/supabase-data";
import { createClient } from "@/lib/supabase/client";
import type {
  VcDetail,
  Vc,
  VcFund,
  VcInvestment,
  VcContact,
  ProjectVcRelation,
} from "@/types/vc";

interface MemberLite {
  member_id: string;
  code_name: string;
}

export default function VcEditPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const router = useRouter();
  const [data, setData] = useState<VcDetail | null>(null);
  const [projects, setProjects] = useState<DashProject[]>([]);
  const [members, setMembers] = useState<MemberLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    const d = await fetchVcDetail(id);
    setData(d);
  };

  useEffect(() => {
    Promise.all([
      fetchVcDetail(id),
      fetchProjectsFromSupabase().catch(() => []),
      (async () => {
        const c = createClient();
        const { data } = await c.from("members").select("member_id, code_name").order("code_name");
        return (data ?? []) as MemberLite[];
      })(),
    ]).then(([d, ps, ms]) => {
      setData(d);
      setProjects(ps);
      setMembers(ms);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">読み込み中…</div>;
  if (!data) return <div className="p-6 text-sm">VC が見つかりません</div>;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          <Link href={`/vcs/${id}`} className="hover:text-foreground">← 詳細に戻る</Link>
        </div>
        <button
          onClick={() => router.push(`/vcs/${id}`)}
          className="text-xs px-3 py-1.5 rounded border border-border hover:bg-accent"
        >
          完了
        </button>
      </div>

      <h1 className="text-xl font-semibold">{data.vc.name} を編集</h1>

      <VcMainForm
        vc={data.vc}
        members={members}
        saving={saving}
        setSaving={setSaving}
        onSaved={reload}
      />

      <FundsSection vcId={id} funds={data.funds} contacts={data.contacts} onChange={reload} />

      <InvestmentsSection
        vcId={id}
        funds={data.funds}
        investments={data.investments}
        projects={projects}
        onChange={reload}
      />

      <ContactsSection vcId={id} contacts={data.contacts} onChange={reload} />

      <RelationsSection
        vcId={id}
        relations={data.relations}
        projects={projects}
        members={members}
        contacts={data.contacts}
        onChange={reload}
      />

      <NewsSection vcId={id} onChange={reload} />
    </div>
  );
}

// =====================================================================
// VC main form
// =====================================================================

function VcMainForm({
  vc,
  members,
  saving,
  setSaving,
  onSaved,
}: {
  vc: Vc;
  members: MemberLite[];
  saving: boolean;
  setSaving: (b: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: vc.name,
    name_en: vc.name_en ?? "",
    type: vc.type ?? "",
    thesis: vc.thesis ?? "",
    stage_focus: (vc.stage_focus ?? []).join(", "),
    ticket_min_jpy: vc.ticket_min_jpy?.toString() ?? "",
    ticket_max_jpy: vc.ticket_max_jpy?.toString() ?? "",
    hq: vc.hq ?? "",
    website: vc.website ?? "",
    notes: vc.notes ?? "",
    amd_rating: vc.amd_rating?.toString() ?? "",
    amd_rating_note: vc.amd_rating_note ?? "",
  });

  const submit = async () => {
    setSaving(true);
    const me = members[0]?.member_id; // TODO: 本来は auth.user.id → member_id 解決
    const ratingChanged = form.amd_rating !== (vc.amd_rating?.toString() ?? "");
    const res = await updateVc(vc.id, {
      name: form.name,
      name_en: form.name_en || null,
      type: (form.type || null) as Vc["type"],
      thesis: form.thesis || null,
      stage_focus: form.stage_focus
        ? form.stage_focus.split(",").map((s) => s.trim()).filter(Boolean)
        : null,
      ticket_min_jpy: form.ticket_min_jpy ? Number(form.ticket_min_jpy) : null,
      ticket_max_jpy: form.ticket_max_jpy ? Number(form.ticket_max_jpy) : null,
      hq: form.hq || null,
      website: form.website || null,
      notes: form.notes || null,
      amd_rating: form.amd_rating ? Number(form.amd_rating) : null,
      amd_rating_note: form.amd_rating_note || null,
      ...(ratingChanged && me
        ? { amd_rating_updated_by: me, amd_rating_updated_at: new Date().toISOString() }
        : {}),
    });
    setSaving(false);
    if (!res.ok) alert(`保存失敗: ${res.error}`);
    else onSaved();
  };

  return (
    <Section title="基本情報 + AMD 相性">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="VC 名 (正式)">
          <input className="i" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="英名">
          <input className="i" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
        </Field>
        <Field label="type">
          <select className="i" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="">未指定</option>
            {Object.entries(VC_TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="HQ">
          <input className="i" value={form.hq} onChange={(e) => setForm({ ...form, hq: e.target.value })} />
        </Field>
        <Field label="website">
          <input className="i" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
        </Field>
        <Field label="ステージ (カンマ区切り 例: pre_seed, seed, series_a)">
          <input className="i" value={form.stage_focus} onChange={(e) => setForm({ ...form, stage_focus: e.target.value })} />
        </Field>
        <Field label="ticket min (円)">
          <input className="i" type="number" value={form.ticket_min_jpy} onChange={(e) => setForm({ ...form, ticket_min_jpy: e.target.value })} />
        </Field>
        <Field label="ticket max (円)">
          <input className="i" type="number" value={form.ticket_max_jpy} onChange={(e) => setForm({ ...form, ticket_max_jpy: e.target.value })} />
        </Field>
      </div>
      <Field label="thesis (投資テーゼ)">
        <textarea className="i min-h-[80px]" value={form.thesis} onChange={(e) => setForm({ ...form, thesis: e.target.value })} />
      </Field>
      <Field label="備考">
        <textarea className="i min-h-[60px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>

      <div className="border-t border-border/50 pt-3 mt-3">
        <h3 className="text-xs font-semibold mb-2">AMD 相性評価</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="★ (1〜5、空欄=未評価)">
            <select className="i" value={form.amd_rating} onChange={(e) => setForm({ ...form, amd_rating: e.target.value })}>
              <option value="">未評価</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{"★".repeat(n)}</option>
              ))}
            </select>
          </Field>
          <Field label="評価メモ" className="md:col-span-2">
            <textarea className="i min-h-[60px]" value={form.amd_rating_note} onChange={(e) => setForm({ ...form, amd_rating_note: e.target.value })} />
          </Field>
        </div>
      </div>

      <div className="flex justify-end mt-3">
        <button
          onClick={submit}
          disabled={saving}
          className="text-xs px-4 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50"
        >
          {saving ? "保存中…" : "保存"}
        </button>
      </div>
    </Section>
  );
}

// =====================================================================
// Funds
// =====================================================================

function FundsSection({
  vcId,
  funds,
  contacts,
  onChange,
}: {
  vcId: string;
  funds: VcFund[];
  contacts: VcContact[];
  onChange: () => void;
}) {
  const empty: Partial<VcFund> = { fund_no: (Math.max(0, ...funds.map((f) => f.fund_no)) + 1) || 1, status: "unknown" };
  const [editing, setEditing] = useState<Partial<VcFund> | null>(null);

  return (
    <Section
      title="ファンド"
      action={
        <button
          onClick={() => setEditing(empty)}
          className="text-xs px-3 py-1 rounded border border-border hover:bg-accent"
        >
          + 追加
        </button>
      }
    >
      {funds.length === 0 ? (
        <div className="text-xs text-muted-foreground">未登録</div>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-left text-muted-foreground border-b border-border">
            <tr>
              <th className="py-1 pr-2">#</th>
              <th className="py-1 pr-2">size</th>
              <th className="py-1 pr-2">vintage</th>
              <th className="py-1 pr-2">status</th>
              <th className="py-1 pr-2">DPE残</th>
              <th className="py-1 pr-2">出所</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {funds.map((f) => (
              <tr key={f.id} className="border-b border-border/30">
                <td className="py-1.5 pr-2">{f.fund_no}</td>
                <td className="py-1.5 pr-2">{f.size_jpy ?? `${f.size_jpy_low ?? "?"}〜${f.size_jpy_high ?? "?"}`}</td>
                <td className="py-1.5 pr-2">{f.vintage_year ?? "—"}</td>
                <td className="py-1.5 pr-2">{FUND_STATUS_LABEL[f.status]}</td>
                <td className="py-1.5 pr-2">
                  {f.dry_powder_jpy_low ?? "?"}〜{f.dry_powder_jpy_high ?? "?"}
                </td>
                <td className="py-1.5 pr-2">{f.dry_powder_source ? DRY_POWDER_SOURCE_LABEL[f.dry_powder_source] : "—"}</td>
                <td className="py-1.5 pr-2 text-right">
                  <button onClick={() => setEditing(f)} className="text-primary hover:underline mr-2">編集</button>
                  <button
                    onClick={async () => {
                      if (!confirm(`#${f.fund_no} を削除?`)) return;
                      const res = await deleteVcFund(f.id);
                      if (!res.ok) alert(res.error);
                      else onChange();
                    }}
                    className="text-destructive hover:underline"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <FundEditor
          vcId={vcId}
          contacts={contacts}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChange();
          }}
        />
      )}
    </Section>
  );
}

function FundEditor({
  vcId,
  contacts,
  initial,
  onClose,
  onSaved,
}: {
  vcId: string;
  contacts: VcContact[];
  initial: Partial<VcFund>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    fund_no: initial.fund_no ?? 1,
    name: initial.name ?? "",
    size_jpy: initial.size_jpy ?? "",
    size_jpy_low: initial.size_jpy_low ?? "",
    size_jpy_high: initial.size_jpy_high ?? "",
    vintage_year: initial.vintage_year ?? "",
    status: initial.status ?? "unknown",
    first_close_at: initial.first_close_at ?? "",
    final_close_at: initial.final_close_at ?? "",
    target_close_at: initial.target_close_at ?? "",
    dry_powder_jpy_low: initial.dry_powder_jpy_low ?? "",
    dry_powder_jpy_high: initial.dry_powder_jpy_high ?? "",
    dry_powder_source: initial.dry_powder_source ?? "",
    dry_powder_heard_from: initial.dry_powder_heard_from ?? "",
    dry_powder_note: initial.dry_powder_note ?? "",
    source_url: initial.source_url ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const res = await upsertVcFund({
      vc_id: vcId,
      fund_no: Number(f.fund_no),
      name: f.name || null,
      size_jpy: f.size_jpy ? Number(f.size_jpy) : null,
      size_jpy_low: f.size_jpy_low ? Number(f.size_jpy_low) : null,
      size_jpy_high: f.size_jpy_high ? Number(f.size_jpy_high) : null,
      vintage_year: f.vintage_year ? Number(f.vintage_year) : null,
      status: f.status as VcFund["status"],
      first_close_at: f.first_close_at || null,
      final_close_at: f.final_close_at || null,
      target_close_at: f.target_close_at || null,
      dry_powder_jpy_low: f.dry_powder_jpy_low ? Number(f.dry_powder_jpy_low) : null,
      dry_powder_jpy_high: f.dry_powder_jpy_high ? Number(f.dry_powder_jpy_high) : null,
      dry_powder_source: (f.dry_powder_source || null) as VcFund["dry_powder_source"],
      dry_powder_heard_from: f.dry_powder_heard_from || null,
      dry_powder_note: f.dry_powder_note || null,
      dry_powder_updated_at: f.dry_powder_jpy_low || f.dry_powder_jpy_high ? new Date().toISOString() : null,
      source_url: f.source_url || null,
    });
    setSaving(false);
    if (!res.ok) alert(res.error);
    else onSaved();
  };

  return (
    <Modal onClose={onClose} title={`#${f.fund_no} ファンド ${initial.id ? "編集" : "追加"}`}>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <Field label="ファンド番号 (整数)">
          <input className="i" type="number" value={f.fund_no} onChange={(e) => setF({ ...f, fund_no: Number(e.target.value) })} />
        </Field>
        <Field label="正式名">
          <input className="i" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="size (円)">
          <input className="i" type="number" value={f.size_jpy} onChange={(e) => setF({ ...f, size_jpy: e.target.value })} />
        </Field>
        <Field label="vintage year">
          <input className="i" type="number" value={f.vintage_year} onChange={(e) => setF({ ...f, vintage_year: e.target.value })} />
        </Field>
        <Field label="size レンジ低">
          <input className="i" type="number" value={f.size_jpy_low} onChange={(e) => setF({ ...f, size_jpy_low: e.target.value })} />
        </Field>
        <Field label="size レンジ高">
          <input className="i" type="number" value={f.size_jpy_high} onChange={(e) => setF({ ...f, size_jpy_high: e.target.value })} />
        </Field>
        <Field label="status">
          <select className="i" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as VcFund["status"] })}>
            {Object.entries(FUND_STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="source URL">
          <input className="i" value={f.source_url} onChange={(e) => setF({ ...f, source_url: e.target.value })} />
        </Field>
        <Field label="1st close 日">
          <input className="i" type="date" value={f.first_close_at} onChange={(e) => setF({ ...f, first_close_at: e.target.value })} />
        </Field>
        <Field label="final close 日">
          <input className="i" type="date" value={f.final_close_at} onChange={(e) => setF({ ...f, final_close_at: e.target.value })} />
        </Field>
        <Field label="目標クローズ日 (募集中)">
          <input className="i" type="date" value={f.target_close_at} onChange={(e) => setF({ ...f, target_close_at: e.target.value })} />
        </Field>
      </div>

      <div className="border-t border-border/50 pt-3 mt-3">
        <h4 className="text-xs font-semibold mb-2">ドライパウダー</h4>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <Field label="DPE残レンジ低 (円)">
            <input className="i" type="number" value={f.dry_powder_jpy_low} onChange={(e) => setF({ ...f, dry_powder_jpy_low: e.target.value })} />
          </Field>
          <Field label="DPE残レンジ高 (円)">
            <input className="i" type="number" value={f.dry_powder_jpy_high} onChange={(e) => setF({ ...f, dry_powder_jpy_high: e.target.value })} />
          </Field>
          <Field label="出所">
            <select className="i" value={f.dry_powder_source ?? ""} onChange={(e) => setF({ ...f, dry_powder_source: e.target.value as NonNullable<VcFund["dry_powder_source"]> | "" })}>
              <option value="">—</option>
              {Object.entries(DRY_POWDER_SOURCE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="誰から聞いた (heard_from_contact のとき)">
            <select className="i" value={f.dry_powder_heard_from} onChange={(e) => setF({ ...f, dry_powder_heard_from: e.target.value })}>
              <option value="">—</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.role ? ` (${c.role})` : ""}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="DPE 備考">
          <textarea className="i min-h-[50px]" value={f.dry_powder_note} onChange={(e) => setF({ ...f, dry_powder_note: e.target.value })} />
        </Field>
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="text-xs px-3 py-1.5 rounded border border-border">キャンセル</button>
        <button onClick={save} disabled={saving} className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50">
          {saving ? "保存中…" : "保存"}
        </button>
      </div>
    </Modal>
  );
}

// =====================================================================
// Investments
// =====================================================================

function InvestmentsSection({
  vcId,
  funds,
  investments,
  projects,
  onChange,
}: {
  vcId: string;
  funds: VcFund[];
  investments: VcInvestment[];
  projects: DashProject[];
  onChange: () => void;
}) {
  const [editing, setEditing] = useState<Partial<VcInvestment> | null>(null);

  return (
    <Section
      title="出資先"
      action={
        <button onClick={() => setEditing({})} className="text-xs px-3 py-1 rounded border border-border hover:bg-accent">
          + 追加
        </button>
      }
    >
      {investments.length === 0 ? (
        <div className="text-xs text-muted-foreground">未登録</div>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-left text-muted-foreground border-b border-border">
            <tr>
              <th className="py-1 pr-2">投資先</th>
              <th className="py-1 pr-2">round</th>
              <th className="py-1 pr-2">amount</th>
              <th className="py-1 pr-2">日</th>
              <th className="py-1 pr-2">自社 PJ</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {investments.map((i) => (
              <tr key={i.id} className="border-b border-border/30">
                <td className="py-1.5 pr-2">
                  {i.target_company}
                  {i.is_lead && <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-700">lead</span>}
                </td>
                <td className="py-1.5 pr-2">{i.round ?? "—"}</td>
                <td className="py-1.5 pr-2">{i.amount_jpy?.toLocaleString() ?? "—"}</td>
                <td className="py-1.5 pr-2">{i.invested_at ?? "—"}</td>
                <td className="py-1.5 pr-2">{i.our_project_id ?? "—"}</td>
                <td className="py-1.5 pr-2 text-right">
                  <button onClick={() => setEditing(i)} className="text-primary hover:underline mr-2">編集</button>
                  <button
                    onClick={async () => {
                      if (!confirm(`${i.target_company} を削除?`)) return;
                      const res = await deleteVcInvestment(i.id);
                      if (!res.ok) alert(res.error);
                      else onChange();
                    }}
                    className="text-destructive hover:underline"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <InvestmentEditor
          vcId={vcId}
          funds={funds}
          projects={projects}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChange();
          }}
        />
      )}
    </Section>
  );
}

function InvestmentEditor({
  vcId,
  funds,
  projects,
  initial,
  onClose,
  onSaved,
}: {
  vcId: string;
  funds: VcFund[];
  projects: DashProject[];
  initial: Partial<VcInvestment>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    target_company: initial.target_company ?? "",
    target_company_en: initial.target_company_en ?? "",
    fund_id: initial.fund_id ?? "",
    our_project_id: initial.our_project_id ?? "",
    amount_jpy: initial.amount_jpy?.toString() ?? "",
    round: initial.round ?? "",
    invested_at: initial.invested_at ?? "",
    is_lead: !!initial.is_lead,
    source_url: initial.source_url ?? "",
    notes: initial.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!f.target_company.trim()) {
      alert("投資先名は必須");
      return;
    }
    setSaving(true);
    const payload: Partial<VcInvestment> = {
      target_company: f.target_company,
      target_company_en: f.target_company_en || null,
      fund_id: f.fund_id || null,
      our_project_id: f.our_project_id || null,
      amount_jpy: f.amount_jpy ? Number(f.amount_jpy) : null,
      round: (f.round || null) as VcInvestment["round"],
      invested_at: f.invested_at || null,
      is_lead: f.is_lead,
      source_url: f.source_url || null,
      notes: f.notes || null,
    };
    const res = initial.id
      ? await updateVcInvestment(initial.id, payload)
      : await insertVcInvestment({ vc_id: vcId, ...payload, target_company: f.target_company });
    setSaving(false);
    if (!res.ok) alert(res.error);
    else onSaved();
  };

  return (
    <Modal onClose={onClose} title={initial.id ? "出資先編集" : "出資先追加"}>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <Field label="投資先名 *">
          <input className="i" value={f.target_company} onChange={(e) => setF({ ...f, target_company: e.target.value })} />
        </Field>
        <Field label="英名">
          <input className="i" value={f.target_company_en} onChange={(e) => setF({ ...f, target_company_en: e.target.value })} />
        </Field>
        <Field label="fund">
          <select className="i" value={f.fund_id} onChange={(e) => setF({ ...f, fund_id: e.target.value })}>
            <option value="">不明</option>
            {funds.map((fund) => (
              <option key={fund.id} value={fund.id}>#{fund.fund_no} {fund.name ?? ""}</option>
            ))}
          </select>
        </Field>
        <Field label="自社 PJ (該当なし=空)">
          <select className="i" value={f.our_project_id} onChange={(e) => setF({ ...f, our_project_id: e.target.value })}>
            <option value="">—</option>
            {projects.map((p) => (
              <option key={p.projectId} value={p.projectId}>{p.projectName}</option>
            ))}
          </select>
        </Field>
        <Field label="round">
          <input className="i" placeholder="seed / series_a 等" value={f.round} onChange={(e) => setF({ ...f, round: e.target.value })} />
        </Field>
        <Field label="amount (円)">
          <input className="i" type="number" value={f.amount_jpy} onChange={(e) => setF({ ...f, amount_jpy: e.target.value })} />
        </Field>
        <Field label="投資日">
          <input className="i" type="date" value={f.invested_at} onChange={(e) => setF({ ...f, invested_at: e.target.value })} />
        </Field>
        <Field label="lead?">
          <input type="checkbox" checked={f.is_lead} onChange={(e) => setF({ ...f, is_lead: e.target.checked })} />
        </Field>
      </div>
      <Field label="source URL">
        <input className="i" value={f.source_url} onChange={(e) => setF({ ...f, source_url: e.target.value })} />
      </Field>
      <Field label="備考">
        <textarea className="i min-h-[50px]" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </Field>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="text-xs px-3 py-1.5 rounded border border-border">キャンセル</button>
        <button onClick={save} disabled={saving} className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50">
          {saving ? "保存中…" : "保存"}
        </button>
      </div>
    </Modal>
  );
}

// =====================================================================
// Contacts
// =====================================================================

function ContactsSection({
  vcId,
  contacts,
  onChange,
}: {
  vcId: string;
  contacts: VcContact[];
  onChange: () => void;
}) {
  const [editing, setEditing] = useState<Partial<VcContact> | null>(null);
  return (
    <Section
      title="担当者"
      action={
        <button onClick={() => setEditing({})} className="text-xs px-3 py-1 rounded border border-border hover:bg-accent">
          + 追加
        </button>
      }
    >
      {contacts.length === 0 ? (
        <div className="text-xs text-muted-foreground">未登録</div>
      ) : (
        <ul className="text-xs space-y-1">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <span className="font-medium">{c.name}</span>
              {c.role && <span className="text-muted-foreground">{c.role}</span>}
              {c.email && <span className="text-muted-foreground">{c.email}</span>}
              <span className="ml-auto flex gap-2">
                <button onClick={() => setEditing(c)} className="text-primary hover:underline">編集</button>
                <button
                  onClick={async () => {
                    if (!confirm(`${c.name} を削除?`)) return;
                    const res = await deleteVcContact(c.id);
                    if (!res.ok) alert(res.error);
                    else onChange();
                  }}
                  className="text-destructive hover:underline"
                >
                  削除
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <ContactEditor
          vcId={vcId}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChange();
          }}
        />
      )}
    </Section>
  );
}

function ContactEditor({
  vcId,
  initial,
  onClose,
  onSaved,
}: {
  vcId: string;
  initial: Partial<VcContact>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    name: initial.name ?? "",
    name_en: initial.name_en ?? "",
    role: initial.role ?? "",
    email: initial.email ?? "",
    phone: initial.phone ?? "",
    linkedin: initial.linkedin ?? "",
    notes: initial.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!f.name.trim()) {
      alert("名前は必須");
      return;
    }
    setSaving(true);
    const payload: Partial<VcContact> = {
      name: f.name,
      name_en: f.name_en || null,
      role: f.role || null,
      email: f.email || null,
      phone: f.phone || null,
      linkedin: f.linkedin || null,
      notes: f.notes || null,
    };
    const res = initial.id
      ? await updateVcContact(initial.id, payload)
      : await insertVcContact({ vc_id: vcId, ...payload, name: f.name });
    setSaving(false);
    if (!res.ok) alert(res.error);
    else onSaved();
  };
  return (
    <Modal onClose={onClose} title={initial.id ? "担当者編集" : "担当者追加"}>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <Field label="名前 *">
          <input className="i" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="英名">
          <input className="i" value={f.name_en} onChange={(e) => setF({ ...f, name_en: e.target.value })} />
        </Field>
        <Field label="role (GP / Partner 等)">
          <input className="i" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} />
        </Field>
        <Field label="email">
          <input className="i" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
        <Field label="phone">
          <input className="i" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </Field>
        <Field label="LinkedIn">
          <input className="i" value={f.linkedin} onChange={(e) => setF({ ...f, linkedin: e.target.value })} />
        </Field>
      </div>
      <Field label="備考">
        <textarea className="i min-h-[50px]" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </Field>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="text-xs px-3 py-1.5 rounded border border-border">キャンセル</button>
        <button onClick={save} disabled={saving} className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50">
          {saving ? "保存中…" : "保存"}
        </button>
      </div>
    </Modal>
  );
}

// =====================================================================
// PJ Relations
// =====================================================================

function RelationsSection({
  vcId,
  relations,
  projects,
  members,
  contacts,
  onChange,
}: {
  vcId: string;
  relations: VcDetail["relations"];
  projects: DashProject[];
  members: MemberLite[];
  contacts: VcContact[];
  onChange: () => void;
}) {
  const [editing, setEditing] = useState<Partial<ProjectVcRelation> | null>(null);
  return (
    <Section
      title="自社 PJ 接点"
      action={
        <button onClick={() => setEditing({})} className="text-xs px-3 py-1 rounded border border-border hover:bg-accent">
          + 追加
        </button>
      }
    >
      {relations.length === 0 ? (
        <div className="text-xs text-muted-foreground">未登録</div>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-left text-muted-foreground border-b border-border">
            <tr>
              <th className="py-1 pr-2">PJ</th>
              <th className="py-1 pr-2">status</th>
              <th className="py-1 pr-2">AMD 担当</th>
              <th className="py-1 pr-2">VC 担当</th>
              <th className="py-1 pr-2">最終接触</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {relations.map((r) => (
              <tr key={r.id} className="border-b border-border/30">
                <td className="py-1.5 pr-2">{r.project_name ?? r.project_id}</td>
                <td className="py-1.5 pr-2">{PVR_STATUS_LABEL[r.status]}</td>
                <td className="py-1.5 pr-2">{r.amd_owner_code_name ?? "—"}</td>
                <td className="py-1.5 pr-2">{r.contact_name ?? "—"}</td>
                <td className="py-1.5 pr-2">{r.last_touch_at ?? "—"}</td>
                <td className="py-1.5 pr-2 text-right">
                  <button onClick={() => setEditing(r)} className="text-primary hover:underline mr-2">編集</button>
                  <button
                    onClick={async () => {
                      if (!confirm("削除?")) return;
                      const res = await deleteProjectVcRelation(r.id);
                      if (!res.ok) alert(res.error);
                      else onChange();
                    }}
                    className="text-destructive hover:underline"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <RelationEditor
          vcId={vcId}
          initial={editing}
          projects={projects}
          members={members}
          contacts={contacts}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChange();
          }}
        />
      )}
    </Section>
  );
}

function RelationEditor({
  vcId,
  initial,
  projects,
  members,
  contacts,
  onClose,
  onSaved,
}: {
  vcId: string;
  initial: Partial<ProjectVcRelation>;
  projects: DashProject[];
  members: MemberLite[];
  contacts: VcContact[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    project_id: initial.project_id ?? "",
    status: initial.status ?? "not_contacted",
    vc_contact_id: initial.vc_contact_id ?? "",
    amd_owner_member_id: initial.amd_owner_member_id ?? "",
    first_contact_at: initial.first_contact_at ?? "",
    last_touch_at: initial.last_touch_at ?? "",
    expected_amount_jpy: initial.expected_amount_jpy?.toString() ?? "",
    notes: initial.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!f.project_id) {
      alert("PJ は必須");
      return;
    }
    setSaving(true);
    const res = await upsertProjectVcRelation({
      project_id: f.project_id,
      vc_id: vcId,
      vc_contact_id: f.vc_contact_id || null,
      amd_owner_member_id: f.amd_owner_member_id || null,
      status: f.status as ProjectVcRelation["status"],
      first_contact_at: f.first_contact_at || null,
      last_touch_at: f.last_touch_at || null,
      expected_amount_jpy: f.expected_amount_jpy ? Number(f.expected_amount_jpy) : null,
      notes: f.notes || null,
    });
    setSaving(false);
    if (!res.ok) alert(res.error);
    else onSaved();
  };

  return (
    <Modal onClose={onClose} title={initial.id ? "PJ 接点編集" : "PJ 接点追加"}>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <Field label="PJ *">
          <select className="i" value={f.project_id} onChange={(e) => setF({ ...f, project_id: e.target.value })} disabled={!!initial.id}>
            <option value="">選択…</option>
            {projects.map((p) => (
              <option key={p.projectId} value={p.projectId}>{p.projectName}</option>
            ))}
          </select>
        </Field>
        <Field label="status">
          <select className="i" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as ProjectVcRelation["status"] })}>
            {Object.entries(PVR_STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="VC 担当">
          <select className="i" value={f.vc_contact_id} onChange={(e) => setF({ ...f, vc_contact_id: e.target.value })}>
            <option value="">—</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.role ? ` (${c.role})` : ""}</option>
            ))}
          </select>
        </Field>
        <Field label="AMD 担当">
          <select className="i" value={f.amd_owner_member_id} onChange={(e) => setF({ ...f, amd_owner_member_id: e.target.value })}>
            <option value="">—</option>
            {members.map((m) => (
              <option key={m.member_id} value={m.member_id}>{m.code_name}</option>
            ))}
          </select>
        </Field>
        <Field label="初回接触日">
          <input className="i" type="date" value={f.first_contact_at} onChange={(e) => setF({ ...f, first_contact_at: e.target.value })} />
        </Field>
        <Field label="最終接触日">
          <input className="i" type="date" value={f.last_touch_at} onChange={(e) => setF({ ...f, last_touch_at: e.target.value })} />
        </Field>
        <Field label="想定 amount (円)">
          <input className="i" type="number" value={f.expected_amount_jpy} onChange={(e) => setF({ ...f, expected_amount_jpy: e.target.value })} />
        </Field>
      </div>
      <Field label="備考">
        <textarea className="i min-h-[50px]" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </Field>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="text-xs px-3 py-1.5 rounded border border-border">キャンセル</button>
        <button onClick={save} disabled={saving} className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50">
          {saving ? "保存中…" : "保存"}
        </button>
      </div>
    </Modal>
  );
}

// =====================================================================
// News (manual add)
// =====================================================================

function NewsSection({ vcId, onChange }: { vcId: string; onChange: () => void }) {
  const [editing, setEditing] = useState<{ title: string; body: string; kind: string; occurred_on: string; source_url: string } | null>(null);
  return (
    <Section
      title="ニュース手動追加"
      action={
        <button
          onClick={() => setEditing({ title: "", body: "", kind: "press", occurred_on: "", source_url: "" })}
          className="text-xs px-3 py-1 rounded border border-border hover:bg-accent"
        >
          + 追加
        </button>
      }
    >
      <div className="text-[11px] text-muted-foreground">
        手動追加は補完。基本は自動収集 (毎朝 09:00 JST cron) + つくよみ会話で蓄積される。
      </div>
      {editing && (
        <Modal title="ニュース手動追加" onClose={() => setEditing(null)}>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Field label="タイトル *">
              <input className="i" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </Field>
            <Field label="kind">
              <select className="i" value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value })}>
                {Object.entries(VC_NEWS_KIND_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="発生日">
              <input className="i" type="date" value={editing.occurred_on} onChange={(e) => setEditing({ ...editing, occurred_on: e.target.value })} />
            </Field>
            <Field label="source URL">
              <input className="i" value={editing.source_url} onChange={(e) => setEditing({ ...editing, source_url: e.target.value })} />
            </Field>
          </div>
          <Field label="本文">
            <textarea className="i min-h-[80px]" value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setEditing(null)} className="text-xs px-3 py-1.5 rounded border border-border">キャンセル</button>
            <button
              onClick={async () => {
                if (!editing.title.trim()) {
                  alert("title 必須");
                  return;
                }
                const res = await insertVcNews({
                  vc_id: vcId,
                  title: editing.title,
                  kind: editing.kind as Parameters<typeof insertVcNews>[0]["kind"],
                  body: editing.body || null,
                  occurred_on: editing.occurred_on || null,
                  source_url: editing.source_url || null,
                  ingested_by: "manual",
                  verified: true, // 手動 = 即 verified
                });
                if (!res.ok) alert(res.error);
                else {
                  setEditing(null);
                  onChange();
                }
              }}
              className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground"
            >
              追加
            </button>
          </div>
        </Modal>
      )}
    </Section>
  );
}

// =====================================================================
// Shared components
// =====================================================================

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="block text-[10px] text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

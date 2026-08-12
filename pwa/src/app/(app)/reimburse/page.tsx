"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

type ReimbursementItem = {
  reimbursement_id: string;
  project_id: string;
  project_name: string | null;
  date: string;
  description: string | null;
  category: ReimburseCategory;
  amount: number;
  tax_rate: number;
  status: string;
  created_by: string;
  pm_approved_by: string | null;
  pm_approved_at: string | null;
  admin_approved_by: string | null;
  admin_approved_at: string | null;
  transport_mode: TransportMode | null;
  transport_from: string | null;
  transport_to: string | null;
  transport_trip: TransportTrip | null;
  receipt_storage_paths: string[];
  receipt_file_names: string[];
  receipt_links?: ReceiptLink[];
};

type ProjectOption = {
  project_id: string;
  project_name: string;
};

type ReceiptLink = {
  name: string;
  url: string;
};

type ReimburseCategory = "transport" | "lodging" | "supplies" | "meal" | "other";
type TransportMode = "train" | "bus" | "taxi" | "car" | "other";
type TransportTrip = "oneway" | "round";

type ReimburseFormState = {
  projectId: string;
  date: string;
  category: ReimburseCategory;
  amount: string;
  taxRate: string;
  description: string;
  transportMode: TransportMode;
  transportFrom: string;
  transportTo: string;
  transportTrip: TransportTrip;
  files: File[];
};

const RECEIPT_BUCKET = "reimbursement-receipts";
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const CATEGORY_LABELS: Record<ReimburseCategory, string> = {
  transport: "交通費",
  lodging: "宿泊",
  supplies: "消耗品",
  meal: "会議費",
  other: "その他",
};
const STATUS_LABELS: Record<string, string> = {
  submitted: "申請中",
  pmApproved: "PM承認済",
  pmapproved: "PM承認済",
  approved: "承認済",
  rejected: "却下",
  paid: "支払済",
};
const TRANSPORT_MODE_LABELS: Record<string, string> = {
  train: "電車",
  bus: "バス",
  taxi: "タクシー",
  car: "自家用車",
  other: "その他",
};
const TRANSPORT_TRIP_LABELS: Record<string, string> = {
  oneway: "片道",
  round: "往復",
};

const initialForm = (): ReimburseFormState => ({
  projectId: "",
  date: todayInputDate(),
  category: "transport",
  amount: "",
  taxRate: "0.1",
  description: "",
  transportMode: "train",
  transportFrom: "",
  transportTo: "",
  transportTrip: "oneway",
  files: [],
});

export function ReimburseWorkspace({ embedded = false }: { embedded?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<ReimbursementItem[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [pmProjectIds, setPmProjectIds] = useState<string[]>([]);
  const [form, setForm] = useState<ReimburseFormState>(() => initialForm());
  const [editingItem, setEditingItem] = useState<ReimbursementItem | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const projectNameById = useMemo(() => new Map(projects.map((project) => [project.project_id, project.project_name])), [projects]);
  const pmProjectSet = useMemo(() => new Set(pmProjectIds), [pmProjectIds]);
  const myItems = useMemo(
    () => items.filter((item) => item.created_by.toLowerCase() === email.toLowerCase()),
    [email, items]
  );
  const approvalItems = useMemo(
    () => items.filter((item) => {
      if (item.status === "submitted" && pmProjectSet.has(item.project_id)) return true;
      if ((item.status === "pmApproved" || item.status === "pmapproved") && isAdmin) return true;
      return false;
    }),
    [isAdmin, items, pmProjectSet]
  );

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      const currentEmail = user?.email?.toLowerCase() || "";
      setEmail(currentEmail);
      setUserId(user?.id || "");
      if (!user || !currentEmail) {
        setItems([]);
        setProjects([]);
        setPmProjectIds([]);
        setIsAdmin(false);
        return;
      }

      const [{ data: member }, { data: activeProjects }, { data: reimbursements }] = await Promise.all([
        supabase.from("members").select("member_id, is_admin").eq("email", currentEmail).maybeSingle(),
        supabase.from("projects").select("project_id, project_name").eq("status", "active").order("project_name", { ascending: true }),
        supabase
          .from("reimbursements")
          .select("reimbursement_id, project_id, project_name, date, description, category, amount, tax_rate, status, created_by, pm_approved_by, pm_approved_at, admin_approved_by, admin_approved_at, transport_mode, transport_from, transport_to, transport_trip, receipt_storage_paths, receipt_file_names")
          .order("date", { ascending: false })
          .limit(400),
      ]);

      const memberId = typeof member?.member_id === "string" ? member.member_id : "";
      setIsAdmin(Boolean(member?.is_admin));
      setProjects(((activeProjects ?? []) as ProjectOption[]).filter((project) => project.project_id && project.project_name));

      if (memberId) {
        const { data: pmRows } = await supabase
          .from("project_members")
          .select("project_id")
          .eq("member_id", memberId)
          .eq("is_active", true)
          .eq("is_pm", true);
        setPmProjectIds(((pmRows ?? []) as Array<{ project_id: string }>).map((row) => row.project_id).filter(Boolean));
      } else {
        setPmProjectIds([]);
      }

      const normalized = ((reimbursements ?? []) as Array<Partial<ReimbursementItem>>).map((row) => ({
        reimbursement_id: String(row.reimbursement_id || ""),
        project_id: String(row.project_id || ""),
        project_name: row.project_name || null,
        date: String(row.date || ""),
        description: row.description || "",
        category: normalizeCategory(row.category),
        amount: Number(row.amount) || 0,
        tax_rate: Number(row.tax_rate) || 0,
        status: String(row.status || "submitted"),
        created_by: String(row.created_by || "").toLowerCase(),
        pm_approved_by: row.pm_approved_by || null,
        pm_approved_at: row.pm_approved_at || null,
        admin_approved_by: row.admin_approved_by || null,
        admin_approved_at: row.admin_approved_at || null,
        transport_mode: normalizeTransportMode(row.transport_mode),
        transport_from: typeof row.transport_from === "string" ? row.transport_from : null,
        transport_to: typeof row.transport_to === "string" ? row.transport_to : null,
        transport_trip: normalizeTransportTrip(row.transport_trip),
        receipt_storage_paths: stringArray(row.receipt_storage_paths),
        receipt_file_names: stringArray(row.receipt_file_names),
      }));
      setItems(await attachReceiptLinks(supabase, normalized));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setEditingItem(null);
    setForm(initialForm());
    setFileInputKey((value) => value + 1);
  };

  const startEdit = (item: ReimbursementItem) => {
    setEditingItem(item);
    setForm({
      projectId: item.project_id,
      date: item.date.slice(0, 10),
      category: normalizeCategory(item.category),
      amount: String(item.transport_trip === "round" ? Math.round(item.amount / 2) : Math.round(item.amount)),
      taxRate: String(item.tax_rate || 0.1),
      description: item.description || "",
      transportMode: normalizeTransportMode(item.transport_mode),
      transportFrom: item.transport_from || "",
      transportTo: item.transport_to || "",
      transportTrip: normalizeTransportTrip(item.transport_trip),
      files: [],
    });
    setFileInputKey((value) => value + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (!email || !userId) throw new Error("ログイン情報が取れなかった");
      const validation = validateForm(form);
      if (validation) throw new Error(validation);
      const reimbursementId = editingItem?.reimbursement_id || crypto.randomUUID();
      const amount = Number(form.amount.replace(/,/g, ""));
      const projectName = projectNameById.get(form.projectId) || editingItem?.project_name || form.projectId;
      const body = new FormData();
      body.set("mode", editingItem ? "update" : "create");
      body.set("reimbursement_id", reimbursementId);
      body.set("project_id", form.projectId);
      body.set("project_name", projectName);
      body.set("date", form.date);
      body.set("category", form.category);
      body.set("amount", String(amount));
      body.set("tax_rate", form.taxRate);
      body.set("description", form.description.trim());
      body.set("transport_mode", form.transportMode);
      body.set("transport_from", form.transportFrom.trim());
      body.set("transport_to", form.transportTo.trim());
      body.set("transport_trip", form.transportTrip);
      for (const file of form.files) body.append("receipts", file);

      const response = await fetch("/api/reimbursements", { method: "POST", body });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(typeof payload.error === "string" ? payload.error : "立替申請の保存に失敗した");
      }
      setMessage(editingItem ? "立替を更新した" : "立替を申請した");

      resetForm();
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (item: ReimbursementItem) => {
    if (!confirm("この立替を削除する？")) return;
    setBusyId(item.reimbursement_id);
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from("reimbursements")
        .delete()
        .eq("reimbursement_id", item.reimbursement_id)
        .eq("created_by", email)
        .eq("status", "submitted");
      if (deleteError) throw deleteError;
      if (item.receipt_storage_paths.length > 0) {
        await supabase.storage.from(RECEIPT_BUCKET).remove(item.receipt_storage_paths);
      }
      setMessage("立替を削除した");
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const decide = async (item: ReimbursementItem, action: "pmApprove" | "pmReject" | "adminApprove" | "adminReject") => {
    setBusyId(item.reimbursement_id);
    setError(null);
    setMessage(null);
    try {
      const now = new Date().toISOString();
      const baseClear = {
        pm_approved_by: null,
        pm_approved_at: null,
        admin_approved_by: null,
        admin_approved_at: null,
        updated_at: now,
      };
      const patches = {
        pmApprove: {
          status: "pmApproved",
          pm_approved_by: email,
          pm_approved_at: now,
          admin_approved_by: null,
          admin_approved_at: null,
          updated_at: now,
        },
        pmReject: { ...baseClear, status: "rejected" },
        adminApprove: {
          status: "approved",
          admin_approved_by: email,
          admin_approved_at: now,
          updated_at: now,
        },
        adminReject: { ...baseClear, status: "rejected" },
      } as const;
      const expectedStatus = action.startsWith("pm") ? "submitted" : item.status;
      const { error: updateError } = await supabase
        .from("reimbursements")
        .update(patches[action])
        .eq("reimbursement_id", item.reimbursement_id)
        .eq("status", expectedStatus);
      if (updateError) throw updateError;
      setMessage(action.includes("Reject") ? "差し戻した" : "承認した");
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const transportPreview = (() => {
    if (form.category !== "transport") return "";
    const oneWay = Number(form.amount.replace(/,/g, ""));
    if (!Number.isFinite(oneWay) || oneWay <= 0) return "";
    return form.transportTrip === "round"
      ? `往復: ¥${Math.round(oneWay).toLocaleString()} × 2 = ¥${Math.round(oneWay * 2).toLocaleString()} で申請`
      : `片道: ¥${Math.round(oneWay).toLocaleString()} で申請`;
  })();

  return (
    <div className={embedded ? "space-y-3" : "mx-auto max-w-6xl space-y-5 p-5"}>
      {embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2">
          <p className="text-xs leading-relaxed text-muted-foreground">
            申請は submitted、PM承認で pmApproved、admin承認で approved。請求書発行時は approved の立替だけが明細に入る。
          </p>
          <button type="button" onClick={() => void loadData()} className="border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted" disabled={loading}>
            再読み込み
          </button>
        </div>
      ) : (
        <header className="border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Reimbursement</p>
              <h1 className="mt-1 text-xl font-semibold text-foreground">立替精算</h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                申請は submitted、PM承認で pmApproved、admin承認で approved。請求書発行時は approved の立替だけが明細に入る。
              </p>
            </div>
            <button type="button" onClick={() => void loadData()} className="border border-border px-3 py-2 text-xs font-medium hover:bg-muted" disabled={loading}>
              再読み込み
            </button>
          </div>
        </header>
      )}

      {(error || message) && (
        <div className={`border px-3 py-2 text-sm ${error ? "border-destructive/40 bg-destructive/8 text-destructive" : "border-emerald-500/30 bg-emerald-500/8 text-emerald-700"}`}>
          {error || message}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[420px_1fr]">
        <form
          className="space-y-4 border border-border bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">{editingItem ? "立替を編集" : "立替を申請"}</h2>
            {editingItem && (
              <button type="button" onClick={resetForm} className="text-xs text-muted-foreground hover:underline">
                新規に戻す
              </button>
            )}
          </div>

          <label className="block space-y-1 text-xs font-medium">
            <span>PJ</span>
            <select value={form.projectId} onChange={(event) => setForm((current) => ({ ...current, projectId: event.target.value }))} className="w-full border border-input bg-background px-3 py-2 text-sm">
              <option value="">選択</option>
              {projects.map((project) => (
                <option key={project.project_id} value={project.project_id}>{project.project_name}</option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1 text-xs font-medium">
              <span>発生日</span>
              <input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} className="w-full border border-input bg-background px-3 py-2 text-sm" />
            </label>
            <label className="block space-y-1 text-xs font-medium">
              <span>費目</span>
              <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: normalizeCategory(event.target.value) }))} className="w-full border border-input bg-background px-3 py-2 text-sm">
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-[1fr_120px] gap-3">
            <label className="block space-y-1 text-xs font-medium">
              <span>金額（税込）{form.category === "transport" && <span className="ml-1 font-semibold text-amber-700">片道ぶんを入れて</span>}</span>
              <input inputMode="numeric" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder="1540" className="w-full border border-input bg-background px-3 py-2 text-sm" />
            </label>
            <label className="block space-y-1 text-xs font-medium">
              <span>税率</span>
              <select value={form.taxRate} onChange={(event) => setForm((current) => ({ ...current, taxRate: event.target.value }))} className="w-full border border-input bg-background px-3 py-2 text-sm">
                <option value="0.1">10%</option>
                <option value="0.08">8%</option>
                <option value="0">非課税</option>
              </select>
            </label>
          </div>

          <label className="block space-y-1 text-xs font-medium">
            <span>摘要</span>
            <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={3} placeholder="例: 研究室訪問の交通費" className="w-full resize-none border border-input bg-background px-3 py-2 text-sm" />
          </label>

          {form.category === "transport" && (
            <div className="space-y-3 border border-border bg-muted/20 p-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1 text-xs font-medium">
                  <span>交通手段</span>
                  <select value={form.transportMode} onChange={(event) => setForm((current) => ({ ...current, transportMode: normalizeTransportMode(event.target.value) }))} className="w-full border border-input bg-background px-3 py-2 text-sm">
                    <option value="train">電車</option>
                    <option value="bus">バス</option>
                    <option value="taxi">タクシー</option>
                    <option value="car">自家用車</option>
                    <option value="other">その他</option>
                  </select>
                </label>
                <label className="block space-y-1 text-xs font-medium">
                  <span>片道 / 往復</span>
                  <select value={form.transportTrip} onChange={(event) => setForm((current) => ({ ...current, transportTrip: normalizeTransportTrip(event.target.value) }))} className="w-full border border-input bg-background px-3 py-2 text-sm">
                    <option value="oneway">片道</option>
                    <option value="round">往復</option>
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input value={form.transportFrom} onChange={(event) => setForm((current) => ({ ...current, transportFrom: event.target.value }))} placeholder="出発" className="border border-input bg-background px-3 py-2 text-sm" />
                <input value={form.transportTo} onChange={(event) => setForm((current) => ({ ...current, transportTo: event.target.value }))} placeholder="到着" className="border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <p className="border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] leading-relaxed text-amber-800">
                金額欄には<span className="font-semibold">片道ぶん</span>を入れて。「往復」を選ぶと自動で2倍して申請される。
                {transportPreview && <span className="mt-0.5 block font-mono">{transportPreview}</span>}
              </p>
            </div>
          )}

          <label className="block space-y-1 text-xs font-medium">
            <span>領収書</span>
            <input
              key={fileInputKey}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={(event: ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, files: Array.from(event.target.files || []) }))}
              className="w-full border border-input bg-background px-3 py-2 text-sm"
            />
            <span className="block text-[11px] text-muted-foreground">PNG / JPEG / WebP / PDF、1ファイル10MBまで</span>
          </label>

          {editingItem && editingItem.receipt_links && editingItem.receipt_links.length > 0 && (
            <ReceiptLinks links={editingItem.receipt_links} />
          )}

          <button type="submit" disabled={saving} className="w-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {saving ? "保存中..." : editingItem ? "更新する" : "申請する"}
          </button>
        </form>

        <div className="space-y-4">
          <section className="border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">承認待ち</h2>
              <span className="text-xs text-muted-foreground">PM: {pmProjectIds.length} PJ / admin: {isAdmin ? "on" : "off"}</span>
            </div>
            {loading ? (
              <p className="mt-4 text-sm text-muted-foreground">読み込み中...</p>
            ) : approvalItems.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">承認待ちはなし</p>
            ) : (
              <div className="mt-3 space-y-2">
                {approvalItems.map((item) => (
                  <ReimburseCard
                    key={`approval-${item.reimbursement_id}`}
                    item={item}
                    projectName={projectNameById.get(item.project_id) || item.project_name || item.project_id}
                    busy={busyId === item.reimbursement_id}
                    canEdit={false}
                    canDelete={false}
                    onEdit={() => undefined}
                    onDelete={() => undefined}
                    approvalActions={
                      <>
                        {item.status === "submitted" && pmProjectSet.has(item.project_id) && (
                          <>
                            <button type="button" onClick={() => void decide(item, "pmApprove")} className="border border-emerald-500/30 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-500/10">PM承認</button>
                            <button type="button" onClick={() => void decide(item, "pmReject")} className="border border-destructive/30 px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10">差戻し</button>
                          </>
                        )}
                        {(item.status === "pmApproved" || item.status === "pmapproved") && isAdmin && (
                          <>
                            <button type="button" onClick={() => void decide(item, "adminApprove")} className="border border-emerald-500/30 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-500/10">admin承認</button>
                            <button type="button" onClick={() => void decide(item, "adminReject")} className="border border-destructive/30 px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10">却下</button>
                          </>
                        )}
                      </>
                    }
                  />
                ))}
              </div>
            )}
          </section>

          <section className="border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">自分の申請</h2>
              <span className="text-xs text-muted-foreground">{myItems.length}件</span>
            </div>
            {loading ? (
              <p className="mt-4 text-sm text-muted-foreground">読み込み中...</p>
            ) : myItems.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">自分が登録した立替はまだなし</p>
            ) : (
              <div className="mt-3 space-y-2">
                {myItems.map((item) => (
                  <ReimburseCard
                    key={item.reimbursement_id}
                    item={item}
                    projectName={projectNameById.get(item.project_id) || item.project_name || item.project_id}
                    busy={busyId === item.reimbursement_id}
                    canEdit={item.status === "submitted"}
                    canDelete={item.status === "submitted"}
                    onEdit={() => startEdit(item)}
                    onDelete={() => void deleteItem(item)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}

export default function ReimbursePage() {
  return <ReimburseWorkspace />;
}

function ReimburseCard({
  item,
  projectName,
  busy,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  approvalActions,
}: {
  item: ReimbursementItem;
  projectName: string;
  busy: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  approvalActions?: ReactNode;
}) {
  return (
    <article className="border border-border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">{item.date.slice(0, 10)}</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{CATEGORY_LABELS[normalizeCategory(item.category)]}</span>
            <StatusPill status={item.status} />
          </div>
          <h3 className="mt-1 text-sm font-semibold">{item.description || "摘要なし"}</h3>
          <p className="mt-1 truncate text-xs text-muted-foreground">{projectName}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm font-semibold">¥{Math.round(item.amount).toLocaleString()}</p>
          <p className="text-[11px] text-muted-foreground">税率 {Math.round((item.tax_rate || 0) * 100)}%</p>
          {item.transport_trip === "round" && (
            <p className="text-[10px] text-muted-foreground">往復（片道 ¥{Math.round(item.amount / 2).toLocaleString()}）</p>
          )}
        </div>
      </div>

      {normalizeCategory(item.category) === "transport" && (item.transport_from || item.transport_to || item.transport_mode) && (
        <div className="mt-2 border border-border bg-muted/20 px-2 py-1.5 text-[11px] leading-relaxed">
          <span className="font-medium text-foreground">
            {item.transport_from || "出発未記入"} → {item.transport_to || "到着未記入"}
          </span>
          <span className="ml-2 text-muted-foreground">
            {[
              item.transport_mode ? TRANSPORT_MODE_LABELS[item.transport_mode] || item.transport_mode : null,
              item.transport_trip ? TRANSPORT_TRIP_LABELS[item.transport_trip] || item.transport_trip : null,
            ].filter(Boolean).join(" / ")}
          </span>
        </div>
      )}

      <p className="mt-2 truncate text-[11px] text-muted-foreground">申請者: {item.created_by || "-"}</p>

      <div className="mt-3 grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-2">
        <ApprovalMark label="PM" by={item.pm_approved_by} at={item.pm_approved_at} />
        <ApprovalMark label="admin" by={item.admin_approved_by} at={item.admin_approved_at} />
      </div>

      {item.receipt_links && item.receipt_links.length > 0 && (
        <div className="mt-3">
          <ReceiptLinks links={item.receipt_links} />
        </div>
      )}

      {(canEdit || canDelete || approvalActions) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {canEdit && (
            <button type="button" onClick={onEdit} disabled={busy} className="border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted">
              編集
            </button>
          )}
          {canDelete && (
            <button type="button" onClick={onDelete} disabled={busy} className="border border-destructive/30 px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10">
              削除
            </button>
          )}
          {approvalActions}
        </div>
      )}
    </article>
  );
}

function ReceiptLinks({ links }: { links: ReceiptLink[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {links.map((link) => (
        <a key={`${link.name}-${link.url}`} href={link.url} target="_blank" rel="noreferrer" className="border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted">
          {link.name}
        </a>
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const color = status === "approved" || status === "paid"
    ? "bg-emerald-500/12 text-emerald-700"
    : status === "rejected"
      ? "bg-destructive/10 text-destructive"
      : status === "pmApproved" || status === "pmapproved"
        ? "bg-blue-500/12 text-blue-700"
        : "bg-amber-500/12 text-amber-700";
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${color}`}>{STATUS_LABELS[status] || status}</span>;
}

function ApprovalMark({ label, by, at }: { label: string; by: string | null; at: string | null }) {
  const approved = Boolean(by || at);
  return (
    <div className="border border-border bg-muted/20 px-2 py-1">
      <span className="font-medium text-foreground">{approved ? "済" : "待ち"} {label}</span>
      {approved && <span className="ml-2">{by || ""} {at ? at.slice(0, 10) : ""}</span>}
    </div>
  );
}

function validateForm(form: ReimburseFormState) {
  if (!form.projectId) return "PJを選んで";
  if (!form.date) return "発生日を入れて";
  if (!form.description.trim()) return "摘要を入れて";
  const amount = Number(form.amount.replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return "金額は0より大きくして";
  if (form.category === "transport") {
    if (!form.transportFrom.trim()) return "出発を入れて";
    if (!form.transportTo.trim()) return "到着を入れて";
  }
  for (const file of form.files) {
    if (file.size > MAX_RECEIPT_BYTES) return `${file.name} が10MBを超えてる`;
    if (!isAcceptedReceipt(file)) return `${file.name} はPNG/JPEG/WebP/PDFだけ対応`;
  }
  return null;
}

async function attachReceiptLinks(supabase: ReturnType<typeof createClient>, rows: ReimbursementItem[]) {
  const bucket = supabase.storage.from(RECEIPT_BUCKET);
  return Promise.all(rows.map(async (row) => {
    const links: ReceiptLink[] = [];
    for (const [index, path] of row.receipt_storage_paths.entries()) {
      const { data } = await bucket.createSignedUrl(path, 60 * 60);
      if (data?.signedUrl) {
        links.push({ name: row.receipt_file_names[index] || `receipt-${index + 1}`, url: data.signedUrl });
      }
    }
    return { ...row, receipt_links: links };
  }));
}

function todayInputDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function normalizeCategory(value: unknown): ReimburseCategory {
  if (value === "transport" || value === "lodging" || value === "supplies" || value === "meal" || value === "other") return value;
  return "other";
}

function normalizeTransportMode(value: unknown): TransportMode {
  if (value === "train" || value === "bus" || value === "taxi" || value === "car" || value === "other") return value;
  return "train";
}

function normalizeTransportTrip(value: unknown): TransportTrip {
  return value === "round" ? "round" : "oneway";
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function isAcceptedReceipt(file: File) {
  const type = file.type || contentTypeFromName(file.name);
  return type === "image/png" || type === "image/jpeg" || type === "image/webp" || type === "application/pdf";
}

function contentTypeFromName(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

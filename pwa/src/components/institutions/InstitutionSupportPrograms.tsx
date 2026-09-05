"use client";

/**
 * /institutions「支援プログラム比較」タブ。
 *
 * 行は institutions テーブルの全機関 (SU関連規程タブと同じ母集団)、列は制度比較マトリクスのうち
 * compare_sort を持つ項目。認定の条件と、認定後に何を提供するか (学内本店登記、部屋、共用設備、
 * 知財、資金、伴走) を機関横断で比べる。データは参照系なので
 * lib/institution-support-programs-client.ts (reference-data-cache 経由) からだけ読む。
 */
import Link from "next/link";
import { ExternalLink, Pencil, Plus, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import {
  POLICY_SOURCE_LABEL,
  POLICY_STATUSES,
  POLICY_STATUS_LABEL,
  POLICY_STATUS_TONE,
  type InstitutionPolicyStatus,
} from "@/lib/institution-policy";
import {
  loadInstitutionSupportPrograms,
  peekInstitutionSupportPrograms,
  saveInstitutionSupportProgramCell,
  saveInstitutionSupportProgramRecommendation,
} from "@/lib/institution-support-programs-client";
import {
  RECOMMENDATION_STANCES,
  RECOMMENDATION_STANCE_LABEL,
  type RecommendationStance,
  type SupportProgramBundle,
  type SupportProgramCell,
  type SupportProgramColumn,
  type SupportProgramRecommendation,
} from "@/types/institution-support-programs";

type Institution = {
  institutionId: string;
  name: string;
  shortName?: string | null;
};

const SKELETON_COLUMNS = 16;
const CLAMP_2: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

function cellKey(institutionId: string, policyItemId: string) {
  return `${institutionId}:${policyItemId}`;
}

/** 連続する同じ群をまとめて、見出し行の colSpan にする。 */
function groupColumns(columns: SupportProgramColumn[]) {
  const groups: Array<{ group: string; span: number }> = [];
  for (const column of columns) {
    const last = groups.at(-1);
    if (last && last.group === column.group) last.span += 1;
    else groups.push({ group: column.group, span: 1 });
  }
  return groups;
}

export function SupportProgramMatrix({
  institutions,
  query,
}: {
  institutions: Institution[];
  query: string;
}) {
  const [bundle, setBundle] = useState<SupportProgramBundle | undefined>(() =>
    peekInstitutionSupportPrograms(),
  );
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<{
    institution: Institution;
    column: SupportProgramColumn;
  } | null>(null);

  const reload = useCallback(
    (force?: boolean) =>
      loadInstitutionSupportPrograms({ force })
        .then((value) => {
          setBundle(value);
          setError("");
        })
        .catch((cause: unknown) =>
          setError(cause instanceof Error ? cause.message : "読み込み失敗"),
        ),
    [],
  );

  useEffect(() => {
    if (!bundle) void reload();
  }, [bundle, reload]);

  const rows = useMemo(() => {
    const q = query.normalize("NFKC").trim().toLowerCase();
    return institutions.filter(
      (institution) =>
        !q ||
        `${institution.name} ${institution.shortName || ""}`
          .normalize("NFKC")
          .toLowerCase()
          .includes(q),
    );
  }, [institutions, query]);

  const columns = useMemo(() => bundle?.columns ?? [], [bundle]);
  const groups = useMemo(() => groupColumns(columns), [columns]);
  const cells = useMemo(
    () =>
      new Map(
        (bundle?.cells ?? []).map((cell) => [
          cellKey(cell.institutionId, cell.policyItemId),
          cell,
        ]),
      ),
    [bundle],
  );

  const summary = useMemo(() => {
    const establishedCount = (key: string) => {
      const column = columns.find((item) => item.key === key);
      if (!column) return null;
      return rows.filter(
        (row) =>
          cells.get(cellKey(row.institutionId, column.policyItemId))?.status ===
          "established",
      ).length;
    };
    let confirmed = 0;
    for (const row of rows) {
      for (const column of columns) {
        const status = cells.get(cellKey(row.institutionId, column.policyItemId))?.status;
        if (status && status !== "unknown") confirmed += 1;
      }
    }
    return {
      institutions: rows.length,
      certification: establishedCount("certification_rule"),
      headOffice: establishedCount("head_office_registration"),
      facility: establishedCount("facility_lease"),
      equipment: establishedCount("shared_equipment"),
      confirmed,
      total: rows.length * columns.length,
    };
  }, [rows, columns, cells]);

  const selectedCell = selected
    ? cells.get(cellKey(selected.institution.institutionId, selected.column.policyItemId))
    : undefined;

  return (
    <section className="space-y-3" aria-labelledby="support-program-matrix-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="support-program-matrix-title"
            className="text-base font-bold text-slate-950"
          >
            全研究機関 支援プログラム比較
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
            どういう条件で認定し、認定後に何を提供するか（学内本店登記、部屋、共用設備、知財、資金、伴走）を機関横断で比べる。
            行はSU関連規程と同じ研究機関マスタ。セルをクリックすると根拠と出典を開く。
          </p>
        </div>
        <ul className="flex flex-wrap items-center gap-1.5 text-[10px]" aria-label="状態の凡例">
          {POLICY_STATUSES.map((status) => (
            <li
              key={status}
              className={`border px-1.5 py-0.5 font-semibold ${POLICY_STATUS_TONE[status]}`}
            >
              {POLICY_STATUS_LABEL[status]}
            </li>
          ))}
        </ul>
      </div>

      {error && (
        <p className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {error}
          <button
            type="button"
            onClick={() => void reload(true)}
            className="ml-3 border-b border-dotted border-current text-xs font-semibold"
          >
            読み直す
          </button>
        </p>
      )}

      <dl className="grid grid-cols-3 divide-x divide-slate-200 border-y border-slate-200 py-2 sm:grid-cols-6">
        <Metric label="研究機関" value={`${summary.institutions}機関`} />
        <Metric label="認定制度あり" value={countLabel(summary.certification, bundle)} />
        <Metric label="学内本店登記 可" value={countLabel(summary.headOffice, bundle)} />
        <Metric label="施設貸与あり" value={countLabel(summary.facility, bundle)} />
        <Metric label="共用設備あり" value={countLabel(summary.equipment, bundle)} />
        <Metric
          label="確認済みセル"
          value={bundle ? `${summary.confirmed} / ${summary.total}` : "—"}
        />
      </dl>

      <div className="overflow-x-auto border border-slate-200 bg-white">
        <table className="w-full min-w-[2300px] border-collapse text-left">
          <thead>
            <tr className="bg-slate-50 text-[10px] font-semibold text-slate-600">
              <th
                rowSpan={2}
                className="sticky left-0 z-20 w-56 border-b border-r border-slate-200 bg-slate-50 px-3 py-2 align-bottom"
              >
                研究機関
              </th>
              {bundle
                ? groups.map((group, index) => (
                    <th
                      key={`${group.group}-${index}`}
                      colSpan={group.span}
                      className="border-b border-r border-slate-200 px-2 py-1.5 text-center text-[10px] font-bold text-indigo-800"
                    >
                      {group.group}
                    </th>
                  ))
                : (
                    <th
                      colSpan={SKELETON_COLUMNS}
                      className="border-b border-r border-slate-200 px-2 py-1.5 text-center text-[10px] font-normal text-slate-400"
                    >
                      比較項目を読み込み中…
                    </th>
                  )}
            </tr>
            <tr className="bg-slate-50 text-[10px] font-semibold text-slate-600">
              {bundle
                ? columns.map((column) => (
                    <th
                      key={column.policyItemId}
                      title={column.description ?? column.fullLabel}
                      className="min-w-[132px] border-b border-r border-slate-200 px-2 py-2 text-center"
                    >
                      {column.label}
                    </th>
                  ))
                : Array.from({ length: SKELETON_COLUMNS }, (_, index) => (
                    <th
                      key={index}
                      className="min-w-[132px] border-b border-r border-slate-200 px-2 py-2"
                    >
                      <span className="block h-3 w-16 animate-pulse rounded bg-slate-200" />
                    </th>
                  ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={(columns.length || SKELETON_COLUMNS) + 1}
                  className="px-4 py-10 text-center text-sm text-slate-500"
                >
                  条件に合う研究機関がない
                </td>
              </tr>
            )}
            {rows.map((institution) => (
              <tr key={institution.institutionId} className="hover:bg-slate-50/70">
                <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900">
                  <Link
                    href={`/institutions/${institution.institutionId}`}
                    className="hover:text-indigo-700"
                  >
                    {institution.name}
                  </Link>
                </th>
                {bundle
                  ? columns.map((column) => (
                      <td
                        key={column.policyItemId}
                        className="border-b border-r border-slate-200 p-0 align-top"
                      >
                        <CellButton
                          cell={cells.get(
                            cellKey(institution.institutionId, column.policyItemId),
                          )}
                          onClick={() => setSelected({ institution, column })}
                        />
                      </td>
                    ))
                  : Array.from({ length: SKELETON_COLUMNS }, (_, index) => (
                      <td
                        key={index}
                        className="border-b border-r border-slate-200 px-2 py-2"
                      >
                        <span className="block h-3 w-10 animate-pulse rounded bg-slate-100" />
                      </td>
                    ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <RecommendationSection
        loaded={Boolean(bundle)}
        recommendations={bundle?.recommendations ?? []}
        columns={columns}
        institutions={institutions}
        cells={cells}
        canEdit={Boolean(bundle?.canEdit)}
        onSaved={() => reload(true)}
      />

      {selected && (
        <CellDetail
          key={cellKey(selected.institution.institutionId, selected.column.policyItemId)}
          institution={selected.institution}
          column={selected.column}
          cell={selectedCell}
          canEdit={Boolean(bundle?.canEdit)}
          onClose={() => setSelected(null)}
          onSaved={() => reload(true)}
        />
      )}
    </section>
  );
}

function countLabel(count: number | null, bundle: SupportProgramBundle | undefined) {
  if (!bundle) return "—";
  return count == null ? "列なし" : `${count}機関`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 first:pl-0">
      <dt className="text-[10px] text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-base font-bold tabular-nums text-slate-950">
        {value}
      </dd>
    </div>
  );
}

function CellButton({
  cell,
  onClick,
}: {
  cell: SupportProgramCell | undefined;
  onClick: () => void;
}) {
  const status: InstitutionPolicyStatus = cell?.status ?? "unknown";
  const empty = status === "unknown" && !cell?.note && !cell?.value;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${POLICY_STATUS_LABEL[status]}${cell?.value ? `: ${cell.value}` : ""}`}
      className="block min-h-12 w-full px-2 py-1.5 text-left hover:bg-indigo-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
    >
      {empty ? (
        <span className="text-[10px] text-slate-400">未確認</span>
      ) : (
        <>
          <span
            className={`inline-block border px-1 py-px text-[10px] font-semibold leading-tight ${POLICY_STATUS_TONE[status]}`}
          >
            {POLICY_STATUS_LABEL[status]}
          </span>
          {cell?.value && (
            <span
              className="mt-0.5 block text-[11px] leading-snug text-slate-800"
              style={CLAMP_2}
            >
              {cell.value}
            </span>
          )}
        </>
      )}
    </button>
  );
}

function CellDetail({
  institution,
  column,
  cell,
  canEdit,
  onClose,
  onSaved,
}: {
  institution: Institution;
  column: SupportProgramColumn;
  cell: SupportProgramCell | undefined;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<InstitutionPolicyStatus>(cell?.status ?? "unknown");
  const [value, setValue] = useState(cell?.value ?? "");
  const [note, setNote] = useState(cell?.note ?? "");
  const [sourceUrl, setSourceUrl] = useState(cell?.sourceUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  async function save() {
    setSaving(true);
    setSaveError("");
    try {
      const trimmedUrl = sourceUrl.trim();
      await saveInstitutionSupportProgramCell({
        institutionId: institution.institutionId,
        policyItemId: column.policyItemId,
        status,
        value: value.trim() || null,
        note: note.trim() || null,
        sourceUrl: trimmedUrl || null,
        sourceType: trimmedUrl
          ? "official"
          : cell?.sourceType && cell.sourceType !== "unknown"
            ? cell.sourceType
            : "unknown",
        confirmedAt: new Date().toISOString().slice(0, 10),
      });
      onSaved();
      onClose();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "保存できなかった");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "min-h-10 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";
  const displayStatus = cell?.status ?? "unknown";

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/35"
      role="dialog"
      aria-modal="true"
      aria-label={`${institution.name}の${column.fullLabel}`}
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-indigo-700">支援プログラム比較</p>
            <h3 className="mt-1 text-lg font-bold text-slate-950">{institution.name}</h3>
            <p className="mt-0.5 text-sm font-semibold text-slate-700">{column.fullLabel}</p>
            {column.description && (
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{column.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-2 hover:bg-slate-100"
            aria-label="閉じる"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!editing ? (
          <dl className="mt-5 grid gap-4 text-sm">
            <div>
              <dt className="text-[10px] font-semibold text-slate-500">状態</dt>
              <dd className="mt-1">
                <span
                  className={`inline-block border px-1.5 py-0.5 text-xs font-semibold ${POLICY_STATUS_TONE[displayStatus]}`}
                >
                  {POLICY_STATUS_LABEL[displayStatus]}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold text-slate-500">内容</dt>
              <dd className="mt-1 text-slate-900">{cell?.value || "—"}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold text-slate-500">根拠</dt>
              <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-slate-800">
                {cell?.note || "根拠は未登録。公開情報で確認できていない。"}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold text-slate-500">出典</dt>
              <dd className="mt-1">
                {cell?.sourceUrl ? (
                  <a
                    href={cell.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 break-all border-b border-dotted border-current text-xs font-semibold text-indigo-700 hover:text-indigo-950"
                  >
                    {cell.sourceUrl}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                ) : (
                  <span className="text-xs text-slate-500">
                    {cell ? POLICY_SOURCE_LABEL[cell.sourceType] : "未設定"}
                  </span>
                )}
                {cell?.confirmedAt && (
                  <span className="ml-2 text-[10px] text-slate-400">確認 {cell.confirmedAt}</span>
                )}
              </dd>
            </div>
            {canEdit && (
              <div className="border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex min-h-10 items-center gap-2 border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  このセルを編集
                </button>
              </div>
            )}
          </dl>
        ) : (
          <div className="mt-5 grid gap-4">
            <Field label="状態">
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as InstitutionPolicyStatus)}
                className={inputClass}
              >
                {POLICY_STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {POLICY_STATUS_LABEL[item]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="内容（表のセルに出る短い文）">
              <input
                className={inputClass}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="例：可（インキュベーション施設入居者・無償）"
              />
            </Field>
            <Field label="根拠（条文・ページ名）">
              <textarea
                className={`${inputClass} min-h-24`}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </Field>
            <Field label="出典URL">
              <input
                className={inputClass}
                type="url"
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                placeholder="https://...（なければ空欄）"
              />
            </Field>
            {saveError && <p className="text-sm text-red-700">{saveError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="min-h-11 bg-slate-950 px-4 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setEditing(false)}
                className="min-h-11 border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                やめる
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

// ---------------------------------------------------------------------------
// AMDが規程類に盛り込むべき論点と推奨 (比較表の下段)
// ---------------------------------------------------------------------------

const STANCE_TONE: Record<RecommendationStance, string> = {
  recommend: "border-indigo-300 bg-indigo-50 text-indigo-800",
  conditional: "border-amber-300 bg-amber-50 text-amber-800",
  not_recommend: "border-rose-300 bg-rose-50 text-rose-800",
  open: "border-slate-300 bg-slate-100 text-slate-600",
};

type RecommendationStats = {
  established: number;
  drafting: number;
  notStarted: number;
  unknown: number;
  total: number;
  /** unknown 以外 (根拠を見て判断した機関) */
  confirmed: number;
};

/** 論点に紐づく比較列について、全機関の整備状況を数える。未確認は分母に入れず別に出す。 */
function computeRecommendationStats(
  policyItemId: string,
  institutions: Institution[],
  cells: Map<string, SupportProgramCell>,
): RecommendationStats {
  const stats: RecommendationStats = {
    established: 0,
    drafting: 0,
    notStarted: 0,
    unknown: 0,
    total: institutions.length,
    confirmed: 0,
  };
  for (const institution of institutions) {
    const status = cells.get(cellKey(institution.institutionId, policyItemId))?.status ?? "unknown";
    if (status === "established") stats.established += 1;
    else if (status === "drafting") stats.drafting += 1;
    else if (status === "not_started") stats.notStarted += 1;
    else stats.unknown += 1;
  }
  stats.confirmed = stats.total - stats.unknown;
  return stats;
}

function StatBar({ stats, statNote }: { stats: RecommendationStats | null; statNote: string | null }) {
  if (!stats) {
    return (
      <div className="text-[11px] text-slate-500">
        比較列に紐づかない論点
        {statNote && <p className="mt-0.5 text-slate-700">{statNote}</p>}
      </div>
    );
  }
  const percent = stats.confirmed ? Math.round((stats.established / stats.confirmed) * 100) : null;
  const width = (count: number) => `${stats.total ? (count / stats.total) * 100 : 0}%`;
  return (
    <div className="min-w-[200px] text-[11px] leading-snug text-slate-700">
      <p>
        <span className="font-semibold tabular-nums text-slate-950">
          整備済み {stats.established}
        </span>
        <span className="text-slate-500"> / 確認済み {stats.confirmed} 機関</span>
        {percent != null && (
          <span className="ml-1 font-semibold tabular-nums text-indigo-800">({percent}%)</span>
        )}
      </p>
      <div
        className="mt-1 flex h-1.5 w-full overflow-hidden bg-slate-100"
        role="img"
        aria-label={`整備済み${stats.established}、検討中${stats.drafting}、未整備${stats.notStarted}、未確認${stats.unknown}、全${stats.total}機関`}
      >
        <span className="bg-emerald-500" style={{ width: width(stats.established) }} />
        <span className="bg-amber-400" style={{ width: width(stats.drafting) }} />
        <span className="bg-rose-400" style={{ width: width(stats.notStarted) }} />
      </div>
      <p className="mt-0.5 text-[10px] text-slate-500">
        検討中 {stats.drafting} · 未整備 {stats.notStarted} · 未確認 {stats.unknown}（全{stats.total}機関）
      </p>
      {statNote && <p className="mt-0.5 text-slate-700">{statNote}</p>}
    </div>
  );
}

function RecommendationSection({
  loaded,
  recommendations,
  columns,
  institutions,
  cells,
  canEdit,
  onSaved,
}: {
  loaded: boolean;
  recommendations: SupportProgramRecommendation[];
  columns: SupportProgramColumn[];
  institutions: Institution[];
  cells: Map<string, SupportProgramCell>;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<SupportProgramRecommendation | "new" | null>(null);
  const columnById = useMemo(
    () => new Map(columns.map((column) => [column.policyItemId, column])),
    [columns],
  );
  const stanceCount = (stance: RecommendationStance) =>
    recommendations.filter((item) => item.stance === stance).length;

  return (
    <section
      className="space-y-3 border-t border-slate-200 pt-5"
      aria-labelledby="policy-recommendation-title"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="policy-recommendation-title" className="text-base font-bold text-slate-950">
            AMDが規程類に盛り込むべき論点と推奨
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
            上の比較を踏まえ、認定規程・支援細則・関連規程へ盛り込む論点ごとに、AMDの推奨と根拠をまとめる。
            「他機関の整備状況」は比較表のデータから自動で数える（未確認は分母に入れない）。行をクリックすると全文を開く。
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setSelected("new")}
            className="inline-flex min-h-9 items-center gap-1.5 border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Plus className="h-3.5 w-3.5" />
            論点を追加
          </button>
        )}
      </div>

      <dl className="grid grid-cols-3 divide-x divide-slate-200 border-y border-slate-200 py-2 sm:grid-cols-5">
        <Metric label="論点" value={loaded ? `${recommendations.length}件` : "—"} />
        <Metric label="推奨" value={loaded ? `${stanceCount("recommend")}件` : "—"} />
        <Metric label="条件付き推奨" value={loaded ? `${stanceCount("conditional")}件` : "—"} />
        <Metric label="推奨しない" value={loaded ? `${stanceCount("not_recommend")}件` : "—"} />
        <Metric label="要検討" value={loaded ? `${stanceCount("open")}件` : "—"} />
      </dl>

      <div className="overflow-x-auto border border-slate-200 bg-white">
        <table className="w-full min-w-[1180px] border-collapse text-left">
          <thead>
            <tr className="bg-slate-50 text-[10px] font-semibold text-slate-600">
              <th className="w-[22%] border-b border-r border-slate-200 px-3 py-2">論点</th>
              <th className="w-[22%] border-b border-r border-slate-200 px-3 py-2">AMDの推奨</th>
              <th className="w-[18%] border-b border-r border-slate-200 px-3 py-2">他機関の整備状況</th>
              <th className="w-[19%] border-b border-r border-slate-200 px-3 py-2">規程へ盛り込む条件</th>
              <th className="w-[19%] border-b border-slate-200 px-3 py-2">根拠</th>
            </tr>
          </thead>
          <tbody>
            {!loaded &&
              Array.from({ length: 4 }, (_, index) => (
                <tr key={index}>
                  {Array.from({ length: 5 }, (_, cell) => (
                    <td key={cell} className="border-b border-r border-slate-200 px-3 py-3 last:border-r-0">
                      <span className="block h-3 w-24 animate-pulse rounded bg-slate-100" />
                    </td>
                  ))}
                </tr>
              ))}
            {loaded && recommendations.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                  推奨はまだ登録されていない。比較表の調査が出揃ったあとに、統計とKUTEで作った規程を踏まえて論点ごとに起草する。
                </td>
              </tr>
            )}
            {loaded &&
              recommendations.map((item) => {
                const column = item.policyItemId ? columnById.get(item.policyItemId) : undefined;
                const stats = item.policyItemId
                  ? computeRecommendationStats(item.policyItemId, institutions, cells)
                  : null;
                return (
                  <tr
                    key={item.recommendationId}
                    onClick={() => setSelected(item)}
                    className="cursor-pointer align-top hover:bg-indigo-50/40"
                  >
                    <td className="border-b border-r border-slate-200 px-3 py-2">
                      <p className="text-sm font-semibold leading-snug text-slate-950">{item.topic}</p>
                      {column && (
                        <p className="mt-0.5 text-[10px] text-indigo-700">
                          比較列: {column.group} › {column.label}
                        </p>
                      )}
                    </td>
                    <td className="border-b border-r border-slate-200 px-3 py-2">
                      <span
                        className={`inline-block border px-1.5 py-px text-[10px] font-semibold ${STANCE_TONE[item.stance]}`}
                      >
                        {RECOMMENDATION_STANCE_LABEL[item.stance]}
                      </span>
                      <p className="mt-1 text-xs leading-snug text-slate-900" style={CLAMP_2}>
                        {item.recommendation}
                      </p>
                    </td>
                    <td className="border-b border-r border-slate-200 px-3 py-2">
                      <StatBar stats={stats} statNote={item.statNote} />
                    </td>
                    <td className="border-b border-r border-slate-200 px-3 py-2">
                      <p className="text-[11px] leading-snug text-slate-800" style={CLAMP_2}>
                        {item.conditions || "—"}
                      </p>
                    </td>
                    <td className="border-b border-slate-200 px-3 py-2">
                      <p className="text-[11px] leading-snug text-slate-800" style={CLAMP_2}>
                        {item.rationale || "—"}
                      </p>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {selected && (
        <RecommendationDetail
          key={selected === "new" ? "new" : selected.recommendationId}
          item={selected === "new" ? null : selected}
          columns={columns}
          stats={
            selected !== "new" && selected.policyItemId
              ? computeRecommendationStats(selected.policyItemId, institutions, cells)
              : null
          }
          canEdit={canEdit}
          nextSortOrder={(recommendations.at(-1)?.sortOrder ?? 0) + 10}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            onSaved();
          }}
        />
      )}
    </section>
  );
}

function RecommendationDetail({
  item,
  columns,
  stats,
  canEdit,
  nextSortOrder,
  onClose,
  onSaved,
}: {
  item: SupportProgramRecommendation | null;
  columns: SupportProgramColumn[];
  stats: RecommendationStats | null;
  canEdit: boolean;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(item == null);
  const [topic, setTopic] = useState(item?.topic ?? "");
  const [policyItemId, setPolicyItemId] = useState(item?.policyItemId ?? "");
  const [stance, setStance] = useState<RecommendationStance>(item?.stance ?? "recommend");
  const [recommendation, setRecommendation] = useState(item?.recommendation ?? "");
  const [conditions, setConditions] = useState(item?.conditions ?? "");
  const [rationale, setRationale] = useState(item?.rationale ?? "");
  const [evidenceNote, setEvidenceNote] = useState(item?.evidenceNote ?? "");
  const [statNote, setStatNote] = useState(item?.statNote ?? "");
  const [sortOrder, setSortOrder] = useState(item?.sortOrder ?? nextSortOrder);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  async function save(isActive = true) {
    setSaving(true);
    setSaveError("");
    try {
      await saveInstitutionSupportProgramRecommendation({
        recommendationId: item?.recommendationId ?? null,
        policyItemId: policyItemId || null,
        topic: topic.trim(),
        stance,
        recommendation: recommendation.trim(),
        conditions: conditions.trim() || null,
        rationale: rationale.trim() || null,
        evidenceNote: evidenceNote.trim() || null,
        statNote: statNote.trim() || null,
        sortOrder,
        isActive,
      });
      onSaved();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "保存できなかった");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "min-h-10 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";
  const column = item?.policyItemId
    ? columns.find((entry) => entry.policyItemId === item.policyItemId)
    : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/35"
      role="dialog"
      aria-modal="true"
      aria-label={item ? item.topic : "論点を追加"}
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-indigo-700">規程類に盛り込む論点</p>
            <h3 className="mt-1 text-lg font-bold leading-snug text-slate-950">
              {item ? item.topic : "新しい論点"}
            </h3>
            {column && (
              <p className="mt-0.5 text-[11px] text-slate-500">
                比較列: {column.group} › {column.label}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="rounded p-2 hover:bg-slate-100" aria-label="閉じる">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!editing && item ? (
          <dl className="mt-5 grid gap-4 text-sm">
            <div>
              <dt className="text-[10px] font-semibold text-slate-500">AMDの推奨</dt>
              <dd className="mt-1">
                <span className={`inline-block border px-1.5 py-0.5 text-xs font-semibold ${STANCE_TONE[item.stance]}`}>
                  {RECOMMENDATION_STANCE_LABEL[item.stance]}
                </span>
                <p className="mt-1.5 whitespace-pre-wrap leading-relaxed text-slate-900">{item.recommendation}</p>
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold text-slate-500">他機関の整備状況</dt>
              <dd className="mt-1">
                <StatBar stats={stats} statNote={item.statNote} />
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold text-slate-500">規程へ盛り込む条件</dt>
              <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-slate-800">{item.conditions || "—"}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold text-slate-500">根拠</dt>
              <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-slate-800">{item.rationale || "—"}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold text-slate-500">代表例・出典</dt>
              <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-slate-800">{item.evidenceNote || "—"}</dd>
            </div>
            <p className="text-[10px] text-slate-400">更新 {item.updatedAt.slice(0, 10)}</p>
            {canEdit && (
              <div className="border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex min-h-10 items-center gap-2 border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  この論点を編集
                </button>
              </div>
            )}
          </dl>
        ) : (
          <div className="mt-5 grid gap-4">
            <Field label="論点（問いの形で）">
              <input className={inputClass} value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="例：学内に本店登記を認めるか" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="紐づける比較列">
                <select className={inputClass} value={policyItemId} onChange={(event) => setPolicyItemId(event.target.value)}>
                  <option value="">紐づけない（統計なし）</option>
                  {columns.map((entry) => (
                    <option key={entry.policyItemId} value={entry.policyItemId}>
                      {entry.group} › {entry.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="スタンス">
                <select className={inputClass} value={stance} onChange={(event) => setStance(event.target.value as RecommendationStance)}>
                  {RECOMMENDATION_STANCES.map((entry) => (
                    <option key={entry} value={entry}>
                      {RECOMMENDATION_STANCE_LABEL[entry]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="AMDの推奨（一文）">
              <textarea className={`${inputClass} min-h-20`} value={recommendation} onChange={(event) => setRecommendation(event.target.value)} />
            </Field>
            <Field label="規程へ盛り込む条件・条文の骨子">
              <textarea className={`${inputClass} min-h-24`} value={conditions} onChange={(event) => setConditions(event.target.value)} />
            </Field>
            <Field label="根拠（大学の負担、リスク、AMDの実務経験）">
              <textarea className={`${inputClass} min-h-24`} value={rationale} onChange={(event) => setRationale(event.target.value)} />
            </Field>
            <Field label="代表例・出典（機関名と規程名）">
              <textarea className={`${inputClass} min-h-20`} value={evidenceNote} onChange={(event) => setEvidenceNote(event.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="統計への補足（任意）">
                <input className={inputClass} value={statNote} onChange={(event) => setStatNote(event.target.value)} />
              </Field>
              <Field label="表示順">
                <input className={inputClass} type="number" value={sortOrder} onChange={(event) => setSortOrder(Number(event.target.value) || 0)} />
              </Field>
            </div>
            {saveError && <p className="text-sm text-red-700">{saveError}</p>}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving || !topic.trim() || !recommendation.trim()}
                onClick={() => void save(true)}
                className="min-h-11 bg-slate-950 px-4 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => (item ? setEditing(false) : onClose())}
                className="min-h-11 border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                やめる
              </button>
              {item && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void save(false)}
                  className="ml-auto min-h-11 border border-rose-300 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                >
                  表から外す
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

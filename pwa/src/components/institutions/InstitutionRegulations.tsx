"use client";

import Link from "next/link";
import { ExternalLink, FileClock, Pencil, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  REGULATION_STATE_LABEL,
  VERSION_STATE_LABEL,
  currentVersion,
  fetchInstitutionRegulations,
  regulationHref,
  type InstitutionRegulation,
  type RegulationBundle,
  type RegulationCell,
  type RegulationState,
  type RegulationType,
} from "@/lib/institution-regulations";

type Institution = {
  institutionId: string;
  name: string;
  shortName?: string | null;
};

function StatusLink({
  institutionId,
  cell,
  regulation,
  bundle,
}: {
  institutionId: string;
  cell?: RegulationCell;
  regulation?: InstitutionRegulation;
  bundle: RegulationBundle;
}) {
  const state = cell?.state ?? "unconfirmed";
  const label = REGULATION_STATE_LABEL[state];
  if (!regulation)
    return <span className="text-[11px] text-slate-400">{label}</span>;
  const href = regulationHref(institutionId, regulation, bundle.versions);
  const external = href.startsWith("http");
  const className =
    state === "effective"
      ? "inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 font-bold text-emerald-800 hover:bg-emerald-100"
      : "inline-flex min-h-8 items-center gap-1 border-b border-dotted border-current text-[11px] font-semibold text-indigo-700 hover:text-indigo-950";
  return external ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={className}
      aria-label={`${regulation.title}を開く`}
    >
      {label}
      {state !== "effective" && <ExternalLink className="h-3 w-3" />}
    </a>
  ) : (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}

export function RegulationMatrix({
  institutions,
  query,
}: {
  institutions: Institution[];
  query: string;
}) {
  const [bundle, setBundle] = useState<RegulationBundle | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetchInstitutionRegulations()
      .then(setBundle)
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "読み込み失敗"),
      );
  }, []);
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
  if (error)
    return (
      <p className="border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        {error}
      </p>
    );
  if (!bundle)
    return (
      <p className="p-8 text-center text-sm text-slate-500">
        規程リストを読み込み中...
      </p>
    );
  const regulations = new Map(
    bundle.regulations.map((item) => [item.regulationId, item]),
  );
  const cells = new Map(
    bundle.cells.map((item) => [
      `${item.institutionId}:${item.regulationTypeId}`,
      item,
    ]),
  );
  return (
    <section className="space-y-3" aria-labelledby="regulation-matrix-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="regulation-matrix-title"
            className="text-base font-bold text-slate-950"
          >
            全研究機関 SU関連規程リスト
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            ◯は施行中。クリックすると外部正本、外部文書がない場合はOS内台帳を開く。
          </p>
        </div>
        <p className="text-[11px] text-slate-500">
          作成中・審議中も同じ台帳から表示
        </p>
      </div>
      <div className="overflow-x-auto border border-slate-200 bg-white">
        <table className="min-w-[1080px] w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50 text-[10px] font-semibold text-slate-600">
              <th className="sticky left-0 z-10 w-56 border-b border-r border-slate-200 bg-slate-50 px-3 py-3">
                研究機関
              </th>
              {bundle.types.map((type) => (
                <th
                  key={type.regulationTypeId}
                  className="min-w-24 border-b border-r border-slate-200 px-2 py-3 text-center"
                  title={type.label}
                >
                  {type.shortLabel}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((institution) => (
              <tr key={institution.institutionId} className="hover:bg-slate-50">
                <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-3 py-3 text-xs font-semibold text-slate-900">
                  <Link
                    href={`/institutions/${institution.institutionId}/cockpit`}
                    className="hover:text-indigo-700"
                  >
                    {institution.name}
                  </Link>
                </th>
                {bundle.types.map((type) => {
                  const cell = cells.get(
                    `${institution.institutionId}:${type.regulationTypeId}`,
                  );
                  const regulation = cell?.regulationId
                    ? regulations.get(cell.regulationId)
                    : undefined;
                  return (
                    <td
                      key={type.regulationTypeId}
                      className="h-14 border-b border-r border-slate-200 px-2 text-center"
                    >
                      <StatusLink
                        institutionId={institution.institutionId}
                        cell={cell}
                        regulation={regulation}
                        bundle={bundle}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function InstitutionRegulationsPanel({
  institutionId,
}: {
  institutionId: string;
}) {
  const [bundle, setBundle] = useState<RegulationBundle | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<RegulationType | null>(null);
  const load = useCallback(
    () =>
      fetchInstitutionRegulations(institutionId)
        .then(setBundle)
        .catch((cause) =>
          setError(cause instanceof Error ? cause.message : "読み込み失敗"),
        ),
    [institutionId],
  );
  useEffect(() => {
    load();
  }, [load]);
  if (error)
    return (
      <p className="border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        {error}
      </p>
    );
  if (!bundle)
    return (
      <p className="p-8 text-center text-sm text-slate-500">
        規程リストを読み込み中...
      </p>
    );
  const cells = new Map(
    bundle.cells.map((item) => [item.regulationTypeId, item]),
  );
  const regulations = new Map(
    bundle.regulations.map((item) => [item.regulationId, item]),
  );
  return (
    <section
      className="border border-slate-200 bg-white"
      aria-labelledby="institution-regulations-title"
    >
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-4 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-700">
            正本・版管理
          </p>
          <h2
            id="institution-regulations-title"
            className="mt-1 text-lg font-bold text-slate-950"
          >
            SU関連規程リスト
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            外部文書を正本として優先。作成途中の版と次の決裁をここで管理する。
          </p>
        </div>
        {!bundle.canEdit && (
          <span className="text-[11px] text-slate-500">閲覧のみ</span>
        )}
      </header>
      {(["core", "supporting"] as const).map((group) => (
        <div key={group}>
          <h3 className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-bold text-slate-600">
            {group === "core" ? "中核規程" : "運用・審査文書"}
          </h3>
          <div className="divide-y divide-slate-200">
            {bundle.types
              .filter((type) => type.groupKey === group)
              .map((type) => {
                const cell = cells.get(type.regulationTypeId);
                const regulation = cell?.regulationId
                  ? regulations.get(cell.regulationId)
                  : undefined;
                const version = regulation
                  ? currentVersion(bundle.versions, regulation.regulationId)
                  : null;
                return (
                  <article
                    key={type.regulationTypeId}
                    className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(220px,1.4fr)_100px_minmax(170px,1fr)_minmax(180px,1fr)_36px] md:items-center"
                  >
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-slate-950">
                        {type.label}
                      </h4>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        {regulation?.currentStateNote || type.description}
                      </p>
                    </div>
                    <div>
                      <StatusLink
                        institutionId={institutionId}
                        cell={cell}
                        regulation={regulation}
                        bundle={bundle}
                      />
                    </div>
                    <div className="text-xs text-slate-700">
                      <span className="text-[10px] text-slate-400">現行版</span>
                      <p className="mt-0.5 truncate font-medium">
                        {version?.label || "未登録"}
                      </p>
                    </div>
                    <div className="text-xs text-slate-700">
                      <span className="text-[10px] text-slate-400">
                        次のゲート
                      </span>
                      <p className="mt-0.5">
                        {regulation?.nextGate || "—"}
                        {regulation?.nextGateTiming && (
                          <span className="ml-1 text-slate-400">
                            {regulation.nextGateTiming}
                          </span>
                        )}
                      </p>
                    </div>
                    {bundle.canEdit ? (
                      <button
                        type="button"
                        onClick={() => setEditing(type)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                        aria-label={`${type.label}を編集`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    ) : (
                      <span />
                    )}
                  </article>
                );
              })}
          </div>
        </div>
      ))}
      {editing && (
        <RegulationEditor
          institutionId={institutionId}
          type={editing}
          cell={cells.get(editing.regulationTypeId)}
          regulation={
            cells.get(editing.regulationTypeId)?.regulationId
              ? regulations.get(
                  cells.get(editing.regulationTypeId)!.regulationId!,
                )
              : undefined
          }
          bundle={bundle}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </section>
  );
}

function RegulationEditor({
  institutionId,
  type,
  cell,
  regulation,
  bundle,
  onClose,
  onSaved,
}: {
  institutionId: string;
  type: RegulationType;
  cell?: RegulationCell;
  regulation?: InstitutionRegulation;
  bundle: RegulationBundle;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [state, setState] = useState<RegulationState>(
    cell?.state || "unconfirmed",
  );
  const [title, setTitle] = useState(regulation?.title || type.label);
  const [stage, setStage] = useState(regulation?.stage || 0);
  const [note, setNote] = useState(regulation?.currentStateNote || "");
  const [nextGate, setNextGate] = useState(regulation?.nextGate || "");
  const [timing, setTiming] = useState(regulation?.nextGateTiming || "");
  const [versionLabel, setVersionLabel] = useState("");
  const [versionUrl, setVersionUrl] = useState("");
  const [versionState, setVersionState] = useState("draft");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const versions = regulation
    ? bundle.versions.filter(
        (item) => item.regulationId === regulation.regulationId,
      )
    : [];
  async function save() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/institution-regulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_cell",
          institutionId,
          regulationTypeId: type.regulationTypeId,
          regulationId: regulation?.regulationId,
          state,
          title,
          stage,
          lifecycleState:
            state === "effective"
              ? "effective"
              : state === "approved"
                ? "approved"
                : state === "review"
                  ? "review"
                  : "drafting",
          currentStateNote: note,
          nextGate,
          nextGateTiming: timing,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      if (versionLabel) {
        const versionResponse = await fetch("/api/institution-regulations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "add_version",
            regulationId: body.regulationId,
            label: versionLabel,
            versionState,
            externalUrl: versionUrl,
            isCurrent: true,
          }),
        });
        const versionBody = await versionResponse.json();
        if (!versionResponse.ok) throw new Error(versionBody.error);
      }
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存できなかった");
    } finally {
      setSaving(false);
    }
  }
  const inputClass =
    "min-h-10 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/35"
      role="dialog"
      aria-modal="true"
      aria-label={`${type.label}を編集`}
    >
      <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold text-indigo-700">
              規程台帳を編集
            </p>
            <h3 className="mt-1 text-lg font-bold">{type.label}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-2 hover:bg-slate-100"
            aria-label="閉じる"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5 grid gap-4">
          <Field label="状態">
            <select
              value={state}
              onChange={(e) => setState(e.target.value as RegulationState)}
              className={inputClass}
            >
              <option value="unconfirmed">未確認</option>
              <option value="not_established">未整備</option>
              <option value="drafting">作成中</option>
              <option value="review">審議中</option>
              <option value="approved">決裁済</option>
              <option value="effective">施行中（◯）</option>
              <option value="not_applicable">対象外</option>
            </select>
          </Field>
          <Field label="規程名">
            <input
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label={`進行段階 S${stage}`}>
            <input
              type="range"
              min="0"
              max="4"
              value={stage}
              onChange={(e) => setStage(Number(e.target.value))}
            />
          </Field>
          <Field label="現在地">
            <textarea
              className={`${inputClass} min-h-20`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="次のゲート">
              <input
                className={inputClass}
                value={nextGate}
                onChange={(e) => setNextGate(e.target.value)}
              />
            </Field>
            <Field label="時期">
              <input
                className={inputClass}
                value={timing}
                onChange={(e) => setTiming(e.target.value)}
              />
            </Field>
          </div>
          <div className="border-t border-slate-200 pt-4">
            <h4 className="flex items-center gap-2 text-sm font-bold">
              <FileClock className="h-4 w-4" />
              新しい版を追加（任意）
            </h4>
            <div className="mt-3 grid gap-3">
              <Field label="版名">
                <input
                  className={inputClass}
                  value={versionLabel}
                  onChange={(e) => setVersionLabel(e.target.value)}
                  placeholder="例：08/17修正版"
                />
              </Field>
              <Field label="外部正本リンク">
                <input
                  className={inputClass}
                  type="url"
                  value={versionUrl}
                  onChange={(e) => setVersionUrl(e.target.value)}
                  placeholder="https://...（なければ空欄）"
                />
              </Field>
              <Field label="版の状態">
                <select
                  className={inputClass}
                  value={versionState}
                  onChange={(e) => setVersionState(e.target.value)}
                >
                  {Object.entries(VERSION_STATE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
          {versions.length > 0 && (
            <div className="border-t border-slate-200 pt-4">
              <h4 className="text-sm font-bold">版履歴</h4>
              <ul className="mt-2 divide-y divide-slate-100">
                {versions.map((version) => (
                  <li
                    key={version.versionId}
                    className="flex items-center gap-2 py-2 text-xs"
                  >
                    <span className="font-semibold">{version.label}</span>
                    <span className="text-slate-400">
                      {VERSION_STATE_LABEL[version.versionState]}
                    </span>
                    {version.externalUrl && (
                      <a
                        href={version.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-auto text-indigo-700"
                      >
                        開く
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="min-h-11 bg-slate-950 px-4 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

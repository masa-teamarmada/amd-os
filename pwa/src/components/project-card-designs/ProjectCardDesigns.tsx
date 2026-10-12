"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  loadCardDesigns,
  peekCardDesigns,
  mutateCardDesigns,
} from "@/lib/project-card-designs-client";
import {
  cardLatest,
  type CardBundle,
  type CardDesign,
  type CardVersion,
} from "@/lib/project-card-designs";
import styles from "./cards.module.css";
// Intent: a founder finds the printable version before a meeting; adjacent front/back evidence beats decorative metrics.
// Existing OS ink/surface/border/primary tokens, Noto Sans JP, border-only depth and 4px spacing keep this a calm working ledger.
const roleLabels = {
  preview: "表裏の確認PDF",
  front_print: "表の入稿PDF",
  back_print: "裏の入稿PDF",
  editable: "編集元",
  source_zip: "制作元ZIP",
  spec: "制作仕様",
  order_evidence: "発注の控え",
};
const statusLabels = {
  draft: "案",
  review: "確認待ち",
  approved: "承認済み",
  superseded: "旧版",
};
const inputRoles = [
  "preview",
  "front_print",
  "back_print",
  "editable",
  "source_zip",
] as const;
export function ProjectCardDesigns({
  projectId,
  admin = false,
}: {
  projectId?: string;
  admin?: boolean;
}) {
  const [bundle, setBundle] = useState<CardBundle | null>(
      () => peekCardDesigns(projectId, admin) || null,
    ),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(""),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState(""),
    [versionId, setVersionId] = useState("");
  const [formOpen, setFormOpen] = useState(false),
    [editing, setEditing] = useState<CardDesign | null>(null),
    [requestKey, setRequestKey] = useState(""),
    [busy, setBusy] = useState(false),
    [verified, setVerified] = useState(false);
  const load = useCallback(
    async (force = false) => {
      setLoading(true);
      try {
        const b = await loadCardDesigns(projectId, admin, force);
        setError("");
        setBundle(b);
        setSelected((old) =>
          b.designs.some((d: CardDesign) => d.design_id === old)
            ? old
            : b.designs[0]?.design_id || "",
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "読み込みに失敗しました");
      } finally {
        setLoading(false);
      }
    },
    [admin, projectId],
  );
  useEffect(() => {
    setSelected("");
    setVersionId("");
    setError("");
    void load();
  }, [load]);
  const visible = (bundle?.designs || []).filter(
    (d) =>
      (!filter || d.projects.some((p) => p.project_id === filter)) &&
      `${d.holder_label} ${d.brand_label} ${d.projects.map((p) => p.label).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const d = visible.find((x) => x.design_id === selected) || visible[0];
  const latest = d && cardLatest(d);
  const v = d && (d.versions.find((x) => x.version_id === versionId) || latest);
  const canCreate = bundle?.projects.some(
    (p) => p.canEdit && (!projectId || p.project_id === projectId),
  );
  function beginEdit(design: CardDesign | null) {
    setEditing(design);
    setRequestKey(crypto.randomUUID());
    setFormOpen(true);
    setError("");
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    const owner = String(data.get("owner"));
    const payload = {
      owner_project_id: owner,
      holder_label: data.get("holder"),
      holder_key:
        editing?.holder_key || String(data.get("holder")).normalize("NFKC"),
      variant_key: editing?.variant_key || data.get("variant"),
      brand_label: data.get("brand"),
      revision_label: data.get("revision"),
      expected_version: editing?.version || 0,
      request_key: requestKey,
      status: "review",
      note: data.get("note"),
      related_project_ids: data.getAll("related"),
      assets: inputRoles
        .filter((role) => data.get(role))
        .map((role) => ({
          role,
          project_id: owner,
          drive_file_id: data.get(role),
        })),
      print_spec: {
        paper: data.get("paper"),
        size: "91×55mm",
        bleed: "3mm",
        sides: "両面カラー",
      },
    };
    try {
      const { r, b } = await mutateCardDesigns("", payload);
      if (!r.ok) {
        if (r.status === 409) {
          setFormOpen(false);
          await load(true);
        }
        throw Error(b.error);
      }
      setFormOpen(false);
      setVersionId("");
      setSelected(b.design_id);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  }
  async function approve(design: CardDesign, version: CardVersion) {
    setBusy(true);
    setError("");
    try {
      const { r, b } = await mutateCardDesigns(`/${design.design_id}/approve`, {
        version_id: version.version_id,
        expected_version: design.version,
        print_verified: verified,
      });
      if (!r.ok) throw Error(b.error);
      setVerified(false);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "承認に失敗しました");
      await load(true);
    } finally {
      setBusy(false);
    }
  }
  async function prepareFolder(pid: string) {
    setBusy(true);
    setError("");
    try {
      const { r, b } = await mutateCardDesigns("/folder", { project_id: pid });
      if (!r.ok) throw Error(b.error);
      window.open(b.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存先を開けませんでした");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className={styles.root}
      aria-label={admin ? "全PJの名刺案" : "名刺案"}
    >
      <header className={styles.header}>
        <div>
          <h1>{admin ? "全PJの名刺案" : "名刺案"}</h1>
          <p>最新版の案と、承認済みの入稿版をここから開く。</p>
        </div>
        {canCreate && (
          <button className={styles.primary} onClick={() => beginEdit(null)}>
            名刺案を登録
          </button>
        )}
      </header>
      {error && (
        <div className={styles.error} role="alert">
          {error}
          <button
            onClick={() => {
              setError("");
              void load(true);
            }}
          >
            読み直す
          </button>
        </div>
      )}
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <span className="sr-only">氏名・ブランド・PJで検索</span>
          <input
            placeholder="氏名・ブランド・PJで検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        {admin && (
          <label>
            <span className="sr-only">PJで絞り込む</span>
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setVersionId("");
              }}
            >
              <option value="">すべてのPJ</option>
              {bundle?.projects.map((p) => (
                <option key={p.project_id} value={p.project_id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <span className={styles.count}>
          {loading ? "読み込み中…" : `${visible.length}種類`}
        </span>
      </div>
      {loading && !bundle ? (
        <p role="status">名刺案を読み込み中…</p>
      ) : !visible.length ? (
        <div className={styles.empty}>
          <h2>
            {bundle?.designs.length
              ? "条件に合う名刺案がありません"
              : "名刺案は未登録"}
          </h2>
          <p>
            各PJの共有Drive直下「0_名刺」に資料を保存して、最新版の案として登録する。
          </p>
          {canCreate && (
            <button onClick={() => beginEdit(null)}>名刺案を登録</button>
          )}
        </div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>PJ</th>
                  <th>名刺・氏名</th>
                  <th>最新版</th>
                  <th>承認・発注</th>
                  <th>
                    <span className="sr-only">開く</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((card) => {
                  const version = cardLatest(card);
                  return (
                    <tr
                      key={card.design_id}
                      className={
                        card.design_id === d?.design_id ? styles.selected : ""
                      }
                    >
                      <td>
                        <div className={styles.pjLinks}>
                          {card.projects.map((p) => (
                            <Link
                              key={p.project_id}
                              href={`/project/${p.project_id}/cockpit?tab=card-designs`}
                            >
                              {p.label}
                            </Link>
                          ))}
                        </div>
                      </td>
                      <td>
                        <strong>{card.brand_label}</strong>
                        <span className={styles.secondary}>
                          {card.holder_label}
                        </span>
                      </td>
                      <td>
                        {version?.revision_label}
                        <span className={styles.secondary}>
                          {version?.created_at.slice(0, 10)}
                        </span>
                      </td>
                      <td>
                        <span>
                          {version ? statusLabels[version.status] : "未登録"}
                        </span>
                        <span className={styles.secondary}>
                          {version?.order_record.order_id
                            ? "発注済み"
                            : "未発注"}
                        </span>
                      </td>
                      <td>
                        <button
                          aria-expanded={card.design_id === d?.design_id}
                          onClick={() => {
                            setSelected(card.design_id);
                            setVersionId("");
                            setVerified(false);
                          }}
                        >
                          表裏を確認
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {d && v && (
            <div className={styles.detail}>
              <div className={styles.preview}>
                <div className={styles.previewHeader}>
                  <h2>{d.brand_label}</h2>
                  <span>
                    {v.revision_label} · {statusLabels[v.status]}
                  </span>
                </div>
                {v.assets.find((a) => a.role === "preview") ? (
                  <iframe
                    title={`${d.brand_label} ${v.revision_label} 表裏の確認PDF`}
                    src={`${v.assets.find((a) => a.role === "preview")!.openUrl}#view=FitH`}
                  />
                ) : (
                  <p>表裏の確認PDFは未登録</p>
                )}
              </div>
              <div className={styles.info}>
                <div className={styles.infoTop}>
                  <h2>{d.holder_label}</h2>
                  {d.canEdit && (
                    <button onClick={() => beginEdit(d)}>新しい版を登録</button>
                  )}
                </div>
                <label className={styles.history}>
                  表示する版
                  <select
                    value={v.version_id}
                    onChange={(e) => {
                      setVersionId(e.target.value);
                      setVerified(false);
                    }}
                  >
                    {d.versions.map((x) => (
                      <option key={x.version_id} value={x.version_id}>
                        {x.revision_label} — {statusLabels[x.status]}
                        {x.version_id === d.latest_approved_version_id
                          ? "・現行承認版"
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
                {d.latest_approved_version_id &&
                  d.latest_approved_version_id !== v.version_id && (
                    <button
                      onClick={() =>
                        setVersionId(d.latest_approved_version_id!)
                      }
                    >
                      承認済みの入稿版を見る
                    </button>
                  )}
                <div className={styles.files}>
                  {v.assets.map((a) => (
                    <a
                      key={a.asset_id}
                      href={a.openUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span>{roleLabels[a.role]}</span>
                      <span aria-hidden="true">↗</span>
                    </a>
                  ))}
                </div>
                <dl className={styles.facts}>
                  {Boolean(v.print_spec.paper) && (
                    <>
                      <dt>用紙</dt>
                      <dd>{String(v.print_spec.paper)}</dd>
                    </>
                  )}
                  {Boolean(v.order_record.order_id) && (
                    <>
                      <dt>注文番号</dt>
                      <dd>{String(v.order_record.order_id)}</dd>
                      <dt>部数・金額</dt>
                      <dd>
                        {String(v.order_record.quantity || "")}枚 ·{" "}
                        {Number(v.order_record.total_jpy || 0).toLocaleString()}
                        円（税込送料込）
                      </dd>
                      <dt>出荷予定</dt>
                      <dd>
                        {String(
                          v.order_record.scheduled_shipment_date || "未確認",
                        )}
                      </dd>
                      <dt>到着実績</dt>
                      <dd>{String(v.order_record.arrived_on || "未確認")}</dd>
                    </>
                  )}
                </dl>
                {v.note && <p className={styles.note}>{v.note}</p>}
                {d.canEdit && v.status !== "approved" && (
                  <div className={styles.approval}>
                    <label>
                      <input
                        type="checkbox"
                        checked={verified}
                        onChange={(e) => setVerified(e.target.checked)}
                      />
                      表裏・文字・塗り足しを確認した
                    </label>
                    <button
                      className={styles.primary}
                      disabled={!verified || busy}
                      onClick={() => void approve(d, v)}
                    >
                      この版を承認する
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
      {formOpen && (
        <div className={styles.form}>
          <div className={styles.infoTop}>
            <h2>{editing ? "新しい版を登録" : "名刺案を登録"}</h2>
            <button onClick={() => setFormOpen(false)}>閉じる</button>
          </div>
          <p>
            共有Driveの「0_名刺」に保存した資料のURLを登録する。以前の版は保持します。
          </p>
          <form onSubmit={save} key={requestKey}>
            <div className={styles.fields}>
              <label>
                所有PJ
                <select
                  name="owner"
                  required
                  defaultValue={editing?.owner_project_id || projectId}
                  disabled={!!editing}
                >
                  {bundle?.projects
                    .filter((p) => p.canEdit)
                    .map((p) => (
                      <option key={p.project_id} value={p.project_id}>
                        {p.label}
                      </option>
                    ))}
                </select>
                {editing && (
                  <input
                    type="hidden"
                    name="owner"
                    value={editing.owner_project_id}
                  />
                )}
              </label>
              <label>
                氏名
                <input
                  name="holder"
                  required
                  maxLength={120}
                  defaultValue={editing?.holder_label}
                />
              </label>
              <label>
                ブランド構成
                <input
                  name="brand"
                  required
                  maxLength={120}
                  defaultValue={editing?.brand_label}
                  placeholder="株式会社チームアルマダ"
                />
              </label>
              <label>
                名刺の種類
                <input
                  name="variant"
                  required
                  maxLength={80}
                  defaultValue={editing?.variant_key || "単独"}
                  disabled={!!editing}
                />
                {editing && (
                  <input
                    type="hidden"
                    name="variant"
                    value={editing.variant_key}
                  />
                )}
              </label>
              <label>
                版の名前
                <input
                  name="revision"
                  required
                  maxLength={120}
                  placeholder="2026-10-12 第9稿"
                />
              </label>
              <label>
                用紙
                <input
                  name="paper"
                  placeholder="アラベール200kg"
                  defaultValue={
                    latest?.print_spec.paper
                      ? String(latest.print_spec.paper)
                      : ""
                  }
                />
              </label>
              {inputRoles.map((role) => (
                <label key={role}>
                  {roleLabels[role]}のDrive URL
                  <input
                    type="url"
                    name={role}
                    required={role === "preview"}
                    placeholder="https://drive.google.com/..."
                  />
                </label>
              ))}
            </div>
            <fieldset className={styles.related}>
              <legend>関連するPJ（併記版）</legend>
              {bundle?.projects
                .filter((p) => p.canEdit)
                .map((p) => (
                  <label key={p.project_id}>
                    <input
                      name="related"
                      type="checkbox"
                      value={p.project_id}
                      defaultChecked={editing?.projects.some(
                        (x) => x.project_id === p.project_id,
                      )}
                    />
                    {p.label}
                  </label>
                ))}
            </fieldset>
            <label>
              変更内容
              <textarea name="note" maxLength={2000} rows={2} />
            </label>
            <div className={styles.formActions}>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const form = document.querySelector(
                    `.${styles.form} form`,
                  ) as HTMLFormElement;
                  void prepareFolder(String(new FormData(form).get("owner")));
                }}
              >
                Driveの保存先を準備・開く
              </button>
              <button className={styles.primary} disabled={busy} type="submit">
                {busy ? "資料を確認・保存中…" : "案として保存"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

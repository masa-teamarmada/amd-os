"use client";

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Building2,
  Handshake,
  type LucideIcon,
  Network,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sprout,
} from "lucide-react";
import {
  fetchPocHub,
  insertPocCompany,
  insertPocMatch,
  POC_COMPANY_STATUS_LABEL,
  POC_COMPANY_STATUS_ORDER,
  POC_MATCH_STATUS_COLOR,
  POC_MATCH_STATUS_LABEL,
  POC_MATCH_STATUS_ORDER,
  POC_PRIORITY_COLOR,
  POC_PRIORITY_LABEL,
  POC_PRIORITY_ORDER,
  splitInputList,
  updatePocCompany,
  updatePocMatch,
} from "@/lib/poc-data";
import type {
  PocCompanyStatus,
  PocHubData,
  PocMatchListItem,
  PocMatchStatus,
  PocPriority,
} from "@/types/poc";

type CompanyForm = {
  company_name: string;
  company_size: string;
  industry_tags: string;
  region: string;
  poc_profile: string;
  poc_history_note: string;
  incentive_note: string;
  owner_member_id: string;
  status: PocCompanyStatus;
  next_action: string;
};

type MatchForm = {
  seed_id: string;
  company_id: string;
  project_id: string;
  match_title: string;
  fit_hypothesis: string;
  hearing_questions: string;
  poc_goal: string;
  reward_plan: string;
  contract_plan: string;
  funding_plan: string;
  revenue_share_note: string;
  owner_member_id: string;
  status: PocMatchStatus;
  priority: PocPriority;
  next_action: string;
};

const EMPTY_COMPANY_FORM: CompanyForm = {
  company_name: "",
  company_size: "",
  industry_tags: "",
  region: "",
  poc_profile: "",
  poc_history_note: "",
  incentive_note: "",
  owner_member_id: "",
  status: "candidate",
  next_action: "",
};

const EMPTY_MATCH_FORM: MatchForm = {
  seed_id: "",
  company_id: "",
  project_id: "",
  match_title: "",
  fit_hypothesis: "",
  hearing_questions: "",
  poc_goal: "",
  reward_plan: "",
  contract_plan: "",
  funding_plan: "",
  revenue_share_note: "",
  owner_member_id: "",
  status: "candidate",
  priority: "medium",
  next_action: "",
};

export default function PocHubPage() {
  const [data, setData] = useState<PocHubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [matchStatus, setMatchStatus] = useState<PocMatchStatus | "active" | "all">("active");
  const [companyStatus, setCompanyStatus] = useState<PocCompanyStatus | "active" | "all">("active");
  const [companyForm, setCompanyForm] = useState<CompanyForm>(EMPTY_COMPANY_FORM);
  const [matchForm, setMatchForm] = useState<MatchForm>(EMPTY_MATCH_FORM);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchPocHub()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [reloadKey]);

  const filteredMatches = useMemo(() => {
    const rows = data?.matches ?? [];
    const q = search.trim().toLowerCase();
    return rows.filter((match) => {
      if (matchStatus === "active" && (match.status === "archived" || match.status === "deal")) return false;
      if (matchStatus !== "active" && matchStatus !== "all" && match.status !== matchStatus) return false;
      if (!q) return true;
      const haystack = [
        match.match_title,
        match.fit_hypothesis,
        match.poc_goal,
        match.next_action,
        match.seed?.title,
        match.company?.company_name,
        match.project?.project_name,
        match.hearing_questions.join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [data?.matches, matchStatus, search]);

  const filteredCompanies = useMemo(() => {
    const rows = data?.companies ?? [];
    const q = search.trim().toLowerCase();
    return rows.filter((company) => {
      if (companyStatus === "active" && company.status === "archived") return false;
      if (companyStatus !== "active" && companyStatus !== "all" && company.status !== companyStatus) return false;
      if (!q) return true;
      const haystack = [
        company.company_name,
        company.region,
        company.poc_profile,
        company.next_action,
        company.industry_tags.join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [companyStatus, data?.companies, search]);

  const matrix = useMemo(() => buildMatrix(data?.matches ?? [], data), [data]);
  const activeMatchCount = (data?.matches ?? []).filter((m) => m.status !== "archived" && m.status !== "deal").length;
  const hearingReadyCount = (data?.matches ?? []).filter((m) =>
    ["hearing_design", "introduced", "hearing_done"].includes(m.status),
  ).length;
  const pocPipelineCount = (data?.matches ?? []).filter((m) =>
    ["poc_design", "poc_running", "deal"].includes(m.status),
  ).length;

  const reload = () => setReloadKey((key) => key + 1);

  const saveCompany = async (event: FormEvent) => {
    event.preventDefault();
    if (!companyForm.company_name.trim()) return;
    setSaving(true);
    setStatusMessage(null);
    const result = await insertPocCompany({
      company_name: companyForm.company_name.trim(),
      company_size: nullable(companyForm.company_size),
      industry_tags: splitInputList(companyForm.industry_tags),
      region: nullable(companyForm.region),
      poc_profile: nullable(companyForm.poc_profile),
      poc_history_note: nullable(companyForm.poc_history_note),
      incentive_note: nullable(companyForm.incentive_note),
      owner_member_id: nullable(companyForm.owner_member_id),
      status: companyForm.status,
      next_action: nullable(companyForm.next_action),
      source_kind: "meeting",
      source_ref: "2026-07-09 PoCサービスMTG",
    });
    setSaving(false);
    if (!result.ok) {
      setStatusMessage(result.error ?? "企業候補の保存に失敗");
      return;
    }
    setCompanyForm(EMPTY_COMPANY_FORM);
    setStatusMessage("企業候補を保存したよ");
    reload();
  };

  const saveMatch = async (event: FormEvent) => {
    event.preventDefault();
    if (!matchForm.match_title.trim()) return;
    setSaving(true);
    setStatusMessage(null);
    const result = await insertPocMatch({
      seed_id: nullable(matchForm.seed_id),
      company_id: nullable(matchForm.company_id),
      project_id: nullable(matchForm.project_id),
      match_title: matchForm.match_title.trim(),
      fit_hypothesis: nullable(matchForm.fit_hypothesis),
      hearing_questions: splitInputList(matchForm.hearing_questions),
      poc_goal: nullable(matchForm.poc_goal),
      reward_plan: nullable(matchForm.reward_plan),
      contract_plan: nullable(matchForm.contract_plan),
      funding_plan: nullable(matchForm.funding_plan),
      revenue_share_note: nullable(matchForm.revenue_share_note),
      owner_member_id: nullable(matchForm.owner_member_id),
      status: matchForm.status,
      priority: matchForm.priority,
      next_action: nullable(matchForm.next_action),
      source_note: "2026-07-09 PoCサービスMTG",
    });
    setSaving(false);
    if (!result.ok) {
      setStatusMessage(result.error ?? "マッチ案件の保存に失敗");
      return;
    }
    setMatchForm(EMPTY_MATCH_FORM);
    setStatusMessage("マッチ案件を保存したよ");
    reload();
  };

  const updateMatchStatus = async (matchId: string, status: PocMatchStatus) => {
    setStatusMessage(null);
    const result = await updatePocMatch(matchId, { status });
    if (!result.ok) {
      setStatusMessage(result.error ?? "状態更新に失敗");
      return;
    }
    reload();
  };

  const updateCompanyStatus = async (companyId: string, status: PocCompanyStatus) => {
    setStatusMessage(null);
    const result = await updatePocCompany(companyId, { status });
    if (!result.ok) {
      setStatusMessage(result.error ?? "企業状態の更新に失敗");
      return;
    }
    reload();
  };

  return (
    <div className="mx-auto w-full max-w-[1800px] px-4 py-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Seeds x Companies x PoC
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal">PoC案件化</h1>
          <p className="mt-1 max-w-4xl text-sm leading-relaxed text-muted-foreground">
            研究シーズとPoC候補企業をつなぎ、ヒアリング論点、謝礼、契約、助成金、収益分配まで追う。
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href="/seeds"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-muted"
          >
            <Sprout className="h-4 w-4" />
            Seeds
          </Link>
          <button
            type="button"
            onClick={reload}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4" />
            更新
          </button>
        </div>
      </header>

      <section className="mb-5 grid gap-3 md:grid-cols-4">
        <Metric label="企業候補" value={data?.companies.length ?? 0} tone="company" />
        <Metric label="マッチ案件" value={data?.matches.length ?? 0} tone="match" />
        <Metric label="進行中" value={activeMatchCount} tone="active" />
        <Metric label="PoC設計以降" value={pocPipelineCount} tone="poc" sub={`${hearingReadyCount}件はヒアリング段階`} />
      </section>

      <section className="mb-5 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="シーズ / 企業 / 論点 / 次アクションで検索"
              className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors focus:border-cyan-500"
            />
          </div>
          <select
            value={matchStatus}
            onChange={(event) => setMatchStatus(event.target.value as PocMatchStatus | "active" | "all")}
            className="h-9 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="active">進行中マッチ</option>
            <option value="all">全マッチ</option>
            {POC_MATCH_STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {POC_MATCH_STATUS_LABEL[status]}
              </option>
            ))}
          </select>
          <select
            value={companyStatus}
            onChange={(event) => setCompanyStatus(event.target.value as PocCompanyStatus | "active" | "all")}
            className="h-9 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="active">有効企業</option>
            <option value="all">全企業</option>
            {POC_COMPANY_STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {POC_COMPANY_STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </div>
        {statusMessage && <p className="mt-2 text-xs text-muted-foreground">{statusMessage}</p>}
        {error && <p className="mt-2 text-xs text-red-600 dark:text-red-300">{error}</p>}
      </section>

      <section className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.75fr)]">
        <form onSubmit={saveMatch} className="rounded-lg border border-border bg-card p-4">
          <FormTitle icon={Network} title="マッチ案件を追加" />
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="案件名">
              <input
                value={matchForm.match_title}
                onChange={(event) => setMatchForm({ ...matchForm, match_title: event.target.value })}
                className="form-input"
                placeholder="例: SX排水処理 x 食品工場ヒアリング"
              />
            </Field>
            <Field label="担当">
              <select
                value={matchForm.owner_member_id}
                onChange={(event) => setMatchForm({ ...matchForm, owner_member_id: event.target.value })}
                className="form-input"
              >
                <option value="">未設定</option>
                {(data?.members ?? []).map((member) => (
                  <option key={member.member_id} value={member.member_id}>
                    {member.code_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="シーズ">
              <select
                value={matchForm.seed_id}
                onChange={(event) => setMatchForm({ ...matchForm, seed_id: event.target.value })}
                className="form-input"
              >
                <option value="">未設定</option>
                {(data?.seeds ?? []).map((seed) => (
                  <option key={seed.id} value={seed.id}>
                    {seed.title} / {seed.org_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="企業候補">
              <select
                value={matchForm.company_id}
                onChange={(event) => setMatchForm({ ...matchForm, company_id: event.target.value })}
                className="form-input"
              >
                <option value="">未設定</option>
                {(data?.companies ?? []).map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.company_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="関連PJ">
              <select
                value={matchForm.project_id}
                onChange={(event) => setMatchForm({ ...matchForm, project_id: event.target.value })}
                className="form-input"
              >
                <option value="">未設定</option>
                {(data?.projects ?? []).map((project) => (
                  <option key={project.project_id} value={project.project_id}>
                    {project.project_id} / {project.project_name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="状態">
                <select
                  value={matchForm.status}
                  onChange={(event) => setMatchForm({ ...matchForm, status: event.target.value as PocMatchStatus })}
                  className="form-input"
                >
                  {POC_MATCH_STATUS_ORDER.map((status) => (
                    <option key={status} value={status}>
                      {POC_MATCH_STATUS_LABEL[status]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="優先">
                <select
                  value={matchForm.priority}
                  onChange={(event) => setMatchForm({ ...matchForm, priority: event.target.value as PocPriority })}
                  className="form-input"
                >
                  {POC_PRIORITY_ORDER.map((priority) => (
                    <option key={priority} value={priority}>
                      {POC_PRIORITY_LABEL[priority]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="相性仮説" wide>
              <textarea
                value={matchForm.fit_hypothesis}
                onChange={(event) => setMatchForm({ ...matchForm, fit_hypothesis: event.target.value })}
                className="form-textarea min-h-[68px]"
              />
            </Field>
            <Field label="ヒアリング論点" wide>
              <textarea
                value={matchForm.hearing_questions}
                onChange={(event) => setMatchForm({ ...matchForm, hearing_questions: event.target.value })}
                className="form-textarea min-h-[76px]"
                placeholder="1行ずつ入力"
              />
            </Field>
            <Field label="謝礼・PoC費用">
              <textarea
                value={matchForm.reward_plan}
                onChange={(event) => setMatchForm({ ...matchForm, reward_plan: event.target.value })}
                className="form-textarea"
              />
            </Field>
            <Field label="契約・助成金">
              <textarea
                value={matchForm.contract_plan}
                onChange={(event) => setMatchForm({ ...matchForm, contract_plan: event.target.value })}
                className="form-textarea"
              />
            </Field>
            <Field label="資金・補助金">
              <textarea
                value={matchForm.funding_plan}
                onChange={(event) => setMatchForm({ ...matchForm, funding_plan: event.target.value })}
                className="form-textarea"
              />
            </Field>
            <Field label="PoCで確認すること">
              <textarea
                value={matchForm.poc_goal}
                onChange={(event) => setMatchForm({ ...matchForm, poc_goal: event.target.value })}
                className="form-textarea"
              />
            </Field>
            <Field label="収益分配メモ">
              <textarea
                value={matchForm.revenue_share_note}
                onChange={(event) => setMatchForm({ ...matchForm, revenue_share_note: event.target.value })}
                className="form-textarea"
              />
            </Field>
            <Field label="次アクション" wide>
              <input
                value={matchForm.next_action}
                onChange={(event) => setMatchForm({ ...matchForm, next_action: event.target.value })}
                className="form-input"
              />
            </Field>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={saving || !matchForm.match_title.trim()}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-emerald-500/35 bg-emerald-500/12 px-3 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/18 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-200"
            >
              <Save className="h-4 w-4" />
              保存
            </button>
          </div>
        </form>

        <form onSubmit={saveCompany} className="rounded-lg border border-border bg-card p-4">
          <FormTitle icon={Building2} title="企業候補を追加" />
          <div className="grid gap-3">
            <Field label="企業名">
              <input
                value={companyForm.company_name}
                onChange={(event) => setCompanyForm({ ...companyForm, company_name: event.target.value })}
                className="form-input"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="規模感">
                <input
                  value={companyForm.company_size}
                  onChange={(event) => setCompanyForm({ ...companyForm, company_size: event.target.value })}
                  className="form-input"
                  placeholder="中小 / 大手 / 部門"
                />
              </Field>
              <Field label="地域">
                <input
                  value={companyForm.region}
                  onChange={(event) => setCompanyForm({ ...companyForm, region: event.target.value })}
                  className="form-input"
                />
              </Field>
            </div>
            <Field label="業界タグ">
              <input
                value={companyForm.industry_tags}
                onChange={(event) => setCompanyForm({ ...companyForm, industry_tags: event.target.value })}
                className="form-input"
                placeholder="食品, 半導体, 介護"
              />
            </Field>
            <Field label="PoC相性メモ">
              <textarea
                value={companyForm.poc_profile}
                onChange={(event) => setCompanyForm({ ...companyForm, poc_profile: event.target.value })}
                className="form-textarea"
              />
            </Field>
            <Field label="過去PoC・紹介経路">
              <textarea
                value={companyForm.poc_history_note}
                onChange={(event) => setCompanyForm({ ...companyForm, poc_history_note: event.target.value })}
                className="form-textarea"
              />
            </Field>
            <Field label="謝礼・インセンティブ">
              <textarea
                value={companyForm.incentive_note}
                onChange={(event) => setCompanyForm({ ...companyForm, incentive_note: event.target.value })}
                className="form-textarea"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="担当">
                <select
                  value={companyForm.owner_member_id}
                  onChange={(event) => setCompanyForm({ ...companyForm, owner_member_id: event.target.value })}
                  className="form-input"
                >
                  <option value="">未設定</option>
                  {(data?.members ?? []).map((member) => (
                    <option key={member.member_id} value={member.member_id}>
                      {member.code_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="状態">
                <select
                  value={companyForm.status}
                  onChange={(event) => setCompanyForm({ ...companyForm, status: event.target.value as PocCompanyStatus })}
                  className="form-input"
                >
                  {POC_COMPANY_STATUS_ORDER.map((status) => (
                    <option key={status} value={status}>
                      {POC_COMPANY_STATUS_LABEL[status]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="次アクション">
              <input
                value={companyForm.next_action}
                onChange={(event) => setCompanyForm({ ...companyForm, next_action: event.target.value })}
                className="form-input"
              />
            </Field>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={saving || !companyForm.company_name.trim()}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-cyan-500/35 bg-cyan-500/12 px-3 text-xs font-semibold text-cyan-700 transition-colors hover:bg-cyan-500/18 disabled:cursor-not-allowed disabled:opacity-50 dark:text-cyan-200"
            >
              <Plus className="h-4 w-4" />
              追加
            </button>
          </div>
        </form>
      </section>

      <section className="mb-5 rounded-lg border border-border bg-card p-4">
        <FormTitle icon={Handshake} title="シーズ × 企業マトリックス" />
        {loading ? (
          <EmptyState text="読み込み中" />
        ) : matrix.seeds.length === 0 || matrix.companies.length === 0 ? (
          <EmptyState text="シーズか企業候補を追加すると、ここにマトリックスが出る" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[860px] table-fixed text-xs">
              <thead>
                <tr>
                  <th className="w-56 px-2 py-2 text-left text-muted-foreground">企業 / シーズ</th>
                  {matrix.seeds.map((seed) => (
                    <th key={seed.id} className="w-44 px-2 py-2 text-left align-bottom">
                      <div className="line-clamp-2 font-medium">{seed.title}</div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">{seed.org_name}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.companies.map((company) => (
                  <tr key={company.id} className="border-t border-border/55">
                    <th className="px-2 py-2 text-left align-top">
                      <div className="font-medium">{company.company_name}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {company.industry_tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="rounded border border-border bg-muted/35 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </th>
                    {matrix.seeds.map((seed) => {
                      const match = matrix.lookup.get(`${seed.id}:${company.id}`);
                      return (
                        <td key={seed.id} className="px-2 py-2 align-top">
                          {match ? (
                            <div className="rounded-md border border-border bg-background p-2">
                              <StatusChip label={POC_MATCH_STATUS_LABEL[match.status]} className={POC_MATCH_STATUS_COLOR[match.status]} />
                              <div className="mt-1 line-clamp-2 font-medium">{match.match_title}</div>
                              {match.next_action && <div className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">{match.next_action}</div>}
                            </div>
                          ) : (
                            <div className="h-12 rounded-md border border-dashed border-border/70 bg-muted/15" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mb-5 rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <FormTitle icon={Network} title="マッチ案件" compact />
          <span className="text-xs text-muted-foreground">{filteredMatches.length}件</span>
        </div>
        {loading ? (
          <EmptyState text="読み込み中" />
        ) : filteredMatches.length === 0 ? (
          <EmptyState text="マッチ案件なし" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1160px] w-full text-xs">
              <thead className="bg-muted/35 text-left text-[11px] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">案件</th>
                  <th className="px-3 py-2">シーズ</th>
                  <th className="px-3 py-2">企業</th>
                  <th className="px-3 py-2">状態</th>
                  <th className="px-3 py-2">論点</th>
                  <th className="px-3 py-2">条件</th>
                  <th className="px-3 py-2">担当</th>
                  <th className="px-3 py-2">次アクション</th>
                </tr>
              </thead>
              <tbody>
                {filteredMatches.map((match) => (
                  <tr key={match.id} className="border-t border-border/50 align-top hover:bg-muted/25">
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium">{match.match_title}</span>
                        <StatusChip label={POC_PRIORITY_LABEL[match.priority]} className={POC_PRIORITY_COLOR[match.priority]} />
                      </div>
                      {match.fit_hypothesis && <div className="mt-1 line-clamp-2 text-muted-foreground">{match.fit_hypothesis}</div>}
                    </td>
                    <td className="px-3 py-3">
                      {match.seed ? (
                        <Link href={`/seeds/${match.seed.id}`} className="font-medium hover:text-cyan-600 hover:underline">
                          {match.seed.title}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground/50">未設定</span>
                      )}
                      {match.project && <div className="mt-1 text-[10px] text-muted-foreground">{match.project.project_name}</div>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium">{match.company?.company_name ?? "未設定"}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(match.company?.industry_tags ?? []).slice(0, 3).map((tag) => (
                          <span key={tag} className="rounded border border-border bg-muted/35 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <select
                        value={match.status}
                        onChange={(event) => updateMatchStatus(match.id, event.target.value as PocMatchStatus)}
                        className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                      >
                        {POC_MATCH_STATUS_ORDER.map((status) => (
                          <option key={status} value={status}>
                            {POC_MATCH_STATUS_LABEL[status]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      {match.hearing_questions.length > 0 ? (
                        <ul className="space-y-1">
                          {match.hearing_questions.slice(0, 3).map((question) => (
                            <li key={question} className="line-clamp-2 text-muted-foreground">
                              {question}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-muted-foreground/50">未設定</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <StackedNote label="謝礼" text={match.reward_plan} />
                      <StackedNote label="契約" text={match.contract_plan} />
                      <StackedNote label="資金" text={match.funding_plan} />
                      <StackedNote label="収益" text={match.revenue_share_note} />
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{match.owner_code_name ?? "未設定"}</td>
                    <td className="px-3 py-3">
                      {match.next_action ? <span className="line-clamp-3">{match.next_action}</span> : <span className="text-muted-foreground/50">未設定</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <FormTitle icon={Building2} title="企業候補リスト" compact />
          <span className="text-xs text-muted-foreground">{filteredCompanies.length}件</span>
        </div>
        {loading ? (
          <EmptyState text="読み込み中" />
        ) : filteredCompanies.length === 0 ? (
          <EmptyState text="企業候補なし" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-xs">
              <thead className="bg-muted/35 text-left text-[11px] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">企業</th>
                  <th className="px-3 py-2">状態</th>
                  <th className="px-3 py-2">PoC相性</th>
                  <th className="px-3 py-2">謝礼・履歴</th>
                  <th className="px-3 py-2">案件</th>
                  <th className="px-3 py-2">担当</th>
                  <th className="px-3 py-2">次アクション</th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.map((company) => (
                  <tr key={company.id} className="border-t border-border/50 align-top hover:bg-muted/25">
                    <td className="px-3 py-3">
                      <div className="font-medium">{company.company_name}</div>
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {[company.company_size, company.region].filter(Boolean).join(" / ") || "規模・地域未設定"}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {company.industry_tags.map((tag) => (
                          <span key={tag} className="rounded border border-border bg-muted/35 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <select
                        value={company.status}
                        onChange={(event) => updateCompanyStatus(company.id, event.target.value as PocCompanyStatus)}
                        className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                      >
                        {POC_COMPANY_STATUS_ORDER.map((status) => (
                          <option key={status} value={status}>
                            {POC_COMPANY_STATUS_LABEL[status]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      {company.poc_profile ? <span className="line-clamp-3">{company.poc_profile}</span> : <span className="text-muted-foreground/50">未設定</span>}
                    </td>
                    <td className="px-3 py-3">
                      <StackedNote label="履歴" text={company.poc_history_note} />
                      <StackedNote label="謝礼" text={company.incentive_note} />
                    </td>
                    <td className="px-3 py-3 font-mono text-[11px] text-muted-foreground">
                      {company.active_match_count} / {company.match_count}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{company.owner_code_name ?? "未設定"}</td>
                    <td className="px-3 py-3">
                      {company.next_action ? <span className="line-clamp-3">{company.next_action}</span> : <span className="text-muted-foreground/50">未設定</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, tone, sub }: { label: string; value: number; tone: "company" | "match" | "active" | "poc"; sub?: string }) {
  const toneClass = {
    company: "border-cyan-400/35 bg-cyan-400/10",
    match: "border-violet-400/35 bg-violet-400/10",
    active: "border-amber-400/35 bg-amber-400/10",
    poc: "border-emerald-400/35 bg-emerald-400/10",
  }[tone];
  return (
    <div className={`rounded-lg border ${toneClass} p-4`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-3xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`block min-w-0 ${wide ? "md:col-span-2" : ""}`}>
      <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function FormTitle({ icon: Icon, title, compact = false }: { icon: LucideIcon; title: string; compact?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${compact ? "" : "mb-3"}`}>
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </span>
      <h2 className="text-sm font-semibold">{title}</h2>
    </div>
  );
}

function StatusChip({ label, className }: { label: string; className: string }) {
  return <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium ${className}`}>{label}</span>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="px-4 py-10 text-center text-sm text-muted-foreground">{text}</div>;
}

function StackedNote({ label, text }: { label: string; text: string | null }) {
  if (!text) return null;
  return (
    <div className="mb-1 last:mb-0">
      <span className="mr-1 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">{label}</span>
      <span className="line-clamp-2 text-muted-foreground">{text}</span>
    </div>
  );
}

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function buildMatrix(matches: PocMatchListItem[], data: PocHubData | null) {
  const lookup = new Map<string, PocMatchListItem>();
  const matchedSeedIds = new Set<string>();
  const matchedCompanyIds = new Set<string>();
  for (const match of matches) {
    if (!match.seed_id || !match.company_id) continue;
    const key = `${match.seed_id}:${match.company_id}`;
    if (!lookup.has(key)) lookup.set(key, match);
    matchedSeedIds.add(match.seed_id);
    matchedCompanyIds.add(match.company_id);
  }

  const allSeeds = data?.seeds ?? [];
  const allCompanies = data?.companies ?? [];
  const seeds = [
    ...allSeeds.filter((seed) => matchedSeedIds.has(seed.id)),
    ...allSeeds.filter((seed) => !matchedSeedIds.has(seed.id) && seed.status !== "declined"),
  ].slice(0, 7);
  const companies = [
    ...allCompanies.filter((company) => matchedCompanyIds.has(company.id)),
    ...allCompanies.filter((company) => !matchedCompanyIds.has(company.id) && company.status !== "archived"),
  ].slice(0, 7);

  return { seeds, companies, lookup };
}

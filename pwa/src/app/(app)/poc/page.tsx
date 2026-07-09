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
  splitInputList,
  updatePocCompany,
  updatePocMatch,
} from "@/lib/poc-data";
import { insertSeed, SEED_DOMAIN_LANE_LABEL, SEED_STATUS_LABEL } from "@/lib/seeds-data";
import type {
  PocCompanyListItem,
  PocCompanyStatus,
  PocHubData,
  PocMatchListItem,
  PocMatchStatus,
  PocPriority,
  PocSeedRef,
} from "@/types/poc";
import type { SeedDomainLane, SeedStatus } from "@/types/seeds";

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

type SeedForm = {
  title: string;
  org_name: string;
  org_region: string;
  researcher_name: string;
  domain_lane: SeedDomainLane | "";
  industry_target: string;
  keywords: string;
  summary: string;
  owner_member_id: string;
  status: SeedStatus;
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

const EMPTY_SEED_FORM: SeedForm = {
  title: "",
  org_name: "",
  org_region: "",
  researcher_name: "",
  domain_lane: "",
  industry_target: "",
  keywords: "",
  summary: "",
  owner_member_id: "",
  status: "candidate",
  next_action: "",
};

const SEED_DOMAIN_ORDER: SeedDomainLane[] = ["gx_energy", "gx_circular", "life", "materials", "robo", "ict", "other"];
const SEED_STATUS_ORDER: SeedStatus[] = ["candidate", "investigating", "contacted", "discussing", "spun_off", "declined"];
const MAX_PAIRING_CANDIDATES_PER_SEED = 5;

type PairingCandidate = {
  company: PocCompanyListItem;
  overlap: string[];
  score: number;
};

type PairingRow = {
  seed: PocSeedRef;
  matches: PocMatchListItem[];
  candidates: PairingCandidate[];
};

export default function PocHubPage() {
  const [data, setData] = useState<PocHubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedCompanyTags, setSelectedCompanyTags] = useState<string[]>([]);
  const [matchStatus, setMatchStatus] = useState<PocMatchStatus | "active" | "all">("active");
  const [companyStatus, setCompanyStatus] = useState<PocCompanyStatus | "active" | "all">("active");
  const [companyForm, setCompanyForm] = useState<CompanyForm>(EMPTY_COMPANY_FORM);
  const [seedForm, setSeedForm] = useState<SeedForm>(EMPTY_SEED_FORM);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      setError(null);
      try {
        const nextData = await fetchPocHub();
        if (!cancelled) setData(nextData);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
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

  const companyTagCounts = useMemo(() => buildCompanyTagCounts(filteredCompanies), [filteredCompanies]);
  const tagFilteredCompanies = useMemo(
    () => filteredCompanies.filter((company) => hasSelectedTags(company, selectedCompanyTags)),
    [filteredCompanies, selectedCompanyTags],
  );
  const pairingRows = useMemo(
    () => buildPairingRows(data, search, selectedCompanyTags, companyStatus, matchStatus),
    [companyStatus, data, matchStatus, search, selectedCompanyTags],
  );
  const activeSeedCount = (data?.seeds ?? []).filter((seed) => seed.status !== "declined").length;
  const activeDestinationCount = (data?.companies ?? []).filter((company) => company.status !== "archived").length;
  const activeMatchCount = (data?.matches ?? []).filter((match) => match.status !== "deal" && match.status !== "archived").length;
  const hearingReadyCount = (data?.matches ?? []).filter((m) =>
    ["hearing_design", "introduced", "hearing_done"].includes(m.status),
  ).length;
  const pocPipelineCount = (data?.matches ?? []).filter((m) =>
    ["poc_design", "poc_running", "deal"].includes(m.status),
  ).length;
  const pairingCandidateCount = pairingRows.reduce((sum, row) => sum + row.candidates.length, 0);

  const reload = () => setReloadKey((key) => key + 1);

  const toggleCompanyTag = (tag: string) => {
    setSelectedCompanyTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  };

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
      setStatusMessage(result.error ?? "PoC先の保存に失敗");
      return;
    }
    setCompanyForm(EMPTY_COMPANY_FORM);
    setStatusMessage("PoC先を保存したよ");
    reload();
  };

  const saveSeed = async (event: FormEvent) => {
    event.preventDefault();
    if (!seedForm.title.trim() || !seedForm.org_name.trim()) return;
    setSaving(true);
    setStatusMessage(null);
    const result = await insertSeed({
      title: seedForm.title.trim(),
      org_name: seedForm.org_name.trim(),
      org_region: nullable(seedForm.org_region),
      researcher_name: nullable(seedForm.researcher_name),
      domain_lane: nullable(seedForm.domain_lane) as SeedDomainLane | null,
      industry_target: splitInputList(seedForm.industry_target),
      keywords: splitInputList(seedForm.keywords),
      summary: nullable(seedForm.summary),
      status: seedForm.status,
      amd_owner_member_id: nullable(seedForm.owner_member_id),
      next_action: nullable(seedForm.next_action),
      source: "other",
      source_detail: "PoC案件化入力",
      discovery_status: "reviewed",
      is_public: false,
    });
    setSaving(false);
    if (!result.ok) {
      setStatusMessage(result.error ?? "シーズの保存に失敗");
      return;
    }
    setSeedForm(EMPTY_SEED_FORM);
    setStatusMessage("シーズを保存したよ");
    reload();
  };

  const createMatchFromPair = async (seed: PocSeedRef, company: PocCompanyListItem) => {
    const existing = (data?.matches ?? []).find((match) => match.seed_id === seed.id && match.company_id === company.id);
    if (existing) return;
    setSaving(true);
    setStatusMessage(null);
    const result = await insertPocMatch(buildGeneratedMatch(seed, company));
    setSaving(false);
    if (!result.ok) {
      setStatusMessage(result.error ?? "案件候補の生成に失敗");
      return;
    }
    setStatusMessage("シーズとPoC先から案件候補を作ったよ");
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
      setStatusMessage(result.error ?? "PoC先状態の更新に失敗");
      return;
    }
    reload();
  };

  return (
    <div className="mx-auto w-full max-w-[1800px] px-4 py-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            シーズ x PoC先
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal">PoC案件化</h1>
          <p className="mt-1 max-w-4xl text-sm leading-relaxed text-muted-foreground">
            シーズとPoC先を入力し、その掛け合わせからヒアリング論点、謝礼、契約、助成金、収益分配を作る。
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
        <Metric label="シーズ" value={activeSeedCount} tone="seed" />
        <Metric label="PoC先" value={activeDestinationCount} tone="company" />
        <Metric label="案件候補" value={activeMatchCount} tone="match" sub={`${pairingCandidateCount}件を候補表示`} />
        <Metric label="PoC設計以降" value={pocPipelineCount} tone="poc" sub={`${hearingReadyCount}件はヒアリング段階`} />
      </section>

      <section className="mb-5 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="シーズ / PoC先 / 論点 / 次アクションで検索"
              className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors focus:border-cyan-500"
            />
          </div>
          <select
            value={matchStatus}
            onChange={(event) => setMatchStatus(event.target.value as PocMatchStatus | "active" | "all")}
            className="h-9 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="active">進行中案件</option>
            <option value="all">全案件</option>
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
            <option value="active">有効PoC先</option>
            <option value="all">全PoC先</option>
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

      <section className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <form onSubmit={saveSeed} className="rounded-lg border border-border bg-card p-4">
          <FormTitle icon={Sprout} title="シーズを追加" />
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="シーズ名" wide>
              <input
                value={seedForm.title}
                onChange={(event) => setSeedForm({ ...seedForm, title: event.target.value })}
                className="form-input"
                placeholder="例: CO2と太陽光を資源とする排水処理"
              />
            </Field>
            <Field label="機関">
              <input
                value={seedForm.org_name}
                onChange={(event) => setSeedForm({ ...seedForm, org_name: event.target.value })}
                className="form-input"
                placeholder="大学・研究機関・研究室など"
              />
            </Field>
            <Field label="地域">
              <input
                value={seedForm.org_region}
                onChange={(event) => setSeedForm({ ...seedForm, org_region: event.target.value })}
                className="form-input"
              />
            </Field>
            <Field label="PI / 研究者">
              <input
                value={seedForm.researcher_name}
                onChange={(event) => setSeedForm({ ...seedForm, researcher_name: event.target.value })}
                className="form-input"
              />
            </Field>
            <Field label="領域">
              <select
                value={seedForm.domain_lane}
                onChange={(event) => setSeedForm({ ...seedForm, domain_lane: event.target.value as SeedDomainLane | "" })}
                className="form-input"
              >
                <option value="">未設定</option>
                {SEED_DOMAIN_ORDER.map((domain) => (
                  <option key={domain} value={domain}>
                    {SEED_DOMAIN_LANE_LABEL[domain]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="状態">
              <select
                value={seedForm.status}
                onChange={(event) => setSeedForm({ ...seedForm, status: event.target.value as SeedStatus })}
                className="form-input"
              >
                {SEED_STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>
                    {SEED_STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="用途・業界タグ">
              <input
                value={seedForm.industry_target}
                onChange={(event) => setSeedForm({ ...seedForm, industry_target: event.target.value })}
                className="form-input"
                placeholder="排水処理, 医療AI, センサ"
              />
            </Field>
            <Field label="キーワード">
              <input
                value={seedForm.keywords}
                onChange={(event) => setSeedForm({ ...seedForm, keywords: event.target.value })}
                className="form-input"
                placeholder="1行またはカンマ区切り"
              />
            </Field>
            <Field label="概要" wide>
              <textarea
                value={seedForm.summary}
                onChange={(event) => setSeedForm({ ...seedForm, summary: event.target.value })}
                className="form-textarea min-h-[74px]"
              />
            </Field>
            <Field label="担当">
              <select
                value={seedForm.owner_member_id}
                onChange={(event) => setSeedForm({ ...seedForm, owner_member_id: event.target.value })}
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
            <Field label="次アクション">
              <input
                value={seedForm.next_action}
                onChange={(event) => setSeedForm({ ...seedForm, next_action: event.target.value })}
                className="form-input"
              />
            </Field>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={saving || !seedForm.title.trim() || !seedForm.org_name.trim()}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-emerald-500/35 bg-emerald-500/12 px-3 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/18 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-200"
            >
              <Save className="h-4 w-4" />
              シーズ保存
            </button>
          </div>
        </form>

        <form onSubmit={saveCompany} className="rounded-lg border border-border bg-card p-4">
          <FormTitle icon={Building2} title="PoC先を追加" />
          <div className="grid gap-3">
            <Field label="PoC先名">
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
        <div className="mb-3 flex items-center justify-between gap-3">
          <FormTitle icon={Building2} title="PoC先候補リスト" compact />
          <span className="text-xs text-muted-foreground">{tagFilteredCompanies.length} / {filteredCompanies.length}件</span>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {companyTagCounts.slice(0, 22).map(({ tag, count }) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleCompanyTag(tag)}
              className={`rounded-full border px-2 py-1 text-[11px] font-medium transition-colors ${
                selectedCompanyTags.includes(tag)
                  ? "border-cyan-500/45 bg-cyan-500/12 text-cyan-700 dark:text-cyan-200"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              {tag}
              <span className="ml-1 font-mono text-[10px] opacity-70">{count}</span>
            </button>
          ))}
          {selectedCompanyTags.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedCompanyTags([])}
              className="rounded-full border border-border bg-muted/35 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted"
            >
              タグ解除
            </button>
          )}
        </div>
        {loading ? (
          <EmptyState text="読み込み中" />
        ) : tagFilteredCompanies.length === 0 ? (
          <EmptyState text="タグ条件に合うPoC先がない" />
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {tagFilteredCompanies.slice(0, 16).map((company) => (
              <CompanyCandidateCard
                key={company.id}
                company={company}
                selectedTags={selectedCompanyTags}
                onToggleTag={toggleCompanyTag}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mb-5 rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <FormTitle icon={Handshake} title="案件化キュー" compact />
          <span className="text-xs text-muted-foreground">{pairingRows.length}シーズ / 候補{pairingCandidateCount}件</span>
        </div>
        {loading ? (
          <EmptyState text="読み込み中" />
        ) : activeSeedCount === 0 || activeDestinationCount === 0 ? (
          <EmptyState text="シーズかPoC先を追加すると、案件化候補が出る" />
        ) : pairingRows.length === 0 ? (
          <EmptyState text="タグや検索条件に合う候補がない" />
        ) : (
          <div className="grid gap-3">
            {pairingRows.map((row) => (
              <PairingRowCard
                key={row.seed.id}
                row={row}
                saving={saving}
                onCreateMatch={createMatchFromPair}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mb-5 rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <FormTitle icon={Network} title="案件候補" compact />
          <span className="text-xs text-muted-foreground">{filteredMatches.length}件</span>
        </div>
        {loading ? (
          <EmptyState text="読み込み中" />
        ) : filteredMatches.length === 0 ? (
          <EmptyState text="案件候補なし。案件化キューから作れるよ" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1160px] w-full text-xs">
              <thead className="bg-muted/35 text-left text-[11px] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">案件</th>
                  <th className="px-3 py-2">シーズ</th>
                  <th className="px-3 py-2">PoC先</th>
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
          <FormTitle icon={Building2} title="PoC先リスト" compact />
          <span className="text-xs text-muted-foreground">{filteredCompanies.length}件</span>
        </div>
        {loading ? (
          <EmptyState text="読み込み中" />
        ) : filteredCompanies.length === 0 ? (
          <EmptyState text="PoC先なし" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-xs">
              <thead className="bg-muted/35 text-left text-[11px] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">PoC先</th>
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

function Metric({ label, value, tone, sub }: { label: string; value: number; tone: "seed" | "company" | "match" | "poc"; sub?: string }) {
  const toneClass = {
    seed: "border-emerald-400/35 bg-emerald-400/10",
    company: "border-cyan-400/35 bg-cyan-400/10",
    match: "border-violet-400/35 bg-violet-400/10",
    poc: "border-amber-400/35 bg-amber-400/10",
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

function CompanyCandidateCard({
  company,
  selectedTags,
  onToggleTag,
}: {
  company: PocCompanyListItem;
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
}) {
  const tags = companySelectionTags(company).slice(0, 9);
  return (
    <article className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-semibold">{company.company_name}</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {[company.company_size, company.region, POC_COMPANY_STATUS_LABEL[company.status]].filter(Boolean).join(" / ") || "属性未設定"}
          </p>
        </div>
        <span className="shrink-0 rounded border border-border bg-muted/35 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {company.active_match_count}/{company.match_count}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {tags.map((tag) => {
          const selected = selectedTags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onToggleTag(tag)}
              className={`rounded border px-1.5 py-0.5 text-[10px] transition-colors ${
                selected
                  ? "border-cyan-500/45 bg-cyan-500/12 text-cyan-700 dark:text-cyan-200"
                  : "border-border bg-muted/35 text-muted-foreground hover:bg-muted"
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>
      {company.poc_profile && <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{company.poc_profile}</p>}
      {company.next_action && <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">次: {company.next_action}</p>}
    </article>
  );
}

function PairingRowCard({
  row,
  saving,
  onCreateMatch,
}: {
  row: PairingRow;
  saving: boolean;
  onCreateMatch: (seed: PocSeedRef, company: PocCompanyListItem) => void;
}) {
  const seedTags = [...(row.seed.industry_target ?? []), ...(row.seed.keywords ?? [])].slice(0, 6);
  return (
    <article className="rounded-lg border border-border bg-background p-3">
      <div className="grid gap-3 xl:grid-cols-[minmax(240px,360px)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {row.seed.domain_lane && (
              <span className="rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-200">
                {SEED_DOMAIN_LANE_LABEL[row.seed.domain_lane as SeedDomainLane] ?? row.seed.domain_lane}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">{SEED_STATUS_LABEL[row.seed.status as SeedStatus] ?? row.seed.status}</span>
          </div>
          <h3 className="mt-1 line-clamp-2 text-sm font-semibold">{row.seed.title}</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {[row.seed.org_name, row.seed.researcher_name, row.seed.org_region].filter(Boolean).join(" / ")}
          </p>
          {row.seed.summary && <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{row.seed.summary}</p>}
          {seedTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {seedTags.map((tag) => (
                <Tag key={tag} label={tag} />
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          {row.matches.length > 0 && (
            <div>
              <div className="mb-1.5 text-[11px] font-semibold text-muted-foreground">既存案件</div>
              <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
                {row.matches.slice(0, 6).map((match) => (
                  <div key={match.id} className="rounded-md border border-border bg-card p-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusChip label={POC_MATCH_STATUS_LABEL[match.status]} className={POC_MATCH_STATUS_COLOR[match.status]} />
                      <span className="text-[10px] text-muted-foreground">{match.company?.company_name ?? "PoC先未設定"}</span>
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs font-medium">{match.match_title}</div>
                    {match.next_action && <div className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">{match.next_action}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {row.candidates.length > 0 && (
            <div>
              <div className="mb-1.5 text-[11px] font-semibold text-muted-foreground">PoC先候補</div>
              <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
                {row.candidates.map(({ company, overlap }) => (
                  <button
                    key={company.id}
                    type="button"
                    disabled={saving}
                    onClick={() => onCreateMatch(row.seed, company)}
                    className="rounded-md border border-dashed border-border bg-muted/10 p-2 text-left transition-colors hover:border-emerald-500/45 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="line-clamp-2 text-xs font-semibold">{company.company_name}</div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          {[company.company_size, company.region, POC_COMPANY_STATUS_LABEL[company.status]].filter(Boolean).join(" / ")}
                        </div>
                      </div>
                      <span className="shrink-0 rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-200">
                        案件化
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(overlap.length > 0 ? overlap : company.industry_tags).slice(0, 4).map((tag) => (
                        <Tag key={tag} label={tag} />
                      ))}
                    </div>
                    {company.poc_profile && <div className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">{company.poc_profile}</div>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span className="rounded border border-border bg-muted/35 px-1.5 py-0.5 text-[10px] text-muted-foreground">
      {label}
    </span>
  );
}

function buildGeneratedMatch(seed: PocSeedRef, company: PocCompanyListItem) {
  const seedTargets = seed.industry_target ?? [];
  const companyTags = company.industry_tags ?? [];
  const overlap = seedTargets.filter((target) =>
    companyTags.some((tag) => normalizeText(tag).includes(normalizeText(target)) || normalizeText(target).includes(normalizeText(tag))),
  );
  const targetText = seedTargets.slice(0, 3).join(" / ") || seed.domain_lane || "用途";
  const companyText = companyTags.slice(0, 3).join(" / ") || company.poc_profile || "現場課題";
  const fit = overlap.length > 0
    ? `${overlap.join(" / ")} が重なるため、${seed.title} を ${company.company_name} のPoC課題へ当てられるか確認する。`
    : `${seed.title} の用途仮説 (${targetText}) と、${company.company_name} 側のPoC文脈 (${companyText}) をヒアリングで照合する。`;

  return {
    seed_id: seed.id,
    company_id: company.id,
    match_title: `${seed.title} × ${company.company_name}`,
    fit_hypothesis: fit,
    hearing_questions: [
      "現場で一番重い未解決課題と、既存の代替手段は何か",
      "小さなPoCで測るべき効果・測定値・合格ラインは何か",
      "謝礼、有償PoC、契約、データ利用に進む条件は何か",
    ],
    poc_goal: "実環境または実データに近い条件で、効果・コスト・導入条件を確認する。",
    reward_plan: "ヒアリング謝礼または有償PoC費用を前提に、相手先の工数を無償扱いにしない。",
    contract_plan: "PoC検証の範囲、成果物、秘密保持、データ利用、責任範囲を事前に明記する。",
    funding_plan: "相手先の実証予算、自治体・補助金、AMD/SU側の開発費負担を確認する。",
    revenue_share_note: "紹介・案件設計・DB利用・PoC伴走のどこで収益分配するかは個別設計にする。",
    status: "candidate" as PocMatchStatus,
    priority: "medium" as PocPriority,
    next_action: "仮説を見て、初回ヒアリングで聞く順番を決める。",
    source_note: "シーズ×PoC先案件化キュー",
  };
}

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

function buildPairingRows(
  data: PocHubData | null,
  search: string,
  selectedCompanyTags: string[],
  companyStatus: PocCompanyStatus | "active" | "all",
  matchStatus: PocMatchStatus | "active" | "all",
): PairingRow[] {
  if (!data) return [];
  const q = normalizeText(search);
  const activeSeeds = data.seeds.filter((seed) => seed.status !== "declined");
  const activeCompanies = data.companies.filter((company) => {
    if (companyStatus === "active" && company.status === "archived") return false;
    if (companyStatus !== "active" && companyStatus !== "all" && company.status !== companyStatus) return false;
    return hasSelectedTags(company, selectedCompanyTags);
  });
  const matchesBySeed = new Map<string, PocMatchListItem[]>();
  const matchedPairKeys = new Set<string>();

  for (const match of data.matches) {
    if (!match.seed_id) continue;
    const rows = matchesBySeed.get(match.seed_id) ?? [];
    rows.push(match);
    matchesBySeed.set(match.seed_id, rows);
    if (match.company_id) matchedPairKeys.add(`${match.seed_id}:${match.company_id}`);
  }

  return activeSeeds
    .map((seed) => {
      const matches = (matchesBySeed.get(seed.id) ?? []).filter((match) => {
        if (matchStatus === "active" && (match.status === "archived" || match.status === "deal")) return false;
        if (matchStatus !== "active" && matchStatus !== "all" && match.status !== matchStatus) return false;
        if (!q) return true;
        return normalizeText(
          [
            match.match_title,
            match.fit_hypothesis,
            match.next_action,
            match.company?.company_name,
            match.company?.industry_tags.join(" "),
          ]
            .filter(Boolean)
            .join(" "),
        ).includes(q);
      });
      const candidates = activeCompanies
        .filter((company) => !matchedPairKeys.has(`${seed.id}:${company.id}`))
        .map((company) => scoreCompanyForSeed(seed, company, q, selectedCompanyTags))
        .filter((candidate) => candidate.score > 0)
        .sort(
          (a, b) =>
            b.score - a.score ||
            b.company.active_match_count - a.company.active_match_count ||
            a.company.company_name.localeCompare(b.company.company_name, "ja"),
        )
        .slice(0, MAX_PAIRING_CANDIDATES_PER_SEED);
      const seedMatchesQuery = !q || normalizeText(seedText(seed)).includes(q);
      return { seed, matches, candidates, seedMatchesQuery };
    })
    .filter((row) => row.seedMatchesQuery || row.matches.length > 0 || row.candidates.length > 0)
    .sort(
      (a, b) =>
        b.matches.length - a.matches.length ||
        b.candidates.length - a.candidates.length ||
        (b.seed.amd_rating ?? 0) - (a.seed.amd_rating ?? 0) ||
        a.seed.title.localeCompare(b.seed.title, "ja"),
    )
    .map(({ seed, matches, candidates }) => ({ seed, matches, candidates }));
}

function scoreCompanyForSeed(seed: PocSeedRef, company: PocCompanyListItem, q: string, selectedCompanyTags: string[]): PairingCandidate {
  const seedTerms = seedTermList(seed);
  const companyTerms = companyTermList(company);
  const companyText = normalizeText(companyTerms.join(" "));
  const seedTextValue = normalizeText(seedTerms.join(" "));
  const overlap = seedTerms
    .filter((term) => {
      const normalized = normalizeText(term);
      return normalized.length > 1 && companyText.includes(normalized);
    })
    .slice(0, 6);
  const reverseOverlap = company.industry_tags
    .filter((tag) => {
      const normalized = normalizeText(tag);
      return normalized.length > 1 && seedTextValue.includes(normalized);
    })
    .slice(0, 6);
  const uniqueOverlap = Array.from(new Set([...overlap, ...reverseOverlap]));
  const qHit = q && (companyText.includes(q) || seedTextValue.includes(q)) ? 6 : 0;
  const selectedTagBoost = selectedCompanyTags.length > 0 ? selectedCompanyTags.length * 3 : 0;
  const statusBoost =
    company.status === "poc_ready" ? 3 : company.status === "hearing" || company.status === "contacted" ? 2 : company.status === "listed" ? 1 : 0;
  const score = uniqueOverlap.length * 4 + qHit + selectedTagBoost + statusBoost + Math.min(2, company.active_match_count);
  return { company, overlap: uniqueOverlap, score };
}

function buildCompanyTagCounts(companies: PocCompanyListItem[]) {
  const counts = new Map<string, number>();
  for (const company of companies) {
    for (const tag of companySelectionTags(company)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "ja"));
}

function hasSelectedTags(company: PocCompanyListItem, selectedTags: string[]) {
  if (selectedTags.length === 0) return true;
  const tags = new Set(companySelectionTags(company).map(normalizeText));
  return selectedTags.every((tag) => tags.has(normalizeText(tag)));
}

function companySelectionTags(company: PocCompanyListItem) {
  return Array.from(
    new Set(
      [
        ...company.industry_tags,
        company.region,
        company.company_size,
        POC_COMPANY_STATUS_LABEL[company.status],
      ].filter(Boolean) as string[],
    ),
  );
}

function seedText(seed: PocSeedRef) {
  return seedTermList(seed).join(" ");
}

function seedTermList(seed: PocSeedRef) {
  return [
    seed.title,
    seed.summary,
    seed.org_name,
    seed.org_region,
    seed.researcher_name,
    seed.domain_lane,
    ...(seed.industry_target ?? []),
    ...(seed.keywords ?? []),
  ].filter(Boolean) as string[];
}

function companyTermList(company: PocCompanyListItem) {
  return [
    company.company_name,
    company.company_size,
    company.region,
    company.poc_profile,
    company.poc_history_note,
    company.incentive_note,
    company.next_action,
    ...company.industry_tags,
  ].filter(Boolean) as string[];
}

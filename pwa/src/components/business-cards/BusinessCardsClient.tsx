"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Database,
  FileImage,
  Globe2,
  Link2,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  ScanLine,
  Search,
  UserRound,
} from "lucide-react";
import type {
  BusinessCard,
  BusinessCardDraft,
  BusinessCardProjectOption,
  BusinessCardStatus,
} from "@/lib/business-card-types";
import { cn } from "@/lib/utils";

type Counts = { total: number; needsReview: number; confirmed: number };

const STATUS_LABELS: Record<BusinessCardStatus, string> = {
  processing: "読み取り中",
  needs_review: "要確認",
  confirmed: "確認済み",
  ocr_failed: "手入力が必要",
  archived: "保管終了",
};

const EMPTY_COUNTS: Counts = { total: 0, needsReview: 0, confirmed: 0 };

function todayJst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function draftFromCard(card: BusinessCard): BusinessCardDraft {
  return {
    fullName: card.fullName,
    fullNameKana: card.fullNameKana,
    companyName: card.companyName,
    department: card.department,
    jobTitle: card.jobTitle,
    email: card.email,
    phone: card.phone,
    mobile: card.mobile,
    postalCode: card.postalCode,
    address: card.address,
    website: card.website,
    relationshipNote: card.relationshipNote,
    metOn: card.metOn || todayJst(),
    projectIds: card.projects.map((project) => project.projectId),
  };
}

async function prepareBusinessCardImage(file: File): Promise<File> {
  const supported = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
  if (supported && file.size <= 1_500_000) return file;

  const url = URL.createObjectURL(file);
  try {
    const source = new Image();
    source.decoding = "async";
    source.src = url;
    await source.decode();
    const maxSide = 1800;
    const scale = Math.min(1, maxSide / Math.max(source.naturalWidth, source.naturalHeight));
    const width = Math.max(1, Math.round(source.naturalWidth * scale));
    const height = Math.max(1, Math.round(source.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("画像を縮小できなかったよ");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(source, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error("画像変換に失敗したよ"))),
        "image/jpeg",
        0.86,
      );
    });
    if (blob.size > 4 * 1024 * 1024) {
      throw new Error("画像を4MB以内にできなかったよ。少し離れて撮り直してね");
    }
    const baseName = file.name.replace(/\.[^.]+$/, "") || "business-card";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function BusinessCardsClient() {
  const [cards, setCards] = useState<BusinessCard[]>([]);
  const [projects, setProjects] = useState<BusinessCardProjectOption[]>([]);
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "review" | "confirmed">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<BusinessCardDraft | null>(null);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  const mobileEditorRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/business-cards", { cache: "no-store" });
      const json = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        cards?: BusinessCard[];
        projects?: BusinessCardProjectOption[];
        counts?: Counts;
        error?: string;
      };
      if (!response.ok || json.ok === false) throw new Error(json.error || "名刺を読み込めなかったよ");
      const nextCards = Array.isArray(json.cards) ? json.cards : [];
      setCards(nextCards);
      setProjects(Array.isArray(json.projects) ? json.projects : []);
      setCounts(json.counts || EMPTY_COUNTS);
      setSelectedId((current) => current || nextCards.find((card) => card.status !== "confirmed")?.id || null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "名刺を読み込めなかったよ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedCard = useMemo(
    () => cards.find((card) => card.id === selectedId) || null,
    [cards, selectedId],
  );

  useEffect(() => {
    setDraft(selectedCard ? draftFromCard(selectedCard) : null);
  }, [selectedCard]);

  const visibleCards = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return cards.filter((card) => {
      if (statusFilter === "review" && !["needs_review", "ocr_failed"].includes(card.status)) return false;
      if (statusFilter === "confirmed" && card.status !== "confirmed") return false;
      if (projectFilter && !card.projects.some((project) => project.projectId === projectFilter)) return false;
      if (!normalizedQuery) return true;
      return [
        card.fullName,
        card.fullNameKana,
        card.companyName,
        card.department,
        card.jobTitle,
        card.email,
        card.phone,
        card.mobile,
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [cards, projectFilter, query, statusFilter]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    setNotice("名刺を読み取ってるよ…");
    setDuplicateCount(0);
    try {
      const prepared = await prepareBusinessCardImage(file);
      const form = new FormData();
      form.set("file", prepared);
      const response = await fetch("/api/business-cards", { method: "POST", body: form });
      const json = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        card?: BusinessCard;
        duplicateCount?: number;
        warning?: string | null;
        error?: string;
      };
      if (!response.ok || json.ok === false || !json.card) {
        throw new Error(json.error || "名刺を登録できなかったよ");
      }
      setCards((current) => [json.card!, ...current.filter((card) => card.id !== json.card!.id)]);
      setCounts((current) => ({
        total: current.total + 1,
        needsReview: current.needsReview + 1,
        confirmed: current.confirmed,
      }));
      setSelectedId(json.card.id);
      setDuplicateCount(Number(json.duplicateCount) || 0);
      setNotice(json.warning ? "OCRできなかったので、見ながら入力してね" : "読み取ったよ。内容とPJを確認してね");
      window.setTimeout(() => mobileEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "名刺を登録できなかったよ");
      setNotice(null);
    } finally {
      setUploading(false);
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (libraryInputRef.current) libraryInputRef.current.value = "";
    }
  }

  async function confirmCard() {
    if (!selectedCard || !draft) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/business-cards/${encodeURIComponent(selectedCard.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        card?: BusinessCard;
        error?: string;
      };
      if (!response.ok || json.ok === false || !json.card) {
        throw new Error(json.error || "名刺を確定できなかったよ");
      }
      setCards((current) => current.map((card) => (card.id === json.card!.id ? json.card! : card)));
      setCounts((current) => ({
        total: current.total,
        needsReview: Math.max(0, current.needsReview - (selectedCard.status === "confirmed" ? 0 : 1)),
        confirmed: current.confirmed + (selectedCard.status === "confirmed" ? 0 : 1),
      }));
      setDuplicateCount(0);
      setNotice(`${draft.projectIds.length} PJ のknowledgeに反映したよ`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "名刺を確定できなかったよ");
    } finally {
      setSaving(false);
    }
  }

  function selectCard(card: BusinessCard) {
    setSelectedId(card.id);
    setDuplicateCount(0);
    setError(null);
    setNotice(null);
    window.setTimeout(() => mobileEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  return (
    <div className="business-card-page amd-desk-page-skin min-h-screen px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <div className="mx-auto max-w-[1480px]">
        <header className="mb-5 flex flex-col gap-4 border-b border-[var(--contact-line)] pb-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[var(--contact-blue)]">
              <span className="h-2 w-2 rounded-full bg-[var(--contact-blue)]" />
              RELATIONSHIP ASSET
            </div>
            <h1 className="text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">名刺</h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--contact-muted)]">
              会った人を撮って、確かめて、PJの関係資産へ。連絡先は名刺台帳だけで安全に管理するよ。
            </p>
          </div>
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-[var(--contact-line)] bg-[var(--contact-line)] sm:min-w-[390px]">
            <Metric label="名刺" value={counts.total} />
            <Metric label="要確認" value={counts.needsReview} tone="amber" />
            <Metric label="Knowledge反映" value={counts.confirmed} tone="green" />
          </div>
        </header>

        <div className="mb-5 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 text-xs text-[var(--contact-muted)] sm:max-w-2xl">
          <FlowStep icon={Camera} label="撮る" active={uploading} />
          <ArrowRight className="h-3.5 w-3.5 text-[var(--contact-quiet)]" />
          <FlowStep icon={ScanLine} label="確かめる" />
          <ArrowRight className="h-3.5 w-3.5 text-[var(--contact-quiet)]" />
          <FlowStep icon={Database} label="PJへ格納" />
        </div>

        {(notice || error) && (
          <div
            className={cn(
              "mb-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm",
              error
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-[rgba(36,93,135,.18)] bg-[var(--contact-blue-soft)] text-[var(--contact-blue)]",
            )}
          >
            {error ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{error || notice}</span>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-start">
          <div className="min-w-0 space-y-5">
            <section className="business-card-surface overflow-hidden rounded-xl">
              <div className="grid gap-0 md:grid-cols-[1fr_220px]">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={uploading}
                  className="group flex min-h-36 items-center gap-4 p-5 text-left transition-colors hover:bg-[var(--contact-paper-raised)] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--contact-blue)] disabled:opacity-60 sm:p-6"
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--contact-blue)] text-white shadow-[0_8px_22px_rgba(36,93,135,.22)]">
                    {uploading ? <LoaderCircle className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
                  </span>
                  <span>
                    <span className="block text-base font-semibold">スマホで名刺を撮る</span>
                    <span className="mt-1 block text-xs leading-5 text-[var(--contact-muted)]">
                      枠いっぱい・影なしで撮ると、氏名と所属をきれいに読めるよ
                    </span>
                  </span>
                </button>
                <div className="flex items-center border-t border-[var(--contact-line)] p-4 md:border-l md:border-t-0">
                  <button
                    type="button"
                    onClick={() => libraryInputRef.current?.click()}
                    disabled={uploading}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-[var(--contact-line)] bg-[var(--contact-inset)] px-4 text-sm font-medium transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--contact-blue)] disabled:opacity-60"
                  >
                    <FileImage className="h-4 w-4" />
                    写真から選ぶ
                  </button>
                </div>
              </div>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                aria-hidden="true"
                tabIndex={-1}
                className="sr-only"
                onChange={(event) => void upload(event.target.files?.[0])}
              />
              <input
                ref={libraryInputRef}
                type="file"
                accept="image/*"
                aria-hidden="true"
                tabIndex={-1}
                className="sr-only"
                onChange={(event) => void upload(event.target.files?.[0])}
              />
            </section>

            <div ref={mobileEditorRef} className="scroll-mt-4 lg:hidden">
              {selectedCard && draft && (
                <CardEditor
                  card={selectedCard}
                  draft={draft}
                  projects={projects}
                  saving={saving}
                  duplicateCount={duplicateCount}
                  onDraftChange={setDraft}
                  onConfirm={() => void confirmCard()}
                />
              )}
            </div>

            <section className="business-card-surface overflow-hidden rounded-xl">
              <div className="border-b border-[var(--contact-line)] p-4 sm:p-5">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold">関係者台帳</h2>
                    <p className="mt-0.5 text-xs text-[var(--contact-muted)]">氏名・所属・PJで探せるよ</p>
                  </div>
                  <span className="font-mono text-xs text-[var(--contact-quiet)]">{visibleCards.length} / {cards.length}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
                  <label className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--contact-quiet)]" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      aria-label="名刺を氏名、会社、メールで検索"
                      className="business-card-control h-11 w-full rounded-lg pl-9 pr-3 text-sm"
                      placeholder="氏名、会社、メールで検索"
                    />
                  </label>
                  <ProjectFilterMenu
                    projects={projects}
                    value={projectFilter}
                    onChange={setProjectFilter}
                  />
                </div>
                <div className="mt-2 flex gap-1.5">
                  {([
                    ["all", "すべて"],
                    ["review", "要確認"],
                    ["confirmed", "確認済み"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setStatusFilter(value)}
                      className={cn(
                        "h-8 rounded-full px-3 text-xs font-medium transition-colors",
                        statusFilter === value
                          ? "bg-[var(--contact-ink)] text-white"
                          : "bg-[var(--contact-inset)] text-[var(--contact-muted)] hover:text-[var(--contact-ink)]",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-[var(--contact-line)]">
                {loading && (
                  <div className="flex items-center justify-center gap-2 px-5 py-14 text-sm text-[var(--contact-muted)]">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    読み込み中…
                  </div>
                )}
                {!loading && visibleCards.length === 0 && (
                  <div className="px-5 py-14 text-center">
                    <UserRound className="mx-auto h-6 w-6 text-[var(--contact-quiet)]" />
                    <p className="mt-2 text-sm font-medium">該当する名刺はまだないよ</p>
                    <p className="mt-1 text-xs text-[var(--contact-muted)]">上のカメラから最初の1枚を追加してね</p>
                  </div>
                )}
                {visibleCards.map((card) => (
                  <BusinessCardRow
                    key={card.id}
                    card={card}
                    selected={card.id === selectedId}
                    onClick={() => selectCard(card)}
                  />
                ))}
              </div>
            </section>
          </div>

          <div className="sticky top-5 hidden lg:block">
            {selectedCard && draft ? (
              <CardEditor
                card={selectedCard}
                draft={draft}
                projects={projects}
                saving={saving}
                duplicateCount={duplicateCount}
                onDraftChange={setDraft}
                onConfirm={() => void confirmCard()}
              />
            ) : (
              <section className="business-card-surface rounded-xl p-8 text-center">
                <Link2 className="mx-auto h-7 w-7 text-[var(--contact-blue)]" />
                <h2 className="mt-3 text-sm font-semibold">名刺を選ぶと確認欄が開くよ</h2>
                <p className="mt-2 text-xs leading-5 text-[var(--contact-muted)]">
                  OCR結果を確認してPJを選ぶと、人物情報がknowledgeに入るよ。
                </p>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone = "blue" }: { label: string; value: number; tone?: "blue" | "amber" | "green" }) {
  const colors = {
    blue: "text-[var(--contact-blue)]",
    amber: "text-[var(--contact-amber)]",
    green: "text-[var(--contact-green)]",
  };
  return (
    <div className="bg-[var(--contact-paper)] px-3 py-2.5 text-center">
      <div className={cn("font-mono text-lg font-semibold", colors[tone])}>{value}</div>
      <div className="text-[10px] font-medium text-[var(--contact-muted)]">{label}</div>
    </div>
  );
}

function FlowStep({ icon: Icon, label, active = false }: { icon: typeof Camera; label: string; active?: boolean }) {
  return (
    <div className={cn("flex min-w-0 items-center justify-center gap-1.5 rounded-full px-2.5 py-2", active ? "bg-[var(--contact-blue-soft)] text-[var(--contact-blue)]" : "bg-[rgba(255,253,247,.72)]")}>
      <Icon className={cn("h-3.5 w-3.5 shrink-0", active && "animate-pulse")} />
      <span className="truncate font-medium">{label}</span>
    </div>
  );
}

function StatusPill({ status }: { status: BusinessCardStatus }) {
  const style = status === "confirmed"
    ? "bg-[var(--contact-green-soft)] text-[var(--contact-green)]"
    : status === "processing"
      ? "bg-[var(--contact-blue-soft)] text-[var(--contact-blue)]"
      : "bg-[var(--contact-amber-soft)] text-[var(--contact-amber)]";
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2 text-[10px] font-semibold", style)}>
      {status === "confirmed" ? <Check className="h-3 w-3" /> : null}
      {STATUS_LABELS[status]}
    </span>
  );
}

function BusinessCardRow({ card, selected, onClick }: { card: BusinessCard; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "grid w-full grid-cols-[82px_minmax(0,1fr)] gap-3 p-3 text-left transition-colors sm:grid-cols-[112px_minmax(0,1fr)_auto] sm:items-center sm:p-4",
        selected ? "bg-[var(--contact-blue-soft)]/65" : "hover:bg-[var(--contact-paper-raised)]",
      )}
    >
      <div className="aspect-[1.586] overflow-hidden rounded-md border border-[var(--contact-line)] bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={card.imageUrl} alt={`${card.fullName || "未確認"}の名刺`} className="h-full w-full object-cover" />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold">{card.fullName || "氏名未確認"}</span>
          <span className="sm:hidden"><StatusPill status={card.status} /></span>
        </div>
        <p className="mt-0.5 truncate text-xs text-[var(--contact-muted)]">
          {[card.companyName, card.department, card.jobTitle].filter(Boolean).join(" / ") || "所属未確認"}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {card.projects.length > 0 ? card.projects.slice(0, 3).map((project) => (
            <span key={project.projectId} className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] text-[var(--contact-blue)]">
              {project.projectName}
            </span>
          )) : (
            <span className="text-[10px] text-[var(--contact-quiet)]">PJ未設定</span>
          )}
        </div>
      </div>
      <div className="hidden min-w-24 justify-self-end sm:block">
        <StatusPill status={card.status} />
      </div>
    </button>
  );
}

function ProjectFilterMenu({
  projects,
  value,
  onChange,
}: {
  projects: BusinessCardProjectOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = projects.find((project) => project.projectId === value);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="business-card-control flex h-11 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-sm"
      >
        <span className="min-w-0 truncate">{selected?.projectName || "すべてのPJ"}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-[var(--contact-quiet)] transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-[calc(100%+6px)] z-30 max-h-72 w-[min(320px,calc(100vw-48px))] overflow-y-auto rounded-lg border border-[var(--contact-line)] bg-[var(--contact-paper-raised)] p-1.5 shadow-[0_14px_38px_rgba(55,47,32,.16)]"
        >
          <button
            type="button"
            role="option"
            aria-selected={!value}
            onClick={() => { onChange(""); setOpen(false); }}
            className={cn("flex min-h-10 w-full items-center rounded-md px-2.5 text-left text-xs", !value ? "bg-[var(--contact-blue-soft)] font-semibold text-[var(--contact-blue)]" : "hover:bg-[var(--contact-inset)]")}
          >
            すべてのPJ
          </button>
          {projects.map((project) => (
            <button
              key={project.projectId}
              type="button"
              role="option"
              aria-selected={value === project.projectId}
              onClick={() => { onChange(project.projectId); setOpen(false); }}
              className={cn("flex min-h-10 w-full items-center justify-between gap-2 rounded-md px-2.5 text-left text-xs", value === project.projectId ? "bg-[var(--contact-blue-soft)] font-semibold text-[var(--contact-blue)]" : "hover:bg-[var(--contact-inset)]")}
            >
              <span className="min-w-0 truncate">{project.projectName}</span>
              <span className="font-mono text-[9px] text-[var(--contact-quiet)]">{project.projectId}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CardEditor({
  card,
  draft,
  projects,
  saving,
  duplicateCount,
  onDraftChange,
  onConfirm,
}: {
  card: BusinessCard;
  draft: BusinessCardDraft;
  projects: BusinessCardProjectOption[];
  saving: boolean;
  duplicateCount: number;
  onDraftChange: (draft: BusinessCardDraft) => void;
  onConfirm: () => void;
}) {
  const set = (key: keyof BusinessCardDraft, value: string | string[]) =>
    onDraftChange({ ...draft, [key]: value });
  const toggleProject = (projectId: string) => {
    const exists = draft.projectIds.includes(projectId);
    set("projectIds", exists ? draft.projectIds.filter((id) => id !== projectId) : [...draft.projectIds, projectId]);
  };

  return (
    <section className="business-card-surface overflow-hidden rounded-xl">
      <div className="relative aspect-[1.586] overflow-hidden border-b border-[var(--contact-line)] bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={card.imageUrl} alt={`${draft.fullName || "未確認"}の名刺`} className="h-full w-full object-contain" />
        <div className="absolute left-3 top-3"><StatusPill status={card.status} /></div>
        {card.ocrConfidence !== null && (
          <div className="absolute bottom-3 right-3 rounded-full bg-black/65 px-2 py-1 font-mono text-[10px] text-white backdrop-blur">
            OCR {Math.round(card.ocrConfidence * 100)}%
          </div>
        )}
      </div>

      <div className="p-4 sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">読み取り結果を確認</h2>
            <p className="mt-0.5 text-xs text-[var(--contact-muted)]">違うところだけ直せば大丈夫</p>
          </div>
          <span className="font-mono text-[10px] text-[var(--contact-quiet)]">{card.capturedAt.slice(0, 10)}</span>
        </div>

        {(card.ocrError || duplicateCount > 0) && (
          <div className="mb-4 space-y-2">
            {card.ocrError && (
              <div className="rounded-lg bg-[var(--contact-amber-soft)] px-3 py-2 text-xs leading-5 text-[var(--contact-amber)]">
                OCRできなかったよ。画像を見ながら氏名と所属を入れてね。
              </div>
            )}
            {duplicateCount > 0 && (
              <div className="rounded-lg bg-[var(--contact-amber-soft)] px-3 py-2 text-xs leading-5 text-[var(--contact-amber)]">
                同じメールか電話の名刺が {duplicateCount} 件あるよ。重複じゃないか確認してね。
              </div>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
          <Field label="氏名" value={draft.fullName} required confidence={card.fieldConfidence.full_name} icon={UserRound} onChange={(value) => set("fullName", value)} />
          <Field label="ふりがな・ローマ字" value={draft.fullNameKana} onChange={(value) => set("fullNameKana", value)} />
          <Field label="会社・組織" value={draft.companyName} confidence={card.fieldConfidence.company_name} icon={Building2} onChange={(value) => set("companyName", value)} />
          <Field label="部署・研究室" value={draft.department} confidence={card.fieldConfidence.department} onChange={(value) => set("department", value)} />
          <Field label="役職" value={draft.jobTitle} confidence={card.fieldConfidence.job_title} onChange={(value) => set("jobTitle", value)} />
          <Field label="メール" value={draft.email} confidence={card.fieldConfidence.email} icon={Mail} inputMode="email" onChange={(value) => set("email", value)} />
          <Field label="電話" value={draft.phone} confidence={card.fieldConfidence.phone} icon={Phone} inputMode="tel" onChange={(value) => set("phone", value)} />
          <Field label="携帯" value={draft.mobile} confidence={card.fieldConfidence.mobile} icon={Phone} inputMode="tel" onChange={(value) => set("mobile", value)} />
          <Field label="郵便番号" value={draft.postalCode} confidence={card.fieldConfidence.postal_code} onChange={(value) => set("postalCode", value)} />
          <Field label="Webサイト" value={draft.website} confidence={card.fieldConfidence.website} icon={Globe2} inputMode="url" onChange={(value) => set("website", value)} />
          <div className="sm:col-span-2">
            <Field label="住所" value={draft.address} confidence={card.fieldConfidence.address} icon={MapPin} onChange={(value) => set("address", value)} />
          </div>
          <Field label="会った日" value={draft.metOn} icon={CalendarDays} placeholder="YYYY-MM-DD" inputMode="numeric" onChange={(value) => set("metOn", value)} />
          <div className="sm:col-span-2">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold text-[var(--contact-muted)]">接点メモ</span>
              <textarea
                value={draft.relationshipNote}
                onChange={(event) => set("relationshipNote", event.target.value)}
                rows={2}
                className="business-card-control w-full resize-none rounded-lg px-3 py-2 text-sm leading-5"
                placeholder="どこで会ったか、何を話したか"
              />
            </label>
          </div>
        </div>

        <div className="mt-5 border-t border-[var(--contact-line)] pt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">紐づけるPJ</h3>
              <p className="mt-0.5 text-[11px] text-[var(--contact-muted)]">複数選べるよ</p>
            </div>
            <span className="font-mono text-[10px] text-[var(--contact-quiet)]">{draft.projectIds.length} PJ</span>
          </div>
          <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg bg-[var(--contact-inset)] p-1.5">
            {projects.map((project) => {
              const selected = draft.projectIds.includes(project.projectId);
              return (
                <button
                  key={project.projectId}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleProject(project.projectId)}
                  className={cn(
                    "flex min-h-10 w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors",
                    selected ? "bg-white text-[var(--contact-ink)] shadow-sm" : "text-[var(--contact-muted)] hover:bg-white/70",
                  )}
                >
                  <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded border", selected ? "border-[var(--contact-blue)] bg-[var(--contact-blue)] text-white" : "border-[var(--contact-line)] bg-white")}>
                    {selected && <Check className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{project.projectName}</span>
                  <span className="font-mono text-[9px] text-[var(--contact-quiet)]">{project.projectId}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={onConfirm}
          disabled={saving || !draft.fullName.trim() || draft.projectIds.length === 0}
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--contact-blue)] px-4 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(36,93,135,.18)] transition-colors hover:bg-[#1e5279] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--contact-blue)] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : card.status === "confirmed" ? <CheckCircle2 className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
          {saving ? "反映中…" : card.status === "confirmed" ? "変更を保存してknowledgeを更新" : "確認してPJ knowledgeへ登録"}
        </button>

        {card.rawOcrText && (
          <details className="mt-3 text-xs text-[var(--contact-muted)]">
            <summary className="cursor-pointer py-1 font-medium">OCRの読み取り全文</summary>
            <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-[var(--contact-inset)] p-3 font-mono text-[10px] leading-5">
              {card.rawOcrText}
            </pre>
          </details>
        )}
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  required = false,
  confidence,
  icon: Icon,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  confidence?: number;
  icon?: typeof UserRound;
  placeholder?: string;
  inputMode?: "email" | "tel" | "url" | "numeric";
}) {
  const lowConfidence = typeof confidence === "number" && confidence < 0.7;
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--contact-muted)]">
        {Icon && <Icon className="h-3 w-3" />}
        {label}{required ? " *" : ""}
        {lowConfidence && <span className="ml-auto text-[9px] font-medium text-[var(--contact-amber)]">要確認</span>}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className={cn(
          "business-card-control h-10 w-full rounded-lg px-3 text-sm",
          lowConfidence && "border-[rgba(154,97,25,.35)] bg-[var(--contact-amber-soft)]/45",
        )}
      />
    </label>
  );
}

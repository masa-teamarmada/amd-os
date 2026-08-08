import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FolderOpen,
  ListChecks,
} from "lucide-react";

type DocumentState = "confirming" | "alignment" | "design";

type DocumentVersion = {
  label: string;
  fileName: string;
  href: string;
};

type RegulationDocument = {
  id: string;
  title: string;
  category: string;
  state: DocumentState;
  status: string;
  nextTodo: string;
  due: string;
  latest: DocumentVersion;
  history: DocumentVersion[];
};

const VERSION_FOLDER_URL =
  "https://drive.google.com/drive/folders/1OI6aHEt_r7Q7msQ0C7B-HTcmjQ8DQOXe";

const KUTE_REGULATION_DOCUMENTS: RegulationDocument[] = [
  {
    id: "recognition-rule",
    title: "大学発スタートアップ認定規程",
    category: "規程",
    state: "confirming",
    status: "最終決裁状況の確認待ち",
    nextTodo: "承認結果、施行日、様式の確定状況を照合し、差分を記録する。",
    due: "2026/08/28",
    latest: {
      label: "最新版 · 2026/06/22",
      fileName: "大学発ベンチャーの認定に関する規程_修正案_260622.docx",
      href: "https://docs.google.com/document/d/1XizS-_vBDDGY5aW364UoVdg_90br3-Oj/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
    },
    history: [
      {
        label: "2026/06/10",
        fileName: "大学発ベンチャーの認定に関する規程_修正案_260610.docx",
        href: "https://docs.google.com/document/d/1is56V6w-pHB052KgX16Uu5EYXPFQU0RM/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
      },
    ],
  },
  {
    id: "committee-rules",
    title: "認定委員会内規",
    category: "内規",
    state: "confirming",
    status: "最終決裁状況の確認待ち",
    nextTodo:
      "7/22版を基準に、委員会で確定した運用とチェックシートの差分を反映する。",
    due: "2026/08/28",
    latest: {
      label: "最新版 · 2026/07/22",
      fileName: "工学院大学大学発ベンチャー認定員会内規20260722_yf.docx",
      href: "https://docs.google.com/document/d/1-mEVJS_lAKC-22kAPAB_O6vXctczwtJh/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
    },
    history: [
      {
        label: "2026/07/17",
        fileName: "工学院大学大学発ベンチャー認定員会内規20260717_yf.docx",
        href: "https://docs.google.com/document/d/15aKaTfE6FvaAwsnpItY2K2PC6gI4zXPU/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
      },
      {
        label: "2026/06/22",
        fileName: "工学院大学大学発ベンチャー認定員会細則20260622.docx",
        href: "https://docs.google.com/document/d/1d7pirKz4gibJ4Zt1912mCyfn8oIcw0N0/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
      },
      {
        label: "2026/06/11",
        fileName: "工学院大学大学発ベンチャー認定員会細則20260611.docx",
        href: "https://docs.google.com/document/d/1tHwFhEz-oMsQsfzqIC83z8KdAEHQN0yY/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
      },
    ],
  },
  {
    id: "support-rules",
    title: "大学発スタートアップ支援細則",
    category: "細則",
    state: "design",
    status: "役割と適用範囲を再設計中",
    nextTodo:
      "認定とは切り分け、施設・設備・知財・広報など支援単位ごとの決定権と申請導線を設計する。",
    due: "2026/09/11",
    latest: {
      label: "最新版 · 2026/06/22",
      fileName: "工学院大学発ベンチャー支援細則20260622.docx",
      href: "https://docs.google.com/document/d/1bRaGWaR7vpW1cZ5xFbi26udUPbdRaj-V/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
    },
    history: [
      {
        label: "2026/06/11",
        fileName: "工学院大学発ベンチャー支援細則20260611.docx",
        href: "https://docs.google.com/document/d/1lGQ7ASemn6tZ9TQSsiNH8ihnc0vlKWew/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
      },
    ],
  },
  {
    id: "review-checksheet",
    title: "認定審査チェックシート",
    category: "運用様式",
    state: "alignment",
    status: "内規との最終整合を確認中",
    nextTodo:
      "認定の必須要件とリスク確認に絞り、事業性評価資料との役割分担を確定する。",
    due: "2026/08/21",
    latest: {
      label: "最新版 · 2026/07/17",
      fileName: "認定審査委員会_参考用_チェックシート20260717yf.docx",
      href: "https://docs.google.com/document/d/1uzD9ORkTrNxCPc68J1ovhL3j_pVqrso_/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
    },
    history: [],
  },
];

const STATE_STYLE: Record<
  DocumentState,
  { badge: string; dot: string; summary: string }
> = {
  confirming: {
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    dot: "bg-amber-500",
    summary: "決裁状況の確認",
  },
  alignment: {
    badge: "border-sky-200 bg-sky-50 text-sky-800",
    dot: "bg-sky-500",
    summary: "運用との整合",
  },
  design: {
    badge: "border-violet-200 bg-violet-50 text-violet-800",
    dot: "bg-violet-500",
    summary: "条文・役割を再設計",
  },
};

function DocumentLink({
  version,
  latest = false,
}: {
  version: DocumentVersion;
  latest?: boolean;
}) {
  return (
    <a
      href={version.href}
      target="_blank"
      rel="noreferrer"
      title={version.fileName}
      className={
        latest
          ? "group flex min-h-11 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          : "inline-flex min-h-9 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] font-medium text-slate-600 transition-colors hover:border-slate-400 hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1"
      }
    >
      <span className={latest ? "min-w-0" : "whitespace-nowrap"}>
        <span
          className={
            latest
              ? "block text-[10px] font-mono uppercase tracking-wide text-slate-500"
              : ""
          }
        >
          {version.label}
        </span>
        {latest && (
          <span className="mt-0.5 block truncate text-xs font-semibold text-slate-900">
            docxを開く
          </span>
        )}
      </span>
      <ArrowUpRight
        className={
          latest
            ? "h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-slate-900"
            : "h-3.5 w-3.5 text-slate-400"
        }
        aria-hidden="true"
      />
    </a>
  );
}

export function CockpitKuteRegulations() {
  const confirmingCount = KUTE_REGULATION_DOCUMENTS.filter(
    (document) => document.state === "confirming",
  ).length;
  const historyCount = KUTE_REGULATION_DOCUMENTS.reduce(
    (count, document) => count + document.history.length,
    0,
  );

  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      data-testid="kute-regulations-tab"
    >
      <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.12em] text-slate-500">
              <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
              KUTE governance desk
            </div>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">
              規程・内規の管理台帳
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              AMDが整備する制度文書を、今の判断地点・次に決めること・AMDの管理期限・docxの版履歴まで同じ面で追う。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <div className="text-[10px] font-mono uppercase text-amber-700">
                確認待ち
              </div>
              <div className="text-sm font-bold text-amber-950">
                {confirmingCount}本
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-[10px] font-mono uppercase text-slate-500">
                版履歴
              </div>
              <div className="text-sm font-bold text-slate-950">
                {historyCount}版
              </div>
            </div>
            <a
              href={VERSION_FOLDER_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-500 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              <FolderOpen className="h-4 w-4" aria-hidden="true" />
              版管理フォルダ
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] leading-5 text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            状態基準: 2026/08/08
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            期限はAMDの管理目標（大学の公式決裁日ではない）
          </span>
        </div>
      </div>

      <div className="hidden grid-cols-[minmax(210px,1.05fr)_minmax(190px,0.9fr)_minmax(250px,1.2fr)_minmax(138px,0.62fr)_minmax(185px,0.82fr)] border-b border-slate-200 bg-slate-50 px-5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 lg:grid">
        <div className="py-3">文書</div>
        <div className="py-3">現状</div>
        <div className="py-3">次のTODO</div>
        <div className="py-3">最終目標</div>
        <div className="py-3">最新版 / 履歴</div>
      </div>

      <ol className="divide-y divide-slate-200">
        {KUTE_REGULATION_DOCUMENTS.map((document) => {
          const state = STATE_STYLE[document.state];
          return (
            <li key={document.id} className="px-4 py-4 sm:px-5">
              <article className="grid gap-4 lg:grid-cols-[minmax(210px,1.05fr)_minmax(190px,0.9fr)_minmax(250px,1.2fr)_minmax(138px,0.62fr)_minmax(185px,0.82fr)] lg:gap-x-5">
                <div className="min-w-0">
                  <div className="text-[10px] font-mono uppercase tracking-[0.08em] text-slate-500">
                    {document.category}
                  </div>
                  <h3 className="mt-1 text-[15px] font-semibold leading-5 text-slate-950">
                    {document.title}
                  </h3>
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-medium text-slate-500 lg:hidden">
                    現状
                  </div>
                  <div
                    className={`mt-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold ${state.badge}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${state.dot}`} />
                    {state.summary}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">
                    {document.status}
                  </p>
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-medium text-slate-500 lg:hidden">
                    次のTODO
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-800">
                    {document.nextTodo}
                  </p>
                </div>
                <div>
                  <div className="text-[10px] font-medium text-slate-500 lg:hidden">
                    最終目標
                  </div>
                  <div className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold tabular-nums text-slate-950">
                    <CalendarDays
                      className="h-4 w-4 text-slate-400"
                      aria-hidden="true"
                    />
                    {document.due}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-medium text-slate-500 lg:hidden">
                    最新版 / 履歴
                  </div>
                  <div className="mt-1">
                    <DocumentLink version={document.latest} latest />
                  </div>
                  {document.history.length > 0 ? (
                    <div
                      className="mt-2 flex flex-wrap gap-1.5"
                      aria-label={`${document.title} の途中経過版`}
                    >
                      {document.history.map((version) => (
                        <DocumentLink key={version.href} version={version} />
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-500">
                      <CheckCircle2
                        className="h-3.5 w-3.5 text-slate-400"
                        aria-hidden="true"
                      />
                      保管済みの途中版なし
                    </div>
                  )}
                </div>
              </article>
            </li>
          );
        })}
      </ol>

      <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600 sm:px-5">
        docxの実体はすべてKUTE共有ドライブの版管理フォルダに保存済み。ここではメール本文や個人情報を保持せず、文書の管理状態と版リンクだけを扱う。
      </div>
    </section>
  );
}

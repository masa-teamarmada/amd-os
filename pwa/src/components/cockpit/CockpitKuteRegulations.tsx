import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  FolderOpen,
  ListChecks,
  TriangleAlert,
} from "lucide-react";

type DocumentState = "notStarted" | "confirming" | "alignment" | "design";
type FileKind = "docx" | "pdf" | "xlsx";

type DocumentVersion = {
  label: string;
  fileName: string;
  href: string;
  fileKind: FileKind;
};

type RegulationDocument = {
  id: string;
  title: string;
  category: string;
  state: DocumentState;
  status: string;
  nextTodo: string;
  due: string;
  latest?: DocumentVersion;
  references?: DocumentVersion[];
  history: DocumentVersion[];
};

const VERSION_FOLDER_URL =
  "https://drive.google.com/drive/folders/1OI6aHEt_r7Q7msQ0C7B-HTcmjQ8DQOXe";
const SOURCE_FOLDER_URL =
  "https://drive.google.com/drive/folders/1QoxGecIO9_TARwufA9_5Pd9RX94L6XwN";

const REGULATION_INVENTORY: DocumentVersion = {
  label: "規程一覧",
  fileName: "工学院大学_規程一覧_20260618.xlsx",
  href: "https://docs.google.com/spreadsheets/d/1HJ5jhYYzeJDfHL5N9351RlEbtVt5-S_W/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
  fileKind: "xlsx",
};

const CONTRACT_REGULATIONS: RegulationDocument[] = [
  {
    id: "secondment-rule",
    title: "大学発SUとの兼業規程",
    category: "契約対象 · 新設",
    state: "notStarted",
    status: "AMD素案未作成（既存規程なし）",
    nextTodo:
      "対象者・許可基準・従事時間・大学設備の扱いを定める原案を作る。",
    due: "2027/01 目途",
    references: [REGULATION_INVENTORY],
    history: [],
  },
  {
    id: "ip-license-rule",
    title: "知財取扱・大学発SUライセンス規程",
    category: "契約対象 · 既存改訂",
    state: "confirming",
    status: "現行原典・ライセンス実務の回収待ち",
    nextTodo:
      "職務発明・知財方針と、大学発SUへのライセンス条件の差分を照合する。",
    due: "2027/01 目途",
    references: [REGULATION_INVENTORY],
    history: [],
  },
  {
    id: "equity-stock-option-rule",
    title: "大学発SUへの出資・新株予約権規程",
    category: "契約対象 · 新設",
    state: "notStarted",
    status: "AMD素案未作成（既存規程なし）",
    nextTodo:
      "取得・保有・評価・会計・意思決定の原則を定める原案を作る。",
    due: "2027/01 目途",
    references: [REGULATION_INVENTORY],
    history: [],
  },
  {
    id: "joint-research-rule",
    title: "大学発SUとの共同研究規程",
    category: "契約対象 · 既存改訂",
    state: "confirming",
    status: "現行原典・契約雛形の回収待ち",
    nextTodo:
      "間接経費・知財・秘密保持・輸出管理を含む共同研究の適用範囲を整理する。",
    due: "2027/01 目途",
    references: [REGULATION_INVENTORY],
    history: [],
  },
  {
    id: "conflict-of-interest-rule",
    title: "利益相反マネジメント規程",
    category: "契約対象 · 既存改訂",
    state: "alignment",
    status: "現行規程の大学発SU対応差分を整理中",
    nextTodo:
      "兼業・株式保有・審査除外の申告と判断ルートを、認定・共同研究と整合させる。",
    due: "2027/01 目途",
    latest: {
      label: "現行原典 · 管理規程",
      fileName: "工学院大学利益相反管理規程_現行原典.pdf",
      href: "https://drive.google.com/file/d/13P_pNuchrpf0uVE4eYIbuQw18ADdDfKj/view?usp=drivesdk",
      fileKind: "pdf",
    },
    references: [
      {
        label: "現行原典 · ポリシー",
        fileName: "工学院大学利益相反マネジメントポリシー_現行原典.pdf",
        href: "https://drive.google.com/file/d/103oaDDmUxPjNjiOffTvpj0QT1zv8Mneo/view?usp=drivesdk",
        fileKind: "pdf",
      },
      REGULATION_INVENTORY,
    ],
    history: [],
  },
  {
    id: "recognition-rule",
    title: "大学発スタートアップ認定規程",
    category: "契約対象 · 新設",
    state: "confirming",
    status: "確定版を基準に、施行・様式・認定運用を確認中",
    nextTodo:
      "確定した運用、施行日、申請・認定の様式を照合し、残る差分を記録する。",
    due: "2027/01 目途",
    latest: {
      label: "最新版 · 確定版 2026/06/24",
      fileName: "大学発スタートアップ認定に関する規程_確定版_20260624.docx",
      href: "https://docs.google.com/document/d/1tmEEzxEfe3MOkYEuBH_4-zo71TTgBM3L/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
      fileKind: "docx",
    },
    history: [
      {
        label: "途中版 · 2026/06/22",
        fileName: "大学発ベンチャーの認定に関する規程_修正案_260622.docx",
        href: "https://docs.google.com/document/d/1XizS-_vBDDGY5aW364UoVdg_90br3-Oj/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
        fileKind: "docx",
      },
      {
        label: "途中版 · 2026/06/10",
        fileName: "大学発ベンチャーの認定に関する規程_修正案_260610.docx",
        href: "https://docs.google.com/document/d/1is56V6w-pHB052KgX16Uu5EYXPFQU0RM/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
        fileKind: "docx",
      },
    ],
  },
  {
    id: "shared-equipment-rule",
    title: "大学発SUの共有機器利用規程",
    category: "契約対象 · 新設",
    state: "notStarted",
    status: "AMD素案未作成（既存規程なし）",
    nextTodo:
      "対象設備・料金・安全管理・責任分界・優先利用の原案を作る。",
    due: "2027/01 目途",
    references: [REGULATION_INVENTORY],
    history: [],
  },
];

const SUPPORTING_DOCUMENTS: RegulationDocument[] = [
  {
    id: "committee-rules",
    title: "認定委員会内規",
    category: "認定運用 · 内規",
    state: "confirming",
    status: "8/7修正版を基準に、委員会の最終運用を確認中",
    nextTodo:
      "認定規程・チェックシートと突合し、委員会で確定した運用差分を反映する。",
    due: "2027/01 目途",
    latest: {
      label: "最新版 · Fixver 2026/08/07",
      fileName: "工学院大学発スタートアップ認定委員会内規_Fixver_20260807.docx",
      href: "https://docs.google.com/document/d/1kCXuwVGk5Gi68uHHQAFvjp6eB77zoUtE/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
      fileKind: "docx",
    },
    history: [
      {
        label: "途中版 · 2026/07/22",
        fileName: "工学院大学大学発ベンチャー認定員会内規20260722_yf.docx",
        href: "https://docs.google.com/document/d/1-mEVJS_lAKC-22kAPAB_O6vXctczwtJh/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
        fileKind: "docx",
      },
      {
        label: "途中版 · 2026/07/17",
        fileName: "工学院大学大学発ベンチャー認定員会内規20260717_yf.docx",
        href: "https://docs.google.com/document/d/15aKaTfE6FvaAwsnpItY2K2PC6gI4zXPU/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
        fileKind: "docx",
      },
      {
        label: "途中版 · 2026/06/22",
        fileName: "工学院大学大学発ベンチャー認定員会細則20260622.docx",
        href: "https://docs.google.com/document/d/1d7pirKz4gibJ4Zt1912mCyfn8oIcw0N0/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
        fileKind: "docx",
      },
      {
        label: "途中版 · 2026/06/11",
        fileName: "工学院大学大学発ベンチャー認定員会細則20260611.docx",
        href: "https://docs.google.com/document/d/1tHwFhEz-oMsQsfzqIC83z8KdAEHQN0yY/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
        fileKind: "docx",
      },
    ],
  },
  {
    id: "support-rules",
    title: "大学発スタートアップ支援細則",
    category: "認定運用 · 細則",
    state: "design",
    status: "役割と適用範囲を再設計中",
    nextTodo:
      "認定とは切り分け、施設・設備・知財・広報の支援単位ごとに決定権と申請導線を設計する。",
    due: "2027/01 目途",
    latest: {
      label: "最新版 · 2026/06/22",
      fileName: "工学院大学発ベンチャー支援細則20260622.docx",
      href: "https://docs.google.com/document/d/1bRaGWaR7vpW1cZ5xFbi26udUPbdRaj-V/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
      fileKind: "docx",
    },
    history: [
      {
        label: "途中版 · 2026/06/11",
        fileName: "工学院大学発ベンチャー支援細則20260611.docx",
        href: "https://docs.google.com/document/d/1lGQ7ASemn6tZ9TQSsiNH8ihnc0vlKWew/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
        fileKind: "docx",
      },
    ],
  },
  {
    id: "review-checksheet",
    title: "認定審査チェックシート",
    category: "認定運用 · 様式",
    state: "alignment",
    status: "内規との最終整合を確認中",
    nextTodo:
      "認定の必須要件とリスク確認に絞り、事業性評価資料との役割分担を確定する。",
    due: "2027/01 目途",
    latest: {
      label: "最新版 · 2026/07/17",
      fileName: "認定審査委員会_参考用_チェックシート20260717yf.docx",
      href: "https://docs.google.com/document/d/1uzD9ORkTrNxCPc68J1ovhL3j_pVqrso_/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
      fileKind: "docx",
    },
    history: [],
  },
];

const STATE_STYLE: Record<
  DocumentState,
  { badge: string; dot: string; summary: string }
> = {
  notStarted: {
    badge: "border-rose-200 bg-rose-50 text-rose-800",
    dot: "bg-rose-500",
    summary: "原案未作成",
  },
  confirming: {
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    dot: "bg-amber-500",
    summary: "原典・決裁の確認待ち",
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
  prominent = false,
}: {
  version: DocumentVersion;
  prominent?: boolean;
}) {
  const action = version.fileKind === "docx" ? "docxを開く" : "原典を開く";
  return (
    <a
      href={version.href}
      target="_blank"
      rel="noreferrer"
      title={version.fileName}
      className={
        prominent
          ? "group flex min-h-11 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          : "inline-flex min-h-9 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] font-medium text-slate-600 transition-colors hover:border-slate-400 hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1"
      }
    >
      <span className={prominent ? "min-w-0" : "whitespace-nowrap"}>
        <span
          className={
            prominent
              ? "block text-[10px] font-mono uppercase tracking-wide text-slate-500"
              : ""
          }
        >
          {version.label}
        </span>
        {prominent && (
          <span className="mt-0.5 block truncate text-xs font-semibold text-slate-900">
            {action}
          </span>
        )}
      </span>
      <ArrowUpRight
        className={
          prominent
            ? "h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-slate-900"
            : "h-3.5 w-3.5 text-slate-400"
        }
        aria-hidden="true"
      />
    </a>
  );
}

function LatestDocument({ document }: { document: RegulationDocument }) {
  if (document.latest) {
    return <DocumentLink version={document.latest} prominent />;
  }

  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wide text-rose-700">
        <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
        最新版docx
      </div>
      <div className="mt-0.5 text-xs font-semibold text-rose-950">
        AMD素案未作成
      </div>
    </div>
  );
}

function RegulationRows({ documents }: { documents: RegulationDocument[] }) {
  return (
    <ol className="divide-y divide-slate-200">
      {documents.map((document) => {
        const state = STATE_STYLE[document.state];
        const hasSupportingLinks =
          document.references && document.references.length > 0;
        return (
          <li key={document.id} className="px-4 py-4 sm:px-5">
            <article className="grid gap-4 lg:grid-cols-[minmax(210px,1.05fr)_minmax(190px,0.9fr)_minmax(250px,1.2fr)_minmax(138px,0.62fr)_minmax(205px,0.88fr)] lg:gap-x-5">
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-[0.08em] text-slate-500">
                  {document.category}
                </div>
                <h4 className="mt-1 text-[15px] font-semibold leading-5 text-slate-950">
                  {document.title}
                </h4>
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
                  完了目標
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
                  最新版 / 原典 / 履歴
                </div>
                <div className="mt-1">
                  <LatestDocument document={document} />
                </div>
                {hasSupportingLinks && (
                  <div
                    className="mt-2 flex flex-wrap gap-1.5"
                    aria-label={`${document.title} の原典`}
                  >
                    {document.references?.map((version) => (
                      <DocumentLink key={version.href} version={version} />
                    ))}
                  </div>
                )}
                {document.history.length > 0 ? (
                  <div
                    className="mt-2 flex flex-wrap gap-1.5"
                    aria-label={`${document.title} の途中経過版`}
                  >
                    {document.history.map((version) => (
                      <DocumentLink key={version.href} version={version} />
                    ))}
                  </div>
                ) : document.latest ? (
                  <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-500">
                    <CheckCircle2
                      className="h-3.5 w-3.5 text-slate-400"
                      aria-hidden="true"
                    />
                    保管済みの途中版なし
                  </div>
                ) : null}
              </div>
            </article>
          </li>
        );
      })}
    </ol>
  );
}

export function CockpitKuteRegulations() {
  const notStartedCount = CONTRACT_REGULATIONS.filter(
    (document) => document.state === "notStarted",
  ).length;
  const historyCount = [...CONTRACT_REGULATIONS, ...SUPPORTING_DOCUMENTS].reduce(
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
              契約上AMDに任された7規程を正面に置き、現状・次のTODO・完了目標・実在する最新版と版履歴を同じ面で追う。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
              <div className="text-[10px] font-mono uppercase text-rose-700">
                原案未作成
              </div>
              <div className="text-sm font-bold text-rose-950">
                {notStartedCount}本
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
            状態基準: 2026/08/09
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            期限はAMDの管理目標（大学の公式決裁日ではない）
          </span>
        </div>
      </div>

      <div className="hidden grid-cols-[minmax(210px,1.05fr)_minmax(190px,0.9fr)_minmax(250px,1.2fr)_minmax(138px,0.62fr)_minmax(205px,0.88fr)] border-b border-slate-200 bg-slate-50 px-5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 lg:grid">
        <div className="py-3">文書</div>
        <div className="py-3">現状</div>
        <div className="py-3">次のTODO</div>
        <div className="py-3">完了目標</div>
        <div className="py-3">最新版 / 原典 / 履歴</div>
      </div>

      <div className="border-b border-slate-200 bg-slate-950 px-4 py-3 text-white sm:px-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-300" aria-hidden="true" />
            <h3 className="text-sm font-bold">契約対象の7規程</h3>
          </div>
          <p className="text-xs text-slate-300">
            GTIE整備の必須範囲。原案未作成は赤で明示する。
          </p>
        </div>
      </div>
      <RegulationRows documents={CONTRACT_REGULATIONS} />

      <div className="border-y border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h3 className="text-sm font-bold text-slate-950">随伴する認定運用文書</h3>
          <p className="text-xs text-slate-500">
            7規程のうち認定規程を実装する内規・細則・様式。
          </p>
        </div>
      </div>
      <RegulationRows documents={SUPPORTING_DOCUMENTS} />

      <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600 sm:px-5">
        最新版と途中版の実体はKUTE共有ドライブの版管理フォルダに保管する。原案未作成・原典回収待ちはリンクを偽装せず、その状態のまま表示する。既存規程の原典は
        <a
          href={SOURCE_FOLDER_URL}
          target="_blank"
          rel="noreferrer"
          className="mx-1 font-semibold text-slate-800 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-800"
        >
          既存規程・原典
        </a>
        に集約する。ここではメール本文や個人情報を保持せず、文書の管理状態とDriveリンクだけを扱う。
      </div>
    </section>
  );
}

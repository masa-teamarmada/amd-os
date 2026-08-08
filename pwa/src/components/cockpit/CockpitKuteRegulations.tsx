import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CircleDotDashed,
  FileText,
  FolderOpen,
  ListChecks,
} from "lucide-react";

type FileKind = "docx" | "pdf" | "xlsx";
type RegulationStage = 0 | 1 | 2 | 3 | 4;

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
  stage: RegulationStage;
  status: string;
  nextGate: string;
  nextGateTiming: string;
  latest?: DocumentVersion;
  references?: DocumentVersion[];
  history: DocumentVersion[];
};

const VERSION_FOLDER_URL =
  "https://drive.google.com/drive/folders/1OI6aHEt_r7Q7msQ0C7B-HTcmjQ8DQOXe";
const SOURCE_FOLDER_URL =
  "https://drive.google.com/drive/folders/1QoxGecIO9_TARwufA9_5Pd9RX94L6XwN";

const STAGES = [
  "対象確定",
  "原典確認",
  "AMD原案",
  "学内調整",
  "決裁・施行",
] as const;

const REGULATION_INVENTORY: DocumentVersion = {
  label: "規程一覧",
  fileName: "工学院大学_規程一覧_20260618.xlsx",
  href: "https://docs.google.com/spreadsheets/d/1HJ5jhYYzeJDfHL5N9351RlEbtVt5-S_W/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
  fileKind: "xlsx",
};

const CONTRACT_REGULATIONS: RegulationDocument[] = [
  {
    id: "recognition-rule",
    title: "大学発スタートアップ認定規程",
    category: "新設",
    stage: 4,
    status: "確定版あり・メール審議中",
    nextGate: "メール審議の決裁結果を反映",
    nextGateTiming: "大学側日程 未確定",
    latest: {
      label: "確定版 06/24",
      fileName: "大学発スタートアップ認定に関する規程_確定版_20260624.docx",
      href: "https://docs.google.com/document/d/1tmEEzxEfe3MOkYEuBH_4-zo71TTgBM3L/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
      fileKind: "docx",
    },
    history: [
      {
        label: "06/22",
        fileName: "大学発ベンチャーの認定に関する規程_修正案_260622.docx",
        href: "https://docs.google.com/document/d/1XizS-_vBDDGY5aW364UoVdg_90br3-Oj/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
        fileKind: "docx",
      },
      {
        label: "06/10",
        fileName: "大学発ベンチャーの認定に関する規程_修正案_260610.docx",
        href: "https://docs.google.com/document/d/1is56V6w-pHB052KgX16Uu5EYXPFQU0RM/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
        fileKind: "docx",
      },
    ],
  },
  {
    id: "conflict-of-interest-rule",
    title: "利益相反マネジメント規程",
    category: "既存改訂",
    stage: 1,
    status: "現行原典を回収済み",
    nextGate: "大学発SU対応の差分を整理",
    nextGateTiming: "8月 素案",
    latest: {
      label: "現行管理規程",
      fileName: "工学院大学利益相反管理規程_現行原典.pdf",
      href: "https://drive.google.com/file/d/13P_pNuchrpf0uVE4eYIbuQw18ADdDfKj/view?usp=drivesdk",
      fileKind: "pdf",
    },
    references: [
      {
        label: "ポリシー",
        fileName: "工学院大学利益相反マネジメントポリシー_現行原典.pdf",
        href: "https://drive.google.com/file/d/103oaDDmUxPjNjiOffTvpj0QT1zv8Mneo/view?usp=drivesdk",
        fileKind: "pdf",
      },
      REGULATION_INVENTORY,
    ],
    history: [],
  },
  {
    id: "secondment-rule",
    title: "大学発SUとの兼業規程",
    category: "新設",
    stage: 0,
    status: "対象のみ確定・AMD原案なし",
    nextGate: "兼業許可と利益相反接続の原案を起案",
    nextGateTiming: "8月 素案",
    references: [REGULATION_INVENTORY],
    history: [],
  },
  {
    id: "ip-license-rule",
    title: "知財取扱・大学発SUライセンス規程",
    category: "既存改訂",
    stage: 0,
    status: "既存規程あり・原典未回収",
    nextGate: "知財規程とライセンス雛形を回収",
    nextGateTiming: "8月 素案",
    references: [REGULATION_INVENTORY],
    history: [],
  },
  {
    id: "equity-stock-option-rule",
    title: "大学発SUへの出資・新株予約権規程",
    category: "新設",
    stage: 0,
    status: "対象のみ確定・AMD原案なし",
    nextGate: "取得・評価・決裁の原案を起案",
    nextGateTiming: "8月 素案",
    references: [REGULATION_INVENTORY],
    history: [],
  },
  {
    id: "joint-research-rule",
    title: "大学発SUとの共同研究規程",
    category: "既存改訂",
    stage: 0,
    status: "既存規程あり・原典未回収",
    nextGate: "共同研究規程と契約雛形を回収",
    nextGateTiming: "8月 素案",
    references: [REGULATION_INVENTORY],
    history: [],
  },
  {
    id: "shared-equipment-rule",
    title: "大学発SUの共有機器利用規程",
    category: "新設",
    stage: 0,
    status: "対象のみ確定・AMD原案なし",
    nextGate: "設備・料金・安全・責任分界の原案を起案",
    nextGateTiming: "8月 素案",
    references: [REGULATION_INVENTORY],
    history: [],
  },
];

const SUPPORTING_DOCUMENTS: RegulationDocument[] = [
  {
    id: "committee-rules",
    title: "認定委員会内規",
    category: "認定運用",
    stage: 4,
    status: "8/7修正版あり・メール審議中",
    nextGate: "メール審議の決裁結果を反映",
    nextGateTiming: "大学側日程 未確定",
    latest: {
      label: "Fixver 08/07",
      fileName: "工学院大学発スタートアップ認定委員会内規_Fixver_20260807.docx",
      href: "https://docs.google.com/document/d/1kCXuwVGk5Gi68uHHQAFvjp6eB77zoUtE/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
      fileKind: "docx",
    },
    history: [
      {
        label: "07/22",
        fileName: "工学院大学大学発ベンチャー認定員会内規20260722_yf.docx",
        href: "https://docs.google.com/document/d/1-mEVJS_lAKC-22kAPAB_O6vXctczwtJh/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
        fileKind: "docx",
      },
      {
        label: "07/17",
        fileName: "工学院大学大学発ベンチャー認定員会内規20260717_yf.docx",
        href: "https://docs.google.com/document/d/15aKaTfE6FvaAwsnpItY2K2PC6gI4zXPU/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
        fileKind: "docx",
      },
      {
        label: "06/22",
        fileName: "工学院大学大学発ベンチャー認定員会細則20260622.docx",
        href: "https://docs.google.com/document/d/1d7pirKz4gibJ4Zt1912mCyfn8oIcw0N0/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
        fileKind: "docx",
      },
      {
        label: "06/11",
        fileName: "工学院大学大学発ベンチャー認定員会細則20260611.docx",
        href: "https://docs.google.com/document/d/1tHwFhEz-oMsQsfzqIC83z8KdAEHQN0yY/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
        fileKind: "docx",
      },
    ],
  },
  {
    id: "review-checksheet",
    title: "認定審査チェックシート",
    category: "認定運用",
    stage: 3,
    status: "7/17版あり・内規との最終整合",
    nextGate: "内規決裁を反映して確定",
    nextGateTiming: "9/4 修正案・進捗確認",
    latest: {
      label: "07/17",
      fileName: "認定審査委員会_参考用_チェックシート20260717yf.docx",
      href: "https://docs.google.com/document/d/1uzD9ORkTrNxCPc68J1ovhL3j_pVqrso_/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
      fileKind: "docx",
    },
    history: [],
  },
  {
    id: "support-rules",
    title: "大学発スタートアップ支援細則",
    category: "認定運用",
    stage: 2,
    status: "6/22案あり・適用範囲を再設計中",
    nextGate: "認定規程との役割分担を確定",
    nextGateTiming: "9/4 修正案・進捗確認",
    latest: {
      label: "06/22",
      fileName: "工学院大学発ベンチャー支援細則20260622.docx",
      href: "https://docs.google.com/document/d/1bRaGWaR7vpW1cZ5xFbi26udUPbdRaj-V/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
      fileKind: "docx",
    },
    history: [
      {
        label: "06/11",
        fileName: "工学院大学発ベンチャー支援細則20260611.docx",
        href: "https://docs.google.com/document/d/1lGQ7ASemn6tZ9TQSsiNH8ihnc0vlKWew/edit?usp=drivesdk&ouid=117293184618440491452&rtpof=true&sd=true",
        fileKind: "docx",
      },
    ],
  },
];

function StageMeter({ stage }: { stage: RegulationStage }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        className={`w-9 shrink-0 font-mono text-[11px] font-semibold tabular-nums ${
          stage === 0 ? "text-rose-700" : "text-[#027FDC]"
        }`}
      >
        {stage}/4
      </span>
      <div className="grid min-w-0 flex-1 grid-cols-4 gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={`h-1.5 rounded-sm ${
              step <= stage
                ? "bg-[#027FDC]"
                : stage === 0 && step === 1
                  ? "bg-rose-300"
                  : "bg-slate-200"
            }`}
          />
        ))}
      </div>
      <span className="w-[66px] shrink-0 text-right text-[10px] font-medium text-slate-600">
        {STAGES[stage]}
      </span>
    </div>
  );
}

function DocumentLink({ version }: { version: DocumentVersion }) {
  const kindLabel = version.fileKind === "docx" ? "DOCX" : version.fileKind.toUpperCase();
  return (
    <a
      href={version.href}
      target="_blank"
      rel="noreferrer"
      title={version.fileName}
      className="inline-flex h-6 items-center gap-1 border border-slate-200 bg-white px-1.5 font-mono text-[10px] text-slate-600 transition-colors hover:border-[#027FDC] hover:text-[#0269b5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#027FDC] focus-visible:ring-offset-1"
    >
      {kindLabel} {version.label}
      <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
    </a>
  );
}

function DocumentReferences({ document }: { document: RegulationDocument }) {
  const hasSources = document.references && document.references.length > 0;
  if (!document.latest && !hasSources) {
    return <span className="font-mono text-[10px] text-rose-700">原案・原典なし</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {document.latest && <DocumentLink version={document.latest} />}
      {document.references?.map((version) => (
        <DocumentLink key={version.href} version={version} />
      ))}
      {document.history.length > 0 && (
        <span
          className="inline-flex h-6 items-center border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] text-slate-500"
          title={`${document.title} の途中経過版 ${document.history.map((version) => version.label).join(" / ")}`}
        >
          履歴 {document.history.length}版
        </span>
      )}
    </div>
  );
}

function RegulationRows({ documents }: { documents: RegulationDocument[] }) {
  return (
    <ol className="divide-y divide-slate-200">
      {documents.map((document) => (
        <li key={document.id} className="px-3 py-2.5 sm:px-4">
          <article className="grid gap-x-4 gap-y-2 lg:grid-cols-[minmax(210px,1.05fr)_minmax(182px,0.9fr)_minmax(210px,1fr)_minmax(170px,0.82fr)_minmax(180px,0.9fr)] lg:items-center">
            <div className="min-w-0">
              <div className="font-mono text-[9px] tracking-[0.08em] text-slate-400">
                {document.category}
              </div>
              <h4 className="mt-0.5 text-[13px] font-semibold leading-5 text-slate-950">
                {document.title}
              </h4>
            </div>
            <div className="min-w-0">
              <div className="text-[9px] font-medium text-slate-400 lg:hidden">進捗</div>
              <StageMeter stage={document.stage} />
              <p className="mt-1 text-[11px] leading-4 text-slate-600">{document.status}</p>
            </div>
            <div className="min-w-0">
              <div className="text-[9px] font-medium text-slate-400 lg:hidden">次ゲート</div>
              <p className="text-[12px] leading-5 text-slate-800">{document.nextGate}</p>
            </div>
            <div className="min-w-0">
              <div className="text-[9px] font-medium text-slate-400 lg:hidden">期限</div>
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-medium text-slate-700">
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                {document.nextGateTiming}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-[9px] font-medium text-slate-400 lg:hidden">資料</div>
              <DocumentReferences document={document} />
            </div>
          </article>
        </li>
      ))}
    </ol>
  );
}

function SectionHeader({
  title,
  meta,
  dark = false,
}: {
  title: string;
  meta: string;
  dark?: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-y px-3 py-2 sm:px-4 ${
        dark
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-200 bg-slate-50 text-slate-950"
      }`}
    >
      <h3 className="text-[12px] font-semibold">{title}</h3>
      <span className={`font-mono text-[10px] ${dark ? "text-slate-300" : "text-slate-500"}`}>
        {meta}
      </span>
    </div>
  );
}

export function CockpitKuteRegulations() {
  const allDocuments = [...CONTRACT_REGULATIONS, ...SUPPORTING_DOCUMENTS];
  const stageCounts = [0, 1, 2, 3, 4].map(
    (stage) => allDocuments.filter((document) => document.stage === stage).length,
  );

  return (
    <section
      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
      data-testid="kute-regulations-tab"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <ListChecks className="h-4 w-4 shrink-0 text-[#027FDC]" aria-hidden="true" />
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-950">規程・内規</h2>
          <span className="font-mono text-[10px] text-slate-500">契約対象 7 / 運用文書 3</span>
        </div>
        <a
          href={VERSION_FOLDER_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-7 items-center gap-1.5 border border-slate-200 px-2 font-mono text-[10px] font-medium text-slate-600 transition-colors hover:border-[#027FDC] hover:text-[#0269b5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#027FDC] focus-visible:ring-offset-1"
        >
          <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
          版管理
          <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
        </a>
      </div>

      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 sm:px-4">
        <div className="grid grid-cols-5 gap-1.5 font-mono text-[9px] sm:gap-2">
          {STAGES.map((label, index) => (
            <div key={label} className="min-w-0">
              <div className="flex items-baseline justify-between gap-1 text-slate-500">
                <span className="truncate">S{index} {label}</span>
                <span
                  className={`shrink-0 font-semibold ${
                    index === 0 && stageCounts[index] > 0
                      ? "text-rose-700"
                      : index >= 3 && stageCounts[index] > 0
                        ? "text-[#027FDC]"
                        : "text-slate-700"
                  }`}
                >
                  {stageCounts[index]}
                </span>
              </div>
              <div className="mt-1 h-1 bg-slate-200">
                <div
                  className={`h-full ${
                    index === 0 ? "bg-rose-400" : index >= 3 ? "bg-[#027FDC]" : "bg-slate-500"
                  }`}
                  style={{ width: `${Math.min(stageCounts[index] * 33.33, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-slate-600">
          <span><strong className="font-semibold text-slate-900">8月</strong> 残り6規程の素案</span>
          <span><strong className="font-semibold text-slate-900">9/4</strong> 修正案・進捗確認</span>
          <span><strong className="font-semibold text-slate-900">9〜11月</strong> 学内議論・修正</span>
          <span><strong className="font-semibold text-slate-900">1月</strong> 施行版・様式・運用フロー</span>
        </div>
      </div>

      <div className="hidden grid-cols-[minmax(210px,1.05fr)_minmax(182px,0.9fr)_minmax(210px,1fr)_minmax(170px,0.82fr)_minmax(180px,0.9fr)] gap-x-4 border-b border-slate-200 bg-white px-4 py-1.5 font-mono text-[9px] text-slate-400 lg:grid">
        <div>規程</div>
        <div>進捗 / 現状</div>
        <div>次ゲート</div>
        <div>期限</div>
        <div>資料</div>
      </div>

      <SectionHeader title="契約対象の7規程" meta="進捗順" dark />
      <RegulationRows documents={CONTRACT_REGULATIONS} />

      <SectionHeader title="随伴する認定運用文書" meta="認定規程を実装する文書" />
      <RegulationRows documents={SUPPORTING_DOCUMENTS} />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[10px] text-slate-500 sm:px-4">
        <span className="inline-flex items-center gap-1">
          <CircleDotDashed className="h-3.5 w-3.5" aria-hidden="true" />
          S0は対象だけ確定、S4は決裁・施行待ち
        </span>
        <a
          href={SOURCE_FOLDER_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-slate-700 hover:text-[#0269b5]"
        >
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          既存規程・原典
          <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
        </a>
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          メール本文・個人情報は表示しない
        </span>
      </div>
    </section>
  );
}

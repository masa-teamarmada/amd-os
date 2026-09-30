import { MarkdownView } from "@/components/cockpit/MarkdownView";
import { ConditionBlock, MatrixBlock, MatrixSheet, RecordBlock } from "@/components/cockpit/tech-blocks";
import { CockpitFundingPlan } from "@/components/cockpit/CockpitFundingPlan";
import { readTechPresentation } from "@/lib/project-tech";
import {
  formatDdBytes,
  formatDdMillion,
  formatDdPercent,
  formatDdShares,
} from "@/lib/dd-format";
import type {
  DdCapitalPolicyPayload,
  DdCostModelPayload,
  DdDocumentPayload,
  DdFundingPlanPayload,
  DdTechTopicPayload,
} from "@/lib/dd-payload";

// DDの公開版 payload を種類ごとに描く。受け取るのは公開版（または管理者の下書きプレビュー）の payload だけで、
// 元データの取得・編集操作は持たない。

export function DdDocumentBody({
  payload,
  fileHref,
  canDownload,
  previewNote,
}: {
  payload: DdDocumentPayload;
  fileHref: string | null;
  canDownload: boolean;
  previewNote?: string;
}) {
  const viewLabel = payload.preview === "html" ? "HTMLを別タブで開く" : payload.preview === "pdf" ? "PDFを別タブで開く" : null;
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-1 text-[12.5px]">
        <dt className="text-[#6e6e73]">ファイル名</dt>
        <dd className="break-all text-[#1d1d1f]">{payload.fileName}</dd>
        <dt className="text-[#6e6e73]">形式・サイズ</dt>
        <dd className="text-[#1d1d1f]">
          {payload.mimeType}・{formatDdBytes(payload.sizeBytes)}
        </dd>
      </dl>
      {fileHref ? (
        <div className="flex flex-wrap gap-2">
          {viewLabel && (
            <a
              href={fileHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-9 items-center rounded-md border border-[#027FDC] bg-[#027FDC] px-3 text-[12.5px] font-semibold text-white hover:bg-[#0267b2]"
            >
              {viewLabel}
            </a>
          )}
          {canDownload ? (
            <a
              href={`${fileHref}?download=1`}
              className="inline-flex min-h-9 items-center rounded-md border border-[#d2d2d7] bg-white px-3 text-[12.5px] font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7]"
            >
              ダウンロード
            </a>
          ) : (
            <span className="inline-flex min-h-9 items-center text-[12px] text-[#6e6e73]">ダウンロードの権限は付与されていない</span>
          )}
        </div>
      ) : (
        <p className="text-[12px] text-[#6e6e73]">{previewNote ?? "公開すると、ここから開ける。"}</p>
      )}
      {payload.preview === "image" && fileHref && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fileHref} alt={payload.fileName} className="max-h-[70vh] max-w-full rounded border border-[#e5e5e7]" />
      )}
    </div>
  );
}

export function DdTechTopicBody({ payload }: { payload: DdTechTopicPayload }) {
  const { topic, entries } = payload;
  const presentation = topic.blockKind === "matrix" ? readTechPresentation(topic.presentation) : null;
  if (presentation) {
    return (
      <div className="space-y-3">
        <MatrixSheet entries={entries} presentation={presentation} />
        {topic.bodyMd && (
          <div className="border-l-2 border-[#e5e5e7] pl-3">
            <p className="mb-1 text-[11px] font-semibold text-[#6e6e73]">表の補足</p>
            <MarkdownView source={topic.bodyMd} />
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {topic.bodyMd && (
        <div className="border-l-2 border-[#e5e5e7] pl-3">
          <MarkdownView source={topic.bodyMd} />
        </div>
      )}
      {topic.blockKind === "condition" && <ConditionBlock entries={entries} />}
      {topic.blockKind === "matrix" && <MatrixBlock entries={entries} />}
      {topic.blockKind === "record" && <RecordBlock entries={entries} />}
    </div>
  );
}

export function DdFundingPlanBody({ payload }: { payload: DdFundingPlanPayload }) {
  return <CockpitFundingPlan plan={payload.plan} />;
}

const EVENT_TYPE_LABEL: Record<string, string> = {
  incorporation: "設立",
  equity_issue: "株式発行",
  option_pool: "ストックオプション枠",
  convertible_issue: "転換型の資金調達",
  convertible_conversion: "転換",
  secondary: "株式の譲渡",
  share_split: "株式分割",
  ipo: "上場",
};

const HOLDER_KIND_LABEL: Record<string, string> = {
  founder: "創業者",
  employee: "役職員",
  investor: "投資家",
  esop_pool: "SO枠",
  advisor: "アドバイザー",
  other: "その他",
};

export function DdCapitalPolicyBody({ payload }: { payload: DdCapitalPolicyPayload }) {
  const standingByEvent = new Map(payload.standings.map((standing) => [standing.eventId, standing]));
  return (
    <div className="space-y-4">
      <p className="text-[12.5px] leading-6 text-[#424245]">
        {payload.planName}。{payload.basis === "frozen"
          ? `凍結済みの提出版 v${payload.frozenVersion} から作成。`
          : `作業中の案（第${payload.planRevision}版）を公開時点で固定したもの。`}
        持株比率は完全希薄化後（新株予約権・転換前の証券を含む）。
      </p>
      <div className="overflow-x-auto rounded-lg border border-[#e5e5e7]">
        <table className="w-full min-w-[720px] border-collapse text-[12px]">
          <thead>
            <tr className="bg-[#f5f5f7] text-left text-[11px] text-[#6e6e73]">
              <th className="sticky left-0 z-10 bg-[#f5f5f7] px-2 py-2 font-medium">ラウンド</th>
              <th className="px-2 py-2 font-medium">時期</th>
              <th className="px-2 py-2 font-medium">状態</th>
              <th className="px-2 py-2 text-right font-medium">新規調達（百万円）</th>
              <th className="px-2 py-2 text-right font-medium">プレマネー（百万円）</th>
              <th className="px-2 py-2 text-right font-medium">転換上限キャップ（百万円）</th>
              <th className="px-2 py-2 text-right font-medium">割引</th>
              <th className="px-2 py-2 text-right font-medium">完全希薄化後株式数</th>
            </tr>
          </thead>
          <tbody>
            {payload.events.map((event) => {
              const standing = standingByEvent.get(event.id);
              const undecided = event.allocationCount === 0 && event.type !== "incorporation";
              return (
                <tr key={event.id} className="border-t border-[#f0f0f2] align-top">
                  <th scope="row" className="sticky left-0 z-10 bg-white px-2 py-2 text-left font-semibold text-[#1d1d1f]">
                    {event.label}
                    <span className="block text-[10.5px] font-normal text-[#6e6e73]">{EVENT_TYPE_LABEL[event.type] ?? event.type}</span>
                  </th>
                  <td className="px-2 py-2 text-[#424245]">{event.date ?? "未定"}</td>
                  <td className="px-2 py-2 text-[#424245]">{undecided ? "未定" : event.status === "planned" ? "計画" : "実行済み"}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{undecided ? "未定" : event.primaryRaise ? formatDdMillion(event.primaryRaise) : "—"}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{event.preMoneyValuation ? formatDdMillion(event.preMoneyValuation) : "—"}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{event.conversionCap ? formatDdMillion(event.conversionCap) : "—"}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{event.conversionDiscount ? formatDdPercent(event.conversionDiscount, 0) : "—"}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{standing ? formatDdShares(standing.totalFullyDilutedShares) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="mb-1.5 text-[13px] font-semibold text-[#1d1d1f]">株主ごとの持株比率（完全希薄化後）</h3>
        <div className="overflow-x-auto rounded-lg border border-[#e5e5e7]">
          <table className="w-full min-w-[640px] border-collapse text-[12px]">
            <thead>
              <tr className="bg-[#f5f5f7] text-left text-[11px] text-[#6e6e73]">
                <th className="sticky left-0 z-10 bg-[#f5f5f7] px-2 py-2 font-medium">株主</th>
                {payload.events.map((event) => (
                  <th key={event.id} className="px-2 py-2 text-right font-medium">{event.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payload.holders.map((holder) => (
                <tr key={holder.id} className="border-t border-[#f0f0f2]">
                  <th scope="row" className="sticky left-0 z-10 bg-white px-2 py-1.5 text-left font-medium text-[#1d1d1f]">
                    {holder.name}
                    <span className="ml-1 text-[10.5px] font-normal text-[#6e6e73]">{HOLDER_KIND_LABEL[holder.kind] ?? holder.kind}</span>
                  </th>
                  {payload.events.map((event) => {
                    const row = standingByEvent.get(event.id)?.holders.find((item) => item.holderId === holder.id);
                    return (
                      <td key={event.id} className="px-2 py-1.5 text-right tabular-nums text-[#424245]">
                        {row && row.fullyDilutedShares !== 0 ? (
                          <>
                            {formatDdPercent(row.fullyDilutedPercentage)}
                            <span className="block text-[10.5px] text-[#86868b]">{formatDdShares(row.fullyDilutedShares)}株</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function DdCostModelBody({ payload }: { payload: DdCostModelPayload }) {
  const unit = payload.model.unitBasisLabel || "単位";
  return (
    <div className="space-y-5">
      <p className="text-[12.5px] leading-6 text-[#424245]">
        {payload.model.caseLabel}
        {payload.model.versionLabel ? `（${payload.model.versionLabel}）` : ""}。金額は処理1{unit}あたりの円。明細・単価は掲載せず、計算結果の集計だけを示す。
      </p>
      {payload.model.systemScopeMd && (
        <div className="border-l-2 border-[#e5e5e7] pl-3">
          <p className="mb-1 text-[11px] font-semibold text-[#6e6e73]">想定している系</p>
          <MarkdownView source={payload.model.systemScopeMd} />
        </div>
      )}
      {payload.strains.map((strain) => (
        <section key={strain.strainLabel} className="space-y-2">
          <h3 className="text-[13px] font-semibold text-[#1d1d1f]">{strain.strainLabel}</h3>
          <p className="text-[12px] text-[#424245]">
            菌体1kgあたりの原価：
            {strain.biomass
              .map((row) => `${row.applicationLabel} ${Math.round(row.perKg).toLocaleString("ja-JP")}円/kg`)
              .join("・")}
          </p>
          <div className="overflow-x-auto rounded-lg border border-[#e5e5e7]">
            <table className="w-full min-w-[760px] border-collapse text-[12px]">
              <thead>
                <tr className="bg-[#f5f5f7] text-left text-[11px] text-[#6e6e73]">
                  <th className="sticky left-0 z-10 bg-[#f5f5f7] px-2 py-2 font-medium">方式</th>
                  <th className="px-2 py-2 text-right font-medium">総コスト</th>
                  <th className="px-2 py-2 text-right font-medium">売価</th>
                  <th className="px-2 py-2 text-right font-medium">差（1{unit}あたり）</th>
                  {strain.scenarios[0]?.breakdown.map((slice) => (
                    <th key={slice.label} className="px-2 py-2 text-right font-medium">{slice.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {strain.scenarios.map((scenario) => (
                  <tr key={`${scenario.applicationLabel}-${scenario.label}`} className="border-t border-[#f0f0f2]">
                    <th scope="row" className="sticky left-0 z-10 bg-white px-2 py-1.5 text-left font-medium text-[#1d1d1f]">
                      {scenario.applicationLabel}・{scenario.label}
                    </th>
                    <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{scenario.totalPerUnit.toLocaleString("ja-JP", { maximumFractionDigits: 1 })}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{scenario.salePricePerUnit.toLocaleString("ja-JP", { maximumFractionDigits: 1 })}</td>
                    <td className={`px-2 py-1.5 text-right tabular-nums ${scenario.profitPerUnit < 0 ? "text-[#b71c1c]" : "text-[#1d1d1f]"}`}>
                      {scenario.profitPerUnit.toLocaleString("ja-JP", { maximumFractionDigits: 1 })}
                    </td>
                    {scenario.breakdown.map((slice) => (
                      <td key={slice.label} className="px-2 py-1.5 text-right tabular-nums text-[#424245]">
                        {slice.perUnit.toLocaleString("ja-JP", { maximumFractionDigits: 1 })}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {payload.keyAssumptions.length > 0 && (
        <section>
          <h3 className="mb-1.5 text-[13px] font-semibold text-[#1d1d1f]">主要な前提</h3>
          <div className="overflow-x-auto rounded-lg border border-[#e5e5e7]">
            <table className="w-full min-w-[520px] border-collapse text-[12px]">
              <tbody>
                {payload.keyAssumptions.map((assumption) => (
                  <tr key={`${assumption.groupLabel}-${assumption.label}`} className="border-t border-[#f0f0f2] first:border-t-0">
                    <th scope="row" className="w-[40%] px-2 py-1.5 text-left font-medium text-[#1d1d1f]">
                      {assumption.label}
                      <span className="block text-[10.5px] font-normal text-[#86868b]">{assumption.groupLabel}</span>
                    </th>
                    <td className="px-2 py-1.5 tabular-nums text-[#424245]">{assumption.value}</td>
                    <td className="w-[80px] px-2 py-1.5 text-[#6e6e73]">{assumption.confidence ? `確度 ${assumption.confidence}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {payload.caveats.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-[13px] font-semibold text-[#1d1d1f]">試算の注意書き</h3>
          {payload.caveats.map((caveat) => (
            <div key={caveat.title} className="border-l-2 border-[#e5e5e7] pl-3">
              <p className="text-[12px] font-semibold text-[#424245]">{caveat.title}</p>
              {caveat.bodyMd && <MarkdownView source={caveat.bodyMd} />}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

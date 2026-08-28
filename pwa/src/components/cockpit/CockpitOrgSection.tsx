"use client";

/**
 * PJコックピット「スコア詳細」タブの《組織》セクション。
 *
 * まさ 2026-08-28「SXの経営ハイライトに、杉浦先生の対人の壁の話が書かれちゃってる。
 * これどうみても経営ハイライトじゃなくない？ …一方で、こういう情報はSPSのスコアリングに
 * 必須なので、スコア詳細タブの中に『組織』のコーナーを作って、そこにこういう情報を
 * 入れておこうよ。メンバーリスト（SU設立後なら組織図）とあわせて。」
 *
 * 3ブロック。
 *   1. 担い手の機能  — 経営チームの八機能が誰かに担われているか。スコアに直接効く
 *   2. 人・組織の観測 — 機能の充足を判定した元の事実。良い観測も悪い観測も同じ棚
 *   3. 人の一覧      — いま3つのテーブルに散らばっている名前を束ねたもの
 *
 * **機能の名前・説明・判定条件をこのファイルに書かない。** 正本（モデル台帳 §6.B）から
 * API 経由で降りてくる。正本の表が見つからなければ 1 は丸ごと出ない。
 *
 * 外部ワークスペースからは開けない（member 限定の API を読む）。
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadProjectOrg, peekProjectOrg } from "@/lib/project-org-client";
import {
  MEMBER_GROUP_LABEL,
  MEMBER_STATUS_LABEL,
  type OrgFunctionRow,
  type OrgMember,
  type OrgRoleSlot,
  type ProjectOrgPayload,
} from "@/lib/project-org-model";
import {
  FUNCTION_STATE_LABEL,
  OBSERVATION_KIND_LABEL,
  SOURCE_TAG_LABEL,
  type FunctionState,
  type OrgObservation,
} from "@/lib/bzm30/team-fulfillment";

const STATE_STYLE: Record<FunctionState, string> = {
  fulfilled: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  provisional: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  vacant: "border-border bg-muted text-muted-foreground",
  unrecorded: "border-dashed border-border bg-transparent text-muted-foreground",
};

const DIRECTION_STYLE: Record<OrgObservation["direction"], string> = {
  positive: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  negative: "border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-200",
  neutral: "border-border bg-muted text-muted-foreground",
};

const DIRECTION_LABEL: Record<OrgObservation["direction"], string> = {
  positive: "追い風",
  negative: "重し",
  neutral: "観測",
};

/** 表は自分の中だけで横スクロールさせる（ページ本体を横に広げない。spec 4-8 §6）。 */
function TableScroll({ children }: { children: React.ReactNode }) {
  return <div className="w-0 min-w-full overflow-x-auto">{children}</div>;
}

function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] ${className}`}>
      {children}
    </span>
  );
}

export function CockpitOrgSection({ projectId, active = true }: { projectId: string; active?: boolean }) {
  const [payload, setPayload] = useState<ProjectOrgPayload | null>(() => peekProjectOrg(projectId) ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    loadProjectOrg(projectId)
      .then((next) => {
        if (cancelled) return;
        if (next) setPayload(next);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [active, projectId]);

  if (failed && !payload) {
    return (
      <section className="min-w-0 rounded border border-red-500/40 bg-red-500/5 px-3 py-3 text-[11px] text-red-800 dark:text-red-200">
        組織の情報を読めなかった。
      </section>
    );
  }
  if (!payload) {
    return (
      <section className="min-w-0 rounded border border-border bg-muted/20 px-3 py-3 text-[10px] text-muted-foreground">
        組織を読み込み中…
      </section>
    );
  }

  return (
    <section className="min-w-0 space-y-2 rounded border border-border bg-muted/20 p-3">
      <header className="min-w-0">
        <h3 className="text-[12px] font-semibold">組織</h3>
        <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
          経営チームが持つべき機能が、いま誰かの責任になっているか。空いている機能は減点ではなく
          <strong className="font-medium">工程の遅れ</strong>としてスコアに入り、
          対外説明の機能は「その機能が埋まる見込み」としても効く。定義は
          <Link href="/model/MODEL_VERSION_LEDGER" className="ml-1 text-indigo-600 underline hover:opacity-80">
            モデル台帳 §6.B
          </Link>
          。判定の基準日は {payload.asOf}。
        </p>
      </header>

      <TeamFunctionBlock functions={payload.functions} thinRecord={payload.thinRecord} />
      <ObservationBlock observations={payload.observations} functions={payload.functions} />
      <PeopleBlock members={payload.members} roleSlots={payload.roleSlots} />
    </section>
  );
}

/** 1. 担い手の機能。正本の八機能 × この PJ の判定。 */
function TeamFunctionBlock({ functions, thinRecord }: { functions: OrgFunctionRow[]; thinRecord: boolean }) {
  if (functions.length === 0) {
    return (
      <div className="rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[10px] leading-relaxed text-amber-800 dark:text-amber-200">
        機能の一覧をモデル正本から読めなかったので、この表は出していない。
        正本側の見出しか表の形が変わった可能性がある（画面が古い機能の一覧を持ち続けないための挙動）。
      </div>
    );
  }

  return (
    <div className="min-w-0 rounded border border-border bg-background/60 p-2">
      <h4 className="mb-1 text-[11px] font-semibold">担い手の機能</h4>
      {thinRecord ? (
        <p className="mb-1.5 rounded border border-border bg-muted/40 px-2 py-1.5 text-[10px] leading-relaxed text-muted-foreground">
          <strong className="font-medium">記録薄</strong>——直近6か月に積まれた人・組織の記録が1件以下なので、
          空席かどうかを判定していない。ここが「未記帳」なのは、その機能を誰も担っていないという意味ではなく、
          <strong className="font-medium">記録がまだ無い</strong>という意味。
          実際の会議・意思決定・対外説明を下の観測へ積むと、この列が埋まる。
        </p>
      ) : null}
      <TableScroll>
        <table className="w-full min-w-[760px] border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-border text-left text-[10px] text-muted-foreground">
              <th className="w-[16%] px-2 py-1 font-medium">機能</th>
              <th className="w-[9%] px-2 py-1 font-medium">状態</th>
              <th className="w-[13%] px-2 py-1 font-medium">担い手</th>
              <th className="w-[26%] px-2 py-1 font-medium">直近の実働</th>
              <th className="w-[18%] px-2 py-1 font-medium">判定の理由</th>
              <th className="w-[18%] px-2 py-1 font-medium">空席の埋まり方</th>
            </tr>
          </thead>
          <tbody>
            {functions.map((fn) => {
              const j = fn.judgement;
              return (
                <tr key={fn.no} className="border-b border-border/40 align-top">
                  <td className="px-2 py-1.5">
                    <div className="font-medium">
                      {fn.no}. {fn.name}
                    </div>
                    <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{fn.summary}</div>
                  </td>
                  <td className="px-2 py-1.5">
                    {fn.placeholder ? (
                      <span className="text-[10px] text-muted-foreground">まだ機能ではない</span>
                    ) : (
                      <>
                        <Chip className={STATE_STYLE[j.state]}>{FUNCTION_STATE_LABEL[j.state]}</Chip>
                        {fn.movable && fn.movable !== "—" ? (
                          <div className="mt-1 text-[10px] text-muted-foreground">{fn.movable}</div>
                        ) : null}
                      </>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {j.holders.length > 0 ? (
                      j.holders.join("・")
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {fn.placeholder ? (
                      <span className="text-muted-foreground">—</span>
                    ) : j.evidence.length === 0 && j.concerns.length === 0 ? (
                      <span className="text-muted-foreground">記録なし</span>
                    ) : (
                      <ul className="space-y-1">
                        {j.evidence.slice(0, 2).map((o) => (
                          <li key={o.id} className="leading-snug">
                            <span className="text-[10px] text-muted-foreground">{o.observedOn}</span> {o.headline}
                          </li>
                        ))}
                        {j.concerns.map((o) => (
                          <li key={o.id} className="leading-snug text-red-800 dark:text-red-200">
                            <span className="text-[10px] opacity-70">{o.observedOn}・重し</span> {o.headline}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-2 py-1.5 leading-snug text-muted-foreground">
                    {fn.placeholder ? "—" : j.reason}
                  </td>
                  <td className="px-2 py-1.5 leading-snug text-muted-foreground">{fn.fillPath}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableScroll>
      <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
        充足になるのは、直近12か月に3か月以上あけた2時点以上の実働の記録があるときだけ。
        対外説明の機能は相手方の記録か第三者の証言が要る。肩書や本人のやる気は根拠にしない。
        <strong className="font-medium">「重し」の観測は充足へ数えていない</strong>——
        実働があっても逆効果なら機能が埋まったとは言えないため。数値への効かせ方はモデル側で検討中。
      </p>
    </div>
  );
}

/** 2. 人・組織の観測ログ。機能の判定の元になった事実そのもの。 */
function ObservationBlock({
  observations,
  functions,
}: {
  observations: OrgObservation[];
  functions: OrgFunctionRow[];
}) {
  const nameOf = (no: number | null) => (no ? (functions.find((f) => f.no === no)?.name ?? `機能${no}`) : "—");

  return (
    <div className="min-w-0 rounded border border-border bg-background/60 p-2">
      <h4 className="mb-1 text-[11px] font-semibold">人・組織の観測</h4>
      {observations.length === 0 ? (
        <p className="px-1 py-2 text-[10px] leading-relaxed text-muted-foreground">
          まだ1件も入っていない。人の着任・退任・実働、異動や定年、研究室や組織の体制変化がここに1件1行で積まれ、
          上の機能の充足はこの行から機械的に判定される。
        </p>
      ) : (
        <TableScroll>
          <table className="w-full min-w-[820px] border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-border text-left text-[10px] text-muted-foreground">
                <th className="w-[8%] px-2 py-1 font-medium">日付</th>
                <th className="w-[10%] px-2 py-1 font-medium">種類</th>
                <th className="w-[9%] px-2 py-1 font-medium">誰</th>
                <th className="w-[13%] px-2 py-1 font-medium">効く機能</th>
                <th className="w-[34%] px-2 py-1 font-medium">何が起きたか</th>
                <th className="w-[9%] px-2 py-1 font-medium">出所</th>
                <th className="w-[17%] px-2 py-1 font-medium">効き先</th>
              </tr>
            </thead>
            <tbody>
              {observations.map((o) => (
                <tr key={o.id} className="border-b border-border/40 align-top">
                  <td className="whitespace-nowrap px-2 py-1.5 text-[10px] text-muted-foreground">{o.observedOn}</td>
                  <td className="px-2 py-1.5">
                    <Chip className={DIRECTION_STYLE[o.direction]}>{DIRECTION_LABEL[o.direction]}</Chip>
                    <div className="mt-1 text-[10px] leading-snug text-muted-foreground">
                      {OBSERVATION_KIND_LABEL[o.kind]}
                    </div>
                  </td>
                  <td className="px-2 py-1.5">{o.personName ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-2 py-1.5 leading-snug text-muted-foreground">{nameOf(o.functionNo)}</td>
                  <td className="px-2 py-1.5 leading-snug">
                    <div>{o.headline}</div>
                    {o.detail ? (
                      <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{o.detail}</div>
                    ) : null}
                  </td>
                  <td className="px-2 py-1.5 text-[10px] leading-snug text-muted-foreground">
                    {SOURCE_TAG_LABEL[o.sourceTag]}
                    {o.sourceRef ? <div className="mt-0.5">{o.sourceRef}</div> : null}
                  </td>
                  <td className="px-2 py-1.5 leading-snug text-muted-foreground">{o.effect ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
    </div>
  );
}

/**
 * 3. 人の一覧。
 *
 * 会社設立後は登記上の役員と部門で組織図に切り替える予定だが、その元になるデータ
 *（役員の登記・部門・指揮系統）をまだどこにも持っていないので、いまは全 PJ で同じ一覧を出す。
 */
function PeopleBlock({ members, roleSlots }: { members: OrgMember[]; roleSlots: OrgRoleSlot[] }) {
  const [showInactive, setShowInactive] = useState(false);
  const live = members.filter((m) => m.status !== "inactive");
  const past = members.filter((m) => m.status === "inactive");
  const shown = showInactive ? [...live, ...past] : live;
  const openSlots = roleSlots.filter((s) => s.vacant);

  return (
    <div className="min-w-0 rounded border border-border bg-background/60 p-2">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-[11px] font-semibold">メンバー</h4>
        {past.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowInactive((v) => !v)}
            className="text-[10px] text-indigo-600 underline hover:opacity-80"
          >
            {showInactive ? "過去・無効を隠す" : `過去・無効も見る（${past.length}人）`}
          </button>
        ) : null}
      </div>

      {openSlots.length > 0 ? (
        <div className="mb-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[10px] leading-relaxed text-amber-800 dark:text-amber-200">
          <span className="font-medium">まだ誰も入っていない役職:</span>{" "}
          {openSlots
            .map((s) => s.roleName + (s.candidate ? `（候補: ${s.candidate}）` : ""))
            .join(" / ")}
        </div>
      ) : null}

      {shown.length === 0 ? (
        <p className="px-1 py-2 text-[10px] text-muted-foreground">登録されている人がいない。</p>
      ) : (
        <TableScroll>
          <table className="w-full min-w-[700px] border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-border text-left text-[10px] text-muted-foreground">
                <th className="w-[14%] px-2 py-1 font-medium">名前</th>
                <th className="w-[12%] px-2 py-1 font-medium">区分</th>
                <th className="w-[20%] px-2 py-1 font-medium">役割</th>
                <th className="w-[10%] px-2 py-1 font-medium">状態</th>
                <th className="w-[30%] px-2 py-1 font-medium">担当していること</th>
                <th className="w-[14%] px-2 py-1 font-medium">最終観測</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((m) => (
                <tr
                  key={m.name}
                  className={`border-b border-border/40 align-top ${m.status === "inactive" ? "opacity-55" : ""}`}
                >
                  <td className="px-2 py-1.5 font-medium">
                    {m.name}
                    {m.affiliation ? (
                      <div className="mt-0.5 text-[10px] font-normal text-muted-foreground">{m.affiliation}</div>
                    ) : null}
                  </td>
                  <td className="px-2 py-1.5 text-[10px] text-muted-foreground">{MEMBER_GROUP_LABEL[m.group]}</td>
                  <td className="px-2 py-1.5 leading-snug">{m.role ?? "—"}</td>
                  <td className="px-2 py-1.5 text-[10px] text-muted-foreground">{MEMBER_STATUS_LABEL[m.status]}</td>
                  <td className="px-2 py-1.5 leading-snug text-muted-foreground">{m.note ?? "—"}</td>
                  <td className="px-2 py-1.5 text-[10px] text-muted-foreground">
                    {m.lastSeen ?? "—"}
                    <div className="mt-0.5">{m.sources.join("・")}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
      <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
        この一覧は、SU側の登録・議事録からの自動抽出・役職の台帳を名前で束ねたもの。ここに名前があることは
        機能の充足の根拠にならない（上の表は実働の記録だけを見る）。会社設立後は登記上の役員と部門で
        組織図に切り替える。
      </p>
    </div>
  );
}

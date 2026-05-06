"use client";

/**
 * admin/tsukuyomi に表示する「PJ Status コックピット」関連の学習データ。
 *
 * - tsukuyomi_learnings_status: フィードバックから抽出した学習ルール
 *   - 全 PJ 共通 (target_project_id = null) と PJ 個別 を分けて表示
 * - narrative_feedbacks: ユーザーが投げた修正依頼の履歴 (open / applied)
 */

import { useState } from "react";

interface Learning {
  id: string;
  scope: string;
  targetProjectId: string | null;
  lessonText: string;
  sourceFeedbackId: string | null;
  createdAt: string | null;
}

interface Feedback {
  id: string;
  projectId: string;
  itemDate: string | null;
  itemTitle: string | null;
  feedback: string;
  status: string;
  appliedAt: string | null;
  appliedNote: string | null;
  createdAt: string | null;
}

interface ChatLog {
  id: string;
  projectId: string | null;
  sessionId: string;
  pagePath: string | null;
  role: string;
  content: string;
  appliedActions: Array<{ kind: string; detail: string }> | null;
  createdAt: string | null;
}

interface Props {
  learnings: Learning[];
  feedbacks: Feedback[];
  chatLogs?: ChatLog[];
}

function formatDt(iso: string | null): string {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16);
}

export function AdminTsukuyomiPjStatusLearnings({ learnings, feedbacks, chatLogs = [] }: Props) {
  const [tab, setTab] = useState<"general" | "pj" | "feedbacks" | "chat">("general");

  const general = learnings.filter((l) => l.targetProjectId === null);
  const perPj = learnings.filter((l) => l.targetProjectId !== null);

  const tabBtn = (key: typeof tab, label: string, count: number) => (
    <button
      onClick={() => setTab(key)}
      className={`text-[12px] px-3 py-1.5 rounded-md ${
        tab === key ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      {label} ({count})
    </button>
  );

  return (
    <div className="my-6 border border-[#e5e5e7] rounded-xl bg-white">
      <div className="px-4 py-3 border-b border-[#e5e5e7]">
        <h2 className="text-[13px] font-semibold">📊 PJ Status コックピットからの学習</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          沿革モーダルの ✏ 修正依頼から つくよみが抽出した「ルール」と、修正依頼の履歴。
          一般化されたルール (general) は次回以降の全 PJ 沿革生成にプロンプトとして注入されます。
        </p>
      </div>

      <div className="px-4 py-3 flex gap-2 flex-wrap">
        {tabBtn("general", "一般ルール (全 PJ 共通)", general.length)}
        {tabBtn("pj", "PJ 個別ルール", perPj.length)}
        {tabBtn("feedbacks", "修正依頼履歴", feedbacks.length)}
        {tabBtn("chat", "🌙 マスコットチャット", chatLogs.length)}
      </div>

      <div className="px-4 pb-4">
        {tab === "general" && (
          general.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">まだ無し。沿革モーダルで修正依頼を投げると蓄積されます。</p>
          ) : (
            <ul className="text-[12.5px] divide-y divide-[#f1f5f9]">
              {general.map((l) => (
                <li key={l.id} className="py-2 flex items-start gap-3">
                  <span className="text-[10px] font-mono text-muted-foreground w-[110px] shrink-0">
                    {formatDt(l.createdAt)}
                  </span>
                  <span className="text-[10px] font-mono text-blue-600 w-[64px] shrink-0">
                    {l.scope}
                  </span>
                  <span className="flex-1 text-slate-800">{l.lessonText}</span>
                </li>
              ))}
            </ul>
          )
        )}

        {tab === "pj" && (
          perPj.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">まだ無し。</p>
          ) : (
            <ul className="text-[12.5px] divide-y divide-[#f1f5f9]">
              {perPj.map((l) => (
                <li key={l.id} className="py-2 flex items-start gap-3">
                  <span className="text-[10px] font-mono text-muted-foreground w-[110px] shrink-0">
                    {formatDt(l.createdAt)}
                  </span>
                  <span className="text-[10px] font-mono text-purple-600 w-[60px] shrink-0">
                    {l.targetProjectId}
                  </span>
                  <span className="text-[10px] font-mono text-blue-600 w-[64px] shrink-0">
                    {l.scope}
                  </span>
                  <span className="flex-1 text-slate-800">{l.lessonText}</span>
                </li>
              ))}
            </ul>
          )
        )}

        {tab === "feedbacks" && (
          feedbacks.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">まだ無し。</p>
          ) : (
            <ul className="text-[12.5px] divide-y divide-[#f1f5f9]">
              {feedbacks.map((f) => (
                <li key={f.id} className="py-2 flex items-start gap-3 flex-wrap">
                  <span className="text-[10px] font-mono text-muted-foreground w-[110px] shrink-0">
                    {formatDt(f.createdAt)}
                  </span>
                  <span className="text-[10px] font-mono text-purple-600 w-[60px] shrink-0">
                    {f.projectId}
                  </span>
                  <span
                    className={`text-[10px] font-mono w-[60px] shrink-0 ${
                      f.status === "applied" ? "text-emerald-700" : "text-amber-700"
                    }`}
                  >
                    {f.status}
                  </span>
                  <span className="flex-1 min-w-[200px]">
                    {f.itemDate && (
                      <span className="text-[10px] text-muted-foreground">
                        {f.itemDate} / {f.itemTitle ?? "(全体)"}
                      </span>
                    )}
                    <div className="text-slate-800 whitespace-pre-wrap">{f.feedback}</div>
                  </span>
                </li>
              ))}
            </ul>
          )
        )}

        {tab === "chat" && (
          chatLogs.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">まだ無し。右下のつくよみマスコットをタップで会話開始。</p>
          ) : (
            <ul className="text-[12.5px] divide-y divide-[#f1f5f9]">
              {chatLogs.map((c) => (
                <li key={c.id} className="py-2 flex items-start gap-3 flex-wrap">
                  <span className="text-[10px] font-mono text-muted-foreground w-[110px] shrink-0">
                    {formatDt(c.createdAt)}
                  </span>
                  <span className="text-[10px] font-mono text-purple-600 w-[60px] shrink-0">
                    {c.projectId ?? "—"}
                  </span>
                  <span className={`text-[10px] font-mono w-[64px] shrink-0 ${c.role === "assistant" ? "text-purple-700" : "text-slate-700"}`}>
                    {c.role === "assistant" ? "つくよみ" : "まさ"}
                  </span>
                  <span className="flex-1 min-w-[200px]">
                    <div className="text-slate-800 whitespace-pre-wrap">{c.content}</div>
                    {c.appliedActions && c.appliedActions.length > 0 && (
                      <div className="mt-1 text-[10px] text-emerald-700">
                        ✓ 適用: {c.appliedActions.map((a) => `${a.kind} (${a.detail})`).join(" / ")}
                      </div>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </div>
  );
}

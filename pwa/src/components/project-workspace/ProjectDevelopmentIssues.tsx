"use client";

import { useEffect, useState } from "react";
import { loadProjectDevelopmentIssuesClient } from "@/lib/project-development-issues-client";
import { DEVELOPMENT_ISSUE_GROUPS, type ProjectDevelopmentIssuesData } from "@/lib/project-development-issues";
export function ProjectDevelopmentIssues({ projectId, initialData }: { projectId: string; initialData?: ProjectDevelopmentIssuesData | null }) {
  const [data, setData] = useState(initialData ?? null);
  const [loading, setLoading] = useState(initialData === undefined);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (initialData !== undefined) return;
    const controller = new AbortController();
    setLoading(true); setError(false); setData(null);
    loadProjectDevelopmentIssuesClient(projectId)
      .then(issues => { if (!controller.signal.aborted) setData(issues); })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [projectId, initialData]);
  return <div className="min-w-0 space-y-4" data-testid="project-development-issues">
    <h2 className="text-xl font-bold text-slate-950">開発課題</h2>
    {loading && <p role="status" className="text-sm text-slate-500">開発課題を読み込んでいるよ</p>}
    {error && <p role="alert" className="text-sm text-red-700">開発課題を読み込めなかった。再読み込みして。</p>}
    {DEVELOPMENT_ISSUE_GROUPS.map(group => {
      const issues = (initialData ?? data)?.issues.filter(issue => issue.group === group.key) ?? [];
      return <section key={group.key} className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label={group.label}>
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3"><h3 className="text-base font-bold text-slate-900">{group.label}</h3><span className="text-xs text-slate-500">{issues.length}件</span></header>
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr>{['課題', '現状', '対応方針', '担当', '目標期限', '状態'].map(label => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{issues.map(issue => <tr key={issue.id}>{[issue.title, issue.current, issue.approach, issue.owner, issue.dueOn, issue.status].map((value, index) => <td key={index} className="max-w-72 whitespace-pre-wrap break-words px-4 py-3 align-top text-slate-700">{value || '未登録'}</td>)}</tr>)}
              {!issues.length && <tr><td colSpan={6} className="px-4 py-5 text-slate-500">{loading ? '読み込み中' : error ? '取得できない' : '課題未登録'}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>;
    })}
    {(initialData ?? data)?.sourceRef && <p className="text-xs leading-5 text-slate-500">出典：{(initialData ?? data)?.sourceRef}</p>}
  </div>;
}

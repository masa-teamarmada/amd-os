"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  VERSION_STATE_LABEL,
  currentVersion,
  fetchInstitutionRegulations,
  type RegulationBundle,
} from "@/lib/institution-regulations";

export default function InstitutionRegulationPage() {
  const params = useParams<{ institutionId: string; regulationId: string }>();
  const [bundle, setBundle] = useState<RegulationBundle | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetchInstitutionRegulations(params.institutionId)
      .then(setBundle)
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "読み込み失敗"),
      );
  }, [params.institutionId]);
  const regulation = bundle?.regulations.find(
    (item) => item.regulationId === params.regulationId,
  );
  const versions = useMemo(
    () =>
      bundle?.versions.filter(
        (item) => item.regulationId === params.regulationId,
      ) ?? [],
    [bundle, params.regulationId],
  );
  const current =
    regulation && bundle
      ? currentVersion(bundle.versions, regulation.regulationId)
      : null;
  if (error)
    return (
      <main className="mx-auto max-w-4xl p-6 text-sm text-amber-900">
        {error}
      </main>
    );
  if (!bundle)
    return (
      <main className="p-8 text-center text-sm text-slate-500">
        規程台帳を読み込み中...
      </main>
    );
  if (!regulation)
    return (
      <main className="mx-auto max-w-4xl p-6">
        <p>規程が見つからない</p>
        <Link
          href={`/institutions/${params.institutionId}/cockpit`}
          className="mt-4 inline-block text-indigo-700"
        >
          コックピットへ戻る
        </Link>
      </main>
    );
  return (
    <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <nav className="text-xs text-slate-500">
        <Link href="/institutions" className="hover:text-indigo-700">
          研究機関
        </Link>
        <span className="px-2">/</span>
        <Link
          href={`/institutions/${params.institutionId}/cockpit`}
          className="hover:text-indigo-700"
        >
          コックピット
        </Link>
        <span className="px-2">/</span>規程台帳
      </nav>
      <header className="border-b border-slate-200 pb-5">
        <p className="text-[10px] font-bold text-indigo-700">OS内台帳</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">
          {regulation.title}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          外部正本が未登録のため、OS内の管理情報を表示している。
        </p>
        {current?.externalUrl && (
          <a
            href={current.externalUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
          >
            外部正本を開く
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </header>
      <dl className="grid border border-slate-200 bg-white sm:grid-cols-2">
        <Info label="現在地" value={regulation.currentStateNote || "未記入"} />
        <Info label="進行段階" value={`S${regulation.stage}`} />
        <Info label="次のゲート" value={regulation.nextGate || "未設定"} />
        <Info label="時期" value={regulation.nextGateTiming || "未設定"} />
      </dl>
      <section>
        <h2 className="text-base font-bold">版履歴</h2>
        <div className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
          {versions.length ? (
            versions.map((version) => (
              <div
                key={version.versionId}
                className="flex flex-wrap items-center gap-3 py-3 text-sm"
              >
                <span className="font-semibold">{version.label}</span>
                <span className="text-xs text-slate-500">
                  {VERSION_STATE_LABEL[version.versionState]}
                </span>
                <span className="text-xs text-slate-400">
                  {version.versionDate || "日付未登録"}
                </span>
                {version.externalUrl && (
                  <a
                    href={version.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto text-xs font-semibold text-indigo-700"
                  >
                    開く
                  </a>
                )}
              </div>
            ))
          ) : (
            <p className="py-5 text-sm text-slate-500">
              版はまだ登録されていない
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-200 p-4 sm:border-r">
      <dt className="text-[10px] text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

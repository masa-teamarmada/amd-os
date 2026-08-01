"use client";

export default function InstitutionWorkspaceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#faf8f2] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-xl rounded-lg border border-[#e4a39b] bg-[#f9e4e1] p-6 text-[#8c3329]" role="alert">
        <p className="text-[10px] font-semibold tracking-[0.16em]">読み込みエラー</p>
        <h1 className="mt-2 text-lg font-semibold">研究機関ワークスペースを読み込めなかったよ</h1>
        <p className="mt-2 text-sm leading-6">接続状況を確認して、もう一度読み込んでね。解消しない場合は管理者へ連絡して。</p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-5 min-h-11 rounded-lg border border-[#8c3329] px-4 py-2.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8c3329]"
        >
          再読み込み
        </button>
      </div>
    </main>
  );
}

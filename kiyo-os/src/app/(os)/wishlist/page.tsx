import {
  WISHES,
  WISH_CATEGORIES,
  STATE_CLASS,
  type WishCategory,
} from "@/lib/wishlist";
import { PageHeader } from "@/components/Panel";

const CATEGORY_LEAD: Record<WishCategory, string> = {
  質問: "中身を決めるために、まず答えてほしいこと",
  候補メニュー:
    "まさ用の「えいみOSスイート」にある機能。きよに要るかは分かりません。要らないものは遠慮なく外してください",
  仕事まわり:
    "経理・会社運営まわりの候補。会社の本番データには触らず、自分用のメモとして作ります",
  きよが書いた: "きよが自分で足したもの",
};

export default function WishlistPage() {
  return (
    <>
      <PageHeader
        title="ほしいもの"
        lead="きよOS に入れる候補の置き場。ここから作るものを選びます"
      />

      <div className="mb-6 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 text-xs leading-relaxed text-[var(--muted)]">
        <p>
          <span className="text-[var(--text)]">きよへ:</span>{" "}
          難しく考えなくて大丈夫です。「あったら便利だな」を思いついた順に、えいみに言うだけで
          ここに増えていきます。<span className="text-[var(--text)]">どう作るかは考えなくていいです。</span>
        </p>
        <p className="mt-2">
          正本は <code className="text-[var(--text)]">docs/INTAKE.md</code> と{" "}
          <code className="text-[var(--text)]">src/lib/wishlist.ts</code> です。
        </p>
      </div>

      <div className="space-y-8">
        {WISH_CATEGORIES.map((category) => {
          const items = WISHES.filter((w) => w.category === category);
          return (
            <section key={category}>
              <h2 className="text-sm font-medium">{category}</h2>
              <p className="mt-1 mb-3 text-xs leading-relaxed text-[var(--muted)]">
                {CATEGORY_LEAD[category]}
              </p>

              {items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[var(--line)] px-3 py-4 text-xs text-[var(--muted)]">
                  まだ何もありません。ここから始めます。
                </p>
              ) : (
                <ul className="space-y-2">
                  {items.map((w) => (
                    <li
                      key={w.id}
                      className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3.5 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-sm">{w.title}</span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ring-1 ${STATE_CLASS[w.state]}`}
                        >
                          {w.state}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                        {w.detail}
                        {w.note ? (
                          <span className="text-[var(--muted)]/60"> — {w.note}</span>
                        ) : null}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

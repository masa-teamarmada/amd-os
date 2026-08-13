import Link from "next/link";
import {
  MODULES,
  STATUS_CLASS,
  STATUS_LABEL,
  hrefFor,
} from "@/lib/modules";
import { WISHES } from "@/lib/wishlist";
import { PageHeader } from "@/components/Panel";

function greeting(hour: number): string {
  if (hour < 5) return "こんばんは";
  if (hour < 11) return "おはよう";
  if (hour < 18) return "こんにちは";
  return "こんばんは";
}

export default function HomePage() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const hour = jst.getUTCHours();
  const dateLabel = `${jst.getUTCFullYear()}年${jst.getUTCMonth() + 1}月${jst.getUTCDate()}日`;

  const undecided = WISHES.filter((w) => w.state === "聞いた").length;
  const cards = MODULES.filter((m) => m.slug !== "");

  return (
    <>
      <PageHeader
        title={`${greeting(hour)}、きよ`}
        lead={`${dateLabel} — きよOS はまだ骨組みだけ。中身はこれから一緒に決める`}
      />

      <div className="mb-6 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/5 p-4">
        <div className="text-sm font-medium text-[var(--accent)]">
          次にやること
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">
          「ほしいもの」に {undecided} 件の候補と質問があります。
          目を通して、要る / 要らない を教えてください。選ばれたものから作っていきます。
        </p>
        <Link
          href="/wishlist"
          className="mt-3 inline-block rounded-lg bg-[var(--accent)]/15 px-3 py-1.5 text-xs font-medium text-[var(--accent)] ring-1 ring-[var(--accent)]/30 transition hover:bg-[var(--accent)]/25"
        >
          ほしいものを見る →
        </Link>
      </div>

      <h2 className="mb-3 text-sm font-medium text-[var(--muted)]">いまある画面</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((m) => (
          <Link
            key={m.slug}
            href={hrefFor(m)}
            className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:border-[var(--accent)]/40"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-medium">
                <span aria-hidden>{m.icon}</span>
                {m.label}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] ring-1 ${STATUS_CLASS[m.status]}`}
              >
                {STATUS_LABEL[m.status]}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
              {m.description}
            </p>
          </Link>
        ))}
      </div>

      <p className="mt-8 text-xs leading-relaxed text-[var(--muted)]">
        画面を増やすには <code className="text-[var(--text)]">src/lib/modules.ts</code> に 1 件足すだけです。
        ナビとこのカードは自動で増えます。
      </p>
    </>
  );
}

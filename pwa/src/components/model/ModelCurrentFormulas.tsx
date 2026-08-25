import { BzmMarkdown, BzmMathText } from "@/components/bzm/BzmMarkdown";
import type { CurrentFormula } from "@/app/(app)/model/current-formulas";

/**
 * 現行モデル（BZM 3.0）の式を、ページの一番上に並べる。
 *
 * まさ 2026-08-25「正本の式が一番下に置かれていて読みにくいので、これを一番上にもってきてほしい」。
 *
 * 式は台帳（＝このページの本文）から出現順に拾ったもので、画面が書き起こしたものではない。
 * それぞれ「正本のどの節にあるか」へ飛べるようにしてある。
 * ページ下部の「すべての式」は旧 BZM 2.2 系列（退役済み。あちらの札のとおり）。
 */
export function ModelCurrentFormulas({ formulas }: { formulas: CurrentFormula[] }) {
  if (formulas.length === 0) return null;

  // 節ごとにまとめる（正本の順序は保つ）
  const groups: { section: string; anchor: string; items: CurrentFormula[] }[] = [];
  for (const f of formulas) {
    const last = groups[groups.length - 1];
    if (last && last.anchor === f.anchor) last.items.push(f);
    else groups.push({ section: f.section, anchor: f.anchor, items: [f] });
  }

  return (
    <section id="current-formulas" className="mb-10 scroll-mt-20">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-base font-bold text-foreground">
          現行モデルの式（BZM 3.0・{formulas.length}本）
        </h2>
        <a href="#formulas" className="text-xs text-indigo-600 underline hover:opacity-80">
          旧 BZM 2.2 系列の一覧はページ下部 ↓
        </a>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
        このページの本文（§5・§6）に現れる式を、出現順にそのまま並べたもの。式の意味・記号の定義・
        なぜその形なのかは、それぞれの節に書いてある。式を押すとその節へ飛ぶ。
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {groups.map((g) => (
          <div
            key={g.anchor}
            className="rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm"
          >
            <a
              href={`#${g.anchor}`}
              className="mb-1 inline-block text-[11px] font-semibold text-indigo-600 underline hover:opacity-80"
            >
              <BzmMathText source={g.section} />
            </a>
            <div className="space-y-1">
              {g.items.map((f) => (
                <a
                  key={f.index}
                  href={`#${g.anchor}`}
                  className="block overflow-x-auto rounded px-1 py-0.5 transition-colors hover:bg-muted [&_.katex-display]:my-1"
                  title={`${g.section} へ`}
                >
                  <BzmMarkdown source={`$$\n${f.tex}\n$$`} compact />
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

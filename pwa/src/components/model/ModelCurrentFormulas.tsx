import { BzmMathText } from "@/components/bzm/BzmMarkdown";
import type { CurrentFormula } from "@/app/(app)/model/current-formulas";

/**
 * 現行モデル（BZM 3.0）の式を、ページの一番上に並べる。
 *
 * まさ 2026-08-25「正本の式が一番下に置かれていて読みにくいので、これを一番上にもってきてほしい」
 * → 「旧モデルみたいな感じで、簡単な説明も添えて全体が見渡せるようにしておいてほしい。
 *    情報密度を上げることは、何度も何度も言ってると思うので、常に気をつけてほしい。
 *    空白だらけだと、それだけで読む気が失せる」。
 *
 * **密度の設計**: カードのグリッドにすると行ごとに高さが揃い、式1本の節が巨大な空白になる
 * （初版はこれで差し戻し）。**1行1式の表**にして、式・何の式か・主な記号の意味を横に並べる。
 * 数式は既定の margin が大きいので潰す。
 *
 * 式も説明も台帳（＝このページの本文）から拾ったもので、画面が書き起こしたものではない。
 */
export function ModelCurrentFormulas({ formulas }: { formulas: CurrentFormula[] }) {
  if (formulas.length === 0) return null;

  const sections = [...new Set(formulas.map((f) => f.anchor))].length;

  return (
    <section id="current-formulas" className="mb-8 scroll-mt-20">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 className="text-base font-bold text-foreground">
          現行モデルの式（BZM 3.0・{formulas.length}本／{sections}節）
        </h2>
        <a href="#formulas" className="text-xs text-indigo-600 underline hover:opacity-80">
          旧 BZM 2.2 系列の一覧は下部 ↓
        </a>
      </div>
      <p className="mb-2 text-xs leading-snug text-muted-foreground">
        本文（§5・§6）に出てくる式を出現順に並べたもの。式・説明とも正本から拾っている。行を押すとその節へ飛ぶ。
      </p>

      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full table-fixed border-collapse text-[12px]">
          <thead>
            <tr className="bg-muted/60 text-left text-[11px] text-muted-foreground">
              <th className="w-[16%] px-2 py-1 font-medium">節</th>
              <th className="w-[40%] px-2 py-1 font-medium">式</th>
              <th className="w-[44%] px-2 py-1 font-medium">何の式か / 主な記号</th>
            </tr>
          </thead>
          <tbody>
            {formulas.map((f, i) => {
              const prev = formulas[i - 1];
              const newSection = !prev || prev.anchor !== f.anchor;
              return (
                <tr
                  key={f.index}
                  className={`align-top ${newSection ? "border-t border-border" : "border-t border-border/40"} hover:bg-muted/40`}
                >
                  <td className="px-2 py-1.5">
                    {newSection ? (
                      <a
                        href={`#${f.anchor}`}
                        className="text-[11px] font-semibold leading-snug text-indigo-600 underline hover:opacity-80"
                        title={f.section}
                      >
                        <BzmMathText source={f.sectionShort} />
                      </a>
                    ) : null}
                  </td>
                  <td className="px-2 py-1.5">
                    <a
                      href={`#${f.anchor}`}
                      className="block overflow-x-auto [&_.katex-display]:my-0 [&_.katex-display]:text-left [&_.katex]:text-[13px]"
                      title="正本の該当箇所へ"
                    >
                      <BzmMathText source={`$$\n${f.tex}\n$$`} />
                    </a>
                  </td>
                  <td className="px-2 py-1.5 leading-snug">
                    {f.label ? (
                      <div className="mb-0.5 font-medium text-foreground">
                        <BzmMathText source={f.label} />
                      </div>
                    ) : null}
                    {f.symbols.length > 0 ? (
                      <div className="text-[11px] text-muted-foreground">
                        {f.symbols.slice(0, 3).map((s, k) => (
                          <span key={k}>
                            {k > 0 ? <span className="px-1 text-border">/</span> : null}
                            <BzmMathText source={s.symbol} />
                            <span className="px-0.5">=</span>
                            <BzmMathText source={s.meaning} />
                          </span>
                        ))}
                        {f.symbols.length > 3 ? (
                          <span className="pl-1 text-border">ほか{f.symbols.length - 3}件</span>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

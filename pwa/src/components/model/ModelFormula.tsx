import Link from "next/link";
import type { ModelFormula, ModelFormulaPart } from "@/app/(app)/model/model-data";

/**
 * 台帳カードの式 (例: "SPS = q × P^ind") を、変数ごとにクリック可能なリンクとして描画する。
 * type: "var" の part は /model/{ledgerSlug}#{anchor} へ飛び、台帳側の該当変数説明を開く。
 * type: "op" の part はただの記号 (=, ×, ・, /) をそのまま出す。
 */
export function ModelFormula({
  formula,
  ledgerSlug,
}: {
  formula: ModelFormula;
  ledgerSlug: string;
}) {
  return (
    <span className="font-mono text-[15px] tracking-tight text-foreground">
      {formula.parts.map((part, i) => (
        <ModelFormulaPartView key={i} part={part} ledgerSlug={ledgerSlug} />
      ))}
    </span>
  );
}

function ModelFormulaPartView({ part, ledgerSlug }: { part: ModelFormulaPart; ledgerSlug: string }) {
  if (part.type === "op") {
    return <span className="text-muted-foreground">{part.text}</span>;
  }

  const symbol = (
    <>
      {part.symbol}
      {part.sup ? <sup className="text-[10px]">{part.sup}</sup> : null}
    </>
  );

  if (!part.anchor) {
    return <span>{symbol}</span>;
  }

  return (
    <Link
      href={`/model/${encodeURIComponent(ledgerSlug)}#${part.anchor}`}
      className="underline decoration-dotted decoration-1 underline-offset-2 transition-colors hover:text-indigo-600 hover:decoration-solid"
    >
      {symbol}
    </Link>
  );
}

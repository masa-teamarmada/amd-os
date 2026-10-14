import Image from "next/image";
import { EXPERIMENT_WEATHER, type ExperimentVisual } from "@/lib/experiment-result";

/** OS共通の実験結果アイコン。天気と試験完了を混ぜない。 */
export function ExperimentResultWeather({ weather, reason, compact=false }: {weather:ExperimentVisual["weather"];reason:string;compact?:boolean}) {
  if(weather==="unknown") return <span className="text-[11px] text-[var(--amd-muted)]">結果未確認</span>;
  const item=EXPERIMENT_WEATHER[weather];
  return <div className={`flex ${compact?"items-center gap-1":"items-center gap-2"}`} title={`${item.label}：${item.meaning}。${reason}`}>
    <Image src={`/images/experiment-status/${item.image}.png`} alt="" width={compact?28:40} height={compact?28:40} className="shrink-0 object-contain"/>
    <span className="min-w-0"><span className="block text-[11px] font-medium text-[var(--amd-ink)]">{item.label}</span>{!compact&&<span className="mt-0.5 block text-[10px] leading-3 text-[var(--amd-muted)]">{reason||item.meaning}</span>}</span>
  </div>;
}

export function ExperimentDoneStamp() {
  return <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden" title="試験完了。処理効果は天気で表示"><Image src="/images/experiment-status/done.png" alt="済：試験完了" width={56} height={56} className="max-w-none shrink-0"/></span>;
}

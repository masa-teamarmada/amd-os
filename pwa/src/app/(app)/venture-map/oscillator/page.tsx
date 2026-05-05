import { CoupledOscillatorView } from "@/components/venture-map/CoupledOscillatorView";

export const metadata = {
  title: "Coupled Oscillator | Venture Map | AMD OS",
};

export default function OscillatorPage() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold">
          Before Zero Theory v3 — 連成振動モデル
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          6 つのマクロトレンド要素 (P, B, I_R, N, V, R) を連成振動系として可視化。
          外力 E (海外政策・災害・地政学) や ジャンプ (ブレークスルー) を投入し、揺れの伝播パターンを観察できる。
          数式: <code className="bg-slate-100 px-1 rounded">M ẍ + C ẋ + K x = F_E(t) + dJ</code>
        </p>
      </div>
      <CoupledOscillatorView />
    </div>
  );
}

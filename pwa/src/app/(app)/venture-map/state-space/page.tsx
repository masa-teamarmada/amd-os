import { StateSpaceView } from "@/components/venture-map/StateSpaceView";

export const metadata = {
  title: "State Space Sandbox | Venture Map | AMD OS",
};

export default function StateSpacePage() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold">
          Before Zero Theory v3.1 — 状態空間モデル sandbox
        </h1>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          v3 連成振動モデルを{" "}
          <strong>状態空間モデル (Level 4 一般形)</strong>{" "}
          に昇格させた最初のプロトタイプ。隠れ状態 2 次元、外力はインパルスのみ。
          A 行列を手で動かすと、固有値の構造 (実 vs 複素、単位円の内外) と
          軌道の振る舞い (減衰・振動・発散) の対応が体感できる。
        </p>
        <div className="mt-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded px-2 py-1.5 inline-block">
          x<sub>t+1</sub> = A x<sub>t</sub> + impulse<sub>t</sub>
        </div>
      </div>
      <StateSpaceView />
    </div>
  );
}

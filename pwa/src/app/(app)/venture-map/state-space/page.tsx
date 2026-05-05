import { TripleHelixView } from "@/components/venture-map/TripleHelixView";

export const metadata = {
  title: "State Space (Triple Helix) | Venture Map | AMD OS",
};

export default function StateSpacePage() {
  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold">
          Before Zero Theory v3.1 — Triple Helix 状態空間モデル
        </h1>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-[900px]">
          Etzkowitz &amp; Leydesdorff (1995) の Triple Helix
          (大学・産業・政府の共進化モデル) を、状態空間モデル (Level 4) で定式化。
          隠れ状態 = 3 つの helix モメンタム (μ_A 学, μ_I 産, μ_G 官)。これらが互いに役割を引き受け合い、
          観測量 6 個 (P, B, V, R, I_R, N) に射影される。Etzkowitz の「helix」比喩は、
          A 行列の複素固有値が描く{" "}
          <strong>螺旋的共進化軌道</strong> として数学的に実体化する。
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs font-mono">
          <span className="bg-slate-50 border border-slate-200 rounded px-2 py-1">
            x<sub>t+1</sub> = A x<sub>t</sub> + B u<sub>t</sub> + ε
            <sub>t</sub>
          </span>
          <span className="bg-slate-50 border border-slate-200 rounded px-2 py-1">
            y<sub>t</sub> = C x<sub>t</sub> + η<sub>t</sub>
          </span>
          <span className="bg-slate-50 border border-slate-200 rounded px-2 py-1">
            n=3, m=6, p=3
          </span>
        </div>
      </div>
      <TripleHelixView />
    </div>
  );
}

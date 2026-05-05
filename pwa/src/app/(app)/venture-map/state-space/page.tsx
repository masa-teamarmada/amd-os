import { TripleHelixView } from "@/components/venture-map/TripleHelixView";

export const metadata = {
  title: "State Space (Triple Helix) | Venture Map | AMD OS",
};

export default function StateSpacePage() {
  return (
    <div className="mx-auto w-full max-w-[1500px] px-3 py-3">
      <div className="mb-2 flex items-center gap-3 flex-wrap">
        <h1 className="text-base font-semibold">
          Before Zero Theory v3.1 — Triple Helix
        </h1>
        <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
          <span className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
            x<sub>t+1</sub> = A x<sub>t</sub> + B u<sub>t</sub> + ε
          </span>
          <span className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
            y<sub>t</sub> = C x<sub>t</sub> + η
          </span>
          <span className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
            n=3, m=6, p=3
          </span>
        </div>
      </div>
      <TripleHelixView />
    </div>
  );
}

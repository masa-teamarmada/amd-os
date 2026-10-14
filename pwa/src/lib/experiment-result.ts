/** 共通の処理効果表示。実験の完了状態とは独立して、根拠付きで登録する。 */
export const EXPERIMENT_WEATHER = {
  clear: { label: "快晴", meaning: "対象成分の除去を確認", image: "clear" },
  sunny: { label: "晴れ", meaning: "対象成分の低下を確認", image: "sunny" },
  cloudy: { label: "曇", meaning: "効果限定・評価途中", image: "cloudy" },
  rain: { label: "雨", meaning: "改善不十分", image: "rain" },
  storm: { label: "嵐", meaning: "増加・阻害を確認", image: "storm" },
} as const;
export type ExperimentWeather = keyof typeof EXPERIMENT_WEATHER;
export const EFFLUENT_WATER_TYPES = { colored: "着色排水", metal: "金属排水" } as const;
export type EffluentWaterType = keyof typeof EFFLUENT_WATER_TYPES;
export const ELEMENT_SYMBOLS = new Set("H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og".split(" "));
export type ExperimentChange = { parameter: string; before: string; after: string; time: string; note: string; effect?: "improved"|"limited"|"worsened"|"unknown" };
export type ExperimentVisual = {
  element_symbols: string[];
  water_types: EffluentWaterType[];
  changes: ExperimentChange[];
  weather: ExperimentWeather | "unknown";
  weather_reason: string;
  analysis_note: string;
};
export const EMPTY_EXPERIMENT_VISUAL: ExperimentVisual = { element_symbols: [], water_types: [], changes: [], weather: "unknown", weather_reason: "", analysis_note: "" };

export function readExperimentVisual(value: unknown): ExperimentVisual | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.element_symbols) || v.element_symbols.length > 24 || v.element_symbols.some(s => typeof s !== "string" || !ELEMENT_SYMBOLS.has(s))) return null;
  if (!Array.isArray(v.water_types) || v.water_types.some(t => typeof t !== "string" || !Object.hasOwn(EFFLUENT_WATER_TYPES,t))) return null;
  if (typeof v.weather !== "string" || (v.weather !== "unknown" && !Object.hasOwn(EXPERIMENT_WEATHER,v.weather))) return null;
  if (typeof v.weather_reason !== "string" || v.weather_reason.length > 500 || typeof v.analysis_note !== "string" || v.analysis_note.length > 1000) return null;
  if (v.weather !== "unknown" && !v.weather_reason.trim()) return null;
  if (!Array.isArray(v.changes) || v.changes.length > 12) return null;
  const changes: ExperimentChange[] = [];
  for (const x of v.changes) {
    if (!x || typeof x !== "object" || Array.isArray(x)) return null;
    const c = x as Record<string, unknown>;
    if (["parameter","before","after","time","note"].some(k => typeof c[k] !== "string" || (c[k] as string).length > 500)) return null;
    if (!String(c.parameter).trim() || !String(c.before).trim() || !String(c.after).trim()) return null;
    if(c.effect!==undefined&&!['improved','limited','worsened','unknown'].includes(String(c.effect)))return null;
    changes.push(c as ExperimentChange);
  }
  return { element_symbols:[...new Set(v.element_symbols)] as string[], water_types:[...new Set(v.water_types)] as EffluentWaterType[], weather:v.weather as ExperimentVisual["weather"], weather_reason:v.weather_reason.trim(), analysis_note:v.analysis_note.trim(), changes };
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { invokeReimburse } from "@/lib/edge-functions";

const CATEGORIES = [
  { value: "transport", label: "交通費", icon: "🚃" },
  { value: "lodging", label: "宿泊", icon: "🏨" },
  { value: "supplies", label: "消耗品", icon: "📦" },
  { value: "meal", label: "会議費", icon: "🍽" },
  { value: "other", label: "その他", icon: "📋" },
];

const TRANSPORT_MODES = [
  { value: "train", label: "電車" },
  { value: "bus", label: "バス" },
  { value: "taxi", label: "タクシー" },
  { value: "car", label: "自家用車" },
];

const TAX_RATES = [
  { value: "0.10", label: "10%" },
  { value: "0.08", label: "8%（軽減）" },
  { value: "0", label: "非課税" },
];

interface Project {
  id: string;
  project_code: string;
  name: string;
}

export default function ReimburseInputPage() {
  const router = useRouter();
  const supabase = createClient();

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [taxRate, setTaxRate] = useState("0.10");
  const [description, setDescription] = useState("");
  const [transportMode, setTransportMode] = useState("train");
  const [transportFrom, setTransportFrom] = useState("");
  const [transportTo, setTransportTo] = useState("");
  const [transportTrip, setTransportTrip] = useState("one_way");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    // ユーザーのPJ一覧取得
    const load = async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, project_code, name")
        .eq("status", "active")
        .order("project_code");
      setProjects(data ?? []);
      if (data?.length === 1) setProjectId(data[0].id);
    };
    load();
  }, []);

  const handleSubmit = async () => {
    if (!projectId || !date || !category || !amount || !description) {
      setResult({ ok: false, message: "必須項目を入力してね" });
      return;
    }

    setLoading(true);
    const res = await invokeReimburse({
      action: "create",
      project_id: projectId,
      date,
      category,
      amount: Number(amount),
      tax_rate: Number(taxRate),
      description,
      transport_mode: category === "transport" ? transportMode : undefined,
      transport_from: category === "transport" ? transportFrom : undefined,
      transport_to: category === "transport" ? transportTo : undefined,
      transport_trip: category === "transport" ? transportTrip : undefined,
    });
    setLoading(false);

    if (res.ok) {
      setResult({ ok: true, message: "立替申請を登録しました" });
      // リセット
      setCategory("");
      setAmount("");
      setDescription("");
      setTransportFrom("");
      setTransportTo("");
      setTimeout(() => setResult(null), 2000);
    } else {
      setResult({ ok: false, message: res.error || "登録に失敗しました" });
    }
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">立替申請</h2>
        <button
          onClick={() => router.push("/m/reimburse/list")}
          className="text-xs text-blue-600"
        >
          申請一覧 →
        </button>
      </div>

      <div className="space-y-4">
        {/* PJ選択 */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">プロジェクト</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white"
          >
            <option value="">選択してください</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.project_code} — {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* 日付 */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">日付</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
          />
        </div>

        {/* カテゴリ */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">カテゴリ</label>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={`flex flex-col items-center py-2.5 rounded-lg border text-xs transition-colors ${
                  category === c.value
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white text-gray-600 active:bg-gray-50"
                }`}
              >
                <span className="text-base mb-0.5">{c.icon}</span>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* 交通費の追加フィールド */}
        {category === "transport" && (
          <div className="bg-blue-50 rounded-lg p-3 space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">交通手段</label>
              <div className="flex gap-2">
                {TRANSPORT_MODES.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setTransportMode(m.value)}
                    className={`flex-1 py-2 rounded-lg border text-xs ${
                      transportMode === m.value
                        ? "border-blue-500 bg-white text-blue-700"
                        : "border-gray-200 bg-white text-gray-500"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">出発</label>
                <input
                  type="text"
                  value={transportFrom}
                  onChange={(e) => setTransportFrom(e.target.value)}
                  placeholder="渋谷駅"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">到着</label>
                <input
                  type="text"
                  value={transportTo}
                  onChange={(e) => setTransportTo(e.target.value)}
                  placeholder="品川駅"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setTransportTrip("one_way")}
                className={`flex-1 py-2 rounded-lg border text-xs ${
                  transportTrip === "one_way"
                    ? "border-blue-500 bg-white text-blue-700"
                    : "border-gray-200 bg-white text-gray-500"
                }`}
              >
                片道
              </button>
              <button
                onClick={() => setTransportTrip("round")}
                className={`flex-1 py-2 rounded-lg border text-xs ${
                  transportTrip === "round"
                    ? "border-blue-500 bg-white text-blue-700"
                    : "border-gray-200 bg-white text-gray-500"
                }`}
              >
                往復
              </button>
            </div>
          </div>
        )}

        {/* 金額 */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">金額（税込）</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1500"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
            />
            <select
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-2.5 text-xs bg-white"
            >
              {TAX_RATES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 説明 */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">説明</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="クライアント訪問"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
          />
        </div>

        {/* Result */}
        {result && (
          <div className={`rounded-lg p-3 text-sm ${
            result.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}>
            {result.message}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || !projectId || !category || !amount || !description}
          className="w-full bg-blue-600 text-white rounded-xl py-3.5 text-sm font-medium active:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "登録中..." : "立替を申請する"}
        </button>
      </div>
    </div>
  );
}

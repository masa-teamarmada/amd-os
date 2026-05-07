/**
 * XRL (TRL/BRL/GRL/SRL/HRL) の 9 段階定義 — 内閣府 SIP「サーキュラーエコノミーシステム構築」2023 公募要領 PDF p11-15 互換。
 *
 * 各レベルは:
 *   - label: 段階の短い名前
 *   - description: その段階で達成されるべき内容
 *   - exit_criteria: 次レベルに進むための具体的な条件 (cleared 必須項目)
 *
 * UI で「現在 4 → 5 に進むには？」という形で参照する。
 */

export type XrlAxisKey = "trl" | "brl" | "grl" | "srl" | "hrl";

export interface XrlLevelDefinition {
  level: number;          // 1-9
  label: string;
  description: string;
  exit_criteria: string;  // 次レベルに進むための条件
}

export interface XrlAxisDefinition {
  axis: XrlAxisKey;
  axisName: string;
  axisDescription: string;
  levels: XrlLevelDefinition[]; // length = 9
}

// ----------------------------------------------------------------
// TRL (NASA / 内閣府 SIP)
// ----------------------------------------------------------------
export const TRL_DEFINITION: XrlAxisDefinition = {
  axis: "trl",
  axisName: "TRL",
  axisDescription: "Technology Readiness Level — 技術成熟度。NASA 起源、内閣府 SIP 互換 9 段階",
  levels: [
    { level: 1, label: "基本原理確認", description: "基本原理の観察と報告 (論文レベル)", exit_criteria: "原理を実証する 1 件以上の査読論文 / 学会発表" },
    { level: 2, label: "概念定義", description: "技術コンセプトの定式化、応用領域の特定", exit_criteria: "応用シナリオ × 必要パラメータが文書化されている" },
    { level: 3, label: "実験的検証", description: "ラボでの critical function / 部分実証", exit_criteria: "コア機能の単独試験成功 + 再現性確認" },
    { level: 4, label: "ラボ試作", description: "ラボ環境で構成要素を統合した試作", exit_criteria: "統合試作品がラボ環境で動作 + 性能データ取得" },
    { level: 5, label: "関連環境試作", description: "実環境を模した条件で試作品が動作", exit_criteria: "実環境模擬試験 (温度・振動・負荷など) を pass" },
    { level: 6, label: "実環境試作", description: "実環境での試作品評価", exit_criteria: "実環境フィールドテスト 1 件以上で目標性能達成" },
    { level: 7, label: "実環境デモ", description: "実環境での実機システム実証", exit_criteria: "実機が実環境で連続稼働 (一定期間)、第三者検証" },
    { level: 8, label: "実機完成", description: "実機システムの製作・認定", exit_criteria: "量産仕様確定 + 規格認定取得" },
    { level: 9, label: "運用実績", description: "実環境での運用実績", exit_criteria: "商業運用での実績データ蓄積、安定稼働" },
  ],
};

// ----------------------------------------------------------------
// BRL (内閣府 SIP)
// ----------------------------------------------------------------
export const BRL_DEFINITION: XrlAxisDefinition = {
  axis: "brl",
  axisName: "BRL",
  axisDescription: "Business Readiness Level — 事業化成熟度",
  levels: [
    { level: 1, label: "事業仮説", description: "市場 / 顧客仮説の言語化", exit_criteria: "1 ページの事業仮説 (顧客 / 課題 / 解決) が書ける" },
    { level: 2, label: "顧客インタビュー", description: "想定顧客への定性ヒアリング", exit_criteria: "10 件以上の顧客インタビューで課題確認" },
    { level: 3, label: "PoC 検討", description: "PoC 設計 / コスト試算", exit_criteria: "PoC 計画書 + ユニットエコノミクス試算" },
    { level: 4, label: "PoC 実施", description: "1 顧客 PoC の実施", exit_criteria: "PoC 完了報告 + 顧客の継続意向" },
    { level: 5, label: "有償 PoC", description: "複数顧客の有償 PoC", exit_criteria: "2 件以上の有償契約締結" },
    { level: 6, label: "本契約", description: "本格契約 / 事業モデル確立", exit_criteria: "本契約 1 件 + 事業モデル LP / pitch deck 完成" },
    { level: 7, label: "繰返契約", description: "リピート / アップセル発生", exit_criteria: "リピート率 / LTV データ取得" },
    { level: 8, label: "拡大期", description: "営業組織化 / 横展開", exit_criteria: "営業 KPI 設計 + 月次成長率記録" },
    { level: 9, label: "事業確立", description: "黒字化 / 事業安定", exit_criteria: "営業利益黒字 + 安定的な月次成長" },
  ],
};

// ----------------------------------------------------------------
// GRL (内閣府 SIP)
// ----------------------------------------------------------------
export const GRL_DEFINITION: XrlAxisDefinition = {
  axis: "grl",
  axisName: "GRL",
  axisDescription: "Governance Readiness Level — 制度・規制適合性 + 標準化",
  levels: [
    { level: 1, label: "規制マップ", description: "関係法令 / 所管省庁の特定", exit_criteria: "適用法令一覧 + 主担当省庁の整理" },
    { level: 2, label: "規制ヒアリング", description: "省庁・業界団体への問合せ", exit_criteria: "1 省庁以上のヒアリング実施" },
    { level: 3, label: "適合性検討", description: "現行規制との適合性評価", exit_criteria: "適合 / 改正必要項目の整理 + 法律家レビュー" },
    { level: 4, label: "認可申請準備", description: "申請書類の準備", exit_criteria: "必要書類セット完成 + 事前相談" },
    { level: 5, label: "認可申請", description: "正式申請", exit_criteria: "申請受理通知" },
    { level: 6, label: "認可取得", description: "認可 / 許可の取得", exit_criteria: "認可書 / 許可証取得" },
    { level: 7, label: "標準化参画", description: "業界標準・規格への参画", exit_criteria: "JIS / ISO / 業界団体規格 WG への参加" },
    { level: 8, label: "標準化貢献", description: "標準化提案", exit_criteria: "規格提案書の提出" },
    { level: 9, label: "標準化採択", description: "提案規格の採択", exit_criteria: "規格として正式公開" },
  ],
};

// ----------------------------------------------------------------
// SRL (内閣府 SIP / EU H2020)
// ----------------------------------------------------------------
export const SRL_DEFINITION: XrlAxisDefinition = {
  axis: "srl",
  axisName: "SRL",
  axisDescription: "Social Readiness Level — 社会受容性 (一般消費者・世論)",
  levels: [
    { level: 1, label: "社会課題マップ", description: "対象社会課題の言語化", exit_criteria: "課題が公開資料 / メディアで認知されている" },
    { level: 2, label: "ステークホルダー識別", description: "影響を受ける関係者の整理", exit_criteria: "ステークホルダーマップ作成" },
    { level: 3, label: "受容性調査", description: "アンケート / インタビュー", exit_criteria: "100 件以上の調査データ取得" },
    { level: 4, label: "受容性検証", description: "限定的な社会実装試行", exit_criteria: "1 自治体 / 1 コミュニティでの実証" },
    { level: 5, label: "メディア露出", description: "メディアでの好意的取り扱い", exit_criteria: "全国紙 / 主要メディア 3 媒体以上の取り上げ" },
    { level: 6, label: "ファン化", description: "サポーター / コミュニティ形成", exit_criteria: "コミュニティ規模 1,000 人以上" },
    { level: 7, label: "業界アライアンス", description: "業界団体 / NGO との連携", exit_criteria: "1 団体以上との MOU / 共同声明" },
    { level: 8, label: "社会的影響", description: "政策・世論への影響", exit_criteria: "政策提言が報道 / 採用される事例" },
    { level: 9, label: "社会基盤化", description: "社会インフラとして定着", exit_criteria: "標準的に利用される存在になっている" },
  ],
};

// ----------------------------------------------------------------
// HRL (内閣府 SIP)
// ----------------------------------------------------------------
export const HRL_DEFINITION: XrlAxisDefinition = {
  axis: "hrl",
  axisName: "HRL",
  axisDescription: "Human Resources Readiness Level — 人材成熟度 (チーム補完性・スキル分布)",
  levels: [
    { level: 1, label: "発案者単独", description: "発明者 / 起案者のみ", exit_criteria: "発案者の専門性 + 補完候補者の認識" },
    { level: 2, label: "コア候補識別", description: "共同創業者候補の特定", exit_criteria: "Co-Founder 候補との対話開始" },
    { level: 3, label: "コア参画", description: "Co-Founder の参画", exit_criteria: "正式参画 + 役割分担" },
    { level: 4, label: "技術リード", description: "技術担当の確保", exit_criteria: "CTO / 技術リード雇用 or 参画" },
    { level: 5, label: "事業リード", description: "事業担当の確保", exit_criteria: "COO / 事業リード雇用 or 参画" },
    { level: 6, label: "管理体制", description: "経理・法務・労務など管理機能", exit_criteria: "管理機能を内製 or 外注で確保" },
    { level: 7, label: "営業組織", description: "営業 / マーケ機能の組織化", exit_criteria: "営業 KPI を持つ組織化" },
    { level: 8, label: "後継育成", description: "次世代リーダー育成", exit_criteria: "ミドル層 / リーダー育成プログラム稼働" },
    { level: 9, label: "組織自立", description: "創業者依存から脱却", exit_criteria: "創業者なしでも事業継続可能な体制" },
  ],
};

export const ALL_XRL_DEFINITIONS: Record<XrlAxisKey, XrlAxisDefinition> = {
  trl: TRL_DEFINITION,
  brl: BRL_DEFINITION,
  grl: GRL_DEFINITION,
  srl: SRL_DEFINITION,
  hrl: HRL_DEFINITION,
};

/** 任意の axis × 任意のレベル (浮動小数許容) から、現レベル / 次レベル / 進捗 % を返す */
export function getLevelInfo(axis: XrlAxisKey, value: number | null) {
  const def = ALL_XRL_DEFINITIONS[axis];
  if (value == null) {
    return { current: null, next: def.levels[0], progressPct: 0, def };
  }
  const cv = Math.max(0, Math.min(9, value));
  const lower = Math.floor(cv);
  const upper = Math.min(9, lower + 1);
  const progressPct = lower === upper ? 100 : Math.round((cv - lower) * 100);
  const current = lower === 0 ? null : def.levels[lower - 1];
  const next = upper === 0 ? null : def.levels[Math.min(8, upper - 1)];
  return { current, next, progressPct, def };
}

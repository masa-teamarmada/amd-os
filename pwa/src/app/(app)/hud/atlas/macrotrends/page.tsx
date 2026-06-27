"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  fetchAtlasDivergences,
  fetchAtlasSignals,
  fetchAtlasStories,
  type AtlasDivergenceWithTheme,
  type AtlasSignal,
  type AtlasStory,
} from "@/lib/supabase-data";
import { fetchSeedList } from "@/lib/seeds-data";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { ASPI_DOMAIN_LABEL_JP, LEGACY_LANE_TO_ASPI, type AspiDomainId } from "@/lib/aspi-lanes";
import type { SeedListItem } from "@/types/seeds";

type MacroIssue = {
  id: AspiDomainId;
  domain: AspiDomainId;
  title: string;
  summary: string;
  horizon: string;
  keywords: string[];
  authoritativeMap: string[];
  evidenceClaims: Array<{ source: string; claim: string; url: string }>;
  subIssues: Array<{ title: string; seedFit: string; seedKeywords: string[]; sourceLabel: string; sourceUrl: string; domains: AspiDomainId[] }>;
  thesis2030: string;
  thesis2040: string;
  thesis2050: string;
  coverageBasis: string;
  sourceUrls: Array<{ label: string; url: string }>;
};

type MacrotrendGroup = {
  issue: MacroIssue;
  storyMatches: AtlasStory[];
  signalMatches: AtlasSignal[];
  divergenceMatches: AtlasDivergenceWithTheme[];
  seedMatches: SeedListItem[];
  urgency: number;
  coverage: number;
};

type PaperRow = {
  lane: AspiDomainId | string;
  observed_at: string;
  paper_count: number;
};

type SubIssue = MacroIssue["subIssues"][number];

type SubIssueMetrics = {
  papers: number;
  news: number;
  divergences: number;
  seeds: number;
  momentum: number;
  coverage: number;
  gap: number;
  actionLabel: string;
  actionReason: string;
  intensity: "hot-gap" | "evidence" | "covered" | "watch";
};

type SelectedSubIssueDetail = {
  key: string;
  group: MacrotrendGroup;
  sub: SubIssue;
  metrics: SubIssueMetrics;
};

type MindmapGraphNode = {
  id: string;
  kind: "issue" | "sub";
  name: string;
  group: MacrotrendGroup;
  sub?: SubIssue;
  val: number;
  color: string;
  meta: string;
  paperCount?: number;
  metrics?: SubIssueMetrics;
  selected?: boolean;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
};

type MindmapGraphLink = {
  source: string;
  target: string;
  color: string;
  width: number;
};

const AUTHORITATIVE_BACKBONE = [
  {
    label: "UN 2030 Agenda / 17 SDGs",
    url: "https://sdgs.un.org/2030agenda",
    note: "17 Goals / 169 targets を掲げる普遍的Agenda。ASPI domain nodeへ重ねる世界課題ネットワークとして扱う。",
  },
  {
    label: "WEF Global Risks Report 2026",
    url: "https://www.weforum.org/publications/global-risks-report-2026/in-full/",
    note: "33 global risks の関係性を示すrisk network。5分類の根拠ではなく、ASPI domainに重なるリスクnodeとして見る。",
  },
  {
    label: "ASPI Critical Technology Tracker",
    url: "https://techtracker.aspi.org.au/our-reports",
    note: "74 critical technologies を high-impact researchで追う技術分類。AMD Score/M算定とMacrotrendのprimary taxonomyにする。",
  },
  {
    label: "OpenAlex Works API",
    url: "https://docs.openalex.org/api-entities/works/search-works",
    note: "papers_log はASPI domain別の検索クエリで OpenAlex works count を四半期取得し、各小項目nodeの papers 数へ反映する。",
  },
];

const MAP_MOTION_MS = 600;
const MAP_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
const LINKED_NODE_PULL_RATIO = 0.38;
const DRAG_CLICK_THRESHOLD = 3;
const SUB_KEY_SEPARATOR = "::";

const ASPI_DOMAIN_COLORS: Record<AspiDomainId, string> = {
  advanced_ict: "#38bdf8",
  advanced_materials_manufacturing: "#f59e0b",
  ai_technologies: "#a78bfa",
  biotechnology: "#34d399",
  defence_space_robotics_transport: "#fb7185",
  energy_environment: "#22c55e",
  quantum: "#818cf8",
  sensing_timing_navigation: "#2dd4bf",
};

const ATLAS_PREFIXES_BY_DOMAIN: Record<AspiDomainId, string[]> = {
  advanced_ict: ["I.", "R."],
  advanced_materials_manufacturing: ["C.", "E."],
  ai_technologies: ["I."],
  biotechnology: ["F."],
  defence_space_robotics_transport: ["G.", "J."],
  energy_environment: ["D.", "O.", "N."],
  quantum: ["P."],
  sensing_timing_navigation: ["Q."],
};

const SEED_DOMAIN_TO_ASPI: Record<string, AspiDomainId | null> = {
  ...LEGACY_LANE_TO_ASPI,
  ict: "advanced_ict",
  other: null,
};

const ISSUES: MacroIssue[] = [
  {
    id: "advanced_ict",
    domain: "advanced_ict",
    title: "通信・ICT",
    summary: "計算基盤、通信網、クラウド/エッジ、サイバーセキュリティを同じ観測laneで見る。",
    horizon: "2026 / 2030 / 2040",
    keywords: ["ict", "communication", "computing", "cloud", "edge", "cyber", "通信", "計算", "クラウド", "エッジ", "サイバー"],
    authoritativeMap: ["ASPI: advanced_ict", "WEF: cyber insecurity / infrastructure disruption", "UN SDG9", "UN SDG16", "UN SDG17"],
    evidenceClaims: [
      { source: "ASPI Critical Technology Tracker", claim: "Advanced ICT は計算、通信、分散台帳、サイバー防御などをまとめるASPI domain。AMD ScoreのM算定でも同じlaneを使う。", url: "https://techtracker.aspi.org.au/our-reports" },
      { source: "WEF Global Risks 2026", claim: "Cyber insecurity、critical infrastructure disruption、mis/disinformation と結びつく横断リスクとして扱う。", url: "https://www.weforum.org/publications/global-risks-report-2026/in-full/" },
    ],
    subIssues: [
      { title: "高性能計算・クラウド/エッジ", seedFit: "HPC、edge AI、低遅延処理、分散推論基盤", seedKeywords: ["HPC", "高性能計算", "クラウド", "エッジ", "edge", "computing"], sourceLabel: "ASPI Advanced ICT", sourceUrl: "https://techtracker.aspi.org.au/our-reports", domains: ["advanced_ict", "ai_technologies"] },
      { title: "光/無線/海底通信インフラ", seedFit: "光通信、RF、衛星/海底通信、耐障害ネットワーク", seedKeywords: ["光通信", "無線", "海底", "通信", "radiofrequency", "optical"], sourceLabel: "ASPI Advanced ICT", sourceUrl: "https://techtracker.aspi.org.au/our-reports", domains: ["advanced_ict", "sensing_timing_navigation"] },
      { title: "サイバー防御・分散台帳", seedFit: "認証、改ざん検知、ゼロトラスト、分散記録", seedKeywords: ["サイバー", "暗号", "認証", "分散台帳", "cyber", "ledger"], sourceLabel: "ASPI Advanced ICT", sourceUrl: "https://techtracker.aspi.org.au/our-reports", domains: ["advanced_ict"] },
    ],
    thesis2030: "AI利用増と地政学的分断で、計算資源・通信・サイバー防御が産業インフラになる。",
    thesis2040: "クラウド中心から、エッジ・衛星・海底・分散計算を組み合わせる耐障害ネットワークへ移る。",
    thesis2050: "情報通信は単独産業ではなく、全deeptechの観測・制御・安全保障レイヤーになる。",
    coverageBasis: "ASPI 8 domainの1つとしてM算定のlaneと一致。WEFのcyber / infrastructure / misinformation系riskを重ねる。",
    sourceUrls: [
      { label: "ASPI Critical Technology Tracker", url: "https://techtracker.aspi.org.au/our-reports" },
      { label: "OpenAlex Works", url: "https://docs.openalex.org/api-entities/works/search-works" },
    ],
  },
  {
    id: "advanced_materials_manufacturing",
    domain: "advanced_materials_manufacturing",
    title: "先端材料・製造",
    summary: "材料性能、重要鉱物、半導体、積層造形、製造プロセスを同じ観測laneで見る。",
    horizon: "2030 / 2040",
    keywords: ["materials", "manufacturing", "mineral", "semiconductor", "metamaterial", "素材", "材料", "製造", "鉱物", "半導体"],
    authoritativeMap: ["ASPI: advanced_materials_manufacturing", "WEF: strategic resources / supply chain", "UN SDG9", "UN SDG12"],
    evidenceClaims: [
      { source: "ASPI Critical Technology Tracker", claim: "Advanced materials and manufacturing は材料・製造技術のASPI domainで、AMDの既存PJ laneにも強く接続する。", url: "https://techtracker.aspi.org.au/our-reports" },
      { source: "WEF Global Risks 2026", claim: "Strategic resources and technologies、supply chain disruption、geoeconomic confrontation と重なる。", url: "https://www.weforum.org/publications/global-risks-report-2026/in-full/" },
    ],
    subIssues: [
      { title: "重要鉱物・分離精製", seedFit: "低使用量設計、分離精製、代替材料、回収技術", seedKeywords: ["鉱物", "分離", "精製", "回収", "critical minerals", "mineral"], sourceLabel: "ASPI Advanced Materials", sourceUrl: "https://techtracker.aspi.org.au/our-reports", domains: ["advanced_materials_manufacturing", "energy_environment"] },
      { title: "高機能材料・メタマテリアル", seedFit: "断熱、超電導、スマート材料、複合材、保護材料", seedKeywords: ["メタマテリアル", "複合材", "断熱", "超電導", "smart materials"], sourceLabel: "ASPI Advanced Materials", sourceUrl: "https://techtracker.aspi.org.au/our-reports", domains: ["advanced_materials_manufacturing"] },
      { title: "先端製造・積層造形", seedFit: "積層造形、精密加工、連続フロー合成、製造検査", seedKeywords: ["積層造形", "精密加工", "製造", "additive manufacturing", "machining"], sourceLabel: "ASPI Advanced Manufacturing", sourceUrl: "https://techtracker.aspi.org.au/our-reports", domains: ["advanced_materials_manufacturing", "sensing_timing_navigation"] },
    ],
    thesis2030: "材料供給制約と性能要求が、事業成立のボトルネックとして前面に出る。",
    thesis2040: "材料は性能だけでなく、調達可能性・製造可能性・循環可能性で評価される。",
    thesis2050: "先端材料と製造プロセスは、エネルギー、宇宙、防衛、医療の共通基盤になる。",
    coverageBasis: "ASPI 8 domainの材料/製造lane。旧materials/gx_circularの多くがここまたはenergy_environmentへ移行済み。",
    sourceUrls: [
      { label: "ASPI Critical Technology Tracker", url: "https://techtracker.aspi.org.au/our-reports" },
      { label: "ASPI Methodology", url: "https://techtracker.aspi.org.au/methodology" },
    ],
  },
  {
    id: "ai_technologies",
    domain: "ai_technologies",
    title: "AI",
    summary: "生成AI、機械学習、computer vision、AI hardware、adversarial AIを同じ観測laneで見る。",
    horizon: "2026 / 2030 / 2040",
    keywords: ["ai", "machine learning", "generative", "vision", "adversarial", "AI", "生成AI", "機械学習", "画像認識"],
    authoritativeMap: ["ASPI: ai_technologies", "WEF: adverse outcomes of AI / misinformation", "UN SDG8", "UN SDG9"],
    evidenceClaims: [
      { source: "ASPI Critical Technology Tracker", claim: "AI technologies はAI algorithms、hardware accelerators、advanced analytics、NLP、computer vision、generative AIを含むASPI domain。", url: "https://techtracker.aspi.org.au/our-reports" },
      { source: "WEF Global Risks 2026", claim: "AIはfrontier technology risk、mis/disinformation、talent and labour shiftsと接続する。", url: "https://www.weforum.org/publications/global-risks-report-2026/in-full/" },
    ],
    subIssues: [
      { title: "生成AI・基盤モデル", seedFit: "業務自動化、設計支援、科学探索、生成AI安全性", seedKeywords: ["生成AI", "基盤モデル", "LLM", "generative", "language model"], sourceLabel: "ASPI AI Technologies", sourceUrl: "https://techtracker.aspi.org.au/our-reports", domains: ["ai_technologies", "advanced_ict"] },
      { title: "Computer vision・高度分析", seedFit: "検査、医療画像、環境監視、現場認識", seedKeywords: ["画像認識", "検査", "vision", "analytics", "computer vision"], sourceLabel: "ASPI AI Technologies", sourceUrl: "https://techtracker.aspi.org.au/our-reports", domains: ["ai_technologies", "sensing_timing_navigation"] },
      { title: "Adversarial AI・信頼性", seedFit: "安全評価、異常検知、検証、攻撃耐性", seedKeywords: ["adversarial", "AI安全", "信頼性", "異常検知", "safety"], sourceLabel: "ASPI AI Technologies", sourceUrl: "https://techtracker.aspi.org.au/our-reports", domains: ["ai_technologies", "advanced_ict"] },
    ],
    thesis2030: "生成AIは情報処理だけでなく、設計・研究・現場判断の標準機能になる。",
    thesis2040: "AIは物理世界のセンサ、ロボット、材料探索、医療判断へ深く入り込む。",
    thesis2050: "AIの価値は性能だけでなく、信頼性・安全性・検証可能性で決まる。",
    coverageBasis: "ASPI 8 domainのAI lane。Macrotrendでは独自5分類ではなく、M算定と同じlaneでpapers_logを読む。",
    sourceUrls: [
      { label: "ASPI Critical Technology Tracker", url: "https://techtracker.aspi.org.au/our-reports" },
      { label: "WEF Global Risks Report 2026", url: "https://www.weforum.org/publications/global-risks-report-2026/in-full/" },
    ],
  },
  {
    id: "biotechnology",
    domain: "biotechnology",
    title: "バイオ・医療",
    summary: "創薬、合成生物学、ゲノム、ワクチン、再生医療、BCI/神経補綴を同じ観測laneで見る。",
    horizon: "2030 / 2040 / 2050",
    keywords: ["bio", "biotechnology", "medical", "health", "genome", "synthetic biology", "バイオ", "医療", "創薬", "ゲノム", "再生医療"],
    authoritativeMap: ["ASPI: biotechnology", "WEF: infectious diseases / health decline", "UN SDG3", "UN SDG10"],
    evidenceClaims: [
      { source: "ASPI Critical Technology Tracker", claim: "Biotechnology はsynthetic biology、genetic engineering、genomic sequencing、vaccines、neuroprostheticsなどを含むASPI domain。", url: "https://techtracker.aspi.org.au/our-reports" },
      { source: "UN 2030 Agenda", claim: "健康、福祉、格差、医療アクセスの課題をdeeptech seedへ接続する観測laneとして扱う。", url: "https://sdgs.un.org/2030agenda" },
    ],
    subIssues: [
      { title: "創薬・ゲノム・遺伝子技術", seedFit: "創薬AI、ゲノム解析、遺伝子治療、核医学", seedKeywords: ["創薬", "ゲノム", "遺伝子", "drug discovery", "genomic", "gene therapy"], sourceLabel: "ASPI Biotechnology", sourceUrl: "https://techtracker.aspi.org.au/our-reports", domains: ["biotechnology", "ai_technologies"] },
      { title: "合成生物学・バイオ製造", seedFit: "微生物生産、バイオ素材、ワクチン/抗ウイルス", seedKeywords: ["合成生物学", "バイオ製造", "ワクチン", "synthetic biology", "vaccine"], sourceLabel: "ASPI Biotechnology", sourceUrl: "https://techtracker.aspi.org.au/our-reports", domains: ["biotechnology", "advanced_materials_manufacturing"] },
      { title: "再生医療・神経補綴", seedFit: "再生医療、BCI、リハビリ、身体/認知機能支援", seedKeywords: ["再生医療", "神経", "リハビリ", "BCI", "neuroprosthetics"], sourceLabel: "ASPI Biotechnology", sourceUrl: "https://techtracker.aspi.org.au/our-reports", domains: ["biotechnology", "sensing_timing_navigation"] },
    ],
    thesis2030: "創薬・診断・バイオ製造のデータ駆動化が進む。",
    thesis2040: "医療は治療中心から、予測・予防・機能維持へ比重が移る。",
    thesis2050: "バイオ技術は医療だけでなく、材料、食料、環境適応の基盤技術になる。",
    coverageBasis: "ASPI 8 domainのバイオlane。旧life laneと接続しつつ、ケア/健康リスクはUN/WEF overlayとして扱う。",
    sourceUrls: [
      { label: "ASPI Critical Technology Tracker", url: "https://techtracker.aspi.org.au/our-reports" },
      { label: "UN 2030 Agenda", url: "https://sdgs.un.org/2030agenda" },
    ],
  },
  {
    id: "defence_space_robotics_transport",
    domain: "defence_space_robotics_transport",
    title: "防衛・宇宙・ロボ",
    summary: "ロボティクス、ドローン、宇宙、輸送、防衛技術を同じ観測laneで見る。",
    horizon: "2026 / 2030 / 2040",
    keywords: ["robot", "space", "defence", "transport", "drone", "satellite", "ロボ", "宇宙", "防衛", "ドローン", "輸送"],
    authoritativeMap: ["ASPI: defence_space_robotics_transport", "WEF: armed conflict / infrastructure / strategic technologies", "UN SDG9", "UN SDG11"],
    evidenceClaims: [
      { source: "ASPI Critical Technology Tracker", claim: "Defence, space, robotics and transport はadvanced robotics、autonomous systems、drones、small satellites、space launchなどを含む。", url: "https://techtracker.aspi.org.au/our-reports" },
      { source: "WEF Global Risks 2026", claim: "State-based conflict、critical infrastructure disruption、strategic technologies concentrationと重なる。", url: "https://www.weforum.org/publications/global-risks-report-2026/in-full/" },
    ],
    subIssues: [
      { title: "自律ロボ・ドローン群", seedFit: "現場ロボ、群制御、遠隔操作、農業/点検ロボ", seedKeywords: ["ロボ", "ドローン", "群制御", "自律", "robot", "drone"], sourceLabel: "ASPI Robotics", sourceUrl: "https://techtracker.aspi.org.au/our-reports", domains: ["defence_space_robotics_transport", "ai_technologies"] },
      { title: "小型衛星・宇宙輸送", seedFit: "衛星通信、リモートセンシング、打上げ、宇宙データ", seedKeywords: ["衛星", "宇宙", "打上げ", "satellite", "space launch"], sourceLabel: "ASPI Space", sourceUrl: "https://techtracker.aspi.org.au/our-reports", domains: ["defence_space_robotics_transport", "sensing_timing_navigation", "advanced_ict"] },
      { title: "防衛・高速輸送技術", seedFit: "先進エンジン、極超音速、耐障害輸送、安全保障用途", seedKeywords: ["防衛", "輸送", "エンジン", "極超音速", "hypersonic"], sourceLabel: "ASPI Defence / Transport", sourceUrl: "https://techtracker.aspi.org.au/our-reports", domains: ["defence_space_robotics_transport", "advanced_materials_manufacturing"] },
    ],
    thesis2030: "ロボットと宇宙データが、人手不足・安全保障・インフラ点検の共通解になる。",
    thesis2040: "自律システムは単体機械ではなく、AI/通信/センサと結合した運用ネットワークになる。",
    thesis2050: "宇宙・防衛・ロボ技術は民生インフラの安全性と競争力にも深く接続する。",
    coverageBasis: "ASPI 8 domainの防衛/宇宙/ロボlane。旧robo laneの受け皿だが、AI/ICT/センシングとの重複はnode edgeで表現する。",
    sourceUrls: [
      { label: "ASPI Critical Technology Tracker", url: "https://techtracker.aspi.org.au/our-reports" },
      { label: "WEF Global Risks Report 2026", url: "https://www.weforum.org/publications/global-risks-report-2026/in-full/" },
    ],
  },
  {
    id: "energy_environment",
    domain: "energy_environment",
    title: "エネルギー・環境",
    summary: "電池、水素、再エネ、核、グリッド、炭素回収、循環、気候適応を同じ観測laneで見る。",
    horizon: "2030 / 2040 / 2050",
    keywords: ["energy", "environment", "battery", "hydrogen", "grid", "renewable", "climate", "エネルギー", "環境", "電池", "水素", "グリッド", "再エネ", "気候"],
    authoritativeMap: ["ASPI: energy_environment", "WEF: extreme weather / resources / infrastructure", "UN SDG6", "UN SDG7", "UN SDG13"],
    evidenceClaims: [
      { source: "ASPI Critical Technology Tracker", claim: "Energy and environment は電池、水素/アンモニア、核、太陽光、supercapacitors、grid integration、geoengineeringを含む。", url: "https://techtracker.aspi.org.au/our-reports" },
      { source: "WEF Global Risks 2026", claim: "Extreme weather、natural resource shortages、critical infrastructure disruptionと重なる。", url: "https://www.weforum.org/publications/global-risks-report-2026/in-full/" },
    ],
    subIssues: [
      { title: "電池・supercapacitor・蓄電", seedFit: "次世代電池、蓄電制御、電力変換、材料リサイクル", seedKeywords: ["電池", "蓄電", "supercapacitor", "battery", "storage"], sourceLabel: "ASPI Energy / Environment", sourceUrl: "https://techtracker.aspi.org.au/our-reports", domains: ["energy_environment", "advanced_materials_manufacturing"] },
      { title: "水素・アンモニア・核エネルギー", seedFit: "水素製造、アンモニア利用、核融合/核廃棄物、熱変換", seedKeywords: ["水素", "アンモニア", "核", "核融合", "hydrogen", "ammonia", "nuclear"], sourceLabel: "ASPI Energy / Environment", sourceUrl: "https://techtracker.aspi.org.au/our-reports", domains: ["energy_environment", "advanced_materials_manufacturing"] },
      { title: "グリッド統合・再エネ制約", seedFit: "系統制御、需要応答、再エネ予測、出力抑制対策", seedKeywords: ["グリッド", "系統", "再エネ", "需要応答", "grid", "renewable"], sourceLabel: "ASPI Grid Integration", sourceUrl: "https://techtracker.aspi.org.au/our-reports", domains: ["energy_environment", "advanced_ict", "ai_technologies"] },
      { title: "炭素回収・循環・地球工学", seedFit: "CCUS、資源循環、環境計測、気候適応", seedKeywords: ["炭素", "循環", "CCUS", "気候", "geoengineering", "circular"], sourceLabel: "ASPI Energy / Environment", sourceUrl: "https://techtracker.aspi.org.au/our-reports", domains: ["energy_environment", "sensing_timing_navigation"] },
    ],
    thesis2030: "電力需要増、再エネ接続、重要鉱物、気候リスクが同時に制約として現れる。",
    thesis2040: "発電量よりも、需給調整・蓄電・系統制御・資源循環が競争力になる。",
    thesis2050: "エネルギー/環境技術は社会インフラ、産業立地、都市運営の前提条件になる。",
    coverageBasis: "ASPI 8 domainのenergy_environment lane。旧gx_energy/gx_circularの主な受け皿で、M算定とMacrotrendを一致させる。",
    sourceUrls: [
      { label: "ASPI Critical Technology Tracker", url: "https://techtracker.aspi.org.au/our-reports" },
      { label: "UN 2030 Agenda", url: "https://sdgs.un.org/2030agenda" },
    ],
  },
  {
    id: "quantum",
    domain: "quantum",
    title: "量子",
    summary: "量子計算、量子通信、量子センサ、ポスト量子暗号を同じ観測laneで見る。",
    horizon: "2030 / 2040",
    keywords: ["quantum", "post-quantum", "量子", "量子計算", "量子通信", "量子センサ", "暗号"],
    authoritativeMap: ["ASPI: quantum", "WEF: frontier technologies / cyber security", "UN SDG9"],
    evidenceClaims: [
      { source: "ASPI Critical Technology Tracker", claim: "Quantum はquantum computing、communication、sensors、post-quantum cryptographyを含むASPI domain。", url: "https://techtracker.aspi.org.au/our-reports" },
      { source: "WEF Global Risks 2026", claim: "Frontier technology outcomes、cyber insecurity、strategic technology concentrationと接続する。", url: "https://www.weforum.org/publications/global-risks-report-2026/in-full/" },
    ],
    subIssues: [
      { title: "量子計算", seedFit: "量子アルゴリズム、材料探索、最適化、誤り訂正", seedKeywords: ["量子計算", "量子アルゴリズム", "quantum computing", "error correction"], sourceLabel: "ASPI Quantum", sourceUrl: "https://techtracker.aspi.org.au/our-reports", domains: ["quantum", "advanced_ict"] },
      { title: "量子通信・ポスト量子暗号", seedFit: "暗号移行、量子鍵配送、通信安全性", seedKeywords: ["量子通信", "ポスト量子", "暗号", "quantum communication", "post-quantum"], sourceLabel: "ASPI Quantum", sourceUrl: "https://techtracker.aspi.org.au/our-reports", domains: ["quantum", "advanced_ict"] },
      { title: "量子センサ", seedFit: "高感度計測、医療/資源探査、測位、環境検知", seedKeywords: ["量子センサ", "計測", "測位", "quantum sensor"], sourceLabel: "ASPI Quantum", sourceUrl: "https://techtracker.aspi.org.au/our-reports", domains: ["quantum", "sensing_timing_navigation"] },
    ],
    thesis2030: "量子はまだ事業化の不確実性が高いが、暗号・計測・最適化で早期用途が出る。",
    thesis2040: "量子計算と量子センサが材料、医療、資源、安全保障の探索能力を変える。",
    thesis2050: "量子は独立市場というより、計算・通信・計測の基盤技術として埋め込まれる。",
    coverageBasis: "ASPI 8 domainのquantum lane。既存PJは少ないが、M算定ではpapers_log/observation_logの独立laneとして保持する。",
    sourceUrls: [
      { label: "ASPI Critical Technology Tracker", url: "https://techtracker.aspi.org.au/our-reports" },
      { label: "OpenAlex Works", url: "https://docs.openalex.org/api-entities/works/search-works" },
    ],
  },
  {
    id: "sensing_timing_navigation",
    domain: "sensing_timing_navigation",
    title: "センシング",
    summary: "光センサ、レーダ、測位、原子時計、ハイパースペクトル、音響センサを同じ観測laneで見る。",
    horizon: "2030 / 2040",
    keywords: ["sensor", "sensing", "radar", "navigation", "timing", "photonic", "センシング", "センサ", "レーダ", "測位", "計測"],
    authoritativeMap: ["ASPI: sensing_timing_navigation", "WEF: infrastructure / climate / security monitoring", "UN SDG9", "UN SDG11", "UN SDG13"],
    evidenceClaims: [
      { source: "ASPI Critical Technology Tracker", claim: "Sensing, timing and navigation はatomic clocks、radar、photonic sensors、satellite positioning、hyperspectral imagingなどを含む。", url: "https://techtracker.aspi.org.au/our-reports" },
      { source: "UN 2030 Agenda", claim: "都市、インフラ、気候、健康、海洋などの課題を観測可能にする横断レイヤーとして扱う。", url: "https://sdgs.un.org/2030agenda" },
    ],
    subIssues: [
      { title: "光/レーダ/ハイパースペクトル計測", seedFit: "非破壊検査、環境監視、医療画像、農業センシング", seedKeywords: ["光センサ", "レーダ", "ハイパースペクトル", "検査", "photonic", "radar"], sourceLabel: "ASPI Sensing", sourceUrl: "https://techtracker.aspi.org.au/our-reports", domains: ["sensing_timing_navigation", "ai_technologies"] },
      { title: "測位・航法・原子時計", seedFit: "衛星測位、慣性航法、時刻同期、インフラ監視", seedKeywords: ["測位", "航法", "原子時計", "GNSS", "navigation", "atomic clock"], sourceLabel: "ASPI Timing / Navigation", sourceUrl: "https://techtracker.aspi.org.au/our-reports", domains: ["sensing_timing_navigation", "defence_space_robotics_transport"] },
      { title: "社会/環境の早期警戒", seedFit: "災害予測、水/土壌監視、設備異常検知、見守り", seedKeywords: ["早期警戒", "災害", "環境監視", "異常検知", "見守り"], sourceLabel: "ASPI Sensing", sourceUrl: "https://techtracker.aspi.org.au/our-reports", domains: ["sensing_timing_navigation", "energy_environment", "biotechnology"] },
    ],
    thesis2030: "センサとAIで、点検・医療・環境・防災の観測密度が上がる。",
    thesis2040: "社会インフラは事後対応から、連続観測と予兆介入へ移る。",
    thesis2050: "センシングはあらゆるdeeptechの状態把握と制御の基盤になる。",
    coverageBasis: "ASPI 8 domainのsensing/timing/navigation lane。Macrotrend mapでは他domainとのedgeが多い横断観測レイヤーとして扱う。",
    sourceUrls: [
      { label: "ASPI Critical Technology Tracker", url: "https://techtracker.aspi.org.au/our-reports" },
      { label: "OpenAlex Works", url: "https://docs.openalex.org/api-entities/works/search-works" },
    ],
  },
];

export default function MacrotrendsPage() {
  const pathname = usePathname();
  const atlasBase = pathname.startsWith("/hud/") ? "/hud/atlas" : "/atlas";
  const seedsBase = pathname.startsWith("/hud/") ? "/hud/seeds" : "/seeds";
  const [stories, setStories] = useState<AtlasStory[]>([]);
  const [signals, setSignals] = useState<AtlasSignal[]>([]);
  const [divergences, setDivergences] = useState<AtlasDivergenceWithTheme[]>([]);
  const [seeds, setSeeds] = useState<SeedListItem[]>([]);
  const [papers, setPapers] = useState<PaperRow[]>([]);
  const [selected, setSelected] = useState<AspiDomainId>(ISSUES[0].id);
  const [selectedSubKey, setSelectedSubKey] = useState<string | null>(() => subKeyFor(ISSUES[0].id, ISSUES[0].subIssues[0].title));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserClient();
    Promise.all([
      fetchAtlasStories({ limit: 500 }),
      fetchAtlasSignals("accepted"),
      fetchAtlasDivergences(),
      fetchSeedList(),
      supabase.from("papers_log").select("lane, observed_at, paper_count").order("observed_at", { ascending: true }),
    ]).then(([storyRows, signalRows, divergenceRows, seedRows, paperRes]) => {
      setStories(storyRows);
      setSignals(signalRows);
      setDivergences(divergenceRows);
      setSeeds(seedRows);
      setPapers(((paperRes.data ?? []) as PaperRow[]).map((row) => ({ ...row, paper_count: Number(row.paper_count) || 0 })));
    }).finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    return ISSUES.map((issue) => {
      const storyMatches = stories.filter((story) => matchesDomainIssue(issue, [story.title, story.summary || "", story.tags.join(" "), story.primary_domain || ""]) || atlasDomainMatches(issue, story.primary_domain));
      const signalMatches = signals.filter((signal) => matchesDomainIssue(issue, [signal.title, signal.content, signal.domain || "", signal.suggested_tags.join(" ")]) || atlasDomainMatches(issue, signal.domain));
      const divergenceMatches = divergences.filter((div) => matchesDomainIssue(issue, [div.theme.name, div.theme.description || "", div.divergence_message || "", div.global_summary || "", div.japan_summary || ""]) || atlasDomainMatches(issue, div.theme.primary_domain));
      const seedMatches = seeds.filter((seed) => seedMatchesDomain(issue, seed));
      const urgency = Math.min(99, 38 + storyMatches.length * 4 + signalMatches.filter((s) => s.importance === "high").length * 7 + divergenceMatches.length * 5);
      const coverage = Math.min(99, 24 + seedMatches.length * 5);
      return { issue, storyMatches, signalMatches, divergenceMatches, seedMatches, urgency, coverage };
    });
  }, [stories, signals, divergences, seeds]);

  const activeIndex = Math.max(0, grouped.findIndex((g) => g.issue.id === selected));
  const active = grouped[activeIndex] || grouped[0];
  const activeNo = activeIndex + 1;
  const selectedSubDetail = useMemo(() => findSelectedSubIssue(grouped, selectedSubKey, papers), [grouped, papers, selectedSubKey]);
  const handleSelectDomain = (id: AspiDomainId) => {
    setSelected(id);
    setSelectedSubKey(null);
  };
  const handleSelectMapNode = (id: AspiDomainId, subTitle?: string) => {
    setSelected(id);
    setSelectedSubKey(subTitle ? subKeyFor(id, subTitle) : null);
  };
  const evidenceSummary = useMemo(() => {
    const lanes = new Set(papers.map((p) => p.lane));
    const latestPaperAt = papers.reduce((latest, row) => row.observed_at > latest ? row.observed_at : latest, "");
    return {
      signals: signals.length,
      stories: stories.length,
      divergences: divergences.length,
      seeds: seeds.length,
      paperLanes: lanes.size,
      latestPaperAt,
    };
  }, [divergences.length, papers, seeds.length, signals.length, stories.length]);

  if (loading) {
    return <div className="grid h-[calc(100vh-4rem)] place-items-center text-sm text-cyan-100/70">Macrotrend map loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[#020812] px-4 py-5 text-cyan-50">
      <div className="mx-auto max-w-[1700px] space-y-4">
        <header className="border border-cyan-300/24 bg-cyan-300/5 p-4 shadow-[inset_0_0_28px_rgba(50,231,255,.08)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300/70">Macrotrend / Atlas / Seeds</p>
              <h1 className="mt-1 text-2xl font-black tracking-[0.03em] text-cyan-50">ASPI 8 domainで見るMacrotrend Map</h1>
              <p className="mt-2 max-w-4xl text-sm leading-relaxed text-cyan-100/68">AMD ScoreのM算定と同じ8分類を主nodeにし、WEF/UN risk network・Atlas evidence・Seeds・OpenAlex papers を重ねる。</p>
            </div>
            <div className="flex gap-2 text-xs font-bold">
              <Link href={`${atlasBase}/divergence`} className="border border-cyan-300/28 px-3 py-2 text-cyan-100/80 hover:bg-cyan-300/10">Divergence</Link>
              <Link href={seedsBase} className="border border-cyan-300/28 px-3 py-2 text-cyan-100/80 hover:bg-cyan-300/10">Seeds</Link>
            </div>
          </div>
        </header>

        <section className="grid gap-3 xl:grid-cols-[1fr_390px]">
          <section className="border border-cyan-300/20 bg-cyan-300/4 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-mono text-[12px] font-black uppercase tracking-[0.14em] text-cyan-300">Macrotrend Mindmap / ASPI Domain → Issue Node</h3>
                <p className="mt-1 text-xs leading-relaxed text-cyan-100/56">
                  ASPI 8 domainと課題nodeを初期表示。小項目nodeにpapers / news / diff / seeds / gap / actionを載せ、右側で次のAMD actionへ落とす。
                </p>
              </div>
              <div className="border border-cyan-300/18 bg-[#020812]/70 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-cyan-200/62">
                Atlas Map feel / 600ms focus motion
              </div>
            </div>
            <div className="mt-3 overflow-hidden border border-cyan-300/14 bg-[#020812]/78">
              <MacrotrendMindmap groups={grouped} papers={papers} selectedId={active.issue.id} selectedSubKey={selectedSubKey} onSelect={handleSelectMapNode} />
            </div>
          </section>

          <aside className="space-y-3">
            <MacrotrendDecisionPanel
              group={active}
              selectedSubDetail={selectedSubDetail}
              papers={papers}
              atlasBase={atlasBase}
              seedsBase={seedsBase}
              onSelectSub={(id, subTitle) => handleSelectMapNode(id, subTitle)}
            />
            <div className="grid grid-cols-2 gap-2">
            {grouped.map((g, issueIndex) => (
              <button
                key={g.issue.id}
                type="button"
                onClick={() => handleSelectDomain(g.issue.id)}
                className={`min-h-[104px] border p-2.5 text-left transition ${selected === g.issue.id ? "border-cyan-300/62 bg-cyan-300/10" : "border-cyan-300/18 bg-cyan-300/4 hover:bg-cyan-300/8"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-xs font-black leading-snug text-cyan-50"><span className="mr-1.5 font-mono text-cyan-300">{issueIndex + 1}.</span>{g.issue.title}</h2>
                  <span className="font-mono text-[9px] text-cyan-300/60">{g.issue.subIssues.length} nodes</span>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1 font-mono text-[9px] text-cyan-100/70">
                  <Metric label="atlas" value={g.signalMatches.length} />
                  <Metric label="diff" value={g.divergenceMatches.length} />
                  <Metric label="seeds" value={g.seedMatches.length} />
                  <Metric label="gap" value={domainGapScore(g, papers)} />
                </div>
              </button>
            ))}
            </div>
          </aside>
        </section>

        <section className="grid gap-3 xl:grid-cols-[1fr_420px]">
          <section className="border border-cyan-300/24 bg-cyan-300/5 p-4">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] font-black uppercase tracking-[0.18em] text-cyan-300/70">Selected ASPI Domain</p>
                <h2 className="mt-1 text-xl font-black text-cyan-50"><span className="mr-2 font-mono text-cyan-300">{activeNo}.</span>{active.issue.title}</h2>
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <Gauge label="urgency" value={active.urgency} />
                <Gauge label="seed cover" value={active.coverage} />
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Thesis year="2030" text={active.issue.thesis2030} />
              <Thesis year="2040" text={active.issue.thesis2040} />
              <Thesis year="2050" text={active.issue.thesis2050} />
            </div>
            <div className="mt-3 border border-cyan-300/16 bg-[#020812]/72 p-3">
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300/64">Coverage Basis</p>
              <p className="mt-1 text-xs leading-relaxed text-cyan-100/70">{active.issue.coverageBasis}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {active.issue.authoritativeMap.map((tag) => (
                  <span key={tag} className="border border-cyan-300/18 bg-cyan-300/7 px-2 py-1 font-mono text-[10px] text-cyan-100/70">{tag}</span>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {active.issue.sourceUrls.map((s) => (
                  <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="border border-cyan-300/22 px-2 py-1 font-mono text-[10px] text-cyan-100/76 hover:bg-cyan-300/10">
                    {s.label}
                  </a>
                ))}
              </div>
            </div>
          </section>

          <section className="border border-cyan-300/20 bg-cyan-300/4 p-3">
            <p className="font-mono text-[11px] font-black uppercase tracking-[0.18em] text-cyan-300/70">What The Sources Say</p>
            <div className="mt-2 grid gap-2">
              {active.issue.evidenceClaims.map((claim) => (
                <a key={`${claim.source}-${claim.url}`} href={claim.url} target="_blank" rel="noreferrer" className="border border-cyan-300/14 bg-cyan-300/4 p-2 hover:bg-cyan-300/8">
                  <p className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-cyan-300/70">{claim.source}</p>
                  <p className="mt-1 text-xs leading-relaxed text-cyan-100/68">{claim.claim}</p>
                </a>
              ))}
            </div>
          </section>
        </section>

        <TaxonomyAlignmentSection grouped={grouped} papers={papers} evidenceSummary={evidenceSummary} />

        <section className="grid gap-3 lg:grid-cols-3">
          <EvidencePanel title="Atlas Evidence" items={active.signalMatches.slice(0, 8).map((s) => ({ title: s.title, meta: `${s.importance} / ${s.source_type || "signal"}`, href: s.source_url || `${atlasBase}/inbox` }))} />
          <EvidencePanel title="World / Japan Divergence" items={active.divergenceMatches.slice(0, 8).map((d) => ({ title: d.theme.name, meta: `gap ${Math.round(d.divergence_score)} / global ${d.global_signal_count} / jp ${d.japan_signal_count}`, href: `${atlasBase}/divergence` }))} />
          <EvidencePanel title="Seeds by Issue" items={active.seedMatches.slice(0, 8).map((s) => ({ title: s.title, meta: `${s.org_name} / ${s.domain_lane || "lane?"}`, href: `${seedsBase}/${s.id}` }))} />
        </section>
      </div>
    </div>
  );
}

function MacrotrendDecisionPanel({
  group,
  selectedSubDetail,
  papers,
  atlasBase,
  seedsBase,
  onSelectSub,
}: {
  group: MacrotrendGroup;
  selectedSubDetail: SelectedSubIssueDetail | null;
  papers: PaperRow[];
  atlasBase: string;
  seedsBase: string;
  onSelectSub: (id: AspiDomainId, subTitle: string) => void;
}) {
  const focus = selectedSubDetail?.group.issue.id === group.issue.id ? selectedSubDetail : null;
  const rankedSubIssues = group.issue.subIssues
    .map((sub, subIndex) => ({ sub, metrics: subIssueMetrics(group, sub, papers, subIndex) }))
    .sort((a, b) => b.metrics.gap + b.metrics.momentum - (a.metrics.gap + a.metrics.momentum))
    .slice(0, 3);
  const domainGap = domainGapScore(group, papers);

  return (
    <section className="border border-cyan-300/24 bg-cyan-300/5 p-3 shadow-[inset_0_0_28px_rgba(50,231,255,.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300/68">Decision Lens</p>
          <h2 className="mt-1 text-base font-black text-cyan-50">{focus ? focus.sub.title : group.issue.title}</h2>
        </div>
        <span className="border border-amber-200/26 bg-amber-200/9 px-2 py-1 font-mono text-[10px] font-black text-amber-100">
          gap {focus ? focus.metrics.gap : domainGap}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[10px] text-cyan-100/72">
        {focus ? (
          <>
            <Metric label="papers" value={focus.metrics.papers} />
            <Metric label="news" value={focus.metrics.news} />
            <Metric label="diff" value={focus.metrics.divergences} />
            <Metric label="seeds" value={focus.metrics.seeds} />
            <Metric label="moment" value={focus.metrics.momentum} />
            <Metric label="cover" value={focus.metrics.coverage} />
          </>
        ) : (
          <>
            <Metric label="atlas" value={group.signalMatches.length} />
            <Metric label="stories" value={group.storyMatches.length} />
            <Metric label="diff" value={group.divergenceMatches.length} />
            <Metric label="seeds" value={group.seedMatches.length} />
            <Metric label="nodes" value={group.issue.subIssues.length} />
            <Metric label="gap" value={domainGap} />
          </>
        )}
      </div>

      <div className="mt-3 border border-cyan-300/16 bg-[#020812]/72 p-3">
        <p className="font-mono text-[10px] font-black uppercase tracking-[0.14em] text-cyan-300/62">Purpose → Design</p>
        <p className="mt-1 text-xs leading-relaxed text-cyan-100/70">
          世界変化をASPI domainで揃え、issue nodeごとに研究量・Atlas反応・日本gap・Seeds被覆を重ねて、AMDが次に掘る仮説を決める。
        </p>
      </div>

      {focus ? (
        <div className="mt-3 space-y-2">
          <div className="border border-amber-200/18 bg-amber-200/8 p-3">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.14em] text-amber-100/72">Next AMD Action</p>
            <p className="mt-1 text-sm font-black text-amber-50">{focus.metrics.actionLabel}</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-50/68">{focus.metrics.actionReason}</p>
          </div>
          <p className="text-xs leading-relaxed text-cyan-100/68">{focus.sub.seedFit}</p>
          <div className="flex flex-wrap gap-1.5">
            {focus.sub.domains.map((domain) => (
              <span key={domain} className="border border-cyan-300/16 bg-cyan-300/7 px-2 py-1 font-mono text-[9px] text-cyan-100/68">{ASPI_DOMAIN_LABEL_JP[domain]}</span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={focus.sub.sourceUrl} target="_blank" rel="noreferrer" className="border border-cyan-300/22 px-2 py-1 font-mono text-[10px] text-cyan-100/76 hover:bg-cyan-300/10">
              {focus.sub.sourceLabel}
            </a>
            <Link href={atlasBase} className="border border-cyan-300/22 px-2 py-1 font-mono text-[10px] text-cyan-100/76 hover:bg-cyan-300/10">Atlas</Link>
            <Link href={seedsBase} className="border border-cyan-300/22 px-2 py-1 font-mono text-[10px] text-cyan-100/76 hover:bg-cyan-300/10">Seeds</Link>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-xs leading-relaxed text-cyan-100/68">{group.issue.summary}</p>
          {rankedSubIssues.map((entry, index) => (
            <button
              key={entry.sub.title}
              type="button"
              onClick={() => onSelectSub(group.issue.id, entry.sub.title)}
              className="block w-full border border-cyan-300/16 bg-[#020812]/72 px-3 py-2 text-left hover:bg-cyan-300/8"
            >
              <p className="font-mono text-[9px] font-black uppercase tracking-[0.12em] text-cyan-300/58">priority node {index + 1} / gap {entry.metrics.gap}</p>
              <p className="mt-1 text-xs font-bold text-cyan-50">{entry.sub.title}</p>
              <p className="mt-1 font-mono text-[9px] text-cyan-100/56">p {entry.metrics.papers.toLocaleString()} / n {entry.metrics.news} / d {entry.metrics.divergences} / s {entry.metrics.seeds}</p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function MacrotrendMindmap({
  groups,
  papers,
  selectedId,
  selectedSubKey,
  onSelect,
}: {
  groups: MacrotrendGroup[];
  papers: PaperRow[];
  selectedId: AspiDomainId;
  selectedSubKey: string | null;
  onSelect: (id: AspiDomainId, subTitle?: string) => void;
}) {
  const allDomainIds = useMemo(() => new Set(groups.map((group) => group.issue.id)), [groups]);
  const [expandedIssueIds, setExpandedIssueIds] = useState<Set<string>>(() => new Set(groups.map((group) => group.issue.id)));
  const [expandedSubKeys, setExpandedSubKeys] = useState<Set<string>>(new Set());
  const [size, setSize] = useState({ w: 960, h: 620 });
  const [viewportOffset, setViewportOffset] = useState({ x: 0, y: 0 });
  const [nodeOffsets, setNodeOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingMode, setDraggingMode] = useState<"map" | "node" | null>(null);
  const dragRef = useRef<{ mode: "map" | "node"; id?: string; x: number; y: number; moved: number } | null>(null);
  const lastDragMovedRef = useRef(0);
  const suppressClickUntilRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const activeGroup = groups.find((g) => g.issue.id === selectedId) || groups[0];
  const topBranches = activeGroup.issue.subIssues
    .map((sub, subIndex) => ({ sub, metrics: subIssueMetrics(activeGroup, sub, papers, subIndex) }))
    .sort((a, b) => b.metrics.gap + b.metrics.momentum - (a.metrics.gap + a.metrics.momentum))
    .slice(0, 3);
  const handleIssueClick = (id: AspiDomainId) => {
    setExpandedIssueIds((current) => new Set(current).add(id));
    onSelect(id);
  };
  const handleSubClick = (key: string) => {
    const parsed = parseSubKey(key);
    if (!parsed) return;
    setExpandedSubKeys((current) => new Set(current).add(key));
    onSelect(parsed.domain, parsed.title);
  };
  const data = useMemo(
    () => buildMindmapGraph(groups, papers, expandedIssueIds, expandedSubKeys, selectedSubKey),
    [expandedIssueIds, expandedSubKeys, groups, papers, selectedSubKey]
  );

  useEffect(() => {
    setExpandedIssueIds((current) => {
      let changed = false;
      const next = new Set(current);
      for (const id of allDomainIds) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [allDomainIds]);

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setSize({ w: Math.max(420, rect.width), h: Math.max(560, rect.height) });
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    if (!fgRef.current) return;
    const fg = fgRef.current;
    for (const node of data.nodes) {
      const n = node as MindmapGraphNode & { x?: number; y?: number; vx?: number; vy?: number };
      if (n.fx != null && n.fy != null) continue;
      if (Number.isFinite(node.x) && Number.isFinite(node.y)) {
        n.x = node.x;
        n.y = node.y;
      }
      n.vx = (n.vx || 0) * 0.2;
      n.vy = (n.vy || 0) * 0.2;
    }
    fg.d3Force("center", null);
    fg.d3Force("collideMacro", null);
    if (fg.d3Force("charge")) fg.d3Force("charge").strength(-360);
    if (fg.d3Force("link")) {
      fg.d3Force("link")
        .distance((link: MindmapGraphLink) => 126 + link.width * 26)
        .strength((link: MindmapGraphLink) => (link.width >= 2 ? 0.52 : LINKED_NODE_PULL_RATIO));
    }
    fg.d3ReheatSimulation();
    window.setTimeout(() => {
      fg.centerAt?.(0, 0, 0);
      fg.zoom?.(1.15, 0);
      fg.d3ReheatSimulation?.();
    }, 60);
  }, [data]);

  const linkedIds = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const link of data.links) {
      const source = String(link.source);
      const target = String(link.target);
      if (!map.has(source)) map.set(source, new Set());
      if (!map.has(target)) map.set(target, new Set());
      map.get(source)?.add(target);
      map.get(target)?.add(source);
    }
    return map;
  }, [data.links]);

  const positionedNodes = useMemo(() => {
    const cx = size.w / 2;
    const cy = size.h / 2;
    return data.nodes.map((node) => {
      const offset = nodeOffsets[node.id] || { x: 0, y: 0 };
      return {
        ...node,
        screenX: cx + viewportOffset.x + (node.x || 0) + offset.x,
        screenY: cy + viewportOffset.y + (node.y || 0) + offset.y,
      };
    });
  }, [data.nodes, nodeOffsets, size.h, size.w, viewportOffset.x, viewportOffset.y]);

  const nodeById = useMemo(() => new Map(positionedNodes.map((node) => [node.id, node])), [positionedNodes]);
  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    event.preventDefault();
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    dragRef.current = { ...drag, x: event.clientX, y: event.clientY, moved: drag.moved + Math.abs(dx) + Math.abs(dy) };
    if (drag.mode === "map") {
      setViewportOffset((current) => ({ x: current.x + dx, y: current.y + dy }));
      return;
    }
    const id = drag.id;
    if (!id) return;
    const neighbors = linkedIds.get(id) || new Set<string>();
    setNodeOffsets((current) => {
      const next = { ...current };
      const prev = next[id] || { x: 0, y: 0 };
      next[id] = { x: prev.x + dx, y: prev.y + dy };
      for (const neighborId of neighbors) {
        const np = next[neighborId] || { x: 0, y: 0 };
        next[neighborId] = { x: np.x + dx * LINKED_NODE_PULL_RATIO, y: np.y + dy * LINKED_NODE_PULL_RATIO };
      }
      return next;
    });
  };
  const stopDrag = () => {
    const drag = dragRef.current;
    const moved = drag?.moved || 0;
    lastDragMovedRef.current = moved;
    if (drag?.mode === "node" && moved > DRAG_CLICK_THRESHOLD) {
      suppressClickUntilRef.current = Date.now() + 420;
    }
    dragRef.current = null;
    setDraggingMode(null);
  };

  return (
    <div ref={containerRef} className="relative h-[720px] min-h-[620px] overflow-hidden bg-[#020812]">
      <div className="pointer-events-none absolute left-4 top-4 z-10 border border-cyan-300/18 bg-[#020812]/84 px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[0.12em] text-cyan-200/66">
        ASPI 8 domains + 25 issue nodes / metrics on node / drag node pulls neighbors
      </div>
      <div className="absolute bottom-4 left-4 z-10 grid max-w-[760px] gap-2 md:grid-cols-3">
        {topBranches.map((branch, index) => (
          <div key={branch.sub.title} className="border border-cyan-300/18 bg-[#020812]/84 px-3 py-2 shadow-[0_0_20px_rgba(50,231,255,.06)]">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.14em] text-cyan-300/62">next branch {index + 1}</p>
            <p className="mt-1 line-clamp-2 text-xs font-bold text-cyan-50">{branch.sub.title}</p>
            <p className="mt-1 font-mono text-[10px] text-cyan-100/58">gap {branch.metrics.gap} / p {branch.metrics.papers.toLocaleString()} / n {branch.metrics.news} / s {branch.metrics.seeds}</p>
          </div>
        ))}
      </div>
      <div
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onPointerDown={(event) => {
          if (event.target !== event.currentTarget) return;
          dragRef.current = { mode: "map", x: event.clientX, y: event.clientY, moved: 0 };
          setDraggingMode("map");
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrag}
        onPointerLeave={stopDrag}
        onPointerCancel={stopDrag}
      >
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <filter id="macro-edge-glow">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {data.links.map((link, index) => {
            const source = nodeById.get(String(link.source));
            const target = nodeById.get(String(link.target));
            if (!source || !target) return null;
            return (
              <line
                key={`${String(link.source)}-${String(link.target)}-${index}`}
                x1={source.screenX}
                y1={source.screenY}
                x2={target.screenX}
                y2={target.screenY}
                stroke={link.color}
                strokeWidth={link.width}
                filter="url(#macro-edge-glow)"
              />
            );
          })}
        </svg>
        {positionedNodes.map((node) => (
          <button
            key={node.id}
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              try {
                event.currentTarget.setPointerCapture(event.pointerId);
              } catch {
                // pointer capture may fail if the browser has already cancelled this pointer.
              }
              dragRef.current = { mode: "node", id: node.id, x: event.clientX, y: event.clientY, moved: 0 };
              setDraggingMode("node");
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDrag}
            onPointerLeave={stopDrag}
            onPointerCancel={stopDrag}
            onClick={() => {
              if (Date.now() < suppressClickUntilRef.current || lastDragMovedRef.current > DRAG_CLICK_THRESHOLD) {
                lastDragMovedRef.current = 0;
                return;
              }
              if (node.kind === "issue") handleIssueClick(node.group.issue.id);
              if (node.kind === "sub" && node.sub) handleSubClick(subKeyFor(node.group.issue.id, node.sub.title));
            }}
            className="absolute z-[3] -translate-x-1/2 -translate-y-1/2 select-none text-center font-mono uppercase leading-tight hover:scale-105"
            style={{
              left: node.screenX,
              top: node.screenY,
              color: "#dffbff",
              textShadow: `0 0 12px ${node.color}`,
              transition: draggingMode ? "none" : `left ${MAP_MOTION_MS}ms ${MAP_EASING}, top ${MAP_MOTION_MS}ms ${MAP_EASING}, transform 180ms ${MAP_EASING}, opacity ${MAP_MOTION_MS}ms ${MAP_EASING}`,
            }}
          >
            {node.kind === "sub" && node.paperCount != null && node.metrics && (
              <span className="mb-1 block whitespace-nowrap text-[12px] font-black text-amber-100 drop-shadow-[0_0_10px_rgba(255,209,90,.72)]">
                {node.paperCount.toLocaleString()}p / gap {node.metrics.gap}
              </span>
            )}
            <span
              className={`mx-auto mb-1 block rounded-full border shadow-[0_0_28px_currentColor] ${node.selected ? "border-amber-100 ring-2 ring-amber-200/50" : "border-white/60"}`}
              style={{
                width: `${node.kind === "issue" ? 38 : 30}px`,
                height: `${node.kind === "issue" ? 38 : 30}px`,
                background: node.color,
                color: node.color,
              }}
            />
            <span className="block w-40 text-[10px] font-black">{node.name}</span>
            <span className="mt-1 block w-40 text-[8px] font-black text-cyan-200/48">{node.meta}</span>
            {node.kind === "sub" && node.metrics && (
              <span className="mt-1 grid w-40 grid-cols-3 gap-1 text-[7px] font-black text-cyan-100/60">
                <span className="border border-cyan-300/18 bg-[#020812]/68 px-1 py-0.5">n{node.metrics.news}</span>
                <span className="border border-cyan-300/18 bg-[#020812]/68 px-1 py-0.5">d{node.metrics.divergences}</span>
                <span className="border border-cyan-300/18 bg-[#020812]/68 px-1 py-0.5">s{node.metrics.seeds}</span>
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function TaxonomyAlignmentSection({
  grouped,
  papers,
  evidenceSummary,
}: {
  grouped: MacrotrendGroup[];
  papers: PaperRow[];
  evidenceSummary: {
    signals: number;
    stories: number;
    divergences: number;
    seeds: number;
    paperLanes: number;
    latestPaperAt: string;
  };
}) {
  return (
    <section className="border border-cyan-300/20 bg-cyan-300/4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-5xl">
          <p className="font-mono text-[11px] font-black uppercase tracking-[0.18em] text-cyan-300/70">Taxonomy Alignment</p>
          <h2 className="mt-1 text-xl font-black text-cyan-50">主分類はAMD Score/M算定と同じASPI 8 domain</h2>
          <p className="mt-2 text-sm leading-relaxed text-cyan-100/68">
            以前の5テーマはUI用の圧縮に寄りすぎていたため、正本分類から外した。
            Macrotrendの主nodeは `papers_log` / `macro_index_log` / `project_ventures.lanes` と同じASPI 8 domainに揃え、UN SDGsとWEF Global Risksの個別riskは上位分類ではなくnetwork overlayとして重ねる。
          </p>
        </div>
        <div className="grid min-w-[280px] grid-cols-3 gap-1 font-mono text-[10px] text-cyan-100/70">
          <Metric label="signals" value={evidenceSummary.signals} />
          <Metric label="stories" value={evidenceSummary.stories} />
          <Metric label="diff" value={evidenceSummary.divergences} />
          <Metric label="seeds" value={evidenceSummary.seeds} />
          <Metric label="lanes" value={evidenceSummary.paperLanes} />
          <div className="border border-cyan-300/16 bg-[#020812]/70 px-2 py-1">
            <div className="text-cyan-300/52">papers</div>
            <div className="text-cyan-50">{evidenceSummary.latestPaperAt ? evidenceSummary.latestPaperAt.slice(0, 7) : "--"}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 lg:grid-cols-4">
        {AUTHORITATIVE_BACKBONE.map((source) => (
          <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="border border-cyan-300/18 bg-[#020812]/66 px-3 py-2 hover:bg-cyan-300/8">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.14em] text-cyan-300/70">{source.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-cyan-100/62">{source.note}</p>
          </a>
        ))}
      </div>

      <div className="mt-4 overflow-hidden border border-cyan-300/16">
        <div className="hidden grid-cols-[1.15fr_1.2fr_1fr_0.7fr] border-b border-cyan-300/16 bg-cyan-300/8 px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[0.12em] text-cyan-300/70 md:grid">
          <span>ASPI domain</span>
          <span>UN / WEF overlay</span>
          <span>Cross-domain edges</span>
          <span>Live evidence</span>
        </div>
        {grouped.map((group, index) => {
          const domains = domainsForIssue(group.issue);
          const paperTotal = group.issue.subIssues.reduce((sum, sub) => sum + paperCountForSubIssue(papers, group.issue, sub), 0);
          return (
            <div key={group.issue.id} className="grid gap-3 border-b border-cyan-300/10 px-3 py-3 text-xs last:border-b-0 md:grid-cols-[1.15fr_1.2fr_1fr_0.7fr]">
              <div>
                <p className="font-mono text-[10px] font-black text-cyan-300">{String(index + 1).padStart(2, "0")}</p>
                <p className="mt-1 font-black text-cyan-50">{group.issue.title}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {group.issue.authoritativeMap.slice(0, 5).map((tag) => (
                  <span key={tag} className="border border-cyan-300/14 bg-cyan-300/6 px-1.5 py-1 font-mono text-[9px] text-cyan-100/64">{tag}</span>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {domains.map((domain) => (
                  <span key={domain} className="border border-amber-200/18 bg-amber-200/8 px-1.5 py-1 font-mono text-[9px] text-amber-100/78">{ASPI_DOMAIN_LABEL_JP[domain]}</span>
                ))}
              </div>
              <div className="font-mono text-[10px] leading-relaxed text-cyan-100/62">
                atlas {group.signalMatches.length}<br />
                diff {group.divergenceMatches.length}<br />
                seeds {group.seedMatches.length}<br />
                papers {paperTotal.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function buildMindmapGraph(
  groups: MacrotrendGroup[],
  papers: PaperRow[],
  expandedIssueIds: Set<string>,
  expandedSubKeys: Set<string>,
  selectedSubKey: string | null
) {
  const nodes: MindmapGraphNode[] = [];
  const links: MindmapGraphLink[] = [];
  const rootRadius = 236;
  const childRadius = 78;
  groups.forEach((group, issueIndex) => {
    const angle = -Math.PI / 2 + (issueIndex / Math.max(1, groups.length)) * Math.PI * 2;
    const issueNodeId = `issue:${group.issue.id}`;
    const issueExpanded = expandedIssueIds.has(group.issue.id);
    const domainColor = ASPI_DOMAIN_COLORS[group.issue.domain];
    nodes.push({
      id: issueNodeId,
      kind: "issue",
      name: group.issue.title,
      group,
      val: 11 + Math.min(8, group.signalMatches.length + group.storyMatches.length),
      color: domainColor,
      meta: `${group.issue.domain} / atlas ${group.signalMatches.length}`,
      x: Math.cos(angle) * rootRadius,
      y: Math.sin(angle) * rootRadius,
    });
    if (!issueExpanded) return;

    group.issue.subIssues.forEach((sub, subIndex) => {
      const subKey = subKeyFor(group.issue.id, sub.title);
      const subNodeId = `sub:${subKey}`;
      const subExpanded = expandedSubKeys.has(subKey);
      const subAngle = angle - 0.96 + (subIndex / Math.max(1, group.issue.subIssues.length - 1)) * 1.92;
      const metrics = subIssueMetrics(group, sub, papers, subIndex);
      const selected = selectedSubKey === subKey;
      nodes.push({
        id: subNodeId,
        kind: "sub",
        name: sub.title,
        group,
        sub,
        val: subExpanded ? 8 : 6,
        color: selected ? "#ffd15a" : domainColor,
        meta: `${metrics.actionLabel} / ${metrics.intensity}`,
        paperCount: metrics.papers,
        metrics,
        selected,
        x: Math.cos(angle) * rootRadius + Math.cos(subAngle) * childRadius,
        y: Math.sin(angle) * rootRadius + Math.sin(subAngle) * childRadius,
      });
      links.push({ source: issueNodeId, target: subNodeId, color: selected ? "rgba(255,209,90,.76)" : `${domainColor}88`, width: selected ? 2.2 : 1.4 });
      for (const crossDomain of sub.domains.filter((domain) => domain !== group.issue.domain)) {
        links.push({ source: subNodeId, target: `issue:${crossDomain}`, color: "rgba(255,255,255,.16)", width: 0.55 });
      }
    });
  });
  return { nodes, links };
}

function subKeyFor(domain: AspiDomainId, subTitle: string) {
  return `${domain}${SUB_KEY_SEPARATOR}${subTitle}`;
}

function parseSubKey(key: string | null) {
  if (!key) return null;
  const idx = key.indexOf(SUB_KEY_SEPARATOR);
  if (idx < 0) return null;
  return {
    domain: key.slice(0, idx) as AspiDomainId,
    title: key.slice(idx + SUB_KEY_SEPARATOR.length),
  };
}

function findSelectedSubIssue(groups: MacrotrendGroup[], key: string | null, papers: PaperRow[]): SelectedSubIssueDetail | null {
  const parsed = parseSubKey(key);
  if (!parsed) return null;
  const group = groups.find((entry) => entry.issue.id === parsed.domain);
  if (!group) return null;
  const subIndex = group.issue.subIssues.findIndex((entry) => entry.title === parsed.title);
  const sub = group.issue.subIssues[subIndex];
  if (!sub) return null;
  return {
    key: subKeyFor(group.issue.id, sub.title),
    group,
    sub,
    metrics: subIssueMetrics(group, sub, papers, subIndex),
  };
}

function subIssueMetrics(group: MacrotrendGroup, sub: SubIssue, papers: PaperRow[], subIndex: number): SubIssueMetrics {
  const paperCount = paperCountForSubIssue(papers, group.issue, sub);
  const news = evidenceCountForSubIssue(group, sub);
  const divergences = divergenceCountForSubIssue(group, sub);
  const seeds = seedsForSubIssue(group.seedMatches, sub, subIndex).length;
  const paperMomentum = Math.min(44, Math.round(Math.log10(Math.max(10, paperCount)) * 9));
  const momentum = clampScore(paperMomentum + news * 8 + divergences * 10);
  const coverage = clampScore(18 + seeds * 22);
  const gap = clampScore(momentum - coverage + (divergences > 0 ? 12 : 0));
  const action = actionForSubIssue({ papers: paperCount, news, divergences, seeds, momentum, coverage, gap });
  return {
    papers: paperCount,
    news,
    divergences,
    seeds,
    momentum,
    coverage,
    gap,
    ...action,
  };
}

function actionForSubIssue(metrics: Pick<SubIssueMetrics, "papers" | "news" | "divergences" | "seeds" | "momentum" | "coverage" | "gap">): Pick<SubIssueMetrics, "actionLabel" | "actionReason" | "intensity"> {
  if (metrics.gap >= 55 && metrics.seeds <= 1) {
    return {
      actionLabel: "Seed search",
      actionReason: "研究量や外部反応に対してAMD内のseed被覆が薄い。大学・論文・候補技術を先に掘る対象。",
      intensity: "hot-gap",
    };
  }
  if (metrics.divergences > 0 && metrics.news > 0) {
    return {
      actionLabel: "Japan gap review",
      actionReason: "世界側の反応と日本側の露出差が見えている。国内プレイヤー不在か、観測不足かを切り分ける。",
      intensity: "evidence",
    };
  }
  if (metrics.seeds >= 3) {
    return {
      actionLabel: "Venture thesis",
      actionReason: "既存Seedsが複数あるので、個別案件ではなく束ねた事業仮説・共通基盤を作る対象。",
      intensity: "covered",
    };
  }
  if (metrics.news >= 4 || metrics.papers >= 50000) {
    return {
      actionLabel: "Atlas synthesis",
      actionReason: "研究量または外部signalは十分。一次情報を束ねて、AMDが取りに行く論点へ翻訳する。",
      intensity: "evidence",
    };
  }
  return {
    actionLabel: "Evidence watch",
    actionReason: "まだ明確な投資仮説にするには薄い。Atlas signalとOpenAlex推移を継続観測する。",
    intensity: "watch",
  };
}

function domainGapScore(group: MacrotrendGroup, papers: PaperRow[]) {
  if (group.issue.subIssues.length === 0) return 0;
  const values = group.issue.subIssues.map((sub, index) => subIssueMetrics(group, sub, papers, index).gap);
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function clampScore(value: number) {
  return Math.max(0, Math.min(99, Math.round(value)));
}

function paperCountForSubIssue(papers: PaperRow[], issue: MacroIssue, sub: SubIssue) {
  const domains = sub.domains.length > 0 ? sub.domains : [issue.domain];
  const latestByLane = new Map<string, PaperRow>();
  for (const row of papers) {
    if (!domains.includes(row.lane as AspiDomainId)) continue;
    const current = latestByLane.get(row.lane);
    if (!current || row.observed_at > current.observed_at) latestByLane.set(row.lane, row);
  }
  return Array.from(latestByLane.values()).reduce((sum, row) => sum + row.paper_count, 0);
}

function domainsForIssue(issue: MacroIssue): AspiDomainId[] {
  const domains = new Set<AspiDomainId>([issue.domain]);
  for (const sub of issue.subIssues) {
    sub.domains.forEach((domain) => domains.add(domain));
  }
  return Array.from(domains);
}

function evidenceCountForSubIssue(group: MacrotrendGroup, sub: SubIssue) {
  const parts = [sub.title, sub.seedFit, sub.seedKeywords.join(" ")];
  return group.signalMatches.filter((s) => keywordMatch(sub.seedKeywords, [s.title, s.content, s.domain || "", s.suggested_tags.join(" "), ...parts])).length
    + group.storyMatches.filter((s) => keywordMatch(sub.seedKeywords, [s.title, s.summary || "", s.tags.join(" "), s.primary_domain || "", ...parts])).length;
}

function divergenceCountForSubIssue(group: MacrotrendGroup, sub: SubIssue) {
  const parts = [sub.title, sub.seedFit, sub.seedKeywords.join(" ")];
  return group.divergenceMatches.filter((d) => keywordMatch(sub.seedKeywords, [
    d.theme.name,
    d.theme.description || "",
    d.divergence_message || "",
    d.global_summary || "",
    d.japan_summary || "",
    ...parts,
  ])).length;
}

function matchesDomainIssue(issue: MacroIssue, parts: string[]) {
  const hay = parts.join(" ").toLowerCase();
  return issue.keywords.some((k) => hay.includes(k.toLowerCase())) || hay.includes(issue.domain.toLowerCase());
}

function keywordMatch(keywords: string[], parts: string[]) {
  const hay = parts.join(" ").toLowerCase();
  return keywords.some((k) => hay.includes(k.toLowerCase()));
}

function atlasDomainMatches(issue: MacroIssue, domain: string | null | undefined) {
  if (!domain) return false;
  return ATLAS_PREFIXES_BY_DOMAIN[issue.domain].some((prefix) => domain.startsWith(prefix));
}

function seedMatchesDomain(issue: MacroIssue, seed: SeedListItem) {
  const mapped = seed.domain_lane ? SEED_DOMAIN_TO_ASPI[seed.domain_lane] : null;
  if (mapped === issue.domain) return true;
  return matchesDomainIssue(issue, [
    seed.title,
    seed.summary || "",
    seed.domain_lane || "",
    seed.industry_target?.join(" ") || "",
    seed.keywords?.join(" ") || "",
  ]);
}

function seedsForSubIssue(seedMatches: SeedListItem[], sub: MacroIssue["subIssues"][number], subIndex: number) {
  const direct = seedMatches.filter((seed) => {
    const hay = [seed.title, seed.summary || "", seed.domain_lane || "", seed.industry_target?.join(" ") || "", seed.keywords?.join(" ") || ""]
      .join(" ")
      .toLowerCase();
    return sub.seedKeywords.some((w) => hay.includes(w.toLowerCase()));
  });
  void subIndex;
  return direct.slice(0, 3);
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-cyan-300/16 bg-[#020812]/70 px-2 py-1">
      <div className="text-cyan-300/52">{label}</div>
      <div className="text-cyan-50">{value}</div>
    </div>
  );
}

function Gauge({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-24 border border-cyan-300/22 bg-[#020812]/72 px-3 py-2">
      <div className="text-[9px] uppercase tracking-[0.16em] text-cyan-300/58">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-lg font-black text-cyan-50">{value}</span>
        <span className="h-1.5 flex-1 border border-cyan-300/20 bg-cyan-950/70">
          <span className="block h-full bg-cyan-300 shadow-[0_0_10px_rgba(50,231,255,.7)]" style={{ width: `${value}%` }} />
        </span>
      </div>
    </div>
  );
}

function Thesis({ year, text }: { year: string; text: string }) {
  return (
    <div className="border border-cyan-300/18 bg-[#020812]/72 p-3">
      <div className="font-mono text-lg font-black text-cyan-300">{year}</div>
      <p className="mt-2 text-xs leading-relaxed text-cyan-100/72">{text}</p>
    </div>
  );
}

function EvidencePanel({ title, items }: { title: string; items: Array<{ title: string; meta: string; href: string }> }) {
  return (
    <div className="min-h-[320px] border border-cyan-300/20 bg-cyan-300/4 p-3">
      <h3 className="font-mono text-[12px] font-black uppercase tracking-[0.14em] text-cyan-300">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.length === 0 && <p className="text-xs text-cyan-100/45">該当データなし</p>}
        {items.map((item, idx) => (
          <a key={`${item.title}-${idx}`} href={item.href} target={item.href.startsWith("http") ? "_blank" : undefined} rel={item.href.startsWith("http") ? "noreferrer" : undefined} className="block border border-cyan-300/14 bg-[#020812]/72 px-3 py-2 hover:bg-cyan-300/8">
            <p className="line-clamp-2 text-xs font-bold text-cyan-50">{item.title}</p>
            <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.08em] text-cyan-300/58">{item.meta}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

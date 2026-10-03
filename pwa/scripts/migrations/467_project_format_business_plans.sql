-- 467_project_format_business_plans.sql
--
-- PJタイプ別の標準フォーマット（pwa/spec/3-23-project-format-current-spec.md）の残りを、コードからデータへ移す。
-- まさ確定 2026-10-03「すべてのPJについて、同じフォーマットで表示する設計にして」
--   「てゆーか全部統一してないとだめ。OSの大原則。あと中身があるときだけ出るタブってなに？
--    上記の通り、すべてのフォーマットが同じ状態で表示されてないとだめ。」
--
-- 1. projects.display_name … 画面の題名に使う表示名（無ければ project_name）。ワークスペースの題名を
--    PJ番号で書き分けていたコード（SolvioraX・愛媛大学）をデータへ移す。題名は全PJ「{表示名} PJワークスペース」。
-- 2. project_business_plans … 事業計画タブ（フェーズマトリクス）の中身。1PJ1行。全PJで同じ表を描き、
--    行が無いPJは表の枠を出して「未登録」と書く。SOL（p21）の中身は、これまで画面のコードに書いていた
--    2026-09-30 改定版（5フェーズ × 4レーン）をそのまま移す。
--
-- destructive DDL は行わない。

BEGIN;

-- ============================================================
-- 1. 表示名
-- ============================================================
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS display_name text;
COMMENT ON COLUMN public.projects.display_name IS '画面の題名に使う表示名（例: SolvioraX）。null は project_name を使う。spec 3-23';

UPDATE public.projects SET display_name = 'SolvioraX', updated_at = now()
WHERE project_id = 'p21' AND display_name IS NULL;
UPDATE public.projects SET display_name = '愛媛大学', updated_at = now()
WHERE project_id = 'p30' AND display_name IS NULL;

-- ============================================================
-- 2. 事業計画（フェーズマトリクス）
-- phases_json は [{ id, label, period, openingRound, budgetYen, burnLabel, fundingSource,
--   maxFixedBurnMonthlyYen, targetXrl: {trl,brl,grl,srl,hrl},
--   lanes: { business|technology|organization|funding: { costYen, activities[], exitGate, xrlKeys[] } } }]。
-- 画面は src/lib/project-business-plan.ts の normalizeBusinessPlanPhases で形を確かめてから描く。
-- ============================================================
CREATE TABLE IF NOT EXISTS public.project_business_plans (
  project_id        text PRIMARY KEY REFERENCES public.projects(project_id),
  matrix_note       text,
  source_note       text,
  phases_json       jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by_email  text,
  updated_by_email  text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_business_plans_phases_is_array CHECK (jsonb_typeof(phases_json) = 'array')
);

-- 資本政策表（migration 179）と同じ方針: 全 AMD メンバーが閲覧・編集できる。画面の読み込みは API（service role）経由。
ALTER TABLE public.project_business_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_business_plans_members" ON public.project_business_plans;
CREATE POLICY "project_business_plans_members" ON public.project_business_plans
  FOR ALL TO authenticated USING (public.amd_os_is_member()) WITH CHECK (public.amd_os_is_member());
DROP POLICY IF EXISTS "project_business_plans_service" ON public.project_business_plans;
CREATE POLICY "project_business_plans_service" ON public.project_business_plans
  FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO public.project_business_plans (project_id, matrix_note, source_note, phases_json, created_by_email, updated_by_email)
VALUES (
  'p21',
  $note$シード〜2028年6月の支払予算・調達方針は2026年9月30日改定。詳細は「試算表」。4レーン別の費用配賦とシリーズA以降の予算は再精査中。長期の事業・工場拡張は仮説として扱う。$note$,
  $src$SOL 事業計画 2026-09-30 改定版$src$,
  $json$[
  {
    "id": "psi",
    "label": "Phase 0｜PSI・会社設立準備",
    "period": "2026.07–2027.03",
    "openingRound": "PSI・非希薄化資金",
    "budgetYen": 60000000,
    "burnLabel": null,
    "fundingSource": "PSI等 0.6億円（NewCoの株式調達外）",
    "maxFixedBurnMonthlyYen": 1500000,
    "targetXrl": {
      "trl": 4,
      "brl": 3,
      "grl": 1,
      "srl": 3,
      "hrl": 3
    },
    "lanes": {
      "business": {
        "costYen": 10000000,
        "activities": [
          "優先顧客2業界と最初の用途を固定",
          "排水基準・環境安全・菌体/包装物の取扱いと顧客設備側の責任分界を整理",
          "有償PoC候補2社の意向を確認"
        ],
        "exitGate": "誰が、何に、いくら払うかを2社で説明できる",
        "xrlKeys": [
          "brl",
          "grl",
          "srl"
        ]
      },
      "technology": {
        "costYen": 40000000,
        "activities": [
          "培養株・培養レシピ・品質指標を絞る",
          "培養→回収→包装→輸送→顧客投入の一連条件を設計",
          "PoC用リアクター仕様と測定計画を固定"
        ],
        "exitGate": "ラボ条件で一連工程の再現性と測定方法を確認",
        "xrlKeys": [
          "trl"
        ]
      },
      "organization": {
        "costYen": 5000000,
        "activities": [
          "設立前DDの技術・法務・財務・知財論点を完了",
          "NewCo設立とCEO候補の役割確定",
          "大学・発明者・SX間の知財境界を整理"
        ],
        "exitGate": "設立前DDを完了し、2027年4月1日の会社設立へ移れる",
        "xrlKeys": [
          "hrl"
        ]
      },
      "funding": {
        "costYen": 5000000,
        "activities": [
          "シードJ-KISSと15か月の資金使途を準備",
          "設立前に進められるDD・投資委員会の範囲を確認",
          "必要DD資料と投資家別の条件を協議"
        ],
        "exitGate": "シード1億円・キャップ5億円・ディスカウント20％の条件を協議できる",
        "xrlKeys": [
          "brl"
        ]
      }
    }
  },
  {
    "id": "seed",
    "label": "Phase 1｜シード → シリーズA",
    "period": "2027.04–2028.06",
    "openingRound": "シード1億円（J-KISS）",
    "budgetYen": 126088080,
    "burnLabel": "通常支出月平均（税込）",
    "fundingSource": "シード1億円＋STS・つなぎ融資。支払予算約1億2,609万円、純改善目標1,000万円は未計上。投資家配分は未定。",
    "maxFixedBurnMonthlyYen": 4358782,
    "targetXrl": {
      "trl": 6,
      "brl": 5,
      "grl": 3,
      "srl": 5,
      "hrl": 5
    },
    "lanes": {
      "business": {
        "costYen": null,
        "activities": [
          "顧客拠点で有償PoCを3件実施",
          "包装単位・納品頻度・顧客側運転手順と既存制度への適合要件を商品仕様化",
          "単価、粗利、継続条件を顧客別に検証"
        ],
        "exitGate": "有償PoC3件と年間契約へ進む顧客1社",
        "xrlKeys": [
          "brl",
          "grl",
          "srl"
        ]
      },
      "technology": {
        "costYen": null,
        "activities": [
          "自社内の小規模培養・包装パイロット設備を構築",
          "輸送後の活性・保存期限・ロット品質基準を確立",
          "顧客設備での再現運転とユニットエコノミクスを証明"
        ],
        "exitGate": "3ロット連続合格、輸送後性能合格、顧客現場で再現",
        "xrlKeys": [
          "trl",
          "srl"
        ]
      },
      "organization": {
        "costYen": null,
        "activities": [
          "製品開発担当を確保し、必要な役割を段階的に補う",
          "品質記録、出荷判定、顧客障害対応の標準手順を導入",
          "取締役会・月次資金管理を開始"
        ],
        "exitGate": "CEO・開発担当・大学・委託先で培養・出荷・現場対応の役割が埋まる",
        "xrlKeys": [
          "hrl"
        ]
      },
      "funding": {
        "costYen": null,
        "activities": [
          "シードJ-KISSをクローズしSTS申請とつなぎ融資を協議",
          "2028年6月末現金約359万円に対して純改善1,000万円を目指す",
          "2028年7月のシリーズA払込に向けDD・条件交渉を前倒し"
        ],
        "exitGate": "有償PoC3件の検証とシリーズA入金。不採択時は2028年1月までのブリッジ払込を目標",
        "xrlKeys": [
          "brl",
          "hrl"
        ]
      }
    }
  },
  {
    "id": "series-a",
    "label": "Phase 2｜Series A → Series B",
    "period": "2028.07–2031.03",
    "openingRound": "シリーズA（調達額再精査）",
    "budgetYen": null,
    "burnLabel": null,
    "fundingSource": "調達額・評価額・費用配賦は再精査。以降の事業・工場拡張は長期仮説。",
    "maxFixedBurnMonthlyYen": 12000000,
    "targetXrl": {
      "trl": 7,
      "brl": 7,
      "grl": 5,
      "srl": 7,
      "hrl": 7
    },
    "lanes": {
      "business": {
        "costYen": null,
        "activities": [
          "複数顧客との年間供給契約へ移行",
          "導入設計・運転支援・定期供給を標準商品化",
          "顧客別採算と回収期間を共通指標で管理"
        ],
        "exitGate": "継続顧客3社以上、売上7億円規模、変動粗利黒字",
        "xrlKeys": [
          "brl",
          "srl"
        ]
      },
      "technology": {
        "costYen": null,
        "activities": [
          "自社量産実証工場を取得・整備",
          "培養能力をSeed比10倍へ拡張し包装工程を半自動化",
          "出荷品質・顧客取扱い・トレーサビリティの標準運用を顧客現場で試行"
        ],
        "exitGate": "量産実証工場で6か月連続の供給・品質・原価目標を達成",
        "xrlKeys": [
          "trl",
          "grl"
        ]
      },
      "organization": {
        "costYen": null,
        "activities": [
          "工場長、品質保証、営業責任者を採用",
          "製造・営業・管理の部門別予算と権限を設定",
          "安全衛生・教育・BCPを運用"
        ],
        "exitGate": "15–20名体制でCEO不在でも日次操業が継続",
        "xrlKeys": [
          "hrl"
        ]
      },
      "funding": {
        "costYen": null,
        "activities": [
          "設備投資を能力増強ゲートごとに分割承認",
          "借入・補助金を株式資金と併用",
          "Series Bで本格工場投資を開けるDDパックを整備"
        ],
        "exitGate": "工場投資前後の原価実績と需要予約でSeries Bを説明",
        "xrlKeys": [
          "brl"
        ]
      }
    }
  },
  {
    "id": "series-b",
    "label": "Phase 3｜Series B → Series C",
    "period": "2031.04–2033.03",
    "openingRound": "Series B 15億円",
    "budgetYen": 1500000000,
    "burnLabel": null,
    "fundingSource": "想定 pre 60億円 / post 75億円",
    "maxFixedBurnMonthlyYen": 25000000,
    "targetXrl": {
      "trl": 8,
      "brl": 8,
      "grl": 6,
      "srl": 8,
      "hrl": 8
    },
    "lanes": {
      "business": {
        "costYen": 280000000,
        "activities": [
          "国内重点産業へ販売網を拡大",
          "複数年・最低購入量付き契約を増やす",
          "海外導入候補で規制・物流・価格を検証"
        ],
        "exitGate": "売上60億円規模への受注残と上位顧客依存の低下",
        "xrlKeys": [
          "brl",
          "srl"
        ]
      },
      "technology": {
        "costYen": 900000000,
        "activities": [
          "土地・建屋・複数培養ラインを備えた本格自社工場を建設",
          "自動培養制御・包装・出荷判定を統合",
          "複数拠点供給に耐える種株保全と災害復旧系を構築"
        ],
        "exitGate": "本格工場の設計能力・歩留まり・原価を12か月安定達成",
        "xrlKeys": [
          "trl",
          "grl",
          "srl"
        ]
      },
      "organization": {
        "costYen": 220000000,
        "activities": [
          "製造・品質・サプライチェーン・海外事業の執行体制を整備",
          "内部統制と月次決算を上場準備水準へ引上げ",
          "採用・育成を拠点展開に合わせて標準化"
        ],
        "exitGate": "40–60名体制と監査可能な業務プロセスを確立",
        "xrlKeys": [
          "hrl"
        ]
      },
      "funding": {
        "costYen": 100000000,
        "activities": [
          "工場建設の予備費・支払条件・借入余力を管理",
          "Series Cまたはプロジェクトファイナンスを比較",
          "IPO準備監査のギャップ診断を開始"
        ],
        "exitGate": "成長投資と運転資金を分けたSeries C計画を確定",
        "xrlKeys": [
          "brl"
        ]
      }
    }
  },
  {
    "id": "series-c",
    "label": "Phase 4｜Series C → IPO",
    "period": "2033.04–2035.03",
    "openingRound": "Series C 20億円",
    "budgetYen": 2000000000,
    "burnLabel": null,
    "fundingSource": "想定 pre 150億円 / post 170億円",
    "maxFixedBurnMonthlyYen": 45000000,
    "targetXrl": {
      "trl": 8,
      "brl": 8,
      "grl": 8,
      "srl": 8,
      "hrl": 8
    },
    "lanes": {
      "business": {
        "costYen": 650000000,
        "activities": [
          "全国供給網と海外初号案件を立上げ",
          "用途別プロダクトラインと価格体系を展開",
          "売上200億円規模へ向かう受注・継続率を証明"
        ],
        "exitGate": "複数業界・複数地域で再現する成長モデルを確立",
        "xrlKeys": [
          "brl",
          "srl"
        ]
      },
      "technology": {
        "costYen": 950000000,
        "activities": [
          "第二ライン・自動倉庫・全国物流品質を増強",
          "培養条件のデータ化と遠隔品質監視を完成",
          "次世代株・用途別包装の継続開発系を運用"
        ],
        "exitGate": "複数ライン・複数物流経路で同等品質を常時供給",
        "xrlKeys": [
          "trl",
          "grl",
          "srl"
        ]
      },
      "organization": {
        "costYen": 300000000,
        "activities": [
          "上場会社水準の経営管理・内部監査・開示体制を整備",
          "海外・製造・研究開発の後継責任者を配置",
          "安全・品質文化を全拠点へ展開"
        ],
        "exitGate": "監査・開示・予算統制が計画どおり反復運用",
        "xrlKeys": [
          "hrl"
        ]
      },
      "funding": {
        "costYen": 100000000,
        "activities": [
          "主幹事・監査法人・証券審査へ対応",
          "IPO時の公募10億円を成長投資枠として設計",
          "既存株主・SO・公開市場の希薄化を最終調整"
        ],
        "exitGate": "上場審査、資本構成、調達使途の整合が取れる",
        "xrlKeys": [
          "brl",
          "grl",
          "hrl"
        ]
      }
    }
  }
]$json$::jsonb,
  'amie',
  'amie'
)
ON CONFLICT (project_id) DO NOTHING;

DO $chk$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'display_name';
  IF n <> 1 THEN RAISE EXCEPTION 'projects.display_name: expected 1, got %', n; END IF;

  SELECT count(*) INTO n FROM public.projects
  WHERE (project_id = 'p21' AND display_name = 'SolvioraX') OR (project_id = 'p30' AND display_name = '愛媛大学');
  IF n <> 2 THEN RAISE EXCEPTION 'display_name rows: expected 2, got %', n; END IF;

  SELECT jsonb_array_length(phases_json) INTO n FROM public.project_business_plans WHERE project_id = 'p21';
  IF n IS DISTINCT FROM 5 THEN RAISE EXCEPTION 'p21 business plan phases: expected 5, got %', n; END IF;
END $chk$;

COMMIT;

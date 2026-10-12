import fs from "node:fs";
import path from "node:path";
import { amiePrepareTechDisclosure } from "../src/lib/amie-tech-disclosure-server.ts";
import type { AmieTechLevel } from "../src/lib/amie-tech-disclosure-model.ts";

const folder = process.argv[2];
if (!folder) throw new Error("Driveの日付フォルダが必要");
const snapshot = JSON.parse(fs.readFileSync(path.join(folder,"技術台帳_仕分け前.json"),"utf8"));
type Row = Record<string, any>;
const topics: Row[] = snapshot.topics; const entries: Row[] = snapshot.entries;
const body: Record<string,string> = {
  ptt_sx_principle: "### 技術の概要\n\n光合成を行うシアノバクテリアを培養し、顧客の排液処理に利用する構想。培養と、排液に接触させる処理を別の工程として管理する。金属の液中濃度低下、菌体への取り込み、金属の抽出・精製はそれぞれ確認する。色素・金属・燃料は用途ごとに実証段階が異なる。\n\n未公開の培養・株改変・選抜の手順は通常DDに含めない。",
  ptt_sx_closed_overview: "### 事業化で確認する条件\n\n自然株と遺伝子組換え株を分け、使用・保管・輸送・回収・廃棄までを含む封じ込めと手続きの適用を確認する。分類、必要な確認、担当窓口、処理水と残渣の扱いは実証仕様と合わせて確定する。研究室での使用状態を、そのまま商用設備の適合確認済みと扱わない。\n\n具体的な株の改変内容・遺伝子・選抜条件は開示対象に含めない。",
  ptt_sx_closed_law: "閉鎖系での使用は、装置に入れる時点だけでなく、保管・輸送・回収・廃棄までを含めて確認する。対象株、設備、運用主体を決めて、適用区分・必要な手続き・責任分担を確認する。現状は商用条件の確定前。個別の承認・適合を取得済みとは記載しない。",
  ptt_sol_dd_validation: "### ラボから顧客現場へ進む条件\n\n10Lリアクターの処理、実排液での金属取り込み、pH変化等は研究者報告として把握している。初期濃度・最終濃度・処理時間・必要菌体量・反復・分析方法がそろった記録へ整理する。\n\n次の検証は、①顧客の排液を特定、②同条件の対照と反復、③連続運転・寿命・洗浄・停止復旧、④顧客の採用条件と検収。混合金属での遅延、油・塩分・共存成分、輸送後性能も判断に含める。原データは限定技術情報として別途照合する。",
  ptt_sol_dd_supply: "### 供給と現場運転の検証\n\n培養・出荷判定・包装・輸送・顧客投入・交換回収をつないだ製品単位を計画する。供給能力は槽の容量だけでなく、培養日数、菌体量、回収歩留まり、出荷合格率、輸送後性能で確認する。\n\n保存期限、ロット品質、カートリッジ寿命、洗浄作業、菌体漏出、故障時の代替、回収・廃棄は未確定。3ロット連続合格や顧客現場での再現は開発目標。培地配合、制御設定、検査・回収の詳細手順は通常DDの対象外。",
  ptt_sol_dd_ip_use: "### 大学の技術を事業で使う条件\n\n知財一覧の出願・公開公報と、新会社の利用権を区別する。対象特許・菌株・ノウハウ、用途・地域・期間、独占性、委託製造、改良成果、対価、契約終了時の継続利用を協議する。公開公報の存在だけで、登録済み・有効・独占実施権取得済みとは扱わない。\n\n株の改変・選抜の未公開手順は核心ノウハウとして保持し、通常DDでは利用・引継ぎの条件と確認状況を示す。",
};
const topicPolicy: Record<string,{level:AmieTechLevel;title?:string;summary?:string;reason:string}> = {
  ptt_sx_principle:{level:"public",title:"技術の仕組み（概要）",summary:"培養と排液処理の工程、金属・色素・燃料の用途を区別。",reason:"一般的な原理と製品構想の概要だけを公開情報とする。具体的な条件とノウハウはDD原稿へ転記しない。"},
  ptt_sx_spec_sheet:{level:"restricted",title:"性能と適用範囲 — 事業判断のサマリー",summary:"性能の報告例、適用できない条件、未実証の範囲。試験ごとの設定は別管理。",reason:"性能と株・培養設定が混在する原本。投資判断に必要な行だけを抜粋する。"},
  ptt_sol_qa:{level:"dd_summary",title:"事業化の判断に必要な質問と答え",summary:"実績・量産・顧客・資金の現在地。過去の回答と現行計画を混同しない。",reason:"投資家向けの要約として必要。旧数値や実験手順をそのまま出さず、DD回答欄を明示する。"},
  ptt_sx_culture:{level:"core",title:"菌体供給の能力と残る検証",summary:"培養時間・試作設備の容量・資源利用の予備報告。配合と制御設定は非開示。",reason:"原本には培養制御・光・気体・換算・改変情報が混在。供給能力に関わる要約行だけをDDへ残す。"},
  ptt_sx_reactor:{level:"restricted",title:"処理性能とスケールアップの条件",summary:"取り込み量、処理速度、混合排液での限界。量産能力と回収・寿命は未実証。",reason:"個別実験と旧試算の前提が混在。原データ・具体的な装置設定は限定管理。"},
  ptt_sx_elements:{level:"dd_summary",title:"物質ごとの到達段階",summary:"確認済み・試験中・未確認を分け、金属回収率や商用保証へ外挿しない。",reason:"最初の用途を選ぶための確認状況。未確認の元素も残し、実験手順を省く。"},
  ptt_sx_limits:{level:"dd_summary",title:"適用限界と追加確認が必要な排液",summary:"塩分・薬剤・油・混合成分・低温等の制約。未知の閾値を示す。",reason:"事業判断を左右する適用限界を隠さない。株の操作や個別試験手順は非掲載。"},
  ptt_sx_preference:{level:"restricted",reason:"元素の選好と共存条件ごとの挙動は詳細技術検証。通常DDには混合で遅くなるという事業上の制約を性能欄へ集約。"},
  ptt_sx_effluent_sources:{level:"restricted",reason:"顧客別の水質・成分・採取位置・提供条件。匿名化とデータ開示条件の個別確認が必要。通常DDの技術ページへは収録しない。"},
  ptt_sx_valuables:{level:"dd_summary",title:"有価物の候補と実証段階",summary:"同定・収率・純度・販売品質が未確定の候補を、主ケースの収益と区別。",reason:"事業上の可能性と未達を示す概要。抽出手順や未確認の収率を商用成果として出さない。"},
  ptt_sx_price:{level:"restricted",reason:"過去時点の単価・原価。現在の採算判断はコスト試算と月次計画を正本とする。旧値を通常DDの現行値へ転用しない。"},
  ptt_sx_record:{level:"restricted",title:"装置と実排液試験の到達点",summary:"報告日と試験日、研究者報告と原データ検証、ラボと顧客現場を区別。",reason:"装置の内部構造・株の改変・実験トラブルが混在。到達点と運転課題の概要だけをDDへ抜粋。"},
  ptt_sx_biofuel:{level:"restricted",title:"燃料の到達点と量産上の課題",summary:"ラボの分析値、設備出力の試算、量産と規格・原価で未確認の項目を区別。",reason:"燃料化・出力の数値は事業判断に必要。抽出工程・溶媒の運用・個別株の比較は限定管理。"},
  ptt_sx_closed_overview:{level:"dd_summary",title:"強化株の使用条件と事業化の確認事項",summary:"対象株・設備・運用主体を定め、封じ込めと手続きの適用を確認する。",reason:"封じ込めと運用上の制約は事業判断に必要。未公開の株の詳細は説明しない。"},
  ptt_sx_closed_law:{level:"dd_summary",title:"商用運用で確認する手続きと責任",summary:"輸送・使用・回収・廃棄の条件と、商用運用で必要な確認・責任分担。",reason:"手続きの確認状況を概要で示す。適合・承認の取得済みを推測しない。"},
  ptt_sx_closed_categories:{level:"restricted",reason:"使用区分ごとの詳細要件。通常DDでは適用区分が未確定であることと事業上の制約を概要に示す。"},
  ptt_sx_closed_gilsp:{level:"restricted",reason:"株・宿主・ベクター・挿入情報の詳細と使用区分の判断資料。通常DDの対象外。"},
  ptt_sx_closed_reactor:{level:"restricted",reason:"設備と不活化・封じ込め手順の詳細。事業化で必要な確認事項は概要に残す。"},
  ptt_sx_closed_mechanism:{level:"core",reason:"株の機能強化と取り込み機構の具体説明。通常DDでは一般的な取り込み・回収の構造だけを概要として示す。"},
  ptt_sx_closed_precedent:{level:"restricted",reason:"内部調査と未照合の先行事例。公表原本と時点を確認してから必要な説明へ採用する。"},
  ptt_sol_dd_validation:{level:"dd_summary",title:"顧客現場へ進む実証条件",reason:"再現性・連続運転・顧客採用の判断条件。個別実験手順の具体値を含めず概要を開示。"},
  ptt_sol_dd_supply:{level:"dd_summary",title:"供給・品質・現場運転の検証課題",reason:"供給能力と品質・寿命・運用負担は事業判断に必要。培養配合と検査手順は限定管理。"},
  ptt_sol_dd_ip_use:{level:"dd_summary",title:"知財・ノウハウの利用条件と確認状況",reason:"投資対象が技術を利用できる条件を示す。未公開の具体的手順と個別交渉は含めない。"},
};

const selected = new Set([
  ...["01","02","04","05","08","09","10","11","12","13","14","15","16","18","19","20","21","22","23","24","27"].map(n=>"pte_sx_ss"+n), "pte_sx_0915_14","pte_sx_0915_15",
  "pte_sx_k07","pte_sx_k09","pte_sx_k10","pte_sx_k11","pte_sx_k17","pte_sx_k18","pte_sx_0915_06",
  ...["02","04","05","06","07","15","19","20","21"].map(n=>"pte_sx_r"+n),
  "pte_sx_d03","pte_sx_d08","pte_sx_d09","pte_sx_d12","pte_sx_d14","pte_sx_d15","pte_sx_0915_02","pte_sx_0915_03","pte_sx_0915_04","pte_sx_0915_05","pte_sx_1001_r01","pte_sx_1001_r02","pte_sx_1001_r04","pte_sx_1002_r01","pte_sol_mate_nd_20261008",
  "pte_sx_bf01","pte_sx_bf02","pte_sx_bf03","pte_sx_bf04","pte_sx_bf06","pte_sx_0915_10","pte_sx_pl260226_biofuel_output",
]);
const qa: Record<string,string> = {
  "01":"研究室が保有する株を培養し、顧客の処理工程へ供給する構想。量産時の培養時間・生産密度・回収歩留まり・輸送後性能は追加確認する。",
  "02":"金属や色素等の処理、薬品・残渣・作業負担の低減を検証する。優位性は顧客の同じ排液・水質・流量で既存方式と比較して確定する。",
  "03":"10Lリアクターで約1時間の鉄排液処理が報告されている。工場の連続流量に適合すること、寿命・漏出・作業負担は未実証。",
  "04":"液中濃度の低下と、菌体からの金属回収・精製を分ける。販売できる純度・回収率・費用は追加確認する。具体的な抽出手順は限定管理。",
  "05":"食品系排液で増殖やpH変化の報告がある。COD・窒素・リン・油分等の処理前後値と条件を照合して除去性能を確定する。",
  "06":"元素ごとの確認状況は物質一覧へ。単独金属の約30分、混合条件で約24時間という報告例があり、実排液の組成によって適用を検証する。Nd原液は30分後に液中濃度がほぼゼロとの報告で、回収率・純度の確定ではない。",
  "07":"研究者は20社以上・20種類以上の実排液で試験したと報告している。試料台帳との個別対応・試験数の定義は照合が必要。顧客現場のPoC完了件数へ読み替えない。",
  "08":"採算の現行値はコスト試算と月次計画を参照。色素の量産仮説を初期案件へ流用せず、設備・菌体・作業・残存処理・料金を同条件で精査する。",
  "09":"設立前のDDはチームアルマダが整理する。契約ごとの当事者・目的・大学と顧客の情報利用条件を確認し、設立予定会社への権利や義務の承継を個別に協議する。",
  "10":"現行の資本政策案を参照。相手別の投資額・条件は未合意。過去の面談回答を最新の持分・調達条件として扱わない。",
  "11":"シリーズAへ進む事業・技術・供給・財務の到達条件は現行の短期計画・長期計画を参照。実証目標と契約・調達の成立を分ける。",
  "12":"既存の排水ラインへ導入する構想。対象液、前後処理、必要水質、処理量、設置と安全の条件を顧客ごとに決める。",
  "13":"高い塩分、阻害薬剤、界面活性剤、低温、油分等で適用が制約される。物質・濃度ごとの成立限界と前処理を実排液で確定する。",
  "14":"設立予定と設立前後の開発・資金の条件は現行計画を参照。開発費・担当・契約の空白を設立前の工程で確認する。",
  "15":"菌体を増やす工程と、排液を処理する工程で必要な光条件を分ける。量産時の光収支・消費電力は実機測定で確認する。波長・光強度・制御設定は通常DDの対象外。",
  "16":"報告値は主にラボや試作装置の試験。バッチ・連続処理、菌体量、初期濃度、時間、分析法、反復をそろえて比較する。測定ごとの原データは限定技術情報として照合する。",
  "17":"未試験・検証中の物質は確認済みの用途と分ける。難分解物は実サンプルでの確認を進め、処理できることを先に保証しない。",
  "18":"関係者が事業状況と役割を共有する枠組みと、設立会社への出資契約は別に整理する。参画・投資・共同開発の合意状態をそれぞれ確認する。",
  "19":"金融機関・自治体・大学等の接点から候補先と試料提供を相談している。紹介、提供、試験、顧客現場PoC、商用契約は別段階で管理する。",
};
const overrides: Record<string,Partial<Record<string,string|null>>> = {
  pte_sx_e07:{value_text:"Dy・Ndの取り込みについて研究者報告。磁性材料メーカーのNd廃液原液で30分後に液中濃度がほぼゼロとの報告。初期値・検出限界・反復・回収率は未収録。"},
  pte_sx_0915_01:{value_text:"過去資料にはCOD低下の記載があるが、処理前後の原データ・分析法・菌体量・対照・反復が未収録。除去性能は未確定。",check_reason:"報告値の条件と原データの照合が必要。"},
  pte_sx_e04:{value_text:"反応性窒素を利用した増殖について研究者報告。年間処理能力は未実測。",value_mode:"text_only"},
  pte_sx_e03:{value_text:"自然株40ppm、強化株50ppmの鉄模擬排液で24時間の取り込みを報告。単回試験のため実排液と反復を追加確認。"},
  pte_sx_r15:{row_label:"金属の抽出回収率（試算の仮定）",condition_text:"85〜95%は抽出回収率の仮定。液中濃度低下の実績とは別。抽出率と純度は未実測。",check_reason:"実回収量と販売品質を追加確認。"},
  pte_sx_0915_02:{value_mode:"text_only",check_reason:"過去の18種類の記録と20社以上・20種類以上の報告を、試料台帳で照合する。"},
  pte_sx_k17:{value_text:"加温条件で約30分、室温で2〜3時間という報告例。",condition_text:"温度による処理時間の差。必要な熱量・運転範囲は実機で確認。具体的な制御設定は非掲載。"},
  pte_sx_ss11:{value_text:"加温条件で約30分、室温で2〜3時間という報告例。",condition_text:"温度による処理時間の差。必要な熱量・運転範囲は実機で確認。具体的な制御設定は非掲載。"},
  pte_sx_v01:{value_text:"液中鉄濃度の低下について研究者報告。菌体からの抽出回収率・純度は未確認。"},
  pte_sx_v02:{value_text:"煮豆排液の処理で生成した可能性。分析による同定・収率は未確認。"},
  pte_sx_ss19:{value_text:"煮豆排液の処理で生成した可能性。分析による同定・収率は未確認。"},
  pte_sx_r20:{row_label:"強化株の鉄取り込み（単回試験）",value_text:"50ppmの鉄模擬排液で24時間の取り込みを報告。上限・反復・実排液の成立範囲は追加確認。",condition_text:"鉄模擬排液の単回試験・24時間。必要量と反復・実排液を追加確認。"},
  pte_sx_ss04:{value_text:"pH2.6の鉄模擬排液で成立した単回試験との報告。酸性の実排液も結果報告あり。",condition_text:"酸性液への適用報告の例。生育可能域・運転設定・短時間の処理を区別。"},
  pte_sx_ss14:{value_text:"銅・鉄・ニッケル・鉛・クロム・亜鉛・カドミウム・アルミ・ストロンチウム等で確認報告。Nd・Dyは元素別の到達段階を参照。",condition_text:"研究者の説明資料と報告。物質ごとの濃度・条件・反復は別途確認。"},
  pte_sx_ss15:{value_text:"Ndの定量評価・反復、Dyの原液試験、その他未確認の物質。"},
  pte_sx_ss16:{condition_text:"鉄模擬排液の単回試験・24時間。商用保証値ではない。"},
  pte_sx_ss21:{condition_text:"菌体からの抽出回収率の仮定。実測値は未確定。"},
  pte_sx_ss24:{value_text:"自然株と強化株を用途ごとに区別。"},
  pte_sx_ss27:{value_text:"強化株を使う場合は封じ込め・輸送・回収等の適用条件を確認する。",condition_text:"具体的な改変・選抜操作は核心ノウハウとして保持。"},
  pte_sx_0915_14:{value_text:"乾燥細胞重量あたり12〜13%との分析報告。",condition_text:"脂肪酸の分析値。燃料の抽出量・品質の実証とは別。"},
  pte_sx_0915_10:{value_text:"乾燥細胞重量あたり12〜13%との分析報告。"},
  pte_sx_r21:{row_label:"鉄の取り込み量（乾燥菌体重量比）",condition_text:"単回試験からの算出値。原データと反復を確認する。"},
  pte_sx_r19:{condition_text:"鉄模擬排液の単回試験・24時間。必要菌体量と反復・実排液を追加確認。"},
  pte_sx_1001_r01:{value_text:"10Lを約1時間で処理。1時間後の鉄濃度0.09ppmとの報告。",condition_text:"研究者報告。測定は1時間後のみ。初期濃度、分析法、反復は未収録。",check_reason:"1時間後以外の測定点は未収録。処理速度と再現性を原データで確認する。"},
  pte_sol_mate_nd_20261008:{row_label:"磁性材料メーカーのNd廃液原液",condition_text:"研究者の報告。初期・処理後濃度、検出限界、条件、反復は未収録。"},
  pte_sx_d14:{row_label:"食品系排液Aの培養試験",value_text:"対照より増殖。43時間でpH5から約8との報告。",condition_text:"食品系の実排液。COD除去の実証とは別に確認する。"},
  pte_sx_d15:{row_label:"食品系排液Bの培養試験",value_text:"77時間時点で明瞭な増殖差なし。初期pH4.3との報告。",condition_text:"食品系の実排液。継続試験と反復を確認する。"},
  pte_sx_0915_03:{value_text:"数時間で目詰まり。1時間に約5分の逆洗が必要との報告。",condition_text:"装置の運転観察。連続性能と作業負担、漏出を追加確認する。"},
  pte_sx_0915_04:{value_text:"酸性の鉄系実排液で、処理後に中性へ戻ったとの報告。",condition_text:"pH2の実排液との報告。濃度・時間・反復は未収録。"},
  pte_sx_d12:{value_text:"鉄除去と色の変化の報告。ケルセチンの同定・収率は未確認。"},
};

const mapping: Row[] = [];
for (const t of topics) {
  const plan = topicPolicy[t.tech_topic_id]; if (!plan) throw new Error("未仕分けtopic: "+t.tech_topic_id);
  const dd = plan.title ? {title:plan.title,summary:plan.summary ?? t.summary,body_md:body[t.tech_topic_id]??null,source_label:"技術台帳の研究者報告・事業化検討記録",check_reason:null} : null;
  const disclosure = amiePrepareTechDisclosure(t,"topic",{version:1,level:plan.level,reason:plan.reason,dd});
  mapping.push({entity:"topic",id:t.tech_topic_id,source_hash:t._pg_hash,disclosure});
}
for (const e of entries) {
  const id = e.tech_entry_id; const topic = e.tech_topic_id;
  const core = /TmtA|メタロチオネイン|遺伝子|ゲノム|配列|選抜|抽出の方法|メタノール|培養温度|二酸化炭素濃度|光の波長|光強度|pHが動く|ODから|ODの上限/.test(e.row_label) || ["pte_sx_k02","pte_sx_k03","pte_sx_k04","pte_sx_k05","pte_sx_k06","pte_sx_k08","pte_sx_k19","pte_sx_k20","pte_sx_k22"].includes(id);
  let allow = selected.has(id) || topic === "ptt_sol_qa" || topic === "ptt_sx_elements" || topic === "ptt_sx_valuables" || (topic === "ptt_sx_limits" && id !== "pte_sx_l07");
  if ((core && !selected.has(id)) || ["pte_sx_v08","pte_sx_v09","pte_sx_e16"].includes(id)) allow=false;
  const level:AmieTechLevel = allow ? "dd_summary" : core ? "core" : "restricted";
  let dd:Record<string,string|null>|null = null;
  if (allow) {
    const value = topic === "ptt_sol_qa" ? qa[id.slice(-2)] : e.value_text;
    dd = {row_label:e.row_label,col_label:null,value_text:value ?? null,value_mode:topic === "ptt_sol_qa" ? "text_only" : "source",condition_text:"研究者報告・資料の記載時点。適用条件・反復・原データを追加確認し、商用保証値と区別。",note:"詳細な手順と測定ごとの原データは限定技術情報として管理。",source_label: e.observed_on ? "研究者報告・技術台帳（"+e.observed_on+"）" : "研究者報告・技術台帳",check_reason:e.needs_check ? "適用条件・測定方法・原データ・反復等を追加確認する。" : null, ...overrides[id]};
    if (topic === "ptt_sx_elements") dd.condition_text="物質ごとの研究者報告。液中除去・抽出回収・純度と商用保証は別に確認。";
    if (topic === "ptt_sx_limits") dd.condition_text="適用できない条件または未確認の閾値。顧客の実排液で確認する。";
    if (id === "pte_sx_k07") dd.condition_text="基準条件の研究者報告。詳しい設定は非掲載。培養量産の能力は未実証。";
    if (id === "pte_sx_k18" || id === "pte_sx_0915_06" || id === "pte_sx_0915_15" || id === "pte_sx_0915_05" || id === "pte_sx_ss10") dd.condition_text="排液・排ガスを利用した予備的な研究者報告。再現性と条件の切り分けは未確認。";
    if (id === "pte_sx_bf03" || id === "pte_sx_bf04" || id === "pte_sx_ss18") dd.condition_text="2,000L級の設備を想定した内部試算。実出力・連続生産性・原価は未取得。";
    // コピー数・遺伝子・制御手順・抽出法などが要約欄へ残る場合は通常DDへ採用しない。
    const joined = Object.values(dd).join(" ");
    if (/TmtA|遺伝子[23２３]|OD5|Fe\(NO|メタノール|730nm|650nm|440|二酸化炭素[36]\.?[05]?%/.test(joined)) throw new Error("要約の個別仕分けが必要: "+id);
  }
  const reason = allow ? "事業化の性能・規模・適用限界・到達段階に関わるため概要のみDDへ掲載。原条件・備考・原データを丸ごと開示しない。" : core ? "株の改変・選抜・培養制御・抽出等の再現を可能にする情報。核心ノウハウとして通常DDから除外。" : "個別の実験条件・原データ・顧客データ・旧試算の詳細。通常DDから除外し、必要性と開示条件を個別に確認。";
  mapping.push({entity:"entry",id,source_hash:e._pg_hash,disclosure:amiePrepareTechDisclosure(e,"entry",{version:1,level,reason,dd})});
}
const quote = (s:string)=>"'"+s.replaceAll("'","''")+"'";
let sql="BEGIN;\n";
for (const entity of ["topic","entry"]) {
 const table=entity === "topic" ? "project_tech_topics" : "project_tech_entries"; const pk=entity === "topic" ? "tech_topic_id" : "tech_entry_id"; const rows=mapping.filter(r=>r.entity===entity);
 sql+=`DO $amie$ DECLARE changed integer; BEGIN\n WITH input AS (SELECT * FROM jsonb_to_recordset(${quote(JSON.stringify(rows))}::jsonb) AS x(id text,source_hash text,disclosure jsonb)), updated AS (UPDATE public.${table} r SET disclosure=x.disclosure FROM input x WHERE r.${pk}=x.id AND r.project_id='p21' AND md5((to_jsonb(r)-'disclosure'-'created_by'-'updated_by'-'created_at'-'updated_at'-'sort_order')::text)=x.source_hash RETURNING r.${pk}) SELECT count(*) INTO changed FROM updated;\n IF changed<>${rows.length} THEN RAISE EXCEPTION 'Tech disclosure snapshot changed: %/${rows.length}',changed; END IF; END $amie$;\n`;
}
sql+="COMMIT;\n";
fs.writeFileSync("scripts/data/amie_sol_tech_disclosure_20261012.sql",sql);
fs.writeFileSync(path.join(folder,"技術情報_開示仕分け.json"),JSON.stringify(mapping,null,2)+"\n");
const getRecord=(r:Row)=> (r.entity === "topic" ? topics : entries).find(x=>x[r.entity === "topic" ? "tech_topic_id":"tech_entry_id"]===r.id);
const cell=(s:any)=>String(s??"").replaceAll("|","／").replaceAll("\n"," ");
const lines=["# SOL 技術情報の開示仕分け","","2026年10月12日。事業化判断に必要な数字・適用限界・未達事項を通常DDへ抜粋。個別試験条件・原データ・再現手順は別管理。","","1 公開情報、2 DD判断情報、3 限定技術情報、4 核心ノウハウ。DDへの掲載は別原稿と元内容の一致で管理する。非公開の大学・顧客情報の利用許諾は、秘密レベルの指定とは別に確認する。","","|区分|項目|秘密レベル|通常DD|理由|","|---|---|---|---|---|"];
for(const r of mapping) { const v=getRecord(r)!; lines.push(`|${r.entity === "topic" ? "本文":"行"}|${cell(v.title??v.row_label)}|${r.disclosure.level}|${r.disclosure.dd ? (r.entity === "topic" && ["restricted","core"].includes(r.disclosure.level) ? "見出し・掲載行のみ":"概要を掲載") : "非掲載"}|${cell(r.disclosure.reason)}|`); }
fs.writeFileSync(path.join(folder,"技術情報の開示仕分け.md"),lines.join("\n")+"\n");
console.log(JSON.stringify({topics:topics.length,entries:entries.length,levels:mapping.reduce((x:Row,r:Row)=>(x[r.disclosure.level]=(x[r.disclosure.level]??0)+1,x),{}),ddEntries:mapping.filter(r=>r.entity==="entry"&&r.disclosure.dd).length}));

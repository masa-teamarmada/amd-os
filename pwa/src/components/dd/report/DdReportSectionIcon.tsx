import {Award,Briefcase,Building2,ChartColumnIncreasing,Coins,Factory,FlaskConical,Handshake,Lightbulb,Network,Scale,ShieldCheck,Target,Truck,Users} from 'lucide-react';
export function DdReportSectionIcon({title}:{title:string}){
  const Icon=/受賞/.test(title)?Award:/収益|資金|価格|費用|原価|調達|投資/.test(title)?Coins:/規制|安全|品質|許可/.test(title)?ShieldCheck:/権利|知財|契約|特許/.test(title)?Scale:/体制|責任|人員|職務|組織/.test(title)?Users:/工場|製造|設備|生産/.test(title)?Factory:/供給|回収|物流|出荷/.test(title)?Truck:/研究|技術|実験|性能/.test(title)?FlaskConical:/協業|連携|顧客|案件/.test(title)?Handshake:/市場|競合|拡販|海外/.test(title)?ChartColumnIncreasing:/計画|目標|開発|工程/.test(title)?Target:/会社|設立|創業/.test(title)?Building2:/事業|商品|製品/.test(title)?Briefcase:/原理|特徴/.test(title)?Lightbulb:Network;
  return <Icon className="ddr-section-icon" size={17} strokeWidth={1.8} aria-hidden="true"/>;
}

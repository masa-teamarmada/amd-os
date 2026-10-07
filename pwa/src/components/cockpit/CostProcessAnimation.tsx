import type { CostProcessKey } from "@/lib/cost-process-summary";
import styles from "./CostProcessSummary.module.css";

const cells = [[84, 44], [100, 52], [88, 67], [108, 72], [95, 83], [116, 47], [78, 79], [118, 88], [106, 61], [78, 57]];

function Cartridge({ used = false }: { used?: boolean }) {
  return <g>
    <rect x="94" y="30" width="34" height="54" rx="5" className={styles.vessel} />
    <rect x="98" y="35" width="26" height="44" rx="3" className={styles.biomassFill} />
    <path d="M98 30v-5h26v5M98 84v5h26v-5" className={styles.machine} />
    {[44, 57, 70].map((y) => <g key={y} className={styles.cells}><circle cx="106" cy={y} r="3" /><circle cx="117" cy={y + 4} r="3" /></g>)}
    {used && <g className={styles.pollutant}><circle cx="105" cy="51" r="2" /><circle cx="117" cy="65" r="2" /></g>}
  </g>;
}

/** Schematic motion explains the process; timing and cell counts are illustrative. */
export function CostProcessAnimation({ process, cartridge, metal, offsite }: {
  process: CostProcessKey; cartridge: boolean; metal: boolean; offsite: boolean;
}) {
  return <svg viewBox="0 0 220 110" className={styles.scene} aria-hidden="true" focusable="false" data-process-scene={process}>
    <path d="M18 100h184" className={styles.ground} />
    {process === "culture" && <>
      <path d="M70 32v56q0 9 30 9t30-9V32" className={styles.vessel} />
      <ellipse cx="100" cy="32" rx="30" ry="7" className={styles.machine} />
      <path d="M74 42v44q0 6 26 6t26-6V42" className={styles.biomassFill} />
      <path d="M52 38v48M146 38v48" className={styles.lightTube} />
      <path d="M54 45h15m-15 15h15m-15 15h15m61-30h15m-15 15h15m-15 15h15" className={styles.lightRays} />
      <path d="M174 83h-20V60h-24" className={styles.pipe} />
      <path d="M174 83h-20V60h-24" className={styles.flow} />
      <text x="39" y="26">光</text><text x="158" y="50">CO₂</text><text x="76" y="17">培養槽</text>
      {cells.map(([x, y], i) => <g key={i} className={styles.grow} style={{ animationDelay: `${-i * 0.48}s`, transformOrigin: `${x}px ${y}px` }}>
        <ellipse cx={x} cy={y} rx="4" ry="2.5" className={styles.cell} /><ellipse cx={x + 6} cy={y + 2} rx="3" ry="2" className={styles.cell} />
      </g>)}
      <circle cx="124" cy="74" r="2" className={styles.bubble} /><circle cx="127" cy="83" r="2" className={styles.bubble} style={{ animationDelay: "-1s" }} />
    </>}
    {process === "concentrate" && <>
      <path d="M32 42v43q0 8 18 8t18-8V42" className={styles.vessel} />
      <path d="M36 57v26q0 5 14 5t14-5V57" className={styles.biomassFill} />
      <path d="M68 66h25m34 0h26v20h24" className={styles.pipe} />
      <path d="M68 66h25m34 0h26v20h24" className={styles.flow} />
      <rect x="93" y="40" width="34" height="48" rx="4" className={styles.vessel} />
      <path d="M101 43v42m8-42v42m8-42v42" className={styles.filter} />
      <path d="M110 40V22h50" className={styles.pipe} /><path d="M110 40V22h50" className={styles.flow} />
      <path d="M175 25q-8 10 0 10t0-10" className={styles.water} />
      <path d="M168 73v17h24V73" className={styles.machine} />
      <path d="M170 80h20v8h-20" className={styles.biomassFill} />
      {[43, 52, 61].map((x) => <circle key={x} cx={x} cy="70" r="2.5" className={styles.cell} />)}
      {[174, 181, 188].map((x) => <g key={x} className={styles.cells}><circle cx={x} cy="81" r="3" /><circle cx={x} cy="87" r="3" /></g>)}
      <text x="29" y="30">培養液</text><text x="93" y="103">分離</text><text x="179" y="50">水</text>
    </>}
    {process === "prepare" && <>
      <path d="M32 25h30v18L47 58 32 43Z" className={styles.vessel} /><path d="M47 58v22h47" className={styles.pipe} /><path d="M47 58v22h47" className={styles.biomassFlow} />
      {cartridge ? <Cartridge /> : <><rect x="92" y="37" width="38" height="50" rx="5" className={styles.vessel} /><rect x="97" y="50" width="28" height="31" rx="3" className={styles.biomassFill} /><path d="M102 32h18v5" className={styles.machine} /></>}
      <path d="M137 59h14" className={styles.arrow} />
      <path d="M158 43l18-9 18 9v40l-18 9-18-9ZM158 43l18 9 18-9m-18 9v40" className={styles.machine} />
      <path d="m166 67 6 6 12-14" className={styles.check} />
      <text x="25" y="15">充填</text><text x="152" y="18">検査・密封</text>
    </>}
    {process === "deliver" && <>
      <path d="M16 87V51l24-13v13l24-13v49M21 60h35m-30 6v13m14-13v13m13-13v13" className={styles.machine} />
      <path d="M175 89V44h30v45m-23-38h7m7 0h6m-20 12h7m7 0h6m-20 12h7m7 0h6" className={styles.machine} />
      <g className={styles.drive}>
        <path d="M77 59h49v26H77Zm49 7h16l12 10v9h-28" className={styles.vehicle} />
        <path d="M132 69h8l9 8h-17Z" className={styles.water} />
        {offsite ? <ellipse cx="101" cy="72" rx="19" ry="9" className={styles.water} /> : <><rect x="85" y="63" width="10" height="17" rx="2" className={styles.biomassFill} /><rect x="103" y="63" width="10" height="17" rx="2" className={styles.biomassFill} /></>}
        <circle cx="88" cy="87" r="6" className={styles.wheel} /><circle cx="141" cy="87" r="6" className={styles.wheel} />
      </g>
      <path d="M66 98h100" className={styles.road} /><text x="16" y="26">{offsite ? "顧客" : "製造拠点"}</text><text x="166" y="26">{offsite ? "処理拠点" : "顧客"}</text>
    </>}
    {process === "install" && <>
      <rect x="77" y="43" width="71" height="49" rx="5" className={styles.vessel} />
      <path d="M84 52h56M63 68H40v23m108-23h33V44" className={styles.pipe} />
      {cartridge ? <g className={styles.install}><Cartridge /></g> : <><path d="M100 19v30" className={styles.biomassFlow} /><rect x="84" y="12" width="31" height="16" rx="3" className={styles.biomassFill} /><path d="M82 60h60v26H82" className={styles.biomassFill} /></>}
      <circle cx="179" cy="39" r="9" className={styles.machine} /><path d="m174 39 4 4 6-8" className={styles.check} />
      <text x="28" y="20">{cartridge ? "装着" : "投入準備"}</text><text x="150" y="20">接続確認</text>
    </>}
    {process === "treat" && <>
      <path d="M21 59h53m67 0h57" className={styles.pipe} /><path d="M21 59h53m67 0h57" className={styles.flow} />
      {cartridge ? <Cartridge used={metal} /> : <><rect x="77" y="32" width="64" height="53" rx="5" className={styles.vessel} /><path d="M82 45h54v34H82" className={styles.biomassFill} /><g className={styles.cells}>{cells.slice(0, 6).map(([x, y], i) => <circle key={i} cx={x + 6} cy={y - 3} r="3" />)}</g></>}
      {[28, 43, 58].map((x, i) => <circle key={x} cx={x} cy="59" r="4" className={styles.capture} style={{ animationDelay: `${-i * 0.8}s` }} />)}
      <path d="M159 53h10m7 12h10" className={styles.cleanWater} />
      <text x="19" y="24">排水</text><text x="157" y="24">処理水</text><text x="65" y="106">{metal ? "金属を取り込む" : "色素を分解する"}</text>
    </>}
    {process === "collect" && <>
      <rect x="37" y="49" width="49" height="44" rx="4" className={styles.vessel} />
      <path d="M43 57h37M45 78h32" className={styles.machine} />
      {cartridge ? <g className={styles.remove}><Cartridge used /></g> : <><rect x="99" y="30" width="24" height="53" rx="3" className={styles.vessel} /><path d="M107 33v46m8-46v46" className={styles.filter} /><path d="M85 68h13m26 0h27" className={styles.biomassFlow} /></>}
      <path d="M156 48h35v42h-35Zm-3 0v-6h41v6" className={styles.machine} />
      <path d="M164 60h19v19h-19Z" className={styles.biomassFill} />
      <path d="m163 83 5 4 9-8" className={styles.check} />
      <text x="26" y="21">{cartridge ? "停止・取り外し" : "菌体を分離"}</text><text x="155" y="21">密封</text>
    </>}
    {process === "finish" && <>
      <path d="M19 61h28m32 0h24m35 0h22" className={styles.pipe} /><path d="M19 61h28m32 0h24m35 0h22" className={styles.biomassFlow} />
      <rect x="47" y="41" width="32" height="42" rx="4" className={styles.vessel} /><path d="M51 57h24v21H51" className={styles.biomassFill} />
      <rect x="103" y="41" width="35" height="42" rx="4" className={styles.vessel} /><path d="M108 70l7-15 8 12 8-5" className={styles.check} />
      {metal ? <><path d="M164 38h25v30h-25Z" className={styles.metal} /><text x="153" y="24">金属回収</text></> : <><path d="M161 45V19H62v17" className={styles.returnFlow} /><text x="83" y="14">再使用を評価</text></>}
      <path d="M168 79h25l-3 18h-19Zm-3 0h31m-21-5h11" className={styles.machine} />
      <text x="36" y="103">{metal ? "酸処理" : "洗浄"}</text><text x="105" y="103">分析</text><text x="166" y="109">処分</text>
    </>}
  </svg>;
}

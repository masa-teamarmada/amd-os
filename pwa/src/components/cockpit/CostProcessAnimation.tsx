import type { CostProcessKey } from "@/lib/cost-process-summary";
import styles from "./CostProcessSummary.module.css";

const positions: Record<CostProcessKey, string> = {
  culture: "0% 0%", concentrate: "33.333333% 0%", prepare: "66.666667% 0%", deliver: "100% 0%",
  install: "0% 100%", treat: "33.333333% 100%", collect: "66.666667% 100%", finish: "100% 100%",
};
const cells = [[68, 57], [82, 65], [74, 80], [91, 84], [80, 95], [96, 66], [64, 92], [98, 101]];

function MovingCartridge() {
  return <g><path d="m-8-18 8-4 8 4v30l-8 4-8-4Z" className={styles.biomassFill} /><path d="M0-22v38m-8-34 8 4 8-4" className={styles.check} /><circle cx="-3" cy="-5" r="2" className={styles.cell} /><circle cx="3" cy="4" r="2" className={styles.cell} /></g>;
}

/** Generated isometric equipment shares a canvas; only explanatory motion and
 * condition-dependent material flow are drawn on top. Shapes are illustrative. */
export function CostProcessAnimation({ process, cartridge, metal, offsite }: {
  process: CostProcessKey; cartridge: boolean; metal: boolean; offsite: boolean;
}) {
  return <span className={styles.scene} aria-hidden="true" data-process-scene={process}>
    <span className={`${styles.equipmentArt} ${process === "deliver" ? styles.drive : ""}`} style={{ backgroundPosition: positions[process] }} />
    <svg viewBox="0 0 160 160" className={styles.sceneMotion} focusable="false">
      {process === "culture" && <>
        <path d="M45 58h14m-15 14h15m-15 14h15m48-28h14m-14 14h14m-14 14h14" className={styles.lightRays} />
        {cells.map(([x, y], i) => <g key={i} className={styles.grow} style={{ animationDelay: `${-i * .6}s`, transformOrigin: `${x}px ${y}px` }}><ellipse cx={x} cy={y} rx="3" ry="2" className={styles.cell} /><ellipse cx={x + 4} cy={y + 2} rx="2" ry="1.5" className={styles.cell} /></g>)}
        <circle cx="112" cy="91" r="2.5" className={styles.bubble} /><circle cx="115" cy="101" r="2" className={styles.bubble} style={{ animationDelay: "-1s" }} />
      </>}
      {process === "concentrate" && <><path d="M25 96q32-36 65-10t42 24" className={styles.biomassFlow} /><circle cx="128" cy="112" r="3" className={styles.cell} /><circle cx="135" cy="108" r="3" className={styles.cell} /></>}
      {process === "prepare" && <><path d="M77 63v36" className={styles.biomassFlow} /><path d="m113 50 5 5 9-12" className={styles.check} />{cartridge && <g transform="translate(82 99) scale(.5)"><MovingCartridge /></g>}</>}
      {process === "deliver" && offsite && <path d="M43 93h54" className={styles.flow} />}
      {process === "install" && (cartridge ? <g transform="translate(79 73)"><g className={styles.install}><MovingCartridge /></g></g> : <path d="M64 38v56" className={styles.biomassFlow} />)}
      {process === "treat" && <>
        <path d="M14 93h37m60 0h33" className={styles.flow} />
        {[24, 35, 47].map((x, i) => <circle key={x} cx={x} cy="93" r="3" className={styles.capture} style={{ animationDelay: `${-i * .8}s` }} />)}
        {metal && <g className={styles.pollutant}><circle cx="87" cy="87" r="2" /><circle cx="94" cy="99" r="2" /></g>}
      </>}
      {process === "collect" && (cartridge ? <g transform="translate(84 85)"><g className={styles.retrieve}><MovingCartridge /></g></g> : <path d="M51 89h62" className={styles.biomassFlow} />)}
      {process === "finish" && <><circle cx="56" cy="86" r="2.5" className={styles.bubble} /><path d="m98 57 5 5 9-12" className={styles.check} />{metal ? <g className={styles.pollutant}><circle cx="110" cy="104" r="4" /><circle cx="119" cy="110" r="3" /></g> : <path d="M122 50q-35-30-62 0" className={styles.returnFlow} />}</>}
    </svg>
  </span>;
}

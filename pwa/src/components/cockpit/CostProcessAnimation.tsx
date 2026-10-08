import { useId } from "react";
import styles from "./CostProcessSummary.module.css";

const cells = [[185,265],[211,279],[230,296],[177,310],[204,326],[237,338],[186,347],[224,353]];
const stations = [[13,15],[36,20],[59,21],[85,16],[86,47],[62,53],[36,53],[14,49]];
/** One generated illustration, with motion aligned to its fixed coordinates.
 * Machinery and material flows are schematic, not equipment specifications. */
export function CostProcessAnimation({ cartridge, metal, offsite }: {
  cartridge: boolean; metal: boolean; offsite: boolean;
}) {
  const id = useId();
  const movingImage = <image href="/illustrations/cost-process-factory-moving-parts-20261008.png" width="1536" height="1024" />;
  const part = (name: string) => <g clipPath={`url(#${id}-${name})`}>{movingImage}</g>;
  const cartridgeImage = <g transform="translate(-894 -299)">{part("cartridge")}</g>;
  return <div className={styles.illustration} data-testid="cost-process-illustration">
    <svg viewBox="0 0 1536 1024" className={styles.factoryScene} role="img" aria-label="培養、濃縮、製造、配送、設置、処理、回収、返送後処理がつながった一枚の工場イラスト">
      <defs>
        <clipPath id={`${id}-truck`}><rect x="1230" y="210" width="280" height="210" /></clipPath>
        <clipPath id={`${id}-fill-arm`}><path d="M800 160h120v85h-39v75h-81Z" /></clipPath>
        <clipPath id={`${id}-install-arm`}><rect x="1168" y="418" width="130" height="105" /></clipPath>
        <clipPath id={`${id}-collect-arm`}><rect x="470" y="565" width="140" height="100" /></clipPath>
        <clipPath id={`${id}-cartridge`}><rect x="881" y="243" width="29" height="67" /></clipPath>
      </defs>
      <image href="/illustrations/cost-process-factory-background-20261008.png" width="1536" height="1024" />
      <g aria-hidden="true" className={styles.factoryMotion}>
        <g data-process-motion="culture">
          <path d="M134 239v94m134-91v91" className={styles.lightRays} />
          <path d="M98 180h57" className={styles.gasFlow} />
          {cells.map(([x,y],i)=><g key={i} className={styles.grow} style={{animationDelay:`-${i*.7}s`,transformOrigin:`${x}px ${y}px`}}><ellipse cx={x} cy={y} rx="6" ry="4" className={styles.cell}/><ellipse cx={x+7} cy={y+3} rx="4" ry="3" className={styles.cell}/></g>)}
          {[0,1,2].map(i=><circle key={i} cx={246-i*18} cy={349-i*15} r="4" className={styles.bubble} style={{animationDelay:`-${i*.8}s`}}/>)}
        </g>
        <g data-process-motion="concentrate">
          <path d="M288 220h18q19 0 19 24v26q0 15 19 15h140" className={styles.biomassFlow}/>
          <ellipse cx="555" cy="279" rx="38" ry="12" className={styles.concentratePulse}/>
          <path d="M630 303q30 0 28 36v28" className={styles.biomassFlow}/>
        </g>
        <g data-process-motion="prepare">
          <g className={styles.fillArm}><g transform="translate(25 17)">{part("fill-arm")}</g></g>
          <path d="M856 282v59" className={styles.biomassFlow}/>
          {[0,1,2].map(i=><g key={i} className={styles.conveyTop} style={{animationDelay:`-${i*2}s`,transform:`translate(${820+i*90}px,${369+i*5}px)`}}>{cartridgeImage}</g>)}
        </g>
        <g data-process-motion="deliver">
          <g className={styles.truck}><g transform="translate(243 62) scale(.84)">{part("truck")}</g></g>
          <path d="M1400 415q84 21 84 72v136q0 46-61 62" className={styles.deliveryFlow}/>
          {offsite && <path d="M1423 685q61-16 61-62V487q0-51-84-72" className={styles.flow}/>}
        </g>
        <g data-process-motion="install">
          <g className={styles.installArm}><g transform="translate(14 45)">{part("install-arm")}</g></g>
          {cartridge ? <g transform="translate(1339 567)"><g className={styles.install}>{cartridgeImage}</g></g> : <path d="M1284 484v55" className={styles.biomassFlow}/>}
          <path d="M1078 616l58-10q10-2 10-16v-15" className={styles.flow}/>
        </g>
        <g data-process-motion="treat">
          {[0,1,2,3].map(i=><circle key={i} cx={1015-i*8} cy={654+i*15} r="5" className={styles.capture} style={{animationDelay:`-${i*.8}s`}}/>)}
          {[0,1,2].map(i=><circle key={i} cx={870+i*55} cy="715" r="4" className={styles.bubble} style={{animationDelay:`-${i*.7}s`}}/>)}
          <path d="M831 599h-32q-22 0-22 24v23" className={styles.flow}/>
          {metal && <g className={styles.metalCapture}><circle cx="896" cy="698" r="5"/><circle cx="937" cy="697" r="4"/><circle cx="984" cy="698" r="5"/></g>}
        </g>
        <g data-process-motion="collect">
          <g className={styles.collectArm}><g transform="translate(60 68) scale(.9)">{part("collect-arm")}</g></g>
          {cartridge ? <g transform="translate(581 671)"><g className={styles.retrieve}>{cartridgeImage}</g></g> : <path d="M780 720h-113" className={styles.biomassFlow}/>}
          {[0,1].map(i=><g key={i} className={styles.conveyBottom} style={{animationDelay:`-${i*3}s`,transform:`translate(${700-i*170}px,${718-i*10}px)`}}>{cartridgeImage}</g>)}
        </g>
        <g data-process-motion="finish">
          <ellipse cx="214" cy="644" rx="52" ry="19" className={styles.wash}/>
          {[0,1,2].map(i=><circle key={i} cx={193+i*18} cy="646" r="4" className={styles.bubble} style={{animationDelay:`-${i*.7}s`}}/>)}
          {metal && <g className={styles.metalCapture}><circle cx="92" cy="697" r="5"/><circle cx="110" cy="704" r="4"/></g>}
        </g>
      </g>
    </svg>
    <div className={styles.equipmentNumbers} aria-hidden="true">{stations.map(([x,y],i)=><span key={i} className={styles.number} style={{left:`${x}%`,top:`${y}%`}}>{i+1}</span>)}</div>
  </div>;
}

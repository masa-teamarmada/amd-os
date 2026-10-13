import type { ReactNode } from "react";
import { LockKeyhole, Check, TriangleAlert } from "lucide-react";
import type { TechEntry, TechTopic } from "@/lib/project-tech";
import { amieTechFieldState, type AmieTechDisplayState } from "@/lib/amie-tech-display";
import styles from "./amie-tech-reading.module.css";

const labels: {[key in AmieTechDisplayState]:string} = { dd:"DD開示", excerpt:"一部DD開示", private:"社内限定", review:"再確認待ち" };
export function AmieTechDisclosureMark({state,label}:{state:AmieTechDisplayState;label?:string}) {
  const Icon = state === "private" ? LockKeyhole : state === "review" ? TriangleAlert : Check;
  return <span className={`${styles.badge} ${styles[state]}`} data-amie-disclosure={state}><Icon size={11} aria-hidden="true"/>{label??labels[state]}</span>;
}
/** 表示中の値自体に印を付ける。原本の全文をDD対象と誤認させない。 */
export function AmieTechDisclosureField({record,shared,fields,enabled,label,children,parentStatus}:{record:TechEntry|TechTopic;shared?:TechEntry|TechTopic;fields:string[];enabled:boolean;label?:string;children:ReactNode;parentStatus?:TechTopic["disclosure_status"]}) {
  if(!enabled) return <>{children}</>;
  const state=amieTechFieldState(record,shared,fields,parentStatus);
  return <div className={`${styles.field} ${styles[state]}`} data-amie-field={fields.join(",")}>
    <div className={styles.fieldLabel}>{label&&<span>{label}</span>}<AmieTechDisclosureMark state={state}/></div>{children}
  </div>;
}
export function AmieTechDisclosureLegend() {
  return <div className={styles.legend} data-testid="amie-tech-disclosure-legend"><AmieTechDisclosureMark state="dd"/><AmieTechDisclosureMark state="excerpt"/><AmieTechDisclosureMark state="private"/><AmieTechDisclosureMark state="review"/></div>;
}

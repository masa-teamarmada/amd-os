"use client";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import type { ProjectOrganizationChartData } from "@/lib/project-organization-chart";
import styles from "./RegisteredOrganizationChart.module.css";

export function RegisteredOrganizationChart({ data }: { data: ProjectOrganizationChartData }) {
  const columns = { "--partner-columns": Math.min(3, data.collaborations.length), "--org-columns": data.departments.length, "--org-width": `${data.departments.length * 300 + (data.departments.length - 1) * 48 + 36}px` } as CSSProperties;
  const chartRef = useRef<HTMLDivElement>(null);
  const arrowId = useId().replaceAll(":", "");
  const [links, setLinks] = useState<string[]>([]);
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const measure = () => {
      const origin = chart.getBoundingClientRect();
      const departments = Array.from(chart.querySelectorAll<HTMLElement>("[data-org-department]"));
      const partners = Array.from(chart.querySelectorAll<HTMLElement>("[data-org-partner]"));
      setLinks(data.collaborations.flatMap((partner) => {
        const department = departments.find((node) => node.dataset.orgDepartment === partner.departmentId);
        const target = partners.find((node) => node.dataset.orgPartner === partner.id);
        if (!department || !target) return [];
        const from = department.getBoundingClientRect(), to = target.getBoundingClientRect();
        const siblings = data.collaborations.filter((item) => item.departmentId === partner.departmentId);
        const slot = siblings.findIndex((item) => item.id === partner.id);
        const x = from.left - origin.left + from.width / 2 + slot * 8;
        const y = from.bottom - origin.top + 4;
        if (origin.width <= 520) {
          const endX = to.left - origin.left - 4, endY = to.top - origin.top + 28;
          const lane = Math.max(6, to.left - origin.left - 12 - slot * 8);
          return [`M ${x} ${y} V ${y + 72 + slot * 8} H ${lane} V ${endY} H ${endX}`];
        }
        const endX = to.left - origin.left + to.width / 2, endY = to.top - origin.top - 4;
        return [`M ${x} ${y} V ${y + 36 + slot * 8} H ${endX} V ${endY}`];
      }));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(chart);
    chart.querySelectorAll("[data-org-department], [data-org-partner]").forEach((node) => observer.observe(node));
    measure();
    return () => observer.disconnect();
  }, [data]);
  return <section data-testid="project-organization-chart" className="min-w-0 space-y-3 py-2">
    <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><h2 className="text-lg font-semibold">組織図</h2><span className="text-xs text-slate-500">{data.status === "proposed" ? "組織案" : "登録済み"} · {data.asOf}</span></header>
    <div ref={chartRef} className={styles.chart} style={columns} role="group" aria-label="組織・協業体制">
      <svg className={styles.connections} aria-hidden="true">
        <defs><marker id={arrowId} viewBox="0 0 8 8" markerWidth="6" markerHeight="6" refX="7" refY="4" orient="auto-start-reverse"><path d="M 0 0 L 8 4 L 0 8 Z" fill="#607487" /></marker></defs>
        {links.map((path, i) => <path key={data.collaborations[i].id} d={path} fill="none" stroke="#607487" strokeWidth="1.5" markerStart={`url(#${arrowId})`} markerEnd={`url(#${arrowId})`} />)}
      </svg>
      <section data-testid="organization-company-boundary" className="min-w-0 rounded-lg border-2 border-sky-700/60 bg-sky-50/20 p-3 sm:p-4" aria-label="NewCoの社内組織">
        <h3 className="mb-3 text-sm font-semibold text-sky-800">NewCo{data.status === "proposed" ? "（組織案）" : ""}</h3>
        <div className="flex min-w-0 flex-col items-center">
          {data.governingBodies.map((g, i) => <div key={g.label + i} className="flex w-full min-w-0 flex-col items-center">
            {i > 0 && <div className="h-4 border-l border-slate-400" aria-hidden="true" />}
            <div className="w-full max-w-72 break-words border border-sky-700/50 bg-slate-50 px-3 py-2 text-center"><strong className="text-sm">{g.label}</strong>{g.person && <p className="mt-1 text-sm">{g.person}</p>}</div>
          </div>)}
          <div className="h-6 border-l border-slate-400" aria-hidden="true" />
        </div>
        <div className={styles.departments}>
          {data.departments.map((d) => <div key={d.id} className={styles.department}>
            <div className="h-4 border-l border-slate-400" aria-hidden="true" />
            <section data-org-department={d.id} className="w-full min-w-0 flex-1 break-words border border-slate-300 bg-white" aria-label={d.label}>
              <h4 className="border-b border-slate-300 bg-slate-50 px-3 py-2 text-center text-sm font-semibold">{d.label}</h4>
              <ul className="mx-3 my-2 list-inside list-disc text-sm leading-5">{d.roles.map((role, j) => <li key={j}>{role}</li>)}</ul>
              {d.people.length > 0 && <div className="mx-3 mb-3 border-t border-slate-200 pt-2 text-xs leading-5 text-slate-600">{d.people.map((person, j) => <p key={j}>{person}</p>)}</div>}
            </section>
          </div>)}
        </div>
      </section>
      {data.collaborations.length > 0 && <section className={`${styles.collaborations} min-w-0 px-3 sm:px-4`} aria-label="NewCoの社外協業先">
        <h3 className="mt-4 text-sm font-semibold text-slate-600">協業先（社外）</h3>
        <div className={styles.partners}>
          {data.collaborations.map((p) => <section key={p.id} data-org-partner={p.id} className="min-w-0 break-words border border-slate-300 bg-white" aria-label={p.label}>
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2"><h4 className="text-sm font-semibold text-sky-800">{p.label}</h4><p className="mt-1 text-xs text-slate-600">{p.relationship}</p></div>
            <ul className="mx-3 my-2 list-inside list-disc text-sm leading-5">{p.roles.map((role, j) => <li key={j}>{role}</li>)}</ul>
            {p.people.length > 0 && <div className="px-3 pb-2 text-xs leading-5 text-slate-600">{p.people.map((person, j) => <p key={j}>{person}</p>)}</div>}
          </section>)}
        </div>
      </section>}
    </div>
    <p className="text-xs leading-5 text-slate-500">枠内：NewCoの社内組織 · 実線：社内の指揮・統括関係 · 両矢印：研究委託・共同開発の連携</p>
    <p className="max-w-2xl text-xs leading-5 text-slate-500">{data.note}</p>
  </section>;
}

import fs from 'node:fs/promises';
import path from 'node:path';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DdReportContent} from '../src/components/dd/report/DdReportContent.tsx';
import {DD_REPORT_CSS} from '../src/components/dd/report/dd-report-style.ts';
const folder=process.argv[2],manifest=JSON.parse(await fs.readFile(path.join(folder,'manifest.json'),'utf8'));
const out=path.join(folder,'画面・出力検証'),assetUrls:Record<string,string>={};
for(const a of manifest.assets)assetUrls[a.key]=`data:${a.mime};base64,${(await fs.readFile(path.join(folder,'assets',a.key))).toString('base64')}`;
for(const chapter of manifest.chapters){
  const content=renderToStaticMarkup(h(DdReportContent,{chapter,index:manifest.chapters,slug:'sol',assetUrls}));
  const nav=manifest.chapters.map((c:{slug:string;title:string})=>`<a href="preview-${c.slug}.html" ${c.slug===chapter.slug?'aria-current="page"':''}>${c.title}</a>`).join('');
  const html=`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${DD_REPORT_CSS}body{margin:0;font-family:system-ui,sans-serif;padding:24px}.preview{max-width:1440px;margin:auto;display:grid;grid-template-columns:216px minmax(0,1fr);gap:32px}.preview-nav{position:sticky;top:24px;max-height:90vh;overflow:auto}.ddr-header{padding-top:16px}@media(max-width:700px){body{padding:16px}.preview{display:block}.preview-nav{display:none}}</style><div class="preview"><aside class="ddr ddr-nav preview-nav">${nav}</aside><main class="ddr"><header class="ddr-header"><div class="ddr-kicker">SOLVIORAX · DD PACKAGE</div><div class="ddr-hero-line"></div><div class="ddr-kicker">${chapter.group_label}</div><h1>${chapter.title}</h1><div class="ddr-version">SolvioraX · 資料版1 · 全38資料</div></header>${content}</main></div></html>`;
  await fs.writeFile(path.join(out,'preview-'+chapter.slug+'.html'),html);
}
console.log('38 chapter previews written');

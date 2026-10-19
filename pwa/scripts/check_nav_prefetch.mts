import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// 左メニュー・ホームのカードの先読み（2026-10-20 Vercel CPU対策、spec5-10）。
// 本番で、管理画面1回の表示で左メニュー約19画面を2回ずつ、ホーム1回の表示でPJコックピット18画面を先読みしていた。
// 表示時は先読みせず、hover/focusのときだけ先読みする。新しいタブで開くリンクは先読みしない。
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const intent=read('src/components/nav/IntentLink.tsx');
assert.match(intent,/prefetch=\{false\}/,'IntentLinkは表示時に先読みしない');
assert.match(intent,/onMouseEnter=\{\(event: MouseEvent<HTMLAnchorElement>\) => \{ warm\(\);/,'hoverで先読みする');
assert.match(intent,/onFocus=\{\(event: FocusEvent<HTMLAnchorElement>\) => \{ warm\(\);/,'focusで先読みする');
assert.match(intent,/target !== "_blank"\) router\.prefetch\(destination\)/,'新しいタブで開くリンクは先読みしない');
const plainLinks=(source:string)=>[...source.matchAll(/<Link\b[^>]*>/g)].map(m=>m[0]).filter(tag=>!tag.includes('prefetch={false}'));
for(const file of ['src/components/admin/AdminSidebar.tsx','src/components/nav/GlobalNav.tsx','src/components/dashboard/PortfolioPulse.tsx','src/components/dashboard/InstitutionReadinessList.tsx','src/components/dashboard/DashboardGrid.tsx']){
  const source=read(file);
  assert.deepEqual(plainLinks(source),[],`${file} の<Link>は表示時に先読みしない（IntentLinkか prefetch={false}）`);
}
assert.ok(read('src/components/admin/AdminSidebar.tsx').includes('<IntentLink'),'管理メニューはIntentLink');
assert.ok(read('src/components/nav/GlobalNav.tsx').includes('<IntentLink'),'全体メニューはIntentLink');
assert.match(read('src/components/dashboard/DashboardGrid.tsx'),/<Link target="_blank" rel="noopener noreferrer" prefetch=\{false\}/,'新しいタブで開くPJカードは先読みしない');
console.log('ナビゲーションの先読み: 表示時の先読みなし・hover/focusのみ・新しいタブは先読みなし PASS');

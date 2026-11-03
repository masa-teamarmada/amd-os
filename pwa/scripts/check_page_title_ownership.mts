import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {claimPageTitle,ownsPageTitle} from '../src/lib/page-title-ownership.ts';

export function verifyTitleObservers(source:string,expectLoop=false){
 const callbacks=new Set<()=>void>(),pending:Array<()=>void>=[],effects:Array<()=>()=>void>=[];
 const doc:any=new EventTarget(),win=new EventTarget();let title='',writes=0;
 Object.assign(doc,{head:{},visibilityState:'visible',documentElement:{dataset:{}}});
 Object.defineProperty(doc,'title',{get:()=>title,set:(value:string)=>{title=value;writes++;pending.push(...callbacks);}});
 class Observer{callback:()=>void;constructor(callback:()=>void){this.callback=callback;}observe(){callbacks.add(this.callback);}disconnect(){callbacks.delete(this.callback);}}
 const previous={document:globalThis.document,window:globalThis.window,MutationObserver:globalThis.MutationObserver};
 Object.assign(globalThis,{document:doc,window:win,MutationObserver:Observer});
 const output:Record<string,any>={},cleanups:Array<()=>void>=[];
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const mocks:Record<string,any>={'react':{useEffect:(effect:()=>()=>void)=>effects.push(effect)},'next/navigation':{usePathname:()=>'/dd/sol'},'@/lib/surface-catalog':{surfaceTitleForPath:()=>null},'@/lib/page-title-ownership':{claimPageTitle,ownsPageTitle},'react/jsx-runtime':{jsx:()=>null}};
 new Function('require','exports',code)((name:string)=>{if(!(name in mocks))throw Error(name);return mocks[name]},output);
 function mount(title?:string,pageLabel=''){output.PageTitleSetter({title,pageLabel});const cleanup=effects.shift()!();cleanups.push(cleanup);}
 function settle(){let turns=0;while(pending.length){if(++turns>30)throw Error('competing title observers did not settle');pending.shift()!();}}
 try{
  mount('DD outer','outer');mount('Common page','page');
  if(expectLoop){assert.throws(settle,/did not settle/);return {loopReproduced:true,writesBeforeAbort:writes};}
  settle();assert.equal(title,'▶ Common page');assert.equal(doc.documentElement.dataset.amiePageLabel,'page');assert.equal(writes,2);
  mount();settle();assert.equal(title,'▶ Common page','外枠の既定名が本文名を奪わない');
  doc.title='Next metadata';settle();assert.equal(title,'▶ Common page');assert.equal(writes,4);
  cleanups.pop()!();cleanups.pop()!();settle();assert.equal(title,'▶ DD outer');
  cleanups.pop()!();assert.equal(callbacks.size,0);
  return {loopReproduced:false,settled:true,writes,remainingObservers:callbacks.size};
 }finally{pending.length=0;while(cleanups.length)cleanups.pop()!();Object.assign(globalThis,previous);}
}
const current=readFileSync(new URL('../src/components/nav/PageTitleSetter.tsx',import.meta.url),'utf8');
console.log(JSON.stringify({pageTitleObservers:verifyTitleObservers(current)}));

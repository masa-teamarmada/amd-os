import FormulaParser from 'fast-formula-parser';
import type { DdReportModel,DdReportValue } from './dd-report-types';

type FormulaArgument={value:unknown};
const flatValues=(arg:FormulaArgument)=>Array.isArray(arg.value)?arg.value.flat(Infinity):[arg.value];
function excelCriterion(value:unknown,criterion:unknown) {
  const raw=String(criterion??''),m=/^(<=|>=|<>|=|<|>)(.*)$/.exec(raw),operator=m?.[1]??'=',rhs=m?.[2]??raw;
  const a=typeof value==='string'?value.toLocaleLowerCase():value,b=typeof value==='number'&&!Number.isNaN(Number(rhs))?Number(rhs):rhs.toLocaleLowerCase();
  if(operator==='<>')return a!==b;if(operator==='>')return (a as number)>(b as number);if(operator==='<')return (a as number)<(b as number);if(operator==='>=')return (a as number)>=(b as number);if(operator==='<=')return (a as number)<=(b as number);return a===b;
}
function conditionalIndices(args:FormulaArgument[]) {
  const ranges=args.filter((_,i)=>i%2===0).map(flatValues),criteria=args.filter((_,i)=>i%2===1).map(a=>a.value);
  return Array.from({length:ranges[0]?.length??0},(_,i)=>i).filter(i=>ranges.every((r,j)=>excelCriterion(r[i],criteria[j])));
}
const formulaNumbers=(args:FormulaArgument[])=>args.flatMap(a=>(Array.isArray(a.value)?a.value.flat(Infinity):[a.value])).filter((n):n is number=>typeof n==='number'&&Number.isFinite(n));
function excelRound(value:number,digits:number,mode:'up'|'down'|'nearest') {
  const factor=10**digits,scaled=Math.abs(value)*factor,tolerance=Number.EPSILON*Math.max(1,scaled)*4;
  return Math.sign(value)*(mode==='up'?Math.ceil(scaled-tolerance):mode==='down'?Math.floor(scaled+tolerance):Math.round(scaled+tolerance))/factor;
}
// Explicit Excel-compatible integer rounding is essential for J-KISS share counts.
const excelFunctions={
  VALUE:(v:FormulaArgument)=>{const n=Number(String(v.value).replaceAll(',',''));if(!Number.isFinite(n))throw new Error('#VALUE!');return n;},
  SUMIFS:(sum:FormulaArgument,...criteria:FormulaArgument[])=>{const values=flatValues(sum);return conditionalIndices(criteria).reduce((n,i)=>n+(typeof values[i]==='number'?values[i] as number:0),0);},
  COUNTIFS:(...criteria:FormulaArgument[])=>conditionalIndices(criteria).length,
  MATCH:(lookup:FormulaArgument,range:FormulaArgument,mode:FormulaArgument={value:1})=>{
    const values=(Array.isArray(range.value)?range.value.flat(Infinity):[range.value]),needle=lookup.value;
    const equal=(a:unknown,b:unknown)=>typeof a==='string'&&typeof b==='string'?a.toLocaleLowerCase()===b.toLocaleLowerCase():a===b;
    if(Number(mode.value)===0){const i=values.findIndex(v=>equal(v,needle));if(i<0)throw new Error('#N/A');return i+1;}
    let found=-1;for(let i=0;i<values.length;i++){const v=values[i];if(typeof v==='number'&&typeof needle==='number'&&(Number(mode.value)>0?v<=needle:v>=needle))found=i;}
    if(found<0)throw new Error('#N/A');return found+1;
  },
  MAX:(...a:FormulaArgument[])=>{const ns=formulaNumbers(a);return ns.length?Math.max(...ns):0;},
  MIN:(...a:FormulaArgument[])=>{const ns=formulaNumbers(a);return ns.length?Math.min(...ns):0;},
  ROUNDUP:(v:FormulaArgument,d:FormulaArgument)=>excelRound(Number(v.value),Number(d.value),'up'),
  ROUNDDOWN:(v:FormulaArgument,d:FormulaArgument)=>excelRound(Number(v.value),Number(d.value),'down'),
  ROUND:(v:FormulaArgument,d:FormulaArgument)=>excelRound(Number(v.value),Number(d.value),'nearest'),
};

export function ddColumn(n:number):string {let s='';for(;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
export function ddAddress(address:string) {const m=/^\$?([A-Z]+)\$?(\d+)$/.exec(address);if(!m)throw new Error('invalid_cell');return {col:[...m[1]].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0),row:Number(m[2])};}
export function ddCellKey(sheet:string,address:string) {return `${sheet}!${address.replaceAll('$','')}`;}

/** The parser lacks Excel's array arithmetic; expand SUMPRODUCT into equivalent scalar terms. */
function expandSumProduct(formula:string):string {
  const start=formula.indexOf('SUMPRODUCT(');if(start<0)return formula;
  let depth=1,quoted=false,end=start+11;for(;end<formula.length;end++){const c=formula[end];if(c==='"')quoted=!quoted;if(!quoted){if(c==='(')depth++;if(c===')'&&!--depth)break;}}
  const body=formula.slice(start+11,end),args:string[]=[];let level=0,q=false,last=0;
  for(let i=0;i<body.length;i++){if(body[i]==='"')q=!q;if(!q){if(body[i]==='(')level++;if(body[i]===')')level--;if(body[i]===','&&level===0){args.push(body.slice(last,i));last=i+1;}}}args.push(body.slice(last));
  const range=/(?:(?:'(?:[^']|'')+'|[^\s"'+\-*/(),<>=:&!]+)!)?(\$?[A-Z]{1,3}\$?\d+):(\$?[A-Z]{1,3}\$?\d+)/g;
  const refs=args.flatMap(arg=>arg.split(/("(?:[^"]|"")*")/g).filter((_,i)=>i%2===0).flatMap(part=>[...part.matchAll(range)]));
  const counts=refs.map(m=>{const a=ddAddress(m[1]),b=ddAddress(m[2]);return (b.row-a.row+1)*(b.col-a.col+1);});
  const count=Math.max(1,...counts);if(count>10000||counts.some(n=>n!==count))throw new Error('SUMPRODUCT_range_shape');
  const terms=Array.from({length:count},(_,i)=>args.map(arg=>'('+arg.split(/("(?:[^"]|"")*")/g).map((part,j)=>j%2?part:part.replace(range,(full,first,last)=>{const a=ddAddress(first),b=ddAddress(last),cols=b.col-a.col+1;return full.slice(0,full.length-first.length-1-last.length)+ddColumn(a.col+i%cols)+(a.row+Math.floor(i/cols));})).join('')+')').join('*'));
  return expandSumProduct(formula.slice(0,start)+'SUM('+terms.join(',')+')'+formula.slice(end+1));
}

export function validateDdOverrides(model:DdReportModel,values:unknown):values is Record<string,DdReportValue> {
  if(!values||typeof values!=='object'||Array.isArray(values)||Object.keys(values).length>2000)return false;
  const allowed=new Map(model.inputs.map(i=>[ddCellKey(i.sheet,i.address),i]));
  const calc=new DdReportCalculator(model);
  return Object.entries(values).every(([key,value])=>{const input=allowed.get(key);return !!input&&!calc.isDataTableCell(input.sheet,input.address)&&(input.options?typeof value==='string'&&input.options.includes(value):typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=1e15);});
}

/** The original Excel formulas own the calculation. Unchanged branches use verified native caches. */
export class DdReportCalculator {
  private calculated=new Map<string,DdReportValue>();
  private affected=new Map<string,boolean>();
  private resolving=new Set<string>();
  private checking=new Set<string>();
  private depth=0;
  private parsers:FormulaParser[]=[];
  private references=new Map<string,{sheet:string;start:string;end:string}[]>();
  private dataTableRanges=new Map<string,{a:ReturnType<typeof ddAddress>;b:ReturnType<typeof ddAddress>;table:DdReportModel['sheets'][string]['dataTables'][number]}[]>();
  private compiled=new Map<string,string>();
  readonly errors:{sheet:string;address:string;error:string}[]=[];
  readonly model:DdReportModel;
  readonly overrides:Record<string,DdReportValue>;
  readonly force:boolean;
  constructor(model:DdReportModel,overrides:Record<string,DdReportValue>={},force=false) {this.model=model;this.overrides=overrides;this.force=force;}
  private tableAt(sheet:string,address:string) {
    if(!this.dataTableRanges.has(sheet))this.dataTableRanges.set(sheet,(this.model.sheets[sheet]?.dataTables??[]).map(table=>{const [a,b]=table.ref.split(':');return {table,a:ddAddress(a),b:ddAddress(b??a)};}));
    const pos=ddAddress(address);return this.dataTableRanges.get(sheet)?.find(t=>pos.row>=t.a.row&&pos.row<=t.b.row&&pos.col>=t.a.col&&pos.col<=t.b.col);
  }
  isDataTableCell(sheet:string,address:string) {return Boolean(this.tableAt(sheet,address));}

  private dependencies(sheet:string,formula:string) {
    const key=sheet+'\n'+formula;const prior=this.references.get(key);if(prior)return prior;
    const f=formula.replace(/"(?:[^"]|"")*"/g,'""');
    const pattern=/(?:(?:'((?:[^']|'')+)'|([^\s"'+\-*/(),<>=:&!]+))!)?(\$?[A-Z]{1,3}\$?\d+)(?::(\$?[A-Z]{1,3}\$?\d+))?/g;
    const found=[...f.matchAll(pattern)].map(m=>({sheet:(m[1]?.replaceAll("''", "'")||m[2]||sheet),start:m[3].replaceAll('$',''),end:(m[4]||m[3]).replaceAll('$','')}));
    this.references.set(key,found);return found;
  }
  private changed(sheet:string,address:string):boolean {
    const key=ddCellKey(sheet,address);if(Object.hasOwn(this.overrides,key))return this.overrides[key]!==this.model.sheets[sheet]?.cells[address]?.v;
    if(this.affected.has(key))return this.affected.get(key)!;
    const cell=this.model.sheets[sheet]?.cells[address];if(!cell?.f||this.checking.has(key))return false;
    this.checking.add(key);let changed=false;
    for(const ref of this.dependencies(sheet,cell.f)) {
      const a=ddAddress(ref.start),b=ddAddress(ref.end);
      if((b.row-a.row+1)*(b.col-a.col+1)>200000)throw new Error('model_range_limit');
      outer:for(let r=a.row;r<=b.row;r++)for(let c=a.col;c<=b.col;c++)if(this.changed(ref.sheet,ddColumn(c)+r)){changed=true;break outer;}
      if(changed)break;
    }
    this.checking.delete(key);this.affected.set(key,changed);return changed;
  }
  get(sheet:string,address:string):DdReportValue {
    address=address.replaceAll('$','');const key=ddCellKey(sheet,address);
    if(Object.hasOwn(this.overrides,key))return this.overrides[key];
    const cell=this.model.sheets[sheet]?.cells[address];if(!cell)return null;
    if(Object.keys(this.overrides).length){
      const table=this.tableAt(sheet,address);
      if(table){
        if(this.calculated.has(key))return this.calculated.get(key)!;
        const {a,table:t}=table,pos=ddAddress(address),scenario={...this.overrides};let output:string;
        if(t.dt2D==='1'){
          scenario[ddCellKey(sheet,t.r1!)]=this.get(sheet,ddColumn(pos.col)+(a.row-1));
          scenario[ddCellKey(sheet,t.r2!)]=this.get(sheet,ddColumn(a.col-1)+pos.row);
          output=ddColumn(a.col-1)+(a.row-1);
        }else if(t.dtr==='1'){
          scenario[ddCellKey(sheet,t.r1!)]=this.get(sheet,ddColumn(pos.col)+(a.row-1));output=ddColumn(a.col-1)+pos.row;
        }else{
          scenario[ddCellKey(sheet,t.r1!)]=this.get(sheet,ddColumn(a.col-1)+pos.row);output=ddColumn(pos.col)+(a.row-1);
        }
        const result=new DdReportCalculator(this.model,scenario).get(sheet,output);this.calculated.set(key,result);return result;
      }
    }
    if(!cell.f||(!this.force&&(!Object.keys(this.overrides).length||!this.changed(sheet,address))))return cell.v;
    if(this.calculated.has(key))return this.calculated.get(key)!;
    if(this.resolving.has(key))return '#CIRC!';
    this.resolving.add(key);this.depth++;
    try {
      const parser=this.parsers[this.depth]??=new FormulaParser({functions:excelFunctions,onCell:ref=>this.get(ref.sheet,ddColumn(ref.col)+ref.row),onRange:ref=>{
        if((ref.to.row-ref.from.row+1)*(ref.to.col-ref.from.col+1)>200000)throw new Error('model_range_limit');
        const values:DdReportValue[][]=[];
        for(let r=ref.from.row;r<=ref.to.row;r++){const row:DdReportValue[]=[];for(let c=ref.from.col;c<=ref.to.col;c++)row.push(this.get(ref.sheet,ddColumn(c)+r));values.push(row);}return values;
      }});
      let formula=this.compiled.get(cell.f);if(!formula){formula=expandSumProduct(cell.f.split(/("(?:[^"]|"")*")/g).map((part,i)=>i%2?part:part.replace(/(^|[,(+*/^=<>:\-])\.(\d)/g,(_m,before,digit)=>before+'0.'+digit)).join(''));this.compiled.set(cell.f,formula);}
      const pos=ddAddress(address);const raw=parser.parse(formula,{sheet,...pos});
      const value: DdReportValue=raw===null||raw===undefined?null:typeof raw==='string'||typeof raw==='boolean'||typeof raw==='number'?raw:String(raw);
      if(typeof value==='number'&&!Number.isFinite(value))throw new Error('non_finite_result');
      if(typeof value==='string'&&/^#(REF|DIV|VALUE|NAME|NUM|N\/A|CIRC)/.test(value))throw new Error(value);
      this.calculated.set(key,value);return value;
    } catch(error) {
      const code=error instanceof Error?error.message:String(error);this.errors.push({sheet,address,error:code});throw new Error(`計算エラー: ${sheet}!${address} (${code})`);
    } finally {this.depth--;this.resolving.delete(key);}
  }
  changedValues() {return this.calculated;}
}

/** Verify every primary decision before publishing a changed numerical plan. */
export function verifyDdReportCalculation(model:DdReportModel,overrides:Record<string,DdReportValue>) {
  const calc=new DdReportCalculator(model,overrides);
  for(const address of ['L206','L214','V14'])calc.get('資本政策表',address);
  for(const address of ['E61','Q61','AZ61','DT61'])calc.get('損益・資金繰',address);
  for(const address of ['K18','K19','K20','K21','B22'])calc.get('UE',address);
  return calc;
}

export {formatDdReportValue} from './dd-report-format';

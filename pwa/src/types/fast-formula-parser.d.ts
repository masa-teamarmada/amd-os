declare module 'fast-formula-parser' {
  type Position={sheet:string;row:number;col:number};
  type RangeRef={sheet:string;from:{row:number;col:number};to:{row:number;col:number}};
  export default class FormulaParser {
    constructor(config:{onCell:(ref:Position)=>unknown;onRange:(ref:RangeRef)=>unknown[][];functions?:Record<string,(...args:any[])=>unknown>});
    parse(formula:string,position:Position,allowArray?:boolean):unknown;
  }
}

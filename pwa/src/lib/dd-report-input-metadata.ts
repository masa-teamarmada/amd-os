import type {DdReportModel} from './dd-report-types';
/** Restore Excel list validations whose multi-cell sqref was skipped by reader-v3 imports. */
export function completeDdReportInputs(model:DdReportModel):DdReportModel{
  if(model.sourceSha256!=='f94077ac4d35c352999f1a9743f9ccd58128f18d62a2004f91e6dcec57b9e2cb')return model;
  const recovered=[
    {sheet:'シアノ生産コスト',address:'I6',label:'培地への廃液利用',options:['利用する','購入する']},
    {sheet:'シアノ生産コスト',address:'I7',label:'排熱利用',options:['利用する','購入する']},
    {sheet:'リアクター処理コスト',address:'E6',label:'リアクターの負担',options:['顧客','SOL']},
    {sheet:'リアクター処理コスト',address:'E7',label:'顧客工場の槽の負担',options:['顧客','SOL']},
  ];
  const inputs=[...model.inputs];
  for(const input of recovered){const c=model.sheets[input.sheet]?.cells[input.address];if(c&&!c.f&&typeof c.v==='string'&&input.options.includes(c.v)&&!inputs.some(i=>i.sheet===input.sheet&&i.address===input.address))inputs.push({...input,value:c.v,format:c.format});}
  return {...model,inputs};
}

import assert from 'node:assert/strict';
import {classifyContractMail,currentMailText,workflowActions,workflowProgress} from '../src/lib/workflows.ts';
const input={subject:'',body:'',filenames:[],labels:['INBOX'],from:'partner@example.com',bulk:false,knownThread:false};
for(const labels of [['SENT'],['INBOX'],[]])assert.equal(classifyContractMail({...input,labels,subject:'秘密保持契約書の修正案'}),'exchange');
assert.equal(classifyContractMail({...input,subject:'電子契約の署名依頼'}),'signature_request');
assert.equal(classifyContractMail({...input,subject:'合意締結が完了しました'}),'completion');
assert.equal(classifyContractMail({...input,subject:'NDAひな形',labels:['DRAFT']}),null);
assert.equal(classifyContractMail({...input,subject:'NDA',labels:['SPAM']}),null);
assert.equal(classifyContractMail({...input,subject:'パスワードのお知らせ NDA'}),null);
assert.equal(classifyContractMail({...input,subject:'契約社員の求人情報'}),null);
assert.equal(classifyContractMail({...input,subject:'NDA講座',bulk:true}),null);
assert.equal(classifyContractMail({...input,subject:'Re: ご連絡',body:'承知しました。',knownThread:true}),'exchange');
assert.equal(classifyContractMail({...input,subject:'Re: 日程',body:'来週でお願いします。\nOn Thursday, someone wrote:\n署名依頼 NDA'}),null);
assert.equal(classifyContractMail({...input,subject:'日程',body:'来週\n> 秘密保持契約書'}),null);
assert.equal(currentMailText('確認したよ\n-- \n契約を支える会社'), '確認したよ');
assert.equal(workflowActions('submitted','ID001','ID001','ID002').approve,false);
assert.equal(workflowActions('submitted','ID002','ID001','ID002').approve,true);
assert.equal(workflowActions('approved','ID001','ID001','ID002').release,true);
assert.equal(workflowActions('superseded','ID001','ID001','ID002').release,false);
assert.equal(workflowActions('released','ID002','ID001','ID002').complete,true);
console.log('契約メール分類・引用除外・本人承認・再申請の検証: PASS');

assert.equal(workflowActions('preparing','ID001','ID001','ID002').prepare,true);
assert.equal(workflowActions('preparing','ID002','ID001','ID002').prepare,false);
assert.equal(workflowActions('preparing','ID001','ID001','ID002').release,false);
assert.equal(workflowActions('preparing','ID002','ID001','ID002').approve,false);
assert.equal(workflowActions('returned','ID001','ID001','ID002').restart,true);
for(const [status,artifact,current] of [
 ['preparing',false,'契約書の準備'],['submitted',false,'きよの承認'],['approved',false,'押印・締結版の保存'],
 ['released',false,'押印・締結版の保存'],['released',true,'締結版の照合'],['returned',false,'契約書の準備'],['superseded',false,'契約書の準備'],
] as const){
 const steps=workflowProgress(status,'まさ','きよ',artifact);
 assert.equal(steps.length,6);assert.equal(steps.filter(s=>s.state==='current').length,1);assert.equal(steps.find(s=>s.state==='current')?.label,current);
 assert.equal(steps.find(s=>s.label==='完了')?.state,'pending');
}
assert.ok(workflowProgress('completed','まさ','きよ',true).every(s=>s.state==='done'));
assert.ok(workflowProgress('cancelled','まさ','きよ').every(s=>s.state!=='current'));
assert.equal(workflowProgress('submitted','まさ','きよ')[2].owner,'きよ');
assert.equal(workflowProgress('released','まさ','きよ',true)[4].owner,'きよ');
console.log('準備から完了までの現在地・次担当・差戻し・締結証跡の分離: PASS');

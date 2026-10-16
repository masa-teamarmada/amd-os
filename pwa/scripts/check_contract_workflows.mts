import assert from 'node:assert/strict';
import {classifyContractMail,currentMailText,hasContractMailThreadEvidence,formatContractMailAlert,workflowActions,workflowProgress} from '../src/lib/workflows.ts';
const input={subject:'',body:'',filenames:[],labels:['INBOX'],from:'partner@example.com',bulk:false,knownThread:false};
for(const labels of [['SENT'],['INBOX'],[]])assert.equal(classifyContractMail({...input,labels,subject:'秘密保持契約書の修正案'}),'exchange');
assert.equal(classifyContractMail({...input,subject:'電子契約の署名依頼'}),'signature_request');
assert.equal(classifyContractMail({...input,subject:'合意締結が完了しました'}),'completion');
assert.equal(classifyContractMail({...input,subject:'NDAひな形',labels:['DRAFT']}),null);
assert.equal(classifyContractMail({...input,subject:'NDA',labels:['SPAM']}),null);
assert.equal(classifyContractMail({...input,subject:'パスワードのお知らせ NDA'}),null);
assert.equal(classifyContractMail({...input,subject:'契約社員の求人情報'}),null);
assert.equal(classifyContractMail({...input,subject:'NDA講座',bulk:true}),null);
for(const subject of ['メモ: 「SX定例MTG」（2026年10月14日）','承認されていない申請があります。｜ジョブカンワークフロー','【必読】BizSTATION 【詐欺に注意】偽のセキュリティ警告画面','【WAN-Sign】 ログイン時のセキュリティ強化方法のご案内','freeeカード Unlimited 利用可能枠変更のお知らせ','お引き落としのご連絡','［WiFiレンタル］ご返却ありがとうございました']) {
 assert.equal(classifyContractMail({...input,subject,body:'契約更新の確認、解約条件について。署名・押印が完了した。'}),null,subject);
}
assert.equal(classifyContractMail({...input,subject:'業務委託契約書 ログイン時のセキュリティ条項の修正案'}),'exchange');
assert.equal(classifyContractMail({...input,subject:'コメント通知：秘密保持誓約書｜ジョブカンワークフロー'}),'exchange');
assert.equal(classifyContractMail({...input,subject:'事務連絡 古本募金キャンペーン',body:'契約の条件をご確認ください。'}),null,'Generic contract wording is insufficient');
assert.equal(classifyContractMail({...input,subject:'契約サービスのお知らせ',body:'ご契約いただいているサービスです。解除条件をご確認ください。'}),null);
assert.equal(classifyContractMail({...input,subject:'Re: ご連絡',body:'秘密保持契約書の修正案を添付します。'}),'exchange');
assert.equal(classifyContractMail({...input,subject:'書類送付',filenames:['20261014_MOU_AMD.pdf']}),'exchange');
assert.equal(classifyContractMail({...input,subject:'完了: Docusignで送信: 20261014_MOU_AMD.pdf',body:'すべての署名が完了しました。'}),'completion');
assert.equal(classifyContractMail({...input,subject:'承諾書の控えが届いています'}),'exchange');
for(const subject of ['事務連絡 古本募金キャンペーン','【必読】BizSTATION 詐欺に注意','承認されていない申請があります。｜ジョブカンワークフロー']) {
 const knownThread=hasContractMailThreadEvidence([{contract_id:null,subject}]);
 assert.equal(knownThread,false,subject);
 assert.equal(classifyContractMail({...input,subject,knownThread,body:'ご確認ください。'}),null,'A prior false detection must not propagate');
}
assert.equal(hasContractMailThreadEvidence([{contract_id:null,subject:'NDA修正案'}]),true);
assert.equal(hasContractMailThreadEvidence([{contract_id:'registered-contract',subject:'Re: ご連絡'}]),true);
assert.equal(hasContractMailThreadEvidence([]),false);
const alert=formatContractMailAlert({event_id:'mail-event',contract_id:null,direction:'received',subject:'NDA <@everyone> &確認',event_kind:'exchange',occurred_at:'2026-10-16T00:00:00Z',source_url:'https://mail.google.com/mail/u/0/#all/example'},'https://amd-os-pwa.vercel.app');
assert.ok(alert.startsWith('【契約メール】'));assert.ok(alert.includes('メールの検知通知'));
assert.ok(alert.includes('OSのメール検知一覧を確認'));assert.ok(!alert.includes('きよの承認の確認が必要'));
assert.ok(alert.includes('&lt;@everyone&gt; &amp;確認'));assert.ok(!alert.includes('<@everyone>'));
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

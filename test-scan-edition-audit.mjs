import assert from 'node:assert/strict';
import {resolveScanFinish,resolvedEntry} from './scan-batch.js';

const card={id:'46986414',name:'Dark Magician',exact:true,print:'LOB-EN005|Ultra Rare',card:{id:'46986414',name:'Dark Magician'}};
let checks=0;
for(const [code,full,stats] of [
  ['LOB-EN005\n1st Edition','Limited Edition',''],
  ['LOB-EN005\nLimited Edition','1st Edition',''],
  ['LOB-EN005\n1st Edition','','Limited Edition'],
  ['LOB-EN005','Limited Edition\n1st Edition',''],
]){
  const read={code,full,stats};
  assert.equal(resolveScanFinish('ygo',card,{},read),'');
  const result=resolvedEntry({id:'capture'},'ygo',[card],read,()=>true,{});
  assert.equal(result.status,'review');assert.equal(result.finish,'');assert.equal(result.printingVerified,true);
  assert.equal(result.reason,'Choose finish / edition');checks+=5;
  // A deliberate user default is not overwritten by an OCR guess/conflict.
  for(const finish of ['limited','1st-edition','unlimited']){
    assert.equal(resolveScanFinish('ygo',card,{finish,finishConfirmed:true},read),finish);
    assert.equal(resolveScanFinish('ygo',card,{finish,finishConfirmed:false},read),'');checks+=2;
  }
}
for(const [text,expected] of [['1st Edition','1st-edition'],['Limited Edition','limited'],['Unlimited Edition',''],['','']]){
  assert.equal(resolveScanFinish('ygo',card,{}, {code:text}),expected);checks++;
}
assert.equal(resolveScanFinish('mtg',{card:{finishes:['nonfoil']}},{},{code:'Limited Edition\n1st Edition'}),'nonfoil');checks++;
assert.equal(resolveScanFinish('ptcg',{card:{variants:[{key:'normal',label:'Normal'}]}},{},{code:'Limited Edition\n1st Edition'}),'normal');checks++;
console.log(`PASS: ${checks} edition evidence assertions; conflicting Yu-Gi-Oh OCR remains review, deliberate defaults retained, other games unchanged.`);

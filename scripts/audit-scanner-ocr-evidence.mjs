// Bridge for the native OCR characterization runner. This exercises production
// parsing and evidence only; it does not claim to replay browser capture/OCR.
import fs from 'node:fs';
import {LAYOUT,padQuad,preserveWholeCardPhoto} from '../scancam.js';
import {detectCardQuad,warpPixels} from '../scan-vision.js';
import {scanLookupNames,detectGame} from '../scan.js';
import {scanTitleEvidence,scanIdentifierEvidence,signalEvidence} from '../scan-signals.js';

if(process.argv.includes('--layout'))console.log(JSON.stringify(LAYOUT));
else if(process.argv.includes('--normalize')){
  const input=JSON.parse(fs.readFileSync(0,'utf8'));
  if(preserveWholeCardPhoto(input.width,input.height))console.log(JSON.stringify({preservedWholeCard:true}));
  else {
    const proposal=detectCardQuad(new Uint8ClampedArray(Buffer.from(input.small,'base64')),input.smallWidth,input.smallHeight);
    if(!proposal?.cropSafe)console.log(JSON.stringify({proposal,normalized:false}));
    else {
      const quad=proposal.quad.map(p=>({x:p.x*input.width/input.smallWidth,y:p.y*input.height/input.smallHeight}));
      const padded=padQuad(quad,input.width,input.height),width=proposal.outputWidth,height=proposal.outputHeight;
      const pixels=warpPixels(new Uint8ClampedArray(Buffer.from(input.rgba,'base64')),input.width,input.height,padded,width,height);
      console.log(JSON.stringify({proposal,normalized:true,width,height,rgba:Buffer.from(pixels).toString('base64')}));
    }
  }
}
else {
  const cases=JSON.parse(fs.readFileSync(0,'utf8'));
  console.log(JSON.stringify(cases.map(({game,expected,read,...rest})=>{
    const identifiers=scanIdentifierEvidence(game,read),evidence=signalEvidence(game,expected,read);
    const identifierMatchesExpected=game==='ygo'?identifiers.observations.includes(expected.printingCode):evidence.agrees.includes(game==='mtg'?'set / collector number':'collector number');
    return {...rest,game,expected,read,
      names:scanLookupNames(game,read),detectedGame:detectGame([read.name,read.code,read.full].join('\n')),
      title:scanTitleEvidence(game,expected,read),identifiers,evidence,identifierMatchesExpected};
  })));
}

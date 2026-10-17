// Scanner review borrows the existing same-name printing browser. It owns no
// camera, Search, collection, queue or global-game state; the caller applies a
// returned selection only to the still-current capture/revision.
import {loadMagicPrintingPage} from './catalog-tools.js';
import {samePrintingFamily,printingRows,printingSelection} from './printing-picker.js';

const games = new Set(['mtg','ptcg','ygo']);
const cancelled = () => Error('Printing lookup cancelled.');
const key = value => String(value ?? '');
const identityFields = ['game','cardId','releaseId','finish','variantKey','productId','printingKey','edition'];
const identityOf = selection => Object.fromEntries(identityFields.map(field => [field,selection[field] ?? (field === 'productId' ? null : '')]));
const sameIdentity = (a,b) => identityFields.every(field => key(a[field]) === key(b[field]));

/** Translate only a selectable row from the existing picker, not guessed OCR.
 * The card snapshot comes from that row's release projection. Original captures,
 * read evidence and user quantity/condition/language/location are not touched.
 */
export function scannerPrintingSelection(selection,{game,source,catalogue=[],projectCard}={}) {
  if(!games.has(game)||selection?.game!==game||!samePrintingFamily(game,source,selection.card))return null;
  const row=printingRows(game,[selection.card],{source,catalogue,projectCard})
    .find(row=>row.selectable&&sameIdentity(printingSelection(row),selection));
  if(!row||row.card.brief)return null;
  const selected=printingSelection(row),card=selected.projectedCard||selected.card;
  const finishUnconfirmed=game==='ygo'?!selected.edition:game==='ptcg'&&(!selected.variantKey||/unconfirmed/i.test(card.variants?.find(variant=>variant.key===selected.variantKey)?.label||''));
  const finish=game==='ygo'?selected.edition||'':game==='ptcg'?(finishUnconfirmed?'':selected.variantKey||''):selected.finish||'';
  const identity=identityOf(selected),print=game==='ygo'?`${selected.printing.code}|${selected.printing.rarity||''}`:'';
  const sub=game==='mtg'?[card.set_name||card.set,`#${card.collector_number||''}`]:game==='ptcg'?[card.set?.name,`#${card.set?.number||''}`,card.rarity]:[row.setName,selected.printing.code,selected.printing.rarity];
  const candidate={game,id:card.id,name:card.name,card,image:row.image||'',sub:sub.filter(Boolean).join(' · '),print,
    exact:false,printingConfirmed:true,reviewSource:'printing-picker',why:'Printing selected by you · not an OCR match',
    localReference:false,detailsOnly:false,finishUnconfirmed,printingSelection:identity,
    ...(game==='ygo'?{releaseName:row.setName,setReleaseId:selected.releaseId,setReleaseUnverified:false,printingAmbiguous:false}:{})};
  return {candidate,finish,printingConfirmed:true,reviewSource:'printing-picker',selection:identity};
}

/**
 * Dependencies are the existing public catalog adapters and printingPicker.open.
 * open({game,candidate,captureId,captureRevision,parentContext,isCurrent,onSelect,onCancel})
 * isCurrent must check confirmation object identity and persisted capture revision.
 * Neither cancel nor loading invokes onSelect. onSelect is one-shot and never saves.
 */
export function createScannerPrintingPicker({openPicker,requestMagic,sources={},ensureCard,getCatalogue=()=>[],loadCatalogue,projectCard}={}) {
  if(typeof openPicker!=='function')throw Error('The existing printing browser is required.');
  let current=null,serial=0;
  const active=session=>current===session&&!session.abort.signal.aborted&&session.isCurrent(session.identity)===true;
  const abandon=()=>{if(!current)return false;current.abort.abort();current=null;return true;};
  async function open(config={}) {
    const {game,candidate,isCurrent}=config;
    if(!games.has(game)||typeof isCurrent!=='function'||!candidate?.id)throw Error('Choose a current captured card first.');
    abandon();
    const session={abort:new AbortController(),isCurrent,identity:Object.freeze({captureId:key(config.captureId),captureRevision:key(config.captureRevision),request:++serial})};
    current=session;
    if(!active(session)){abandon();return false;}
    let source=candidate.card||candidate,catalogue=[...(getCatalogue(game)||[])];
    const check=signal=>{if(!active(session)||signal?.aborted)throw cancelled();};
    const project=(card,release,options)=>card.brief?{...card,setContext:{game,cardId:card.id,releaseId:release?.id||'',status:'missing'}}:projectCard?.(game,card,release,catalogue,options);
    try {
      if(key(source.id)!==key(candidate.id)||(source.game&&source.game!==game))throw Error('This candidate has a different card identity. Review the capture again.');
      // A local recognition record need not contain its Oracle identity. Resolve
      // that exact ID, never a fuzzy name, before opening Magic printings.
      if(game==='mtg'&&!source.oracle_id){
        if(typeof requestMagic!=='function')throw Error('Magic printing details are unavailable.');
        const full=await requestMagic('/cards/'+encodeURIComponent(source.id),{signal:session.abort.signal});
        check();
        if(key(full?.id)!==key(source.id)||!full?.oracle_id)throw Error('This Magic printing could not be verified.');
        source=full;
      }
      if(!samePrintingFamily(game,source,source))throw Error('This card has no verified printing identity.');
      const unresolved=new Set();
      const loadPage=async({cursor=null,signal}={})=>{
        check(signal);
        if(game==='mtg'){
          const page=await loadMagicPrintingPage(source,{cursor,signal,request:requestMagic});
          check(signal);return page;
        }
        if(game==='ygo'){
          const full=await ensureCard(game,source.id);check(signal);
          if(!samePrintingFamily(game,source,full))throw Error('The source returned a different card.');
          if(!catalogue.length){
            if(typeof loadCatalogue!=='function')throw Error('The release catalogue is unavailable.');
            // Reuse the app catalogue loader: the save adapter must see the same
            // canonical release IDs after the user reviews this capture.
            catalogue=await loadCatalogue(game);check(signal);
          }
          if(!Array.isArray(catalogue))throw Error('The release catalogue is unavailable.');
          return {cards:[full],catalogue,nextCursor:null,complete:catalogue.length>0,
            note:catalogue.length?'Only verified releases of this card are listed.':'The release catalogue is unavailable. Reload to retry; no release is assumed.'};
        }
        const page=cursor===null?0:Number(cursor);
        if(!Number.isInteger(page)||page<0)throw Error('Invalid printing page. Reopen this capture to retry.');
        const result=await sources.ptcg.search({q:source.name,sort:'new',page,exactName:true});check(signal);
        if(!Array.isArray(result?.cards))throw Error('The source returned an invalid printing page.');
        const matches=result.cards.filter(card=>samePrintingFamily(game,source,card)),cards=new Array(matches.length);
        let index=0;
        // Same bounded detail loading as the normal printing browser. A detail
        // failure keeps a visibly incomplete source row, never a guessed variant.
        await Promise.all(Array.from({length:Math.min(6,matches.length)},async()=>{
          while(index<matches.length){
            check(signal);const at=index++,brief=matches[at];
            let full;try{full=await ensureCard(game,brief.id);}catch{full=null;}
            check(signal);
            cards[at]=full&&key(full.id)===key(brief.id)&&samePrintingFamily(game,source,full)?full:{...brief,brief:true};
          }
        }));
        check(signal);
        if(page===0)unresolved.clear();
        for(const card of cards){if(card.brief)unresolved.add(card.id);else unresolved.delete(card.id);}
        return {cards,nextCursor:result.more?page+1:null,complete:!result.more&&!unresolved.size,
          note:unresolved.size?`${unresolved.size} card details could not be loaded. Reload to retry; no version is assumed.`:'Exact printed names only; differently named Pokémon are excluded.'};
      };
      check();
      await openPicker({game,card:source,parentContext:config.parentContext,catalogue,purpose:'scan',
        ...(game==='mtg'?{}:{projectCard:project}),loadPage,
        onSelect:selection=>{
          if(!active(session))return false;
          const result=scannerPrintingSelection(selection,{game,source,catalogue,...(game==='mtg'?{}:{projectCard:project})});
          if(!result)return false;
          current=null;session.abort.abort();
          return config.onSelect?.(result,session.identity);
        },
        onCancel:()=>{
          if(!active(session))return false;
          current=null;session.abort.abort();
          return config.onCancel?.(session.identity);
        },
      });
      return true;
    } catch(error) {
      if(!active(session))return false;
      abandon();throw error;
    }
  }
  return {open,abandon};
}

import assert from 'node:assert/strict';
import {parseWikiCardLink,createWikiCardHandoff} from './wiki-card-handoff.js';
const url='https://scryfall.com/card/rvr/168/boros-guildmage?utm_source=mw_MagicTheGatheringWiki';
assert.deepEqual(parseWikiCardLink(url),{kind:'printing',set:'rvr',number:'168',lang:'en'});
assert.deepEqual(parseWikiCardLink('https://scryfall.com/card/rvr/168/ja/boros-guildmage'),{kind:'printing',set:'rvr',number:'168',lang:'ja'});
assert.deepEqual(parseWikiCardLink('https://scryfall.com/search?q=%21%22Spirit+Link%22'),{kind:'card',name:'Spirit Link'});
assert.deepEqual(parseWikiCardLink('https://scryfall.com/search?q='+encodeURIComponent('!"Boros Guildmage" set:rvr cn:"168"')),{kind:'printing',set:'rvr',number:'168',lang:'en'});
assert.deepEqual(parseWikiCardLink('https://scryfall.com/search?q=kw%3Alifelink'),{kind:'search',query:'kw:lifelink'});
for(const href of ['javascript:alert(1)','http://scryfall.com/card/rvr/168/name','https://scryfall.com.evil.invalid/card/rvr/168/name','https://user:pass@scryfall.com/card/rvr/168/name','https://scryfall.com:444/card/rvr/168/name','https://scryfall.com/card/rvr/168%2F..%2Fname/slug','https://scryfall.com/card/rvr/168/unknown/name','https://scryfall.com/search?q=', 'https://scryfall.com/search?q=%21%22One%22&q=%21%22Other%22'])assert.equal(parseWikiCardLink(href),null,href);
assert.equal(parseWikiCardLink(url,'ptcg'),null);assert.equal(parseWikiCardLink(url,'ygo'),null);
const card={id:'printing-fixture',name:'Boros Guildmage',set:'rvr',collector_number:'168',lang:'en',type_line:'Creature — Human Wizard',prices:{usd:'0.25'}};
const opened=[],paths=[],notices=[];
const handoff=createWikiCardHandoff({lookup:async path=>{paths.push(path);return card;},openCard:async value=>opened.push(value),notify:text=>notices.push(text)});
assert.deepEqual(await handoff.open({set:'RVR',number:'168',lang:'en'}),{status:'opened',printingId:card.id});assert.deepEqual(paths,['/cards/rvr/168/en']);assert.equal(opened.length,1);assert.equal(opened[0].name,card.name,'plural Wiki link label is never used as card identity');assert.equal(opened[0].full,true);assert.equal(opened[0].collector_number,'168');assert.equal(notices.length,0);
for(const changed of [{...card,set:'rav'},{...card,collector_number:'169'},{...card,lang:'ja'},{...card,id:''}]){
 const out=[],errors=[],wrong=createWikiCardHandoff({lookup:async()=>changed,openCard:value=>out.push(value),notify:text=>errors.push(text)});assert.equal((await wrong.open({set:'rvr',number:'168'})).status,'unavailable');assert.equal(out.length,0);assert.equal(errors.length,1,'a different printing cannot fall back to a name-wide match');
}
for(const input of [{set:'rvr/..',number:'168'},{set:'rvr',number:'168/other'},{set:'rvr',number:'168',lang:'unknown'}])assert.equal((await handoff.open(input)).status,'unsupported');assert.equal(paths.length,1,'invalid identities do not request a provider');
let release,current=true;const lateOpened=[],lateNotices=[],late=createWikiCardHandoff({lookup:()=>new Promise(resolve=>release=resolve),scope:()=>()=>current,openCard:value=>lateOpened.push(value),notify:text=>lateNotices.push(text)});const pending=late.open({set:'rvr',number:'168'});current=false;release(card);assert.equal((await pending).status,'cancelled');assert.equal(lateOpened.length,0);assert.equal(lateNotices.length,0);
console.log('PASS: Wiki card URLs open the existing card window with exact set/collector/language; named links and card queries keep native actions, and malformed/mismatched/stale records cannot open a different printing or mutate saved data.');

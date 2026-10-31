// The search bar reaches the app's own content: sets, decks, tournament decks, wiki, news and pages.
import assert from 'node:assert/strict';
import {searchApp,parseQuery,matchScore} from './universal-search.js';
const src={sets:[{title:'Star Trek',code:'trk'},{title:'Star Trek Commander',code:'trc'},{title:'Stargate',code:'sgx'}],
 decks:[{title:'Elves of Lorwyn',sub:'Commander'}],meta:[{title:'Izzet Murktide',sub:'Modern'}],
 wiki:[{title:'Lifelink'}],news:[{title:'Star Trek previews begin',url:'https://example.com'}]};
const ids=q=>searchApp(q,src).sections.map(s=>s.id);
assert.equal(searchApp('star trek set',src).sections[0].items[0].title,'Star Trek','a named set comes first, exact title on top');
assert.deepEqual(ids('star trek news')[0],'news','the kind the query names leads');
assert.equal(searchApp('elves deck',src).sections[0].id,'deck','your own deck is found by a word in its name');
assert.equal(searchApp('murktide',src).sections[0].items[0].title,'Izzet Murktide');
assert.equal(searchApp('settings',src).sections[0].items[0].route,'#settings','app pages are reachable by name');
assert.deepEqual(ids('lightning bolt'),[],'a plain card name leaves the card source to answer');
assert.equal(parseQuery('Show me the Star Trek set').core,'star trek');
assert.equal(matchScore('Stargate',parseQuery('star trek')),null,'no loose partial matches');
console.log('PASS: universal search finds sets, decks, tournament decks, wiki, news and pages, ordered by what the query names.');

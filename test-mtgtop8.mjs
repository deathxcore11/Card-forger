// MTGTop8 Commander parsers against excerpts of real pages (format list, event standings,
// deck export), so a layout change shows up here before it empties the Commander meta.
import assert from "node:assert/strict";
import { mtgtop8Events, mtgtop8Pages, pickMtgtop8Events, parseMtgtop8Event, parseMtgtop8Export, normalizeMtgtop8 } from "./mtgmeta.js";

const formatPage = `<div class=w_title align=center>LAST MAJOR EVENTS</div><table border=0 class=Stable width=98% align=center>
		<tr class=hover_tr>
		  <td width=5% align=center><img src=/graph/online/paper.png height=17 title="Paper"></td>
		  <td width=70% class=S14><a href=event?e=92803&f=cEDH>MBG Commanderpalooza #3 - TimeTwister Event</a> @ <a class=und href=event?e=92803&f=cEDH>Moms Basement Games (Wyandotte, MI)</a> <span class=new>NEW</span></td>
		  <td width=13% align=center><img src=/graph/bigstar.png height=20></td>
		  <td align=right width=12% class=S12>24/10/26</td>
		</tr>
		<tr class=hover_tr>
		  <td width=70% class=S14><a href=event?e=92612&f=cEDH>Steel City Green Chile Slopper Tournament Series I</a> @ <a class=und href=event?e=92612&f=cEDH>Eagle Ridge Convention Center (Pueblo, CO)</a></td>
		  <td width=13% align=center><img src=/graph/star.png><img src=/graph/star.png><img src=/graph/star.png></td>
		  <td align=right width=12% class=S12>18/10/26</td>
		</tr>
		<tr class=hover_tr>
		  <td width=70% class=S14><a href=event?e=92819&f=cEDH>Bracket 3 Commander Tournament</a> @ <a class=und href=event?e=92819&f=cEDH>Mana &amp; Mochas (Palmerton, PA)</a></td>
		  <td width=13% align=center><img src=/graph/star.png></td>
		  <td align=right width=12% class=S12>24/10/26</td>
		</tr>
		<tr class=hover_tr>
		  <td width=70% class=S14><a href=event?e=91000&f=cEDH>Old Open</a></td>
		  <td width=13% align=center><img src=/graph/star.png><img src=/graph/star.png><img src=/graph/star.png></td>
		  <td align=right width=12% class=S12>01/08/26</td>
		</tr></table>
<a href=?f=cEDH&meta=327&cp=3>3</a> <a href=?f=cEDH&meta=327&cp=2>2</a> <a href=?f=cEDH&meta=327&cp=2>Next</a>`;

const events = mtgtop8Events(formatPage);
assert.deepEqual(events.map((e) => [e.id, e.date, e.stars]), [["92803", "2026-10-24", 4], ["92612", "2026-10-18", 3], ["92819", "2026-10-24", 1], ["91000", "2026-08-01", 3]]);
assert.equal(events[0].name, "MBG Commanderpalooza #3 - TimeTwister Event", "the event name, not its venue");
assert.deepEqual(mtgtop8Pages(formatPage), ["https://www.mtgtop8.com/format?f=cEDH&meta=327&cp=2", "https://www.mtgtop8.com/format?f=cEDH&meta=327&cp=3"]);
const picked = pickMtgtop8Events([...events, events[0]], { now: Date.parse("2026-10-26"), days: 14 });
assert.deepEqual(picked.map((e) => e.id), ["92803", "92612"], "major first, once each; bracket events and old events are left out");

const eventPage = `<div class=event_title>Steel City Green Chile Slopper Tournament Series I @ Eagle Ridge Convention Center (Pueblo, CO)</div>
<div style="margin-bottom:5px;">93 players - 18/10/26</div> <div class=S10 style="width:250px;overflow:hidden;padding-bottom:5px;">Source: <a target=_blank href=https://topdeck.gg/event/steel-city-green-chile-slopper-tournament-series-i>topdeck.gg</a></div></div> </div>
<div class=chosen_tr style="padding:3px 0px 3px 0px;" align=left> <div style="display:flex;align-items:center;"> <div style="width:42px;" align=center class=S14>1</div> <div style="width:80px;height:40px;background:black;"><a href=?e=92612&d=903502&f=cEDH><img src=/metas_thumbs/1200.jpg></a></div> <div style="flex:1;"> <div class=S14 style="width:100%;padding-left:4px;margin-bottom:4px;"><a href=?e=92612&d=903502&f=cEDH>Thrasios + Tymna</a> </div> <div style="margin-right:10px;" align=right class=G11><a class=player href=search?player=Janos+Nado+%2F%2F+Criticaledh>Janos Nado // Criticaledh</a></div> </div> </div> </div>
<div class=hover_tr style="padding:3px 0px 3px 0px;" align=left> <div style="display:flex;align-items:center;"> <div style="width:42px;" align=center class=S14>3-4</div> <div style="width:80px;height:40px;background:black;"><a href=?e=92612&d=903504&f=cEDH><img src=/metas_thumbs/3036.jpg></a></div> <div style="flex:1;"> <div class=S14 style="width:100%;padding-left:4px;margin-bottom:4px;"><a href=?e=92612&d=903504&f=cEDH>Kinnan, Bonder Prodigy</a> </div> <div style="margin-right:10px;" align=right class=G11><a class=player href=search?player=Austen+Louden>Austen Louden</a></div> </div> </div> </div>`;
const event = parseMtgtop8Event(eventPage, "92612");
assert.deepEqual([event.players, event.date, event.source], [93, "2026-10-18", "https://topdeck.gg/event/steel-city-green-chile-slopper-tournament-series-i"]);
assert.deepEqual(event.entries.map((e) => [e.placing, e.rank, e.deckId, e.player]), [["1", 1, "903502", "Janos Nado // Criticaledh"], ["3-4", 3, "903504", "Austen Louden"]]);
assert.deepEqual(parseMtgtop8Event(eventPage, "1").entries, [], "standings of another event are never taken");

const partners = parseMtgtop8Export(["1 Birds of Paradise", "1 Fire // Ice", "1 Bala Ged Recovery/Bala Ged Sanctuary", "93 Forest", "2 Island", "", "Sideboard", "1 Thrasios, Triton Hero", "1 Tymna the Weaver", ""].join("\r\n"));
assert.deepEqual(partners.commanders.map((c) => c.name), ["Thrasios, Triton Hero", "Tymna the Weaver"]);
assert.deepEqual(partners.main.map((r) => r.name).slice(1, 3), ["Fire // Ice", "Bala Ged Recovery // Bala Ged Sanctuary"]);
assert.deepEqual(partners.main.filter((r) => r.land).map((r) => r.name), ["Forest", "Island"]);
assert.equal(parseMtgtop8Export("1 Sol Ring\r\n\r\nSideboard\r\n1 Kinnan, Bonder Prodigy\r\n"), null, "a short list is not a Commander deck");
assert.equal(parseMtgtop8Export("99 Forest\r\n1 Sol Ring\r\n"), null, "a list without a commander is not a Commander deck");

const data = normalizeMtgtop8([{ ...event, name: "Steel City Green Chile Slopper Tournament Series I" }], new Map([["903502", partners]]), { days: 14 });
assert.equal(data.decks.length, 1);
assert.deepEqual([data.decks[0].name, data.decks[0].place, data.decks[0].cover, data.decks[0].url], ["Thrasios, Triton Hero + Tymna the Weaver", "1st", "Thrasios, Triton Hero", "https://www.mtgtop8.com/event?e=92612&d=903502&f=cEDH"]);
assert.deepEqual([data.coverage.topSlots, data.coverage.withList, data.coverage.missing, data.coverage.players], [2, 1, 1, 93], "a standing without a list is counted, not invented");
assert.deepEqual(data.archetypes.map((a) => [a.name, a.lists, a.share, a.best]), [["Thrasios, Triton Hero + Tymna the Weaver", 1, 1, "t8:92612:903502"]]);
assert.equal(data.events[0].source, "https://topdeck.gg/event/steel-city-green-chile-slopper-tournament-series-i");
console.log("PASS: MTGTop8 Commander parsers — events, standings, exports, normalized meta.");

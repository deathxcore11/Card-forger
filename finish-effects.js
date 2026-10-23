import {ANNIVERSARY_MAPS,ANNIVERSARY_STAMPS} from './pokemon-anniversary-masks.js';
// Printing-aware presentation only. Never infer availability from a quote, value or frame.
import {quoteForContext,validSetContext} from './pricing-presentation.js';
import {pokemonVariantChoices,pokemonVariantProductConflict} from './pokemon-variant-options.js';
import {reviewedCosmosPreview} from './pokemon-promo-evidence.js';
import {YGO_FOIL_RECIPES,FOIL_PATTERN,ygoRarityEffect,ygoSetEffect,YGO_MODERN_FROM} from './ygo-foil-recipes.js';
import {mtgFoilEffect,mtgFrameKey,mtgHoloStamp,MTG_FOIL_RECIPES} from './mtg-foil-recipes.js';
import {ptcgFoilEffect,PTCG_FOIL_RECIPES} from './ptcg-foil-recipes.js';
export const FINISH_SOURCES = Object.freeze({
 pokemon:'https://www.pokemon.com/us/pokemon-news/pokemon-tcg-scarlet-and-violet-revamps-pokemon-tcg-card-aesthetic',
 base:'https://images.pokemontcg.io/base1/4_hires.png',
 expedition:'https://api.tcgdex.net/v2/en/cards/ecard1-1',
 gengar30:'https://api.tcgdex.net/v2/en/cards/30th-154',
 scryfall:'https://scryfall.com/docs/api/cards',
 etched:'https://magic.wizards.com/en/news/feature/collecting-commander-legends-battle-for-baldurs-gate',
 ygo:'https://www.yugioh-card.com/en/about/new-to-ygo/',
});
// Normalized source-image coordinates. Geometry is an approximation, not an authentication aid.
export const FINISH_MASKS = Object.freeze({
 // The First Movie stamp's box; its letters come from the stamp mask image (see .finish-stamp-silver).
 'pk-stamp-first-movie':'inset(11.5% 11% 74.5% 56.5%)',
 ...Object.fromEntries(Object.values(ANNIVERSARY_MAPS).flatMap(p=>[p,...(p.alternates||[])]).map(p=>[p.mask,p.css])),
 ...Object.fromEntries(Object.values(ANNIVERSARY_STAMPS).flat().map(p=>[p.mask,p.css])),
 card:'inset(0 round 4.75% / 3.5%)',
 'pk-expedition-art':'polygon(25% 12.4%,96.5% 12.4%,96.5% 48.2%,25% 48.2%,18% 47.4%,13% 44.8%,10% 40%,10% 22%,12% 17.8%,17% 14.4%)',
 // Conservative known reverse-foil field. E-reader strips/frame are deliberately excluded.
 'pk-expedition-field':'inset(51.5% 4% 14% 12%)',
 // Individually traced TCGdex Base Set fronts. Native pixels and retained
 // image hashes: tests/fixtures/base-set-frames/geometry.json. Edition choices
 // share these reference images; other source images keep their existing map.
 'pk-base1-1-tcgdex-art':'polygon(10.833333% 17.090909%,11.666667% 17.090909%,12.333333% 16.848485%,13.000000% 16.969697%,13.833333% 17.575758%,14.500000% 17.333333%,15.166667% 16.848485%,16.000000% 16.969697%,16.666667% 17.090909%,17.333333% 16.121212%,18.166667% 15.636364%,19.166667% 15.151515%,20.000000% 14.909091%,20.666667% 13.696970%,21.666667% 12.848485%,23.000000% 12.242424%,24.166667% 12.000000%,89.666667% 12.000000%,89.666667% 51.636364%,10.833333% 51.636364%)',
 'pk-base1-2-tcgdex-art':'polygon(10.833333% 16.969697%,11.666667% 16.727273%,12.333333% 16.969697%,13.333333% 17.575758%,14.000000% 17.333333%,14.833333% 16.606061%,15.666667% 16.969697%,16.500000% 16.727273%,17.333333% 15.636364%,18.500000% 15.030303%,19.833333% 14.666667%,20.333333% 13.575758%,21.166667% 12.848485%,22.666667% 12.242424%,24.000000% 11.757576%,89.500000% 11.757576%,89.500000% 51.515152%,10.833333% 51.515152%)',
 'pk-base1-3-tcgdex-art':'polygon(10.666667% 12.121212%,89.166667% 12.121212%,89.166667% 51.636364%,10.666667% 51.636364%)',
 'pk-base1-4-tcgdex-art':'polygon(11.000000% 17.090909%,11.666667% 17.090909%,12.333333% 16.848485%,13.000000% 17.090909%,13.833333% 17.575758%,14.500000% 17.333333%,15.333333% 16.848485%,16.166667% 17.090909%,16.666667% 16.969697%,17.166667% 16.242424%,18.166667% 15.515152%,19.166667% 15.030303%,20.166667% 14.545455%,20.666667% 13.575758%,21.666667% 12.848485%,23.333333% 12.121212%,24.333333% 11.878788%,89.500000% 11.878788%,89.500000% 51.515152%,11.000000% 51.515152%)',
 'pk-base1-5-tcgdex-art':'polygon(10.833333% 12.000000%,89.333333% 12.000000%,89.333333% 51.757576%,10.833333% 51.757576%)',
 'pk-base1-6-tcgdex-art':'polygon(11.166667% 17.090909%,12.000000% 16.727273%,12.500000% 16.969697%,13.500000% 17.696970%,14.333333% 17.333333%,15.000000% 16.727273%,15.833333% 16.969697%,16.500000% 17.212121%,17.333333% 16.242424%,18.333333% 15.515152%,19.833333% 14.909091%,20.500000% 14.060606%,21.500000% 13.212121%,23.000000% 12.363636%,24.333333% 12.000000%,89.333333% 12.000000%,89.333333% 51.515152%,11.166667% 51.515152%)',
 'pk-base1-7-tcgdex-art':'polygon(10.833333% 12.000000%,89.166667% 12.000000%,89.166667% 51.636364%,10.833333% 51.636364%)',
 'pk-base1-8-tcgdex-art':'polygon(10.833333% 17.212121%,11.666667% 16.848485%,12.333333% 16.848485%,13.333333% 17.575758%,14.166667% 17.454545%,15.000000% 16.848485%,15.666667% 16.969697%,16.333333% 17.090909%,17.166667% 15.878788%,18.333333% 15.272727%,19.833333% 14.666667%,20.500000% 13.575758%,21.333333% 12.848485%,23.000000% 12.242424%,24.333333% 11.878788%,89.500000% 11.878788%,89.500000% 51.515152%,10.833333% 51.515152%)',
 'pk-base1-9-tcgdex-art':'polygon(10.500000% 17.090909%,11.333333% 16.969697%,12.166667% 16.727273%,13.500000% 17.575758%,14.166667% 17.333333%,15.000000% 16.727273%,15.833333% 16.969697%,16.500000% 16.969697%,17.333333% 15.878788%,18.500000% 15.272727%,19.666667% 14.787879%,20.333333% 13.575758%,21.500000% 12.727273%,23.166667% 12.121212%,24.333333% 12.000000%,89.166667% 12.000000%,89.166667% 51.515152%,10.500000% 51.515152%)',
 'pk-base1-10-tcgdex-art':'polygon(11.166667% 11.757576%,89.333333% 11.757576%,89.333333% 51.393939%,11.166667% 51.393939%)',
 'pk-base1-11-tcgdex-art':'polygon(11.166667% 17.333333%,11.833333% 17.212121%,12.666667% 16.969697%,13.833333% 17.818182%,14.500000% 17.575758%,15.333333% 17.090909%,16.166667% 17.333333%,16.666667% 17.212121%,17.500000% 16.121212%,18.500000% 15.393939%,20.166667% 14.909091%,20.666667% 13.939394%,21.833333% 13.212121%,23.333333% 12.484848%,24.666667% 12.242424%,89.666667% 12.242424%,89.666667% 51.878788%,11.166667% 51.878788%)',
 'pk-base1-12-tcgdex-art':'polygon(10.666667% 17.212121%,11.666667% 16.969697%,12.333333% 16.969697%,13.333333% 17.575758%,14.166667% 17.454545%,15.000000% 16.848485%,15.833333% 16.969697%,16.500000% 17.090909%,17.333333% 16.000000%,18.500000% 15.272727%,19.833333% 14.787879%,20.500000% 13.696970%,21.500000% 12.969697%,23.166667% 12.363636%,24.500000% 12.121212%,89.000000% 12.121212%,89.000000% 51.636364%,10.666667% 51.636364%)',
 'pk-base1-13-tcgdex-art':'polygon(10.833333% 17.333333%,11.833333% 17.212121%,12.500000% 17.090909%,13.833333% 17.939394%,14.500000% 17.696970%,15.333333% 17.090909%,16.166667% 17.333333%,16.833333% 17.333333%,17.500000% 16.121212%,18.666667% 15.515152%,20.000000% 15.030303%,20.666667% 13.939394%,21.833333% 13.212121%,23.333333% 12.606061%,24.666667% 12.242424%,89.666667% 12.242424%,89.666667% 51.878788%,10.833333% 51.878788%)',
 'pk-base1-14-tcgdex-art':'polygon(10.500000% 17.090909%,11.333333% 16.727273%,12.333333% 16.969697%,13.500000% 17.696970%,14.166667% 17.333333%,15.000000% 16.848485%,15.833333% 17.212121%,16.500000% 16.848485%,17.333333% 15.878788%,18.500000% 15.272727%,20.000000% 14.909091%,20.500000% 13.696970%,21.500000% 12.969697%,23.166667% 12.363636%,24.500000% 12.121212%,89.333333% 12.121212%,89.333333% 51.757576%,10.500000% 51.757576%)',
 'pk-base1-15-tcgdex-art':'polygon(10.833333% 17.090909%,11.833333% 16.848485%,12.500000% 16.848485%,13.500000% 17.575758%,14.333333% 17.333333%,15.166667% 16.727273%,15.833333% 17.090909%,16.666667% 16.848485%,17.500000% 15.757576%,18.666667% 15.151515%,20.000000% 14.787879%,20.666667% 13.575758%,21.666667% 12.848485%,23.166667% 12.242424%,24.500000% 12.000000%,89.333333% 12.000000%,89.333333% 51.515152%,10.833333% 51.515152%)',
 'pk-base1-16-tcgdex-art':'polygon(10.833333% 11.757576%,89.333333% 11.757576%,89.333333% 51.272727%,10.833333% 51.272727%)',
 'pk-base-art':'polygon(24% 11.8%,89.8% 11.8%,89.8% 51.6%,10.8% 51.6%,10.8% 18%,19% 18%,24% 14%)',
 'pk-base1-4-art':'inset(12% 10.3333% 48.3636% 11%)',
 'pk-base4-20-art':'inset(11.8788% 11.1667% 49.0909% 11.3333%)',
 // Exact Neo Genesis Lugia illustration window, visually checked against source art.
 // Approximation: no character silhouette, edition stamp or authenticity claim.
 'pk-neo1-9-art':'inset(12.1% 11.4% 48.8% 11.1%)',
 'pk-cel-art':'inset(9.5% 6.6% 51.3% 6.6%)',
 // Sword & Shield art window (734 × 1024 reference); reverse excludes its silver frame/caption too.
 'pk-swsh-trainer-field':'inset(53% 8.5% 13% 8.5%)',
 'pk-standard-art':'inset(12.3% 8.2% 47.5% 8.2%)',
 // Unified Minds Celebi 4: source art is 600x825, illustration x48..552,
 // y81..390. The silver frame and Pokédex caption are outside this window.
 'pk-sm11-4-art':'inset(9.818182% 8% 52.727273% 8%)',
 'pk-standard-surround':'polygon(evenodd, 4% 3%,96% 3%,96% 97%,4% 97%,4% 3%,8.2% 12.3%,8.2% 52.5%,91.8% 52.5%,91.8% 12.3%,8.2% 12.3%)',
 // Ordinary Sun & Moon frames, checked against sm11-6, sm11-7 and sm11-9
 // (600x825). Exclude the silver frame/caption and protruding stage badge.
 'pk-sm-surround':'polygon(evenodd, 1.67% 1.09%,98.33% 1.09%,98.33% 98.79%,1.67% 98.79%,1.67% 1.09%,6.7% 9.1%,6.7% 50.8%,93.3% 50.8%,93.3% 9.1%,6.7% 9.1%)',
 'pk-sm-evolved-surround':'polygon(evenodd, 1.67% 1.09%,98.33% 1.09%,98.33% 98.79%,1.67% 98.79%,1.67% 1.09%,3.3% 7.2%,3.3% 16.3%,6.7% 16.3%,6.7% 50.8%,93.3% 50.8%,93.3% 9.1%,16.3% 9.1%,16.3% 7.2%,3.3% 7.2%)',
 'pk-trainer-art':'inset(18% 8.2% 40% 8.2%)',
 // Era frames measured on TCGdex 600x825 fronts: mean edge maps of 30-145
 // regular cards per era and layout, traced to the printed frame line (see
 // tests/fixtures/pokemon-frame-geometry.json). Illustrations rise beside the
 // printed stage banner, so Basic and evolved windows step around it; evolved
 // windows also curve around the pre-evolution badge. Reverse holes match.
 'pk-dppt-art':'polygon(7% 11.9%,21% 11.9%,23.2% 11.3%,26.7% 9.3%,92.8% 9.3%,92.8% 49.7%,7% 49.7%)',
 'pk-dppt-surround':'polygon(evenodd, 2% 1.45%,98% 1.45%,98% 98.67%,2% 98.67%,2% 1.45%,7% 11.9%,21% 11.9%,23.2% 11.3%,26.7% 9.3%,92.8% 9.3%,92.8% 49.7%,7% 49.7%,7% 11.9%)',
 'pk-dppt-evolved-art':'polygon(7.2% 16.9%,9.5% 17.3%,13% 17.3%,15.2% 16.9%,18.2% 15.3%,19.3% 13.9%,19.8% 12.1%,20.2% 12%,54.5% 12.1%,58% 11.4%,61% 9.5%,92.7% 9.5%,92.7% 49.7%,7.2% 49.7%)',
 'pk-dppt-evolved-surround':'polygon(evenodd, 2% 1.45%,98% 1.45%,98% 98.67%,2% 98.67%,2% 1.45%,7.2% 16.9%,9.5% 17.3%,13% 17.3%,15.2% 16.9%,18.2% 15.3%,19.3% 13.9%,19.8% 12.1%,20.2% 12%,54.5% 12.1%,58% 11.4%,61% 9.5%,92.7% 9.5%,92.7% 49.7%,7.2% 49.7%,7.2% 16.9%)',
 'pk-dppt-trainer-art':'polygon(8.8% 14.7%,90.5% 14.7%,90.5% 49.7%,8.8% 49.7%)',
 'pk-dppt-trainer-surround':'polygon(evenodd, 2% 1.45%,98% 1.45%,98% 98.67%,2% 98.67%,2% 1.45%,8.8% 14.7%,90.5% 14.7%,90.5% 49.7%,8.8% 49.7%,8.8% 14.7%)',
 'pk-hgss-art':'polygon(5.5% 11.2%,20.3% 11.2%,23.2% 10.7%,25.7% 9.2%,94.3% 9.1%,94.3% 52%,5.5% 52%)',
 'pk-hgss-surround':'polygon(evenodd, 1.67% 1.21%,98.17% 1.21%,98.17% 98.79%,1.67% 98.79%,1.67% 1.21%,5.5% 11.2%,20.3% 11.2%,23.2% 10.7%,25.7% 9.2%,94.3% 9.1%,94.3% 52%,5.5% 52%,5.5% 11.2%)',
 'pk-hgss-evolved-art':'polygon(5.6% 11.2%,22.7% 11.2%,24.5% 11.4%,30.8% 10.6%,59.3% 10.6%,61.8% 10.3%,64.5% 9.2%,94.2% 9.1%,94.2% 52%,5.6% 52%)',
 'pk-hgss-evolved-surround':'polygon(evenodd, 1.67% 1.21%,98.17% 1.21%,98.17% 98.79%,1.67% 98.79%,1.67% 1.21%,5.6% 11.2%,22.7% 11.2%,24.5% 11.4%,30.8% 10.6%,59.3% 10.6%,61.8% 10.3%,64.5% 9.2%,94.2% 9.1%,94.2% 52%,5.6% 52%,5.6% 11.2%)',
 'pk-hgss-trainer-art':'polygon(7.8% 14.7%,92% 14.7%,92% 53.1%,7.8% 53.1%)',
 'pk-hgss-trainer-surround':'polygon(evenodd, 1.67% 1.21%,98.17% 1.21%,98.17% 98.79%,1.67% 98.79%,1.67% 1.21%,7.8% 14.7%,92% 14.7%,92% 53.1%,7.8% 53.1%,7.8% 14.7%)',
 'pk-bwxy-art':'polygon(9% 10.7%,90.8% 10.7%,90.8% 49.1%,9% 49.1%)',
 'pk-bwxy-surround':'polygon(evenodd, 4% 2.79%,95.83% 2.79%,95.83% 97.09%,4% 97.09%,4% 2.79%,9% 10.7%,90.8% 10.7%,90.8% 49.1%,9% 49.1%,9% 10.7%)',
 'pk-bwxy-evolved-art':'polygon(9% 16.1%,12.7% 16.1%,15.7% 15.2%,17.8% 13.7%,19.2% 11.6%,61.3% 11.6%,64% 10.8%,90.8% 10.7%,90.8% 49.1%,9% 49.1%)',
 'pk-bwxy-evolved-surround':'polygon(evenodd, 4% 2.79%,95.83% 2.79%,95.83% 97.09%,4% 97.09%,4% 2.79%,9% 16.1%,12.7% 16.1%,15.7% 15.2%,17.8% 13.7%,19.2% 11.6%,61.3% 11.6%,64% 10.8%,90.8% 10.7%,90.8% 49.1%,9% 49.1%,9% 16.1%)',
 'pk-bwxy-trainer-art':'polygon(10.6% 16.4%,89.3% 16.4%,89.3% 50.1%,10.6% 50.1%)',
 'pk-bwxy-trainer-surround':'polygon(evenodd, 4% 2.79%,95.83% 2.79%,95.83% 97.09%,4% 97.09%,4% 2.79%,10.6% 16.4%,89.3% 16.4%,89.3% 50.1%,10.6% 50.1%,10.6% 16.4%)',
 'pk-sm-art':'polygon(6.3% 8.7%,93.5% 8.7%,93.5% 46.7%,6.3% 46.7%)',
 'pk-sm-evolved-art':'polygon(6.3% 15.4%,11.7% 15.2%,14.5% 13.1%,15% 10.4%,55.2% 10.5%,56.7% 10.3%,59.5% 8.7%,93.5% 8.7%,93.5% 46.7%,6.3% 46.7%)',
 'pk-sm-trainer-art':'polygon(6.3% 13.7%,93.3% 13.7%,93.3% 51.6%,6.3% 51.6%)',
 'pk-sm-trainer-surround':'polygon(evenodd, 1.67% 1.09%,98.33% 1.09%,98.33% 98.79%,1.67% 98.79%,1.67% 1.09%,6.3% 13.7%,93.3% 13.7%,93.3% 51.6%,6.3% 51.6%,6.3% 13.7%)',
 'pk-swsh-art':'polygon(8.5% 10.2%,91.5% 10.2%,91.5% 46.9%,8.5% 46.9%)',
 'pk-swsh-surround':'polygon(evenodd, 3.83% 2.79%,96% 2.79%,96% 98.79%,3.83% 98.79%,3.83% 2.79%,8.5% 10.2%,91.5% 10.2%,91.5% 46.9%,8.5% 46.9%,8.5% 10.2%)',
 'pk-swsh-evolved-art':'polygon(8.5% 16.4%,12.2% 16.2%,14.3% 15.5%,16.2% 13.7%,16.5% 12.2%,54.3% 12.1%,57% 10.2%,91.5% 10.2%,91.5% 46.9%,8.5% 46.9%)',
 'pk-swsh-evolved-surround':'polygon(evenodd, 3.83% 2.79%,96% 2.79%,96% 98.79%,3.83% 98.79%,3.83% 2.79%,8.5% 16.4%,12.2% 16.2%,14.3% 15.5%,16.2% 13.7%,16.5% 12.2%,54.3% 12.1%,57% 10.2%,91.5% 10.2%,91.5% 46.9%,8.5% 46.9%,8.5% 16.4%)',
 'pk-swsh-trainer-art':'polygon(8.3% 14.6%,91.7% 14.6%,91.7% 51.5%,8.3% 51.5%)',
 'pk-swsh-trainer-surround':'polygon(evenodd, 3.83% 2.79%,96% 2.79%,96% 98.79%,3.83% 98.79%,3.83% 2.79%,8.3% 14.6%,91.7% 14.6%,91.7% 51.5%,8.3% 51.5%,8.3% 14.6%)',
 'pk-sv-art':'polygon(8.5% 10.2%,91.6% 10.2%,91.6% 46.9%,8.5% 46.9%)',
 'pk-sv-surround':'polygon(evenodd, 3.83% 2.67%,96% 2.67%,96% 98.67%,3.83% 98.67%,3.83% 2.67%,8.5% 10.2%,91.6% 10.2%,91.6% 46.9%,8.5% 46.9%,8.5% 10.2%)',
 'pk-sv-evolved-art':'polygon(8.4% 19%,12% 18.7%,15.2% 17.5%,16.6% 15.5%,17.5% 13.5%,18.2% 11.6%,65.5% 11.6%,68% 10.2%,91.6% 10.2%,91.6% 46.9%,8.4% 46.9%)',
 'pk-sv-evolved-surround':'polygon(evenodd, 3.83% 2.67%,96% 2.67%,96% 98.67%,3.83% 98.67%,3.83% 2.67%,8.4% 19%,12% 18.7%,15.2% 17.5%,16.6% 15.5%,17.5% 13.5%,18.2% 11.6%,65.5% 11.6%,68% 10.2%,91.6% 10.2%,91.6% 46.9%,8.4% 46.9%,8.4% 19%)',
 'pk-sv-trainer-art':'polygon(8.3% 14.4%,91.8% 14.4%,91.8% 51.4%,8.3% 51.4%)',
 'pk-sv-trainer-surround':'polygon(evenodd, 3.83% 2.67%,96% 2.67%,96% 98.67%,3.83% 98.67%,3.83% 2.67%,8.3% 14.4%,91.8% 14.4%,91.8% 51.4%,8.3% 51.4%,8.3% 14.4%)',
 // Pre-Diamond & Pearl frames measured the same way (WotC, e-Card, EX).
 'pk-wotc-art':'polygon(11.2% 11.6%,88.8% 11.8%,88.8% 50.8%,11.5% 50.8%,11.2% 50.5%,11% 11.8%)',
 'pk-wotc-surround':'polygon(evenodd, 2.83% 2.18%,97.17% 2.18%,97.17% 97.94%,2.83% 97.94%,2.83% 2.18%,11.2% 11.6%,88.8% 11.8%,88.8% 50.8%,11.5% 50.8%,11.2% 50.5%,11% 11.8%,11.2% 11.6%)',
 'pk-wotc-evolved-art':'polygon(24.2% 11.5%,89% 11.6%,89% 50.8%,11.2% 50.8%,11% 17.1%,12.3% 16.7%,14% 17.4%,15% 16.9%,16.5% 17%,18% 15.5%,20.2% 14.7%,21.3% 13.2%,24% 11.6%)',
 'pk-wotc-evolved-surround':'polygon(evenodd, 2.83% 2.18%,97.17% 2.18%,97.17% 97.94%,2.83% 97.94%,2.83% 2.18%,24.2% 11.5%,89% 11.6%,89% 50.8%,11.2% 50.8%,11% 17.1%,12.3% 16.7%,14% 17.4%,15% 16.9%,16.5% 17%,18% 15.5%,20.2% 14.7%,21.3% 13.2%,24% 11.6%,24.2% 11.5%)',
 'pk-wotc-trainer-art':'polygon(10.7% 23.8%,91.7% 23.8%,91.7% 55.1%,10.7% 55.1%)',
 'pk-wotc-trainer-surround':'polygon(evenodd, 2.83% 2.18%,97.17% 2.18%,97.17% 97.94%,2.83% 97.94%,2.83% 2.18%,10.7% 23.8%,91.7% 23.8%,91.7% 55.1%,10.7% 55.1%,10.7% 23.8%)',
 'pk-gym-art':'polygon(11.2% 11.6%,88.8% 11.8%,88.8% 50.8%,11.5% 50.8%,11.2% 50.5%,11% 11.8%)',
 'pk-gym-surround':'polygon(evenodd, 3.17% 2.3%,97% 2.3%,97% 97.7%,3.17% 97.7%,3.17% 2.3%,11.2% 11.6%,88.8% 11.8%,88.8% 50.8%,11.5% 50.8%,11.2% 50.5%,11% 11.8%,11.2% 11.6%)',
 'pk-gym-evolved-art':'polygon(23.8% 11.8%,88.7% 11.9%,88.7% 50.9%,11.3% 50.8%,11.2% 17.1%,12.5% 16.7%,13.7% 17.6%,14.2% 17.6%,15.3% 16.7%,16.3% 17%,18.7% 15.4%,19.8% 15%,20.7% 14.4%,21% 13.7%,23.7% 11.9%)',
 'pk-gym-evolved-surround':'polygon(evenodd, 3.17% 2.3%,97% 2.3%,97% 97.7%,3.17% 97.7%,3.17% 2.3%,23.8% 11.8%,88.7% 11.9%,88.7% 50.9%,11.3% 50.8%,11.2% 17.1%,12.5% 16.7%,13.7% 17.6%,14.2% 17.6%,15.3% 16.7%,16.3% 17%,18.7% 15.4%,19.8% 15%,20.7% 14.4%,21% 13.7%,23.7% 11.9%,23.8% 11.8%)',
 'pk-gym-trainer-art':'polygon(10.2% 23.3%,92% 23.3%,92% 55.5%,10.2% 55.5%)',
 'pk-gym-trainer-surround':'polygon(evenodd, 3.17% 2.3%,97% 2.3%,97% 97.7%,3.17% 97.7%,3.17% 2.3%,10.2% 23.3%,92% 23.3%,92% 55.5%,10.2% 55.5%,10.2% 23.3%)',
 'pk-neo-art':'polygon(11.5% 11.9%,88.7% 12.1%,88.7% 50.8%,11.7% 50.9%,11.3% 50.7%,11.5% 37.5%,11.2% 32.2%,11.3% 12%)',
 'pk-neo-surround':'polygon(evenodd, 3.33% 2.55%,96.67% 2.55%,96.67% 97.45%,3.33% 97.45%,3.33% 2.55%,11.5% 11.9%,88.7% 12.1%,88.7% 50.8%,11.7% 50.9%,11.3% 50.7%,11.5% 37.5%,11.2% 32.2%,11.3% 12%,11.5% 11.9%)',
 'pk-neo-evolved-art':'polygon(17.8% 11.9%,88.5% 12.1%,88.7% 50.8%,11.7% 50.8%,11.3% 48.5%,11.3% 16%,14.5% 14.7%,17.7% 12%)',
 'pk-neo-evolved-surround':'polygon(evenodd, 3.33% 2.55%,96.67% 2.55%,96.67% 97.45%,3.33% 97.45%,3.33% 2.55%,17.8% 11.9%,88.5% 12.1%,88.7% 50.8%,11.7% 50.8%,11.3% 48.5%,11.3% 16%,14.5% 14.7%,17.7% 12%,17.8% 11.9%)',
 'pk-neo-trainer-art':'polygon(10.2% 23.3%,92% 23.3%,92% 55.5%,10.2% 55.5%)',
 'pk-neo-trainer-surround':'polygon(evenodd, 3.33% 2.55%,96.67% 2.55%,96.67% 97.45%,3.33% 97.45%,3.33% 2.55%,10.2% 23.3%,92% 23.3%,92% 55.5%,10.2% 55.5%,10.2% 23.3%)',
 'pk-lc-art':'polygon(17.8% 11.8%,88.3% 11.9%,88.7% 12.1%,88.8% 20.1%,88.5% 21.8%,88.7% 31.1%,88.3% 34.5%,88.5% 50.8%,11.5% 50.8%,11.3% 12%,17.7% 11.9%)',
 'pk-lc-surround':'polygon(evenodd, 3.5% 2.42%,96.67% 2.42%,96.67% 97.58%,3.5% 97.58%,3.5% 2.42%,17.8% 11.8%,88.3% 11.9%,88.7% 12.1%,88.8% 20.1%,88.5% 21.8%,88.7% 31.1%,88.3% 34.5%,88.5% 50.8%,11.5% 50.8%,11.3% 12%,17.7% 11.9%,17.8% 11.8%)',
 'pk-lc-evolved-art':'polygon(24.2% 11.5%,89% 11.6%,89% 50.8%,11.2% 50.8%,11% 17.1%,12.3% 16.7%,14% 17.4%,15% 16.9%,16.5% 17%,18% 15.5%,20.2% 14.7%,21.3% 13.2%,24% 11.6%)',
 'pk-lc-evolved-surround':'polygon(evenodd, 3.5% 2.42%,96.67% 2.42%,96.67% 97.58%,3.5% 97.58%,3.5% 2.42%,24.2% 11.5%,89% 11.6%,89% 50.8%,11.2% 50.8%,11% 17.1%,12.3% 16.7%,14% 17.4%,15% 16.9%,16.5% 17%,18% 15.5%,20.2% 14.7%,21.3% 13.2%,24% 11.6%,24.2% 11.5%)',
 'pk-lc-trainer-art':'polygon(10.2% 23.3%,92% 23.3%,92% 55.5%,10.2% 55.5%)',
 'pk-lc-trainer-surround':'polygon(evenodd, 3.5% 2.42%,96.67% 2.42%,96.67% 97.58%,3.5% 97.58%,3.5% 2.42%,10.2% 23.3%,92% 23.3%,92% 55.5%,10.2% 55.5%,10.2% 23.3%)',
 'pk-ecard-art':'polygon(30.7% 11.9%,73% 11.9%,73.7% 12.5%,76.2% 12.6%,95.8% 12.6%,95.7% 47.9%,72.8% 48%,66.7% 47.9%,66.2% 47.5%,65.5% 47.9%,43.8% 47.9%,43.7% 47.5%,43% 47.9%,25.2% 47.9%,20.3% 47.3%,15% 45.2%,13.3% 44%,11.3% 41.7%,10.5% 40%,10% 37.5%,10% 22.3%,10.3% 21.9%,10% 20.6%,10.7% 18.9%,12.5% 16.7%,14.8% 15%,18.2% 13.4%,24.2% 12%,30.5% 12%)',
 'pk-ecard-surround':'polygon(evenodd, 9.5% 2.3%,96.83% 2.3%,96.83% 94.06%,9.5% 94.06%,9.5% 2.3%,30.7% 11.9%,73% 11.9%,73.7% 12.5%,76.2% 12.6%,95.8% 12.6%,95.7% 47.9%,72.8% 48%,66.7% 47.9%,66.2% 47.5%,65.5% 47.9%,43.8% 47.9%,43.7% 47.5%,43% 47.9%,25.2% 47.9%,20.3% 47.3%,15% 45.2%,13.3% 44%,11.3% 41.7%,10.5% 40%,10% 37.5%,10% 22.3%,10.3% 21.9%,10% 20.6%,10.7% 18.9%,12.5% 16.7%,14.8% 15%,18.2% 13.4%,24.2% 12%,30.5% 12%,30.7% 11.9%)',
 'pk-ecard-evolved-art':'polygon(32.7% 11.9%,41.5% 11.9%,43% 12.1%,62.7% 12%,64.3% 12.2%,73% 12%,74.2% 12.7%,83.2% 12.6%,84.2% 12.8%,87.2% 12.6%,96% 12.8%,96% 41.7%,95.7% 42.4%,96% 43.8%,96% 47.9%,95.7% 48.1%,72.7% 48.1%,71% 47.9%,67% 48.1%,65.5% 47.9%,63.5% 48.1%,58.5% 47.9%,50.7% 48.1%,45.2% 47.9%,27.2% 48%,20.5% 47.4%,16% 45.8%,13.7% 44.2%,12.2% 42.8%,11% 41.1%,10.3% 39.3%,10.2% 20.6%,10.7% 19.4%,12.2% 17.3%,15.7% 14.8%,18.8% 14.3%,22.2% 12.5%,26.5% 12%,32.5% 12%)',
 'pk-ecard-evolved-surround':'polygon(evenodd, 9.5% 2.3%,96.83% 2.3%,96.83% 94.06%,9.5% 94.06%,9.5% 2.3%,32.7% 11.9%,41.5% 11.9%,43% 12.1%,62.7% 12%,64.3% 12.2%,73% 12%,74.2% 12.7%,83.2% 12.6%,84.2% 12.8%,87.2% 12.6%,96% 12.8%,96% 41.7%,95.7% 42.4%,96% 43.8%,96% 47.9%,95.7% 48.1%,72.7% 48.1%,71% 47.9%,67% 48.1%,65.5% 47.9%,63.5% 48.1%,58.5% 47.9%,50.7% 48.1%,45.2% 47.9%,27.2% 48%,20.5% 47.4%,16% 45.8%,13.7% 44.2%,12.2% 42.8%,11% 41.1%,10.3% 39.3%,10.2% 20.6%,10.7% 19.4%,12.2% 17.3%,15.7% 14.8%,18.8% 14.3%,22.2% 12.5%,26.5% 12%,32.5% 12%,32.7% 11.9%)',
 'pk-ecard-trainer-art':'polygon(9.8% 16.5%,89.7% 16.5%,89.7% 50.3%,9.8% 50.3%)',
 'pk-ecard-trainer-surround':'polygon(evenodd, 9.5% 2.3%,96.83% 2.3%,96.83% 94.06%,9.5% 94.06%,9.5% 2.3%,9.8% 16.5%,89.7% 16.5%,89.7% 50.3%,9.8% 50.3%,9.8% 16.5%)',
 'pk-exa-art':'polygon(91.3% 9.4%,92.5% 9.8%,92.2% 23.5%,92.3% 46.2%,51.7% 46.4%,8.2% 46.4%,7.7% 46.2%,7.7% 9.7%,91.2% 9.6%)',
 'pk-exa-surround':'polygon(evenodd, 2.33% 1.58%,98% 1.58%,98% 98.55%,2.33% 98.55%,2.33% 1.58%,91.3% 9.4%,92.5% 9.8%,92.2% 23.5%,92.3% 46.2%,51.7% 46.4%,8.2% 46.4%,7.7% 46.2%,7.7% 9.7%,91.2% 9.6%,91.3% 9.4%)',
 'pk-exa-evolved-art':'polygon(83.2% 9.6%,86% 9.8%,87% 9.6%,91.5% 9.6%,92.3% 9.8%,92.2% 46.3%,17.5% 46.3%,15.3% 44.6%,13.8% 44.1%,12.3% 43.9%,7.8% 44%,7.7% 9.8%,83% 9.7%)',
 'pk-exa-evolved-surround':'polygon(evenodd, 2.33% 1.58%,98% 1.58%,98% 98.55%,2.33% 98.55%,2.33% 1.58%,83.2% 9.6%,86% 9.8%,87% 9.6%,91.5% 9.6%,92.3% 9.8%,92.2% 46.3%,17.5% 46.3%,15.3% 44.6%,13.8% 44.1%,12.3% 43.9%,7.8% 44%,7.7% 9.8%,83% 9.7%,83.2% 9.6%)',
 'pk-exa-trainer-art':'polygon(9% 14.8%,91.2% 14.8%,91.2% 48.6%,9% 48.6%)',
 'pk-exa-trainer-surround':'polygon(evenodd, 2.33% 1.58%,98% 1.58%,98% 98.55%,2.33% 98.55%,2.33% 1.58%,9% 14.8%,91.2% 14.8%,91.2% 48.6%,9% 48.6%,9% 14.8%)',
 'pk-exb-art':'polygon(7.7% 9.6%,92.3% 9.6%,92.3% 45.9%,7.7% 45.9%)',
 'pk-exb-surround':'polygon(evenodd, 2.17% 1.33%,98.17% 1.33%,98.17% 98.55%,2.17% 98.55%,2.17% 1.33%,7.7% 9.6%,92.3% 9.6%,92.3% 45.9%,7.7% 45.9%,7.7% 9.6%)',
 'pk-exb-evolved-art':'polygon(7.7% 9.6%,92.3% 9.6%,92.3% 45.9%,7.7% 45.9%)',
 'pk-exb-evolved-surround':'polygon(evenodd, 2.17% 1.33%,98.17% 1.33%,98.17% 98.55%,2.17% 98.55%,2.17% 1.33%,7.7% 9.6%,92.3% 9.6%,92.3% 45.9%,7.7% 45.9%,7.7% 9.6%)',
 'pk-exb-trainer-art':'polygon(9.3% 14.6%,91.2% 14.6%,91.2% 48.5%,9.3% 48.5%)',
 'pk-exb-trainer-surround':'polygon(evenodd, 2.17% 1.33%,98.17% 1.33%,98.17% 98.55%,2.17% 98.55%,2.17% 1.33%,9.3% 14.6%,91.2% 14.6%,91.2% 48.5%,9.3% 48.5%,9.3% 14.6%)',
 // NEC #077 inverted display commander only. Traced from Wizards' 265x370 image.
 // Artwork, outer black border, footer and the security oval are deliberately outside.
 'mtg-nec77-metal':'polygon(evenodd, 4.2% 5.5%,6.8% 3.3%,10% 4.5%,19% 4.5%,22% 3.6%,35% 4.5%,48% 2.6%,57% 3.2%,63% 4.8%,80% 4.5%,84% 3.2%,88% 4.7%,93% 4.7%,96% 7%,95% 57%,96% 59%,94% 62%,94% 89%,95% 91%,94% 94.5%,78% 94.5%,77% 92.8%,56% 92.8%,55% 91.5%,52% 90.7%,48% 90.7%,45% 91.5%,44% 92.8%,8% 92.8%,5% 91%,4.5% 62%,4% 59%,5.5% 57%,5.5% 11%,4.2% 5.5%,7.5% 11.1%,7.5% 56.3%,92.5% 56.3%,92.5% 11.1%,7.5% 11.1%)',
 'mtg-frame':'polygon(evenodd, 3% 2%,97% 2%,97% 98%,3% 98%,3% 2%,9% 12%,9% 54%,91% 54%,91% 12%,9% 12%,9% 60%,9% 90%,91% 90%,91% 60%,9% 60%)',
 'ygo-art':'inset(18.3% 11.7% 29.4% 11.7%)',
 'ygo-art-pendulum':'inset(18.3% 6.6% 39.1% 6.6%)',
 'ygo-art-skill':'inset(17.4% 11.8% 33.8% 11.8%)',
 'ygo-name':'inset(5.5% 18% 89.7% 7.2%)',
 'ygo-broad':'inset(2.3% 3.2% round 1%)',
});
export const FINISH_MATERIALS = Object.freeze(['holo','rainbow','metal','silver','gold','secret','prismatic','starlight','tiles','micro']);
const layer=(mask,material)=>({mask,material});
// Promos with a foil-stamped logo printed on them. The stamp shines in its own metal, only in its own
// letters, on every finish of the card (the card itself can be non-holo). Masks are traced from the
// printed card and placed where the stamp sits on it.
//   First Movie (Wizards Black Star #2–#5, 1999 theatre promos): silver foil "Kids WB Presents Pokémon
//   The First Movie" at the top right of the art.
export const PRINTED_STAMPS=Object.freeze({'basep-2':'first-movie','basep-3':'first-movie','basep-4':'first-movie','basep-5':'first-movie'});
const withPrintedStamp=(c,p)=>{const stamp=PRINTED_STAMPS[c.id];if(!stamp||p.status==='unknown')return p;return {...p,layers:[...(p.layers||[]),layer('pk-stamp-'+stamp,'stamp-silver')],stamp};};
const unknown=(key='',label='')=>({key,label,effect:'unknown',status:'unknown',layers:[],source:'',reason:'Finish preview unavailable for this printing.'});
const preset=(key,label,effect,layers,source,status='approximate')=>({key,label,effect,layers,source,status,reason:status==='approximate'?'Simulated finish · approximate coverage':''});
const paper=(key,label)=>preset(key,label,'plain',[],'catalog','verified');
const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const variantFinish=v=>{
 if(v.finish)return {normal:'nonfoil',holo:'holofoil',reverse:'reverse-holofoil'}[v.finish]||v.finish;
 const k=norm(v.key),label=String(v.label||'');
 if(/unconfirmed/i.test(label))return '';
 if(/reverse/i.test(label)||k.includes('reverseholo'))return 'reverse-holofoil';
 if(/holo/i.test(label)||k.endsWith('holofoil'))return 'holofoil';
 if(['normal','nonfoil','unlimited','1stedition'].includes(k)||/\bNormal\b/i.test(label))return 'nonfoil';
 return '';
};
function exactOverride(game,c,key,face){
 // Future catalogue additions must match the full identity and provide evidence. No name matches.
 return (c.finishPresentations||[]).find(p=>p.game===game&&String(p.printingId)===String(c.id)&&p.finish===key&&Number(p.face||0)===face&&['verified','approximate'].includes(p.status)&&/^https:\/\//.test(p.source||'')&&p.layers?.length&&p.layers.every(l=>FINISH_MASKS[l.mask]&&FINISH_MATERIALS.includes(l.material)));
}
// Measured frame family for ordinary Pokémon/Trainer fronts (see FINISH_MASKS),
// or '' when the printed layout has no reviewed geometry. Stage picks the
// Basic or evolved window; it never adds a finish.
// Promo, reprint and McDonald's sets share the layout of the expansions printed beside them.
const PK_FRAME_ERAS=[[/^(?:base4|basep|si1)$/i,'pk-wotc'],[/^pop1$/i,'pk-exa'],[/^(?:np|exu|pop[2-5])$/i,'pk-exb'],[/^pop[6-9]$/i,'pk-dppt'],
 [/^20\d\d(?:bw|xy)$/i,'pk-bwxy'],[/^20\d\dsm$/i,'pk-sm'],[/^20\d\dswsh$/i,'pk-swsh'],[/^20\d\dsv$/i,'pk-sv'],[/^base[1-3]$/i,'pk-wotc'],[/^(?:base5|gym[12])$/i,'pk-gym'],[/^neo[1-4]$/i,'pk-neo'],[/^lc$/i,'pk-lc'],[/^ecard[1-3]$/i,'pk-ecard'],[/^ex[1-6]$/i,'pk-exa'],[/^ex(?:[7-9]|1[0-6])$/i,'pk-exb'],[/^(?:dp|pl)/i,'pk-dppt'],[/^(?:hgss|col)/i,'pk-hgss'],[/^(?:bw|xy|g1$|dc1|dv1)/i,'pk-bwxy'],[/^(?:sm|det1)/i,'pk-sm'],[/^(?:swsh|cel25$|pgo)/i,'pk-swsh'],[/^(?:sv|me)/i,'pk-sv']];
export function pokemonFrame(c){
 const set=c?.set?.id||'',base=PK_FRAME_ERAS.find(([re])=>re.test(set))?.[1],category=norm(c?.category||'Pokemon'),stage=norm(c?.stage);
 if(!base||(set==='cel25'&&ANNIVERSARY_MAPS[c.id]))return '';
 // EX-era Pokémon-ex and Gold Star fronts have their own unmeasured layouts.
 if(/^pk-ex[ab]$/.test(base)&&/(?:\sex|☆|\sStar)$/i.test(c?.name||''))return '';
 // Promo Trainers often use special layouts; only expansion Trainer frames were measured.
 if(category==='trainer')return /p$/i.test(set)?'':base+'-trainer';
 if(category!=='pokemon')return '';
 // A missing stage keeps the Basic window: it never invents an evolution cut-out.
 return ['','basic','baby'].includes(stage)?base:['stage1','stage2'].includes(stage)?base+'-evolved':'';
}
function effectFor(game,c,key,label,ctx,physicalFinish){
 if(physicalFinish==='nonfoil')return paper(key,label);
 const face=Number(ctx.face||0),override=exactOverride(game,c,key,face);
 if(override)return preset(key,label,override.effectPreset||'custom',override.layers,override.source,override.status);
 if(game==='mtg'){
  // Face-wide traditional foil is safe on supported portrait layouts; etched needs its own frame.
  const layout=c.layout||'normal';
  // Every portrait layout prints its foil across the whole face. Planes and Battles are printed sideways
  // and stay unmasked until measured.
  if(!['normal','transform','modal_dfc','adventure','leveler','saga','class','token','double_faced_token','split','flip','meld','mutate','prototype','case','host','augment','emblem','art_series','reversible_card','prepare','front_card'].includes(layout))return unknown(key,label);
  if(face && !c.card_faces?.[face]?.image_uris)return unknown(key,label);
  // Full-size cards draw the printing's own treatment (old-border, surge, galaxy, oil slick...) with
  // WebGL (mtg-foil.js), chosen from its Scryfall data; the CSS layer stays as the light fallback.
  if(physicalFinish==='foil'){const treatment=mtgFoilEffect(c,'foil');return {...preset(key,treatment==='mtg-traditional'?label:MTG_FOIL_RECIPES[treatment].label,'mtg-foil',[layer('card','rainbow')],FINISH_SOURCES.scryfall),treatment,frame:mtgFrameKey(c),...(mtgHoloStamp(c)?{holostamp:true}:{})};}
  if(physicalFinish==='etched'&&c.id==='3305c70f-188a-4c01-b605-d583ded84e18'&&c.set==='nec'&&String(c.collector_number)==='77'&&c.layout==='normal'&&face===0&&['legendary','inverted','etched'].every(x=>c.frame_effects?.includes(x))&&!c.full_art&&!c.borderless)return {...preset(key,label,'mtg-nec77-etched',[layer('mtg-nec77-metal','metal')],'https://magic.wizards.com/en/news/feature/kamigawa-neon-dynasty-product-overview-2022-01-27'),reason:'Simulated foil-etched finish · approximate metallic coverage'};
  if(physicalFinish==='etched'&&['cmr','clb'].includes(c.set)&&layout==='normal'&&!c.borderless&&!c.full_art&&!c.frame_effects?.some(x=>['showcase','extendedart'].includes(x)))return {...preset(key,label,'mtg-etched',[layer('mtg-frame','metal')],FINISH_SOURCES.etched),treatment:'mtg-etched',frame:'2015'};
  // Every other etched printing (Secret Lair, Mystical Archive, showcase, inverted, retro frames) draws the
  // etched treatment over its own frame era. Only Commander Legends frames were measured, so the CSS
  // fallback here frosts the whole face rather than borrowing that frame's coverage.
  // Borderless etched cards have no frame to frost, so the etching covers the whole face.
  if(physicalFinish==='etched'){const frame=mtgFrameKey(c);return {...preset(key,label,'mtg-etched',[layer('card','metal')],FINISH_SOURCES.etched),treatment:frame==='borderless'?'mtg-etched-full':'mtg-etched',frame};}
  return unknown(key,label);
 }
 if(game==='ptcg'){
  const set=c.set?.id||'',rarity=norm(c.rarity),category=norm(c.category||'Pokemon');
  // Anniversary reprints retain several different original-era layouts. Never
  // route them through an era prefix or a name-based full-card fallback.
  if(/^(?:cel25cc|cel25c|30th-c|30th)$/.test(set)||(set==='cel25'&&ANNIVERSARY_MAPS[c.id])){
   const mapped=ANNIVERSARY_MAPS[c.id],variant=c.variants?.find(v=>v.key===key),image=variant?.imageLarge||variant?.image||c.imageLarge||c.image||'';
   const entry=[mapped,...(mapped?.alternates||[])].find(p=>p?.images.includes(image.split('?')[0]))||mapped;
   // The 30th Classic catalogue's gallery URLs are unavailable/card-back
   // references; artworkSources already falls through to the exact product route.
   const fallback=set==='30th-c'&&image===`https://images.pokemontcg.io/me55c/${Number(c.id.split('-').at(-1))}_hires.png`;
   if(physicalFinish!=='holofoil'||!entry||(!fallback&&!entry.images.includes(image.split('?')[0])))return unknown(key,label);
   // Classic Collection reprints are printed in Confetti holofoil, not their original era's foil.
   return {...preset(key,label,entry.effect,[layer(entry.mask,entry.effect==='ptcg-full-art'?'rainbow':'holo')],entry.source),imageSources:entry.images,reason:'Simulated finish · measured reference-art window; anniversary mark excluded',...(set==='cel25cc'&&entry.effect==='ptcg-holo'?{pattern:'confetti'}:{})};
  }
  // Ancient Mew (2000 movie promo): its holo is a full-card speckle, flecks of foil edge to edge with no
  // art window. No provider has an image, so we ship a scan (assets/cards/miscp-001.webp).
  if(c.id==='miscp-001'&&physicalFinish==='holofoil')return {...preset(key,label,'ptcg-holo',[layer('card','holo')],'https://www.cardtrader.com/en/cards/152261'),pattern:'ancient',reason:'Simulated finish · full-card speckle holo'};
  // Exact Expedition Alakazam layout shown by the user; standard and jumbo retain separate keys.
  if(set==='ecard1'&&['ecard1-1','ecard1-33'].includes(c.id)){
   if(physicalFinish==='holofoil')return preset(key,label,'ptcg-expedition-holo',[layer('pk-expedition-art','holo')],FINISH_SOURCES.expedition);
   if(physicalFinish==='reverse-holofoil')return {...preset(key,label,'ptcg-expedition-reverse',[layer('pk-expedition-field','rainbow')],FINISH_SOURCES.expedition),reason:'Simulated reverse holo · partial coverage'};
  }
  // Base Set standard holo Pokemon have this illustration-only layout. Exclude promos/reprints.
  if(set==='base1'&&/^base1-(?:[1-9]|1[0-6])$/.test(c.id)&&physicalFinish==='holofoil'){
   // Fit the displayed scan, not the commercial edition label. The provider
   // currently shares one reference image across its Base Set edition choices.
   const variant=c.variants?.find(v=>v.key===key),image=variant?.imageLarge||variant?.image||c.imageLarge||c.image||'';
   const number=c.id.slice(6),prefix=`https://assets.tcgdex.net/en/base/base1/${number}/`;
   const traced=image.startsWith(prefix)&&/^(?:high|low)\.webp(?:[?#]|$)/.test(image.slice(prefix.length));
   const mask=traced?`pk-${c.id}-tcgdex-art`:c.id==='base1-4'?'pk-base1-4-art':'pk-base-art';
   return preset(key,label,'ptcg-holo',[layer(mask,'holo')],traced?image:FINISH_SOURCES.base);
  }
  if(set==='base4'&&c.id==='base4-20'&&physicalFinish==='holofoil')return preset(key,label,'ptcg-holo',[layer('pk-base4-20-art','holo')],'https://api.tcgdex.net/v2/en/cards/base4-20');
  if(set==='neo1'&&c.id==='neo1-9'&&physicalFinish==='holofoil')return {...preset(key,label,'ptcg-holo',[layer('pk-neo1-9-art','holo')],'https://api.tcgdex.net/v2/en/cards/neo1-9'),reason:'Simulated illustration-window holo'};
  // Finish availability is still source-supplied. Layout identifies where that
  // known finish catches the light; it never adds a variant or a price.
  const fullArt=/fullart|illustration|rainbow|shinyvmax|shinyv|secret|hyperrare|ultrarare/.test(rarity)||/^(vmax|vstar)$/i.test(c.stage||'')||(!/^ex\d/.test(set)&&/\s(?:V|GX|EX|ex|VMAX|VSTAR|V-UNION)$/.test(c.name||''));
  if(physicalFinish==='holofoil'&&fullArt){
   const textured=/specialillustration|shiny.*vmax|rainbow|fullart|ultrarare|rareultra|hyperrare/.test(rarity)||/^vmax$/i.test(c.stage||'');
   const gold=/^(sv|me)/i.test(set)&&rarity==='hyperrare';
   return {...preset(key,label,'ptcg-full-art',[layer('card',gold?'gold':'rainbow'),...(textured?[layer('card','micro')]:[])],FINISH_SOURCES.pokemon),coverage:'full',texture:textured?'micro-ridges':'smooth'};
  }
  if(set==='sm11'&&c.id==='sm11-4'&&!fullArt&&physicalFinish==='holofoil')return preset(key,label,'ptcg-holo',[layer('pk-sm11-4-art','holo')],'https://api.tcgdex.net/v2/en/cards/sm11-4');
  // LV.X fronts carry their foil across the whole silver frame, not one window.
  if(category==='pokemon'&&/^(?:dp|pl|hgss|col)/i.test(set)&&(norm(c.stage)==='levelup'||/lvx/.test(rarity))&&physicalFinish==='holofoil')return {...preset(key,label,'ptcg-holo',[layer('card','holo')],FINISH_SOURCES.pokemon),coverage:'full',reason:'Simulated LV.X holo · whole-card approximate coverage'};
  if(c.id==='swsh3-161'&&set==='swsh3'&&category==='trainer'&&physicalFinish==='reverse-holofoil')return {...preset(key,label,'ptcg-reverse',[layer('pk-swsh-trainer-field','rainbow')],'https://api.tcgdex.net/v2/en/cards/swsh3-161'),reason:'Simulated reverse holo · partial coverage',coverage:'partial'};
  // Energy cards have no measured frame: their foil covers the whole face (approximate).
  if(category==='energy'&&['holofoil','reverse-holofoil'].includes(physicalFinish))return {...preset(key,label,physicalFinish==='holofoil'?'ptcg-holo':'ptcg-reverse',[layer('card',physicalFinish==='holofoil'?'holo':'rainbow')],FINISH_SOURCES.pokemon),coverage:'full',reason:'Simulated finish · whole-card approximate coverage'};
  const frame=fullArt?'':pokemonFrame(c);
  if(frame&&physicalFinish==='holofoil')return preset(key,label,'ptcg-holo',[layer(set==='cel25'&&frame==='pk-swsh'?'pk-cel-art':frame+'-art','holo')],FINISH_SOURCES.pokemon);
  if(frame&&physicalFinish==='reverse-holofoil')return preset(key,label,'ptcg-reverse',[layer(frame+'-surround',/^sv/i.test(set)?'tiles':'rainbow')],/^pk-sm(?:-evolved)?$/.test(frame)?'https://api.tcgdex.net/v2/en/cards/sm11-6':FINISH_SOURCES.pokemon);
  // Energy, BREAK, Restored and other special layouts stay unmasked until measured.
  return unknown(key,label);
 }
 const rarity=norm(key),frameText=`${c.typeLine||''} ${c.type||''} ${c.frame||''}`;
 // Tokens share the standard monster layout; Pendulum and Skill cards have their own measured art
 // windows. Rush Duel cards are not catalogued here and stay unmasked.
 if(/rush/i.test(frameText))return unknown(key,label);
 const layout=/pendulum/i.test(frameText)?'pendulum':/skill/i.test(frameText)?'skill':'standard',artMask=layout==='standard'?'ygo-art':'ygo-art-'+layout;
 // Level/Rank stars and the Attribute icon are foil on some rarities: holo on Super and Ultra Rares printed
 // from Breakers of Shadow (Feb 2016), rainbow on modern Secret Rares, gold on Gold Rares, embossed on Ultimate (and Starlight's
 // whole-card glitter). Older Super/Ultra printings, or an unknown print date, keep plain stars.
 const printed=String(c.setContext?.date||ctx.releaseDate||''),modern=printed>=YGO_MODERN_FROM;
 const starFoil=/^(ultimaterare|starlightrare)$/.test(rarity)?1:/^(superrare|ultrarare|ultrararepharaohsrare)$/.test(rarity)?(modern?2:0):/secret/.test(rarity)&&!/gold|platinum|quartercentury/.test(rarity)?(modern?3:0):/gold/.test(rarity)?4:0;
 const withLayout=p0=>{const p=starFoil?{...p0,stars:starFoil}:p0;return layout==='standard'?p:{...p,layout};};
 const name=material=>layer('ygo-name',material),art=material=>layer(artMask,material);
 const specs={rare:['ygo-rare',[name('silver')]],superrare:['ygo-super',[art('holo')]],ultrarare:['ygo-ultra',[art('holo'),name('gold')]],secretrare:['ygo-secret',[art('secret'),name('rainbow')]],prismaticsecretrare:['ygo-prismatic',[art('prismatic'),name('rainbow')]],starlightrare:['ygo-starlight',[layer('ygo-broad','starlight')]]};
 if(specs[rarity])return withLayout(preset(key,label,...specs[rarity],FINISH_SOURCES.ygo));
 // Every other foil rarity comes from the recipe table. Its CSS layers are the light version shown
 // on small tiles; full-size cards render the recipe itself with WebGL (ygo-rarity-foil.js).
 const effect=ygoSetEffect(ygoRarityEffect(rarity),{code:c.setContext?.code,date:printed}),recipe=YGO_FOIL_RECIPES[effect];if(!recipe)return unknown(key,label);
 const P=FOIL_PATTERN,material=([p,t])=>t===1?'gold':{[P.diag]:'secret',[P.qcr]:'secret',[P.prism]:'prismatic',[P.glitter]:'starlight',[P.ghost]:'silver',[P.emboss]:'gold'}[p]||'holo';
 const layers=[...(recipe.whole?[layer('ygo-broad',recipe.whole[0]===P.glitter?'starlight':'rainbow')]:[]),...(recipe.art?[art(material(recipe.art))]:[]),...(recipe.frame&&!recipe.whole?[layer('ygo-broad',material(recipe.frame))]:[]),...(recipe.name?[name(recipe.name)]:[])];
 return withLayout(preset(key,label,effect,layers,FINISH_SOURCES.ygo));
}
export function finishChoices(game,c,ctx={}){
 if(!c?.id||!validSetContext(game,c,ctx))return [];
 if(game==='mtg')return ['nonfoil','foil','etched'].filter(key=>c.finishes?.includes(key)).map(key=>effectFor(game,c,key,{nonfoil:'Nonfoil',foil:'Traditional foil',etched:'Etched foil'}[key],ctx,key));
 if(game==='ptcg')return pokemonVariantChoices(c,requestedVariant(c,ctx)).filter(v=>v.key).map(v=>{
  const finish=variantFinish(v);
  // A pattern name on a nonfoil printing describes nothing that shines.
  if(finish==='nonfoil')return effectFor(game,c,v.key,v.label||v.key,ctx,finish);
  // TCGdex calls the classic WotC starlight holo "galaxy": that is the era's own holo, not a separate sheet.
  if(v.foil==='galaxy')v={...v,foil:''};
  // Pattern metadata is real identity, not permission to fake a generic texture.
  // Keep the selectable variant while its distinct physical pattern is unsupported.
  if(reviewedCosmosPreview(c,v))return {...preset(v.key,v.label,'ptcg-holo',[layer('pk-swsh-art','holo')],'https://api.tcgdex.net/v2/en/cards/'+c.id),pattern:'cosmos',materialProfile:'cosmos-holo'};
  // Measured ordinary frames give Cosmos an illustration window. This is an
  // approximate preview, not exact-printing art or authentication of a
  // physical foil. Other patterns/layouts stay explicit.
  // Promos and stamped printings keep the same illustration window; the stamp is printed over it.
  const cosmosFrame=['Pokemon','Trainer'].includes(c.category)?pokemonFrame(c):'';
  if(v.foil==='cosmos'&&finish==='holofoil'&&v.size==='standard'&&!v.subtype&&cosmosFrame)
   return {...preset(v.key,v.label,'ptcg-holo',[layer(cosmosFrame+'-art','holo')],'https://api.tcgdex.net/v2/en/cards/'+c.id),pattern:'cosmos',materialProfile:'cosmos-holo',reason:'Simulated Cosmos holo · approximate illustration-window coverage'};
  // Patterned reverse holos (Poké Ball, Master Ball, Cosmos) foil the measured surround with their own
  // sheet; gold holos keep their measured full-art coverage in gold. Other patterns stay explicit.
  // Ball sheets (Poké, Great, Dusk, Friend, Love, Quick...), Master Ball, Cosmos and emblem sheets (energy symbols,
  // League and set logos). Energy cards have no measured surround, so their sheet covers the whole face.
  const sheet=['masterball','cosmos','energy','league','set-logo','team-rocket','cracked-ice','tinsel'].includes(v.foil)||/ball$/.test(v.foil||'');
  const reverseFrame=sheet&&finish==='reverse-holofoil'&&v.size!=='jumbo'&&!v.subtype?pokemonFrame(c)||(c.category==='Energy'?'card':''):'';
  if(reverseFrame)return {...preset(v.key,v.label,'ptcg-reverse',[layer(reverseFrame==='card'?'card':reverseFrame+'-surround','rainbow')],'https://api.tcgdex.net/v2/en/cards/'+c.id),pattern:v.foil,reason:reverseFrame==='card'?'Simulated reverse holo · whole-card approximate coverage':'Simulated reverse holo · partial coverage'};
  // Rainbow-sheet printings are the Rainbow Rare full-art treatment.
  if(v.foil==='rainbow'&&finish==='holofoil')return {...preset(v.key,v.label,'ptcg-full-art',[layer('card','rainbow'),layer('card','micro')],FINISH_SOURCES.pokemon),coverage:'full',texture:'micro-ridges',pattern:'rainbow'};
  // Cracked Ice sits in the illustration window of the measured frame.
  const iceFrame=v.foil==='cracked-ice'&&finish==='holofoil'?pokemonFrame(c):'';
  if(iceFrame)return {...preset(v.key,v.label,'ptcg-holo',[layer(iceFrame+'-art','holo')],'https://api.tcgdex.net/v2/en/cards/'+c.id),pattern:'cracked-ice'};
  if(v.foil==='gold'&&finish==='holofoil'){const gold=effectFor(game,c,v.key,v.label||v.key,ctx,finish);if(gold.status!=='unknown')return {...gold,pattern:'gold'};}
  // Known patterns on a measured frame keep that frame's window, with the sheet named.
  const placed=finish&&!['holofoil','reverse-holofoil'].includes(finish)?null:finish?effectFor(game,c,v.key,v.label||v.key,ctx,finish):null;
  if(placed&&placed.status!=='unknown')return v.foil?{...placed,pattern:v.foil}:placed;
  // A foil printing whose layout has no measured window (EX-era Pokémon-ex and Gold Star, World Championship
  // decks, jumbo and special promos) still shines: its sheet covers the whole face, marked approximate.
  if(['holofoil','reverse-holofoil'].includes(finish))return {...preset(v.key,v.label||v.key,finish==='holofoil'?'ptcg-holo':'ptcg-reverse',[layer('card',finish==='holofoil'?'holo':'rainbow')],'https://api.tcgdex.net/v2/en/cards/'+c.id),coverage:'full',...(v.foil?{pattern:v.foil}:{}),reason:'Simulated finish · whole-card approximate coverage'};
  // Preserve a known variant even when its finish cannot be previewed.
  return finish?effectFor(game,c,v.key,v.label||v.key,ctx,finish):unknown(v.key,v.label||v.key);
 }).map(p=>withPtcgTreatment(c,p)).map(p=>{const profiles=ANNIVERSARY_STAMPS[c.id];return profiles?{...p,overlayProfiles:profiles,imageSources:[...new Set(profiles.flatMap(x=>x.images))]}:p;}).map(p=>withPrintedStamp(c,p));
 if(game==='ygo'){
  const printing=quoteForContext(game,c,ctx)?.printing;
  if(!printing?.rarity)return [];
  // Short Prints and Super Short Prints are Commons printed in smaller numbers: no foil.
  return [effectFor(game,c,printing.rarity,printing.rarity,ctx,/^(?:common|shortprint|supershortprint)$/.test(norm(printing.rarity))?'nonfoil':printing.rarity)];
 }
 return [];
}
// Full-size Pokémon cards draw the era's or variant's own foil sheet with WebGL (ptcg-foil.js) over the
// same measured mask as the CSS layer; the CSS layer stays as the light fallback.
const PK_MASK_ERA=[[/^pk-(?:base|wotc)/,'pk-wotc'],[/^pk-gym/,'pk-gym'],[/^pk-neo/,'pk-neo'],[/^pk-lc/,'pk-lc'],[/^pk-(?:ecard|expedition)/,'pk-ecard'],[/^pk-exa/,'pk-exa'],[/^pk-exb/,'pk-exb'],[/^pk-dppt/,'pk-dppt'],[/^pk-hgss/,'pk-hgss'],[/^pk-bwxy/,'pk-bwxy'],[/^pk-sm/,'pk-sm'],[/^pk-(?:swsh|cel-)/,'pk-swsh'],[/^pk-sv/,'pk-sv']];
// The printing's TCGdex set id and number pick the set's own foil sheet. Saved rows may carry only
// the card id (set-id plus number), so read them from it when the set object is absent.
const ptcgPrint=c=>{const m=String(c?.id||'').match(/^(.+)-([^-]+)$/);return {set:c?.set?.id||m?.[1]||'',number:c?.set?.number??c?.localId??m?.[2]??''};};
export function withPtcgTreatment(c,p){
 if(!p||p.status==='unknown'||p.effect==='plain'||!p.layers?.length)return p;
 const mask=p.layers[0].mask,era=PK_MASK_ERA.find(([re])=>re.test(mask))?.[1]||'',fullArt=p.effect==='ptcg-full-art'||p.coverage==='full';
 const finish=p.effect==='ptcg-reverse'?'reverse-holofoil':'holofoil',gold=p.layers.some(l=>l.material==='gold')||p.pattern==='gold';
 const treatment=ptcgFoilEffect({finish,era:fullArt?'':era,foil:p.pattern||'',rarity:c?.rarity,fullArt,textured:p.texture==='micro-ridges',gold,...ptcgPrint(c)});
 return treatment&&PTCG_FOIL_RECIPES[treatment]?{...p,treatment}:p;
}
// A pricing reference is not a physical finish or an edition selection.
const requestedVariant=(c,ctx)=>[ctx.priceFinish,ctx.finish,ctx.setVariant,c?.setContext?.variantKey].find(key=>key&&key!=='reference')||'';
function commonPokemonPresentation(c,choices){
 if(!choices.length||choices.some(p=>p.status==='unknown'))return null;
 const variants=new Map((c.variants||[]).map(v=>[v.key,v]));
 const physical=choices.map(p=>variantFinish(variants.get(p.key)||{}));
 if(!physical[0]||physical.some(f=>f!==physical[0]))return null;
 const signature=p=>JSON.stringify([p.effect,p.layers,p.coverage||'',p.texture||'',p.materialProfile||'',p.pattern||'',p.overlayProfiles||null,p.imageSources||null]);
 if(choices.some(p=>signature(p)!==signature(choices[0])))return null;
 // Share only presentation. A blank key must not mark a commercial edition
 // selected, substitute its image, or leak into owned lots and price quotes.
 const first=choices[0],status=choices.every(p=>p.status==='verified')?'verified':'approximate';
 const label={nonfoil:'Nonfoil',holofoil:'Holofoil','reverse-holofoil':'Reverse holo'}[physical[0]]||physical[0];
 return {...first,key:'',label,status,sharedFinish:true,physicalFinish:physical[0],
  reason:physical[0]==='nonfoil'?'Nonfoil · no simulated shine':`${label} · shared finish preview; edition not selected${status==='approximate'?' · approximate coverage':''}`};
}
export function resolveFinish(game,c,ctx={}){
 if(game==='ptcg'&&ctx.savedProductId&&requestedVariant(c,ctx)===ctx.savedVariant&&pokemonVariantProductConflict(c,{variant:ctx.savedVariant,productId:ctx.savedProductId}))return {...unknown(ctx.savedVariant,'Saved product identity mismatch'),game,printingId:c?.id||'',face:Number(ctx.face||0),reason:'Saved product does not match this finish. Choose a verified version to browse.'};
 const choices=finishChoices(game,c,ctx),wanted=game==='ptcg'?requestedVariant(c,ctx):(ctx.priceFinish||ctx.finish||c?.setContext?.variantKey);
 // Invalid/unsupported explicit selections must never borrow another variant.
 let selected=choices.find(x=>x.key===wanted);
 if(game==='ygo')selected=choices[0];
 else if(!wanted){
  if(game==='ptcg'){
   // Browse-only preference: an ordinary, source-supported Holofoil option.
   // Never auto-select a stamped/patterned/edition-specific version or mutate
   // the price/add context. Explicit owned finishes above always win.
   const regular=c?.variants?.find(v=>v.key==='holofoil'&&variantFinish(v)==='holofoil'&&!v.foil&&!v.subtype&&!v.stamps?.length&&(!v.size||v.size==='standard'));
   const holo=regular&&choices.find(p=>p.key===regular.key&&p.status!=='unknown');
   selected=holo?{...holo,browseDefault:true,reason:'Holofoil preview · confirm your finish when adding'}:commonPokemonPresentation(c,choices);
  }
  else selected=choices.find(x=>x.key==='nonfoil')||(choices.length===1?choices[0]:null);
 }
 return {...(selected||unknown(wanted||ctx.priceFinish||'')),game,printingId:c?.id||'',face:Number(ctx.face||0)};
}
export const finishEffect=(game,c,ctx={})=>resolveFinish(game,c,ctx).effect;
// Mutates view context only, never a card, owned lot or saved state.
export function selectPreviewFinish(game,card,ctx,key){
 if(game==='ygo'||!finishChoices(game,card,ctx).some(x=>x.key===key))return false;
 ctx.priceFinish=key;
 if(game==='ptcg')ctx.setVariant=key;
 return true;
}

export function finishArtworkCard(game,c,ctx={}){
 if(game!=='ptcg'||!c||!validSetContext(game,c,ctx))return c;
 const key=requestedVariant(c,ctx);
 const variant=c.variants?.find(v=>v.key===key);
 return variant?.image||variant?.imageLarge?{...c,image:variant.image||variant.imageLarge,imageLarge:variant.imageLarge||variant.image}:c;
}

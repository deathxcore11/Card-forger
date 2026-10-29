package cardstashy.forge;
import forge.deck.*;
import forge.game.*;
import forge.game.player.RegisteredPlayer;
import forge.model.FModel;
import java.util.*;
/** Selects existing native format/deck rules; contains no independent Magic legality rules. */
public enum NativeMatchFormat {
 Commander(DeckFormat.Commander,GameType.Commander),
 Standard(DeckFormat.Constructed,GameType.Constructed),
 Modern(DeckFormat.Constructed,GameType.Constructed),
 Pioneer(DeckFormat.Constructed,GameType.Constructed),
 Legacy(DeckFormat.Constructed,GameType.Constructed),
 Vintage(DeckFormat.Constructed,GameType.Constructed),
 Pauper(DeckFormat.Constructed,GameType.Constructed),
 Brawl(DeckFormat.Brawl,GameType.Brawl);
 final DeckFormat deckFormat;final GameType gameType;
 NativeMatchFormat(DeckFormat d,GameType g){deckFormat=d;gameType=g;}
 static NativeMatchFormat parse(String name){try{return valueOf(name);}catch(RuntimeException e){throw NativeDeckInput.fail("format_not_supported");}}
 static boolean supported(String name){return Arrays.stream(values()).anyMatch(f->f.name().equals(name));}
 boolean commander(){return deckFormat.hasCommander();}
 // Native two-player Brawl variant: commanders plus 25 life.
 RegisteredPlayer register(Deck deck){return this==Commander?RegisteredPlayer.forCommander(deck):this==Brawl?RegisteredPlayer.forVariants(2,variants(),deck,null,false,null,null):new RegisteredPlayer(deck);}
 EnumSet<GameType> variants(){return commander()?EnumSet.of(gameType):EnumSet.noneOf(GameType.class);}
 GameFormat pool(){GameFormat p=FModel.getFormats().get(name());if(p==null)throw NativeDeckInput.fail("native_format_definition_missing");return p;}
 Map<String,Object> definition(){
  GameFormat p=pool();return NativeDeckInput.map("name",name(),"type",p.getFormatType().name(),"subtype",p.getFormatSubType().name(),"allowedSets",new TreeSet<>(p.getAllowedSetCodes()),"banned",new TreeSet<>(p.getBannedCardNames()),"restricted",new TreeSet<>(p.getRestrictedCards()),"additional",new TreeSet<>(p.getAdditionalCards()),"deckFormat",deckFormat.name(),"gameType",gameType.name());
 }
 static int count(Deck deck,DeckSection section){return deck.get(section)==null?0:deck.get(section).countAll();}
}

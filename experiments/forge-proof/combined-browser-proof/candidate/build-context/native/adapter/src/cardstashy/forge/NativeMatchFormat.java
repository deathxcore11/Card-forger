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
 Modern(DeckFormat.Constructed,GameType.Constructed);
 final DeckFormat deckFormat;final GameType gameType;
 NativeMatchFormat(DeckFormat d,GameType g){deckFormat=d;gameType=g;}
 static NativeMatchFormat parse(String name){try{return valueOf(name);}catch(RuntimeException e){throw NativeDeckInput.fail("format_not_supported");}}
 static boolean supported(String name){return Arrays.stream(values()).anyMatch(f->f.name().equals(name));}
 boolean commander(){return this==Commander;}
 RegisteredPlayer register(Deck deck){return commander()?RegisteredPlayer.forCommander(deck):new RegisteredPlayer(deck);}
 EnumSet<GameType> variants(){return commander()?EnumSet.of(GameType.Commander):EnumSet.noneOf(GameType.class);}
 GameFormat pool(){GameFormat p=FModel.getFormats().get(name());if(p==null)throw NativeDeckInput.fail("native_format_definition_missing");return p;}
 Map<String,Object> definition(){
  GameFormat p=pool();return NativeDeckInput.map("name",name(),"type",p.getFormatType().name(),"subtype",p.getFormatSubType().name(),"allowedSets",new TreeSet<>(p.getAllowedSetCodes()),"banned",new TreeSet<>(p.getBannedCardNames()),"restricted",new TreeSet<>(p.getRestrictedCards()),"additional",new TreeSet<>(p.getAdditionalCards()),"deckFormat",deckFormat.name(),"gameType",gameType.name());
 }
 static int count(Deck deck,DeckSection section){return deck.get(section)==null?0:deck.get(section).countAll();}
}

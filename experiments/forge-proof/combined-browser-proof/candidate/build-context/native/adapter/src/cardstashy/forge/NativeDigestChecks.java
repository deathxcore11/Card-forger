package cardstashy.forge;
import com.google.gson.*;
import java.nio.file.*;
public class NativeDigestChecks {
 public static void main(String[]args)throws Exception{
  for(String line:Files.readAllLines(Path.of(args[0]))){JsonObject c=JsonParser.parseString(line).getAsJsonObject();String actual=NativeDeckInput.canonical(c.get("input")),expected=c.get("canonical").getAsString();if(!actual.equals(expected))throw new AssertionError("canonical mismatch "+actual+" vs "+expected);}
  System.out.println("PASS Java/JavaScript canonical JSON cross-language corpus");
 }
}

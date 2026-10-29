package cardstashy.forge;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;

/** Java 11-17 library calls the bridge makes that Android before 14 does not have
 * (D8 back-ports List.of, String.isBlank and the like, but not these). */
public final class Jdk {
    private Jdk() {}
    private static final char[] HEX = "0123456789abcdef".toCharArray();
    /** HexFormat.of().formatHex(bytes). */
    public static String hex(byte[] bytes) {
        char[] out = new char[bytes.length * 2];
        for (int i = 0; i < bytes.length; i++) { out[2 * i] = HEX[(bytes[i] >> 4) & 15]; out[2 * i + 1] = HEX[bytes[i] & 15]; }
        return new String(out);
    }
    /** in.readNBytes(limit). */
    public static byte[] readN(InputStream in, int limit) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream(Math.min(limit, 1 << 16));
        byte[] buffer = new byte[8192];
        for (int n; out.size() < limit && (n = in.read(buffer, 0, Math.min(buffer.length, limit - out.size()))) > 0; ) out.write(buffer, 0, n);
        return out.toByteArray();
    }
    /** in.readAllBytes(). */
    public static byte[] readAll(InputStream in) throws IOException { return readN(in, Integer.MAX_VALUE); }
}

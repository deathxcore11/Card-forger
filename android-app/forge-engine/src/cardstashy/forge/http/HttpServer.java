package cardstashy.forge.http;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;

/** Stand-in for com.sun.net.httpserver.HttpServer. It opens no port: the app calls
 * {@link #dispatch} directly, so nothing else on the phone can reach the engine. */
public final class HttpServer {
    private static volatile HttpServer latest;
    private final Map<String, HttpHandler> routes = new ConcurrentHashMap<>();

    public static HttpServer create(InetSocketAddress address, int backlog) { HttpServer s = new HttpServer(); latest = s; return s; }
    /** The server the bridge created most recently (the bridge keeps no reference to hand out). */
    public static HttpServer latest() { return latest; }
    public void setExecutor(Executor executor) {}
    public void createContext(String path, HttpHandler handler) { routes.put(path, handler); }
    public void start() {}

    public record Reply(int status, String body) {}

    public Reply dispatch(String method, String path, String authorization, String body) throws IOException {
        HttpHandler handler = routes.get(path);
        if (handler == null) return new Reply(404, "{\"error\":\"route_not_found\"}");
        HttpExchange x = new HttpExchange(method, authorization, body == null ? null : body.getBytes(StandardCharsets.UTF_8));
        handler.handle(x);
        return new Reply(x.status(), new String(x.responseBytes(), StandardCharsets.UTF_8));
    }
}

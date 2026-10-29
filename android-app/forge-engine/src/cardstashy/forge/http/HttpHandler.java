package cardstashy.forge.http;

import java.io.IOException;

/** Stand-in for com.sun.net.httpserver.HttpHandler, which Android does not have. */
public interface HttpHandler { void handle(HttpExchange exchange) throws IOException; }

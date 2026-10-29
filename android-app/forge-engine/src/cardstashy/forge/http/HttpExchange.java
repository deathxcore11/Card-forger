package cardstashy.forge.http;

import java.io.*;

/** One in-memory request to the bridge, answered without a socket. */
public final class HttpExchange {
    private final String method;
    private final Headers requestHeaders = new Headers(), responseHeaders = new Headers();
    private final InputStream body;
    private final ByteArrayOutputStream response = new ByteArrayOutputStream();
    private int status = -1;

    HttpExchange(String method, String authorization, byte[] body) {
        this.method = method;
        if (authorization != null) requestHeaders.set("Authorization", authorization);
        if (body != null) requestHeaders.set("Content-Type", "application/json");
        this.body = new ByteArrayInputStream(body == null ? new byte[0] : body);
    }
    public String getRequestMethod() { return method; }
    public Headers getRequestHeaders() { return requestHeaders; }
    public Headers getResponseHeaders() { return responseHeaders; }
    public InputStream getRequestBody() { return body; }
    public OutputStream getResponseBody() { return response; }
    public void sendResponseHeaders(int code, long length) { status = code; }
    public void close() {}
    int status() { return status; }
    byte[] responseBytes() { return response.toByteArray(); }
}

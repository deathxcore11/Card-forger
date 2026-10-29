package cardstashy.forge.http;

import java.util.*;

/** The subset of com.sun.net.httpserver.Headers the bridge uses. Names ignore case. */
public final class Headers {
    private final Map<String, List<String>> values = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
    public String getFirst(String name) { List<String> v = values.get(name); return v == null || v.isEmpty() ? null : v.get(0); }
    public void set(String name, String value) { values.put(name, new ArrayList<>(List.of(value))); }
    public void add(String name, String value) { values.computeIfAbsent(name, k -> new ArrayList<>()).add(value); }
    public Map<String, List<String>> asMap() { return Collections.unmodifiableMap(values); }
}

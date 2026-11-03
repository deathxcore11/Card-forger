package dev.cardstashy.nativeplay.account

import com.google.gson.JsonElement
import com.google.gson.JsonParser
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.zip.GZIPInputStream

/** Small JSON-over-HTTPS calls (accounts, decks, meta lists). Images go through Coil, not here. */
object Http {
    class Failure(val status: Int, val body: String) : IOException("http_$status")

    fun call(method: String, url: String, headers: Map<String, String> = emptyMap(), body: String? = null, timeoutMs: Int = 10000): JsonElement? {
        val c = URL(url).openConnection() as HttpURLConnection
        c.requestMethod = method; c.connectTimeout = timeoutMs; c.readTimeout = timeoutMs
        c.setRequestProperty("Accept", "application/json"); c.setRequestProperty("Accept-Encoding", "gzip")
        c.setRequestProperty("User-Agent", dev.cardstashy.nativeplay.art.CardArt.UA)
        headers.forEach { (k, v) -> c.setRequestProperty(k, v) }
        try {
            if (body != null) { c.doOutput = true; c.setRequestProperty("Content-Type", "application/json"); c.outputStream.use { it.write(body.toByteArray()) } }
            val code = c.responseCode
            val stream = (if (code in 200..299) c.inputStream else c.errorStream) ?: return null
            val text = (if ("gzip".equals(c.contentEncoding, true)) GZIPInputStream(stream) else stream).use { String(it.readBytes(), Charsets.UTF_8) }
            if (code !in 200..299) throw Failure(code, text.take(2000))
            return if (text.isBlank()) null else JsonParser.parseString(text)
        } finally { c.disconnect() }
    }
}

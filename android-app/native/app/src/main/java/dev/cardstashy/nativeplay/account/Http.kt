package dev.cardstashy.nativeplay.account

import com.google.gson.JsonElement
import com.google.gson.JsonParser
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

/** Small JSON-over-HTTPS calls (accounts, decks, Play progress, meta lists). Images go through Coil, not here. */
object Http {
    class Failure(val status: Int, val body: String) : IOException("http_$status")

    private val client by lazy { OkHttpClient.Builder().retryOnConnectionFailure(true).build() }
    private val JSON = "application/json".toMediaType()

    /** Any method, PATCH included (PostgREST's revision-checked update needs it). OkHttp handles gzip. */
    /** JVM tests only: answers every call in place of the network (method, url, body). */
    @Volatile internal var fake: ((String, String, String?) -> JsonElement?)? = null

    fun call(method: String, url: String, headers: Map<String, String> = emptyMap(), body: String? = null, timeoutMs: Int = 10000): JsonElement? {
        fake?.let { return it(method, url, body) }
        val req = Request.Builder().url(url)
            .header("Accept", "application/json").header("User-Agent", dev.cardstashy.nativeplay.art.CardArt.UA)
            .apply { headers.forEach { (k, v) -> header(k, v) } }
            .method(method, body?.toRequestBody(JSON) ?: if (method == "GET" || method == "HEAD") null else ByteArray(0).toRequestBody(JSON))
            .build()
        val c = client.newBuilder().callTimeout(timeoutMs.toLong(), TimeUnit.MILLISECONDS).build()
        c.newCall(req).execute().use { r ->
            val text = r.body?.string() ?: ""
            if (!r.isSuccessful) throw Failure(r.code, text.take(2000))
            return if (text.isBlank()) null else JsonParser.parseString(text)
        }
    }
}

package computer.daylight.folio.net

import computer.daylight.folio.data.Highlight
import computer.daylight.folio.data.Progress
import computer.daylight.folio.data.VoiceNote
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * HTTP v1 client. PowerSync is locked — do not add a sync SDK here.
 * Protocol: folio-native/1. See native/PROTOCOL.md.
 */
class FolioApi(
    private val origin: String,
    private val token: String,
) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private val jsonType = "application/json; charset=utf-8".toMediaType()

    fun configured(): Boolean = origin.isNotBlank()

    fun signedIn(): Boolean = token.isNotBlank()

    fun health(): JSONObject = get("/health")

    fun catalog(): JSONArray = get("/catalog").getJSONArray("books")

    fun pushProgress(p: Progress) {
        if (!signedIn()) return
        post(
            "/progress",
            JSONObject()
                .put("bookId", p.bookId)
                .put("chapterIndex", p.chapterIndex)
                .put("pageIndex", p.pageIndex)
                .put("percent", p.percent)
                .put("locator", p.locator)
                .put("updatedAt", p.updatedAt),
        )
    }

    fun pushHighlight(h: Highlight): String? {
        if (!signedIn()) return null
        val body = JSONObject()
            .put("id", h.id)
            .put("bookId", h.bookId)
            .put("chapterId", h.chapterId)
            .put("startOffset", h.startOffset)
            .put("endOffset", h.endOffset)
            .put("text", h.text)
            .put("note", h.note)
            .put("authorName", h.authorName)
        val res = post("/highlights", body)
        return res.optString("id").ifBlank { h.id }
    }

    fun pushVoice(v: VoiceNote): String? {
        if (!signedIn()) return null
        val body = JSONObject()
            .put("id", v.id)
            .put("highlightId", v.highlightId)
            .put("transcript", v.transcript)
            .put("audioB64", v.audioB64)
            .put("mime", v.mime)
            .put("durationMs", v.durationMs)
            .put("authorName", v.authorName)
            .put("replyTo", v.replyTo ?: JSONObject.NULL)
        val res = post("/voices", body)
        return res.optString("id").ifBlank { v.id }
    }

    fun snapshot(bookId: String): JSONObject? {
        if (!signedIn()) return null
        return get("/snapshot/${bookId}")
    }

    fun mergeSnapshotHighlights(obj: JSONObject): List<Highlight> {
        val arr = obj.optJSONArray("highlights") ?: return emptyList()
        val out = mutableListOf<Highlight>()
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            val tags = o.optJSONArray("tagIds")
            val tagIds = buildList {
                if (tags != null) for (t in 0 until tags.length()) add(tags.getString(t))
            }
            out += Highlight(
                id = o.getString("id"),
                bookId = o.getString("bookId"),
                chapterId = o.getString("chapterId"),
                startOffset = o.optInt("startOffset"),
                endOffset = o.optInt("endOffset"),
                text = o.optString("text"),
                note = o.optString("note"),
                createdAt = o.optString("createdAt"),
                tagIds = tagIds,
                authorId = o.optString("authorId"),
                authorName = o.optString("authorName"),
                clubId = o.optString("clubId").ifBlank { null },
                isCompanion = o.optBoolean("isCompanion"),
                dirty = false,
            )
        }
        return out
    }

    private fun url(path: String): String {
        val base = origin.trimEnd('/')
        return "$base/api/native/v1$path"
    }

    private fun get(path: String): JSONObject {
        val req = Request.Builder().url(url(path)).apply { headers() }.get().build()
        client.newCall(req).execute().use { res ->
            val text = res.body?.string().orEmpty()
            if (!res.isSuccessful) throw ApiException(res.code, text)
            return JSONObject(text.ifBlank { "{}" })
        }
    }

    private fun post(path: String, body: JSONObject): JSONObject {
        val req = Request.Builder()
            .url(url(path))
            .apply { headers() }
            .post(body.toString().toRequestBody(jsonType))
            .build()
        client.newCall(req).execute().use { res ->
            val text = res.body?.string().orEmpty()
            if (!res.isSuccessful) throw ApiException(res.code, text)
            return JSONObject(text.ifBlank { "{}" })
        }
    }

    private fun Request.Builder.headers() {
        header("X-Folio-Protocol", "folio-native/1")
        header("Accept", "application/json")
        if (token.isNotBlank()) header("Authorization", "Bearer $token")
    }
}

class ApiException(val code: Int, val body: String) : RuntimeException("native $code $body")

package computer.daylight.folio.data

import android.content.Context
import computer.daylight.folio.net.FolioApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

class FolioRepository(private val context: Context) {
    val db = FolioDb(context)

    init {
        db.seedLibrary(Catalog.entries(context))
        Catalog.book(context, ClubSeed.ALEXANDER_BOOK)?.let { db.seedTheo(it) }
    }

    fun powersyncLocked(): Boolean = db.meta("powersync", "locked") == "locked"

    fun origin(): String = db.meta("origin")
    fun token(): String = db.meta("token")

    fun setOrigin(v: String) = db.setMeta("origin", v.trim())
    fun setToken(v: String) = db.setMeta("token", v.trim())

    fun api(): FolioApi = FolioApi(origin(), token())

    fun library(): List<CatalogEntry> = db.library()
    fun book(id: String): Book? = Catalog.book(context, id)
    fun progress(id: String) = db.progress(id)
    fun allProgress() = db.allProgress()
    fun settings() = db.settings()
    fun saveSettings(s: FolioSettings) = db.saveSettings(s)
    fun highlights(bookId: String) = db.highlights(bookId)
    fun bookmarks(bookId: String) = db.bookmarks(bookId)
    fun voices(bookId: String) = db.voices(bookId)
    fun tags() = db.tags()

    fun saveProgress(p: Progress) = db.saveProgress(p)

    fun addHighlight(
        bookId: String,
        chapterId: String,
        start: Int,
        end: Int,
        text: String,
    ): Highlight {
        val h = Highlight(
            id = UUID.randomUUID().toString(),
            bookId = bookId,
            chapterId = chapterId,
            startOffset = start,
            endOffset = end,
            text = text,
            note = "",
            createdAt = nowIso(),
            tagIds = emptyList(),
            authorId = "local",
            authorName = "You",
            clubId = if (bookId == ClubSeed.ALEXANDER_BOOK) "alexander-local" else null,
            isCompanion = false,
            dirty = true,
        )
        db.insertHighlight(h)
        return h
    }

    fun updateHighlight(id: String, note: String?, tagIds: List<String>?) = db.updateHighlight(id, note, tagIds)

    fun deleteHighlight(id: String) = db.deleteHighlight(id)

    fun addBookmark(bookId: String, chapterIndex: Int, pageIndex: Int, label: String): Bookmark {
        val b = Bookmark(UUID.randomUUID().toString(), bookId, chapterIndex, pageIndex, label, nowIso(), true)
        db.insertBookmark(b)
        return b
    }

    fun deleteBookmark(id: String) = db.deleteBookmark(id)

    fun addVoice(highlightId: String, transcript: String, audioB64: String, mime: String, durationMs: Int): VoiceNote {
        val v = VoiceNote(
            id = UUID.randomUUID().toString(),
            highlightId = highlightId,
            transcript = transcript,
            audioB64 = audioB64,
            audioUrl = "",
            mime = mime,
            durationMs = durationMs,
            createdAt = nowIso(),
            authorId = "local",
            authorName = "You",
            replyTo = null,
            clubId = "alexander-local",
            isCompanion = false,
            dirty = true,
        )
        db.insertVoice(v)
        return v
    }

    suspend fun pullAndPush(bookId: String): String = withContext(Dispatchers.IO) {
        val api = api()
        if (!api.configured()) return@withContext "no origin — local only"
        if (!api.signedIn()) return@withContext "no session — catalog is offline"
        check(powersyncLocked()) { "PowerSync must stay locked" }
        try {
            val snap = api.snapshot(bookId)
            if (snap != null) {
                val remote = api.mergeSnapshotHighlights(snap)
                remapTheo(snap)
                val tombs = api.tombstones(snap)
                for (i in 0 until tombs.length()) {
                    val t = tombs.getJSONObject(i)
                    val table = when (t.optString("table")) {
                        "highlights" -> "folio_highlights"
                        "bookmarks" -> "folio_bookmarks"
                        "voices" -> "folio_voice_notes"
                        else -> continue
                    }
                    db.applyTombstone(table, t.getString("id"), t.optString("updatedAt").ifBlank { t.optString("deletedAt") })
                }
                val local = db.highlights(bookId)
                val localIds = local.map { it.id }.toSet()
                remote.forEach { h ->
                    if (h.id !in localIds) db.insertHighlight(h.copy(dirty = false))
                }
            }
            val ops = JSONArray()
            db.dirtyDeletes("folio_highlights").forEach { id ->
                ops.put(JSONObject().put("op", "delete").put("table", "highlights").put("id", id).put("updatedAt", nowIso()))
            }
            db.dirtyDeletes("folio_bookmarks").forEach { id ->
                ops.put(JSONObject().put("op", "delete").put("table", "bookmarks").put("id", id).put("updatedAt", nowIso()))
            }
            db.bookmarks(bookId).filter { it.dirty }.forEach { b ->
                ops.put(
                    JSONObject()
                        .put("op", "put")
                        .put("table", "bookmarks")
                        .put("id", b.id)
                        .put("updatedAt", b.createdAt)
                        .put(
                            "row",
                            JSONObject()
                                .put("bookId", b.bookId)
                                .put("chapterIndex", b.chapterIndex)
                                .put("pageIndex", b.pageIndex)
                                .put("label", b.label),
                        ),
                )
            }
            db.dirtyHighlights().filter { it.bookId == bookId }.forEach { h ->
                ops.put(
                    JSONObject()
                        .put("op", "put")
                        .put("table", "highlights")
                        .put("id", h.id)
                        .put("updatedAt", h.createdAt)
                        .put(
                            "row",
                            JSONObject()
                                .put("bookId", h.bookId)
                                .put("chapterId", h.chapterId)
                                .put("startOffset", h.startOffset)
                                .put("endOffset", h.endOffset)
                                .put("text", h.text)
                                .put("note", h.note)
                                .put("authorName", h.authorName),
                        ),
                )
            }
            db.voices(bookId).filter { it.dirty && !it.isCompanion }.forEach { v ->
                if (v.audioB64.isNotBlank()) {
                    try {
                        val raw = Base64.decode(v.audioB64, Base64.DEFAULT)
                        api.createBlob(v.id, v.mime, raw.size)
                        api.putBlob(v.id, raw)
                        api.completeBlob(v.id)
                    } catch (_: Exception) {
                    }
                }
                ops.put(
                    JSONObject()
                        .put("op", "put")
                        .put("table", "voices")
                        .put("id", v.id)
                        .put("row", JSONObject()
                            .put("highlightId", v.highlightId)
                            .put("transcript", v.transcript)
                            .put("mime", v.mime)
                            .put("durationMs", v.durationMs)
                            .put("authorName", v.authorName)),
                )
            }
            db.progress(bookId)?.let { p ->
                ops.put(
                    JSONObject()
                        .put("op", "put")
                        .put("table", "progress")
                        .put("id", p.bookId)
                        .put("updatedAt", p.updatedAt)
                        .put(
                            "row",
                            JSONObject()
                                .put("bookId", p.bookId)
                                .put("chapterIndex", p.chapterIndex)
                                .put("pageIndex", p.pageIndex)
                                .put("percent", p.percent)
                                .put("locator", p.locator)
                                .put("updatedAt", p.updatedAt),
                        ),
                )
            }
            if (ops.length() > 0) {
                val res = api.push(ops)
                val accepted = res.optJSONArray("accepted") ?: JSONArray()
                for (i in 0 until accepted.length()) {
                    val a = accepted.getJSONObject(i)
                    val table = when (a.optString("table")) {
                        "highlights" -> "folio_highlights"
                        "bookmarks" -> "folio_bookmarks"
                        "voices" -> "folio_voice_notes"
                        else -> continue
                    }
                    db.markClean(table, a.optString("id"))
                }
            }
            "pulled · pushed dirty marks"
        } catch (e: Exception) {
            "sync failed: ${e.message}"
        }
    }

    private fun remapTheo(snap: JSONObject) {
        val remote = api().mergeSnapshotHighlights(snap)
        val remoteIds = remote.map { it.id }
        db.highlights(ClubSeed.ALEXANDER_BOOK).filter { it.isCompanion }.forEach { local ->
            val key = ClubSeed.companionKey(local.id) ?: return@forEach
            val hit = remoteIds.find { ClubSeed.companionKey(it) == key } ?: return@forEach
            if (hit != local.id) {
                db.remapRow("folio_highlights", local.id, hit)
                db.remapVoiceParent(local.id, hit)
            }
        }
        val voices = snap.optJSONArray("voices") ?: JSONArray()
        val remoteVoiceIds = buildList {
            for (i in 0 until voices.length()) add(voices.getJSONObject(i).optString("id"))
        }
        db.companionVoices().forEach { (localId, _) ->
            val key = ClubSeed.companionKey(localId) ?: return@forEach
            val hit = remoteVoiceIds.find { ClubSeed.companionKey(it) == key } ?: return@forEach
            if (hit.isNotBlank() && hit != localId) db.remapRow("folio_voice_notes", localId, hit)
        }
    }
}

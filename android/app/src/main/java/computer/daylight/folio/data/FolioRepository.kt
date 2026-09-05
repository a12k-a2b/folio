package computer.daylight.folio.data

import android.content.Context
import computer.daylight.folio.net.FolioApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
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
                val local = db.highlights(bookId)
                val localIds = local.map { it.id }.toSet()
                remote.forEach { h ->
                    if (h.id !in localIds) db.insertHighlight(h.copy(dirty = false))
                }
            }
            db.dirtyHighlights().filter { it.bookId == bookId }.forEach { h ->
                api.pushHighlight(h)
                db.markClean("folio_highlights", h.id)
            }
            db.progress(bookId)?.let { api.pushProgress(it) }
            "pulled · pushed dirty marks"
        } catch (e: Exception) {
            "sync failed: ${e.message}"
        }
    }
}

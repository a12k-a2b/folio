package computer.daylight.folio.data

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONObject
import java.util.UUID

class FolioDb(context: Context) : SQLiteOpenHelper(context, "folio.db", null, 1) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("""
            create table folio_library (
              id text primary key, book_id text not null unique, source text not null,
              title text not null, author text not null, description text not null default '',
              cover_label text not null default '', added_at text not null
            )
        """.trimIndent())
        db.execSQL("create table folio_book_content (book_id text primary key, chapters_json text not null)")
        db.execSQL("""
            create table folio_progress (
              book_id text primary key, chapter_index int not null default 0,
              page_index int not null default 0, percent real not null default 0,
              locator text not null default '', updated_at text not null
            )
        """.trimIndent())
        db.execSQL("""
            create table folio_tags (
              id text primary key, name text not null, emoji text not null default '',
              kind text not null default 'custom', created_at text not null
            )
        """.trimIndent())
        db.execSQL("""
            create table folio_highlights (
              id text primary key, book_id text not null, chapter_id text not null,
              start_offset int not null, end_offset int not null, text text not null,
              note text not null default '', created_at text not null,
              author_id text not null default '', author_name text not null default 'You',
              club_id text, is_companion int not null default 0, dirty int not null default 1
            )
        """.trimIndent())
        db.execSQL("create table folio_highlight_tags (highlight_id text not null, tag_id text not null, primary key (highlight_id, tag_id))")
        db.execSQL("""
            create table folio_bookmarks (
              id text primary key, book_id text not null, chapter_index int not null,
              page_index int not null, label text not null default '', created_at text not null,
              dirty int not null default 1
            )
        """.trimIndent())
        db.execSQL("""
            create table folio_voice_notes (
              id text primary key, highlight_id text not null, transcript text not null default '',
              audio_b64 text not null default '', mime text not null default 'audio/m4a',
              duration_ms int not null default 0, created_at text not null,
              author_id text not null default '', author_name text not null default 'You',
              reply_to text, club_id text, is_companion int not null default 0,
              audio_url text not null default '', dirty int not null default 1
            )
        """.trimIndent())
        db.execSQL("create table folio_settings (id int primary key, json text not null)")
        db.execSQL("create table folio_meta (key text primary key, value text not null)")
        db.execSQL("insert into folio_meta (key, value) values ('powersync', 'locked')")
        db.execSQL("insert into folio_meta (key, value) values ('protocol', 'folio-native/1')")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {}

    fun meta(key: String, fallback: String = ""): String {
        readableDatabase.rawQuery("select value from folio_meta where key = ?", arrayOf(key)).use { c ->
            return if (c.moveToFirst()) c.getString(0) else fallback
        }
    }

    fun setMeta(key: String, value: String) {
        writableDatabase.insertWithOnConflict(
            "folio_meta",
            null,
            cv("key" to key, "value" to value),
            SQLiteDatabase.CONFLICT_REPLACE,
        )
    }

    fun seedLibrary(entries: List<CatalogEntry>) {
        val db = writableDatabase
        db.rawQuery("select count(*) from folio_library", null).use { c ->
            c.moveToFirst()
            if (c.getInt(0) > 0) return
        }
        val now = nowIso()
        entries.forEach { e ->
            db.insert(
                "folio_library",
                null,
                cv(
                    "id" to UUID.randomUUID().toString(),
                    "book_id" to e.id,
                    "source" to "bundled",
                    "title" to e.title,
                    "author" to e.author,
                    "description" to e.description,
                    "cover_label" to e.coverLabel,
                    "added_at" to now,
                ),
            )
        }
        val tags = listOf(
            "Person" to ("👤" to "person"),
            "Place" to ("📍" to "place"),
            "Idea" to ("✦" to "idea"),
            "Quote" to ("❝" to "quote"),
            "Book" to ("▣" to "book"),
            "Question" to ("?" to "question"),
            "Term" to ("※" to "term"),
        )
        tags.forEach { (name, rest) ->
            db.insert(
                "folio_tags",
                null,
                cv("id" to UUID.randomUUID().toString(), "name" to name, "emoji" to rest.first, "kind" to rest.second, "created_at" to now),
            )
        }
        db.insert("folio_settings", null, cv("id" to 1, "json" to JSONObject().apply {
            put("typeScale", 1)
            put("leading", "normal")
            put("measure", "book")
            put("justify", true)
            put("pageAnim", "curl")
            put("gloss", false)
            put("linkSlide", true)
        }.toString()))
    }

    fun seedTheo(book: Book) {
        val db = writableDatabase
        db.rawQuery("select count(*) from folio_highlights where is_companion = 1", null).use { c ->
            c.moveToFirst()
            if (c.getInt(0) > 0) return
        }
        val now = nowIso()
        for (note in ClubSeed.NOTES) {
            val ch = book.chapters.find { it.id == note.chapterId } ?: continue
            val plain = htmlToPlain(ch.html)
            val span = findQuote(plain, note.quote) ?: continue
            val hid = "theo-hl-${note.key}"
            db.insertWithOnConflict(
                "folio_highlights",
                null,
                cv(
                    "id" to hid,
                    "book_id" to ClubSeed.ALEXANDER_BOOK,
                    "chapter_id" to note.chapterId,
                    "start_offset" to span.first,
                    "end_offset" to span.last,
                    "text" to note.quote,
                    "note" to "",
                    "created_at" to now,
                    "author_id" to ClubSeed.THEO_ID,
                    "author_name" to ClubSeed.THEO_NAME,
                    "club_id" to "alexander-local",
                    "is_companion" to 1,
                    "dirty" to 0,
                ),
                SQLiteDatabase.CONFLICT_IGNORE,
            )
            db.insertWithOnConflict(
                "folio_voice_notes",
                null,
                cv(
                    "id" to "theo-v-${note.key}",
                    "highlight_id" to hid,
                    "transcript" to note.transcript,
                    "audio_b64" to "",
                    "mime" to "audio/mpeg",
                    "duration_ms" to note.durationMs,
                    "created_at" to now,
                    "author_id" to ClubSeed.THEO_ID,
                    "author_name" to ClubSeed.THEO_NAME,
                    "club_id" to "alexander-local",
                    "is_companion" to 1,
                    "audio_url" to "asset://${note.asset}",
                    "dirty" to 0,
                ),
                SQLiteDatabase.CONFLICT_IGNORE,
            )
        }
    }

    fun library(): List<CatalogEntry> {
        val out = mutableListOf<CatalogEntry>()
        readableDatabase.rawQuery(
            "select book_id, title, author, description, cover_label from folio_library order by added_at asc",
            null,
        ).use { c ->
            while (c.moveToNext()) {
                out += CatalogEntry(c.str("book_id"), c.str("title"), c.str("author"), "", c.str("description"), c.str("cover_label"), 0, 0)
            }
        }
        return out
    }

    fun progress(bookId: String): Progress? {
        readableDatabase.rawQuery(
            "select * from folio_progress where book_id = ?",
            arrayOf(bookId),
        ).use { c ->
            if (!c.moveToFirst()) return null
            return Progress(
                bookId = c.str("book_id"),
                chapterIndex = c.getInt(c.getColumnIndexOrThrow("chapter_index")),
                pageIndex = c.getInt(c.getColumnIndexOrThrow("page_index")),
                percent = c.getDouble(c.getColumnIndexOrThrow("percent")),
                locator = c.str("locator"),
                updatedAt = c.str("updated_at"),
            )
        }
    }

    fun allProgress(): List<Progress> {
        val out = mutableListOf<Progress>()
        readableDatabase.rawQuery("select * from folio_progress", null).use { c ->
            while (c.moveToNext()) {
                out += Progress(
                    c.str("book_id"),
                    c.getInt(c.getColumnIndexOrThrow("chapter_index")),
                    c.getInt(c.getColumnIndexOrThrow("page_index")),
                    c.getDouble(c.getColumnIndexOrThrow("percent")),
                    c.str("locator"),
                    c.str("updated_at"),
                )
            }
        }
        return out
    }

    fun saveProgress(p: Progress) {
        writableDatabase.insertWithOnConflict(
            "folio_progress",
            null,
            cv(
                "book_id" to p.bookId,
                "chapter_index" to p.chapterIndex,
                "page_index" to p.pageIndex,
                "percent" to p.percent,
                "locator" to p.locator,
                "updated_at" to nowIso(),
            ),
            SQLiteDatabase.CONFLICT_REPLACE,
        )
    }

    fun settings(): FolioSettings {
        readableDatabase.rawQuery("select json from folio_settings where id = 1", null).use { c ->
            if (!c.moveToFirst()) return FolioSettings()
            return try {
                val o = JSONObject(c.getString(0))
                FolioSettings(
                    typeScale = o.optInt("typeScale", 1),
                    leading = o.optString("leading", "normal"),
                    measure = o.optString("measure", "book"),
                    justify = o.optBoolean("justify", true),
                    pageAnim = o.optString("pageAnim", "curl"),
                    gloss = o.optBoolean("gloss", false),
                    linkSlide = o.optBoolean("linkSlide", true),
                )
            } catch (_: Exception) {
                FolioSettings()
            }
        }
    }

    fun saveSettings(s: FolioSettings) {
        val json = JSONObject().apply {
            put("typeScale", s.typeScale)
            put("leading", s.leading)
            put("measure", s.measure)
            put("justify", s.justify)
            put("pageAnim", s.pageAnim)
            put("gloss", s.gloss)
            put("linkSlide", s.linkSlide)
        }.toString()
        writableDatabase.insertWithOnConflict("folio_settings", null, cv("id" to 1, "json" to json), SQLiteDatabase.CONFLICT_REPLACE)
    }

    fun tags(): List<Tag> {
        val out = mutableListOf<Tag>()
        readableDatabase.rawQuery("select id, name, emoji, kind from folio_tags order by created_at asc", null).use { c ->
            while (c.moveToNext()) out += Tag(c.str("id"), c.str("name"), c.str("emoji"), c.str("kind"))
        }
        return out
    }

    fun highlights(bookId: String): List<Highlight> {
        val tagMap = mutableMapOf<String, MutableList<String>>()
        readableDatabase.rawQuery(
            "select ht.highlight_id, ht.tag_id from folio_highlight_tags ht join folio_highlights h on h.id = ht.highlight_id where h.book_id = ?",
            arrayOf(bookId),
        ).use { c ->
            while (c.moveToNext()) {
                tagMap.getOrPut(c.getString(0)) { mutableListOf() }.add(c.getString(1))
            }
        }
        val out = mutableListOf<Highlight>()
        readableDatabase.rawQuery(
            "select * from folio_highlights where book_id = ? order by created_at asc",
            arrayOf(bookId),
        ).use { c ->
            while (c.moveToNext()) {
                val id = c.str("id")
                out += Highlight(
                    id = id,
                    bookId = c.str("book_id"),
                    chapterId = c.str("chapter_id"),
                    startOffset = c.getInt(c.getColumnIndexOrThrow("start_offset")),
                    endOffset = c.getInt(c.getColumnIndexOrThrow("end_offset")),
                    text = c.str("text"),
                    note = c.str("note"),
                    createdAt = c.str("created_at"),
                    tagIds = tagMap[id] ?: emptyList(),
                    authorId = c.str("author_id"),
                    authorName = c.str("author_name"),
                    clubId = c.opt("club_id"),
                    isCompanion = c.getInt(c.getColumnIndexOrThrow("is_companion")) == 1,
                    dirty = c.getInt(c.getColumnIndexOrThrow("dirty")) == 1,
                )
            }
        }
        return out
    }

    fun insertHighlight(h: Highlight) {
        writableDatabase.insertWithOnConflict(
            "folio_highlights",
            null,
            cv(
                "id" to h.id,
                "book_id" to h.bookId,
                "chapter_id" to h.chapterId,
                "start_offset" to h.startOffset,
                "end_offset" to h.endOffset,
                "text" to h.text,
                "note" to h.note,
                "created_at" to h.createdAt,
                "author_id" to h.authorId,
                "author_name" to h.authorName,
                "club_id" to h.clubId,
                "is_companion" to if (h.isCompanion) 1 else 0,
                "dirty" to if (h.dirty) 1 else 0,
            ),
            SQLiteDatabase.CONFLICT_REPLACE,
        )
    }

    fun updateHighlight(id: String, note: String?, tagIds: List<String>?) {
        if (note != null) {
            writableDatabase.execSQL("update folio_highlights set note = ?, dirty = 1 where id = ? and is_companion = 0", arrayOf(note, id))
        }
        if (tagIds != null) {
            writableDatabase.execSQL("delete from folio_highlight_tags where highlight_id = ?", arrayOf(id))
            tagIds.forEach {
                writableDatabase.insert("folio_highlight_tags", null, cv("highlight_id" to id, "tag_id" to it))
            }
            writableDatabase.execSQL("update folio_highlights set dirty = 1 where id = ?", arrayOf(id))
        }
    }

    fun deleteHighlight(id: String) {
        writableDatabase.execSQL("delete from folio_voice_notes where highlight_id = ? and is_companion = 0", arrayOf(id))
        writableDatabase.execSQL("delete from folio_highlight_tags where highlight_id = ?", arrayOf(id))
        writableDatabase.execSQL("delete from folio_highlights where id = ? and is_companion = 0", arrayOf(id))
    }

    fun bookmarks(bookId: String): List<Bookmark> {
        val out = mutableListOf<Bookmark>()
        readableDatabase.rawQuery(
            "select * from folio_bookmarks where book_id = ? order by created_at desc",
            arrayOf(bookId),
        ).use { c ->
            while (c.moveToNext()) {
                out += Bookmark(
                    c.str("id"),
                    c.str("book_id"),
                    c.getInt(c.getColumnIndexOrThrow("chapter_index")),
                    c.getInt(c.getColumnIndexOrThrow("page_index")),
                    c.str("label"),
                    c.str("created_at"),
                    c.getInt(c.getColumnIndexOrThrow("dirty")) == 1,
                )
            }
        }
        return out
    }

    fun insertBookmark(b: Bookmark) {
        writableDatabase.insertWithOnConflict(
            "folio_bookmarks",
            null,
            cv(
                "id" to b.id, "book_id" to b.bookId, "chapter_index" to b.chapterIndex,
                "page_index" to b.pageIndex, "label" to b.label, "created_at" to b.createdAt,
                "dirty" to if (b.dirty) 1 else 0,
            ),
            SQLiteDatabase.CONFLICT_REPLACE,
        )
    }

    fun deleteBookmark(id: String) {
        writableDatabase.execSQL("delete from folio_bookmarks where id = ?", arrayOf(id))
    }

    fun voices(bookId: String): List<VoiceNote> {
        val out = mutableListOf<VoiceNote>()
        readableDatabase.rawQuery(
            """
            select v.* from folio_voice_notes v
            join folio_highlights h on h.id = v.highlight_id
            where h.book_id = ?
            """.trimIndent(),
            arrayOf(bookId),
        ).use { c ->
            while (c.moveToNext()) {
                out += VoiceNote(
                    id = c.str("id"),
                    highlightId = c.str("highlight_id"),
                    transcript = c.str("transcript"),
                    audioB64 = c.str("audio_b64"),
                    audioUrl = c.str("audio_url"),
                    mime = c.str("mime"),
                    durationMs = c.getInt(c.getColumnIndexOrThrow("duration_ms")),
                    createdAt = c.str("created_at"),
                    authorId = c.str("author_id"),
                    authorName = c.str("author_name"),
                    replyTo = c.opt("reply_to"),
                    clubId = c.opt("club_id"),
                    isCompanion = c.getInt(c.getColumnIndexOrThrow("is_companion")) == 1,
                    dirty = c.getInt(c.getColumnIndexOrThrow("dirty")) == 1,
                )
            }
        }
        return out
    }

    fun insertVoice(v: VoiceNote) {
        writableDatabase.insertWithOnConflict(
            "folio_voice_notes",
            null,
            cv(
                "id" to v.id, "highlight_id" to v.highlightId, "transcript" to v.transcript,
                "audio_b64" to v.audioB64, "mime" to v.mime, "duration_ms" to v.durationMs,
                "created_at" to v.createdAt, "author_id" to v.authorId, "author_name" to v.authorName,
                "reply_to" to v.replyTo, "club_id" to v.clubId,
                "is_companion" to if (v.isCompanion) 1 else 0, "audio_url" to v.audioUrl,
                "dirty" to if (v.dirty) 1 else 0,
            ),
            SQLiteDatabase.CONFLICT_REPLACE,
        )
    }

    fun dirtyHighlights(): List<Highlight> {
        val all = mutableListOf<Highlight>()
        readableDatabase.rawQuery("select distinct book_id from folio_highlights where dirty = 1", null).use { c ->
            while (c.moveToNext()) all += highlights(c.getString(0)).filter { it.dirty && !it.isCompanion }
        }
        return all
    }

    fun markClean(table: String, id: String) {
        writableDatabase.execSQL("update $table set dirty = 0 where id = ?", arrayOf(id))
    }
}

private fun cv(vararg pairs: Pair<String, Any?>): ContentValues {
    val v = ContentValues()
    pairs.forEach { (k, value) ->
        when (value) {
            null -> v.putNull(k)
            is String -> v.put(k, value)
            is Int -> v.put(k, value)
            is Long -> v.put(k, value)
            is Double -> v.put(k, value)
            is Boolean -> v.put(k, if (value) 1 else 0)
            else -> v.put(k, value.toString())
        }
    }
    return v
}

private fun Cursor.str(col: String): String = getString(getColumnIndexOrThrow(col)) ?: ""
private fun Cursor.opt(col: String): String? = getString(getColumnIndexOrThrow(col))

fun nowIso(): String = java.time.Instant.now().toString()

package computer.daylight.folio.data

data class Chapter(val id: String, val title: String, val html: String)

data class Book(
    val id: String,
    val title: String,
    val author: String,
    val year: String,
    val description: String,
    val coverLabel: String,
    val source: String,
    val chapters: List<Chapter>,
)

data class CatalogEntry(
    val id: String,
    val title: String,
    val author: String,
    val year: String,
    val description: String,
    val coverLabel: String,
    val chapterCount: Int,
    val wordCount: Int,
)

data class Progress(
    val bookId: String,
    val chapterIndex: Int,
    val pageIndex: Int,
    val percent: Double,
    val locator: String,
    val updatedAt: String,
)

data class Tag(
    val id: String,
    val name: String,
    val emoji: String,
    val kind: String,
)

data class Highlight(
    val id: String,
    val bookId: String,
    val chapterId: String,
    val startOffset: Int,
    val endOffset: Int,
    val text: String,
    val note: String,
    val createdAt: String,
    val tagIds: List<String>,
    val authorId: String,
    val authorName: String,
    val clubId: String?,
    val isCompanion: Boolean,
    val dirty: Boolean = false,
)

data class Bookmark(
    val id: String,
    val bookId: String,
    val chapterIndex: Int,
    val pageIndex: Int,
    val label: String,
    val createdAt: String,
    val dirty: Boolean = false,
)

data class VoiceNote(
    val id: String,
    val highlightId: String,
    val transcript: String,
    val audioB64: String,
    val audioUrl: String,
    val mime: String,
    val durationMs: Int,
    val createdAt: String,
    val authorId: String,
    val authorName: String,
    val replyTo: String?,
    val clubId: String?,
    val isCompanion: Boolean,
    val dirty: Boolean = false,
)

data class FolioSettings(
    val typeScale: Int = 1,
    val leading: String = "normal",
    val measure: String = "book",
    val justify: Boolean = true,
    val pageAnim: String = "curl",
    val gloss: Boolean = false,
    val linkSlide: Boolean = true,
) {
    fun leadingMul(): Float = when (leading) {
        "tight" -> 1.42f
        "loose" -> 1.82f
        else -> 1.62f
    }
}

data class ClubMember(val userId: String, val displayName: String, val role: String)

data class Club(
    val id: String,
    val bookId: String,
    val name: String,
    val inviteCode: String,
    val members: List<ClubMember>,
)

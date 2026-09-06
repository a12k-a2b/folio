package computer.daylight.folio.data

data class TheoNote(
    val key: String,
    val chapterId: String,
    val quote: String,
    val transcript: String,
    val asset: String,
    val durationMs: Int,
)

object ClubSeed {
    const val ALEXANDER_BOOK = "living-structure"
    const val THEO_ID = "companion:theo"
    const val THEO_NAME = "Theo"

    val NOTES = listOf(
        TheoNote(
            "feeling",
            "ls-1",
            "There is a feeling you already know, and you have never been taught it.",
            "Hey. This is why I wanted us to read this together. That kitchen thing — I felt it last week. Your place versus the office. The body already knows.",
            "voices/theo-feeling.mp3",
            9980,
        ),
        TheoNote(
            "pretty",
            "ls-1",
            "A living structure is not a pretty object. Pretty objects often feel dead.",
            "Dude. Pretty objects often feel dead. That's the whole Daylight pitch in one sentence. I laughed out loud. Leave me one back if you felt it too.",
            "voices/theo-pretty.mp3",
            9410,
        ),
        TheoNote(
            "heat",
            "ls-1",
            "when a sentence makes your body change",
            "Mark it immediately. That's our rule. If you feel heat, you talk into it. I'll do the same. That's the whole experiment.",
            "voices/theo-heat.mp3",
            8140,
        ),
        TheoNote(
            "missing",
            "ls-4",
            "Speak the note if the note is a feeling.",
            "This is the missing piece. I don't want to type a comment on a book. I want you to hear that I'm actually moved. Reply in your voice — even ten seconds.",
            "voices/theo-missing.mp3",
            9890,
        ),
    )
    fun companionKey(id: String): String? {
        val m = Regex("""^(theo-(?:hl|v)-[a-z]+)(?:-[0-9a-f]{8})?$""", RegexOption.IGNORE_CASE).matchEntire(id.trim())
        return m?.groupValues?.get(1)?.lowercase()
    }
}

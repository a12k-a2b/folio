import Foundation

struct TheoNote: Equatable {
    var key: String
    var chapterId: String
    var quote: String
    var transcript: String
    var audioUrl: String
    var durationMs: Int
}

enum ClubSeed {
    static let alexanderBook = "living-structure"
    static let theoId = "companion:theo"
    static let theoName = "Theo"
    static let clubId = "alexander-local"

    static let notes: [TheoNote] = [
        TheoNote(
            key: "feeling",
            chapterId: "ls-1",
            quote: "There is a feeling you already know, and you have never been taught it.",
            transcript: "Hey. This is why I wanted us to read this together. That kitchen thing — I felt it last week. Your place versus the office. The body already knows.",
            audioUrl: "voices/theo-feeling.mp3",
            durationMs: 9980
        ),
        TheoNote(
            key: "pretty",
            chapterId: "ls-1",
            quote: "A living structure is not a pretty object. Pretty objects often feel dead.",
            transcript: "Dude. Pretty objects often feel dead. That's the whole Daylight pitch in one sentence. I laughed out loud. Leave me one back if you felt it too.",
            audioUrl: "voices/theo-pretty.mp3",
            durationMs: 9410
        ),
        TheoNote(
            key: "heat",
            chapterId: "ls-1",
            quote: "when a sentence makes your body change",
            transcript: "Mark it immediately. That's our rule. If you feel heat, you talk into it. I'll do the same. That's the whole experiment.",
            audioUrl: "voices/theo-heat.mp3",
            durationMs: 8140
        ),
        TheoNote(
            key: "missing",
            chapterId: "ls-4",
            quote: "Speak the note if the note is a feeling.",
            transcript: "This is the missing piece. I don't want to type a comment on a book. I want you to hear that I'm actually moved. Reply in your voice — even ten seconds.",
            audioUrl: "voices/theo-missing.mp3",
            durationMs: 9890
        ),
    ]

    static func companionKey(_ id: String) -> String? {
        let pattern = #"^(theo-(?:hl|v)-[a-z]+)(?:-[0-9a-f]{8})?$"#
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { return nil }
        let range = NSRange(id.startIndex..<id.endIndex, in: id)
        guard let match = regex.firstMatch(in: id, options: [], range: range), match.numberOfRanges >= 2,
              let r = Range(match.range(at: 1), in: id) else { return nil }
        return String(id[r]).lowercased()
    }
}

import Foundation

struct Chapter: Codable, Identifiable, Equatable, Hashable {
    var id: String
    var title: String
    var html: String
}

struct Book: Codable, Identifiable, Equatable, Hashable {
    var id: String
    var title: String
    var author: String
    var year: String?
    var description: String
    var coverLabel: String
    var source: String
    var chapters: [Chapter]
}

struct CatalogEntry: Codable, Identifiable, Equatable, Hashable {
    var id: String
    var title: String
    var author: String
    var year: String?
    var description: String
    var coverLabel: String
    var source: String?
    var chapterCount: Int?
    var wordCount: Int?
}

struct LibraryItem: Codable, Identifiable, Equatable, Hashable {
    var id: String
    var bookId: String
    var source: String
    var title: String
    var author: String
    var description: String
    var coverLabel: String
    var addedAt: String
}

struct Progress: Codable, Equatable, Hashable {
    var bookId: String
    var chapterIndex: Int
    var pageIndex: Int
    var percent: Double
    var locator: String
    var updatedAt: String
}

struct Tag: Codable, Identifiable, Equatable, Hashable {
    var id: String
    var name: String
    var emoji: String
    var kind: String
}

struct Highlight: Codable, Identifiable, Equatable, Hashable {
    var id: String
    var bookId: String
    var chapterId: String
    var startOffset: Int
    var endOffset: Int
    var text: String
    var note: String
    var createdAt: String
    var tagIds: [String]
    var authorId: String
    var authorName: String
    var clubId: String?
    var isCompanion: Bool
    var dirty: Bool

    init(
        id: String,
        bookId: String,
        chapterId: String,
        startOffset: Int,
        endOffset: Int,
        text: String,
        note: String,
        createdAt: String,
        tagIds: [String],
        authorId: String,
        authorName: String,
        clubId: String?,
        isCompanion: Bool,
        dirty: Bool = false
    ) {
        self.id = id
        self.bookId = bookId
        self.chapterId = chapterId
        self.startOffset = startOffset
        self.endOffset = endOffset
        self.text = text
        self.note = note
        self.createdAt = createdAt
        self.tagIds = tagIds
        self.authorId = authorId
        self.authorName = authorName
        self.clubId = clubId
        self.isCompanion = isCompanion
        self.dirty = dirty
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        bookId = try c.decode(String.self, forKey: .bookId)
        chapterId = try c.decode(String.self, forKey: .chapterId)
        startOffset = try c.decodeIfPresent(Int.self, forKey: .startOffset) ?? 0
        endOffset = try c.decodeIfPresent(Int.self, forKey: .endOffset) ?? 0
        text = try c.decodeIfPresent(String.self, forKey: .text) ?? ""
        note = try c.decodeIfPresent(String.self, forKey: .note) ?? ""
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt) ?? ""
        tagIds = try c.decodeIfPresent([String].self, forKey: .tagIds) ?? []
        authorId = try c.decodeIfPresent(String.self, forKey: .authorId) ?? ""
        authorName = try c.decodeIfPresent(String.self, forKey: .authorName) ?? "You"
        clubId = try c.decodeIfPresent(String.self, forKey: .clubId)
        isCompanion = try c.decodeIfPresent(Bool.self, forKey: .isCompanion) ?? false
        dirty = try c.decodeIfPresent(Bool.self, forKey: .dirty) ?? false
    }
}

struct Bookmark: Codable, Identifiable, Equatable, Hashable {
    var id: String
    var bookId: String
    var chapterIndex: Int
    var pageIndex: Int
    var label: String
    var createdAt: String
    var dirty: Bool

    init(
        id: String,
        bookId: String,
        chapterIndex: Int,
        pageIndex: Int,
        label: String,
        createdAt: String,
        dirty: Bool = false
    ) {
        self.id = id
        self.bookId = bookId
        self.chapterIndex = chapterIndex
        self.pageIndex = pageIndex
        self.label = label
        self.createdAt = createdAt
        self.dirty = dirty
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        bookId = try c.decode(String.self, forKey: .bookId)
        chapterIndex = try c.decodeIfPresent(Int.self, forKey: .chapterIndex) ?? 0
        pageIndex = try c.decodeIfPresent(Int.self, forKey: .pageIndex) ?? 0
        label = try c.decodeIfPresent(String.self, forKey: .label) ?? ""
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt) ?? ""
        dirty = try c.decodeIfPresent(Bool.self, forKey: .dirty) ?? false
    }
}

struct VoiceNote: Codable, Identifiable, Equatable, Hashable {
    var id: String
    var highlightId: String
    var transcript: String
    var audioB64: String
    var audioUrl: String
    var mime: String
    var durationMs: Int
    var createdAt: String
    var authorId: String
    var authorName: String
    var replyTo: String?
    var clubId: String?
    var isCompanion: Bool
    var dirty: Bool

    init(
        id: String,
        highlightId: String,
        transcript: String,
        audioB64: String,
        audioUrl: String,
        mime: String,
        durationMs: Int,
        createdAt: String,
        authorId: String,
        authorName: String,
        replyTo: String?,
        clubId: String?,
        isCompanion: Bool,
        dirty: Bool = false
    ) {
        self.id = id
        self.highlightId = highlightId
        self.transcript = transcript
        self.audioB64 = audioB64
        self.audioUrl = audioUrl
        self.mime = mime
        self.durationMs = durationMs
        self.createdAt = createdAt
        self.authorId = authorId
        self.authorName = authorName
        self.replyTo = replyTo
        self.clubId = clubId
        self.isCompanion = isCompanion
        self.dirty = dirty
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        highlightId = try c.decode(String.self, forKey: .highlightId)
        transcript = try c.decodeIfPresent(String.self, forKey: .transcript) ?? ""
        audioB64 = try c.decodeIfPresent(String.self, forKey: .audioB64) ?? ""
        audioUrl = try c.decodeIfPresent(String.self, forKey: .audioUrl) ?? ""
        mime = try c.decodeIfPresent(String.self, forKey: .mime) ?? "audio/m4a"
        durationMs = try c.decodeIfPresent(Int.self, forKey: .durationMs) ?? 0
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt) ?? ""
        authorId = try c.decodeIfPresent(String.self, forKey: .authorId) ?? ""
        authorName = try c.decodeIfPresent(String.self, forKey: .authorName) ?? "You"
        replyTo = try c.decodeIfPresent(String.self, forKey: .replyTo)
        clubId = try c.decodeIfPresent(String.self, forKey: .clubId)
        isCompanion = try c.decodeIfPresent(Bool.self, forKey: .isCompanion) ?? false
        dirty = try c.decodeIfPresent(Bool.self, forKey: .dirty) ?? false
    }
}

struct ClubMember: Codable, Equatable, Hashable {
    var userId: String
    var displayName: String
    var role: String
}

struct Club: Codable, Identifiable, Equatable, Hashable {
    var id: String
    var bookId: String
    var name: String
    var inviteCode: String
    var createdBy: String?
    var members: [ClubMember]
}

struct FolioSettings: Codable, Equatable {
    var typeScale: Int
    var leading: String
    var measure: String
    var justify: Bool
    var pageAnim: String
    var gloss: Bool
    var linkSlide: Bool
    var device: String

    static let `default` = FolioSettings(
        typeScale: 1,
        leading: "normal",
        measure: "book",
        justify: true,
        pageAnim: "curl",
        gloss: false,
        linkSlide: true,
        device: "auto"
    )

    func leadingMul() -> CGFloat {
        FolioTheme.leadingMul(leading)
    }

    init(
        typeScale: Int = 1,
        leading: String = "normal",
        measure: String = "book",
        justify: Bool = true,
        pageAnim: String = "curl",
        gloss: Bool = false,
        linkSlide: Bool = true,
        device: String = "auto"
    ) {
        self.typeScale = typeScale
        self.leading = leading
        self.measure = measure
        self.justify = justify
        self.pageAnim = pageAnim
        self.gloss = gloss
        self.linkSlide = linkSlide
        self.device = device
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        typeScale = try c.decodeIfPresent(Int.self, forKey: .typeScale) ?? 1
        leading = try c.decodeIfPresent(String.self, forKey: .leading) ?? "normal"
        measure = try c.decodeIfPresent(String.self, forKey: .measure) ?? "book"
        justify = try c.decodeIfPresent(Bool.self, forKey: .justify) ?? true
        pageAnim = try c.decodeIfPresent(String.self, forKey: .pageAnim) ?? "curl"
        gloss = try c.decodeIfPresent(Bool.self, forKey: .gloss) ?? false
        linkSlide = try c.decodeIfPresent(Bool.self, forKey: .linkSlide) ?? true
        device = try c.decodeIfPresent(String.self, forKey: .device) ?? "auto"
    }
}

enum FolioNow {
    static func iso() -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.string(from: Date())
    }
}

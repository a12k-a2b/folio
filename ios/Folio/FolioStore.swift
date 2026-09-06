import Foundation
import Combine

/// File-backed store using the folio_* names from native/PROTOCOL.md.
/// JSON file in Application Support. PowerSync is locked. HTTP v1.1: blobs, tombstones, batch.
@MainActor
final class FolioStore: ObservableObject {
    @Published private(set) var library: [CatalogEntry] = []
    @Published var settings: FolioSettings = .default
    @Published var origin: String = ""
    @Published var token: String = ""
    @Published private(set) var lastPullAt: String = ""

    private var progressByBook: [String: Progress] = [:]
    private var tagsStore: [Tag] = []
    private var highlightsStore: [Highlight] = []
    private var bookmarksStore: [Bookmark] = []
    private var voicesStore: [VoiceNote] = []
    private var pendingDeletes: [[String: String]] = []
    private var meta: [String: String] = [
        "powersync": "locked",
        "protocol": "folio-native/1",
    ]

    private let fileURL: URL
    private var persistWork: DispatchWorkItem?

    init() {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        let dir = appSupport.appendingPathComponent("Folio", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        fileURL = dir.appendingPathComponent("folio-store.json")
        loadOrSeed()
    }

    var powersyncLocked: Bool { (meta["powersync"] ?? "locked") == "locked" }
    var protocolName: String { meta["protocol"] ?? "folio-native/1" }

    func api() -> FolioApi {
        FolioApi(origin: origin, token: token)
    }

    func book(_ id: String) -> Book? {
        CatalogLoader.book(id)
    }

    func progress(_ bookId: String) -> Progress? {
        progressByBook[bookId]
    }

    func allProgress() -> [Progress] {
        Array(progressByBook.values)
    }

    func tags() -> [Tag] { tagsStore }

    func highlights(_ bookId: String) -> [Highlight] {
        highlightsStore.filter { $0.bookId == bookId }.sorted { $0.createdAt < $1.createdAt }
    }

    func bookmarks(_ bookId: String) -> [Bookmark] {
        bookmarksStore.filter { $0.bookId == bookId }.sorted { $0.createdAt > $1.createdAt }
    }

    func voices(_ bookId: String) -> [VoiceNote] {
        let ids = Set(highlights(bookId).map(\.id))
        return voicesStore.filter { ids.contains($0.highlightId) }
    }

    func voicesForHighlight(_ highlightId: String) -> [VoiceNote] {
        voicesStore.filter { $0.highlightId == highlightId }.sorted { $0.createdAt < $1.createdAt }
    }

    func saveSettings(_ s: FolioSettings) {
        settings = s
        persist()
        Task { try? await api().postSettings(s) }
    }

    func setOrigin(_ v: String) {
        origin = v.trimmingCharacters(in: .whitespacesAndNewlines)
        meta["origin"] = origin
        persist()
    }

    func setToken(_ v: String) {
        token = v.trimmingCharacters(in: .whitespacesAndNewlines)
        meta["token"] = token
        persist()
    }

    func saveProgress(_ p: Progress) {
        var next = p
        next.updatedAt = FolioNow.iso()
        progressByBook[p.bookId] = next
        persist()
        Task { try? await api().pushProgress(next) }
    }

    @discardableResult
    func addHighlight(bookId: String, chapterId: String, start: Int, end: Int, text: String) -> Highlight {
        let h = Highlight(
            id: UUID().uuidString,
            bookId: bookId,
            chapterId: chapterId,
            startOffset: start,
            endOffset: end,
            text: text,
            note: "",
            createdAt: FolioNow.iso(),
            tagIds: [],
            authorId: "local",
            authorName: "You",
            clubId: bookId == ClubSeed.alexanderBook ? ClubSeed.clubId : nil,
            isCompanion: false,
            dirty: true
        )
        highlightsStore.append(h)
        persist()
        Task {
            if let _ = try? await api().pushHighlight(h) {
                markCleanHighlight(h.id)
            }
        }
        return h
    }

    func updateHighlight(id: String, note: String?, tagIds: [String]?) {
        guard let i = highlightsStore.firstIndex(where: { $0.id == id }) else { return }
        if highlightsStore[i].isCompanion { return }
        if let note { highlightsStore[i].note = note }
        if let tagIds { highlightsStore[i].tagIds = tagIds }
        highlightsStore[i].dirty = true
        persist()
        let h = highlightsStore[i]
        Task {
            try? await api().patchHighlight(id: id, note: note, tagIds: tagIds)
            markCleanHighlight(h.id)
        }
    }

    func deleteHighlight(_ id: String) {
        guard let h = highlightsStore.first(where: { $0.id == id }), !h.isCompanion else { return }
        voicesStore.removeAll { $0.highlightId == id && !$0.isCompanion }
        highlightsStore.removeAll { $0.id == id }
        pendingDeletes.append(["table": "highlights", "id": id, "updatedAt": FolioNow.iso()])
        persist()
        Task { try? await api().push([["op": "delete", "table": "highlights", "id": id, "updatedAt": FolioNow.iso()]]) }
    }

    @discardableResult
    func addBookmark(bookId: String, chapterIndex: Int, pageIndex: Int, label: String) -> Bookmark {
        let b = Bookmark(
            id: UUID().uuidString,
            bookId: bookId,
            chapterIndex: chapterIndex,
            pageIndex: pageIndex,
            label: label,
            createdAt: FolioNow.iso(),
            dirty: true
        )
        bookmarksStore.append(b)
        persist()
        Task {
            if let _ = try? await api().pushBookmark(b) {
                markCleanBookmark(b.id)
            }
        }
        return b
    }

    func deleteBookmark(_ id: String) {
        bookmarksStore.removeAll { $0.id == id }
        pendingDeletes.append(["table": "bookmarks", "id": id, "updatedAt": FolioNow.iso()])
        persist()
        Task { try? await api().push([["op": "delete", "table": "bookmarks", "id": id, "updatedAt": FolioNow.iso()]]) }
    }

    func bookmarkOnPage(bookId: String, chapterIndex: Int, pageIndex: Int) -> Bookmark? {
        bookmarksStore.first { $0.bookId == bookId && $0.chapterIndex == chapterIndex && $0.pageIndex == pageIndex }
    }

    @discardableResult
    func addVoice(highlightId: String, transcript: String, audioB64: String, mime: String, durationMs: Int) -> VoiceNote {
        let v = VoiceNote(
            id: UUID().uuidString,
            highlightId: highlightId,
            transcript: transcript,
            audioB64: audioB64,
            audioUrl: "",
            mime: mime,
            durationMs: durationMs,
            createdAt: FolioNow.iso(),
            authorId: "local",
            authorName: "You",
            replyTo: nil,
            clubId: ClubSeed.clubId,
            isCompanion: false,
            dirty: true
        )
        voicesStore.append(v)
        persist()
        Task {
            if let _ = try? await api().pushVoice(v) {
                markCleanVoice(v.id)
            }
        }
        return v
    }

    func addTag(name: String, emoji: String = "※", kind: String = "custom") -> Tag {
        let t = Tag(id: UUID().uuidString, name: name, emoji: emoji, kind: kind)
        tagsStore.append(t)
        persist()
        return t
    }

    func pullAndPush(bookId: String) async -> String {
        let client = api()
        if !client.configured { return "no origin — local only" }
        if !client.signedIn { return "no session — catalog is offline" }
        precondition(powersyncLocked, "PowerSync must stay locked")
        do {
            if let snap = try await client.snapshot(bookId) {
                let remoteHighlights = client.mergeSnapshotHighlights(snap)
                let remoteVoices = client.mergeSnapshotVoices(snap)
                for t in client.tombstones(snap) {
                    guard let table = t["table"] as? String, let id = t["id"] as? String else { continue }
                    let incoming = (t["updatedAt"] as? String) ?? (t["deletedAt"] as? String) ?? FolioNow.iso()
                    if table == "highlights" {
                        if let h = highlightsStore.first(where: { $0.id == id }), h.createdAt > incoming { continue }
                        highlightsStore.removeAll { $0.id == id }
                        voicesStore.removeAll { $0.highlightId == id && !$0.isCompanion }
                    }
                    if table == "bookmarks" {
                        if let b = bookmarksStore.first(where: { $0.id == id }), b.createdAt > incoming { continue }
                        bookmarksStore.removeAll { $0.id == id }
                    }
                    if table == "voices" {
                        if let v = voicesStore.first(where: { $0.id == id }), v.createdAt > incoming { continue }
                        voicesStore.removeAll { $0.id == id }
                    }
                    pendingDeletes.removeAll { $0["id"] == id }
                }
                unionHighlights(remoteHighlights, bookId: bookId)
                unionVoices(remoteVoices)
                unionBookmarks(client.mergeSnapshotBookmarks(snap), bookId: bookId)
                remapTheo(remoteHighlights, remoteVoices: remoteVoices)
            }
            var ops: [[String: Any]] = pendingDeletes.map {
                ["op": "delete", "table": $0["table"] ?? "highlights", "id": $0["id"] ?? "", "updatedAt": $0["updatedAt"] ?? FolioNow.iso()]
            }
            for h in highlightsStore where h.dirty && !h.isCompanion && h.bookId == bookId {
                ops.append([
                    "op": "put", "table": "highlights", "id": h.id, "updatedAt": h.createdAt,
                    "row": [
                        "bookId": h.bookId, "chapterId": h.chapterId, "startOffset": h.startOffset,
                        "endOffset": h.endOffset, "text": h.text, "note": h.note, "authorName": h.authorName,
                    ],
                ])
            }
            for b in bookmarksStore where b.dirty && b.bookId == bookId {
                ops.append([
                    "op": "put", "table": "bookmarks", "id": b.id, "updatedAt": b.createdAt,
                    "row": [
                        "bookId": b.bookId, "chapterIndex": b.chapterIndex,
                        "pageIndex": b.pageIndex, "label": b.label,
                    ],
                ])
            }
            for v in voicesStore where v.dirty && !v.isCompanion {
                let hid = highlightsStore.first(where: { $0.id == v.highlightId })
                guard hid?.bookId == bookId else { continue }
                if !v.audioB64.isEmpty, let data = Data(base64Encoded: v.audioB64) {
                    _ = try? await client.createBlob(id: v.id, mime: v.mime, byteLength: data.count)
                    try? await client.putBlob(id: v.id, data: data)
                    try? await client.completeBlob(id: v.id)
                }
                ops.append([
                    "op": "put", "table": "voices", "id": v.id,
                    "row": [
                        "highlightId": v.highlightId, "transcript": v.transcript,
                        "mime": v.mime, "durationMs": v.durationMs, "authorName": v.authorName,
                    ],
                ])
            }
            if let p = progressByBook[bookId] {
                ops.append([
                    "op": "put", "table": "progress", "id": p.bookId, "updatedAt": p.updatedAt,
                    "row": [
                        "bookId": p.bookId, "chapterIndex": p.chapterIndex, "pageIndex": p.pageIndex,
                        "percent": p.percent, "locator": p.locator, "updatedAt": p.updatedAt,
                    ],
                ])
            }
            if !ops.isEmpty {
                let res = try await client.push(ops)
                let accepted = res["accepted"] as? [[String: Any]] ?? []
                for a in accepted {
                    let id = a["id"] as? String ?? ""
                    let table = a["table"] as? String ?? ""
                    if table == "highlights" { markCleanHighlight(id) }
                    if table == "voices" { markCleanVoice(id) }
                    if table == "bookmarks" { markCleanBookmark(id) }
                    if table == "highlights" || table == "bookmarks" || table == "voices" {
                        pendingDeletes.removeAll { $0["id"] == id }
                    }
                }
            }
            lastPullAt = FolioNow.iso()
            meta["last_pull_at"] = lastPullAt
            persist()
            return "pulled · pushed dirty marks"
        } catch {
            return "sync failed: \(error.localizedDescription)"
        }
    }

    // MARK: - Seed / disk

    private struct Disk: Codable {
        var library: [CatalogEntry]
        var progress: [Progress]
        var tags: [Tag]
        var highlights: [Highlight]
        var bookmarks: [Bookmark]
        var voices: [VoiceNote]
        var settings: FolioSettings
        var meta: [String: String]
        var pendingDeletes: [[String: String]]?
    }

    private func loadOrSeed() {
        if let data = try? Data(contentsOf: fileURL),
           let disk = try? JSONDecoder().decode(Disk.self, from: data) {
            library = disk.library
            progressByBook = Dictionary(uniqueKeysWithValues: disk.progress.map { ($0.bookId, $0) })
            tagsStore = disk.tags
            highlightsStore = disk.highlights
            bookmarksStore = disk.bookmarks
            voicesStore = disk.voices
            settings = disk.settings
            meta.merge(disk.meta) { _, n in n }
            origin = meta["origin"] ?? ""
            token = meta["token"] ?? ""
            lastPullAt = meta["last_pull_at"] ?? ""
            pendingDeletes = disk.pendingDeletes ?? []
            meta["powersync"] = "locked"
            meta["protocol"] = "folio-native/1"
            if library.isEmpty { seedLibrary() }
            seedTheoIfNeeded()
            return
        }
        seedLibrary()
        seedTheoIfNeeded()
        persistNow()
    }

    private func seedLibrary() {
        let now = FolioNow.iso()
        library = CatalogLoader.entries()
        _ = now
        if tagsStore.isEmpty {
            let defaults: [(String, String, String)] = [
                ("Person", "👤", "person"),
                ("Place", "📍", "place"),
                ("Idea", "✦", "idea"),
                ("Quote", "❝", "quote"),
                ("Book", "▣", "book"),
                ("Question", "?", "question"),
                ("Term", "※", "term"),
            ]
            tagsStore = defaults.map { Tag(id: UUID().uuidString, name: $0.0, emoji: $0.1, kind: $0.2) }
        }
        if settings.typeScale == 0 && settings.leading.isEmpty {
            settings = .default
        }
        meta["powersync"] = "locked"
        meta["protocol"] = "folio-native/1"
    }

    private func seedTheoIfNeeded() {
        if highlightsStore.contains(where: { $0.isCompanion }) { return }
        guard let book = CatalogLoader.book(ClubSeed.alexanderBook) else { return }
        let now = FolioNow.iso()
        for note in ClubSeed.notes {
            guard let ch = book.chapters.first(where: { $0.id == note.chapterId }) else { continue }
            let plain = HtmlText.htmlToPlain(ch.html)
            guard let span = HtmlText.findQuote(plain, quote: note.quote) else { continue }
            let hid = "theo-hl-\(note.key)"
            highlightsStore.append(
                Highlight(
                    id: hid,
                    bookId: ClubSeed.alexanderBook,
                    chapterId: note.chapterId,
                    startOffset: span.location,
                    endOffset: span.location + span.length,
                    text: note.quote,
                    note: "",
                    createdAt: now,
                    tagIds: [],
                    authorId: ClubSeed.theoId,
                    authorName: ClubSeed.theoName,
                    clubId: ClubSeed.clubId,
                    isCompanion: true,
                    dirty: false
                )
            )
            voicesStore.append(
                VoiceNote(
                    id: "theo-v-\(note.key)",
                    highlightId: hid,
                    transcript: note.transcript,
                    audioB64: "",
                    audioUrl: note.audioUrl,
                    mime: "audio/mpeg",
                    durationMs: note.durationMs,
                    createdAt: now,
                    authorId: ClubSeed.theoId,
                    authorName: ClubSeed.theoName,
                    replyTo: nil,
                    clubId: ClubSeed.clubId,
                    isCompanion: true,
                    dirty: false
                )
            )
        }
    }

    private func unionHighlights(_ remote: [Highlight], bookId: String) {
        let localIds = Set(highlightsStore.map(\.id))
        for var h in remote {
            if localIds.contains(h.id) { continue }
            h.dirty = false
            highlightsStore.append(h)
        }
        persist()
    }

    private func remapTheo(_ remote: [Highlight], remoteVoices: [VoiceNote]) {
        let remoteIds = remote.map(\.id)
        for local in highlightsStore where local.isCompanion {
            guard let key = ClubSeed.companionKey(local.id),
                  let hit = remoteIds.first(where: { ClubSeed.companionKey($0) == key }),
                  hit != local.id,
                  let i = highlightsStore.firstIndex(where: { $0.id == local.id }) else { continue }
            let old = local.id
            highlightsStore[i].id = hit
            for vi in voicesStore.indices where voicesStore[vi].highlightId == old {
                voicesStore[vi].highlightId = hit
            }
        }
        let remoteVoiceIds = remoteVoices.map(\.id)
        for local in voicesStore where local.isCompanion {
            guard let key = ClubSeed.companionKey(local.id),
                  let hit = remoteVoiceIds.first(where: { ClubSeed.companionKey($0) == key }),
                  hit != local.id,
                  let i = voicesStore.firstIndex(where: { $0.id == local.id }) else { continue }
            voicesStore[i].id = hit
        }
    }

    private func unionVoices(_ remote: [VoiceNote]) {
        let localIds = Set(voicesStore.map(\.id))
        for var v in remote {
            if localIds.contains(v.id) { continue }
            v.dirty = false
            voicesStore.append(v)
        }
    }

    private func unionBookmarks(_ remote: [Bookmark], bookId: String) {
        let localIds = Set(bookmarksStore.map(\.id))
        for var b in remote where b.bookId == bookId {
            if localIds.contains(b.id) { continue }
            b.dirty = false
            bookmarksStore.append(b)
        }
    }

    private func markCleanHighlight(_ id: String) {
        if let i = highlightsStore.firstIndex(where: { $0.id == id }) {
            highlightsStore[i].dirty = false
            persist()
        }
    }

    private func markCleanVoice(_ id: String) {
        if let i = voicesStore.firstIndex(where: { $0.id == id }) {
            voicesStore[i].dirty = false
            persist()
        }
    }

    private func markCleanBookmark(_ id: String) {
        if let i = bookmarksStore.firstIndex(where: { $0.id == id }) {
            bookmarksStore[i].dirty = false
            persist()
        }
    }

    private func persist() {
        persistWork?.cancel()
        let work = DispatchWorkItem { [weak self] in
            Task { @MainActor in self?.persistNow() }
        }
        persistWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05, execute: work)
    }

    private func persistNow() {
        let disk = Disk(
            library: library,
            progress: Array(progressByBook.values),
            tags: tagsStore,
            highlights: highlightsStore,
            bookmarks: bookmarksStore,
            voices: voicesStore,
            settings: settings,
            meta: meta,
            pendingDeletes: pendingDeletes
        )
        do {
            let data = try JSONEncoder().encode(disk)
            try data.write(to: fileURL, options: .atomic)
        } catch {
            // Local disk is the source of truth; a failed write is retried on the next mutation.
        }
    }
}

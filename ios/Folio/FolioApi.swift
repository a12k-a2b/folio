import Foundation

/// HTTP v1 client. PowerSync is locked — do not add a sync SDK here.
/// Protocol: folio-native/1. See native/PROTOCOL.md.
struct FolioApi {
    var origin: String
    var token: String

    var configured: Bool { !origin.trimmingCharacters(in: .whitespaces).isEmpty }
    var signedIn: Bool { !token.trimmingCharacters(in: .whitespaces).isEmpty }

    private var session: URLSession {
        let cfg = URLSessionConfiguration.ephemeral
        cfg.timeoutIntervalForRequest = 30
        cfg.timeoutIntervalForResource = 45
        cfg.httpAdditionalHeaders = [
            "X-Folio-Protocol": "folio-native/1",
            "Accept": "application/json",
        ]
        return URLSession(configuration: cfg)
    }

    func health() async throws -> [String: Any] {
        try await get("/health")
    }

    func catalog() async throws -> [String: Any] {
        try await get("/catalog")
    }

    func catalogBook(_ id: String) async throws -> [String: Any] {
        try await get("/catalog/\(id)")
    }

    func me() async throws -> [String: Any] {
        try await get("/me")
    }

    func library() async throws -> [String: Any] {
        try await get("/library")
    }

    func snapshot(_ bookId: String) async throws -> [String: Any]? {
        if !signedIn { return nil }
        return try await get("/snapshot/\(bookId)")
    }

    func pushProgress(_ p: Progress) async throws {
        if !signedIn { return }
        _ = try await post("/progress", body: [
            "bookId": p.bookId,
            "chapterIndex": p.chapterIndex,
            "pageIndex": p.pageIndex,
            "percent": p.percent,
            "locator": p.locator,
            "updatedAt": p.updatedAt,
        ])
    }

    func pushHighlight(_ h: Highlight) async throws -> String {
        if !signedIn { return h.id }
        var body: [String: Any] = [
            "id": h.id,
            "bookId": h.bookId,
            "chapterId": h.chapterId,
            "startOffset": h.startOffset,
            "endOffset": h.endOffset,
            "text": h.text,
            "note": h.note,
            "authorName": h.authorName,
            "tagIds": h.tagIds,
        ]
        if let clubId = h.clubId { body["clubId"] = clubId }
        let res = try await post("/highlights", body: body)
        return (res["id"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? h.id
    }

    func patchHighlight(id: String, note: String?, tagIds: [String]?) async throws {
        if !signedIn { return }
        var body: [String: Any] = [:]
        if let note { body["note"] = note }
        if let tagIds { body["tagIds"] = tagIds }
        _ = try await patch("/highlights/\(id)", body: body)
    }

    func deleteHighlight(_ id: String) async throws {
        if !signedIn { return }
        _ = try await delete("/highlights/\(id)")
    }

    func pushBookmark(_ b: Bookmark) async throws -> String {
        if !signedIn { return b.id }
        let res = try await post("/bookmarks", body: [
            "id": b.id,
            "bookId": b.bookId,
            "chapterIndex": b.chapterIndex,
            "pageIndex": b.pageIndex,
            "label": b.label,
        ])
        return (res["id"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? b.id
    }

    func deleteBookmark(_ id: String) async throws {
        if !signedIn { return }
        _ = try await delete("/bookmarks/\(id)")
    }

    func pushVoice(_ v: VoiceNote) async throws -> String {
        if !signedIn { return v.id }
        var body: [String: Any] = [
            "id": v.id,
            "highlightId": v.highlightId,
            "transcript": v.transcript,
            "audioB64": v.audioB64,
            "mime": v.mime,
            "durationMs": v.durationMs,
            "authorName": v.authorName,
        ]
        if let reply = v.replyTo { body["replyTo"] = reply }
        let res = try await post("/voices", body: body)
        return (res["id"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? v.id
    }

    func push(_ ops: [[String: Any]]) async throws -> [String: Any] {
        if !signedIn { return [:] }
        return try await post("/push", body: ["ops": ops])
    }

    func createBlob(id: String, mime: String, byteLength: Int) async throws -> [String: Any] {
        try await post("/blobs", body: ["id": id, "mime": mime, "byteLength": byteLength])
    }

    func putBlob(id: String, data: Data) async throws {
        guard let url = url("/blobs/\(id)/data") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "PUT"
        req.httpBody = data
        req.setValue("application/octet-stream", forHTTPHeaderField: "Content-Type")
        req.setValue("folio-native/1", forHTTPHeaderField: "X-Folio-Protocol")
        if !token.isEmpty { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        let (_, res) = try await session.data(for: req)
        guard let http = res as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }

    func completeBlob(id: String) async throws {
        _ = try await post("/blobs/\(id)/complete", body: [:])
    }

    func tombstones(_ obj: [String: Any]) -> [[String: Any]] {
        obj["tombstones"] as? [[String: Any]] ?? []
    }

    func postSettings(_ s: FolioSettings) async throws {
        if !signedIn { return }
        _ = try await post("/settings", body: [
            "typeScale": s.typeScale,
            "leading": s.leading,
            "measure": s.measure,
            "justify": s.justify,
            "pageAnim": s.pageAnim,
            "gloss": s.gloss,
            "linkSlide": s.linkSlide,
            "device": s.device,
        ])
    }

    func mergeSnapshotHighlights(_ obj: [String: Any]) -> [Highlight] {
        guard let arr = obj["highlights"] as? [[String: Any]] else { return [] }
        return arr.compactMap { o in
            guard let id = o["id"] as? String, let bookId = o["bookId"] as? String, let chapterId = o["chapterId"] as? String else {
                return nil
            }
            let tags = o["tagIds"] as? [String] ?? []
            let club = o["clubId"] as? String
            return Highlight(
                id: id,
                bookId: bookId,
                chapterId: chapterId,
                startOffset: o["startOffset"] as? Int ?? 0,
                endOffset: o["endOffset"] as? Int ?? 0,
                text: o["text"] as? String ?? "",
                note: o["note"] as? String ?? "",
                createdAt: o["createdAt"] as? String ?? "",
                tagIds: tags,
                authorId: o["authorId"] as? String ?? "",
                authorName: o["authorName"] as? String ?? "",
                clubId: (club?.isEmpty == false) ? club : nil,
                isCompanion: o["isCompanion"] as? Bool ?? false,
                dirty: false
            )
        }
    }

    func mergeSnapshotVoices(_ obj: [String: Any]) -> [VoiceNote] {
        guard let arr = obj["voices"] as? [[String: Any]] else { return [] }
        return arr.compactMap { o in
            guard let id = o["id"] as? String, let hid = o["highlightId"] as? String else { return nil }
            return VoiceNote(
                id: id,
                highlightId: hid,
                transcript: o["transcript"] as? String ?? "",
                audioB64: o["audioB64"] as? String ?? "",
                audioUrl: o["audioUrl"] as? String ?? "",
                mime: o["mime"] as? String ?? "audio/mpeg",
                durationMs: o["durationMs"] as? Int ?? 0,
                createdAt: o["createdAt"] as? String ?? "",
                authorId: o["authorId"] as? String ?? "",
                authorName: o["authorName"] as? String ?? "",
                replyTo: o["replyTo"] as? String,
                clubId: o["clubId"] as? String,
                isCompanion: o["isCompanion"] as? Bool ?? false,
                dirty: false
            )
        }
    }

    func mergeSnapshotBookmarks(_ obj: [String: Any]) -> [Bookmark] {
        guard let arr = obj["bookmarks"] as? [[String: Any]] else { return [] }
        return arr.compactMap { o in
            guard let id = o["id"] as? String, let bookId = o["bookId"] as? String else { return nil }
            return Bookmark(
                id: id,
                bookId: bookId,
                chapterIndex: o["chapterIndex"] as? Int ?? 0,
                pageIndex: o["pageIndex"] as? Int ?? 0,
                label: o["label"] as? String ?? "",
                createdAt: o["createdAt"] as? String ?? "",
                dirty: false
            )
        }
    }

    // MARK: - HTTP

    private func url(_ path: String) -> URL? {
        let base = origin.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard !base.isEmpty else { return nil }
        return URL(string: "\(base)/api/native/v1\(path)")
    }

    private func get(_ path: String) async throws -> [String: Any] {
        try await send(path, method: "GET", body: nil)
    }

    private func post(_ path: String, body: [String: Any]) async throws -> [String: Any] {
        try await send(path, method: "POST", body: body)
    }

    private func patch(_ path: String, body: [String: Any]) async throws -> [String: Any] {
        try await send(path, method: "PATCH", body: body)
    }

    private func delete(_ path: String) async throws -> [String: Any] {
        try await send(path, method: "DELETE", body: nil)
    }

    private func send(_ path: String, method: String, body: [String: Any]?) async throws -> [String: Any] {
        guard let url = url(path) else { throw FolioApiError.notConfigured }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("folio-native/1", forHTTPHeaderField: "X-Folio-Protocol")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if signedIn {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            req.setValue("application/json; charset=utf-8", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, res) = try await session.data(for: req)
        let code = (res as? HTTPURLResponse)?.statusCode ?? 0
        if !(200..<300).contains(code) {
            let text = String(data: data, encoding: .utf8) ?? ""
            throw FolioApiError.http(code, text)
        }
        if data.isEmpty { return [:] }
        let obj = try JSONSerialization.jsonObject(with: data)
        return obj as? [String: Any] ?? [:]
    }
}

enum FolioApiError: LocalizedError {
    case notConfigured
    case http(Int, String)

    var errorDescription: String? {
        switch self {
        case .notConfigured: return "no origin"
        case .http(let code, let body): return "native \(code) \(body)"
        }
    }
}

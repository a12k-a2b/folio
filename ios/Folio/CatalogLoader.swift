import Foundation

enum CatalogLoader {
    private static var cached: CatalogFile?

    private struct CatalogFile: Codable {
        var protocolName: String?
        var powersyncLocked: Bool?
        var books: [CatalogEntry]
        var full: [String: Book]

        enum CodingKeys: String, CodingKey {
            case protocolName = "protocol"
            case powersyncLocked
            case books
            case full
        }
    }

    static func load() -> (entries: [CatalogEntry], full: [String: Book]) {
        if let cached {
            return (cached.books, cached.full)
        }
        guard let url = Bundle.main.url(forResource: "catalog", withExtension: "json")
            ?? Bundle.main.url(forResource: "catalog", withExtension: "json", subdirectory: "Resources")
        else {
            return ([], [:])
        }
        do {
            let data = try Data(contentsOf: url)
            let file = try JSONDecoder().decode(CatalogFile.self, from: data)
            cached = file
            return (file.books, file.full)
        } catch {
            return ([], [:])
        }
    }

    static func entries() -> [CatalogEntry] {
        load().entries
    }

    static func book(_ id: String) -> Book? {
        load().full[id]
    }
}

import SwiftUI

struct LibraryView: View {
    @EnvironmentObject var store: FolioStore
    var onOpen: (String) -> Void
    var onSettings: () -> Void

    private var continueBook: CatalogEntry? {
        let last = store.allProgress().max { $0.updatedAt < $1.updatedAt }
        if let id = last?.bookId, let b = store.library.first(where: { $0.id == id }) { return b }
        return store.library.first
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header
                Rectangle().fill(FolioTheme.rule).frame(height: 1)

                Button { onOpen(ClubSeed.alexanderBook) } label: {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("A CIRCLE")
                            .font(FolioTheme.uiFont(size: 11, weight: .medium))
                            .tracking(2)
                            .foregroundStyle(FolioTheme.inkSoft)
                        Text("Alexander Circle")
                            .font(FolioTheme.pageFont(size: 26))
                            .foregroundStyle(FolioTheme.ink)
                        Text("You · Theo")
                            .font(FolioTheme.uiFont(size: 13))
                            .foregroundStyle(FolioTheme.inkSoft)
                        Text("Theo left voices on Living Structure. Open the book, tap a marked sentence, hear him, answer in yours.")
                            .font(FolioTheme.pageFont(size: 15))
                            .foregroundStyle(FolioTheme.ink)
                            .lineSpacing(4)
                            .padding(.top, 4)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(20)
                    .background(FolioTheme.paper2)
                    .overlay(Rectangle().stroke(FolioTheme.ink, lineWidth: 1))
                }
                .buttonStyle(.plain)

                if let cont = continueBook {
                    Button { onOpen(cont.id) } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("CONTINUE")
                                .font(FolioTheme.uiFont(size: 11, weight: .medium))
                                .tracking(2)
                                .foregroundStyle(FolioTheme.inkSoft)
                            Text(cont.title)
                                .font(FolioTheme.pageFont(size: 24))
                                .foregroundStyle(FolioTheme.ink)
                            Text(cont.author)
                                .font(FolioTheme.uiFont(size: 13))
                                .foregroundStyle(FolioTheme.inkSoft)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(20)
                        .overlay(Rectangle().stroke(FolioTheme.rule, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }

                Text("SHELF")
                    .font(FolioTheme.uiFont(size: 11, weight: .medium))
                    .tracking(2)
                    .foregroundStyle(FolioTheme.inkSoft)
                    .padding(.top, 4)

                LazyVGrid(columns: [GridItem(.flexible(), spacing: 20), GridItem(.flexible(), spacing: 20)], spacing: 20) {
                    ForEach(store.library) { book in
                        CoverCard(book: book) { onOpen(book.id) }
                    }
                }

                Text("Two taps a word, three a sentence. Hold the microphone when a feeling is faster than a keyboard. PowerSync is locked until this folio keeps a mark overnight.")
                    .font(FolioTheme.pageFont(size: 14))
                    .foregroundStyle(FolioTheme.inkSoft)
                    .lineSpacing(4)
                    .padding(.top, 8)
                    .padding(.bottom, 28)
            }
            .padding(.horizontal, 28)
            .padding(.top, 12)
        }
        .background(FolioTheme.paper.ignoresSafeArea())
    }

    private var header: some View {
        HStack {
            Color.clear.frame(width: 44, height: 44)
            VStack(spacing: 4) {
                Text("Folio")
                    .font(FolioTheme.pageFont(size: 32))
                    .foregroundStyle(FolioTheme.ink)
                Text("READ  ·  MARK  ·  SPEAK")
                    .font(FolioTheme.uiFont(size: 11, weight: .medium))
                    .tracking(2)
                    .foregroundStyle(FolioTheme.inkSoft)
            }
            .frame(maxWidth: .infinity)
            Button(action: onSettings) {
                Image(systemName: "gearshape")
                    .font(.system(size: 18, weight: .regular))
                    .foregroundStyle(FolioTheme.ink)
                    .frame(width: 44, height: 44)
            }
            .accessibilityLabel("Settings")
        }
    }
}

private struct CoverCard: View {
    let book: CatalogEntry
    let onClick: () -> Void

    var body: some View {
        Button(action: onClick) {
            VStack(alignment: .leading, spacing: 8) {
                ZStack {
                    Rectangle().fill(FolioTheme.paper2)
                    Circle()
                        .stroke(FolioTheme.ink, lineWidth: 1)
                        .frame(width: 44, height: 44)
                    Text(book.coverLabel.isEmpty ? "·" : book.coverLabel)
                        .font(FolioTheme.pageFont(size: 18))
                        .foregroundStyle(FolioTheme.ink)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 160)
                .overlay(Rectangle().stroke(FolioTheme.rule, lineWidth: 1))

                Text(book.title)
                    .font(FolioTheme.pageFont(size: 16))
                    .foregroundStyle(FolioTheme.ink)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                Text(book.author)
                    .font(FolioTheme.uiFont(size: 12))
                    .foregroundStyle(FolioTheme.inkSoft)
                    .lineLimit(1)
            }
        }
        .buttonStyle(.plain)
    }
}

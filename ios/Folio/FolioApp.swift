import SwiftUI

@main
struct FolioApp: App {
    @StateObject private var store = FolioStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .preferredColorScheme(.light)
                .tint(FolioTheme.ink)
        }
    }
}

private enum FolioRoute: Hashable {
    case read(String)
    case settings
}

struct RootView: View {
    @EnvironmentObject var store: FolioStore
    @State private var path: [FolioRoute] = []

    var body: some View {
        NavigationStack(path: $path) {
            LibraryView(
                onOpen: { id in path.append(.read(id)) },
                onSettings: { path.append(.settings) }
            )
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: FolioRoute.self) { route in
                switch route {
                case .read(let id):
                    ReaderView(bookId: id, onBack: { path.removeAll() })
                        .toolbar(.hidden, for: .navigationBar)
                case .settings:
                    SettingsView(onBack: { path.removeAll() })
                        .toolbar(.hidden, for: .navigationBar)
                }
            }
        }
        .background(FolioTheme.paper.ignoresSafeArea())
    }
}

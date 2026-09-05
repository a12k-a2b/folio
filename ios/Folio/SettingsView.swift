import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var store: FolioStore
    var onBack: () -> Void

    @State private var origin: String = ""
    @State private var token: String = ""
    @State private var status: String = ""
    @State private var pulling = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Button(action: onBack) {
                    Text("← SHELF")
                        .font(FolioTheme.uiFont(size: 11, weight: .medium))
                        .tracking(2)
                        .foregroundStyle(FolioTheme.inkSoft)
                }
                .padding(.bottom, 12)

                Text("Settings")
                    .font(FolioTheme.pageFont(size: 36))
                    .foregroundStyle(FolioTheme.ink)
                    .padding(.bottom, 24)

                label("Type size")
                seg(["S", "M", "L", "XL"], selected: store.settings.typeScale) { i in
                    store.saveSettings(mut { $0.typeScale = i })
                }

                label("Leading")
                let lead = ["tight", "normal", "loose"]
                let leadIdx = max(0, lead.firstIndex(of: store.settings.leading) ?? 1)
                seg(["Tight", "Book", "Loose"], selected: leadIdx) { i in
                    store.saveSettings(mut { $0.leading = lead[i] })
                }

                label("Justify")
                seg(["Off", "On"], selected: store.settings.justify ? 1 : 0) { i in
                    store.saveSettings(mut { $0.justify = i == 1 })
                }

                Text("HTTP V1")
                    .font(FolioTheme.uiFont(size: 11, weight: .medium))
                    .tracking(2)
                    .foregroundStyle(FolioTheme.inkSoft)
                    .padding(.top, 28)

                Text("Origin of the Folio server. Paste a session token from the web Settings after you sign in. Marks still write locally if this is empty.")
                    .font(FolioTheme.pageFont(size: 15))
                    .foregroundStyle(FolioTheme.inkSoft)
                    .lineSpacing(4)
                    .padding(.top, 8)
                    .padding(.bottom, 12)

                folioField("Origin", text: $origin) { store.setOrigin(origin) }
                    .padding(.bottom, 8)
                folioField("Bearer token", text: $token) { store.setToken(token) }

                Button {
                    pulling = true
                    status = ""
                    Task {
                        let msg = await store.pullAndPush(bookId: ClubSeed.alexanderBook)
                        status = msg
                        pulling = false
                    }
                } label: {
                    Text(pulling ? "PULLING…" : "PULL LIVING STRUCTURE")
                        .font(FolioTheme.uiFont(size: 11, weight: .medium))
                        .tracking(1.5)
                        .foregroundStyle(FolioTheme.paper)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(FolioTheme.ink)
                }
                .buttonStyle(.plain)
                .padding(.top, 12)
                .disabled(pulling)

                if !status.isEmpty {
                    Text(status)
                        .font(FolioTheme.pageFont(size: 14))
                        .foregroundStyle(FolioTheme.inkSoft)
                        .padding(.top, 8)
                }

                Text("POWERSYNC")
                    .font(FolioTheme.uiFont(size: 11, weight: .medium))
                    .tracking(2)
                    .foregroundStyle(FolioTheme.inkSoft)
                    .padding(.top, 32)

                Text(
                    store.powersyncLocked
                        ? "Locked. HTTP v1 is the only network until this folio and the Daylight have each kept a mark overnight."
                        : "Open — should not happen in this build."
                )
                .font(FolioTheme.pageFont(size: 16))
                .foregroundStyle(FolioTheme.ink)
                .lineSpacing(6)
                .padding(.top, 8)

                Text("folio-native/1 · JSON store · no PowerSync SDK")
                    .font(FolioTheme.uiFont(size: 11))
                    .foregroundStyle(FolioTheme.inkSoft)
                    .padding(.top, 16)
                    .padding(.bottom, 40)
            }
            .padding(28)
        }
        .background(FolioTheme.paper.ignoresSafeArea())
        .onAppear {
            origin = store.origin
            token = store.token
        }
    }

    private func mut(_ patch: (inout FolioSettings) -> Void) -> FolioSettings {
        var s = store.settings
        patch(&s)
        return s
    }

    private func label(_ text: String) -> some View {
        Text(text)
            .font(FolioTheme.pageFont(size: 17))
            .foregroundStyle(FolioTheme.ink)
            .padding(.top, 18)
            .padding(.bottom, 8)
    }

    private func seg(_ labels: [String], selected: Int, onSelect: @escaping (Int) -> Void) -> some View {
        HStack(spacing: 0) {
            ForEach(Array(labels.enumerated()), id: \.offset) { i, title in
                Button { onSelect(i) } label: {
                    Text(title.uppercased())
                        .font(FolioTheme.uiFont(size: 11, weight: .medium))
                        .tracking(1)
                        .foregroundStyle(i == selected ? FolioTheme.paper : FolioTheme.ink)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(i == selected ? FolioTheme.ink : FolioTheme.paper)
                }
                .buttonStyle(.plain)
            }
        }
        .overlay(Rectangle().stroke(FolioTheme.rule, lineWidth: 1))
    }

    private func folioField(_ label: String, text: Binding<String>, onCommit: @escaping () -> Void) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased())
                .font(FolioTheme.uiFont(size: 11, weight: .medium))
                .tracking(1.2)
                .foregroundStyle(FolioTheme.inkSoft)
            TextField("", text: text, onEditingChanged: { editing in
                if !editing { onCommit() }
            })
            .font(FolioTheme.uiFont(size: 15))
            .foregroundStyle(FolioTheme.ink)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .padding(12)
            .background(FolioTheme.paper2)
            .overlay(Rectangle().stroke(FolioTheme.rule, lineWidth: 1))
            .onSubmit(onCommit)
        }
    }
}

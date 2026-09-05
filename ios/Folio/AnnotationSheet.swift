import SwiftUI

struct AnnotationSheet: View {
    let highlight: Highlight
    let tags: [Tag]
    let voices: [VoiceNote]
    var autoPlayId: String?
    var onClose: () -> Void
    var onNote: (String) -> Void
    var onTags: ([String]) -> Void
    var onVoice: (VoiceCapture) -> Void
    var onDelete: () -> Void
    var onAddTag: (String) -> Tag

    @State private var note: String = ""
    @State private var more = false
    @State private var newTag = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("ON THIS SENTENCE")
                    .font(FolioTheme.uiFont(size: 11, weight: .medium))
                    .tracking(1.6)
                    .foregroundStyle(FolioTheme.inkSoft)
                Spacer()
                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.system(size: 13, weight: .regular))
                        .foregroundStyle(FolioTheme.ink)
                        .frame(width: 40, height: 40)
                }
                .accessibilityLabel("Close")
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)

            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Text(highlight.text)
                        .font(FolioTheme.pageFont(size: 17))
                        .foregroundStyle(FolioTheme.ink)
                        .lineSpacing(3)

                    Text("\(highlight.isCompanion ? highlight.authorName : (highlight.authorName.isEmpty ? "You" : highlight.authorName)) marked this")
                        .font(FolioTheme.uiFont(size: 11))
                        .tracking(0.4)
                        .foregroundStyle(FolioTheme.inkSoft)

                    if !highlight.tagIds.isEmpty {
                        FlowTags(tags: tags.filter { highlight.tagIds.contains($0.id) }, selected: Set(highlight.tagIds), onTap: { _ in })
                    }

                    ForEach(voices) { v in
                        VoiceBubble(
                            note: v,
                            mine: v.authorId == "local" && !v.isCompanion,
                            autoPlay: autoPlayId == v.id
                        )
                    }

                    VoicePad(
                        enabled: true,
                        compact: false,
                        label: voices.isEmpty
                            ? "Hold to leave a voice on this sentence"
                            : "Hold to reply in your voice",
                        onCaptured: onVoice
                    )

                    Button {
                        more.toggle()
                    } label: {
                        Text(more ? "HIDE NOTE AND TAGS" : "A WRITTEN NOTE, OR TAGS")
                            .font(FolioTheme.uiFont(size: 11, weight: .medium))
                            .tracking(1.4)
                            .foregroundStyle(FolioTheme.inkSoft)
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 4)

                    if more {
                        TextEditor(text: $note)
                            .font(FolioTheme.pageFont(size: 15))
                            .foregroundStyle(FolioTheme.ink)
                            .scrollContentBackground(.hidden)
                            .frame(minHeight: 72)
                            .padding(10)
                            .background(FolioTheme.paper2)
                            .overlay(Rectangle().stroke(FolioTheme.rule, lineWidth: 1))
                            .onChange(of: note) { _, value in
                                // persist on dismiss; also live-save after pause below
                            }
                            .onDisappear {
                                if note != highlight.note { onNote(note) }
                            }

                        FlexibleTagRow(tags: tags, selected: Set(highlight.tagIds)) { tag in
                            var next = highlight.tagIds
                            if let i = next.firstIndex(of: tag.id) { next.remove(at: i) }
                            else { next.append(tag.id) }
                            onTags(next)
                        }

                        HStack(spacing: 8) {
                            TextField("Make a tag — a person, a courtyard…", text: $newTag)
                                .font(FolioTheme.pageFont(size: 15))
                                .padding(.horizontal, 12)
                                .frame(height: 44)
                                .overlay(Rectangle().stroke(FolioTheme.rule, lineWidth: 1))
                            Button {
                                let name = newTag.trimmingCharacters(in: .whitespacesAndNewlines)
                                guard !name.isEmpty else { return }
                                let t = onAddTag(name)
                                newTag = ""
                                onTags(highlight.tagIds + [t.id])
                            } label: {
                                Text("ADD")
                                    .font(FolioTheme.uiFont(size: 11, weight: .medium))
                                    .tracking(1)
                                    .foregroundStyle(FolioTheme.ink)
                                    .frame(height: 44)
                                    .padding(.horizontal, 12)
                                    .overlay(Rectangle().stroke(FolioTheme.rule, lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                        }

                        if !highlight.isCompanion {
                            HStack {
                                Spacer()
                                Button(action: onDelete) {
                                    Text("REMOVE MARK")
                                        .font(FolioTheme.uiFont(size: 12, weight: .medium))
                                        .tracking(1)
                                        .foregroundStyle(FolioTheme.inkSoft)
                                }
                                .buttonStyle(.plain)
                            }
                            .padding(.top, 8)
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 28)
            }
            .frame(maxHeight: 420)
        }
        .background(FolioTheme.paper)
        .overlay(Rectangle().stroke(FolioTheme.rule, lineWidth: 1))
        .shadow(color: FolioTheme.ink.opacity(0.12), radius: 24, y: -8)
        .onAppear {
            note = highlight.note
            more = !highlight.note.isEmpty || !highlight.tagIds.isEmpty
        }
        .onChange(of: highlight.id) { _, _ in
            note = highlight.note
            more = !highlight.note.isEmpty || !highlight.tagIds.isEmpty
        }
    }
}

private struct FlexibleTagRow: View {
    let tags: [Tag]
    let selected: Set<String>
    var onTap: (Tag) -> Void

    var body: some View {
        FlowLayout(spacing: 8) {
            ForEach(tags) { tag in
                let on = selected.contains(tag.id)
                Button { onTap(tag) } label: {
                    Text(tag.name)
                        .font(FolioTheme.uiFont(size: 13))
                        .foregroundStyle(on ? FolioTheme.ink : FolioTheme.inkSoft)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(on ? FolioTheme.paper2 : FolioTheme.paper)
                        .overlay(Rectangle().stroke(on ? FolioTheme.ink : FolioTheme.rule, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

private struct FlowTags: View {
    let tags: [Tag]
    let selected: Set<String>
    var onTap: (Tag) -> Void

    var body: some View {
        FlowLayout(spacing: 6) {
            ForEach(tags) { tag in
                Text(tag.name)
                    .font(FolioTheme.uiFont(size: 11))
                    .tracking(0.6)
                    .foregroundStyle(FolioTheme.ink)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .overlay(Rectangle().stroke(FolioTheme.rule, lineWidth: 1))
            }
        }
    }
}

/// Simple wrapping layout for tag chips.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxW = proposal.width ?? 320
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowH: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x + s.width > maxW, x > 0 {
                x = 0
                y += rowH + spacing
                rowH = 0
            }
            rowH = max(rowH, s.height)
            x += s.width + spacing
        }
        return CGSize(width: maxW, height: y + rowH)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowH: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x + s.width > bounds.maxX, x > bounds.minX {
                x = bounds.minX
                y += rowH + spacing
                rowH = 0
            }
            v.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(s))
            rowH = max(rowH, s.height)
            x += s.width + spacing
        }
    }
}

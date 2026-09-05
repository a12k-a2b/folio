import SwiftUI
import UIKit

struct ReaderView: View {
    @EnvironmentObject var store: FolioStore
    let bookId: String
    var onBack: () -> Void

    @State private var chapterIndex = 0
    @State private var pageIndex = 0
    @State private var pages: [PageSlice] = [PageSlice(start: 0, end: 0)]
    @State private var attributed = NSAttributedString()
    @State private var chrome = true
    @State private var activeId: String?
    @State private var autoPlayId: String?
    @State private var draft: NSRange?
    @State private var pageSize: CGSize = .zero
    @State private var hint = true

    private var book: Book? { store.book(bookId) }
    private var chapter: Chapter? {
        guard let book, book.chapters.indices.contains(chapterIndex) else { return nil }
        return book.chapters[chapterIndex]
    }
    private var highlights: [Highlight] {
        guard let chapter else { return [] }
        return store.highlights(bookId).filter { $0.chapterId == chapter.id }
    }
    private var voices: [VoiceNote] { store.voices(bookId) }
    private var active: Highlight? { highlights.first { $0.id == activeId } }
    private var pageCount: Int { max(1, pages.count) }
    private var bookmarked: Bool {
        store.bookmarkOnPage(bookId: bookId, chapterIndex: chapterIndex, pageIndex: pageIndex) != nil
    }

    var body: some View {
        GeometryReader { geo in
            let topPad: CGFloat = 56
            let botPad: CGFloat = 88
            let sidePad: CGFloat = 22
            let canvas = CGSize(
                width: max(40, geo.size.width - sidePad * 2),
                height: max(80, geo.size.height - topPad - botPad)
            )

            ZStack(alignment: .top) {
                FolioTheme.paper.ignoresSafeArea()

                VStack(spacing: 0) {
                    chromeBar
                        .opacity(chrome ? 1 : 0)
                        .frame(height: topPad)
                        .allowsHitTesting(chrome)

                    pageCanvas(size: canvas)
                        .frame(width: canvas.width, height: canvas.height)
                        .frame(maxWidth: .infinity)

                    Spacer(minLength: 0)
                }

                VStack {
                    Spacer()
                    thumbBar
                        .padding(.bottom, 10)
                }

                if hint {
                    VStack {
                        Spacer()
                        Text("Two taps a word · three a sentence · hold to speak")
                            .font(FolioTheme.uiFont(size: 11, weight: .medium))
                            .tracking(0.6)
                            .foregroundStyle(FolioTheme.inkSoft)
                            .padding(.bottom, 100)
                    }
                    .allowsHitTesting(false)
                }

                if let h = active {
                    VStack {
                        Spacer()
                        AnnotationSheet(
                            highlight: h,
                            tags: store.tags(),
                            voices: store.voicesForHighlight(h.id),
                            autoPlayId: autoPlayId,
                            onClose: {
                                activeId = nil
                                autoPlayId = nil
                            },
                            onNote: { store.updateHighlight(id: h.id, note: $0, tagIds: nil) },
                            onTags: { store.updateHighlight(id: h.id, note: nil, tagIds: $0) },
                            onVoice: { cap in
                                _ = store.addVoice(
                                    highlightId: h.id,
                                    transcript: "",
                                    audioB64: cap.b64,
                                    mime: cap.mime,
                                    durationMs: cap.durationMs
                                )
                            },
                            onDelete: {
                                store.deleteHighlight(h.id)
                                activeId = nil
                            },
                            onAddTag: { name in store.addTag(name: name) }
                        )
                        .padding(.horizontal, 12)
                        .padding(.bottom, 8)
                    }
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .onAppear {
                restoreProgress()
                rebuild(size: canvas)
            }
            .onChange(of: canvas) { _, new in
                rebuild(size: new)
            }
            .onChange(of: store.settings) { _, _ in
                rebuild(size: canvas)
            }
            .onChange(of: chapterIndex) { _, _ in
                rebuild(size: canvas)
            }
        }
        .statusBarHidden(!chrome)
    }

    private var chromeBar: some View {
        HStack {
            Button(action: onBack) {
                HStack(spacing: 4) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 14, weight: .regular))
                    Text("SHELF")
                        .font(FolioTheme.uiFont(size: 11, weight: .medium))
                        .tracking(1.6)
                }
                .foregroundStyle(FolioTheme.ink)
                .frame(minWidth: 72, alignment: .leading)
            }
            .buttonStyle(.plain)

            VStack(spacing: 2) {
                Text(book?.title ?? "")
                    .font(FolioTheme.pageFont(size: 16))
                    .foregroundStyle(FolioTheme.ink)
                    .lineLimit(1)
                Text(chapter?.title ?? "")
                    .font(FolioTheme.uiFont(size: 11))
                    .foregroundStyle(FolioTheme.inkSoft)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity)

            Button(action: toggleBookmark) {
                Image(systemName: bookmarked ? "bookmark.fill" : "bookmark")
                    .font(.system(size: 16, weight: .regular))
                    .foregroundStyle(FolioTheme.ink)
                    .frame(width: 44, height: 44)
            }
            .accessibilityLabel("Bookmark")
        }
        .padding(.horizontal, 16)
    }

    private var thumbBar: some View {
        HStack(alignment: .bottom) {
            Button { go(-1) } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 22, weight: .light))
                    .foregroundStyle(FolioTheme.ink.opacity(canPrev ? 1 : 0.28))
                    .frame(width: 56, height: 56)
            }
            .buttonStyle(.plain)
            .disabled(!canPrev)
            .opacity(chrome ? 1 : 0)

            Spacer()

            VStack(spacing: 6) {
                if chrome {
                    Text(pageLabel)
                        .font(FolioTheme.uiFont(size: 11, weight: .medium))
                        .tracking(1.4)
                        .foregroundStyle(FolioTheme.inkFaint)
                        .monospacedDigit()
                    Button(action: toggleBookmark) {
                        Image(systemName: bookmarked ? "bookmark.fill" : "bookmark")
                            .font(.system(size: 16))
                            .foregroundStyle(FolioTheme.ink)
                    }
                    .buttonStyle(.plain)
                }
            }

            Spacer()

            VoicePad(
                enabled: active != nil,
                compact: true,
                onCaptured: { cap in
                    guard let h = active else { return }
                    _ = store.addVoice(
                        highlightId: h.id,
                        transcript: "",
                        audioB64: cap.b64,
                        mime: cap.mime,
                        durationMs: cap.durationMs
                    )
                }
            )
            .padding(.trailing, 4)

            Button { go(1) } label: {
                Image(systemName: "chevron.right")
                    .font(.system(size: 22, weight: .light))
                    .foregroundStyle(FolioTheme.ink.opacity(canNext ? 1 : 0.28))
                    .frame(width: 44, height: 56)
            }
            .buttonStyle(.plain)
            .disabled(!canNext)
            .opacity(chrome ? 1 : 0)
        }
        .padding(.horizontal, 8)
    }

    private var pageLabel: String {
        "CH \(chapterIndex + 1)  ·  \(pageIndex + 1)/\(pageCount)"
    }

    private var canPrev: Bool { pageIndex > 0 || chapterIndex > 0 }
    private var canNext: Bool {
        guard let book else { return false }
        return pageIndex < pageCount - 1 || chapterIndex < book.chapters.count - 1
    }

    @ViewBuilder
    private func pageCanvas(size: CGSize) -> some View {
        let slice = pages.indices.contains(pageIndex) ? pages[pageIndex] : PageSlice(start: 0, end: attributed.length)
        FolioPageView(
            attributed: attributed,
            page: slice,
            highlights: highlights.map { h in
                FolioMark(
                    id: h.id,
                    start: h.startOffset,
                    end: h.endOffset,
                    companion: h.isCompanion,
                    hasVoice: voices.contains(where: { $0.highlightId == h.id })
                )
            },
            draft: draft,
            activeId: activeId,
            size: size,
            onEvent: handle
        )
        .id("\(chapter?.id ?? "")-\(pageIndex)-\(Int(size.width))x\(Int(size.height))-\(store.settings.typeScale)-\(store.settings.leading)-\(store.settings.justify)")
    }

    private func handle(_ event: PageEvent) {
        hint = false
        switch event {
        case .chrome:
            if activeId != nil {
                activeId = nil
                autoPlayId = nil
            } else {
                chrome.toggle()
            }
        case .next:
            chrome = false
            go(1)
        case .prev:
            chrome = false
            go(-1)
        case .openMark(let id):
            chrome = true
            activeId = id
            autoPlayId = voices.first(where: { $0.highlightId == id })?.id
        case .mark(let range):
            commitMark(range)
        case .draft(let range):
            draft = range
        case .taps(let count, let offset):
            guard let chapter else { return }
            let plain = attributed.string
            let span: NSRange
            if count >= 4 {
                span = HtmlText.expandParagraph(plain, offset: offset)
            } else if count >= 3 {
                span = HtmlText.expandSentence(plain, offset: offset)
            } else {
                span = HtmlText.expandWord(plain, offset: offset)
            }
            commitMark(span)
        }
    }

    private func commitMark(_ range: NSRange) {
        draft = nil
        guard let chapter, range.length >= 2 else { return }
        let start = range.location
        let end = range.location + range.length
        if let overlap = highlights.first(where: { !(end <= $0.startOffset || start >= $0.endOffset) }) {
            activeId = overlap.id
            chrome = true
            autoPlayId = voices.first(where: { $0.highlightId == overlap.id })?.id
            return
        }
        let text = HtmlText.slice(attributed.string, range: range)
        guard text.count >= 2 else { return }
        let h = store.addHighlight(bookId: bookId, chapterId: chapter.id, start: start, end: end, text: text)
        activeId = h.id
        chrome = true
        let names = suggestTags(text)
        let ids = store.tags().filter { names.contains($0.name) }.map(\.id)
        if !ids.isEmpty {
            store.updateHighlight(id: h.id, note: nil, tagIds: ids)
        }
    }

    private func suggestTags(_ text: String) -> [String] {
        let lowered = text.lowercased()
        var names = Set<String>()
        for t in store.tags() where t.name.count > 2 && lowered.contains(t.name.lowercased()) {
            names.insert(t.name)
        }
        let person = lowered.range(of: #"\b(alexander|thoreau|vitruvius|okakura|marcus|aurelius|maya|theo|kakuz)\b"#, options: .regularExpression) != nil
        let place = lowered.range(of: #"\b(kyoto|walden|courtyard|kitchen|san francisco|garden|rome|pond|street|plaza)\b"#, options: .regularExpression) != nil
        let bookish = lowered.range(of: #"\b(book|volume|chapter|meditations|walden|vitruvius|pattern language)\b"#, options: .regularExpression) != nil
        let idea = lowered.range(of: #"\b(center|pattern|structure|feeling|life|simplicity|solitude|proportion)\b"#, options: .regularExpression) != nil
        for t in store.tags() {
            if t.kind == "person" && person { names.insert(t.name) }
            if t.kind == "place" && place { names.insert(t.name) }
            if t.kind == "book" && bookish { names.insert(t.name) }
            if t.kind == "idea" && idea { names.insert(t.name) }
            if t.kind == "quote" && (text.count > 80 || text.first?.isUppercase == true) { names.insert(t.name) }
            if t.kind == "question" && text.contains("?") { names.insert(t.name) }
        }
        return Array(names.prefix(3))
    }

    private func go(_ dir: Int) {
        guard let book else { return }
        if dir > 0 {
            if pageIndex < pageCount - 1 {
                pageIndex += 1
            } else if chapterIndex < book.chapters.count - 1 {
                chapterIndex += 1
                pageIndex = 0
            }
        } else {
            if pageIndex > 0 {
                pageIndex -= 1
            } else if chapterIndex > 0 {
                chapterIndex -= 1
                pageIndex = 9999
            }
        }
        persistProgress()
    }

    private func toggleBookmark() {
        if let b = store.bookmarkOnPage(bookId: bookId, chapterIndex: chapterIndex, pageIndex: pageIndex) {
            store.deleteBookmark(b.id)
        } else {
            let label = "\(book?.title ?? "") · \(chapter?.title ?? "") · p.\(pageIndex + 1)"
            _ = store.addBookmark(bookId: bookId, chapterIndex: chapterIndex, pageIndex: pageIndex, label: label)
        }
    }

    private func restoreProgress() {
        if let p = store.progress(bookId) {
            chapterIndex = p.chapterIndex
            pageIndex = p.pageIndex
        }
    }

    private func rebuild(size: CGSize) {
        guard size.width > 8, size.height > 8 else { return }
        let same = abs(pageSize.width - size.width) < 0.5 && abs(pageSize.height - size.height) < 0.5
        pageSize = size
        guard let chapter else { return }
        let fontSize = FolioTheme.typeSize(store.settings.typeScale)
        let leading = store.settings.leadingMul()
        attributed = HtmlText.attributed(
            chapter.html,
            fontSize: fontSize,
            leading: leading,
            justify: store.settings.justify
        )
        pages = PageEngine.paginate(attributed, size: size)
        if pageIndex >= pages.count {
            pageIndex = max(0, pages.count - 1)
        }
        persistProgress()
        _ = same
    }

    private func persistProgress() {
        guard let book else { return }
        let pct = ((Double(chapterIndex) + (pageCount > 0 ? Double(pageIndex + 1) / Double(pageCount) : 0))
            / Double(max(1, book.chapters.count))) * 100
        let loc = "\(chapter?.id ?? ""):\(pageIndex)"
        store.saveProgress(
            Progress(
                bookId: bookId,
                chapterIndex: chapterIndex,
                pageIndex: pageIndex,
                percent: min(100, pct),
                locator: loc,
                updatedAt: FolioNow.iso()
            )
        )
    }
}

struct FolioMark: Equatable {
    var id: String
    var start: Int
    var end: Int
    var companion: Bool
    var hasVoice: Bool
}

enum PageEvent {
    case chrome
    case next
    case prev
    case openMark(String)
    case mark(NSRange)
    case draft(NSRange?)
    case taps(count: Int, offset: Int)
}

struct FolioPageView: UIViewRepresentable {
    var attributed: NSAttributedString
    var page: PageSlice
    var highlights: [FolioMark]
    var draft: NSRange?
    var activeId: String?
    var size: CGSize
    var onEvent: (PageEvent) -> Void

    func makeUIView(context: Context) -> FolioPageCanvas {
        let v = FolioPageCanvas()
        v.onEvent = onEvent
        v.apply(attributed: attributed, page: page, highlights: highlights, draft: draft, activeId: activeId)
        return v
    }

    func updateUIView(_ uiView: FolioPageCanvas, context: Context) {
        uiView.onEvent = onEvent
        uiView.apply(attributed: attributed, page: page, highlights: highlights, draft: draft, activeId: activeId)
    }
}

final class FolioPageCanvas: UIView {
    var onEvent: ((PageEvent) -> Void)?

    private var attributed = NSAttributedString()
    private var page = PageSlice(start: 0, end: 0)
    private var highlights: [FolioMark] = []
    private var draft: NSRange?
    private var activeId: String?
    private var storage = NSTextStorage()
    private let layoutManager = NSLayoutManager()
    private let container = NSTextContainer(size: .zero)

    private var startPoint: CGPoint = .zero
    private var startTime: TimeInterval = 0
    private var startOffset: Int?
    private var tapCount = 0
    private var lastTapAt: TimeInterval = 0
    private var moved = false
    private var dragging = false
    private var dragRange: NSRange?
    private var longPress: Timer?
    private var commitTap: Timer?

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = FolioTheme.paperUI
        isMultipleTouchEnabled = false
        container.lineFragmentPadding = 0
        layoutManager.addTextContainer(container)
        storage.addLayoutManager(layoutManager)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:)") }

    func apply(
        attributed: NSAttributedString,
        page: PageSlice,
        highlights: [FolioMark],
        draft: NSRange?,
        activeId: String?
    ) {
        self.attributed = attributed
        self.page = page
        self.highlights = highlights
        self.draft = draft
        self.activeId = activeId
        let range = page.nsRange
        let safe = NSRange(
            location: min(range.location, attributed.length),
            length: max(0, min(range.length, attributed.length - min(range.location, attributed.length)))
        )
        storage.setAttributedString(attributed.attributedSubstring(from: safe))
        setNeedsDisplay()
        setNeedsLayout()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        container.size = bounds.size
        layoutManager.ensureLayout(for: container)
        setNeedsDisplay()
    }

    override func draw(_ rect: CGRect) {
        FolioTheme.paperUI.setFill()
        UIRectFill(rect)
        layoutManager.ensureLayout(for: container)
        let origin = CGPoint.zero

        func fill(_ range: NSRange, color: UIColor) {
            let local = NSIntersectionRange(range, NSRange(location: 0, length: storage.length))
            if local.length <= 0 { return }
            for r in PageEngine.glyphRects(in: layoutManager, container: container, range: local) {
                color.setFill()
                UIBezierPath(rect: r).fill()
            }
        }

        for h in highlights {
            let chapter = NSRange(location: h.start, length: max(0, h.end - h.start))
            let pageRange = page.nsRange
            let inter = NSIntersectionRange(chapter, pageRange)
            if inter.length <= 0 { continue }
            let local = NSRange(location: inter.location - page.start, length: inter.length)
            let active = h.id == activeId
            let color = (active || h.companion) ? FolioTheme.markStrongUI : FolioTheme.markUI
            fill(local, color: color)
        }
        if let draft {
            let inter = NSIntersectionRange(draft, page.nsRange)
            if inter.length > 0 {
                fill(NSRange(location: inter.location - page.start, length: inter.length), color: FolioTheme.markUI.withAlphaComponent(0.7))
            }
        }

        let glyphs = layoutManager.glyphRange(for: container)
        layoutManager.drawGlyphs(forGlyphRange: glyphs, at: origin)
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let t = touches.first else { return }
        startPoint = t.location(in: self)
        startTime = Date().timeIntervalSince1970
        startOffset = chapterOffset(at: startPoint)
        moved = false
        dragging = false
        dragRange = nil
        longPress?.invalidate()
        commitTap?.invalidate()
        let now = startTime
        if now - lastTapAt < 0.34 {
            tapCount += 1
        } else {
            tapCount = 1
        }
        lastTapAt = now
        longPress = Timer.scheduledTimer(withTimeInterval: 0.28, repeats: false) { [weak self] _ in
            self?.beginDrag()
        }
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let t = touches.first else { return }
        let p = t.location(in: self)
        if hypot(p.x - startPoint.x, p.y - startPoint.y) > 10 { moved = true }
        if dragging || (moved && dragRange != nil) {
            dragging = true
            longPress?.invalidate()
            if let off = chapterOffset(at: p), let start = startOffset {
                let word = HtmlText.expandWord(attributed.string, offset: start)
                let a = min(word.location, off)
                let b = max(word.location + word.length, off + 1)
                let r = NSRange(location: a, length: b - a)
                dragRange = r
                onEvent?(.draft(r))
            }
        }
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        longPress?.invalidate()
        guard let t = touches.first else { return }
        let p = t.location(in: self)
        let dx = p.x - startPoint.x
        let dt = Date().timeIntervalSince1970 - startTime

        if dragging, let r = dragRange {
            onEvent?(.draft(nil))
            onEvent?(.mark(r))
            dragging = false
            tapCount = 0
            return
        }

        if let id = markId(at: startPoint), !moved {
            tapCount = 0
            onEvent?(.openMark(id))
            return
        }

        if abs(dx) > 56 && dt < 0.6 && moved {
            tapCount = 0
            onEvent?(dx < 0 ? .next : .prev)
            return
        }

        let count = tapCount
        let offset = startOffset
        let x = p.x
        commitTap = Timer.scheduledTimer(withTimeInterval: 0.30, repeats: false) { [weak self] _ in
            guard let self else { return }
            if count >= 2, let offset {
                self.onEvent?(.taps(count: count, offset: offset))
                self.tapCount = 0
                return
            }
            if count == 1 {
                let w = self.bounds.width
                if x < w / 3 {
                    self.onEvent?(.prev)
                } else if x > w * 2 / 3 {
                    self.onEvent?(.next)
                } else {
                    self.onEvent?(.chrome)
                }
            }
            self.tapCount = 0
        }
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        longPress?.invalidate()
        commitTap?.invalidate()
        dragging = false
        onEvent?(.draft(nil))
    }

    deinit {
        longPress?.invalidate()
        commitTap?.invalidate()
    }

    private func beginDrag() {
        guard !moved, let start = startOffset else { return }
        dragging = true
        let word = HtmlText.expandWord(attributed.string, offset: start)
        dragRange = word
        onEvent?(.draft(word))
    }

    private func chapterOffset(at point: CGPoint) -> Int? {
        if storage.length == 0 { return page.start }
        var fraction: CGFloat = 0
        let local = layoutManager.characterIndex(
            for: point,
            in: container,
            fractionOfDistanceBetweenInsertionPoints: &fraction
        )
        let used = layoutManager.usedRect(for: container)
        if point.y > used.maxY + 12 { return nil }
        return page.start + min(local, max(0, storage.length - 1))
    }

    private func markId(at point: CGPoint) -> String? {
        guard let off = chapterOffset(at: point) else { return nil }
        return highlights.first { off >= $0.start && off < $0.end }?.id
    }
}

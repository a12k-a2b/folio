import UIKit

struct PageSlice: Equatable, Hashable {
    var start: Int
    var end: Int

    var nsRange: NSRange { NSRange(location: start, length: max(0, end - start)) }
    var length: Int { max(0, end - start) }
}

enum PageEngine {
    static func paginate(_ text: NSAttributedString, size: CGSize) -> [PageSlice] {
        let n = text.length
        if n == 0 || size.width <= 8 || size.height <= 8 {
            return [PageSlice(start: 0, end: n)]
        }
        var pages: [PageSlice] = []
        var start = 0
        while start < n {
            var lo = start + 1
            var hi = n
            var best = min(start + 1, n)
            while lo <= hi {
                let mid = (lo + hi) / 2
                let slice = text.attributedSubstring(from: NSRange(location: start, length: mid - start))
                let h = measuredHeight(slice, width: size.width)
                if h <= size.height {
                    best = mid
                    lo = mid + 1
                } else {
                    hi = mid - 1
                }
            }
            var end = best
            if end < n {
                let raw = (text.string as NSString)
                let searchEnd = max(start, end)
                let window = NSRange(location: start, length: searchEnd - start)
                let snap = raw.range(of: " ", options: .backwards, range: window)
                if snap.location != NSNotFound && snap.location > start + 8 {
                    end = snap.location + 1
                }
            }
            if end <= start { end = min(start + 1, n) }
            pages.append(PageSlice(start: start, end: end))
            start = end
            if pages.count > 400 { break }
        }
        return pages.isEmpty ? [PageSlice(start: 0, end: n)] : pages
    }

    static func measuredHeight(_ text: NSAttributedString, width: CGFloat) -> CGFloat {
        let storage = NSTextStorage(attributedString: text)
        let lm = NSLayoutManager()
        let container = NSTextContainer(size: CGSize(width: width, height: .greatestFiniteMagnitude))
        container.lineFragmentPadding = 0
        lm.addTextContainer(container)
        storage.addLayoutManager(lm)
        lm.ensureLayout(for: container)
        return ceil(lm.usedRect(for: container).height)
    }

    static func layout(_ text: NSAttributedString, size: CGSize) -> (NSTextStorage, NSLayoutManager, NSTextContainer) {
        let storage = NSTextStorage(attributedString: text)
        let lm = NSLayoutManager()
        let container = NSTextContainer(size: size)
        container.lineFragmentPadding = 0
        container.maximumNumberOfLines = 0
        lm.addTextContainer(container)
        storage.addLayoutManager(lm)
        lm.ensureLayout(for: container)
        return (storage, lm, container)
    }

    static func glyphRects(in lm: NSLayoutManager, container: NSTextContainer, range: NSRange) -> [CGRect] {
        var rects: [CGRect] = []
        if range.length <= 0 { return rects }
        let glyphRange = lm.glyphRange(forCharacterRange: range, actualCharacterRange: nil)
        lm.enumerateLineFragments(forGlyphRange: glyphRange) { _, used, _, lineGlyphs, _ in
            let overlap = NSIntersectionRange(glyphRange, lineGlyphs)
            if overlap.length == 0 { return }
            var rect = lm.boundingRect(forGlyphRange: overlap, in: container)
            rect.origin.y = used.origin.y
            rect.size.height = max(used.height, rect.height)
            rects.append(rect.insetBy(dx: -1, dy: 1))
        }
        return rects
    }
}

import UIKit

enum HtmlText {
    struct Parsed {
        var text: String
        var italic: [NSRange]
        var bold: [NSRange]
        var quote: [NSRange]
        var heading: [NSRange]
        var kicker: [NSRange]
    }

    static func htmlToPlain(_ html: String) -> String {
        parse(html).text
    }

    static func attributed(
        _ html: String,
        fontSize: CGFloat,
        leading: CGFloat,
        justify: Bool,
        ink: UIColor = FolioTheme.inkUI,
        inkSoft: UIColor = FolioTheme.inkSoftUI
    ) -> NSAttributedString {
        let parsed = parse(html)
        let font = FolioTheme.serif(ofSize: fontSize)
        let italic = FolioTheme.serifItalic(ofSize: fontSize)
        let heading = FolioTheme.serif(ofSize: fontSize + 4, weight: .medium)
        let kicker = FolioTheme.serif(ofSize: max(11, fontSize - 8), weight: .medium)
        let quoteFont = FolioTheme.serifItalic(ofSize: max(16, fontSize - 2))

        let para = NSMutableParagraphStyle()
        para.alignment = justify ? .justified : .left
        para.minimumLineHeight = fontSize * leading
        para.maximumLineHeight = fontSize * leading
        para.paragraphSpacing = 0
        para.hyphenationFactor = justify ? 0.6 : 0

        let ns = NSMutableAttributedString(
            string: parsed.text,
            attributes: [
                .font: font,
                .foregroundColor: ink,
                .paragraphStyle: para,
                .kern: 0.1,
            ]
        )
        let len = ns.length
        func clamp(_ r: NSRange) -> NSRange {
            let loc = max(0, min(r.location, len))
            let end = max(loc, min(r.location + r.length, len))
            return NSRange(location: loc, length: end - loc)
        }
        for r in parsed.italic {
            let c = clamp(r)
            if c.length > 0 { ns.addAttribute(.font, value: italic, range: c) }
        }
        for r in parsed.bold {
            let c = clamp(r)
            if c.length > 0 {
                ns.addAttribute(.font, value: FolioTheme.serif(ofSize: fontSize, weight: .medium), range: c)
            }
        }
        for r in parsed.quote {
            let c = clamp(r)
            if c.length > 0 {
                ns.addAttributes([.font: quoteFont, .foregroundColor: inkSoft], range: c)
            }
        }
        for r in parsed.heading {
            let c = clamp(r)
            if c.length > 0 { ns.addAttribute(.font, value: heading, range: c) }
        }
        for r in parsed.kicker {
            let c = clamp(r)
            if c.length > 0 {
                ns.addAttributes(
                    [
                        .font: kicker,
                        .foregroundColor: inkSoft,
                        .kern: 1.4,
                    ],
                    range: c
                )
            }
        }
        return ns
    }

    static func findQuote(_ plain: String, quote: String) -> NSRange? {
        let ns = plain as NSString
        let found = ns.range(of: quote)
        if found.location != NSNotFound { return found }
        let collapsed = quote.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let t2 = ns.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression, range: NSRange(location: 0, length: ns.length))
        let s2 = (t2 as NSString).range(of: collapsed)
        if s2.location == NSNotFound { return nil }
        return s2
    }

    static func expandWord(_ text: String, offset: Int) -> NSRange {
        let ns = text as NSString
        let n = ns.length
        if n == 0 { return NSRange(location: 0, length: 0) }
        var s = max(0, min(offset, n - 1))
        var e = s
        while s > 0 && isWordChar(ns.character(at: s - 1)) { s -= 1 }
        while e < n && isWordChar(ns.character(at: e)) { e += 1 }
        if s == e && e < n { e += 1 }
        return NSRange(location: s, length: e - s)
    }

    static func expandSentence(_ text: String, offset: Int) -> NSRange {
        let ns = text as NSString
        let n = ns.length
        if n == 0 { return NSRange(location: 0, length: 0) }
        let o = max(0, min(offset, n - 1))
        var s = o
        var e = o
        func isEnd(_ c: unichar) -> Bool {
            c == 0x2E || c == 0x21 || c == 0x3F || c == 0x0A || c == 0x2026
        }
        while s > 0 && !isEnd(ns.character(at: s - 1)) { s -= 1 }
        while s < n && isspace(Int32(ns.character(at: s))) != 0 { s += 1 }
        while e < n && !isEnd(ns.character(at: e)) { e += 1 }
        if e < n && isEnd(ns.character(at: e)) { e += 1 }
        return NSRange(location: s, length: min(e, n) - s)
    }

    static func expandParagraph(_ text: String, offset: Int) -> NSRange {
        let ns = text as NSString
        let n = ns.length
        if n == 0 { return NSRange(location: 0, length: 0) }
        let o = max(0, min(offset, n - 1))
        let before = ns.range(of: "\n\n", options: .backwards, range: NSRange(location: 0, length: o))
        let s = before.location == NSNotFound ? 0 : before.location + 2
        let after = ns.range(of: "\n\n", options: [], range: NSRange(location: o, length: n - o))
        let e = after.location == NSNotFound ? n : after.location
        return NSRange(location: s, length: e - s)
    }

    static func slice(_ text: String, range: NSRange) -> String {
        let ns = text as NSString
        let loc = max(0, min(range.location, ns.length))
        let len = max(0, min(range.length, ns.length - loc))
        return ns.substring(with: NSRange(location: loc, length: len))
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func isWordChar(_ c: unichar) -> Bool {
        guard let scalar = UnicodeScalar(c) else { return false }
        if CharacterSet.alphanumerics.contains(scalar) { return true }
        return c == 0x27 || c == 0x2019 || c == 0x2D || c == 0x2013
    }

    static func parse(_ html: String) -> Parsed {
        let plain = NSMutableString()
        var italic: [NSRange] = []
        var bold: [NSRange] = []
        var quote: [NSRange] = []
        var heading: [NSRange] = []
        var kicker: [NSRange] = []
        var italicStart = -1
        var boldStart = -1
        var quoteStart = -1
        var headingStart = -1
        var kickerStart = -1
        var skip = false
        let chars = Array(html)
        var i = 0

        func append(_ s: String) {
            if skip { return }
            plain.append(s)
        }

        while i < chars.count {
            if chars[i] == "<" {
                var j = i + 1
                while j < chars.count && chars[j] != ">" { j += 1 }
                if j >= chars.count { break }
                let raw = String(chars[(i + 1)..<j]).trimmingCharacters(in: .whitespaces)
                let closing = raw.hasPrefix("/")
                let body = closing ? String(raw.dropFirst()) : raw
                let name = body.split(whereSeparator: { $0 == " " || $0 == "/" || $0 == "\t" }).first.map(String.init)?.lowercased() ?? ""
                let isKicker = body.lowercased().contains("chapter-kicker")
                switch name {
                case "script", "style":
                    skip = !closing
                case "br":
                    append("\n")
                case "p", "div", "h1", "h2", "h3", "blockquote", "li":
                    if !skip {
                        if plain.length > 0 && (plain.character(at: plain.length - 1) != 10) {
                            plain.append("\n\n")
                        }
                        if !closing && name == "blockquote" { quoteStart = plain.length }
                        if closing && name == "blockquote" && quoteStart >= 0 {
                            quote.append(NSRange(location: quoteStart, length: plain.length - quoteStart))
                            quoteStart = -1
                        }
                        if !closing && (name == "h1" || name == "h2" || name == "h3") { headingStart = plain.length }
                        if closing && (name == "h1" || name == "h2" || name == "h3") && headingStart >= 0 {
                            heading.append(NSRange(location: headingStart, length: plain.length - headingStart))
                            headingStart = -1
                        }
                        if !closing && isKicker { kickerStart = plain.length }
                        if closing && name == "p" && kickerStart >= 0 {
                            kicker.append(NSRange(location: kickerStart, length: plain.length - kickerStart))
                            kickerStart = -1
                        }
                    }
                case "em", "i":
                    if !skip {
                        if closing && italicStart >= 0 {
                            italic.append(NSRange(location: italicStart, length: plain.length - italicStart))
                            italicStart = -1
                        } else if !closing {
                            italicStart = plain.length
                        }
                    }
                case "strong", "b":
                    if !skip {
                        if closing && boldStart >= 0 {
                            bold.append(NSRange(location: boldStart, length: plain.length - boldStart))
                            boldStart = -1
                        } else if !closing {
                            boldStart = plain.length
                        }
                    }
                default:
                    break
                }
                i = j + 1
                continue
            }

            if skip {
                i += 1
                continue
            }

            if match(chars, i, "&nbsp;") { append(" "); i += 6; continue }
            if match(chars, i, "&") { append("&"); i += 5; continue }
            if match(chars, i, "<") { append("<"); i += 4; continue }
            if match(chars, i, ">") { append(">"); i += 4; continue }
            if match(chars, i, """) { append("\""); i += 6; continue }
            if match(chars, i, "&#39;") || match(chars, i, "'") {
                append("'")
                i += match(chars, i, "&#39;") ? 5 : 6
                continue
            }
            if match(chars, i, "&mdash;") { append("—"); i += 7; continue }
            if match(chars, i, "&ndash;") { append("–"); i += 7; continue }
            if match(chars, i, "&rsquo;") || match(chars, i, "&lsquo;") {
                append("’")
                i += 7
                continue
            }
            if match(chars, i, "&rdquo;") || match(chars, i, "&ldquo;") {
                append("\"")
                i += 7
                continue
            }
            if match(chars, i, "&hellip;") { append("…"); i += 8; continue }
            append(String(chars[i]))
            i += 1
        }

        var text = (plain as String).replacingOccurrences(of: "\n{3,}", with: "\n\n", options: .regularExpression)
        text = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return Parsed(text: text, italic: italic, bold: bold, quote: quote, heading: heading, kicker: kicker)
    }

    private static func match(_ chars: [Character], _ i: Int, _ s: String) -> Bool {
        let arr = Array(s)
        guard i + arr.count <= chars.count else { return false }
        for k in 0..<arr.count {
            if chars[i + k] != arr[k] { return false }
        }
        return true
    }
}

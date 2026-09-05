import SwiftUI
import UIKit

enum FolioTheme {
    static let paper = Color(red: 242 / 255, green: 239 / 255, blue: 230 / 255)
    static let paper2 = Color(red: 231 / 255, green: 225 / 255, blue: 210 / 255)
    static let paper3 = Color(red: 221 / 255, green: 214 / 255, blue: 198 / 255)
    static let ink = Color(red: 28 / 255, green: 27 / 255, blue: 22 / 255)
    static let inkSoft = Color(red: 90 / 255, green: 86 / 255, blue: 76 / 255)
    static let inkFaint = Color(red: 138 / 255, green: 132 / 255, blue: 120 / 255)
    static let rule = Color(red: 212 / 255, green: 207 / 255, blue: 194 / 255)
    static let ruleStrong = Color(red: 185 / 255, green: 178 / 255, blue: 163 / 255)
    static let mark = Color(red: 216 / 255, green: 208 / 255, blue: 188 / 255)
    static let markStrong = Color(red: 201 / 255, green: 191 / 255, blue: 166 / 255)
    static let desk = Color(red: 36 / 255, green: 31 / 255, blue: 26 / 255)

    static let paperUI = UIColor(red: 242 / 255, green: 239 / 255, blue: 230 / 255, alpha: 1)
    static let paper2UI = UIColor(red: 231 / 255, green: 225 / 255, blue: 210 / 255, alpha: 1)
    static let inkUI = UIColor(red: 28 / 255, green: 27 / 255, blue: 22 / 255, alpha: 1)
    static let inkSoftUI = UIColor(red: 90 / 255, green: 86 / 255, blue: 76 / 255, alpha: 1)
    static let markUI = UIColor(red: 216 / 255, green: 208 / 255, blue: 188 / 255, alpha: 1)
    static let markStrongUI = UIColor(red: 201 / 255, green: 191 / 255, blue: 166 / 255, alpha: 1)

    static let typePx: [CGFloat] = [20, 23, 26, 30]

    static func typeSize(_ scale: Int) -> CGFloat {
        typePx[min(max(scale, 0), 3)]
    }

    static func leadingMul(_ leading: String) -> CGFloat {
        switch leading {
        case "tight": return 1.42
        case "loose": return 1.82
        default: return 1.62
        }
    }

    /// New York on iOS, Georgia if the serif design is missing.
    static func serif(ofSize size: CGFloat, weight: UIFont.Weight = .regular) -> UIFont {
        let base = UIFont.systemFont(ofSize: size, weight: weight)
        if let desc = base.fontDescriptor.withDesign(.serif) {
            return UIFont(descriptor: desc, size: size)
        }
        return UIFont(name: "Georgia", size: size) ?? base
    }

    static func serifItalic(ofSize size: CGFloat) -> UIFont {
        let roman = serif(ofSize: size)
        if let desc = roman.fontDescriptor.withSymbolicTraits(.traitItalic) {
            return UIFont(descriptor: desc, size: size)
        }
        return UIFont(name: "Georgia-Italic", size: size) ?? roman
    }

    static func pageFont(size: CGFloat) -> Font {
        Font(serif(ofSize: size) as CTFont)
    }

    static func uiFont(size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight, design: .default)
    }
}

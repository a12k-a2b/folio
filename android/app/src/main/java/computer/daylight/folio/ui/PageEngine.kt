package computer.daylight.folio.ui

import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Constraints

data class PageSlice(val start: Int, val end: Int)

fun paginateChapter(
    text: AnnotatedString,
    measurer: TextMeasurer,
    style: TextStyle,
    widthPx: Int,
    heightPx: Int,
): List<PageSlice> {
    if (text.isEmpty() || widthPx <= 0 || heightPx <= 0) return listOf(PageSlice(0, text.length))
    val pages = mutableListOf<PageSlice>()
    var start = 0
    val n = text.length
    while (start < n) {
        var lo = start + 1
        var hi = n
        var best = (start + 1).coerceAtMost(n)
        while (lo <= hi) {
            val mid = (lo + hi) ushr 1
            val slice = text.subSequence(start, mid)
            val result = measurer.measure(
                slice,
                style,
                constraints = Constraints(maxWidth = widthPx),
            )
            if (result.size.height <= heightPx) {
                best = mid
                lo = mid + 1
            } else {
                hi = mid - 1
            }
        }
        var end = best
        if (end < n) {
            val snap = text.text.lastIndexOf(' ', end - 1)
            if (snap > start + 8) end = snap + 1
        }
        if (end <= start) end = (start + 1).coerceAtMost(n)
        pages += PageSlice(start, end)
        start = end
        if (pages.size > 400) break
    }
    return pages.ifEmpty { listOf(PageSlice(0, n)) }
}

fun offsetAt(layout: TextLayoutResult, x: Float, y: Float): Int {
    return layout.getOffsetForPosition(androidx.compose.ui.geometry.Offset(x, y))
}

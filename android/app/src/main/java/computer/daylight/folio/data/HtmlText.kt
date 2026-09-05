package computer.daylight.folio.data

import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import computer.daylight.folio.ui.theme.InkSoft

/** Strip chapter HTML to an AnnotatedString the Compose pager can measure. Offsets match the web reader's plain-text offsets closely enough for bundled books. */
fun htmlToAnnotated(html: String): AnnotatedString {
    val plain = StringBuilder()
    val italic = mutableListOf<IntRange>()
    val bold = mutableListOf<IntRange>()
    val quote = mutableListOf<IntRange>()
    var i = 0
    var italicStart = -1
    var boldStart = -1
    var quoteStart = -1
    var skip = false
    while (i < html.length) {
        if (html[i] == '<') {
            val end = html.indexOf('>', i)
            if (end < 0) break
            val tag = html.substring(i + 1, end).trim().lowercase()
            val name = tag.removePrefix("/").substringBefore(' ').substringBefore('/')
            val closing = tag.startsWith("/")
            when (name) {
                "script", "style" -> skip = !closing
                "br" -> if (!skip) plain.append('\n')
                "p", "div", "h1", "h2", "h3", "blockquote", "li" -> {
                    if (!skip) {
                        if (plain.isNotEmpty() && plain.last() != '\n') plain.append("\n\n")
                        if (!closing && name == "blockquote") quoteStart = plain.length
                        if (closing && name == "blockquote" && quoteStart >= 0) {
                            quote += quoteStart until plain.length
                            quoteStart = -1
                        }
                    }
                }
                "em", "i" -> {
                    if (!skip) {
                        if (closing && italicStart >= 0) {
                            italic += italicStart until plain.length
                            italicStart = -1
                        } else if (!closing) italicStart = plain.length
                    }
                }
                "strong", "b" -> {
                    if (!skip) {
                        if (closing && boldStart >= 0) {
                            bold += boldStart until plain.length
                            boldStart = -1
                        } else if (!closing) boldStart = plain.length
                    }
                }
            }
            i = end + 1
        } else if (html.startsWith("&nbsp;", i)) {
            if (!skip) plain.append(' ')
            i += 6
        } else if (html.startsWith("&", i)) {
            if (!skip) plain.append('&')
            i += 5
        } else if (html.startsWith("<", i)) {
            if (!skip) plain.append('<')
            i += 4
        } else if (html.startsWith(">", i)) {
            if (!skip) plain.append('>')
            i += 4
        } else if (html.startsWith(""", i)) {
            if (!skip) plain.append('"')
            i += 6
        } else if (html.startsWith("&#39;", i) || html.startsWith("'", i)) {
            if (!skip) plain.append('\'')
            i += if (html.startsWith("&#39;", i)) 5 else 6
        } else {
            if (!skip) plain.append(html[i])
            i++
        }
    }
    val text = plain.toString().replace(Regex("\\n{3,}"), "\n\n").trim()
    return buildAnnotatedString {
        append(text)
        italic.forEach { addStyle(SpanStyle(fontStyle = FontStyle.Italic), it.first.coerceAtMost(text.length), it.last.coerceAtMost(text.length)) }
        bold.forEach { addStyle(SpanStyle(fontWeight = FontWeight.Medium), it.first.coerceAtMost(text.length), it.last.coerceAtMost(text.length)) }
        quote.forEach {
            addStyle(SpanStyle(fontStyle = FontStyle.Italic, color = InkSoft, fontSize = 22.sp), it.first.coerceAtMost(text.length), it.last.coerceAtMost(text.length))
        }
    }
}

fun htmlToPlain(html: String): String = htmlToAnnotated(html).text

fun findQuote(plain: String, quote: String): IntRange? {
    val start = plain.indexOf(quote)
    if (start >= 0) return start until (start + quote.length)
    val collapsed = quote.replace(Regex("\\s+"), " ").trim()
    val t2 = plain.replace(Regex("\\s+"), " ")
    val s2 = t2.indexOf(collapsed)
    if (s2 < 0) return null
    return s2 until (s2 + collapsed.length)
}

fun expandWord(text: String, offset: Int): IntRange {
    if (text.isEmpty()) return 0 until 0
    var s = offset.coerceIn(0, text.lastIndex)
    var e = s
    while (s > 0 && text[s - 1].isLetterOrDigit()) s--
    while (e < text.length && text[e].isLetterOrDigit()) e++
    if (s == e && e < text.length) e++
    return s until e
}

fun expandSentence(text: String, offset: Int): IntRange {
    if (text.isEmpty()) return 0 until 0
    val o = offset.coerceIn(0, text.lastIndex)
    var s = o
    var e = o
    fun isEnd(c: Char) = c == '.' || c == '!' || c == '?' || c == '\n'
    while (s > 0 && !isEnd(text[s - 1])) s--
    while (s < text.length && text[s].isWhitespace()) s++
    while (e < text.length && !isEnd(text[e])) e++
    if (e < text.length && isEnd(text[e])) e++
    return s until e.coerceAtMost(text.length)
}

fun expandParagraph(text: String, offset: Int): IntRange {
    if (text.isEmpty()) return 0 until 0
    val o = offset.coerceIn(0, text.lastIndex)
    val s = text.lastIndexOf("\n\n", o).let { if (it < 0) 0 else it + 2 }
    val e = text.indexOf("\n\n", o).let { if (it < 0) text.length else it }
    return s until e
}

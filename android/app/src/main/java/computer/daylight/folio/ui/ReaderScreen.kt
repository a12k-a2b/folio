package computer.daylight.folio.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.BasicText
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Bookmark
import androidx.compose.material.icons.outlined.BookmarkBorder
import androidx.compose.material.icons.outlined.ChevronLeft
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import computer.daylight.folio.data.FolioRepository
import computer.daylight.folio.data.Highlight
import computer.daylight.folio.data.expandParagraph
import computer.daylight.folio.data.expandSentence
import computer.daylight.folio.data.expandWord
import computer.daylight.folio.data.htmlToAnnotated
import computer.daylight.folio.ui.theme.Ink
import computer.daylight.folio.ui.theme.InkSoft
import computer.daylight.folio.ui.theme.Mark
import computer.daylight.folio.ui.theme.Paper
import computer.daylight.folio.ui.theme.Serif
import computer.daylight.folio.ui.theme.Ui
import computer.daylight.folio.ui.theme.pageStyle
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun ReaderScreen(
    repo: FolioRepository,
    bookId: String,
    onBack: () -> Unit,
) {
    val book = remember(bookId) { repo.book(bookId) } ?: return
    val settings = remember { repo.settings() }
    var chapterIndex by remember {
        mutableIntStateOf(repo.progress(bookId)?.chapterIndex ?: 0)
    }
    var pageIndex by remember {
        mutableIntStateOf(repo.progress(bookId)?.pageIndex ?: 0)
    }
    var chrome by remember { mutableStateOf(false) }
    var highlights by remember { mutableStateOf(repo.highlights(bookId)) }
    var bookmarks by remember { mutableStateOf(repo.bookmarks(bookId)) }
    var voices by remember { mutableStateOf(repo.voices(bookId)) }
    val tags = remember { repo.tags() }
    var openHl by remember { mutableStateOf<Highlight?>(null) }
    var pageSize by remember { mutableStateOf(IntSize.Zero) }
    var layout by remember { mutableStateOf<TextLayoutResult?>(null) }
    val scope = rememberCoroutineScope()
    val measurer = rememberTextMeasurer()
    val density = LocalDensity.current

    val chapter = book.chapters.getOrNull(chapterIndex) ?: book.chapters.first()
    val annotated = remember(chapter.id) { htmlToAnnotated(chapter.html) }
    val style = remember(settings) {
        pageStyle(settings.typeScale, settings.leadingMul(), settings.justify).copy(
            textAlign = if (settings.justify) TextAlign.Justify else TextAlign.Start,
        )
    }
    val pages = remember(annotated, pageSize, style) {
        if (pageSize.width == 0) emptyList()
        else paginateChapter(annotated, measurer, style, pageSize.width, pageSize.height)
    }
    if (pages.isNotEmpty()) pageIndex = pageIndex.coerceIn(0, pages.lastIndex)
    val slice = pages.getOrNull(pageIndex)
    val pageText = remember(slice, annotated, highlights, chapter.id) {
        if (slice == null) annotated
        else paintMarks(annotated.subSequence(slice.start, slice.end), slice.start, highlights.filter { it.chapterId == chapter.id })
    }

    fun persist() {
        val total = (book.chapters.size * 10).coerceAtLeast(1)
        val pct = ((chapterIndex * 10 + pageIndex).toDouble() / total) * 100.0
        repo.saveProgress(
            computer.daylight.folio.data.Progress(
                bookId, chapterIndex, pageIndex, pct, "${chapter.id}:$pageIndex", "",
            ),
        )
    }

    fun reloadMarks() {
        highlights = repo.highlights(bookId)
        bookmarks = repo.bookmarks(bookId)
        voices = repo.voices(bookId)
    }

    fun go(delta: Int) {
        val next = pageIndex + delta
        when {
            next < 0 && chapterIndex > 0 -> {
                chapterIndex -= 1
                pageIndex = 0
            }
            next < 0 -> {}
            pages.isNotEmpty() && next > pages.lastIndex && chapterIndex < book.chapters.lastIndex -> {
                chapterIndex += 1
                pageIndex = 0
            }
            pages.isNotEmpty() && next <= pages.lastIndex -> pageIndex = next
        }
        persist()
    }

    var tapJob by remember { mutableStateOf<Job?>(null) }
    var tapCount by remember { mutableIntStateOf(0) }
    var lastPos by remember { mutableStateOf(Offset.Zero) }
    var dragging by remember { mutableStateOf(false) }
    var dragStart by remember { mutableIntStateOf(-1) }

    fun markRange(start: Int, end: Int) {
        if (slice == null || end <= start) return
        val a = (slice.start + start).coerceIn(0, annotated.length)
        val b = (slice.start + end).coerceIn(0, annotated.length)
        if (b <= a) return
        val text = annotated.text.substring(a, b).trim()
        if (text.isEmpty()) return
        val existing = highlights.find { it.chapterId == chapter.id && it.startOffset <= a && it.endOffset >= b - 1 }
        if (existing != null) {
            openHl = existing
            return
        }
        repo.addHighlight(book.id, chapter.id, a, b, text)
        reloadMarks()
    }

    fun handleTaps(count: Int, pos: Offset, width: Float) {
        val l = layout
        if (count == 1) {
            when {
                pos.x < width * 0.28f -> go(-1)
                pos.x > width * 0.72f -> go(1)
                else -> chrome = !chrome
            }
            return
        }
        if (l == null) return
        val local = offsetAt(l, pos.x, pos.y)
        val pagePlain = pageText.text
        val range = when (count) {
            2 -> expandWord(pagePlain, local)
            3 -> expandSentence(pagePlain, local)
            else -> expandParagraph(pagePlain, local)
        }
        markRange(range.first, range.last + 1)
    }

    val bookmarked = bookmarks.any { it.chapterIndex == chapterIndex && it.pageIndex == pageIndex }

    Box(Modifier.fillMaxSize().background(Paper)) {
        Column(Modifier.fillMaxSize()) {
            if (chrome) {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("← SHELF", fontFamily = Ui, fontSize = 11.sp, letterSpacing = 1.6.sp, color = InkSoft, modifier = Modifier.clickable(onClick = onBack).padding(12.dp))
                    Spacer(Modifier.weight(1f))
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(book.title, fontFamily = Serif, fontSize = 16.sp, color = Ink)
                        Text(chapter.title, fontFamily = Ui, fontSize = 11.sp, color = InkSoft)
                    }
                    Spacer(Modifier.weight(1f))
                    Icon(
                        if (bookmarked) Icons.Outlined.Bookmark else Icons.Outlined.BookmarkBorder,
                        contentDescription = "Bookmark",
                        tint = Ink,
                        modifier = Modifier
                            .padding(12.dp)
                            .clickable {
                                if (bookmarked) {
                                    bookmarks.filter { it.chapterIndex == chapterIndex && it.pageIndex == pageIndex }
                                        .forEach { repo.deleteBookmark(it.id) }
                                } else {
                                    repo.addBookmark(book.id, chapterIndex, pageIndex, chapter.title)
                                }
                                reloadMarks()
                            },
                    )
                }
            } else {
                Spacer(Modifier.height(28.dp))
            }

            BoxWithConstraints(
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = 36.dp, vertical = 8.dp)
                    .onSizeChanged { pageSize = it },
            ) {
                val w = constraints.maxWidth.toFloat()
                BasicText(
                    text = pageText,
                    style = style,
                    modifier = Modifier
                        .fillMaxSize()
                        .pointerInput(pages, chapter.id, pageIndex) {
                            detectTapGestures(
                                onTap = { pos ->
                                    lastPos = pos
                                    tapCount += 1
                                    tapJob?.cancel()
                                    tapJob = scope.launch {
                                        delay(280)
                                        handleTaps(tapCount, lastPos, w)
                                        tapCount = 0
                                    }
                                },
                                onLongPress = { pos ->
                                    val l = layout ?: return@detectTapGestures
                                    dragStart = offsetAt(l, pos.x, pos.y)
                                    dragging = true
                                },
                            )
                        }
                        .pointerInput(dragging, chapter.id, pageIndex) {
                            detectDragGestures(
                                onDragEnd = {
                                    val l = layout
                                    if (dragging && l != null && dragStart >= 0) {
                                        val end = offsetAt(l, lastPos.x, lastPos.y)
                                        val a = minOf(dragStart, end)
                                        val b = maxOf(dragStart, end) + 1
                                        markRange(a, b)
                                    }
                                    dragging = false
                                    dragStart = -1
                                },
                                onDrag = { change, _ ->
                                    lastPos = change.position
                                    change.consume()
                                },
                            )
                        },
                    onTextLayout = { layout = it },
                )
            }

            Box(Modifier.fillMaxWidth().height(124.dp).padding(horizontal = 20.dp)) {
                if (chrome) {
                    Row(Modifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Outlined.ChevronLeft,
                            contentDescription = "Previous page",
                            tint = Ink,
                            modifier = Modifier.clickable { go(-1) }.padding(16.dp),
                        )
                        Spacer(Modifier.weight(1f))
                        Text(
                            "${chapterIndex + 1}.${pageIndex + 1}",
                            fontFamily = Ui,
                            fontSize = 12.sp,
                            color = InkSoft,
                        )
                        Spacer(Modifier.weight(1f))
                        Icon(
                            Icons.Outlined.ChevronRight,
                            contentDescription = "Next page",
                            tint = Ink,
                            modifier = Modifier.clickable { go(1) }.padding(16.dp),
                        )
                    }
                }
                val current = openHl
                if (current != null) {
                    VoicePad(
                        enabled = true,
                        onCaptured = { cap ->
                            repo.addVoice(current.id, "", cap.b64, cap.mime, cap.durationMs)
                            reloadMarks()
                        },
                        modifier = Modifier.align(Alignment.CenterEnd).padding(end = 8.dp),
                    )
                }
            }
        }

        openHl?.let { hl ->
            Box(Modifier.align(Alignment.BottomCenter).padding(bottom = 132.dp, start = 16.dp, end = 16.dp)) {
                AnnotationSheet(
                    repo = repo,
                    highlight = hl,
                    tags = tags,
                    voices = voices,
                    onClose = { openHl = null },
                    onChanged = { reloadMarks(); openHl = repo.highlights(bookId).find { it.id == hl.id } },
                )
            }
        }
    }

    LaunchedEffect(chapterIndex, pageIndex) { persist() }
}

private fun paintMarks(
    page: androidx.compose.ui.text.AnnotatedString,
    pageStart: Int,
    marks: List<Highlight>,
): androidx.compose.ui.text.AnnotatedString {
    return buildAnnotatedString {
        append(page)
        marks.forEach { h ->
            val s = (h.startOffset - pageStart).coerceIn(0, page.length)
            val e = (h.endOffset - pageStart).coerceIn(0, page.length)
            if (e > s) addStyle(SpanStyle(background = Mark), s, e)
        }
    }
}

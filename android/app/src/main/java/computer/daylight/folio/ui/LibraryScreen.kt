package computer.daylight.folio.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import computer.daylight.folio.data.CatalogEntry
import computer.daylight.folio.data.ClubSeed
import computer.daylight.folio.data.FolioRepository
import computer.daylight.folio.ui.theme.Ink
import computer.daylight.folio.ui.theme.InkSoft
import computer.daylight.folio.ui.theme.Paper
import computer.daylight.folio.ui.theme.Paper2
import computer.daylight.folio.ui.theme.Rule
import computer.daylight.folio.ui.theme.Serif
import computer.daylight.folio.ui.theme.Ui

@Composable
fun LibraryScreen(
    repo: FolioRepository,
    onOpen: (String) -> Unit,
    onSettings: () -> Unit,
) {
    val books = remember { repo.library() }
    val progress = remember { repo.allProgress() }
    val continueId = progress.maxByOrNull { it.updatedAt }?.bookId ?: books.firstOrNull()?.id
    val continueBook = books.find { it.id == continueId }

    LazyVerticalGrid(
        columns = GridCells.Fixed(2),
        modifier = Modifier.fillMaxSize().background(Paper),
        contentPadding = PaddingValues(start = 28.dp, end = 28.dp, top = 20.dp, bottom = 48.dp),
        horizontalArrangement = Arrangement.spacedBy(20.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        item(span = { GridItemSpan(2) }) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Spacer(Modifier.size(48.dp))
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Folio", fontFamily = Serif, fontSize = 32.sp, color = Ink)
                    Text(
                        "READ  ·  MARK  ·  SPEAK",
                        fontFamily = Ui,
                        fontSize = 11.sp,
                        letterSpacing = 2.sp,
                        color = InkSoft,
                    )
                }
                IconButton(onClick = onSettings) {
                    Icon(Icons.Outlined.Settings, contentDescription = "Settings", tint = Ink)
                }
            }
        }
        item(span = { GridItemSpan(2) }) {
            Box(Modifier.fillMaxWidth().height(1.dp).background(Rule))
        }
        item(span = { GridItemSpan(2) }) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .border(1.dp, Ink)
                    .background(Paper2)
                    .clickable { onOpen(ClubSeed.ALEXANDER_BOOK) }
                    .padding(20.dp),
            ) {
                Text("A CIRCLE", fontFamily = Ui, fontSize = 11.sp, letterSpacing = 2.sp, color = InkSoft)
                Text("Alexander Circle", fontFamily = Serif, fontSize = 26.sp, color = Ink)
                Text("You · Theo", fontFamily = Ui, fontSize = 13.sp, color = InkSoft)
                Spacer(Modifier.height(8.dp))
                Text(
                    "Theo left voices on Living Structure. Open the book, tap a marked sentence, hear him, answer in yours.",
                    fontFamily = Serif,
                    fontSize = 15.sp,
                    color = Ink,
                    lineHeight = 22.sp,
                )
            }
        }
        if (continueBook != null) {
            item(span = { GridItemSpan(2) }) {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .border(1.dp, Rule)
                        .clickable { onOpen(continueBook.id) }
                        .padding(20.dp),
                ) {
                    Text("CONTINUE", fontFamily = Ui, fontSize = 11.sp, letterSpacing = 2.sp, color = InkSoft)
                    Text(continueBook.title, fontFamily = Serif, fontSize = 24.sp, color = Ink)
                    Text(continueBook.author, fontFamily = Ui, fontSize = 13.sp, color = InkSoft)
                }
            }
        }
        item(span = { GridItemSpan(2) }) {
            Text("SHELF", fontFamily = Ui, fontSize = 11.sp, letterSpacing = 2.sp, color = InkSoft)
        }
        items(books, key = { it.id }) { book ->
            CoverCard(book, onClick = { onOpen(book.id) })
        }
        item(span = { GridItemSpan(2) }) {
            Text(
                "Two taps a word, three a sentence. Hold the microphone when a feeling is faster than a keyboard. PowerSync is locked until this folio keeps a mark overnight.",
                fontFamily = Serif,
                fontSize = 14.sp,
                color = InkSoft,
                lineHeight = 20.sp,
                modifier = Modifier.padding(top = 12.dp),
            )
        }
    }
}

@Composable
private fun CoverCard(book: CatalogEntry, onClick: () -> Unit) {
    Column(Modifier.clickable(onClick = onClick)) {
        Box(
            Modifier
                .fillMaxWidth()
                .height(160.dp)
                .border(1.dp, Rule)
                .background(Paper2),
            contentAlignment = Alignment.Center,
        ) {
            Box(
                Modifier.size(44.dp).border(1.dp, Ink, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text(book.coverLabel.ifBlank { "·" }, fontFamily = Serif, fontSize = 18.sp, color = Ink)
            }
        }
        Spacer(Modifier.height(8.dp))
        Text(
            book.title,
            fontFamily = Serif,
            fontSize = 16.sp,
            color = Ink,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        Text(book.author, fontFamily = Ui, fontSize = 12.sp, color = InkSoft, maxLines = 1)
    }
}

package computer.daylight.folio.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import computer.daylight.folio.data.FolioRepository
import computer.daylight.folio.data.Highlight
import computer.daylight.folio.data.Tag
import computer.daylight.folio.data.VoiceNote
import computer.daylight.folio.ui.theme.Ink
import computer.daylight.folio.ui.theme.InkSoft
import computer.daylight.folio.ui.theme.Paper
import computer.daylight.folio.ui.theme.Paper2
import computer.daylight.folio.ui.theme.Rule
import computer.daylight.folio.ui.theme.Serif
import computer.daylight.folio.ui.theme.Ui

@Composable
fun AnnotationSheet(
    repo: FolioRepository,
    highlight: Highlight,
    tags: List<Tag>,
    voices: List<VoiceNote>,
    onClose: () -> Unit,
    onChanged: () -> Unit,
) {
    val context = LocalContext.current
    var note by remember(highlight.id) { mutableStateOf(highlight.note) }
    val mine = voices.filter { it.highlightId == highlight.id }

    Column(
        Modifier
            .fillMaxWidth()
            .heightIn(max = 520.dp)
            .background(Paper)
            .border(1.dp, Rule)
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
    ) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(if (highlight.isCompanion) highlight.authorName.uppercase() else "MARK", fontFamily = Ui, fontSize = 11.sp, letterSpacing = 2.sp, color = InkSoft)
            Text("CLOSE", fontFamily = Ui, fontSize = 11.sp, letterSpacing = 2.sp, color = InkSoft, modifier = Modifier.clickable(onClick = onClose))
        }
        Spacer(Modifier.height(10.dp))
        Text("“${highlight.text}”", fontFamily = Serif, fontSize = 20.sp, color = Ink, lineHeight = 28.sp)
        Spacer(Modifier.height(12.dp))
        TextField(
            value = note,
            onValueChange = {
                note = it
                repo.updateHighlight(highlight.id, it, null)
            },
            placeholder = { Text("A written note, if the voice is not enough", fontFamily = Serif) },
            modifier = Modifier.fillMaxWidth().border(1.dp, Rule),
            colors = TextFieldDefaults.colors(
                focusedContainerColor = Paper2,
                unfocusedContainerColor = Paper2,
                focusedIndicatorColor = androidx.compose.ui.graphics.Color.Transparent,
                unfocusedIndicatorColor = androidx.compose.ui.graphics.Color.Transparent,
                focusedTextColor = Ink,
                unfocusedTextColor = Ink,
            ),
        )
        Spacer(Modifier.height(14.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            tags.take(8).forEach { tag ->
                val on = tag.id in highlight.tagIds
                Text(
                    "${tag.emoji} ${tag.name}",
                    fontFamily = Ui,
                    fontSize = 11.sp,
                    color = if (on) Paper else Ink,
                    modifier = Modifier
                        .background(if (on) Ink else Paper)
                        .border(1.dp, Rule)
                        .clickable {
                            val next = if (on) highlight.tagIds - tag.id else highlight.tagIds + tag.id
                            repo.updateHighlight(highlight.id, null, next)
                            onChanged()
                        }
                        .padding(horizontal = 8.dp, vertical = 6.dp),
                )
            }
        }
        Spacer(Modifier.height(16.dp))
        mine.forEach { v ->
            Column(
                Modifier
                    .fillMaxWidth()
                    .border(1.dp, Rule)
                    .clickable {
                        val path = v.audioUrl.removePrefix("asset://")
                        if (path.isNotBlank() && !path.startsWith("http")) playAsset(context, path)
                    }
                    .padding(12.dp),
            ) {
                Text(v.authorName, fontFamily = Ui, fontSize = 11.sp, letterSpacing = 1.5.sp, color = InkSoft)
                Text(v.transcript, fontFamily = Serif, fontSize = 16.sp, color = Ink, lineHeight = 24.sp)
                if (v.audioUrl.isNotBlank()) {
                    Text("TAP TO HEAR", fontFamily = Ui, fontSize = 11.sp, letterSpacing = 1.5.sp, color = InkSoft, modifier = Modifier.padding(top = 6.dp))
                }
            }
            Spacer(Modifier.height(8.dp))
        }
        if (!highlight.isCompanion) {
            Text(
                "DELETE MARK",
                fontFamily = Ui,
                fontSize = 11.sp,
                letterSpacing = 1.5.sp,
                color = InkSoft,
                modifier = Modifier
                    .padding(top = 8.dp)
                    .clickable {
                        repo.deleteHighlight(highlight.id)
                        onChanged()
                        onClose()
                    },
            )
        }
        VoicePad(
            enabled = true,
            onCaptured = { cap ->
                repo.addVoice(highlight.id, "", cap.b64, cap.mime, cap.durationMs)
                onChanged()
            },
            modifier = Modifier.padding(top = 16.dp),
        )
        Text("Hold to answer in your voice. Lift to stop.", fontFamily = Serif, fontSize = 13.sp, color = InkSoft, modifier = Modifier.padding(top = 8.dp))
    }
}

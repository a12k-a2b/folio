package computer.daylight.folio.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import computer.daylight.folio.data.FolioRepository
import computer.daylight.folio.data.FolioSettings
import computer.daylight.folio.ui.theme.Ink
import computer.daylight.folio.ui.theme.InkSoft
import computer.daylight.folio.ui.theme.Paper
import computer.daylight.folio.ui.theme.Paper2
import computer.daylight.folio.ui.theme.Rule
import computer.daylight.folio.ui.theme.Serif
import computer.daylight.folio.ui.theme.Ui
import kotlinx.coroutines.launch

@Composable
fun SettingsScreen(repo: FolioRepository, onBack: () -> Unit) {
    var settings by remember { mutableStateOf(repo.settings()) }
    var origin by remember { mutableStateOf(repo.origin()) }
    var token by remember { mutableStateOf(repo.token()) }
    var status by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    fun patch(next: FolioSettings) {
        settings = next
        repo.saveSettings(next)
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(Paper)
            .verticalScroll(rememberScrollState())
            .padding(28.dp),
    ) {
        Text("← SHELF", fontFamily = Ui, fontSize = 11.sp, letterSpacing = 2.sp, color = InkSoft, modifier = Modifier.clickable(onClick = onBack))
        Spacer(Modifier.height(12.dp))
        Text("Settings", fontFamily = Serif, fontSize = 36.sp, color = Ink)
        Spacer(Modifier.height(24.dp))

        Label("Type size")
        SegRow(listOf("S", "M", "L", "XL"), settings.typeScale) { patch(settings.copy(typeScale = it)) }
        Label("Leading")
        val lead = listOf("tight", "normal", "loose")
        SegRow(listOf("Tight", "Book", "Loose"), lead.indexOf(settings.leading).coerceAtLeast(0)) {
            patch(settings.copy(leading = lead[it]))
        }
        Label("Justify")
        SegRow(listOf("Off", "On"), if (settings.justify) 1 else 0) { patch(settings.copy(justify = it == 1)) }

        Spacer(Modifier.height(28.dp))
        Text("HTTP V1", fontFamily = Ui, fontSize = 11.sp, letterSpacing = 2.sp, color = InkSoft)
        Text(
            "Origin of the Folio server. Paste a session token from the web Settings after you sign in. Marks still write locally if this is empty.",
            fontFamily = Serif,
            fontSize = 15.sp,
            color = InkSoft,
            lineHeight = 22.sp,
            modifier = Modifier.padding(top = 8.dp, bottom = 12.dp),
        )
        FolioField("Origin", origin) {
            origin = it
            repo.setOrigin(it)
        }
        Spacer(Modifier.height(8.dp))
        FolioField("Bearer token", token) {
            token = it
            repo.setToken(it)
        }
        Spacer(Modifier.height(12.dp))
        Text(
            "Pull Living Structure",
            fontFamily = Ui,
            fontSize = 11.sp,
            letterSpacing = 1.5.sp,
            color = Paper,
            modifier = Modifier
                .background(Ink)
                .clickable {
                    scope.launch {
                        status = repo.pullAndPush("living-structure")
                    }
                }
                .padding(horizontal = 14.dp, vertical = 10.dp),
        )
        if (status.isNotBlank()) {
            Text(status, fontFamily = Serif, fontSize = 14.sp, color = InkSoft, modifier = Modifier.padding(top = 8.dp))
        }

        Spacer(Modifier.height(32.dp))
        Text("POWERSYNC", fontFamily = Ui, fontSize = 11.sp, letterSpacing = 2.sp, color = InkSoft)
        Text(
            if (repo.powersyncLocked()) "Locked. HTTP v1 is the only network until this folio and the iPhone have each kept a mark overnight."
            else "Open — should not happen in this build.",
            fontFamily = Serif,
            fontSize = 16.sp,
            color = Ink,
            lineHeight = 24.sp,
            modifier = Modifier.padding(top = 8.dp),
        )
        Text(
            "folio-native/1 · SQLiteOpenHelper · no Room · no PowerSync SDK",
            fontFamily = Ui,
            fontSize = 11.sp,
            color = InkSoft,
            modifier = Modifier.padding(top = 16.dp),
        )
    }
}

@Composable
private fun Label(text: String) {
    Text(text, fontFamily = Serif, fontSize = 17.sp, color = Ink, modifier = Modifier.padding(top = 18.dp, bottom = 8.dp))
}

@Composable
private fun SegRow(labels: List<String>, selected: Int, onSelect: (Int) -> Unit) {
    Row(Modifier.border(1.dp, Rule)) {
        labels.forEachIndexed { i, label ->
            Text(
                label.uppercase(),
                fontFamily = Ui,
                fontSize = 11.sp,
                letterSpacing = 1.sp,
                color = if (i == selected) Paper else Ink,
                modifier = Modifier
                    .background(if (i == selected) Ink else Paper)
                    .clickable { onSelect(i) }
                    .padding(horizontal = 12.dp, vertical = 8.dp),
            )
        }
    }
}

@Composable
private fun FolioField(label: String, value: String, onChange: (String) -> Unit) {
    TextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label, fontFamily = Ui, fontSize = 11.sp) },
        singleLine = true,
        modifier = Modifier.fillMaxWidth().border(1.dp, Rule),
        colors = TextFieldDefaults.colors(
            focusedContainerColor = Paper2,
            unfocusedContainerColor = Paper,
            focusedIndicatorColor = androidx.compose.ui.graphics.Color.Transparent,
            unfocusedIndicatorColor = androidx.compose.ui.graphics.Color.Transparent,
            focusedTextColor = Ink,
            unfocusedTextColor = Ink,
        ),
    )
}

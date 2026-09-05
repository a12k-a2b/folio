package computer.daylight.folio.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val FolioScheme = lightColorScheme(
    primary = Ink,
    onPrimary = Paper,
    background = Paper,
    onBackground = Ink,
    surface = Paper,
    onSurface = Ink,
    secondary = InkSoft,
    onSecondary = Paper,
    outline = Rule,
)

@Composable
fun FolioTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = FolioScheme,
        content = content,
    )
}

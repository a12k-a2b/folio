package computer.daylight.folio

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import computer.daylight.folio.ui.LibraryScreen
import computer.daylight.folio.ui.ReaderScreen
import computer.daylight.folio.ui.SettingsScreen
import computer.daylight.folio.ui.theme.FolioTheme
import computer.daylight.folio.ui.theme.Paper

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val repo = (application as FolioApp).repo
        setContent {
            FolioTheme {
                var route by remember { mutableStateOf("library") }
                var bookId by remember { mutableStateOf<String?>(null) }
                androidx.compose.foundation.layout.Box(
                    Modifier.fillMaxSize().background(Paper),
                ) {
                    when (route) {
                        "library" -> LibraryScreen(
                            repo = repo,
                            onOpen = {
                                bookId = it
                                route = "read"
                            },
                            onSettings = { route = "settings" },
                        )
                        "read" -> {
                            val id = bookId
                            if (id == null) route = "library"
                            else ReaderScreen(
                                repo = repo,
                                bookId = id,
                                onBack = { route = "library" },
                            )
                        }
                        "settings" -> SettingsScreen(
                            repo = repo,
                            onBack = { route = "library" },
                        )
                    }
                }
            }
        }
    }
}

package computer.daylight.folio

import android.app.Application
import computer.daylight.folio.data.FolioRepository

class FolioApp : Application() {
    lateinit var repo: FolioRepository
        private set

    override fun onCreate() {
        super.onCreate()
        repo = FolioRepository(this)
    }
}

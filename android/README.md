# Folio for Daylight DC-1

Kotlin · Jetpack Compose · 1184×1584.

Open `android/` in Android Studio (Ladybug / Koala+). JDK 17. Sync Gradle, run
the `app` configuration on a tablet AVD scaled to 1184×1584 or a DC-1.

There is no Android SDK in the web preview — this tree is the real app source.
The preview’s Native lab (`/native`) proves the HTTP protocol this app speaks.

## Stack

- minSdk 26, compileSdk 35, Java 17
- Compose BOM 2024.12.01, Kotlin 2.0.21, AGP 8.7.3, Gradle 8.11.1
- SQLiteOpenHelper (`FolioDb`) — **not Room**, so there is no KSP plugin and
  the schema matches `native/PROTOCOL.md` on the page
- OkHttp 4.12 for `/api/native/v1/*`
- **No PowerSync dependency.** `folio_meta.powersync = locked`

## Offline

`app/src/main/assets/catalog.json` is the six bundled books (full HTML).
`assets/voices/theo-*.mp3` are Alexander Circle. A device with no account still
reads, marks, speaks, and survives process death.

Set origin + bearer in Settings to pull/push. Marks write locally first (`dirty=1`).

## Proven-out gate

Force-stop after a highlight. Reopen. The mark is still there. Then the iPhone
twin does the same. Then we unlock PowerSync — not before.

# Folio native

| Device | Tree | UI | Store | Network |
| --- | --- | --- | --- | --- |
| Daylight DC-1 | `android/` | Jetpack Compose | SQLiteOpenHelper | OkHttp HTTP v1 |
| iPhone | `ios/Folio` | SwiftUI | SwiftData | URLSession HTTP v1 |

Protocol: [PROTOCOL.md](./PROTOCOL.md) · `folio-native/1`

PowerSync: [POWERSYNC.md](./POWERSYNC.md) · **locked** until both apps keep a
mark overnight on device.

Shared catalog: `shared/catalog.json` (generated from `src/lib/folio/books`).
Theo voices: `shared/voices/`.

The web preview cannot assemble an APK or IPA. `/native` in the reader is the
lab that proves health, catalog, snapshot, and a mark roundtrip against this
origin.

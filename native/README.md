| Device | Tree | UI | Store | Network |
| --- | --- | --- | --- | --- |
| Daylight DC-1 | `android/` | Jetpack Compose | SQLiteOpenHelper | OkHttp HTTP v1.1 |
| iPhone | `ios/Folio` | SwiftUI | JSON file in Application Support | URLSession HTTP v1.1 |

Protocol: [PROTOCOL.md](./PROTOCOL.md) · `folio-native/1` · sync `v1.1`

PowerSync: [POWERSYNC.md](./POWERSYNC.md) · **locked**. HTTP v1.1 is the sync: blobs, tombstones, a batch that cannot stall. The overnight gate is still required before any SDK.

Shared catalog: `shared/catalog.json` (generated from `src/lib/folio/books`).
Theo voices: `shared/voices/`.

The web preview cannot assemble an APK or IPA. `/native` in the reader is the
lab that proves health, catalog, snapshot, blobs, batch, and a mark roundtrip against this
origin.
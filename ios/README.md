# Folio for iPhone

SwiftUI · SwiftData · 390×844.

Open Xcode, create an iOS App named Folio if the project file needs regenerating,
then add every file under `ios/Folio/`. iOS 17+, Swift 5.10. The included
`Folio.xcodeproj` should open as-is.

There is no Xcode in the web preview — this tree is the real app source. The
preview’s Native lab (`/native`) proves the HTTP protocol this app speaks.

## Stack

- SwiftUI + SwiftData (`FolioStore`)
- Table names match `folio_*` in `native/PROTOCOL.md`
- URLSession for `/api/native/v1/*`
- AVAudioRecorder for push-to-talk
- CoreText frames for paging (a tap hits a word)
- **No PowerSync package.** Meta key `powersync` is `locked`.

## Offline

`Folio/Resources/catalog.json` is the six bundled books.
`Resources/voices/theo-*.mp3` are Alexander Circle.

Writing marks is in this build — not phase two. Client UUIDs, `dirty` flag,
HTTP push when a session token is set.

## Proven-out gate

Kill the app after a highlight. Reopen. The mark is still there. Same on DC-1.
Then we unlock PowerSync — not before.

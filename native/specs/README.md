# Folio sync: two designs, one gate

Folio already syncs. HTTP v1 (`folio-native/1`) is the live contract: snapshot pull, per-row push, `dirty` flags, last-writer on progress, union on marks. PowerSync is locked until both native apps keep a mark overnight on device. That gate does not change.

The question is **what to unlock into**, not whether to skip the gate.

**Verdict:** you do not need PowerSync. You also should not ship Changeset v2 as written. After the gate, close three holes in v1 (blobs, tombstones, batch). Full write-up: [VERDICT.md](./VERDICT.md).

| | A · PowerSync | B · Folio Changeset | v1.1 (recommended) |
| --- | --- | --- | --- |
| Spec | [A-powersync.md](./A-powersync.md) | [B-changeset.md](./B-changeset.md) | [VERDICT.md](./VERDICT.md) |
| Review | [A-review.md](./A-review.md) · **do not ship** | [B-review.md](./B-review.md) · **do not ship** | — |
| Extra process | PowerSync Service + replication slot + JWT | None. Same origin. | None |
| Client store | Rewrites both native stores | Keep them (iOS is a JSON file, not SwiftData) | Keep them |
| Writes | Still our REST, via SDK FIFO | New `/push` + change_log | Batch on existing REST |
| Voice | Object store + alpha attachment queue | Two-step blob, **no PUT confirm** | Two-step blob **with confirm** |
| Live | Websocket / stream | 25s long-poll (bad on DC-1 / Neon pool) | Pull on resume |
| Fit | Many devices, live club | Two devices, homemade engine | Two devices, a garden folio |

**Load-bearing facts**

- One reader, two devices. A club is five people, not fifty.
- A lifetime of marks without audio is tens of kilobytes. Audio is the only fat payload.
- Companion (Theo) rows are server-owned. Clients never mutate them.
- Deletes of a mark the other device still has must not vanish on pull — and must not lose to a dirty note by accident.
- The overnight gate in [POWERSYNC.md](../POWERSYNC.md) still applies before any of this ships on device.

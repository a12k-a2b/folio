import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { POWERSYNC_LOCKED, NATIVE_PROTOCOL } from "@/lib/folio/native-path";

type Health = {
  ok: boolean;
  protocol: string;
  powersync: string;
  powersyncLocked: boolean;
  reason: string;
  catalogSize: number;
  time: string;
};

type CatalogBook = {
  id: string;
  title: string;
  author: string;
  year: string;
  coverLabel: string;
  chapterCount: number;
  wordCount: number;
};

type LogLine = { t: string; ok: boolean; text: string };

async function nativeFetch(path: string, init?: RequestInit) {
  const res = await fetch(`/api/native/v1${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Folio-Protocol": NATIVE_PROTOCOL,
      ...(init?.headers ?? {}),
    },
  });
  const proto = res.headers.get("X-Folio-Protocol");
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { res, proto, body };
}

function Card({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border border-rule bg-paper p-6 text-ink">
      <div className="font-ui text-[11px] tracking-[0.18em] text-ink-soft uppercase">{kicker}</div>
      <h2 className="mt-1 font-serif text-[28px] leading-tight tracking-tight">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function NativeLab() {
  const [health, setHealth] = useState<Health | null>(null);
  const [catalog, setCatalog] = useState<CatalogBook[]>([]);
  const [me, setMe] = useState<string>("");
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [snapMarks, setSnapMarks] = useState(0);
  const [snapVoices, setSnapVoices] = useState(0);

  function log(ok: boolean, text: string) {
    const t = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLogs((prev) => [{ t, ok, text }, ...prev].slice(0, 12));
  }

  async function refreshHealth() {
    const { res, proto, body } = await nativeFetch("/health");
    if (!res.ok) {
      log(false, `health ${res.status}`);
      return;
    }
    setHealth(body as unknown as Health);
    log(true, `health · protocol ${proto ?? body.protocol} · PowerSync ${String(body.powersync)}`);
  }

  async function refreshCatalog() {
    const { res, body } = await nativeFetch("/catalog");
    if (!res.ok) {
      log(false, `catalog ${res.status}`);
      return;
    }
    const books = (body.books as CatalogBook[]) ?? [];
    setCatalog(books);
    log(true, `catalog · ${books.length} bundled books`);
  }

  async function refreshMe() {
    const { res, body } = await nativeFetch("/me");
    if (body.signedIn === false || res.status === 401) {
      setMe("unsigned — catalog still works offline");
      log(true, "me · unsigned (offline catalog is enough)");
      return;
    }
    if (!res.ok) {
      log(false, `me ${res.status}`);
      return;
    }
    setMe(`${String(body.displayName)} · ${String(body.userId).slice(0, 8)}`);
    log(true, `me · ${String(body.displayName)}`);
  }

  async function pullSnapshot() {
    setBusy(true);
    try {
      const { res, body } = await nativeFetch("/snapshot/living-structure");
      if (!res.ok) {
        log(false, `snapshot ${res.status} ${String(body.error ?? "")}`);
        return;
      }
      const hl = Array.isArray(body.highlights) ? body.highlights.length : 0;
      const voices = Array.isArray(body.voices) ? body.voices.length : 0;
      setSnapMarks(hl);
      setSnapVoices(voices);
      log(true, `snapshot living-structure · ${hl} marks · ${voices} voices`);
    } finally {
      setBusy(false);
    }
  }

  async function roundtrip() {
    setBusy(true);
    try {
      const id = crypto.randomUUID();
      const { res, body } = await nativeFetch("/highlights", {
        method: "POST",
        body: JSON.stringify({
          id,
          bookId: "living-structure",
          chapterId: "ls-1",
          startOffset: 0,
          endOffset: 64,
          text: "There is a feeling you already know, and you have never been taught it.",
          note: "native v1 roundtrip",
        }),
      });
      if (!res.ok) {
        log(false, `push mark ${res.status} ${String(body.error ?? "")}`);
        return;
      }
      log(true, `pushed mark ${String(body.id).slice(0, 8)}`);
      const snap = await nativeFetch("/snapshot/living-structure");
      const hits = Array.isArray(snap.body.highlights)
        ? (snap.body.highlights as { id: string; note: string }[])
        : [];
      const found = hits.find((h) => h.id === id || h.id === body.id);
      setSnapMarks(hits.length);
      if (found) log(true, "pull saw the mark — HTTP v1 two-way is live");
      else log(false, "pull missed the mark");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void (async () => {
      await refreshHealth();
      await refreshCatalog();
      await refreshMe();
    })();
  }, []);

  return (
    <div className="min-h-dvh bg-desk text-paper">
      <div className="mx-auto max-w-[980px] px-5 py-10">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link to="/" className="font-ui text-[11px] tracking-[0.2em] text-paper/55 uppercase">
              ← Shelf
            </Link>
            <h1 className="mt-3 font-serif text-5xl tracking-tight text-paper">Native</h1>
            <p className="mt-2 max-w-[46ch] font-serif text-lg text-paper/70">
              Kotlin for the Daylight. Swift for the phone. HTTP pull and push until both have kept a
              mark overnight. PowerSync stays in the drawer.
            </p>
          </div>
          <div className="border border-paper/20 px-4 py-3 font-ui text-[11px] tracking-[0.16em] uppercase">
            {NATIVE_PROTOCOL}
            <div className="mt-1 text-paper/55">
              PowerSync {POWERSYNC_LOCKED ? "locked" : "open"}
            </div>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <Card kicker="Origin" title="HTTP v1">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 font-serif text-[15px]">
              <dt className="text-ink-soft">Health</dt>
              <dd>{health ? `${health.protocol} · ${health.catalogSize} books` : "calling…"}</dd>
              <dt className="text-ink-soft">You</dt>
              <dd>{me || "—"}</dd>
              <dt className="text-ink-soft">Snapshot</dt>
              <dd>
                {snapMarks} marks · {snapVoices} voices
              </dd>
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void pullSnapshot()}
                className="border border-ink bg-ink px-3 py-2 font-ui text-[11px] tracking-wide text-paper uppercase"
              >
                Pull Living Structure
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void roundtrip()}
                className="border border-ink px-3 py-2 font-ui text-[11px] tracking-wide uppercase"
              >
                Leave a native mark
              </button>
            </div>
            <ol className="mt-5 space-y-1.5 font-ui text-[12px] leading-snug text-ink-soft">
              {logs.map((l, i) => (
                <li key={`${l.t}-${i}`} className={l.ok ? "text-ink" : "text-ink-soft"}>
                  <span className="mr-2 tabular-nums opacity-50">{l.t}</span>
                  {l.ok ? "·" : "×"} {l.text}
                </li>
              ))}
            </ol>
          </Card>

          <Card kicker="Catalog" title="Six books, in the binary">
            <ul className="space-y-3">
              {catalog.map((b) => (
                <li key={b.id} className="flex items-baseline justify-between gap-3 border-b border-rule pb-2">
                  <div>
                    <div className="font-serif text-[17px]">{b.title}</div>
                    <div className="font-ui text-[11px] tracking-wide text-ink-soft uppercase">
                      {b.author}
                      {b.year ? ` · ${b.year}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 font-ui text-[11px] text-ink-faint">
                    {b.chapterCount} ch · {b.wordCount.toLocaleString()} w
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card kicker="Daylight DC-1" title="Kotlin · Compose">
            <p className="font-serif text-[16px] leading-relaxed text-ink-soft">
              1184×1584. Jetpack Compose, SQLiteOpenHelper (not Room), OkHttp against this protocol.
              Matter taps are native. The page is Compose text with a measurer — not a WebView.
              Theo’s notes ship as assets. Marks write locally first; a later pull/push is just HTTP.
            </p>
            <ul className="mt-4 space-y-1 font-ui text-[12px] tracking-wide text-ink-soft uppercase">
              <li>computer.daylight.folio</li>
              <li>minSdk 26 · compileSdk 35 · Compose BOM 2024.12.01</li>
              <li>No PowerSync dependency</li>
            </ul>
          </Card>

          <Card kicker="iPhone" title="SwiftUI">
            <p className="font-serif text-[16px] leading-relaxed text-ink-soft">
              390×844 twin. SwiftUI + SwiftData, URLSession, the same catalog JSON. Writing marks is
              in this build — not a later phase. Voice is AVAudioRecorder. Pagination is CoreText
              frames so a tap hits a word, not a web view.
            </p>
            <ul className="mt-4 space-y-1 font-ui text-[12px] tracking-wide text-ink-soft uppercase">
              <li>ios/Folio · iOS 17</li>
              <li>SwiftData tables match folio_* names</li>
              <li>No PowerSync package</li>
            </ul>
          </Card>
        </div>

        <section className="mt-4 border border-paper/25 bg-desk-2 p-6">
          <div className="font-ui text-[11px] tracking-[0.18em] text-paper/50 uppercase">Locked</div>
          <h2 className="mt-1 font-serif text-[28px] text-paper">PowerSync</h2>
          <p className="mt-3 max-w-[54ch] font-serif text-[17px] leading-relaxed text-paper/75">
            Two-way CRDT sync waits until both native apps have kept a mark overnight on real
            hardware. A sync engine on top of an unproven store launders bugs. HTTP v1 is enough
            to prove the stores. The flag is {POWERSYNC_LOCKED ? "on" : "off"}.
          </p>
          <ol className="mt-5 max-w-[54ch] list-decimal space-y-2 pl-5 font-serif text-[15px] text-paper/70">
            <li>DC-1: mark a sentence, force-stop, reopen — still there.</li>
            <li>iPhone: same, in a different book.</li>
            <li>Sign in on both. Pull. The mark crosses. Then we unlock.</li>
          </ol>
        </section>
      </div>
    </div>
  );
}

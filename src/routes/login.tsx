import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="grid min-h-dvh place-items-center bg-desk px-6">
      <div className="w-full max-w-md border border-rule-strong bg-paper p-10 text-ink shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <p className="font-ui text-[11px] tracking-[0.22em] text-ink-soft uppercase">Daylight · DC-1</p>
        <h1 className="mt-3 font-serif text-5xl tracking-tight">Folio</h1>
        <p className="mt-3 max-w-[28ch] font-serif text-lg leading-snug text-ink-soft">
          Read. Mark. Remember. A paper reader that syncs the garden to the train.
        </p>
        <div className="mt-8 flex flex-col gap-2">
          {authEnabled ? (
            GROK_PROVIDERS.map((p) => (
              <button
                key={p.providerId}
                type="button"
                onClick={() => signIn(p.providerId, { callbackURL: "/" })}
                className="h-12 border border-ink bg-ink font-ui text-[13px] tracking-wide text-paper uppercase transition-transform duration-150 active:scale-[0.98]"
              >
                Continue with {p.label}
              </button>
            ))
          ) : (
            <p className="text-sm text-ink-soft">Sign-in is disabled.</p>
          )}
        </div>
        <p className="mt-6 font-serif text-[13px] leading-relaxed text-ink-faint">
          Two taps a word. Three a sentence. Hold the microphone when a feeling is faster than a keyboard.
        </p>
        <Link to="/" className="mt-6 inline-block font-ui text-[12px] tracking-wide text-ink-soft uppercase">
          Read without an account
        </Link>
      </div>
    </main>
  );
}

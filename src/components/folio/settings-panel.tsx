import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { UserButton } from "@/lib/auth/gates";
import { useFolioUi } from "@/lib/folio/store";
import type { FolioSettings } from "@/lib/folio/types";
import { useFolio } from "./folio-state";

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-rule py-4">
      <div>
        <div className="font-serif text-[17px]">{label}</div>
        {hint && <div className="mt-1 max-w-[28ch] text-[12px] leading-snug text-ink-soft">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Seg<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex border border-rule">
      {options.map((o) => (
        <button
          key={String(o.id)}
          type="button"
          onClick={() => onChange(o.id)}
          className={
            "px-2.5 py-1.5 font-ui text-[11px] uppercase " +
            (value === o.id ? "bg-ink text-paper" : "text-ink")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={
        "relative h-7 w-12 rounded-full transition-colors duration-150 " +
        (on ? "bg-ink" : "bg-paper-3")
      }
    >
      <span
        className={
          "absolute top-0.5 left-0.5 size-6 rounded-full bg-paper transition-transform duration-150 " +
          (on ? "translate-x-5" : "")
        }
      />
    </button>
  );
}

export function SettingsPanel() {
  const { settings, patchSettings } = useFolio();
  const setDevice = useFolioUi((s) => s.setDevice);
  const s = settings;

  function set<K extends keyof FolioSettings>(key: K, value: FolioSettings[K]) {
    patchSettings({ [key]: value });
    if (key === "device" && (value === "dc1" || value === "phone")) setDevice(value);
  }

  return (
    <div>
      <Row label="Type size">
        <Seg
          value={s.typeScale}
          onChange={(v) => set("typeScale", v)}
          options={[
            { id: 0 as const, label: "S" },
            { id: 1 as const, label: "M" },
            { id: 2 as const, label: "L" },
            { id: 3 as const, label: "XL" },
          ]}
        />
      </Row>
      <Row label="Leading">
        <Seg
          value={s.leading}
          onChange={(v) => set("leading", v)}
          options={[
            { id: "tight" as const, label: "Tight" },
            { id:  "normal" as const, label: "Book" },
            { id: "loose" as const, label: "Loose" },
          ]}
        />
      </Row>
      <Row label="Measure">
        <Seg
          value={s.measure}
          onChange={(v) => set("measure", v)}
          options={[
            { id: "narrow" as const, label: "Narrow" },
            { id: "book" as const, label: "Folio" },
            { id: "wide" as const, label: "Wide" },
          ]}
        />
      </Row>
      <Row label="Justify" hint="Like a printed leaf. Off for a ragged right.">
        <Toggle on={s.justify} onChange={(v) => set("justify", v)} />
      </Row>
      <Row label="Page turn" hint="Curl is the Play Books lift. Slide is quieter. None is instant.">
        <Seg
          value={s.pageAnim}
          onChange={(v) => set("pageAnim", v)}
          options={[
            { id: "curl" as const, label: "Curl" },
            { id: "slide" as const, label: "Slide" },
            { id: "none" as const, label: "Cut" },
          ]}
        />
      </Row>
      <Row
        label="Gloss"
        hint="A teacher’s margin. Dotted words on the page get two sentences. Tap I know this and the underline leaves. Unknown words ask Grok, once."
      >
        <Toggle on={s.gloss} onChange={(v) => set("gloss", v)} />
      </Row>
      <Row
        label="Peek"
        hint="Hold a link. A sheet of the article slides from the right — not a browser tab. Lift to go back. Drag left to keep it."
      >
        <Toggle on={s.linkSlide} onChange={(v) => set("linkSlide", v)} />
      </Row>
      <Row label="Preview as">
        <Seg
          value={s.device === "auto" ? "dc1" : s.device}
          onChange={(v) => set("device", v)}
          options={[
            { id: "dc1" as const, label: "DC-1" },
            { id: "phone" as const, label: "iPhone" },
          ]}
        />
      </Row>

      <div className="mt-8 font-serif">
        <h3 className="font-ui text-[11px] tracking-[0.18em] text-ink-soft uppercase">Sync</h3>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          Sign in once. Marks, voice, tags, and the page you were on travel with the account — garden folio to
          phone. A circle’s voices travel too: you leave a note on the Daylight, a friend hears it on the train.
        </p>
        <div className="mt-4">
          <UserButton />
        </div>
        <Link
          to="/native"
          className="mt-5 inline-block border border-rule px-3 py-2 font-ui text-[11px] tracking-wide uppercase"
        >
          Native lab · HTTP v1
        </Link>
      </div>

      <Spec />
    </div>
  );
}

function Spec() {
  return (
    <div className="mt-10 space-y-4 font-serif text-[14px] leading-relaxed text-ink-soft">
      <h3 className="font-ui text-[11px] tracking-[0.18em] text-ink uppercase">Now · native</h3>
      <p>
        <strong className="text-ink">DC-1.</strong> Kotlin, Jetpack Compose, 1184×1584. SQLiteOpenHelper as
        the local store — not Room, so the schema matches the protocol without a KSP plugin. Compose text +
        a measurer for paging so Matter taps hit words, not a WebView. OkHttp talks HTTP v1 when a session
        is present. Marks write locally first.
      </p>
      <p>
        <strong className="text-ink">iPhone.</strong> SwiftUI, 390×844. SwiftData tables use the same names.
        Writing marks is in this build, not a later phase: highlight, bookmark, voice, tags. URLSession
        pull/push. CoreText frames for the page.
      </p>
      <p>
        <strong className="text-ink">PowerSync — locked.</strong> Postgres as origin is still the end state.
        It waits until both native apps have kept a mark overnight on real hardware. Until then the only
        network is HTTP v1: last-writer on progress, union on highlights. The health endpoint reports{" "}
        <code className="font-ui text-[12px]">powersync: locked</code>.
      </p>
      <p>
        <strong className="text-ink">Library plugin.</strong>{" "}
        <code className="font-ui text-[12px]">search(query) → hits</code>, then{" "}
        <code className="font-ui text-[12px]">fetchEpub(hit) → bytes</code>. Gutenberg implements it. A Telegram
        bot, a personal NAS, a university proxy — same two functions, same EPUB parser. Folio will not ship a
        pirate source.
      </p>
    </div>
  );
}

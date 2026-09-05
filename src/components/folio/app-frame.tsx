import { useEffect, type ReactNode } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useFolioUi } from "@/lib/folio/store";
import { DeviceShell } from "./device-shell";
import { FolioProvider, useFolio } from "./folio-state";

export function AppFrame({ children }: { children: ReactNode }) {
  const { isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center bg-desk px-6">
        <div className="w-full max-w-md border border-rule-strong bg-paper p-10 text-ink">
          <p className="font-ui text-[11px] tracking-[0.22em] text-ink-soft uppercase">Daylight · DC-1</p>
          <h1 className="mt-3 font-serif text-5xl tracking-tight">Folio</h1>
          <p className="mt-3 font-serif text-lg text-ink-soft">Opening the shelf…</p>
        </div>
      </div>
    );
  }
  return (
    <FolioProvider>
      <Framed>{children}</Framed>
    </FolioProvider>
  );
}

function Framed({ children }: { children: ReactNode }) {
  const { settings, patchSettings } = useFolio();
  const device = useFolioUi((s) => s.device);
  const setDevice = useFolioUi((s) => s.setDevice);

  useEffect(() => {
    if (settings.device === "auto") {
      setDevice(window.innerWidth < 700 ? "phone" : "dc1");
    } else {
      setDevice(settings.device);
    }
  }, [settings.device, setDevice]);

  return (
    <DeviceShell
      mode={device}
      onMode={(m) => {
        setDevice(m);
        patchSettings({ device: m });
      }}
    >
      {children}
    </DeviceShell>
  );
}

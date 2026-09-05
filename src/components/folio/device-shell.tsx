import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { DC_HEIGHT, DC_WIDTH, PHONE_HEIGHT, PHONE_WIDTH, type DeviceMode } from "@/lib/folio/types";

export function useFitScale(w: number, h: number) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => {
      const padX = 24;
      const padY = 56;
      const vw = Math.max(320, window.innerWidth - padX);
      const vh = Math.max(400, window.innerHeight - padY);
      setScale(Math.min(vw / w, vh / h, 1));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [w, h]);
  return scale;
}

export function DeviceShell({
  mode,
  onMode,
  children,
}: {
  mode: DeviceMode;
  onMode: (m: DeviceMode) => void;
  children: ReactNode;
}) {
  const w = mode === "dc1" ? DC_WIDTH : PHONE_WIDTH;
  const h = mode === "dc1" ? DC_HEIGHT : PHONE_HEIGHT;
  const scale = useFitScale(w, h);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-desk text-paper">
      <div className="flex items-center gap-3 pb-3 font-ui text-[11px] tracking-[0.18em] text-paper/55 uppercase">
        <button
          type="button"
          onClick={() => onMode("dc1")}
          className={cn(
            "rounded-full px-3 py-1.5 transition-colors duration-150",
            mode === "dc1" ? "bg-paper text-ink" : "text-paper/60 hover:text-paper",
          )}
        >
          Daylight DC-1
        </button>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          onClick={() => onMode("phone")}
          className={cn(
            "rounded-full px-3 py-1.5 transition-colors duration-150",
            mode === "phone" ? "bg-paper text-ink" : "text-paper/60 hover:text-paper",
          )}
        >
          iPhone
        </button>
      </div>
      <div style={{ width: w * scale, height: h * scale }} className="relative">
        <div
          className={cn(
            "absolute top-0 left-0 overflow-hidden bg-paper text-ink shadow-[0_24px_80px_rgba(0,0,0,0.45)]",
            mode === "dc1" ? "rounded-[22px] ring-1 ring-bezel" : "rounded-[38px] ring-[10px] ring-bezel",
          )}
          style={{
            width: w,
            height: h,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {mode === "phone" && (
            <div className="pointer-events-none absolute top-2 left-1/2 z-30 h-6 w-28 -translate-x-1/2 rounded-full bg-desk/90" />
          )}
          <div className="paper-grain absolute inset-0 opacity-20 mix-blend-multiply" />
          <div className="relative h-full w-full">{children}</div>
        </div>
      </div>
    </div>
  );
}

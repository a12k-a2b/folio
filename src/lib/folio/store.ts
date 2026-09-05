import { create } from "zustand";
import type { DeviceMode } from "./types";

type UiState = {
  device: DeviceMode;
  setDevice: (d: DeviceMode) => void;
  sidebarOpen: boolean;
  sidebarTab: "book" | "circle" | "marks" | "tags" | "search" | "settings";
  setSidebar: (open: boolean, tab?: UiState["sidebarTab"]) => void;
  chromeVisible: boolean;
  setChrome: (v: boolean) => void;
  toggleChrome: () => void;
  activeHighlightId: string | null;
  setActiveHighlight: (id: string | null) => void;
  toast: string | null;
  toastUndo: (() => void) | null;
  showToast: (msg: string, undo?: () => void) => void;
  dismissToast: () => void;
  linkUrl: string | null;
  setLinkUrl: (url: string | null) => void;
  glossWord: string | null;
  glossDef: string | null;
  setGloss: (word: string | null, def?: string | null) => void;
};

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useFolioUi = create<UiState>((set) => ({
  device: "dc1",
  setDevice: (device) => set({ device }),
  sidebarOpen: false,
  sidebarTab: "book",
  setSidebar: (sidebarOpen, tab) =>
    set((s) => ({ sidebarOpen, sidebarTab: tab ?? s.sidebarTab })),
  chromeVisible: true,
  setChrome: (chromeVisible) => set({ chromeVisible }),
  toggleChrome: () => set((s) => ({ chromeVisible: !s.chromeVisible })),
  activeHighlightId: null,
  setActiveHighlight: (activeHighlightId) => set({ activeHighlightId }),
  toast: null,
  toastUndo: null,
  showToast: (toast, undo) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast, toastUndo: undo ?? null });
    toastTimer = setTimeout(() => set({ toast: null, toastUndo: null }), undo ? 4400 : 2600);
  },
  dismissToast: () => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: null, toastUndo: null });
  },
  linkUrl: null,
  setLinkUrl: (linkUrl) => set({ linkUrl }),
  glossWord: null,
  glossDef: null,
  setGloss: (glossWord, glossDef = null) => set({ glossWord, glossDef }),
}));

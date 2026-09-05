import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { apiBootstrap, apiLoadLibrary, apiSaveSettings } from "@/lib/folio/api";
import { setFolioAuthed } from "@/lib/folio/session-mode";
import {
  DEFAULT_SETTINGS,
  type Club,
  type FolioSettings,
  type LibraryItem,
  type Progress,
} from "@/lib/folio/types";

type FolioState = {
  ready: boolean;
  authed: boolean;
  userId: string;
  displayName: string;
  books: LibraryItem[];
  progress: Progress[];
  settings: FolioSettings;
  clubs: Club[];
  refresh: () => Promise<void>;
  patchSettings: (p: Partial<FolioSettings>) => void;
};

const Ctx = createContext<FolioState | null>(null);

export function FolioProvider({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const [ready, setReady] = useState(false);
  const [books, setBooks] = useState<LibraryItem[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [settings, setSettings] = useState<FolioSettings>(DEFAULT_SETTINGS);
  const [clubs, setClubs] = useState<Club[]>([]);

  const refresh = useCallback(async () => {
    const data = await apiLoadLibrary();
    setBooks(data.books);
    setProgress(data.progress);
    setSettings(data.settings);
    setClubs(data.clubs ?? []);
  }, []);

  useEffect(() => {
    if (isPending) return;
    let alive = true;
    setFolioAuthed(Boolean(user));
    setReady(false);
    (async () => {
      try {
        await apiBootstrap();
        if (!alive) return;
        await refresh();
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isPending, user, refresh]);

  const patchSettings = useCallback((p: Partial<FolioSettings>) => {
    setSettings((s) => {
      const next = { ...s, ...p };
      void apiSaveSettings(next);
      return next;
    });
  }, []);

  const displayName = user?.displayName || "You";
  const userId = user?.id ?? "local";

  const value = useMemo(
    () => ({
      ready,
      authed: Boolean(user),
      userId,
      displayName,
      books,
      progress,
      settings,
      clubs,
      refresh,
      patchSettings,
    }),
    [ready, user, userId, displayName, books, progress, settings, clubs, refresh, patchSettings],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFolio() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFolio outside provider");
  return ctx;
}

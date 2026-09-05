import { createFileRoute } from "@tanstack/react-router";
import { AppFrame } from "@/components/folio/app-frame";
import { LibraryView } from "@/components/folio/library-view";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <AppFrame>
      <LibraryView />
    </AppFrame>
  );
}

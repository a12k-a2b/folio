import { createFileRoute } from "@tanstack/react-router";
import { AppFrame } from "@/components/folio/app-frame";
import { ReaderView } from "@/components/folio/reader-view";

export const Route = createFileRoute("/read/$bookId")({ component: ReadPage });

function ReadPage() {
  const { bookId } = Route.useParams();
  return (
    <AppFrame>
      <ReaderView bookId={bookId} />
    </AppFrame>
  );
}

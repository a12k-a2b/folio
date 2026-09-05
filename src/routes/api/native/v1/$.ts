import { createFileRoute } from "@tanstack/react-router";
import { handleNativeRequest } from "@/lib/folio/native-api.server";

export const Route = createFileRoute("/api/native/v1/$")({
  server: {
    handlers: {
      GET: ({ request }) => handleNativeRequest(request),
      POST: ({ request }) => handleNativeRequest(request),
      PATCH: ({ request }) => handleNativeRequest(request),
      DELETE: ({ request }) => handleNativeRequest(request),
      OPTIONS: ({ request }) => handleNativeRequest(request),
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { NativeLab } from "@/components/folio/native-lab";

export const Route = createFileRoute("/native")({ component: NativeLab });

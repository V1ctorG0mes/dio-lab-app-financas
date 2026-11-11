import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import type { ChatStreamEvent } from "@/lib/chat-types";

const Body = z.object({
  message: z.string().trim().min(1).max(1000),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authenticate, runFinanceAgent } = await import("@/lib/finance-agent.server");
        const auth = await authenticate(request.headers.get("authorization"));
        if (!auth) return Response.json({ error: "Não autorizado" }, { status: 401 });

        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Mensagem inválida" }, { status: 400 });

        const encoder = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
          async start(controller) {
            const emit = (e: ChatStreamEvent) => {
              try {
                controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
              } catch {
                /* client went away */
              }
            };
            try {
              await runFinanceAgent({
                supabase: auth.supabase,
                userId: auth.userId,
                message: parsed.data.message,
                today: parsed.data.today,
                emit,
                signal: request.signal,
              });
            } catch (err) {
              console.error("[api/chat]", err);
              emit({ type: "error", message: "Algo deu errado. Tente novamente." });
            } finally {
              try {
                controller.close();
              } catch {
                /* already closed */
              }
            }
          },
        });
        return new Response(body, {
          headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
        });
      },
    },
  },
});

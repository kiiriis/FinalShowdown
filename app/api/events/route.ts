import { auth } from "@/lib/auth";
import { emitter, type ChangeEvent } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      safeEnqueue(`: connected ${Date.now()}\n\n`);

      const onChange = (payload: ChangeEvent) => {
        safeEnqueue(`data: ${JSON.stringify(payload)}\n\n`);
      };
      emitter.on("change", onChange);

      // Named `ping` events — unlike SSE comments, these fire on the client
      // and let the watchdog detect a silently-dead connection.
      const heartbeat = setInterval(() => {
        safeEnqueue(`event: ping\ndata: ${Date.now()}\n\n`);
      }, 25_000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        emitter.off("change", onChange);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}

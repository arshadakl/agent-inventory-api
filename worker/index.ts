import { Hono } from "hono";
import { logger } from "hono/logger";

import type { WorkerEnvironment } from "./env";

const app = new Hono<WorkerEnvironment>();

app.use("/api/*", logger());

app.use("/api/*", async (context, next) => {
  const requestId = crypto.randomUUID();
  context.set("requestId", requestId);
  context.header("X-Request-Id", requestId);
  await next();
});

app.get("/api/health", (context) =>
  context.json({
    data: {
      service: "real-estate-inventory",
      status: "ok" as const,
    },
  }),
);

app.notFound((context) =>
  context.json(
    {
      error: {
        code: "NOT_FOUND",
        message: "The requested resource was not found.",
      },
    },
    404,
  ),
);

app.onError((error, context) => {
  console.error("Unhandled Worker error", {
    error,
    requestId: context.get("requestId"),
  });

  return context.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong.",
      },
    },
    500,
  );
});

export default app;

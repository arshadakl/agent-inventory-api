import { Hono } from "hono";
import { logger } from "hono/logger";

import type { WorkerEnvironment } from "./env";
import { requireAuthentication } from "./middleware/auth";
import { requireSameOrigin } from "./middleware/origin";
import { errorResponse } from "./lib/response";
import { authRoutes } from "./routes/auth";
import { propertyRoutes } from "./routes/properties";
import { userRoutes } from "./routes/users";

const app = new Hono<WorkerEnvironment>();

app.use("/api/*", logger());

app.use("/api/*", async (context, next) => {
  const requestId = crypto.randomUUID();
  context.set("requestId", requestId);
  context.header("X-Request-Id", requestId);
  await next();
});

app.use("/api/*", requireSameOrigin);
app.use("/api/*", requireAuthentication);

app.route("/api/auth", authRoutes);
app.route("/api/properties", propertyRoutes);
app.route("/api/users", userRoutes);

app.get("/api/health", (context) =>
  context.json({
    data: {
      service: "real-estate-inventory",
      status: "ok" as const,
    },
  }),
);

app.notFound((context) =>
  errorResponse(
    context,
    404,
    "NOT_FOUND",
    "The requested resource was not found.",
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

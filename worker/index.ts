import { Hono } from "hono";
import { logger } from "hono/logger";

import type { WorkerEnvironment } from "./env";
import { requireAuthentication } from "./middleware/auth";
import { requireApiKey } from "./middleware/api-key";
import { requireInboxApiKey } from "./middleware/inbox-api-key";
import { requireSameOrigin } from "./middleware/origin";
import { errorResponse } from "./lib/response";
import { authRoutes } from "./routes/auth";
import { apiKeyRoutes } from "./routes/api-keys";
import { integrationActionRoutes } from "./routes/integration-actions";
import { propertyRoutes } from "./routes/properties";
import { dashboardRoutes } from "./routes/dashboard";
import { userRoutes } from "./routes/users";
import { inboxRoutes } from "./routes/inbox";
import { inboxEventRoutes } from "./routes/inbox-events";

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
app.use("/api/v1/actions/*", requireApiKey);
app.use("/api/v1/inbox/*", requireInboxApiKey("inbox:write"));

app.route("/api/auth", authRoutes);
app.route("/api/api-keys", apiKeyRoutes);
app.route("/api/v1/actions", integrationActionRoutes);
app.route("/api/properties", propertyRoutes);
app.route("/api/dashboard", dashboardRoutes);
app.route("/api/users", userRoutes);
app.route("/api/inbox", inboxRoutes);
app.route("/api/v1/inbox", inboxEventRoutes);

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

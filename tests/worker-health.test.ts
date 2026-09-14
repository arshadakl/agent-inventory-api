import { describe, expect, it } from "vitest";

import app from "../worker/index";

describe("Worker health endpoint", () => {
  it("reports that the API is available", async () => {
    const response = await app.request(
      "https://inventory.example.com/api/health",
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    await expect(response.json()).resolves.toEqual({
      data: {
        service: "real-estate-inventory",
        status: "ok",
      },
    });
  });

  it("uses the standard error envelope for unknown API routes", async () => {
    const response = await app.request(
      "https://inventory.example.com/api/missing",
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "NOT_FOUND",
        message: "The requested resource was not found.",
      },
    });
  });
});

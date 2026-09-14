import { z } from "zod";

import type { LoginInput } from "@shared/schemas/auth";
import { authenticatedUserSchema } from "@shared/schemas/user";

import { apiRequest, apiRequestVoid } from "@/lib/api-client";

const authResponseSchema = z.object({ user: authenticatedUserSchema });

export async function getCurrentUser() {
  return apiRequest("/api/auth/me", authResponseSchema);
}

export async function login(input: LoginInput) {
  return apiRequest("/api/auth/login", authResponseSchema, {
    method: "POST",
    body: input,
  });
}

export async function logout(): Promise<void> {
  return apiRequestVoid("/api/auth/logout", { method: "POST" });
}

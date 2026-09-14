import { z } from "zod";

import type { CreateUserInput } from "@shared/schemas/auth";
import { userSchema } from "@shared/schemas/user";

import { apiRequest, apiRequestVoid } from "@/lib/api-client";

const usersResponseSchema = z.object({ users: z.array(userSchema) });
const userResponseSchema = z.object({ user: userSchema });

export async function getUsers() {
  return apiRequest("/api/users", usersResponseSchema);
}

export async function createUser(input: CreateUserInput) {
  return apiRequest("/api/users", userResponseSchema, {
    method: "POST",
    body: input,
  });
}

export async function deleteUser(id: string): Promise<void> {
  return apiRequestVoid(`/api/users/${id}`, { method: "DELETE" });
}

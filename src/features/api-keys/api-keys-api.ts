import { z } from "zod";

import type { CreateApiKeyInput } from "@shared/schemas/api-key";
import { apiKeySchema } from "@shared/schemas/api-key";

import { apiRequest, apiRequestVoid } from "@/lib/api-client";

const apiKeysResponseSchema = z.object({ apiKeys: z.array(apiKeySchema) });
const createdApiKeyResponseSchema = z.object({
  apiKey: apiKeySchema,
  secret: z.string().min(1),
});

export function getApiKeys() {
  return apiRequest("/api/api-keys", apiKeysResponseSchema);
}

export function createApiKey(input: CreateApiKeyInput) {
  return apiRequest("/api/api-keys", createdApiKeyResponseSchema, {
    method: "POST",
    body: input,
  });
}

export function deleteApiKey(id: string): Promise<void> {
  return apiRequestVoid(`/api/api-keys/${id}`, { method: "DELETE" });
}

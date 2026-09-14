import type { apiKeySchema } from "../schemas/api-key";
import type { z } from "zod";

export type ApiKey = z.output<typeof apiKeySchema>;

export interface CreatedApiKey {
  apiKey: ApiKey;
  secret: string;
}

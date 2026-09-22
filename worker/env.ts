import type { AuthenticatedUser } from "@shared/types/user";
import type { InboxScope } from "@shared/schemas/inbox";

export interface Bindings {
  DB: D1Database;
  INBOX_MEDIA: R2Bucket;
  N8N_WEBHOOK_URL: string;
  N8N_WEBHOOK_SECRET: string;
}

export interface WorkerVariables {
  apiKeyId: string;
  apiKeyScopes: InboxScope[] | null;
  currentUser: AuthenticatedUser;
  requestId: string;
  sessionToken: string;
}

export type WorkerEnvironment = {
  Bindings: Bindings;
  Variables: WorkerVariables;
};

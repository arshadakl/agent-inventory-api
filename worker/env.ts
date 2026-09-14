import type { AuthenticatedUser } from "@shared/types/user";

export interface Bindings {
  DB: D1Database;
}

export interface WorkerVariables {
  currentUser: AuthenticatedUser;
  requestId: string;
  sessionToken: string;
}

export type WorkerEnvironment = {
  Bindings: Bindings;
  Variables: WorkerVariables;
};

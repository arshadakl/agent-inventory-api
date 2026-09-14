export interface Bindings {
  DB: D1Database;
}

export interface WorkerVariables {
  requestId: string;
}

export type WorkerEnvironment = {
  Bindings: Bindings;
  Variables: WorkerVariables;
};

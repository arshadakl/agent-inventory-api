export const queryKeys = {
  authentication: ["authentication"] as const,
  currentUser: ["authentication", "current-user"] as const,
  properties: ["properties"] as const,
  users: ["users"] as const,
  dashboard: ["dashboard"] as const,
  apiKeys: ["api-keys"] as const,
} as const;

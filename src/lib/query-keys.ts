export const queryKeys = {
  authentication: ["authentication"] as const,
  currentUser: ["authentication", "current-user"] as const,
  properties: ["properties"] as const,
  users: ["users"] as const,
  dashboard: ["dashboard"] as const,
  apiKeys: ["api-keys"] as const,
  inbox: ["inbox"] as const,
  conversations: ["inbox", "conversations"] as const,
  messages: (conversationId: string) =>
    ["inbox", "conversations", conversationId, "messages"] as const,
} as const;

import { useMutation, useQuery } from "@tanstack/react-query";

import type { CreateApiKeyInput } from "@shared/schemas/api-key";

import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";

import { createApiKey, getApiKeys, revokeApiKey } from "./api-keys-api";

export function useApiKeys() {
  return useQuery({
    queryKey: queryKeys.apiKeys,
    queryFn: async () => (await getApiKeys()).apiKeys,
  });
}

export function useCreateApiKey() {
  return useMutation({
    mutationFn: (input: CreateApiKeyInput) => createApiKey(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys });
    },
  });
}

export function useRevokeApiKey() {
  return useMutation({
    mutationFn: revokeApiKey,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys });
    },
  });
}

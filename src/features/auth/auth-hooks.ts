import { useMutation, useQuery } from "@tanstack/react-query";

import type { LoginInput } from "@shared/schemas/auth";

import { ApiClientError } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";

import { getCurrentUser, login, logout } from "./auth-api";

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: async () => {
      try {
        return (await getCurrentUser()).user;
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 401) {
          return null;
        }

        throw error;
      }
    },
    retry: false,
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: (input: LoginInput) => login(input),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(queryKeys.currentUser, user);
    },
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(queryKeys.currentUser, null);
    },
  });
}

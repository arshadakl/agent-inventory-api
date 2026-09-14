import { useMutation, useQuery } from "@tanstack/react-query";

import type { CreateUserInput } from "@shared/schemas/auth";

import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";

import { createUser, deleteUser, getUsers } from "./users-api";

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: async () => (await getUsers()).users,
  });
}

export function useCreateUser() {
  return useMutation({
    mutationFn: (input: CreateUserInput) => createUser(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.users });
    },
  });
}

export function useDeleteUser() {
  return useMutation({
    mutationFn: deleteUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.users });
    },
  });
}

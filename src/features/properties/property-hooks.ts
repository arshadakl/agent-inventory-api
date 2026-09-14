import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";

import type { PropertyListQuery } from "@shared/schemas/property";

import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";

import { deleteProperty, getProperties } from "./properties-api";

export function useProperties(filters: PropertyListQuery) {
  return useQuery({
    queryKey: [...queryKeys.properties, filters],
    queryFn: () => getProperties(filters),
    placeholderData: keepPreviousData,
  });
}

export function useDeleteProperty() {
  return useMutation({
    mutationFn: deleteProperty,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.properties }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
      ]);
    },
  });
}

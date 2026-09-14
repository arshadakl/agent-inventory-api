import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";

import type {
  PropertyInput,
  PropertyListQuery,
} from "@shared/schemas/property";

import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";

import {
  createProperty,
  deleteProperty,
  getProperties,
  getProperty,
  updateProperty,
} from "./properties-api";

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

export function useProperty(id: string | undefined) {
  return useQuery({
    queryKey: [...queryKeys.properties, "detail", id],
    queryFn: async () => {
      if (!id) throw new Error("A property ID is required.");
      return (await getProperty(id)).property;
    },
    enabled: Boolean(id),
    retry: false,
  });
}

export function useCreateProperty() {
  return useMutation({
    mutationFn: createProperty,
    onSuccess: invalidatePropertyData,
  });
}

export function useUpdateProperty(id: string) {
  return useMutation({
    mutationFn: (input: PropertyInput) => updateProperty(id, input),
    onSuccess: invalidatePropertyData,
  });
}

async function invalidatePropertyData(): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.properties }),
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
  ]);
}

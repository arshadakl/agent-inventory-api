import { useMutation, useQuery } from "@tanstack/react-query";

import type {
  ConversationListQuery,
  MessageListQuery,
  SendInboxMessageInput,
} from "@shared/schemas/inbox";

import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";

import {
  getConversations,
  getMessages,
  sendMessage,
  markConversationRead,
  uploadMedia,
} from "./inbox-api";

export const inboxQueryKeys = {
  ...queryKeys,
  inbox: ["inbox"] as const,
  conversations: ["inbox", "conversations"] as const,
  messages: (conversationId: string) =>
    ["inbox", "conversations", conversationId, "messages"] as const,
};

export function useConversations(query: ConversationListQuery) {
  return useQuery({
    queryKey: [...inboxQueryKeys.conversations, query],
    queryFn: () => getConversations(query),
    refetchInterval: 5000,
  });
}

export function useMessages(
  conversationId: string | null,
  query: MessageListQuery,
) {
  return useQuery({
    queryKey: inboxQueryKeys.messages(conversationId ?? ""),
    queryFn: () => {
      if (!conversationId) throw new Error("Conversation ID is required.");
      return getMessages(conversationId, query);
    },
    enabled: Boolean(conversationId),
    refetchInterval: 3000,
  });
}

export function useSendMessage(conversationId: string) {
  return useMutation({
    mutationFn: (input: SendInboxMessageInput) =>
      sendMessage(conversationId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: inboxQueryKeys.conversations,
      });
      void queryClient.invalidateQueries({
        queryKey: inboxQueryKeys.messages(conversationId),
      });
    },
  });
}

export function useMarkRead(conversationId: string) {
  return useMutation({
    mutationFn: () => markConversationRead(conversationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: inboxQueryKeys.conversations,
      });
    },
  });
}

export function useUploadMedia() {
  return useMutation({
    mutationFn: uploadMedia,
  });
}

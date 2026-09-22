import { useMemo, useState } from "react";
import { Search, MessageSquare, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { useConversations } from "./inbox-hooks";
import type { ConversationListItem } from "./inbox-api";

interface ConversationListProps {
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
}

export function ConversationList({
  selectedConversationId,
  onSelectConversation,
}: ConversationListProps) {
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const query = useMemo(
    () => ({
      q: search || undefined,
      unreadOnly: unreadOnly,
      limit: 50,
    }),
    [search, unreadOnly],
  );

  const { data, isLoading } = useConversations(query);

  return (
    <>
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Inbox</h2>
          <Button
            variant={unreadOnly ? "default" : "ghost"}
            size="sm"
            onClick={() => setUnreadOnly(!unreadOnly)}
          >
            Unread
          </Button>
        </div>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 size-6 -translate-y-1/2"
              onClick={() => setSearch("")}
            >
              <X className="size-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <ConversationListSkeleton />
        ) : data?.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-muted-foreground">
            <MessageSquare className="size-8" />
            <p className="text-sm">No conversations found</p>
          </div>
        ) : (
          data?.items.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              isSelected={conversation.id === selectedConversationId}
              onSelect={onSelectConversation}
            />
          ))
        )}
      </div>
    </>
  );
}

function ConversationItem({
  conversation,
  isSelected,
  onSelect,
}: {
  conversation: ConversationListItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const displayName =
    conversation.contact.displayName ||
    formatPhone(conversation.contact.phoneE164);

  const initials = getInitials(displayName);
  const timeAgo = formatTimeAgo(conversation.lastMessageAt);

  return (
    <button
      className={cn(
        "flex w-full items-start gap-3 border-b p-4 text-left transition-colors hover:bg-accent/50",
        isSelected && "bg-accent",
      )}
      onClick={() => onSelect(conversation.id)}
      type="button"
    >
      {/* Avatar */}
      <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-medium text-primary">
        {initials}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{displayName}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {timeAgo}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="truncate text-sm text-muted-foreground">
            {conversation.lastMessagePreview || "No messages yet"}
          </p>
          {conversation.unreadCount > 0 && (
            <Badge
              variant="default"
              className="shrink-0 px-1.5 py-0.5 text-xs"
            >
              {conversation.unreadCount}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}

function ConversationListSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 border-b p-4">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      ))}
    </div>
  );
}

function formatPhone(phoneE164: string): string {
  if (phoneE164.length <= 10) return phoneE164;
  return phoneE164.slice(0, 3) + " " + phoneE164.slice(3, 7) + " " + phoneE164.slice(7);
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatTimeAgo(unixTimestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - unixTimestamp;

  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(unixTimestamp * 1000).toLocaleDateString();
}

import { useEffect, useRef } from "react";
import { ArrowLeft, Check, CheckCheck, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { useMessages, useMarkRead } from "./inbox-hooks";
import { MessageComposer } from "./message-composer";
import type { Message } from "./inbox-api";

interface MessageThreadProps {
  conversationId: string;
  onBack: () => void;
}

export function MessageThread({
  conversationId,
  onBack,
}: MessageThreadProps) {
  const { data, isLoading } = useMessages(conversationId, { limit: 50 });
  const markRead = useMarkRead(conversationId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasMarkedReadRef = useRef(false);

  const messages = data?.items ?? [];
  const hasUnread = messages.some(
    (m) => m.direction === "inbound" && m.status !== "read",
  );

  useEffect(() => {
    if (hasUnread && !hasMarkedReadRef.current) {
      hasMarkedReadRef.current = true;
      markRead.mutate();
    }
  }, [hasUnread, markRead]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 border-b bg-card px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onBack}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {messages[0]?.conversationId
              ? "Conversation"
              : "New conversation"}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-muted/30 p-4"
      >
        {isLoading ? (
          <MessageSkeleton />
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No messages yet
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((message, index) => {
              const prevMessage = index > 0 ? messages[index - 1] : null;
              const showDateSeparator =
                index === 0 ||
                (prevMessage !== null &&
                  prevMessage !== undefined &&
                  formatDate(message.createdAt) !==
                    formatDate(prevMessage.createdAt));

              return (
                <div key={message.id}>
                  {showDateSeparator && (
                    <div className="py-3 text-center text-xs text-muted-foreground">
                      {formatDate(message.createdAt)}
                    </div>
                  )}
                  <MessageBubble message={message} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Composer */}
      <MessageComposer conversationId={conversationId} />
    </>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isOutbound = message.direction === "outbound";

  return (
    <div
      className={cn(
        "flex justify-end",
        isOutbound ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-[75%] rounded-lg px-3 py-2 text-sm",
          isOutbound
            ? "bg-primary text-primary-foreground"
            : "bg-card text-card-foreground shadow-sm",
        )}
      >
        {message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>}
        {message.caption && (
          <p className="mt-1 whitespace-pre-wrap break-words text-xs opacity-80">
            {message.caption}
          </p>
        )}
        {message.attachments.map((attachment) => (
          <div
            key={attachment.id}
            className="mt-1 flex items-center gap-1.5 text-xs opacity-80"
          >
            <span className="truncate">{attachment.filename}</span>
          </div>
        ))}
        <div
          className={cn(
            "mt-1 flex items-center justify-end gap-1 text-xs",
            isOutbound ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          <span>{formatTime(message.createdAt)}</span>
          {isOutbound && <StatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "sent":
      return <Check className="size-3" />;
    case "delivered":
      return <CheckCheck className="size-3" />;
    case "read":
      return <CheckCheck className="size-3 text-blue-400" />;
    case "failed":
      return <AlertCircle className="size-3 text-destructive" />;
    default:
      return null;
  }
}

function MessageSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}
        >
          <Skeleton
            className={cn(
              "h-10 rounded-lg",
              i % 2 === 0 ? "w-48" : "w-40",
            )}
          />
        </div>
      ))}
    </div>
  );
}

function formatTime(unixTimestamp: number): string {
  return new Date(unixTimestamp * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(unixTimestamp: number): string {
  const date = new Date(unixTimestamp * 1000);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  const diffDays = Math.floor(
    (today.getTime() - messageDate.getTime()) / 86400000,
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString();
}

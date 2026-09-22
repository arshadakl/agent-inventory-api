import { useState } from "react";
import { MessageSquare } from "lucide-react";

import { ConversationList } from "./conversation-list";
import { MessageThread } from "./message-thread";

export function InboxPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);

  return (
    <div className="flex h-[calc(100svh-4rem)] md:h-svh">
      {/* Left pane - conversation list */}
      <div
        className={`w-full border-r bg-card md:w-[360px] ${
          selectedConversationId ? "hidden md:flex" : "flex"
        } flex-col`}
      >
        <ConversationList
          selectedConversationId={selectedConversationId}
          onSelectConversation={setSelectedConversationId}
        />
      </div>

      {/* Right pane - message thread */}
      <div
        className={`flex flex-1 flex-col ${
          selectedConversationId ? "flex" : "hidden md:flex"
        }`}
      >
        {selectedConversationId ? (
          <MessageThread
            conversationId={selectedConversationId}
            onBack={() => setSelectedConversationId(null)}
          />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
      <MessageSquare className="size-12" />
      <p className="text-sm">Select a conversation to start messaging</p>
    </div>
  );
}

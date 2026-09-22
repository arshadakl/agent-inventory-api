import { useState } from "react";
import { Send, Paperclip, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { useSendMessage, useUploadMedia } from "./inbox-hooks";

interface MessageComposerProps {
  conversationId: string;
}

export function MessageComposer({ conversationId }: MessageComposerProps) {
  const [text, setText] = useState("");
  const sendMessage = useSendMessage(conversationId);
  const uploadMedia = useUploadMedia();

  const canSend = text.trim().length > 0 && !sendMessage.isPending;

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;

    sendMessage.mutate(
      { text: trimmed, attachmentIds: [] },
      { onSuccess: () => setText("") },
    );
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    uploadMedia.mutate(file, {
      onSuccess: (attachment) => {
        sendMessage.mutate({
          text: text.trim() || undefined,
          attachmentIds: [attachment.id],
        });
        setText("");
      },
    });

    e.target.value = "";
  }

  return (
    <div className="border-t bg-card p-3">
      <div className="flex items-end gap-2">
        <label className="shrink-0">
          <input
            type="file"
            className="hidden"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            onChange={handleFileSelect}
          />
          <Button
            variant="ghost"
            size="icon"
            type="button"
            disabled={sendMessage.isPending || uploadMedia.isPending}
            asChild
          >
            <span>
              {uploadMedia.isPending ? (
                <LoaderCircle className="size-5 animate-spin" />
              ) : (
                <Paperclip className="size-5" />
              )}
            </span>
          </Button>
        </label>
        <Textarea
          className="min-h-[44px] max-h-32 resize-none"
          placeholder="Type a message..."
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button
          size="icon"
          disabled={!canSend}
          onClick={handleSend}
          type="button"
        >
          {sendMessage.isPending ? (
            <LoaderCircle className="size-5 animate-spin" />
          ) : (
            <Send className="size-5" />
          )}
        </Button>
      </div>
    </div>
  );
}

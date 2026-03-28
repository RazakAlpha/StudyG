import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";
import { useAuthSession } from "@/hooks/useAuthSession";
import { formatRelative } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Props {
  sessionId: Id<"studySessions">;
}

export default function ChatPanel({ sessionId }: Props) {
  const { user } = useAuthSession();
  const messages = useQuery(api.chat.getMessages, { sessionId });
  const sendMessage = useMutation(api.chat.sendMessage);

  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || isSending) return;

    setIsSending(true);
    const text = content;
    setContent("");
    try {
      await sendMessage({ sessionId, content: text });
    } catch {
      toast.error("Failed to send message");
      setContent(text);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages?.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-8">
            No messages yet. Start the conversation!
          </div>
        )}

        {messages?.map((msg) => {
          const isMe = msg.userId === user?.id;
          const isSystem = msg.type === "system" || msg.type === "progress_update";

          if (isSystem) {
            return (
              <div key={msg._id} className="text-center">
                <span className="text-xs text-gray-500 bg-gray-800 px-3 py-1 rounded-full">
                  {msg.content}
                </span>
              </div>
            );
          }

          return (
            <div
              key={msg._id}
              className={cn("flex gap-2", isMe && "flex-row-reverse")}
            >
              {!isMe && (
                <div className="w-7 h-7 bg-indigo-600/30 rounded-full flex items-center justify-center text-xs text-indigo-400 font-bold shrink-0 mt-1">
                  {msg.userName[0]?.toUpperCase()}
                </div>
              )}
              <div
                className={cn(
                  "max-w-[80%]",
                  isMe ? "items-end" : "items-start",
                  "flex flex-col"
                )}
              >
                {!isMe && (
                  <span className="text-xs text-gray-500 mb-1 ml-1">
                    {msg.userName}
                  </span>
                )}
                <div
                  className={cn(
                    "px-3 py-2 rounded-xl text-sm",
                    isMe
                      ? "bg-indigo-600 text-white rounded-tr-sm"
                      : "bg-gray-800 text-gray-200 rounded-tl-sm"
                  )}
                >
                  {msg.content}
                </div>
                <span className="text-xs text-gray-600 mt-1 mx-1">
                  {formatRelative(msg.sentAt)}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="p-3 border-t border-gray-800 flex gap-2"
      >
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Message..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!content.trim() || isSending}
          className="w-9 h-9 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl flex items-center justify-center transition-colors shrink-0"
        >
          {isSending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
          ) : (
            <Send className="w-3.5 h-3.5 text-white" />
          )}
        </button>
      </form>
    </div>
  );
}

 import React from "react";
import { MoreVertical } from "lucide-react";

interface Message {
  username: string;
  text: string;
}

interface MessageBubbleProps {
  message: Message;
  isSelf: boolean;
  isOwner: boolean;
  onContextMenu: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

const MessageBubble = React.memo(function MessageBubble({
  message,
  isSelf,
  isOwner,
  onContextMenu,
}: MessageBubbleProps) {
  const canModerate = isOwner && !isSelf;

  return (
    <div className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-xs rounded-lg px-6 py-2 ${
          isSelf ? "bg-blue-500 text-white" : "bg-white text-black"
        }`}
      >
        {canModerate && (
          <button
            onClick={onContextMenu}
            onContextMenu={onContextMenu}
            className="absolute top-2 right-1"
          >
            <MoreVertical size={14} />
          </button>
        )}

        {!isSelf && (
          <p className="text-xs font-semibold opacity-70">
            {message.username}
          </p>
        )}

        <p>{message.text}</p>
      </div>
    </div>
  );
});

export default MessageBubble; 
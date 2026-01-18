import { useReducer, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import ChatTop from "../components/chat/ChatTop";
import ChatBottom from "../components/chat/ChatBottom";
import MessageBubble from "../components/chat/MessageBubble";
import SystemMessage from "../components/chat/SystemMessage";
import { chatReducer } from "../state/chatReducer";
import type { ChatMessage } from "../state/chatReducer";
import { useChatSocket } from "../hooks/useChatSocket";
import ContextMenu from "../components/ui/ContextMenu";

interface LocationState {
  username: string;
}

interface ContextMenuState {
  x: number;
  y: number;
  messageId: string;
  username: string;
}

function ChatView() {
  const [messages, dispatch] = useReducer(chatReducer, []);
  const [owner, setOwner] = useState<string | null>(null);
  const [userCount, setUserCount] = useState<number>(0);
  const [mutedUsers, setMutedUsers] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const { roomId } = useParams<{ roomId: string }>();
  const { state } = useLocation() as { state: LocationState | null };
  const navigate = useNavigate();
  const username = state?.username;

  if (!username || !roomId) {
    navigate("/");
    return null;
  }

  const { socketRef, isConnected } = useChatSocket({
    roomId,
    username,
    onMessage: (data: any) => {
      // Handle Errors
      if (data.type === "ERROR") {
        alert(data.message);
        if (data.message.includes("Username already taken")) {
          navigate("/");
        }
        return;
      }
      if (typeof data.userCount === "number") setUserCount(data.userCount);
      if (data.owner) setOwner(data.owner);
      if (data.mutedUsers) setMutedUsers(new Set(data.mutedUsers));
      if (data.type === "MUTE_STATE") {
        setMutedUsers(new Set(data.mutedUsers));
        return; // Don't add to messages
      }
      if (data.type === "DELETE_MESSAGE") {
        dispatch({ type: "DELETE_MESSAGE", payload: data.messageId });
        return;
      }
      dispatch({ type: "ADD_MESSAGE", payload: data });
    },
  });

  const handleContextMenu = (e: React.MouseEvent<HTMLButtonElement>, message: ChatMessage): void => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      messageId: message.id,
      username: message.username
    });
  };

  const handleCloseMenu = (): void => {
    setContextMenu(null);
  };

  const handleDeleteMessage = (): void => {
    if (contextMenu?.messageId) {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: "DELETE_MESSAGE",
          messageId: contextMenu.messageId
        }));
      }
      handleCloseMenu();
    }
  };

  const handleToggleMute = (): void => {
    if (!contextMenu?.username) return;

    const isMuted = mutedUsers.has(contextMenu.username);
    const type = isMuted ? "UNMUTE_USER" : "MUTE_USER";

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type,
        targetUsername: contextMenu.username
      }));
    }
    handleCloseMenu();
  };

  return (
    <div className="relative h-dvh w-full">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-[#cfa913] bg-[linear-gradient(15deg,rgba(207,169,19,0.99)_6%,rgba(0,181,157,0.95)_100%)]"
      />
      {/* 40% Dark Overlay */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full">
        <ChatTop roomId={roomId} userCount={userCount} />

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.map((m, i) =>
            m.type === "SYSTEM" ? (
              <SystemMessage key={i} text={m.text} />
            ) : (
              <MessageBubble
                key={m.id}
                message={m}
                isSelf={m.username === username}
                isOwner={username === owner}
                onContextMenu={(e) => handleContextMenu(e, m)}
              />
            )
          )}
        </div>

        <ChatBottom
          socketRef={socketRef}
          roomId={roomId}
          username={username}
          isConnected={isConnected}
        />
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={handleCloseMenu}
          onDelete={handleDeleteMessage}
          onMute={handleToggleMute}
          isMuted={contextMenu.username ? mutedUsers.has(contextMenu.username) : false}
          canMute={username === owner && contextMenu.username !== username}
        />
      )}
    </div>
  );
}

export default ChatView;
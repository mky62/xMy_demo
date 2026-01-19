import { useReducer, useState, useEffect } from "react";
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
  const [userCount, setUserCount] = useState<number>(0);
  const [mutedUsers, setMutedUsers] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [role, setRole] = useState<'owner' | 'participant' | null>(null);
  const [joinConfirmed, setJoinConfirmed] = useState<boolean>(false);

  const { roomId } = useParams<{ roomId: string }>();
  const { state } = useLocation() as { state: LocationState | null };
  const navigate = useNavigate();

  // Initialize username from state OR session storage
  const [username] = useState<string | null>(() => {
    if (state?.username) return state.username;
    if (roomId) {
      try {
        const stored = sessionStorage.getItem(`chat_session_${roomId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          return parsed.username;
        }
      } catch (e) {
        console.error("Failed to parse session", e);
      }
    }
    return null;
  });

  // Persist username to session storage
  useEffect(() => {
    if (roomId && username) {
      sessionStorage.setItem(`chat_session_${roomId}`, JSON.stringify({ username }));
    }
  }, [roomId, username]);

  // Redirect if no username found
  useEffect(() => {
    if (!username || !roomId) {
      navigate("/");
    }
  }, [username, roomId, navigate]);

  if (!username || !roomId) {
    return null;
  }

  const { socketRef, isConnected, sessionId, expiryWarning, extendRoom, dismissWarning, roomExpiry } = useChatSocket({
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

      // Handle authoritative join confirmation
      if (data.type === "JOIN_SUCCESS") {
        setRole(data.role);
        setUserCount(data.userCount);
        setJoinConfirmed(true);
        if (data.reconnected) {
          console.log("Successfully reconnected to room");
        }
        return; // Don't add to messages
      }

      // Handle Room Migration (Extension)
      if (data.type === "ROOM_MIGRATION") {
        console.log("Migrating to new room:", data.newRoomId);
        navigate(`/chat/${data.newRoomId}`, { state: { username }, replace: true });
        return;
      }

      // Handle Room Expiry
      if (data.type === "ROOM_EXPIRED") {
        alert(data.text || "Room has expired");
        navigate("/");
        return;
      }

      if (typeof data.userCount === "number") setUserCount(data.userCount);
      if (data.mutedUsers) setMutedUsers(new Set(data.mutedUsers));
      if (data.type === "MUTE_STATE") {
        setMutedUsers(new Set(data.mutedUsers));
        return; // Don't add to messages
      }
      if (data.type === "DELETE_MESSAGE") {
        dispatch({ type: "DELETE_MESSAGE", payload: data.messageId });
        return;
      }
      // Add regular messages to state
      if (data.type !== "ROOM_WARNING") {
        dispatch({ type: "ADD_MESSAGE", payload: data });
      }
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
        targetUsername: contextMenu.username,
        sessionId: sessionId // Include sessionId for authority
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
        <ChatTop roomId={roomId} userCount={userCount} expiresAt={roomExpiry} />

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {!joinConfirmed ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-white text-lg">Joining room...</div>
            </div>
          ) : (
            messages.map((m, i) =>
              m.type === "SYSTEM" ? (
                <SystemMessage key={i} text={m.text} />
              ) : (
                <MessageBubble
                  key={m.id}
                  message={m}
                  isSelf={m.username === username}
                  isOwner={role === 'owner'}
                  onContextMenu={(e) => handleContextMenu(e, m)}
                />
              )
            )
          )}
        </div>

        <ChatBottom
          socketRef={socketRef}
          roomId={roomId}
          username={username}
          isConnected={isConnected && joinConfirmed}
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
          canMute={role === 'owner' && contextMenu.username !== username}
        />
      )}

      {/* Expiry Warning Modal */}
      {expiryWarning && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-zinc-900 p-6 rounded-xl border border-red-500/30 max-w-md w-full shadow-2xl mx-4">
            <h3 className="text-xl font-bold text-red-400 mb-2 flex items-center gap-2">
              <span className="animate-pulse">⚠️</span> Room Expiring
            </h3>
            <p className="text-zinc-300 mb-6 font-medium">
              This room will expire in less than a minute.
              <br />
              <span className="text-sm text-zinc-500 mt-2 block">
                {expiryWarning.text}
              </span>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={dismissWarning}
                className="px-4 py-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                Let it die
              </button>
              <button
                onClick={extendRoom}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold shadow-lg transition-transform active:scale-95"
              >
                Extend (Migrate)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatView;
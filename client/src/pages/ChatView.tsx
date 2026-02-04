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
  const [users, setUsers] = useState<string[]>([]);

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
        if (data.users) setUsers(data.users);

        // Handle History - Fixed: use dispatch instead of setMessages
        if (data.history && Array.isArray(data.history)) {
          dispatch({ type: "SET_HISTORY", payload: data.history });
        }

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
      if (data.users) setUsers(data.users);
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
    <div className="relative h-dvh w-full overflow-hidden">
      {/* Full-screen Background with Gradient */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-[#cfa913] bg-[linear-gradient(192deg,_rgba(12,130,247,1)_0%,_rgba(87,199,133,1)_50%,_rgba(237,221,83,1)_100%)]"
      />

      {/* Pulsars - positioned on full screen */}
      <div className="pulsar pulsar-top-right" />
      <div className="pulsar pulsar-bottom-left" />

      {/* Grid Layout: Left Sidebar - Chat - Right Empty */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1fr_42rem_1fr] h-full">

        {/* User List Sidebar (Left Column) */}
        <div className="hidden lg:flex flex-col p-4 pt-16 pb-16 pl-6 h-full min-w-0">
          <div className="w-full h-full bg-black/20  border border-white/40 rounded-xl p-4 overflow-y-auto">
            <h3 className="text-[16px] uppercase tracking-wider text-cyan-400 mb-4 font-mono sticky top-0">
              ROOM MEMBERS
            </h3>
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u} className="flex items-center gap-2 group">
                  <div className={`shrink-0 w-1.5 h-1.5 rounded-full ${u === username ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'bg-emerald-400/50'}`} />
                  <span className={`text-sm font-mono truncate ${u === username ? 'text-cyan-100' : 'text-emerald-100/70'}`}>
                    {u} {u === username && <span className="text-[10px] text-white/30 ml-1">(YOU)</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chat Container (Center Column) */}
        <div className="w-full h-full flex flex-col border bg-gray-600/20 border-gray-500 min-w-0">
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

        {/* Right Column (Empty to balance grid) */}
        <div className="hidden lg:block" />

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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Darker Overlay */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" />

            {/* Positioning Wrapper */}
            <div className="relative w-full max-w-sm">

              {/* 1. THE PULSING AURA (New) */}
              {/* This creates the heartbeat effect behind the modal */}
              <div className="absolute -inset-1 bg-red-600/30 rounded-2xl blur-md animate-pulse" />
              <div className="absolute -inset-4 bg-red-600/10 rounded-[2rem] blur-xl animate-pulse delay-75" />

              {/* Main Modal Card */}
              <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl shadow-red-900/50 animate-in fade-in zoom-in-95 duration-300 border border-red-500/20">

                {/* Glass Background */}
                <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-md" />

                {/* Inner Gradient Border Glow */}
                <div
                  className="absolute inset-0 p-[1px] bg-gradient-to-br from-red-500 via-red-900/40 to-transparent rounded-2xl pointer-events-none"
                  style={{ mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', maskComposite: 'exclude' }}
                />

                <div className="relative p-6 space-y-4">
                  <div className="flex items-center gap-3 text-red-500">
                    {/* 2. Urgent Icon Animation */}
                    <div className="p-2 bg-red-500/10 rounded-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
                    </div>
                    <h3 className="text-xl font-bold tracking-tight text-red-100">Room Expiring</h3>
                  </div>

                  <div className="space-y-1">
                    <p className="text-red-50 font-medium">This room will expire in less than a minute.</p>
                    <p className="text-sm text-red-200/60">{expiryWarning.text}</p>
                  </div>

                  <div className="flex flex-col gap-3 pt-2">
                    <button
                      onClick={extendRoom}
                      className="w-full py-3 px-4 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-900/20 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 border border-red-500/20"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></svg>
                      Extend Room (Migrate)
                    </button>

                    <button
                      onClick={() => {
                        dismissWarning();
                        sessionStorage.removeItem(`chat_session_${roomId}`);
                        navigate("/");
                      }}
                      className="w-full py-2.5 text-sm font-medium text-zinc-500 hover:text-red-300 transition-colors"
                    >
                      Let it die
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatView;
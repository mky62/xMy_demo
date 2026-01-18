import { useState, useRef, useEffect, type RefObject } from "react";
import sendIcon from "../../assets/send.svg";

interface ChatBottomProps {
  socketRef: RefObject<WebSocket | null>;
  roomId: string;
  username: string;
  isConnected: boolean;
}

function ChatBottom({ socketRef, roomId, username, isConnected }: ChatBottomProps) {
  const [message, setMessage] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when component mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSend(): void {
    const trimmed = message.trim();

    // ⛔ Prevent empty messages
    if (!trimmed) return;

    // ⛔ Prevent sending if socket not ready
    if (
      !socketRef.current ||
      socketRef.current.readyState !== WebSocket.OPEN
    ) {
      console.warn("WebSocket not ready");
      return;
    }

    socketRef.current.send(
      JSON.stringify({
        type: "MESSAGE",
        roomId,
        username,
        text: trimmed,
      })
    );

    // Clear input & refocus
    setMessage("");
    inputRef.current?.focus();
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") {
      e.preventDefault(); // safety (no accidental form behavior)
      handleSend();
    }
  };

  return (
    <div className="shrink-0 flex h-16 items-center gap-2 px-4 py-3 bg-neutral-900/60 border-neutral-700">
      <input
        ref={inputRef}
        type="text"
        value={message}
        placeholder="Type a message…"
        className="grow bg-neutral-800 text-neutral-100 placeholder-neutral-400
                   rounded-full px-4 py-2 text-sm
                   focus:outline-none focus:ring-2 focus:ring-amber-400"
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
      />

      <button
        onClick={handleSend}
        disabled={!message.trim() || !isConnected}
        className="flex items-center justify-center
                   h-10 w-10 rounded-full
                   bg-amber-400 hover:bg-amber-500
                   disabled:bg-neutral-500 disabled:cursor-not-allowed
                   transition"
      >
        <img src={sendIcon} alt="Send" className="w-5 h-5" />
      </button>
    </div>
  );
}

export default ChatBottom;
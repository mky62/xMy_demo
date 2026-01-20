import { useEffect, useRef, useState, type RefObject } from "react";

interface UseChatSocketParams {
  roomId: string;
  username: string;
  onMessage: (data: any) => void;
}

interface UseChatSocketReturn {
  socketRef: RefObject<WebSocket | null>;
  isConnected: boolean;
  sessionId: string | null;
  expiryWarning: { timeLeft: number; text: string } | null;
  extendRoom: () => void;
  dismissWarning: () => void;
  roomExpiry: number | null;
}

export function useChatSocket({
  roomId,
  username,
  onMessage
}: UseChatSocketParams): UseChatSocketReturn {
  const socketRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [expiryWarning, setExpiryWarning] = useState<{ timeLeft: number, text: string } | null>(null);
  const [roomExpiry, setRoomExpiry] = useState<number | null>(null);
  const expiryHandledRef = useRef(false);

  // Keep latest onMessage in a ref
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!roomId || !username) return;

    const socket = new WebSocket(import.meta.env.VITE_WS_URL || "ws://localhost:4000");
    socketRef.current = socket;

    socket.onopen = () => {
      console.log("WebSocket Connected");
      setIsConnected(true);
      // Wait for SESSION_ESTABLISHED before joining
    };

    socket.onclose = (event: CloseEvent) => {
      console.log("WebSocket Disconnected", event.code, event.reason);
      setIsConnected(false);
      setSessionId(null);

      if (event.reason === "Room expired") {
        if (onMessageRef.current && !expiryHandledRef.current) {
          expiryHandledRef.current = true;
          onMessageRef.current({ type: 'ROOM_EXPIRED', text: 'Room has expired' });
        }
      }
    };

    socket.onerror = (error: Event) => {
      console.error("WebSocket Error:", error);
      setIsConnected(false);
    };

    socket.onmessage = (e: MessageEvent) => {
      const data = JSON.parse(e.data);

      // Handle session establishment
      if (data.type === 'SESSION_ESTABLISHED') {
        setSessionId(data.sessionId);
        // Now join room with sessionId
        socket.send(JSON.stringify({
          type: "JOIN_ROOM",
          roomId,
          username,
          sessionId: data.sessionId
        }));
        return;
      }

      // Handle join confirmation
      if (data.type === 'JOIN_SUCCESS') {
        // Join confirmed by server
        if (data.expiresAt) {
          setRoomExpiry(data.expiresAt);
        }
      }

      // Handle Room Warning
      if (data.type === 'ROOM_WARNING') {
        setExpiryWarning({ timeLeft: data.timeLeft, text: data.text });
      }

      // Handle Room Expiry Message directly
      if (data.type === 'ROOM_EXPIRED') {
        expiryHandledRef.current = true;
      }

      if (onMessageRef.current) {
        onMessageRef.current(data);
      }
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [roomId, username]);

  const extendRoom = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'EXTEND_ROOM' }));
      setExpiryWarning(null); // Clear warning
    }
  };

  const dismissWarning = () => {
    setExpiryWarning(null);
  };

  return { socketRef, isConnected, sessionId, expiryWarning, extendRoom, dismissWarning, roomExpiry };
}
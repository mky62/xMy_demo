import { useEffect, useRef, useState, type RefObject } from "react";

interface UseChatSocketParams {
  roomId: string;
  username: string;
  onMessage: (data: any) => void;
}

interface UseChatSocketReturn {
  socketRef: RefObject<WebSocket | null>;
  isConnected: boolean;
}

export function useChatSocket({
  roomId,
  username,
  onMessage
}: UseChatSocketParams): UseChatSocketReturn {
  const socketRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // Keep latest onMessage in a ref
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!roomId || !username) return;

    const socket = new WebSocket("ws://127.0.0.1:4000");
    socketRef.current = socket;

    socket.onopen = () => {
      console.log("WebSocket Connected");
      setIsConnected(true);
      socket.send(JSON.stringify({ type: "JOIN_ROOM", roomId, username }));
    };

    socket.onclose = (event: CloseEvent) => {
      console.log("WebSocket Disconnected", event.code, event.reason);
      setIsConnected(false);
    };

    socket.onerror = (error: Event) => {
      console.error("WebSocket Error:", error);
      setIsConnected(false);
    };

    socket.onmessage = (e: MessageEvent) => {
      if (onMessageRef.current) {
        onMessageRef.current(JSON.parse(e.data));
      }
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [roomId, username]);

  return { socketRef, isConnected };
}
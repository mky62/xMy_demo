import React, { useCallback, useMemo } from "react";

interface UseChatSenderParams {
    socketRef: React.RefObject<WebSocket | null>;
    roomId: string;
    username: string;
    isConnected: boolean;
}

export function useChatSender({
    socketRef,
    roomId,
    username,
    isConnected,
}: UseChatSenderParams) {
    const canSend = useMemo(() => {
        const socket = socketRef.current;
        return (
            isConnected &&
            socket !== null &&
            socket.readyState === WebSocket.OPEN
        );
    }, [isConnected, socketRef]);

    const sendMessage = useCallback(
        (rawText: string): boolean => {
            const text = rawText.trim();
            if (!text) return false;

            const socket = socketRef.current;
            if (!socket || socket.readyState !== WebSocket.OPEN) {
                console.warn("websocket not ready");
                return false;
            }

            socket.send(
                JSON.stringify({
                    type: "MESSAGE",
                    roomId,
                    username,
                    text,
                    timestamp: Date.now(), // in milliseconds
                })
            );
            return true;
        },
        [roomId, username, socketRef]
    );

    return {
        canSend,
        sendMessage,
    };
}

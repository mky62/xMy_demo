export interface ChatMessage {
  id: string;
  type: "CHAT" | "SYSTEM" | "JOIN" | "LEAVE";
  username: string;
  text: string;
  timestamp: number;
}

type ChatAction =
  | { type: "ADD_MESSAGE"; payload: ChatMessage }
  | { type: "SET_HISTORY"; payload: ChatMessage[] }
  | { type: "DELETE_MESSAGE"; payload: string };

export function chatReducer(state: ChatMessage[], action: ChatAction): ChatMessage[] {
  switch (action.type) {
    case "ADD_MESSAGE":
      return [...state, action.payload];

    case "SET_HISTORY":
      console.log("Reducer SET_HISTORY: current state length:", state.length, "payload length:", action.payload.length);
      // Create a Set of existing message IDs for O(1) lookup
      const existingIds = new Set(state.map(msg => msg.id));

      // Filter out history messages that are already in state
      const uniqueHistory = action.payload.filter(msg => !existingIds.has(msg.id));

      console.log(`SET_HISTORY: merging ${uniqueHistory.length} unique messages (filtered from ${action.payload.length})`);

      // Prepend unique history to state
      return [...uniqueHistory, ...state];

    case "DELETE_MESSAGE":
      return state.filter((msg) => msg.id !== action.payload);

    default:
      return state;
  }
}
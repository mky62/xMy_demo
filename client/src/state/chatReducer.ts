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
      // Only set history if state is empty (avoid overwriting)
      if (state.length > 0) return state;
      return action.payload;

    case "DELETE_MESSAGE":
      return state.filter((msg) => msg.id !== action.payload);

    default:
      return state;
  }
}
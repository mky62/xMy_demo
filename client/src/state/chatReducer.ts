export interface ChatMessage {
  id: string;
  type: "MESSAGE" | "SYSTEM";
  username: string;
  text: string;
  timestamp?: number;
}

export type ChatAction =
  | { type: "ADD_MESSAGE"; payload: ChatMessage }
  | { type: "DELETE_MESSAGE"; payload: string };

export function chatReducer(state: ChatMessage[], action: ChatAction): ChatMessage[] {
  switch (action.type) {
    case "ADD_MESSAGE":
      return [...state, action.payload];
    case "DELETE_MESSAGE":
      return state.filter(msg => msg.id !== action.payload);
    default:
      return state;
  }
}
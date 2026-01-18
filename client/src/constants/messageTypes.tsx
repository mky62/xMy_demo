export const MESSAGE = "MESSAGE" as const;
export const SYSTEM = "SYSTEM" as const;

export type MessageType = typeof MESSAGE | typeof SYSTEM;
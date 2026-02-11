import redis from './redisClient.js';
import { BroadcastPayload } from '../types/room.js';

const MESSAGE_LIMIT = 50; // Maximum messages to store per room

export class MessageService {
    /**
     * Get Redis key for room messages
     */
    private getRoomKey(roomId: string): string {
        return `room:${roomId}:messages`;
    }

    /**
     * Save a message to Redis
     * @param roomId - The room ID
     * @param message - The message payload
     * @param ttlSeconds - Time to live in seconds (default: 15 minutes)
     */
    async saveMessage(
        roomId: string,
        message: BroadcastPayload,
        ttlSeconds: number = 900
    ): Promise<void> {
        try {
            const key = this.getRoomKey(roomId);
            const messageStr = JSON.stringify(message);

            // Add message to the beginning of the list
            await redis.lpush(key, messageStr);

            // Trim list to keep only the most recent messages
            await redis.ltrim(key, 0, MESSAGE_LIMIT - 1);

            // Set expiration time to match room TTL
            await redis.expire(key, ttlSeconds);
        } catch (error) {
            console.error('Error saving message to Redis:', error);
        }
    }

    /**
     * Get messages for a room
     * @param roomId - The room ID
     * @param limit - Maximum number of messages to retrieve
     * @returns Array of messages (newest first)
     */
    async getMessages(
        roomId: string,
        limit: number = MESSAGE_LIMIT
    ): Promise<BroadcastPayload[]> {
        try {
            const key = this.getRoomKey(roomId);

            // Get messages from Redis (0 to limit-1, newest first)
            const messages = await redis.lrange(key, 0, limit - 1);

            if (!messages || messages.length === 0) {
                return [];
            }

            // Parse and reverse to get chronological order (oldest first)
            return messages
                .map((msg) => {
                    try {
                        return typeof msg === 'string' ? JSON.parse(msg) : msg;
                    } catch (e) {
                        console.error('Error parsing message:', e);
                        return null;
                    }
                })
                .filter((msg): msg is BroadcastPayload => msg !== null)
                .reverse();
        } catch (error) {
            console.error('Error getting messages from Redis:', error);
            return [];
        }
    }

    /**
     * Delete all messages for a room
     * @param roomId - The room ID
     */
    async deleteRoomMessages(roomId: string): Promise<void> {
        try {
            const key = this.getRoomKey(roomId);
            await redis.del(key);
        } catch (error) {
            console.error('Error deleting room messages from Redis:', error);
        }
    }

    /**
     * Check if Redis is connected
     */
    async healthCheck(): Promise<boolean> {
        try {
            const result = await redis.ping();
            return result === 'PONG';
        } catch (error) {
            console.error('Redis health check failed:', error);
            return false;
        }
    }
}

export const messageService = new MessageService();

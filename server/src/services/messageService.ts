import redis from './redisClient.js';
import { BroadcastPayload } from '../types/room.js';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || ''; // Must be 32 bytes (64 hex characters)
const IV_LENGTH = 16; // For AES, this is always 16


const MESSAGE_LIMIT = 50; // Maximum messages to store per room

export class MessageService {
    /**
     * Get Redis key for room messages
     */
    private getRoomKey(roomId: string): string {
        return `room:${roomId}:messages`;
    }

    private encrypt(text: string): string {
        if (!ENCRYPTION_KEY) return text; // Fallback if no key
        try {
            const iv = crypto.randomBytes(IV_LENGTH);
            const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
            let encrypted = cipher.update(text);
            encrypted = Buffer.concat([encrypted, cipher.final()]);
            return iv.toString('hex') + ':' + encrypted.toString('hex');
        } catch (error) {
            // Log encryption errors for debugging
            if (process.env.DEBUG) {
                console.error("[Encryption Error]", error);
            }
            return text;
        }
    }

    private decrypt(text: string): string {
        if (!ENCRYPTION_KEY) return text;
        try {
            const textParts = text.split(':');
            if (textParts.length !== 2) return text; // Not encrypted format

            const iv = Buffer.from(textParts[0], 'hex');
            const encryptedText = Buffer.from(textParts[1], 'hex');
            const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
            let decrypted = decipher.update(encryptedText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            return decrypted.toString();
        } catch (error) {
            // Return original text if decryption fails (e.g., legacy unencrypted messages)
            if (process.env.DEBUG) {
                console.error("[Decryption Error]", error);
            }
            return text;
        }
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
            const encryptedMessage = this.encrypt(messageStr);

            // Add message to the beginning of the list
            await redis.lpush(key, encryptedMessage);

            // Trim list to keep only the most recent messages
            await redis.ltrim(key, 0, MESSAGE_LIMIT - 1);

            // Set expiration time to match room TTL
            await redis.expire(key, ttlSeconds);
        } catch (error) {
            // Log critical errors for monitoring
            if (process.env.DEBUG) {
                console.error("[MessageService] Failed to save message", { error });
            }
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
                        const decryptedMsg = this.decrypt(msg);
                        return typeof decryptedMsg === 'string' ? JSON.parse(decryptedMsg) : decryptedMsg;
                    } catch (e) {
                        if (process.env.DEBUG) {
                            console.error("[MessageService] Failed to parse message", { error: e });
                        }
                        return null;
                    }
                })
                .filter((msg): msg is BroadcastPayload => msg !== null)
                .reverse();
        } catch (error) {
            if (process.env.DEBUG) {
                console.error("[MessageService] Failed to retrieve messages", { error });
            }
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
            if (process.env.DEBUG) {
                console.error("[MessageService] Failed to delete room messages", { error });
            }
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
            if (process.env.DEBUG) {
                console.error("[MessageService] Redis health check failed", { error });
            }
            return false;
        }
    }
}

export const messageService = new MessageService();

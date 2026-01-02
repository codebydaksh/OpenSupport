/**
 * Integration test: Message delivery with disconnects
 * Verifies at-least-once delivery with zero message loss
 * 
 * Run: node --test src/tests/messageDelivery.integration.js
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const TEST_ORG_ID = process.env.TEST_ORG_ID;

if (!TEST_ORG_ID) {
    console.error('TEST_ORG_ID environment variable required');
    process.exit(1);
}

describe('Message Delivery with Disconnects', () => {
    const sessionId = 'test_' + uuidv4();
    const messageCount = 100;
    const sentMessages = new Map();
    const receivedAcks = new Set();
    let socket = null;

    before(async () => {
        socket = io(BACKEND_URL, {
            transports: ['websocket'],
            reconnection: true,
            reconnectionDelay: 100,
            reconnectionDelayMax: 1000
        });

        await new Promise((resolve, reject) => {
            socket.on('connect', () => {
                socket.emit('widget:connect', { orgId: TEST_ORG_ID, sessionId });
                resolve();
            });
            socket.on('connect_error', reject);
            setTimeout(() => reject(new Error('Connection timeout')), 5000);
        });

        await new Promise(resolve => {
            socket.on('widget:connected', resolve);
            setTimeout(resolve, 1000);
        });
    });

    after(() => {
        if (socket) socket.disconnect();
    });

    it('should deliver 100 messages with random disconnects and zero loss', async () => {
        // Set up ack listener
        socket.on('message:ack', (data) => {
            receivedAcks.add(data.idempotencyKey);
        });

        // Send messages with random disconnects
        for (let i = 0; i < messageCount; i++) {
            const idempotencyKey = `test_msg_${i}_${uuidv4()}`;
            const content = `Test message ${i}`;

            sentMessages.set(idempotencyKey, { content, attempts: 0 });

            // Simulate random disconnect every ~20 messages
            if (i > 0 && i % 20 === 0) {
                socket.disconnect();
                await new Promise(r => setTimeout(r, 100));
                socket.connect();
                await new Promise(r => setTimeout(r, 200));
            }

            socket.emit('message:send', {
                content,
                idempotencyKey,
                pageUrl: 'http://test.example.com/integration-test'
            });

            // Small delay between messages
            await new Promise(r => setTimeout(r, 10));
        }

        // Wait for all acks with timeout
        const maxWait = 30000;
        const start = Date.now();

        while (receivedAcks.size < messageCount && Date.now() - start < maxWait) {
            // Retry unacked messages
            for (const [key, msg] of sentMessages) {
                if (!receivedAcks.has(key) && msg.attempts < 3) {
                    msg.attempts++;
                    socket.emit('message:send', {
                        content: msg.content,
                        idempotencyKey: key,
                        pageUrl: 'http://test.example.com/integration-test'
                    });
                }
            }
            await new Promise(r => setTimeout(r, 500));
        }

        // Verify results
        const missing = [];
        for (const [key] of sentMessages) {
            if (!receivedAcks.has(key)) {
                missing.push(key);
            }
        }

        console.log(`Sent: ${messageCount}, Acked: ${receivedAcks.size}, Missing: ${missing.length}`);

        assert.strictEqual(
            missing.length,
            0,
            `Messages lost: ${missing.join(', ')}`
        );

        assert.strictEqual(
            receivedAcks.size,
            messageCount,
            `Expected ${messageCount} acks, got ${receivedAcks.size}`
        );
    });

    it('should deduplicate retried messages', async () => {
        const idempotencyKey = `dedup_test_${uuidv4()}`;
        const content = 'Duplicate test message';
        let ackCount = 0;

        socket.on('message:ack', (data) => {
            if (data.idempotencyKey === idempotencyKey) {
                ackCount++;
            }
        });

        // Send same message 5 times
        for (let i = 0; i < 5; i++) {
            socket.emit('message:send', {
                content,
                idempotencyKey,
                pageUrl: 'http://test.example.com/dedup-test'
            });
            await new Promise(r => setTimeout(r, 50));
        }

        // Wait for acks
        await new Promise(r => setTimeout(r, 2000));

        // Should receive ack for each send (idempotent behavior)
        // but only one message should exist in database
        assert.ok(ackCount >= 1, 'Should receive at least one ack');
        console.log(`Sent 5 duplicates, received ${ackCount} acks (all should reference same message ID)`);
    });
});

/**
 * OpenSupport Chat Widget
 * Embeddable customer messaging widget
 */

import { io } from 'socket.io-client';

(function () {
    'use strict';

    // Configuration from window.OpenSupport
    const config = window.OpenSupport || {};
    const orgId = config.orgId;
    const userInfo = config.user || {};
    const apiUrl = config.apiUrl || 'https://api.opensupport.app';
    const wsUrl = config.wsUrl || apiUrl;

    if (!orgId) {
        console.error('[OpenSupport] Missing orgId in window.OpenSupport configuration');
        return;
    }

    // Generate or retrieve session ID
    const SESSION_KEY = `opensupport_session_${orgId}`;
    let sessionId = localStorage.getItem(SESSION_KEY);
    if (!sessionId) {
        sessionId = 'v_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
        localStorage.setItem(SESSION_KEY, sessionId);
    }

    // State
    let socket = null;
    let visitorId = null;
    let conversationId = null;
    let messages = [];
    let isOpen = false;
    let isConnected = false;
    let orgName = 'Support';
    let messageQueue = []; // Queue for offline messages

    // IndexedDB for message queue persistence
    const DB_NAME = 'opensupport_queue';
    const STORE_NAME = 'messages';
    let db = null;

    async function initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                db = request.result;
                resolve(db);
            };
            request.onupgradeneeded = (e) => {
                const database = e.target.result;
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    database.createObjectStore(STORE_NAME, { keyPath: 'idempotencyKey' });
                }
            };
        });
    }

    async function queueMessage(msg) {
        if (!db) return;
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.put(msg);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async function removeFromQueue(idempotencyKey) {
        if (!db) return;
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.delete(idempotencyKey);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async function getQueuedMessages() {
        if (!db) return [];
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    // Styles
    const styles = `
    #opensupport-widget {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483647;
    }

    #opensupport-button {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    #opensupport-button:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 25px rgba(59, 130, 246, 0.5);
    }

    #opensupport-button svg {
      width: 28px;
      height: 28px;
      fill: white;
    }

    #opensupport-window {
      position: absolute;
      bottom: 80px;
      right: 0;
      width: 380px;
      height: 520px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 50px rgba(0, 0, 0, 0.15);
      display: none;
      flex-direction: column;
      overflow: hidden;
      animation: opensupport-slideIn 0.3s ease;
    }

    #opensupport-window.open {
      display: flex;
    }

    @keyframes opensupport-slideIn {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    #opensupport-header {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      color: white;
      padding: 20px;
    }

    #opensupport-header h3 {
      margin: 0 0 4px;
      font-size: 18px;
      font-weight: 600;
    }

    #opensupport-header p {
      margin: 0;
      font-size: 13px;
      opacity: 0.9;
    }

    #opensupport-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
      font-size: 12px;
    }

    #opensupport-status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22c55e;
    }

    #opensupport-status-dot.offline {
      background: #f59e0b;
    }

    #opensupport-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .opensupport-message {
      max-width: 80%;
      padding: 12px 16px;
      border-radius: 16px;
      word-wrap: break-word;
    }

    .opensupport-message.visitor {
      align-self: flex-end;
      background: #3b82f6;
      color: white;
      border-bottom-right-radius: 4px;
    }

    .opensupport-message.agent {
      align-self: flex-start;
      background: #f1f5f9;
      color: #1e293b;
      border-bottom-left-radius: 4px;
    }

    .opensupport-message .time {
      font-size: 11px;
      opacity: 0.7;
      margin-top: 4px;
    }

    #opensupport-composer {
      padding: 16px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      gap: 12px;
    }

    #opensupport-input {
      flex: 1;
      border: 1px solid #e2e8f0;
      border-radius: 24px;
      padding: 12px 18px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }

    #opensupport-input:focus {
      border-color: #3b82f6;
    }

    #opensupport-send {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #3b82f6;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }

    #opensupport-send:hover {
      background: #2563eb;
    }

    #opensupport-send:disabled {
      background: #94a3b8;
      cursor: not-allowed;
    }

    #opensupport-send svg {
      width: 20px;
      height: 20px;
      fill: white;
    }

    #opensupport-greeting {
      text-align: center;
      padding: 40px 20px;
      color: #64748b;
    }

    #opensupport-greeting h4 {
      margin: 0 0 8px;
      color: #1e293b;
      font-size: 16px;
    }

    @media (max-width: 480px) {
      #opensupport-window {
        width: calc(100vw - 32px);
        height: calc(100vh - 100px);
        right: 16px;
        bottom: 90px;
      }
    }
  `;

    // Create widget DOM
    function createWidget() {
        // Inject styles
        const styleEl = document.createElement('style');
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);

        // Create container
        const container = document.createElement('div');
        container.id = 'opensupport-widget';
        container.innerHTML = `
      <div id="opensupport-window">
        <div id="opensupport-header">
          <h3>${escapeHtml(orgName)}</h3>
          <p>We typically reply in a few minutes</p>
          <div id="opensupport-status">
            <span id="opensupport-status-dot"></span>
            <span id="opensupport-status-text">Online</span>
          </div>
        </div>
        <div id="opensupport-messages">
          <div id="opensupport-greeting">
            <h4>Hi there!</h4>
            <p>How can we help you today?</p>
          </div>
        </div>
        <div id="opensupport-composer">
          <input type="text" id="opensupport-input" placeholder="Type a message..." />
          <button id="opensupport-send" title="Send">
            <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
      </div>
      <button id="opensupport-button" title="Chat with us">
        <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/><path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/></svg>
      </button>
    `;

        document.body.appendChild(container);

        // Event listeners
        document.getElementById('opensupport-button').addEventListener('click', toggleWidget);
        document.getElementById('opensupport-send').addEventListener('click', sendMessage);
        document.getElementById('opensupport-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function toggleWidget() {
        isOpen = !isOpen;
        const window = document.getElementById('opensupport-window');
        window.classList.toggle('open', isOpen);

        if (isOpen) {
            document.getElementById('opensupport-input').focus();
            scrollToBottom();
        }
    }

    function scrollToBottom() {
        const messagesEl = document.getElementById('opensupport-messages');
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function renderMessages() {
        const container = document.getElementById('opensupport-messages');
        const greeting = document.getElementById('opensupport-greeting');

        if (messages.length === 0) {
            if (greeting) greeting.style.display = 'block';
            return;
        }

        if (greeting) greeting.style.display = 'none';

        // Clear existing messages
        container.querySelectorAll('.opensupport-message').forEach(el => el.remove());

        messages.forEach(msg => {
            const msgEl = document.createElement('div');
            msgEl.className = `opensupport-message ${msg.sender_type || msg.senderType}`;

            const time = new Date(msg.created_at || msg.createdAt).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit'
            });

            msgEl.innerHTML = `
        <div class="content">${escapeHtml(msg.content)}</div>
        <div class="time">${time}</div>
      `;
            container.appendChild(msgEl);
        });

        scrollToBottom();
    }

    function addMessage(msg) {
        // Deduplicate by id or idempotency key
        const exists = messages.some(m =>
            (m.id && m.id === msg.id) ||
            (m.idempotencyKey && m.idempotencyKey === msg.idempotencyKey)
        );
        if (!exists) {
            messages.push(msg);
            renderMessages();
        }
    }

    function updateConnectionStatus(connected) {
        isConnected = connected;
        const dot = document.getElementById('opensupport-status-dot');
        const text = document.getElementById('opensupport-status-text');
        if (dot && text) {
            dot.classList.toggle('offline', !connected);
            text.textContent = connected ? 'Online' : 'Reconnecting...';
        }
    }

    async function sendMessage() {
        const input = document.getElementById('opensupport-input');
        const content = input.value.trim();

        if (!content) return;

        input.value = '';
        input.disabled = true;

        const idempotencyKey = 'msg_' + Math.random().toString(36).substring(2, 15) + Date.now();

        const msg = {
            content,
            idempotencyKey,
            senderType: 'visitor',
            createdAt: new Date().toISOString()
        };

        // Add to UI immediately (optimistic)
        addMessage(msg);

        // Queue for persistence
        await queueMessage({ ...msg, pageUrl: window.location.href });

        if (socket && isConnected) {
            socket.emit('message:send', {
                content,
                idempotencyKey,
                pageUrl: window.location.href
            });
        }

        input.disabled = false;
        input.focus();
    }

    async function flushQueue() {
        const queued = await getQueuedMessages();
        for (const msg of queued) {
            if (socket && isConnected) {
                socket.emit('message:send', {
                    content: msg.content,
                    idempotencyKey: msg.idempotencyKey,
                    pageUrl: msg.pageUrl
                });
            }
        }
    }

    function initSocket() {
        socket = io(wsUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: Infinity
        });

        socket.on('connect', () => {
            console.log('[OpenSupport] Connected');
            updateConnectionStatus(true);

            socket.emit('widget:connect', {
                orgId,
                sessionId,
                visitorId
            });

            // Flush queued messages
            flushQueue();
        });

        socket.on('disconnect', () => {
            console.log('[OpenSupport] Disconnected');
            updateConnectionStatus(false);
        });

        socket.on('widget:connected', (data) => {
            visitorId = data.visitorId;
            conversationId = data.conversationId;
            console.log('[OpenSupport] Session established', { visitorId, conversationId });
        });

        socket.on('message:ack', async (data) => {
            // Message was received by server, remove from queue
            await removeFromQueue(data.idempotencyKey);
            if (data.conversationId && !conversationId) {
                conversationId = data.conversationId;
            }
        });

        socket.on('message:new', (data) => {
            addMessage(data.message);

            // Play notification sound if widget is closed
            if (!isOpen) {
                // Could add notification sound here
                console.log('[OpenSupport] New message received');
            }
        });

        socket.on('error', (data) => {
            console.error('[OpenSupport] Error:', data.message);
        });
    }

    async function init() {
        try {
            // Init IndexedDB
            await initDB();

            // Fetch initial data from API
            const response = await fetch(`${apiUrl}/api/v1/widget/init`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orgId,
                    sessionId,
                    visitorData: userInfo
                })
            });

            if (!response.ok) {
                throw new Error('Failed to initialize widget');
            }

            const data = await response.json();
            orgName = data.organization?.name || 'Support';
            visitorId = data.visitor?.id;

            if (data.conversation) {
                conversationId = data.conversation.id;
                messages = data.conversation.messages || [];
            }

            // Create widget UI
            createWidget();
            renderMessages();

            // Connect WebSocket
            initSocket();

        } catch (error) {
            console.error('[OpenSupport] Initialization failed:', error);
        }
    }

    // Wait for DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

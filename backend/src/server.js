import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { errorHandler } from './middleware/errorHandler.js';
import { authMiddleware, optionalAuth } from './middleware/auth.js';
import { tenantContext } from './middleware/tenantContext.js';

import conversationsRouter from './routes/conversations.js';
import messagesRouter from './routes/messages.js';
import visitorsRouter from './routes/visitors.js';
import teamsRouter from './routes/teams.js';
import billingRouter from './routes/billing.js';
import widgetRouter from './routes/widget.js';
import authRouter from './routes/auth.js';
import routingRulesRouter from './routes/routingRules.js';

import { setupSocketHandlers } from './socket/connectionManager.js';
import { initRedis, closeRedis } from './lib/redis.js';
import { initSentry, sentryRequestHandler, sentryErrorHandler, captureException } from './lib/sentry.js';

const app = express();
const httpServer = createServer(app);

// Initialize Sentry first
initSentry(app);

// Sentry request handler (must be first middleware)
app.use(sentryRequestHandler());

// Socket.io setup with CORS
const io = new Server(httpServer, {
    cors: {
        origin: [
            process.env.FRONTEND_URL || 'http://localhost:5173',
            process.env.WIDGET_URL || 'http://localhost:5174'
        ],
        methods: ['GET', 'POST'],
        credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 30000
});

// Initialize Redis adapter for Socket.io scaling
async function initSocketAdapter() {
    const redis = await initRedis();
    if (redis && redis.pubClient && redis.subClient) {
        io.adapter(createAdapter(redis.pubClient, redis.subClient));
        console.log('[Socket.io] Redis adapter configured for horizontal scaling');
    }
}
initSocketAdapter().catch(err => {
    console.error('[Socket.io] Redis adapter init failed:', err.message);
    captureException(err);
});

// Store io instance for use in routes
app.set('io', io);

// Security middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors({
    origin: [
        process.env.FRONTEND_URL || 'http://localhost:5173',
        process.env.WIDGET_URL || 'http://localhost:5174'
    ],
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Widget routes (different auth)
app.use('/api/v1/widget', widgetRouter);

// Billing webhooks (Stripe signature verification, no JWT)
app.use('/api/v1/billing/webhook', express.raw({ type: 'application/json' }));

// Auth routes (public)
app.use('/api/v1/auth', authRouter);

// Protected API routes
app.use('/api/v1/conversations', authMiddleware, tenantContext, conversationsRouter);
app.use('/api/v1/messages', authMiddleware, tenantContext, messagesRouter);
app.use('/api/v1/visitors', authMiddleware, tenantContext, visitorsRouter);
app.use('/api/v1/teams', authMiddleware, tenantContext, teamsRouter);
app.use('/api/v1/billing', authMiddleware, tenantContext, billingRouter);
app.use('/api/v1/routing-rules', authMiddleware, tenantContext, routingRulesRouter);

// Sentry error handler (before custom error handler)
app.use(sentryErrorHandler());

// Error handler (must be last)
app.use(errorHandler);

// Socket.io connection handling
setupSocketHandlers(io);

// Start server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`OpenSupport backend running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    await closeRedis();
    httpServer.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

export { app, io };

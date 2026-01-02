/**
 * Structured error response format
 * All errors follow this format for consistency
 */

export class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.isOperational = true;
    }
}

export class ValidationError extends AppError {
    constructor(message, details = null) {
        super(message, 400, 'VALIDATION_ERROR', details);
    }
}

export class AuthenticationError extends AppError {
    constructor(message = 'Authentication required') {
        super(message, 401, 'AUTHENTICATION_ERROR');
    }
}

export class AuthorizationError extends AppError {
    constructor(message = 'Access denied') {
        super(message, 403, 'AUTHORIZATION_ERROR');
    }
}

export class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404, 'NOT_FOUND');
    }
}

export class ConflictError extends AppError {
    constructor(message) {
        super(message, 409, 'CONFLICT');
    }
}

export class LimitExceededError extends AppError {
    constructor(limit, upgradeUrl) {
        super(`Plan limit exceeded: ${limit}. Upgrade to continue.`, 402, 'LIMIT_EXCEEDED', {
            limit,
            upgradeUrl
        });
    }
}

export class RateLimitError extends AppError {
    constructor(retryAfter = 60) {
        super('Rate limit exceeded', 429, 'RATE_LIMIT', { retryAfter });
    }
}

export function errorHandler(err, req, res, next) {
    // Log error for debugging
    console.error('Error:', {
        message: err.message,
        code: err.code,
        statusCode: err.statusCode,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        path: req.path,
        method: req.method
    });

    // Handle known operational errors
    if (err.isOperational) {
        return res.status(err.statusCode).json({
            error: {
                message: err.message,
                code: err.code,
                details: err.details
            }
        });
    }

    // Handle Zod validation errors
    if (err.name === 'ZodError') {
        return res.status(400).json({
            error: {
                message: 'Validation failed',
                code: 'VALIDATION_ERROR',
                details: err.errors
            }
        });
    }

    // Handle Supabase errors
    if (err.code && err.code.startsWith('PGRST')) {
        return res.status(400).json({
            error: {
                message: 'Database operation failed',
                code: 'DATABASE_ERROR'
            }
        });
    }

    // Unknown errors - don't leak details
    return res.status(500).json({
        error: {
            message: 'An unexpected error occurred',
            code: 'INTERNAL_ERROR'
        }
    });
}

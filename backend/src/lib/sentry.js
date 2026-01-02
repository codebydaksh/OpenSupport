import * as Sentry from '@sentry/node';

export function initSentry(app) {
    const dsn = process.env.SENTRY_DSN;

    if (!dsn) {
        console.warn('[Sentry] No SENTRY_DSN configured, error tracking disabled');
        return;
    }

    Sentry.init({
        dsn,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: 0.1,
        integrations: [
            new Sentry.Integrations.Http({ tracing: true }),
            new Sentry.Integrations.Express({ app })
        ]
    });

    console.log('[Sentry] Initialized');
}

export function sentryRequestHandler() {
    if (!process.env.SENTRY_DSN) {
        return (req, res, next) => next();
    }
    return Sentry.Handlers.requestHandler();
}

export function sentryErrorHandler() {
    if (!process.env.SENTRY_DSN) {
        return (err, req, res, next) => next(err);
    }
    return Sentry.Handlers.errorHandler();
}

export function captureException(error, context = {}) {
    if (process.env.SENTRY_DSN) {
        Sentry.captureException(error, { extra: context });
    }
}

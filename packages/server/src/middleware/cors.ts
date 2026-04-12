/**
 * CORS middleware using the `cors` package.
 *
 * In development (NODE_ENV !== 'production'), all origins are allowed.
 * In production, only same-origin requests are permitted unless
 * CORS_ALLOWED_ORIGINS is set (comma-separated list of allowed origins).
 *
 * @module
 */

import cors from 'cors';

function getCorsOrigin(): cors.CorsOptions['origin'] {
    if (process.env.NODE_ENV !== 'production') {
        return true;
    }

    const allowedOriginsEnv = process.env.CORS_ALLOWED_ORIGINS;
    if (allowedOriginsEnv) {
        const allowedOrigins = allowedOriginsEnv
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean);
        return allowedOrigins;
    }

    // Production default: same-origin only
    return false;
}

export const corsMiddleware = cors({
    origin: getCorsOrigin(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
});

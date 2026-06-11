/**
 * Auth Middleware
 * Protects routes by verifying the session token from the Authorization header
 * or the `session_token` cookie.
 */

import type { Context, MiddlewareHandler } from 'hono';
import { authDb, type UserRow } from '../db/database.ts';

export type AuthEnv = {
    Variables: {
        user: UserRow;
    };
};

/**
 * Extracts the raw session token from the request.
 * Checks: Authorization: Bearer <token>  OR  Cookie: session_token=<token>
 */
export function extractToken(c: Context): string | null {
    // 1. Bearer token in Authorization header
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7).trim();
    }

    // 2. Cookie fallback
    const cookieHeader = c.req.header('Cookie') ?? '';
    const match = cookieHeader.match(/(?:^|;\s*)session_token=([^;]+)/);
    if (match) {
        return decodeURIComponent(match[1]!);
    }

    // 3. Query string fallback (primarily for Server-Sent Events / EventSource)
    const queryToken = c.req.query('token');
    if (queryToken) {
        return queryToken;
    }

    return null;
}

/**
 * requireAuth middleware — attaches `user` to context variables.
 * Returns 401 if the session token is missing or invalid/expired.
 */
export const requireAuth: MiddlewareHandler<AuthEnv> = async (c, next) => {
    const token = extractToken(c as unknown as Context);

    if (!token) {
        return c.json({ error: 'Unauthorized — no session token provided' }, 401);
    }

    const user = authDb.getSessionUser(token);

    if (!user) {
        return c.json({ error: 'Unauthorized — invalid or expired session' }, 401);
    }

    c.set('user', user);
    await next();
};

/**
 * optionalAuth middleware — attaches `user` to context if a valid token is
 * provided, but does NOT block unauthenticated requests.
 */
export const optionalAuth: MiddlewareHandler<AuthEnv> = async (c, next) => {
    const token = extractToken(c as unknown as Context);

    if (token) {
        const user = authDb.getSessionUser(token);
        if (user) {
            c.set('user', user);
        }
    }

    await next();
};

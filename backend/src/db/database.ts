import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file path
const DB_PATH = process.env.DB_PATH || './data/plutoploy.db';

// Ensure data directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database
export const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Initialize schema
const schemaPath = path.join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf-8');
db.exec(schema);

// Safe migration: add installation_id to existing users tables
try {
    db.exec(`ALTER TABLE users ADD COLUMN installation_id TEXT`);
    console.log('✅ Migration: added installation_id column to users');
} catch {
    // Column already exists — this is fine
}

console.log(`✅ Database initialized at ${DB_PATH}`);

// Deployment operations
export const deploymentDb = {
    /**
     * Create a new deployment
     */
    create: (deployment: {
        deployId: string;
        subdomain: string;
        port: number;
        imageName: string;
        containerId: string;
        repo?: string;
    }) => {
        const now = new Date().toISOString();
        const stmt = db.prepare(`
            INSERT INTO deployments (deploy_id, subdomain, port, image_name, container_id, repo, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'running', ?, ?)
        `);
        
        return stmt.run(
            deployment.deployId,
            deployment.subdomain,
            deployment.port,
            deployment.imageName,
            deployment.containerId,
            deployment.repo || null,
            now,
            now
        );
    },

    /**
     * Get deployment by ID
     */
    getById: (deployId: string) => {
        const stmt = db.prepare('SELECT * FROM deployments WHERE deploy_id = ?');
        return stmt.get(deployId);
    },

    /**
     * Get deployment by subdomain
     */
    getBySubdomain: (subdomain: string) => {
        const stmt = db.prepare('SELECT * FROM deployments WHERE subdomain = ?');
        return stmt.get(subdomain);
    },

    /**
     * Get all deployments
     */
    getAll: () => {
        const stmt = db.prepare('SELECT * FROM deployments ORDER BY created_at DESC');
        return stmt.all();
    },

    /**
     * Update deployment status
     */
    updateStatus: (deployId: string, status: string) => {
        const stmt = db.prepare(`
            UPDATE deployments 
            SET status = ?, updated_at = ? 
            WHERE deploy_id = ?
        `);
        return stmt.run(status, new Date().toISOString(), deployId);
    },

    /**
     * Delete deployment
     */
    delete: (deployId: string) => {
        const stmt = db.prepare('DELETE FROM deployments WHERE deploy_id = ?');
        return stmt.run(deployId);
    },

    /**
     * Get all used ports
     */
    getUsedPorts: (): number[] => {
        const stmt = db.prepare('SELECT port FROM deployments ORDER BY port');
        const rows = stmt.all() as { port: number }[];
        return rows.map(row => row.port);
    },

    /**
     * Check if subdomain exists
     */
    subdomainExists: (subdomain: string): boolean => {
        const stmt = db.prepare('SELECT 1 FROM deployments WHERE subdomain = ? LIMIT 1');
        return stmt.get(subdomain) !== undefined;
    }
};

// Builds operations
export const buildsDb = {
    /**
     * Create a new build
     */
    create: (build: {
        id: string;
        repo: string;
        branch: string;
        subdomain?: string;
    }) => {
        const now = new Date().toISOString();
        const stmt = db.prepare(`
            INSERT INTO builds (id, repo, branch, subdomain, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'queued', ?, ?)
        `);
        return stmt.run(
            build.id,
            build.repo,
            build.branch,
            build.subdomain || null,
            now,
            now
        );
    },

    /**
     * Get build by ID
     */
    getById: (id: string) => {
        const stmt = db.prepare('SELECT * FROM builds WHERE id = ?');
        return stmt.get(id);
    },

    /**
     * Get latest build by repo
     */
    getLatestByRepo: (repo: string) => {
        const stmt = db.prepare('SELECT * FROM builds WHERE repo = ? ORDER BY created_at DESC LIMIT 1');
        return stmt.get(repo);
    },

    /**
     * Update build status and run_id
     */
    updateState: (id: string, status: string, githubRunId?: string) => {
        const now = new Date().toISOString();
        if (githubRunId) {
            const stmt = db.prepare('UPDATE builds SET status = ?, github_run_id = ?, updated_at = ? WHERE id = ?');
            return stmt.run(status, githubRunId, now, id);
        } else {
            const stmt = db.prepare('UPDATE builds SET status = ?, updated_at = ? WHERE id = ?');
            return stmt.run(status, now, id);
        }
    }
};

// Caddy routes operations
export const routesDb = {
    /**
     * Add or update a route for Caddy
     */
    upsert: (domain: string, host: string, port: number) => {
        const stmt = db.prepare(`
            INSERT INTO routes (domain, host, port)
            VALUES (?, ?, ?)
            ON CONFLICT(domain) DO UPDATE SET
                host = excluded.host,
                port = excluded.port
        `);
        return stmt.run(domain, host, port);
    },

    /**
     * Get route by domain
     */
    getByDomain: (domain: string) => {
        const stmt = db.prepare('SELECT * FROM routes WHERE domain = ?');
        return stmt.get(domain);
    },

    /**
     * Get all routes
     */
    getAll: () => {
        const stmt = db.prepare('SELECT * FROM routes ORDER BY domain');
        return stmt.all();
    },

    /**
     * Delete route
     */
    delete: (domain: string) => {
        const stmt = db.prepare('DELETE FROM routes WHERE domain = ?');
        return stmt.run(domain);
    }
};

// Auth / User operations
export const authDb = {
    /**
     * Upsert a GitHub user (create or update on conflict)
     */
    upsertUser: (user: {
        githubId: string;
        login: string;
        name?: string | null;
        email?: string | null;
        avatarUrl?: string | null;
        accessToken?: string;
        installationId?: string | null;
    }) => {
        const now = new Date().toISOString();
        const stmt = db.prepare(`
            INSERT INTO users (github_id, login, name, email, avatar_url, access_token, installation_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(github_id) DO UPDATE SET
                login           = excluded.login,
                name            = excluded.name,
                email           = excluded.email,
                avatar_url      = excluded.avatar_url,
                access_token    = excluded.access_token,
                installation_id = excluded.installation_id,
                updated_at      = excluded.updated_at
        `);
        stmt.run(
            user.githubId,
            user.login,
            user.name ?? null,
            user.email ?? null,
            user.avatarUrl ?? null,
            user.accessToken ?? null,
            user.installationId ?? null,
            now,
            now
        );
        return authDb.getUserByGithubId(user.githubId);
    },

    /**
     * Get a user's GitHub App installation ID
     */
    getUserInstallationId: (userId: number): string | null => {
        const stmt = db.prepare('SELECT installation_id FROM users WHERE id = ?');
        const row = stmt.get(userId) as { installation_id: string | null } | undefined;
        return row?.installation_id ?? null;
    },

    /**
     * Find user by GitHub ID
     */
    getUserByGithubId: (githubId: string) => {
        const stmt = db.prepare('SELECT * FROM users WHERE github_id = ?');
        return stmt.get(githubId) as UserRow | undefined;
    },

    /**
     * Find user by internal ID
     */
    getUserById: (id: number) => {
        const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
        return stmt.get(id) as UserRow | undefined;
    },

    /**
     * Create a new session token for a user
     */
    createSession: (userId: number, token: string, expiresAt: string) => {
        const now = new Date().toISOString();
        const stmt = db.prepare(`
            INSERT INTO sessions (user_id, token, expires_at, created_at)
            VALUES (?, ?, ?, ?)
        `);
        return stmt.run(userId, token, expiresAt, now);
    },

    /**
     * Validate a session token — returns the user row if the session is valid
     */
    getSessionUser: (token: string) => {
        const now = new Date().toISOString();

        // ── DEBUG ──────────────────────────────────────────────────────────────
        console.log('\n[DB] ── getSessionUser ───────────────────────────────');
        console.log('[DB] Looking up token:', token);
        console.log('[DB] Current time:    ', now);

        // Check if the session row exists at all (ignoring expiry)
        const rawSession = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
        console.log('[DB] Raw session row: ', rawSession ?? 'NOT FOUND');

        // Check all sessions in the table
        const allSessions = db.prepare('SELECT token, user_id, expires_at FROM sessions').all();
        console.log('[DB] All sessions in DB:', allSessions.length ? allSessions : 'EMPTY TABLE');

        // Check all users
        const allUsers = db.prepare('SELECT id, login, github_id FROM users').all();
        console.log('[DB] All users in DB:  ', allUsers.length ? allUsers : 'EMPTY TABLE');
        // ──────────────────────────────────────────────────────────────────────

        const stmt = db.prepare(`
            SELECT u.* FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token = ? AND s.expires_at > ?
        `);
        const result = stmt.get(token, now) as UserRow | undefined;

        // ── DEBUG ──────────────────────────────────────────────────────────────
        console.log('[DB] JOIN result:      ', result ? `✅ user "${result.login}"` : '❌ no match');
        console.log('[DB] ─────────────────────────────────────────────────\n');
        // ──────────────────────────────────────────────────────────────────────

        return result;
    },

    /**
     * Delete a specific session (logout)
     */
    deleteSession: (token: string) => {
        const stmt = db.prepare('DELETE FROM sessions WHERE token = ?');
        return stmt.run(token);
    },

    /**
     * Delete all sessions for a user
     */
    deleteAllUserSessions: (userId: number) => {
        const stmt = db.prepare('DELETE FROM sessions WHERE user_id = ?');
        return stmt.run(userId);
    },

    /**
     * Purge expired sessions (maintenance)
     */
    purgeExpiredSessions: () => {
        const stmt = db.prepare('DELETE FROM sessions WHERE expires_at <= ?');
        return stmt.run(new Date().toISOString());
    }
};

// Type for returned user rows
export interface UserRow {
    id: number;
    github_id: string;
    login: string;
    name: string | null;
    email: string | null;
    avatar_url: string | null;
    access_token: string | null;
    installation_id: string | null;
    created_at: string;
    updated_at: string;
}

// Graceful shutdown
process.on('exit', () => {
    db.close();
});

process.on('SIGINT', () => {
    db.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    db.close();
    process.exit(0);
});

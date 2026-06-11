-- Deployments table: stores deployment metadata
CREATE TABLE IF NOT EXISTS deployments (
    deploy_id TEXT PRIMARY KEY,
    subdomain TEXT UNIQUE NOT NULL,
    port INTEGER NOT NULL,
    image_name TEXT NOT NULL,
    container_id TEXT NOT NULL,
    repo TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Builds table: tracks GitHub Actions workflow runs
CREATE TABLE IF NOT EXISTS builds (
    id TEXT PRIMARY KEY,
    repo TEXT NOT NULL,
    branch TEXT NOT NULL,
    github_run_id TEXT,
    status TEXT NOT NULL DEFAULT 'queued',
    subdomain TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Routes table: used by Caddy SQLite router
CREATE TABLE IF NOT EXISTS routes (
    domain TEXT PRIMARY KEY,
    host TEXT NOT NULL,
    port INTEGER NOT NULL
);

-- Index for faster port lookups
CREATE INDEX IF NOT EXISTS idx_deployments_port ON deployments(port);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);

-- Users table: stores GitHub App user profiles
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    github_id TEXT UNIQUE NOT NULL,
    login TEXT NOT NULL,
    name TEXT,
    email TEXT,
    avatar_url TEXT,
    access_token TEXT,
    installation_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Migration: add installation_id if it doesn't exist (safe to run on existing DBs)
CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY);


CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);

-- Sessions table: stores auth session tokens
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

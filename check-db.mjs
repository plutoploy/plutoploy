// Quick DB inspection script — run with: node --env-file=.env check-db.mjs
import Database from 'better-sqlite3';

const DB_PATH = process.env.DB_PATH || './data/plutoploy.db';
const db = new Database(DB_PATH);

console.log('\n📦 Database:', DB_PATH);
console.log('──────────────────────────────────────────────\n');

// Tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('📋 Tables:', tables.map(t => t.name).join(', ') || 'NONE');

// Users
console.log('\n👤 Users:');
const users = db.prepare('SELECT id, github_id, login, name, email, created_at FROM users').all();
if (users.length === 0) {
  console.log('   ❌ EMPTY — no users have been created!');
} else {
  users.forEach(u => console.log('  ', u));
}

// Sessions
console.log('\n🔑 Sessions:');
const sessions = db.prepare('SELECT id, user_id, token, expires_at, created_at FROM sessions').all();
if (sessions.length === 0) {
  console.log('   ❌ EMPTY — no sessions have been created!');
} else {
  sessions.forEach(s => console.log('  ', s));
}

// Deployments
console.log('\n🚀 Deployments:');
const deployments = db.prepare('SELECT deploy_id, subdomain, status FROM deployments').all();
if (deployments.length === 0) {
  console.log('   (none)');
} else {
  deployments.forEach(d => console.log('  ', d));
}

console.log('\n──────────────────────────────────────────────\n');
db.close();

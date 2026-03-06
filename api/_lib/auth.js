const crypto = require('crypto');
const { sql, hasDatabase } = require('./db');

const SESSION_TTL_DAYS = 14;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedValue) {
  const [salt, knownHash] = String(storedValue || '').split(':');
  if (!salt || !knownHash) {
    return false;
  }
  const attempted = crypto.pbkdf2Sync(password, salt, 100_000, 32, 'sha256').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(attempted), Buffer.from(knownHash));
}

function createSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice('Bearer '.length).trim();
}

async function requireUser(req) {
  const token = getBearerToken(req);
  if (!token || !hasDatabase()) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const result = await sql`
    select s.id as session_id, s.user_id, s.expires_at, u.email, u.full_name, u.role
    from auth_sessions s
    join auth_users u on u.id = s.user_id
    where s.token_hash = ${tokenHash}
      and s.expires_at > now()
    limit 1;
  `;

  return result.rows[0] || null;
}

function canAccessRole(userRole, requiredRole) {
  if (!userRole) return false;
  if (userRole === 'admin') return true;
  return userRole === requiredRole;
}

function sessionExpiry() {
  const expires = new Date();
  expires.setDate(expires.getDate() + SESSION_TTL_DAYS);
  return expires;
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSessionToken,
  hashSessionToken,
  requireUser,
  canAccessRole,
  sessionExpiry
};

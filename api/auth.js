const { json, readBody, methodNotAllowed, withApiGuard } = require('../server/lib/http');
const { sql, hasDatabase } = require('../server/lib/db');
const { hashPassword, verifyPassword, createSessionToken, hashSessionToken, requireUser, sessionExpiry } = require('../server/lib/auth');
const { validateCsrf, issueCsrfToken } = require('../server/lib/csrf');

module.exports = withApiGuard(async function handler(req, res) {
  const op = String(req.query.op || '').trim();

  if (op === 'me') {
    if (req.method !== 'GET') {
      methodNotAllowed(res, ['GET']);
      return;
    }
    const user = await requireUser(req);
    if (!user) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    json(res, 200, { user: { id: user.user_id, email: user.email, full_name: user.full_name, role: user.role } });
    return;
  }

  if (op === 'signup') {
    if (req.method !== 'POST') {
      methodNotAllowed(res, ['POST']);
      return;
    }
    if (!validateCsrf(req)) {
      json(res, 403, { error: 'CSRF validation failed' });
      return;
    }
    if (!hasDatabase()) {
      json(res, 400, { error: 'Database not configured yet' });
      return;
    }

    const body = await readBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const fullName = String(body.fullName || '').trim();
    const password = String(body.password || '').trim();
    const role = ['consumer', 'supplier'].includes(body.role) ? body.role : 'consumer';

    if (!email || !fullName || password.length < 8) {
      json(res, 400, { error: 'Email, full name, and 8+ character password are required' });
      return;
    }

    const exists = await sql`select id from auth_users where email = ${email} limit 1;`;
    if (exists.rows.length > 0) {
      json(res, 409, { error: 'Account already exists' });
      return;
    }

    const passwordHash = hashPassword(password);
    const userResult = await sql`
      insert into auth_users (email, full_name, password_hash, role)
      values (${email}, ${fullName}, ${passwordHash}, ${role})
      returning id, email, full_name, role;
    `;

    const token = createSessionToken();
    const tokenHash = hashSessionToken(token);
    const expires = sessionExpiry();
    await sql`insert into auth_sessions (user_id, token_hash, expires_at) values (${userResult.rows[0].id}, ${tokenHash}, ${expires.toISOString()});`;

    json(res, 201, { ok: true, token, csrfToken: issueCsrfToken(), user: userResult.rows[0] });
    return;
  }

  if (op === 'login') {
    if (req.method !== 'POST') {
      methodNotAllowed(res, ['POST']);
      return;
    }
    if (!validateCsrf(req)) {
      json(res, 403, { error: 'CSRF validation failed' });
      return;
    }
    if (!hasDatabase()) {
      json(res, 400, { error: 'Database not configured yet' });
      return;
    }

    const body = await readBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '').trim();

    const result = await sql`select id, email, full_name, role, password_hash from auth_users where email = ${email} limit 1;`;
    const user = result.rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      json(res, 401, { error: 'Invalid credentials' });
      return;
    }

    const token = createSessionToken();
    const tokenHash = hashSessionToken(token);
    const expires = sessionExpiry();
    await sql`insert into auth_sessions (user_id, token_hash, expires_at) values (${user.id}, ${tokenHash}, ${expires.toISOString()});`;

    json(res, 200, {
      ok: true,
      token,
      csrfToken: issueCsrfToken(),
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role }
    });
    return;
  }

  if (op === 'logout') {
    if (req.method !== 'POST') {
      methodNotAllowed(res, ['POST']);
      return;
    }
    if (!validateCsrf(req)) {
      json(res, 403, { error: 'CSRF validation failed' });
      return;
    }
    if (!hasDatabase()) {
      json(res, 200, { ok: true });
      return;
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (token) await sql`delete from auth_sessions where token_hash = ${hashSessionToken(token)};`;
    json(res, 200, { ok: true });
    return;
  }

  json(res, 404, { error: 'Unknown auth operation' });
}, { rateLimitKey: 'auth-group', rateLimitMax: 120 });

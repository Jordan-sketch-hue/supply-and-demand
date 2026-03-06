const { json, readBody, methodNotAllowed, withApiGuard } = require('../_lib/http');
const { sql, hasDatabase } = require('../_lib/db');
const { hashPassword, createSessionToken, hashSessionToken, sessionExpiry } = require('../_lib/auth');
const { validateCsrf, issueCsrfToken } = require('../_lib/security/csrf');

module.exports = withApiGuard(async function handler(req, res) {
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

  await sql`
    insert into auth_sessions (user_id, token_hash, expires_at)
    values (${userResult.rows[0].id}, ${tokenHash}, ${expires.toISOString()});
  `;

  json(res, 201, {
    ok: true,
    token,
    csrfToken: issueCsrfToken(),
    user: userResult.rows[0]
  });
}, { rateLimitKey: 'auth-signup', rateLimitMax: 20 });

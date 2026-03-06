const { json, readBody, methodNotAllowed, withApiGuard } = require('../_lib/http');
const { sql, hasDatabase } = require('../_lib/db');
const { verifyPassword, createSessionToken, hashSessionToken, sessionExpiry } = require('../_lib/auth');
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
  const password = String(body.password || '').trim();

  const result = await sql`
    select id, email, full_name, role, password_hash
    from auth_users
    where email = ${email}
    limit 1;
  `;

  const user = result.rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) {
    json(res, 401, { error: 'Invalid credentials' });
    return;
  }

  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const expires = sessionExpiry();

  await sql`
    insert into auth_sessions (user_id, token_hash, expires_at)
    values (${user.id}, ${tokenHash}, ${expires.toISOString()});
  `;

  json(res, 200, {
    ok: true,
    token,
    csrfToken: issueCsrfToken(),
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role
    }
  });
}, { rateLimitKey: 'auth-login', rateLimitMax: 30 });

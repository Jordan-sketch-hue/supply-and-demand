const { json, methodNotAllowed, withApiGuard } = require('../_lib/http');
const { sql, hasDatabase } = require('../_lib/db');
const { hashSessionToken } = require('../_lib/auth');
const { validateCsrf } = require('../_lib/security/csrf');

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
    json(res, 200, { ok: true });
    return;
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (token) {
    await sql`delete from auth_sessions where token_hash = ${hashSessionToken(token)};`;
  }

  json(res, 200, { ok: true });
});

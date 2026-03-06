const { json, readBody, methodNotAllowed, withApiGuard } = require('../_lib/http');
const { hasDatabase, sql } = require('../_lib/db');
const { requireUser } = require('../_lib/auth');
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

  const user = await requireUser(req);
  if (!user) {
    json(res, 401, { error: 'Unauthorized' });
    return;
  }

  const body = await readBody(req);
  const threadId = String(body.threadId || '').trim();
  const message = String(body.message || '').trim();

  if (!threadId || !message) {
    json(res, 400, { error: 'threadId and message are required' });
    return;
  }

  if (!hasDatabase()) {
    json(res, 201, { ok: true, message: { id: 'msg-preview', body: message } });
    return;
  }

  const permitted = await sql`
    select id
    from message_threads
    where id = ${threadId}
      and (consumer_user_id = ${user.user_id} or supplier_user_id = ${user.user_id});
  `;

  if (permitted.rows.length === 0) {
    json(res, 403, { error: 'Not permitted for this thread' });
    return;
  }

  const inserted = await sql`
    insert into messages (thread_id, sender_user_id, body)
    values (${threadId}, ${user.user_id}, ${message})
    returning id, thread_id, body, created_at;
  `;

  json(res, 201, { ok: true, message: inserted.rows[0] });
}, { rateLimitKey: 'messages-send', rateLimitMax: 120 });

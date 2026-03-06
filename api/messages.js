const { json, readBody, methodNotAllowed, withApiGuard } = require('../server/lib/http');
const { hasDatabase, sql } = require('../server/lib/db');
const { requireUser } = require('../server/lib/auth');
const { validateCsrf } = require('../server/lib/csrf');

module.exports = withApiGuard(async function handler(req, res) {
  const op = String(req.query.op || '').trim();

  if (op === 'thread') {
    if (req.method === 'GET') {
      const user = await requireUser(req);
      if (!user) return json(res, 401, { error: 'Unauthorized' });
      if (!hasDatabase()) return json(res, 200, { threads: [] });
      const result = await sql`select id, booking_id, consumer_user_id, supplier_user_id, created_at from message_threads where consumer_user_id = ${user.user_id} or supplier_user_id = ${user.user_id} order by created_at desc limit 50;`;
      return json(res, 200, { threads: result.rows });
    }

    if (req.method === 'POST') {
      if (!validateCsrf(req)) return json(res, 403, { error: 'CSRF validation failed' });
      const user = await requireUser(req);
      if (!user) return json(res, 401, { error: 'Unauthorized' });
      if (!hasDatabase()) return json(res, 201, { ok: true, thread: { id: 'thread-preview' } });
      const body = await readBody(req);
      const inserted = await sql`
        insert into message_threads (booking_id, consumer_user_id, supplier_user_id)
        values (${String(body.bookingId || '').trim() || null}, ${String(body.consumerUserId || user.user_id).trim()}, ${String(body.supplierUserId || '').trim() || null})
        returning id, created_at;
      `;
      return json(res, 201, { ok: true, thread: inserted.rows[0] });
    }

    return methodNotAllowed(res, ['GET', 'POST']);
  }

  if (op === 'send') {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    if (!validateCsrf(req)) return json(res, 403, { error: 'CSRF validation failed' });
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'Unauthorized' });

    const body = await readBody(req);
    const threadId = String(body.threadId || '').trim();
    const message = String(body.message || '').trim();
    if (!threadId || !message) return json(res, 400, { error: 'threadId and message are required' });

    if (!hasDatabase()) return json(res, 201, { ok: true, message: { id: 'msg-preview', body: message } });

    const permitted = await sql`select id from message_threads where id = ${threadId} and (consumer_user_id = ${user.user_id} or supplier_user_id = ${user.user_id});`;
    if (permitted.rows.length === 0) return json(res, 403, { error: 'Not permitted for this thread' });

    const inserted = await sql`insert into messages (thread_id, sender_user_id, body) values (${threadId}, ${user.user_id}, ${message}) returning id, thread_id, body, created_at;`;
    return json(res, 201, { ok: true, message: inserted.rows[0] });
  }

  json(res, 404, { error: 'Unknown messages operation' });
}, { rateLimitKey: 'messages-group', rateLimitMax: 180 });

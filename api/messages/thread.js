const { json, readBody, methodNotAllowed, withApiGuard } = require('../_lib/http');
const { hasDatabase, sql } = require('../_lib/db');
const { requireUser } = require('../_lib/auth');
const { validateCsrf } = require('../_lib/security/csrf');

module.exports = withApiGuard(async function handler(req, res) {
  if (req.method === 'POST') {
    if (!validateCsrf(req)) {
      json(res, 403, { error: 'CSRF validation failed' });
      return;
    }

    const user = await requireUser(req);
    if (!user) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }

    if (!hasDatabase()) {
      json(res, 201, { ok: true, thread: { id: 'thread-preview' } });
      return;
    }

    const body = await readBody(req);
    const bookingId = String(body.bookingId || '').trim() || null;
    const consumerUserId = String(body.consumerUserId || user.user_id).trim();
    const supplierUserId = String(body.supplierUserId || '').trim() || null;

    const inserted = await sql`
      insert into message_threads (booking_id, consumer_user_id, supplier_user_id)
      values (${bookingId}, ${consumerUserId}, ${supplierUserId})
      returning id, created_at;
    `;

    json(res, 201, { ok: true, thread: inserted.rows[0] });
    return;
  }

  if (req.method === 'GET') {
    const user = await requireUser(req);
    if (!user) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }

    if (!hasDatabase()) {
      json(res, 200, { threads: [] });
      return;
    }

    const result = await sql`
      select id, booking_id, consumer_user_id, supplier_user_id, created_at
      from message_threads
      where consumer_user_id = ${user.user_id}
         or supplier_user_id = ${user.user_id}
      order by created_at desc
      limit 50;
    `;

    json(res, 200, { threads: result.rows });
    return;
  }

  methodNotAllowed(res, ['GET', 'POST']);
});

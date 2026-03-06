const { json, readBody, methodNotAllowed, withApiGuard } = require('../server/lib/http');
const { hasDatabase, sql } = require('../server/lib/db');
const { requireUser } = require('../server/lib/auth');
const { validateCsrf } = require('../server/lib/csrf');

const allowed = new Set(['confirmed', 'in_progress', 'completed', 'cancelled', 'disputed']);

module.exports = withApiGuard(async function handler(req, res) {
  const op = String(req.query.op || '').trim();

  if (op === 'list') {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'Unauthorized' });
    if (!hasDatabase()) return json(res, 200, { bookings: [] });

    const result = user.role === 'admin'
      ? await sql`select id, status, scheduled_at, created_at from bookings order by created_at desc limit 50;`
      : await sql`select id, status, scheduled_at, created_at from bookings where consumer_user_id = ${user.user_id} or supplier_user_id = ${user.user_id} order by created_at desc limit 50;`;
    return json(res, 200, { bookings: result.rows });
  }

  if (op === 'create') {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    if (!validateCsrf(req)) return json(res, 403, { error: 'CSRF validation failed' });
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'Unauthorized' });
    if (!hasDatabase()) return json(res, 200, { ok: true, id: 'booking-preview', mode: 'mock' });

    const body = await readBody(req);
    const inserted = await sql`
      insert into bookings (consumer_user_id, supplier_user_id, demand_request_id, status, scheduled_at)
      values (${user.user_id}, ${String(body.supplierUserId || '').trim() || null}, ${String(body.demandRequestId || '').trim() || null}, 'pending', ${String(body.scheduledAt || '').trim() || null})
      returning id, status, created_at;
    `;
    return json(res, 201, { ok: true, booking: inserted.rows[0] });
  }

  if (op === 'status') {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    if (!validateCsrf(req)) return json(res, 403, { error: 'CSRF validation failed' });
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'Unauthorized' });
    if (!hasDatabase()) return json(res, 200, { ok: true, mode: 'mock' });

    const body = await readBody(req);
    const bookingId = String(body.bookingId || '').trim();
    const status = String(body.status || '').trim();
    if (!bookingId || !allowed.has(status)) return json(res, 400, { error: 'Invalid booking status update' });

    const updated = await sql`
      update bookings
      set status = ${status}, updated_at = now()
      where id = ${bookingId}
        and (${user.role} = 'admin' or consumer_user_id = ${user.user_id} or supplier_user_id = ${user.user_id})
      returning id, status, updated_at;
    `;
    if (updated.rows.length === 0) return json(res, 404, { error: 'Booking not found or not permitted' });
    return json(res, 200, { ok: true, booking: updated.rows[0] });
  }

  json(res, 404, { error: 'Unknown bookings operation' });
}, { rateLimitKey: 'bookings-group', rateLimitMax: 140 });

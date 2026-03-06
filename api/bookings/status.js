const { json, readBody, methodNotAllowed, withApiGuard } = require('../_lib/http');
const { hasDatabase, sql } = require('../_lib/db');
const { requireUser } = require('../_lib/auth');
const { validateCsrf } = require('../_lib/security/csrf');

const allowed = new Set(['confirmed', 'in_progress', 'completed', 'cancelled', 'disputed']);

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

  if (!hasDatabase()) {
    json(res, 200, { ok: true, mode: 'mock' });
    return;
  }

  const body = await readBody(req);
  const bookingId = String(body.bookingId || '').trim();
  const status = String(body.status || '').trim();

  if (!bookingId || !allowed.has(status)) {
    json(res, 400, { error: 'Invalid booking status update' });
    return;
  }

  const updated = await sql`
    update bookings
    set status = ${status}, updated_at = now()
    where id = ${bookingId}
      and (${user.role} = 'admin' or consumer_user_id = ${user.user_id} or supplier_user_id = ${user.user_id})
    returning id, status, updated_at;
  `;

  if (updated.rows.length === 0) {
    json(res, 404, { error: 'Booking not found or not permitted' });
    return;
  }

  json(res, 200, { ok: true, booking: updated.rows[0] });
}, { rateLimitKey: 'bookings-status', rateLimitMax: 80 });

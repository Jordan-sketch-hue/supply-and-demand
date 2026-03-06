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

  if (!hasDatabase()) {
    json(res, 200, { ok: true, id: 'booking-preview', mode: 'mock' });
    return;
  }

  const body = await readBody(req);
  const supplierUserId = String(body.supplierUserId || '').trim() || null;
  const demandRequestId = String(body.demandRequestId || '').trim() || null;
  const scheduledAt = String(body.scheduledAt || '').trim() || null;

  const inserted = await sql`
    insert into bookings (consumer_user_id, supplier_user_id, demand_request_id, status, scheduled_at)
    values (${user.user_id}, ${supplierUserId}, ${demandRequestId}, 'pending', ${scheduledAt})
    returning id, status, created_at;
  `;

  json(res, 201, { ok: true, booking: inserted.rows[0] });
}, { rateLimitKey: 'bookings-create', rateLimitMax: 40 });

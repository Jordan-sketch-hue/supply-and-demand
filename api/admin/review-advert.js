const { json, readBody, methodNotAllowed, withApiGuard } = require('../_lib/http');
const { hasDatabase, sql, writeAdminAuditLog } = require('../_lib/db');
const { requireUser, canAccessRole } = require('../_lib/auth');
const { validateCsrf } = require('../_lib/security/csrf');

const allowed = new Set(['approved', 'rejected', 'live', 'paused']);

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
  if (!user || !canAccessRole(user.role, 'admin')) {
    json(res, 403, { error: 'Admin access required' });
    return;
  }

  if (!hasDatabase()) {
    json(res, 200, { ok: true, mode: 'mock' });
    return;
  }

  const body = await readBody(req);
  const advertId = String(body.advertId || '').trim();
  const advertIds = Array.isArray(body.advertIds)
    ? body.advertIds.map(id => String(id).trim()).filter(Boolean)
    : [];
  const status = String(body.status || '').trim();

  const targetIds = advertIds.length > 0 ? advertIds : advertId ? [advertId] : [];

  if (targetIds.length === 0 || !allowed.has(status)) {
    json(res, 400, { error: 'Invalid advert review payload' });
    return;
  }

  const updated = await sql`
    update adverts
    set status = ${status}
    where id = any(${targetIds}::uuid[])
    returning id, status;
  `;

  if (updated.rows.length === 0) {
    json(res, 404, { error: 'Advert not found' });
    return;
  }

  for (const row of updated.rows) {
    await writeAdminAuditLog({
      actorUserId: user.user_id,
      actorEmail: user.email,
      action: 'advert_status_update',
      entityType: 'advert',
      entityId: row.id,
      details: {
        status,
        bulk: targetIds.length > 1
      }
    });
  }

  json(res, 200, {
    ok: true,
    advert: updated.rows[0],
    adverts: updated.rows,
    updatedCount: updated.rows.length
  });
}, { rateLimitKey: 'admin-ad-review', rateLimitMax: 100 });
